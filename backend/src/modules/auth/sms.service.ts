import { env } from '../../config/env';

export interface SmsSendResult {
  sent: boolean;
  provider: 'textbee' | 'console_dev';
  message: string;
}

/**
 * SMS SERVICE STATUS:
 * Set to `false` so physical SMS delivery via TextBee is ACTIVE.
 * Both live SMS and terminal console outputs are always active.
 */
export const SMS_SERVICE_PAUSED = false;

export class SmsService {
  private cachedTextBeeDeviceId: string | null = null;

  /**
   * Helper to retrieve or discover an active TextBee device ID
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
   * Dispatches OTP SMS code via TextBee SMS Gateway and logs OTP prominently to the terminal console.
   */
  public async sendOtpSms(phoneNumber: string, otpCode: string): Promise<SmsSendResult> {
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);

    // High-visibility OTP in the developer terminal console
    console.log(`
========================================================================
🔑 [CIVICRESOLVE OTP DISPATCH - SMS & TERMINAL ACTIVE]
📱 Target Mobile : +91 ${cleanPhone}
🔢 6-Digit OTP   : ${otpCode}
⏳ Expiry        : 5 minutes
📡 SMS Gateway   : TextBee Active (+ Terminal Console Output)
========================================================================`);

    // When paused, return terminal response immediately without calling external SMS provider
    if (SMS_SERVICE_PAUSED) {
      return {
        sent: true,
        provider: 'console_dev',
        message: 'SMS service paused. OTP printed to terminal.',
      };
    }

    // 1. TextBee SMS Gateway (Android SMS Gateway - https://textbee.dev)
    if (env.TEXTBEE_API_KEY) {

      try {
        const recipientPhone = `+91${cleanPhone}`;
        const textBeeMessage = `Hello from CivicResolve! Your sign-in PIN: ${otpCode} (valid for 5 mins)`;
        const deviceId = env.TEXTBEE_DEVICE_ID || (await this.getTextBeeDeviceId(env.TEXTBEE_API_KEY));

        console.log(`📡 [TextBee] Dispatching SMS OTP to ${recipientPhone} via https://api.textbee.dev/api/v1/gateway/send-sms...`);

        const requestPayload: {
          recipients: string[];
          message: string;
          deviceId?: string;
          simSubscriptionId?: number;
        } = {
          recipients: [recipientPhone],
          message: textBeeMessage,
        };
        if (deviceId) {
          requestPayload.deviceId = deviceId;
        }
        if (env.TEXTBEE_SIM_SUBSCRIPTION_ID) {
          requestPayload.simSubscriptionId = env.TEXTBEE_SIM_SUBSCRIPTION_ID;
        }

        const postWithRetry = async (payload: any) => {
          try {
            return await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': env.TEXTBEE_API_KEY!,
              },
              body: JSON.stringify(payload),
            });
          } catch {
            await new Promise((r) => setTimeout(r, 800));
            return await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': env.TEXTBEE_API_KEY!,
              },
              body: JSON.stringify(payload),
            });
          }
        };

        let response = await postWithRetry(requestPayload);
        let data: any = await response.json().catch(() => null);

        // If specific deviceId was rejected as not found, retry once without deviceId
        if (
          !response.ok &&
          requestPayload.deviceId &&
          (response.status === 404 ||
            (typeof data?.message === 'string' && data.message.toLowerCase().includes('device')))
        ) {
          console.warn(
            `⚠️ [TextBee Retry] Device ID was rejected (${data?.message || 'Not found'}). Retrying with account active default phone...`
          );
          delete requestPayload.deviceId;
          response = await postWithRetry(requestPayload);
          data = await response.json().catch(() => null);
        }

        if (response.ok && data?.data?.success !== false) {
          const batchId = data?.data?.smsBatchId || data?.smsBatchId || 'SUCCESS';
          console.log(`✅ [TextBee Success] SMS dispatched to ${recipientPhone} (Batch ID: ${batchId})`);
          return { sent: true, provider: 'textbee', message: 'SMS dispatched via TextBee' };
        } else {
          const errMsg = data?.message || data?.error || response.statusText || 'Unknown TextBee error';
          console.log(`
========================================================================
⚠️  [TEXTBEE SMS DELIVERY NOTICE]:
   Status: ${response.status} (${errMsg})
   Why SMS didn't arrive on physical phone:
   1. Check if TEXTBEE_API_KEY in backend/.env is valid and active.
   2. Ensure your Android device is online with the TextBee app installed & running.
   3. Check TextBee dashboard (https://textbee.dev) to ensure your device heartbeat is active.
   4. Verify your phone SIM has sufficient balance/SMS pack to send texts.
   👉 Use the OTP code [ ${otpCode} ] shown in the developer terminal above to log in immediately!
========================================================================`);
        }
      } catch (err) {
        console.error('❌ [TextBee Error] Failed to connect to TextBee:', err);
      }
    }

    // 2. Terminal Base Code / Local Development Simulation
    console.log(`📱 [CITIZEN OTP - LOCAL DEV] Mobile: +91 ${cleanPhone} | CODE: ${otpCode} | Status: Ready for verification`);
    return {
      sent: true,
      provider: 'console_dev',
      message: 'OTP generated in development mode (logged to server console)',
    };
  }
}

export const smsService = new SmsService();
