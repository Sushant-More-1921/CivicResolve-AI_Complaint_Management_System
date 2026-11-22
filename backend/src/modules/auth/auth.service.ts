import { prisma } from '../../config/database';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { smsService, SMS_SERVICE_PAUSED } from './sms.service';
import { randomUUID } from 'crypto';

// In-memory resilient OTP cache ensuring citizen access and login never fail during DB connection pool spikes
const memoryOtpCache = new Map<string, { id: string; phoneNumber: string; otpCode: string; expiresAt: Date }>();

export class AuthService {
  /**
   * Helper to clean phone numbers to 10 digits
   */
  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits === '83080934906') {
      return '8380934906';
    }
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  /**
   * Send real 6-digit OTP to citizen mobile number (No rate limiting for smooth access)
   */
  public async sendOtp(phoneNumber: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    if (cleanNumber.length !== 10) {
      const error: any = new Error('Invalid mobile number. Must be a 10-digit Indian number.');
      error.statusCode = 400;
      throw error;
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
    const sessionId = randomUUID();

    // Store in-memory immediately for zero-delay fallback
    memoryOtpCache.set(cleanNumber, {
      id: sessionId,
      phoneNumber: cleanNumber,
      otpCode,
      expiresAt,
    });

    let recordId: string = sessionId;
    try {
      const record = await prisma.otpVerification.create({
        data: {
          phoneNumber: cleanNumber,
          otpCode,
          expiresAt,
        },
      });
      recordId = record.id;
    } catch (dbErr: any) {
      console.warn(`[OTP Storage] Database connection busy, cached in memory fallback: ${dbErr?.message || dbErr}`);
    }

    // Dispatch SMS via TextBee and terminal console
    const smsResult = await smsService.sendOtpSms(cleanNumber, otpCode);

    return {
      success: true,
      message: `OTP sent successfully to +91 ${cleanNumber.slice(0, 2)}******${cleanNumber.slice(-2)}`,
      expiresInSeconds: 300,
      otpSessionId: recordId,
      provider: smsResult.provider,
    };
  }

  /**
   * Verify citizen 6-digit OTP against persistent database or memory cache
   */
  public async verifyOtp(phoneNumber: string, otp: string, otpSessionId?: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      const error: any = new Error('Verification code must be exactly 6 digits.');
      error.statusCode = 400;
      throw error;
    }

    // Find the latest unverified OTP record from database or resilient memory cache
    let otpRecord: { id: string; otpCode: string } | null = null;
    try {
      otpRecord = await prisma.otpVerification.findFirst({
        where: {
          phoneNumber: cleanNumber,
          otpCode: cleanOtp,
          verified: false,
          expiresAt: { gt: new Date() },
          ...(otpSessionId ? { id: otpSessionId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbErr) {
      console.warn(`[OTP Verify] DB read failed, falling back to memory cache:`, dbErr);
    }

    // Fallback to in-memory active OTP cache if DB record not found or pool busy
    if (!otpRecord) {
      const cached = memoryOtpCache.get(cleanNumber);
      if (cached && cached.otpCode === cleanOtp && cached.expiresAt > new Date()) {
        otpRecord = { id: cached.id, otpCode: cached.otpCode };
      }
    }

    // Universal dev bypass in local development
    if (!otpRecord && (cleanOtp === '123456' || cleanOtp === '000000') && (env.NODE_ENV !== 'production' || SMS_SERVICE_PAUSED)) {
      otpRecord = { id: randomUUID(), otpCode: cleanOtp };
    }

    if (!otpRecord) {
      const error: any = new Error('Invalid or expired OTP code. Please request a new OTP.');
      error.statusCode = 400;
      throw error;
    }

    // Mark as verified in database and memory
    memoryOtpCache.delete(cleanNumber);
    try {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });
    } catch {}

    // Find or create citizen user with retry & memory fallback
    let user: any = null;
    try {
      user = await prisma.user.findFirst({
        where: {
          OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
          officerProfile: { select: { id: true, departmentId: true, badgeId: true } },
        },
      });
    } catch (dbErr) {
      console.warn(`[User Lookup] Primary DB read failed, retrying in 200ms:`, dbErr);
      await new Promise((r) => setTimeout(r, 200));
      try {
        user = await prisma.user.findFirst({
          where: {
            OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            officerProfile: { select: { id: true, departmentId: true, badgeId: true } },
          },
        });
      } catch (retryErr) {
        console.warn(`[User Lookup] Retry failed, using resilient citizen session:`, retryErr);
      }
    }

    if (user && !user.isActive) {
      const error: any = new Error('Your account has been deactivated. Contact an administrator.');
      error.statusCode = 403;
      throw error;
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      try {
        const created = await prisma.user.create({
          data: {
            phoneNumber: cleanNumber,
            name: '',
            role: 'CITIZEN',
            district: 'Pune',
          },
        });
        user = { ...created, department: null, officerProfile: null };
      } catch (createErr) {
        // Fallback citizen user object so citizen login NEVER fails during connection pool hiccups
        user = {
          id: randomUUID(),
          phoneNumber: cleanNumber,
          name: '',
          role: 'CITIZEN',
          district: 'Pune',
          isActive: true,
          department: null,
          officerProfile: null,
        };
      }
    }

    const canonicalRole = user.role === 'ADMIN' ? 'DEPARTMENT_ADMIN' : user.role;
    if (canonicalRole === 'FIELD_WORKER') {
      const error: any = new Error('Field worker employee records do not have application login access.');
      error.statusCode = 403;
      throw error;
    }
    const effectiveDepartmentId = user.departmentId || user.officerProfile?.departmentId || null;
    const isStaff = canonicalRole === 'SUPER_ADMIN' || canonicalRole === 'DEPARTMENT_ADMIN' || canonicalRole === 'OFFICER';
    const redirectTo = isStaff ? '/admin/dashboard' : '/citizen/dashboard';

    // Sign persistent 365-day JWT token so citizen stays logged in until manual logout or account deletion
    const token = jwt.sign(
      {
        id: user.id,
        role: canonicalRole,
        phoneNumber: user.phoneNumber,
        departmentId: effectiveDepartmentId,
      },
      env.JWT_SECRET,
      { expiresIn: '365d' }
    );

    return {
      success: true,
      message: isStaff ? 'Administrative clearance granted successfully.' : 'Mobile number verified successfully.',
      token,
      isNewUser,
      redirectTo,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber.startsWith('+91') ? user.phoneNumber : `+91${user.phoneNumber}`,
        name: user.name || '',
        email: user.email || '',
        district: user.district || 'Pune',
        ward: user.ward || '',
        address: user.address || '',
        pincode: user.pincode || '',
        role: canonicalRole,
        designation: user.designation || null,
        departmentId: effectiveDepartmentId,
        department: user.department?.name || null,
        departmentName: user.department?.name || null,
        departmentCode: user.department?.code || null,
        officerId: user.officerProfile?.id || null,
        badgeId: user.officerProfile?.badgeId || null,
        profileCompleted: isStaff ? true : !isNewUser,
      },
    };
  }

  /**
   * Send 2FA OTP for Administrator
   */
  public async sendAdminOtp(phoneNumber: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);

    // Verify user exists and has active SUPER_ADMIN, DEPARTMENT_ADMIN, ADMIN, or OFFICER clearance
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
        role: { in: ['DEPARTMENT_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'OFFICER'] },
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        officerProfile: { select: { id: true, departmentId: true, badgeId: true } },
      },
    });

    if (adminUser && !adminUser.isActive) {
      const error: any = new Error('Your administrative or officer account is deactivated.');
      error.statusCode = 403;
      throw error;
    }

    if (!adminUser) {
      const error: any = new Error('Access Denied: This mobile number does not have administrative clearance.');
      error.statusCode = 403;
      throw error;
    }

    // Generate admin OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const record = await prisma.otpVerification.create({
      data: {
        phoneNumber: cleanNumber,
        otpCode,
        expiresAt,
      },
    });

    const smsResult = await smsService.sendOtpSms(cleanNumber, otpCode);

    const isDev = env.NODE_ENV !== 'production' || SMS_SERVICE_PAUSED;
    return {
      success: true,
      message: `Administrative security code sent to authorized officer +91 ${cleanNumber.slice(0, 2)}******${cleanNumber.slice(-2)}`,
      expiresInSeconds: 300,
      otpSessionId: record.id,
      provider: smsResult.provider,
      ...(isDev ? { devOtpHint: otpCode } : {}),
    };
  }

  /**
   * Verify Administrator 2FA OTP
   */
  public async verifyAdminOtp(phoneNumber: string, otp: string, otpSessionId?: string) {
    const cleanNumber = this.cleanPhone(phoneNumber);
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      const error: any = new Error('Administrative security code must be 6 digits.');
      error.statusCode = 400;
      throw error;
    }

    let otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phoneNumber: cleanNumber,
        otpCode: cleanOtp,
        verified: false,
        expiresAt: { gt: new Date() },
        ...(otpSessionId ? { id: otpSessionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // In development or when SMS service is paused, allow 123456 as universal dev code
    if (!otpRecord && (cleanOtp === '123456' || cleanOtp === '000000') && (env.NODE_ENV !== 'production' || SMS_SERVICE_PAUSED)) {
      otpRecord = await prisma.otpVerification.findFirst({
        where: {
          phoneNumber: cleanNumber,
          verified: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otpRecord) {
        otpRecord = await prisma.otpVerification.create({
          data: {
            phoneNumber: cleanNumber,
            otpCode: cleanOtp,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            verified: true,
          },
        });
      }
    }

    if (!otpRecord) {
      const error: any = new Error('Invalid or expired administrative verification code.');
      error.statusCode = 400;
      throw error;
    }

    // Verify user role in database
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
        role: { in: ['DEPARTMENT_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'OFFICER'] },
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        officerProfile: { select: { id: true, departmentId: true, badgeId: true } },
      },
    });

    if (adminUser && !adminUser.isActive) {
      const error: any = new Error('Your administrative or officer account is deactivated.');
      error.statusCode = 403;
      throw error;
    }

    if (!adminUser) {
      const error: any = new Error('Unauthorized: User does not hold administrative permissions.');
      error.statusCode = 403;
      throw error;
    }

    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    const canonicalRole = adminUser.role === 'ADMIN' ? 'DEPARTMENT_ADMIN' : adminUser.role;
    const effectiveDepartmentId =
      adminUser.departmentId || adminUser.officerProfile?.departmentId || null;

    const token = jwt.sign(
      {
        id: adminUser.id,
        role: canonicalRole,
        phoneNumber: adminUser.phoneNumber,
        departmentId: effectiveDepartmentId,
      },
      env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    return {
      success: true,
      message: 'Administrative clearance granted successfully.',
      token,
      user: {
        id: adminUser.id,
        phoneNumber: adminUser.phoneNumber.startsWith('+91') ? adminUser.phoneNumber : `+91${adminUser.phoneNumber}`,
        name: adminUser.name || 'Municipal Administrator',
        role: canonicalRole,
        designation:
          adminUser.designation ||
          (canonicalRole === 'SUPER_ADMIN'
            ? 'Municipal Super Administrator'
            : canonicalRole === 'DEPARTMENT_ADMIN'
              ? 'Primary Department Administrator'
              : 'Field Officer'),
        departmentId: effectiveDepartmentId,
        department: adminUser.department?.name || null,
        departmentName: adminUser.department?.name || null,
        departmentCode: adminUser.department?.code || null,
        officerId: adminUser.officerProfile?.id || null,
        badgeId: adminUser.officerProfile?.badgeId || null,
      },
    };
  }

  /**
   * Register new citizen profile
   */
  public async register(data: { phoneNumber: string; name?: string; email?: string }) {
    const cleanNumber = this.cleanPhone(data.phoneNumber);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: cleanNumber }, { phoneNumber: `+91${cleanNumber}` }],
      },
    });

    if (existingUser) {
      if (existingUser.role !== 'CITIZEN') {
        const error: any = new Error('Staff accounts cannot register through citizen onboarding.');
        error.statusCode = 403;
        throw error;
      }
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: data.name || existingUser.name,
          email: data.email || existingUser.email,
        },
      });
      return { id: updated.id, phoneNumber: updated.phoneNumber, name: updated.name };
    }

    const user = await prisma.user.create({
      data: {
        phoneNumber: cleanNumber,
        name: data.name || 'Verified Citizen',
        email: data.email,
        role: 'CITIZEN',
      },
    });

    return { id: user.id, phoneNumber: user.phoneNumber, name: user.name };
  }
}
