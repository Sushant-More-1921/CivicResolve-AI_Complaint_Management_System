import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest } from '../../middleware/auth.middleware';
import { socketService } from '../realtime/socket.service';
import { smsGateway, SmsTemplateType } from './sms.service';

export interface NotificationInput {
  userId?: string | null;
  complaintId?: string | null;
  trackingNumber?: string | null;
  phoneNumber?: string | null;
  title: string;
  message: string;
  type?: string;
  channel?: 'IN_APP' | 'SMS' | 'ALL';
  link?: string | null;
  smsTemplate?: SmsTemplateType;
  additionalInfo?: string;
  customSmsMessage?: string;
}

export function sanitizeNotificationContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\([A-Za-z_\s]+ priority\)/gi, '')
    .replace(/\s*\(priority:?\s*[A-Za-z_\s]+\)/gi, '')
    .replace(/\bRegistered\b/gi, 'Submitted')
    .replace(/New [A-Za-z_\s]+ Complaint Routed/gi, 'New Complaint Routed')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Core notification dispatch function.
 * Saves to DB, delivers instantly via Socket.IO, and dispatches SMS asynchronously.
 */
export async function createNotification(input: NotificationInput): Promise<any> {
  try {
    if (!input.userId && !input.phoneNumber) return null;

    let targetPhone = input.phoneNumber || null;
    let websiteAllowed = true;
    let smsAllowed = true;

    // Check recipient user preferences if userId is provided
    if (input.userId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          phoneNumber: true,
          websiteNotifications: true,
          smsNotifications: true,
          notifyStatusChange: true,
          notifyResolution: true,
          notifyInfoRequest: true,
        },
      });

      if (user) {
        if (!targetPhone) targetPhone = user.phoneNumber;
        websiteAllowed = user.websiteNotifications;
        smsAllowed = user.smsNotifications;

        const eventType = (input.type || '').toUpperCase();
        if (eventType === 'STATUS_CHANGE' && !user.notifyStatusChange) {
          websiteAllowed = false;
          smsAllowed = false;
        } else if ((eventType === 'RESOLUTION' || eventType === 'RESOLVED') && !user.notifyResolution) {
          websiteAllowed = false;
          smsAllowed = false;
        } else if ((eventType === 'INFO_REQUESTED' || eventType === 'ACTION_REQUIRED') && !user.notifyInfoRequest) {
          websiteAllowed = false;
          smsAllowed = false;
        }
      }
    }

    const channel = input.channel || (targetPhone && input.smsTemplate ? 'ALL' : 'IN_APP');

    // If both channels are rejected by user preference, do not create
    const shouldSendInApp = websiteAllowed && (channel === 'IN_APP' || channel === 'ALL');
    const shouldSendSms = smsAllowed && (channel === 'SMS' || channel === 'ALL') && !!targetPhone;

    if (!shouldSendInApp && !shouldSendSms) {
      return null;
    }

    const cleanTitle = sanitizeNotificationContent(input.title);
    const cleanMessage = sanitizeNotificationContent(input.message);

    // 1. Database Storage (Source of Truth)
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId || null,
        complaintId: input.complaintId || null,
        phoneNumber: targetPhone,
        title: cleanTitle,
        message: cleanMessage,
        type: input.type || 'STATUS_CHANGE',
        channel: channel,
        deliveryStatus: shouldSendSms ? 'PENDING' : 'DELIVERED',
        link: input.link || (input.trackingNumber ? `/citizen/dashboard` : null),
      },
    });

    // 2. Real-Time Delivery via Socket.IO
    if (shouldSendInApp && input.userId) {
      socketService.emitToUser(input.userId, 'notification:new', {
        id: notification.id,
        complaintId: notification.complaintId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        channel: notification.channel,
        link: notification.link,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }

    // 3. Asynchronous SMS Queue / Dispatch (Non-blocking)
    if (shouldSendSms && targetPhone) {
      const templateType: SmsTemplateType =
        input.smsTemplate ||
        (input.type === 'COMPLAINT_CREATED'
          ? 'COMPLAINT_RECEIVED'
          : input.type === 'RESOLUTION' || input.type === 'RESOLVED'
          ? 'COMPLAINT_RESOLVED'
          : input.type === 'INFO_REQUESTED'
          ? 'ACTION_REQUIRED'
          : input.type === 'WORK_STARTED'
          ? 'WORK_STARTED'
          : 'STATUS_UPDATED');

      const tracking = input.trackingNumber || 'CR';

      // Execute asynchronously so complaint lifecycle / HTTP request is not blocked
      setImmediate(async () => {
        try {
          const smsResult = await smsGateway.sendNotificationSms({
            phoneNumber: targetPhone!,
            templateType,
            trackingNumber: tracking,
            additionalInfo: input.additionalInfo,
            customMessage: input.customSmsMessage,
          });

          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: smsResult.status,
            },
          });
        } catch (smsErr) {
          console.error(`[Notification Service] Async SMS delivery failed for ${notification.id}:`, smsErr);
          await prisma.notification.update({
            where: { id: notification.id },
            data: { deliveryStatus: 'FAILED' },
          }).catch(() => {});
        }
      });
    }

    return notification;
  } catch (err) {
    console.error('[Notification Service] Failed to create notification:', err);
    return null;
  }
}

/**
 * Fetch notifications for authenticated user
 */
export async function getMyNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const list = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          ...(req.user.phoneNumber ? [{ phoneNumber: req.user.phoneNumber }] : []),
        ],
      },
      include: {
        complaint: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const unreadCount = list.filter((n) => !n.isRead).length;

    const sanitizedList = list.map((n) => ({
      id: n.id,
      userId: n.userId,
      complaintId: n.complaintId,
      complaintTrackingNumber: n.complaint?.trackingNumber || null,
      title: sanitizeNotificationContent(n.title),
      message: sanitizeNotificationContent(n.message),
      type: n.type,
      channel: n.channel,
      isRead: n.isRead,
      readAt: n.readAt,
      deliveryStatus: n.deliveryStatus,
      link: n.link || (n.complaint?.trackingNumber ? `/citizen/dashboard` : null),
      createdAt: n.createdAt,
    }));

    res.status(200).json({ success: true, unreadCount, data: sanitizedList });
  } catch (err) {
    next(err);
  }
}

/**
 * Clear all notifications for authenticated user
 */
export async function clearAllNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.notification.deleteMany({
      where: {
        OR: [
          { userId: req.user.id },
          ...(req.user.phoneNumber ? [{ phoneNumber: req.user.phoneNumber }] : []),
        ],
      },
    });

    // Notify user's active sockets
    socketService.emitToUser(req.user.id, 'notification:cleared', { userId: req.user.id });

    res.status(200).json({ success: true, message: 'All notifications cleared.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark a single notification or all notifications as read
 */
export async function markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const id = String(req.params.id);

    if (id === 'all') {
      await prisma.notification.updateMany({
        where: {
          OR: [
            { userId: req.user.id },
            ...(req.user.phoneNumber ? [{ phoneNumber: req.user.phoneNumber }] : []),
          ],
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      // Realtime notification sync across user's open tabs
      socketService.emitToUser(req.user.id, 'notification:read', { all: true });

      return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    }

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || (existing.userId && existing.userId !== req.user.id && existing.phoneNumber !== req.user.phoneNumber)) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Realtime notification sync
    socketService.emitToUser(req.user.id, 'notification:read', { id, isRead: true });

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
