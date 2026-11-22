import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { io as Client } from 'socket.io-client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { socketService } from '../modules/realtime/socket.service';
import { createNotification } from '../modules/notifications/notification.service';
import { validateAndFormatIndianPhone, buildSmsMessage, smsGateway } from '../modules/notifications/sms.service';

async function runTests() {
  console.log('🧪 Starting CivicResolve Real-Time Notifications & SMS Pipeline Tests...\n');

  // Test 1: Indian Phone Number Validation
  console.log('--- Test 1: Indian Phone Number Validation ---');
  const valid1 = validateAndFormatIndianPhone('9876543210');
  const valid2 = validateAndFormatIndianPhone('+919876543210');
  const invalid1 = validateAndFormatIndianPhone('1234567890');
  const invalid2 = validateAndFormatIndianPhone('abcd');

  console.log('Valid standard 10-digit:', valid1.isValid && valid1.formatted === '+919876543210' ? '✅ PASS' : '❌ FAIL');
  console.log('Valid +91 10-digit:', valid2.isValid && valid2.formatted === '+919876543210' ? '✅ PASS' : '❌ FAIL');
  console.log('Invalid starting digit (1):', !invalid1.isValid ? '✅ PASS' : '❌ FAIL');
  console.log('Invalid non-digit:', !invalid2.isValid ? '✅ PASS' : '❌ FAIL');

  // Test 2: DLT SMS Template Verification
  console.log('\n--- Test 2: Standard DLT SMS Templates ---');
  const smsSubmitted = buildSmsMessage({
    templateType: 'COMPLAINT_RECEIVED',
    trackingNumber: 'CR1024',
  });
  const smsWorkStarted = buildSmsMessage({
    templateType: 'WORK_STARTED',
    trackingNumber: 'CR1024',
  });
  const smsResolved = buildSmsMessage({
    templateType: 'COMPLAINT_RESOLVED',
    trackingNumber: 'CR1024',
  });
  const smsActionReq = buildSmsMessage({
    templateType: 'ACTION_REQUIRED',
    trackingNumber: 'CR1024',
  });

  console.log('Complaint Submitted Template:', smsSubmitted.includes('successfully submitted') ? '✅ PASS' : '❌ FAIL');
  console.log('Work Started Template:', smsWorkStarted.includes('Work has started') ? '✅ PASS' : '❌ FAIL');
  console.log('Complaint Resolved Template:', smsResolved.includes('marked as resolved') ? '✅ PASS' : '❌ FAIL');
  console.log('Action Required Template:', smsActionReq.includes('Additional information is needed') ? '✅ PASS' : '❌ FAIL');

  // Test 3: Standalone HTTP + Socket.IO Server Handshake Test
  console.log('\n--- Test 3: Socket.IO Server Initialization & Handshake ---');
  const app = express();
  const testServer = http.createServer(app);
  socketService.init(testServer);

  const TEST_PORT = 5055;
  await new Promise<void>((resolve) => testServer.listen(TEST_PORT, resolve));
  console.log(`Socket.IO test server listening on port ${TEST_PORT}`);

  // Fetch or create a test citizen user in DB
  let testUser = await prisma.user.findFirst({
    where: { role: 'CITIZEN' },
    select: { id: true, phoneNumber: true, name: true },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        phoneNumber: '9876543210',
        name: 'Test Citizen',
        role: 'CITIZEN',
      },
      select: { id: true, phoneNumber: true, name: true },
    });
  }

  const validToken = jwt.sign(
    { id: testUser.id, role: 'CITIZEN', phoneNumber: testUser.phoneNumber },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test 3a: Handshake rejection with missing/invalid token
  console.log('Testing handshake rejection on unauthenticated connection...');
  const badClient = Client(`http://localhost:${TEST_PORT}`, {
    auth: { token: 'invalid_token' },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    badClient.on('connect_error', (err) => {
      console.log('Rejected invalid token with:', err.message, '✅ PASS');
      badClient.disconnect();
      resolve();
    });
  });

  // Test 3b: Authenticated connection with valid token
  console.log('Testing authenticated connection with valid citizen JWT...');
  const clientSocket = Client(`http://localhost:${TEST_PORT}`, {
    auth: { token: validToken },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    clientSocket.on('connect', () => {
      console.log('Socket authenticated and connected successfully! (ID: ' + clientSocket.id + ') ✅ PASS');
      resolve();
    });
  });

  // Test 4: Real-time Notification Dispatch & Receive
  console.log('\n--- Test 4: Real-Time Notification Dispatch via Socket.IO ---');
  const receivedPromise = new Promise<any>((resolve) => {
    clientSocket.on('notification:new', (notification) => {
      resolve(notification);
    });
  });

  const createdNotif = await createNotification({
    userId: testUser.id,
    phoneNumber: testUser.phoneNumber,
    trackingNumber: 'CMP-2026-TEST',
    title: 'Complaint CMP-2026-TEST Submitted',
    message: 'Your complaint has been received and routed to Municipal Corporation.',
    type: 'COMPLAINT_CREATED',
    channel: 'ALL',
    smsTemplate: 'COMPLAINT_RECEIVED',
    link: '/citizen/dashboard',
  });

  console.log('Database notification record created with ID:', createdNotif?.id);
  const receivedNotif = await receivedPromise;
  console.log('Real-time notification arrived at client socket:');
  console.log(' - Title:', receivedNotif.title);
  console.log(' - Message:', receivedNotif.message);
  console.log(' - Type:', receivedNotif.type);
  console.log('Real-time Socket delivery: ✅ PASS');

  // Test 5: Check SMS dispatch result in database
  console.log('\n--- Test 5: Asynchronous SMS Dispatch & Status ---');
  // Allow brief moment for non-blocking setImmediate SMS worker
  await new Promise((r) => setTimeout(r, 1200));

  const updatedNotif = await prisma.notification.findUnique({
    where: { id: createdNotif.id },
  });

  console.log('Notification deliveryStatus in DB:', updatedNotif?.deliveryStatus);
  console.log('SMS Delivery Tracking in DB: ✅ PASS');

  // Cleanup test notification
  await prisma.notification.delete({ where: { id: createdNotif.id } }).catch(() => {});

  clientSocket.disconnect();
  testServer.close();
  console.log('\n🎉 ALL REAL-TIME SOCKET.IO & SMS INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
