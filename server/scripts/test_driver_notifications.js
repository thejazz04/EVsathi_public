import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';

const BASE_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

async function runTest() {
  console.log('🧪 Starting Driver Notifications E2E Verification...\n');
  const timestamp = Date.now();

  // 1. Register a fresh Driver
  const driverEmail = `test_driver_${timestamp}@evsathi.com`;
  const driverPass = 'Test@1234';
  const driverRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Driver',
      email: driverEmail,
      password: driverPass,
      role: 'driver',
    }),
  });
  const driverData = await driverRes.json();
  if (!driverData.success) {
    throw new Error(`Failed to register driver: ${JSON.stringify(driverData)}`);
  }
  const driverToken = driverData.data.accessToken;
  const driverId = driverData.data.user._id;
  console.log(`✅ 1. Driver registered: ${driverEmail} (ID: ${driverId})`);

  // 2. Register a fresh Host
  const hostEmail = `test_host_${timestamp}@evsathi.com`;
  const hostPass = 'Test@1234';
  const hostRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Host',
      email: hostEmail,
      password: hostPass,
      role: 'HOST',
    }),
  });
  const hostData = await hostRes.json();
  if (!hostData.success) {
    throw new Error(`Failed to register host: ${JSON.stringify(hostData)}`);
  }
  const hostToken = hostData.data.accessToken;
  const hostId = hostData.data.user._id;
  console.log(`✅ 2. Host registered: ${hostEmail} (ID: ${hostId})`);

  // 3. Find an active charger to associate with the chat
  const chargersRes = await fetch(`${BASE_URL}/chargers`);
  const chargersData = await chargersRes.json();
  const charger = chargersData.data?.chargers?.[0];
  if (!charger) {
    throw new Error('No active chargers found to start chat');
  }
  console.log(`✅ 3. Using active charger: ${charger.name} (ID: ${charger._id})`);

  // 4. Driver initiates chat with the charger / host
  const chatRes = await fetch(`${BASE_URL}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({
      chargerId: charger._id,
    }),
  });
  const chatData = await chatRes.json();
  if (!chatData.success) {
    throw new Error(`Failed to start chat: ${JSON.stringify(chatData)}`);
  }
  const chatId = chatData.data.chat._id;
  console.log(`✅ 4. Chat thread created: ID ${chatId}`);

  // 5. Connect Driver to Socket.IO and listen for 'notification:received'
  console.log('📡 5. Connecting Driver to Socket.IO...');
  const driverSocket = io(SOCKET_URL, {
    auth: { token: driverToken },
    transports: ['websocket'],
  });

  const socketNotificationPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for notification:received socket event'));
    }, 10000);

    driverSocket.on('connect', () => {
      console.log('   Driver socket connected successfully');
      driverSocket.emit('register:user', driverId);
    });

    driverSocket.on('notification:received', (notif) => {
      clearTimeout(timeout);
      resolve(notif);
    });
  });

  // Wait a moment for socket registration
  await new Promise((r) => setTimeout(r, 600));

  // 6. Host sends message to Driver in that chat
  const messageText = `Hello Rohan! Your slot at ${charger.name} is ready for charging.`;
  console.log(`💬 6. Host sending message: "${messageText}"`);

  const sendMsgRes = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hostToken}`,
    },
    body: JSON.stringify({
      messageText,
    }),
  });
  const sendMsgData = await sendMsgRes.json();
  if (!sendMsgData.success) {
    throw new Error(`Failed to send message: ${JSON.stringify(sendMsgData)}`);
  }
  console.log('   Host message sent via API successfully');

  // 7. Verify Driver received realtime socket notification
  const receivedNotif = await socketNotificationPromise;
  console.log('\n🔔 7. Driver received real-time socket notification:');
  console.log(`   Type: ${receivedNotif.type}`);
  console.log(`   Title: ${receivedNotif.title}`);
  console.log(`   Message: ${receivedNotif.message}`);
  console.log(`   Chat ID in data: ${receivedNotif.data?.chatId}`);

  if (receivedNotif.type !== 'NEW_MESSAGE') {
    throw new Error(`Expected notification type NEW_MESSAGE, got ${receivedNotif.type}`);
  }
  if (receivedNotif.data?.chatId !== chatId) {
    throw new Error(`Expected data.chatId ${chatId}, got ${receivedNotif.data?.chatId}`);
  }
  console.log('   ✅ Real-time notification payload matches exactly!');

  // 8. Driver queries GET /api/v1/notifications
  const notifsRes = await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const notifsData = await notifsRes.json();
  if (!notifsData.success) {
    throw new Error(`Failed to fetch notifications: ${JSON.stringify(notifsData)}`);
  }

  const notificationsList = notifsData.data?.notifications || [];
  const unreadCount = notifsData.data?.unreadCount;
  console.log(`\n📬 8. Driver notifications API query:`);
  console.log(`   Total notifications: ${notificationsList.length}`);
  console.log(`   Unread count: ${unreadCount}`);

  if (unreadCount < 1) {
    throw new Error(`Expected unreadCount >= 1, got ${unreadCount}`);
  }
  const targetNotif = notificationsList.find((n) => n._id === receivedNotif._id);
  if (!targetNotif) {
    throw new Error('Received notification not found in GET /notifications list');
  }
  if (targetNotif.isRead) {
    throw new Error('Newly created notification should be unread (isRead: false)');
  }
  console.log('   ✅ Unread notification verified in DB list!');

  // 9. Mark notification as read via PATCH /api/v1/notifications/read
  console.log(`\n👁️ 9. Marking notification ${targetNotif._id} as read...`);
  const markReadRes = await fetch(`${BASE_URL}/notifications/read`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`,
    },
    body: JSON.stringify({ notificationId: targetNotif._id }),
  });
  const markReadData = await markReadRes.json();
  if (!markReadData.success) {
    throw new Error(`Failed to mark as read: ${JSON.stringify(markReadData)}`);
  }

  // 10. Re-fetch and verify unread count is 0 and notification isRead is true
  const afterReadRes = await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const afterReadData = await afterReadRes.json();
  const updatedNotifs = afterReadData.data?.notifications || [];
  const updatedUnreadCount = afterReadData.data?.unreadCount;

  const readItem = updatedNotifs.find((n) => n._id === targetNotif._id);
  console.log(`   Updated unreadCount: ${updatedUnreadCount}`);
  console.log(`   Notification isRead status: ${readItem?.isRead}`);

  if (updatedUnreadCount !== 0) {
    throw new Error(`Expected unreadCount to be 0, got ${updatedUnreadCount}`);
  }
  if (!readItem?.isRead) {
    throw new Error(`Expected notification to be read, but isRead is ${readItem?.isRead}`);
  }
  console.log('   ✅ Notification marked read successfully!');

  // Clean up socket
  driverSocket.disconnect();

  console.log('\n🎉 ALL DRIVER NOTIFICATION TESTS PASSED!\n');
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
