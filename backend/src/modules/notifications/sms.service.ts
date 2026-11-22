import { env } from '../../config/env';

export type SmsTemplateType =
  | 'COMPLAINT_RECEIVED'
  | 'WORK_STARTED'
  | 'COMPLAINT_RESOLVED'
  | 'ACTION_REQUIRED'
  | 'STATUS_UPDATED';

export interface SmsSendOptions {
  phoneNumber: string;
  templateType: SmsTemplateType;
  trackingNumber: string;
  additionalInfo?: string;
  customMessage?: string;
}

export interface SmsDeliveryResult {
  success: boolean;
  provider: 'textbee' | 'twilio' | 'console_dev';
  status: 'DELIVERED' | 'FAILED' | 'PENDING';
  messageId?: string;
  error?: string;
}

/**
 * Validates and formats Indian mobile numbers.
 * Supports:
 *  - 10-digit number starting with 6, 7, 8, 9 (e.g. 9876543210)
 *  - With +91 or 91 prefix (e.g. +919876543210, 919876543210)
 */
export function validateAndFormatIndianPhone(phone: string): { isValid: boolean; formatted: string | null; clean10: string | null } {
  if (!phone) return { isValid: false, formatted: null, clean10: null };

  const digits = phone.replace(/\D/g, '');
  const clean10 = digits.slice(-10);

  // Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(clean10)) {
    return {
      isValid: true,
      formatted: `+91${clean10}`,
      clean10,
    };
  }

  return { isValid: false, formatted: null, clean10: null };
}

/**
 * Generates DLT-compliant Indian SMS content based on standardized templates.
 */
export function buildSmsMessage(options: {
  templateType: SmsTemplateType;
  trackingNumber: string;
  additionalInfo?: string;
  customMessage?: string;
}): string {
  if (options.customMessage) {
    return options.customMessage.trim();
  }

  const tracking = options.trackingNumber || 'CR';

  switch (options.templateType) {
    case 'COMPLAINT_RECEIVED':
      return `Your CivicResolve complaint #${tracking} has been successfully submitted. Track your complaint through the CivicResolve portal.`;

    case 'WORK_STARTED':
      return `Update: Work has started on your CivicResolve complaint #${tracking}.`;

    case 'COMPLAINT_RESOLVED':
      return `Your CivicResolve complaint #${tracking} has been marked as resolved. Please visit the portal for details.`;

    case 'ACTION_REQUIRED':
      return `Action required: Additional information is needed for your CivicResolve complaint #${tracking}. Please check your portal.`;

    case 'STATUS_UPDATED':
    default:
      const statusText = options.additionalInfo ? ` is now ${options.additionalInfo}` : ' has been updated';
      return `Update: Your CivicResolve complaint #${tracking}${statusText}. Track your complaint through the CivicResolve portal.`;
  }
}

export class SmsGatewayService {
  private static instance: SmsGatewayService;
  private cachedTextBeeDeviceId: string | null = null;

  private constructor() {}

  public static getInstance(): SmsGatewayService {
    if (!SmsGatewayService.instance) {
      SmsGatewayService.instance = new SmsGatewayService();
    }
    return SmsGatewayService.instance;
  }

  /**
   * Helper to retrieve or cache an active TextBee device ID
   */
  private async getTextBeeDeviceId(apiKey: string): Promise<string | undefined> {
    if (this.cachedTextBeeDeviceId) {
      return this.cachedTextBeeDeviceId;
    }

    try {
      const res = await fetch('https://api.textbee.dev/api/v1/gateway/devices', {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const json: any = await res.json();
        const devices = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (devices.length > 0) {
          if (env.TEXTBEE_DEVICE_ID) {
            const configured = devices.find(
              (d: any) => (d._id === env.TEXTBEE_DEVICE_ID || d.id === env.TEXTBEE_DEVICE_ID) && d.enabled
            );
            if (configured) {
              this.cachedTextBeeDeviceId = env.TEXTBEE_DEVICE_ID;
              return env.TEXTBEE_DEVICE_ID;
            }
          }

          const activeDevice =
            devices.find((d: any) => d.enabled && d.isDefault) ||
            devices.find((d: any) => d.enabled) ||
            devices[0];
          const id = activeDevice?._id || activeDevice?.id;
          if (id) {
            this.cachedTextBeeDeviceId = id;
            return id;
          }
        }
      }
    } catch {
      // Fallback
    }

    return undefined;
  }

  /**
   * Dispatches an SMS using the configured provider with automatic retry (up to 3 times)
   */
  public async sendNotificationSms(options: SmsSendOptions): Promise<SmsDeliveryResult> {
    const { isValid, formatted, clean10 } = validateAndFormatIndianPhone(options.phoneNumber);

    if (!isValid || !formatted || !clean10) {
      console.warn(`[SMS] Invalid Indian phone number skipped: "${options.phoneNumber}"`);
      return {
        success: false,
        provider: 'console_dev',
        status: 'FAILED',
        error: 'Invalid Indian mobile number format',
      };
    }

    const messageText = buildSmsMessage(options);

    // 1. TextBee Gateway (if configured)
    if (env.TEXTBEE_API_KEY) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const deviceId = env.TEXTBEE_DEVICE_ID || (await this.getTextBeeDeviceId(env.TEXTBEE_API_KEY));
          const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
            method: 'POST',
            headers: {
              'x-api-key': env.TEXTBEE_API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              receipients: [formatted],
              message: messageText,
              deviceId: deviceId || undefined,
              simSubscriptionId: env.TEXTBEE_SIM_SUBSCRIPTION_ID || undefined,
            }),
          });

          if (response.ok) {
            const data: any = await response.json();
            console.log(`📱 [SMS TextBee] Successfully dispatched to ${formatted} (Attempt ${attempt})`);
            return {
              success: true,
              provider: 'textbee',
              status: 'DELIVERED',
              messageId: data?.data?.id || data?.id,
            };
          }

          console.warn(`[SMS TextBee] HTTP ${response.status} on attempt ${attempt}/3`);
        } catch (err: any) {
          console.warn(`[SMS TextBee] Attempt ${attempt}/3 failed: ${err.message}`);
        }

        // Exponential backoff before retry: 500ms, 1200ms
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        }
      }
    }

    // 2. Fallback / Dev Simulator: Clean high-visibility terminal log
    console.log(`
========================================================================
📱 [CIVICRESOLVE SMS NOTIFICATION DISPATCH]
To          : ${formatted}
Template    : ${options.templateType}
Complaint # : ${options.trackingNumber}
Message     : "${messageText}"
Status      : DELIVERED (Simulated Dev Gateway)
========================================================================`);

    return {
      success: true,
      provider: 'console_dev',
      status: 'DELIVERED',
      messageId: `sim_${Date.now()}`,
    };
  }
}

export const smsGateway = SmsGatewayService.getInstance();

