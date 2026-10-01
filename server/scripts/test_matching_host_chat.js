const BASE_URL = 'http://localhost:5000/api/v1';

async function run() {
  const timestamp = Date.now();
  const hostName = 'Kavita Sharma';
  const driverName = 'Aarav Patel';
  const hostEmail = `kavita_${timestamp}@evsathi.com`;
  const driverEmail = `aarav_${timestamp}@evsathi.com`;
  const password = 'Password@123';

  // 1. Register Host
  const regHost = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: hostName, email: hostEmail, password, role: 'HOST' }),
  });
  const hostData = await regHost.json();
  const hostToken = hostData.data.accessToken;
  const hostId = hostData.data.user._id;
  console.log(`Host registered: ${hostName} (${hostEmail})`);

  // 2. Register Driver
  const regDriver = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: driverName, email: driverEmail, password, role: 'driver' }),
  });
  const driverData = await regDriver.json();
  const driverToken = driverData.data.accessToken;
  const driverId = driverData.data.user._id;
  console.log(`Driver registered: ${driverName} (${driverEmail})`);

  // 3. Host lists their charger
  const createChg = await fetch(`${BASE_URL}/chargers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({
      title: "Kavita's Solar EV Hub",
      description: 'Clean solar powered 11kW Type 2 charger in Gokulam',
      location: {
        address: '14th Cross, Gokulam 3rd Stage',
        city: 'Mysuru',
        state: 'Karnataka',
        zipCode: '570002',
        coordinates: { lat: 12.3275, lng: 76.6268 },
      },
      chargerType: 'TYPE2',
      powerOutput: 11,
      connectorType: 'Type 2',
      pricePerHour: 80,
      pricePerKwh: 12,
    }),
  });
  const chgData = await createChg.json();
  const charger = chgData.data?.charger;
  console.log(`Charger created by ${hostName}: ${charger.title} (${charger._id})`);

  // 4. Driver starts chat with this charger (owner is Kavita Sharma)
  const createChat = await fetch(`${BASE_URL}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ chargerId: charger._id }),
  });
  const chatData = await createChat.json();
  const chat = chatData.data?.chat;
  const chatId = chat._id;
  console.log(`Chat started: ID ${chatId}`);

  // 5. Host sends message to driver
  const msgText = 'Namaste Aarav! Your charging slot is confirmed and the connector is ready.';
  const sendMsg = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ messageText: msgText }),
  });
  const sendData = await sendMsg.json();
  console.log(`Message sent by ${hostName}: "${msgText}"`);

  // 6. Check notification created for driver
  const notifRes = await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${driverToken}` },
  });
  const notifData = await notifRes.json();
  const notif = notifData.data?.notifications?.[0];

  console.log('\n--- VERIFICATION RESULT ---');
  console.log(`Host User Name: "${hostName}"`);
  console.log(`Notification Title: "${notif?.title}"`);
  console.log(`Notification Message: "${notif?.message}"`);
  console.log(`Chat ID: "${chatId}"`);
  console.log(`Driver Login Email: "${driverEmail}"`);
  console.log(`Password: "${password}"`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
