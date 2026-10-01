const BASE_URL = 'http://localhost:5000/api/v1';

async function setup() {
  const driverEmail = 'driver_notif_ui@evsathi.com';
  const hostEmail = 'host_notif_ui@evsathi.com';
  const pass = 'Password@123';

  // 1. Try register or login driver
  let driverToken, driverId;
  const regDriver = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rahul Driver', email: driverEmail, password: pass, role: 'driver' }),
  });
  const regDriverData = await regDriver.json();
  if (regDriverData.success) {
    driverToken = regDriverData.data.accessToken;
    driverId = regDriverData.data.user._id;
  } else {
    const loginDriver = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: driverEmail, password: pass, role: 'driver' }),
    });
    const loginDriverData = await loginDriver.json();
    driverToken = loginDriverData.data.accessToken;
    driverId = loginDriverData.data.user._id;
  }

  // 2. Try register or login host
  let hostToken, hostId;
  const regHost = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vikram Host', email: hostEmail, password: pass, role: 'HOST' }),
  });
  const regHostData = await regHost.json();
  if (regHostData.success) {
    hostToken = regHostData.data.accessToken;
    hostId = regHostData.data.user._id;
  } else {
    const loginHost = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: hostEmail, password: pass, role: 'host' }),
    });
    const loginHostData = await loginHost.json();
    hostToken = loginHostData.data.accessToken;
    hostId = loginHostData.data.user._id;
  }

  // 3. Get charger
  const chgRes = await fetch(`${BASE_URL}/chargers`);
  const chgData = await chgRes.json();
  const charger = chgData.data?.chargers?.[0];

  // 4. Create chat thread
  const chatRes = await fetch(`${BASE_URL}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ chargerId: charger._id }),
  });
  const chatData = await chatRes.json();
  const chatId = chatData.data.chat._id;

  // 5. Host sends message
  const msgText = `Hello Rahul! Fast charger at ${charger.name || 'Station'} is reserved for you.`;
  const sendRes = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
    body: JSON.stringify({ messageText: msgText }),
  });
  const sendData = await sendRes.json();

  console.log(JSON.stringify({
    success: true,
    driverEmail,
    hostEmail,
    password: pass,
    chatId,
    messageText: msgText,
  }));
}

setup().catch((e) => {
  console.error(e);
  process.exit(1);
});
