import dotenv from 'dotenv';
dotenv.config();

import { env } from '../config/env';
import { smsService } from '../modules/auth/sms.service';

async function main() {
  console.log(`
========================================================================
🐝 TEXTBEE SMS GATEWAY DIAGNOSTIC & TEST TOOL
========================================================================`);

  const apiKey = env.TEXTBEE_API_KEY;
  if (!apiKey) {
    console.warn(`
⚠️  TEXTBEE_API_KEY is not set in backend/.env!
Please paste your TextBee API key in backend/.env:
TEXTBEE_API_KEY=your_api_key_here

Then rerun this test with:
npm run test:sms [phone_number]
`);
    return;
  }

  console.log(`🔑 TEXTBEE_API_KEY detected: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
  if (env.TEXTBEE_DEVICE_ID) {
    console.log(`📱 Configured TEXTBEE_DEVICE_ID: ${env.TEXTBEE_DEVICE_ID}`);
  }
  if (env.TEXTBEE_SIM_SUBSCRIPTION_ID) {
    console.log(`📶 Configured SIM Subscription ID: ${env.TEXTBEE_SIM_SUBSCRIPTION_ID}`);
  }

  // 1. Check devices endpoint to verify API key & device connectivity
  console.log('\n🔍 Checking paired Android devices on your TextBee account...');
  try {
    const res = await fetch('https://api.textbee.dev/api/v1/gateway/devices', {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data: any = await res.json();
      const devices = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      console.log(`✅ TextBee API authentication successful! Found ${devices.length} device(s):`);

      if (devices.length === 0) {
        console.warn(`
⚠️  No Android devices found in your TextBee account.
Please ensure:
1. You have installed the TextBee Android app on your phone.
2. You logged into the app with your TextBee account.
3. Your phone is connected to the internet and TextBee is running in the background.
`);
      } else {
        devices.forEach((dev: any, i: number) => {
          const battery = dev.batteryInfo?.percentage ? `${dev.batteryInfo.percentage}%` : 'N/A';
          const isDefault = dev.isDefault ? ' (Default)' : '';
          const enabled = dev.enabled ? '🟢 Online/Enabled' : '🔴 Disabled';
          const stickyNotif = dev.appStateInfo?.stickyNotificationEnabled ? '🟢 ON' : '🔴 OFF (Warning)';
          const ignoreBatt = dev.powerInfo?.isIgnoringBatteryOptimizations ? '🟢 Allowed' : '🔴 Restricted (Warning)';

          console.log(`\n   Device #${i + 1}: ${dev.brand || ''} ${dev.model || 'Android'} [${dev._id}]${isDefault}`);
          console.log(`   ├─ Status: ${enabled} | Battery: ${battery} | OS: Android ${dev.osVersion || 'N/A'}`);
          console.log(`   ├─ Sticky Notification : ${stickyNotif}`);
          console.log(`   ├─ Battery Optimization: ${ignoreBatt}`);

          const sims = dev.simInfo?.sims || [];
          if (sims.length > 0) {
            console.log(`   └─ SIM Cards Available:`);
            sims.forEach((s: any) => {
              console.log(`      • ${s.displayName} (${s.carrierName}): subscriptionId = ${s.subscriptionId}`);
            });
          }

          if (!dev.powerInfo?.isIgnoringBatteryOptimizations || !dev.appStateInfo?.stickyNotificationEnabled) {
            console.log(`
   ⚠️  IMPORTANT PHONE CONFIGURATION NEEDED ON YOUR ${dev.brand?.toUpperCase() || 'ANDROID'} PHONE:
   Your phone is putting TextBee to sleep in the background!
   To make SMS deliver instantly without getting stuck in 'dispatched':
   1. Open TextBee App on phone -> Enable 'Sticky Notification' (keep running in foreground).
   2. Open Phone Settings -> Apps -> TextBee -> Battery -> Select 'Unrestricted' or 'Allow background activity'.
   3. Lock TextBee in Recent Apps tray so the OS doesn't close it.`);
          }
        });
      }
    } else {
      const errorJson = await res.json().catch(() => null);
      console.error(`❌ TextBee API error (HTTP ${res.status}):`, errorJson || res.statusText);
      console.error('Please check that your TEXTBEE_API_KEY in backend/.env is correct.');
      return;
    }
  } catch (err) {
    console.error('❌ Failed to reach https://api.textbee.dev:', err);
    return;
  }

  // 2. Dispatch a Test OTP SMS
  const targetPhone = process.argv[2] || '8380934906';
  const cleanPhone = targetPhone.replace(/\D/g, '').slice(-10);
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

  console.log(`\n📨 Sending test OTP [${testOtp}] to ${cleanPhone}...`);
  const result = await smsService.sendOtpSms(cleanPhone, testOtp);

  console.log(`\n🏁 Dispatch Result:`);
  console.log(`   Sent: ${result.sent}`);
  console.log(`   Provider: ${result.provider}`);
  console.log(`   Message: ${result.message}`);

  // 3. Monitor Delivery State
  if (result.provider === 'textbee') {
    console.log(`\n⏳ Checking message delivery status on TextBee gateway...`);
    for (let step = 1; step <= 3; step++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const msgRes = await fetch('https://api.textbee.dev/api/v1/gateway/messages?limit=1', {
          headers: { 'x-api-key': apiKey },
        });
        if (msgRes.ok) {
          const msgJson: any = await msgRes.json();
          const latest = msgJson?.data?.[0];
          if (latest) {
            console.log(`   [Poll ${step}] Current Status: ${latest.status.toUpperCase()}`);
            if (latest.status === 'delivered') {
              console.log(`\n🎉 SUCCESS! Message confirmed DELIVERED to recipient ${cleanPhone} by cellular carrier!`);
              return;
            }
            if (latest.status === 'sent') {
              console.log(`   📱 Phone transmitted message to cellular carrier! Waiting for carrier delivery confirmation...`);
            }
          }
        }
      } catch {
        // ignore polling error
      }
    }

    console.log(`
ℹ️  If the status is still 'DISPATCHED':
The TextBee cloud server sent the message to your phone via Google FCM push.
Open the TextBee app on your phone right now to let it process and send the SMS!`);
  }
}

main().catch(console.error);
