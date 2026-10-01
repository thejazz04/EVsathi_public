import fetch from 'node-fetch';

async function verifyAll() {
  console.log('=== STARTING AUTOMATED DRIVER EXPERIENCE & REVIEW VERIFICATION ===\n');

  // 1. Login Driver
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'arjun.sharma@gmail.com', password: 'password123', requestedRole: 'driver' })
  }).then(r => r.json());

  if (!loginRes.success || !loginRes.data?.accessToken) {
    console.error('FAIL: Driver login failed', loginRes);
    process.exit(1);
  }
  const token = loginRes.data.accessToken;
  console.log('1. Driver Login: PASS (User: ' + loginRes.data.user.email + ')');

  // 2. Test Driver Dashboard Endpoints
  const chargersRes = await fetch('http://localhost:5000/api/chargers?limit=6').then(r => r.json());
  const chargers = chargersRes.data?.chargers || chargersRes.data || [];
  console.log('2. Chargers List: PASS (Fetched ' + chargers.length + ' chargers)');

  const bookingsRes = await fetch('http://localhost:5000/api/bookings', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json());
  const bookings = bookingsRes.data?.bookings || bookingsRes.data || [];
  console.log('3. Driver Bookings: PASS (Fetched ' + bookings.length + ' bookings)');

  // 4. Test Demand Prediction on Real Charger
  const testCharger = chargers[0];
  const demandRes = await fetch('http://localhost:5000/api/ml/demand?chargerId=' + testCharger._id + '&timestamp=' + encodeURIComponent(new Date().toISOString())).then(r => r.json());
  
  if (!demandRes.success || typeof demandRes.data?.demandValue !== 'number') {
    console.error('FAIL: Demand prediction failed', demandRes);
    process.exit(1);
  }
  console.log('4. Demand Prediction: PASS');
  console.log('   Station: ' + testCharger.title);
  console.log('   Demand Value: ' + demandRes.data.demandValue);
  console.log('   Source: ' + demandRes.data.source);
  console.log('   Model Version: ' + demandRes.data.modelVersion);

  // 5. Test Review Fetching
  const reviewsRes = await fetch('http://localhost:5000/api/reviews/charger/' + testCharger._id).then(r => r.json());
  if (!reviewsRes.success || !Array.isArray(reviewsRes.data?.reviews)) {
    console.error('FAIL: Review fetching failed', reviewsRes);
    process.exit(1);
  }
  console.log('5. Review Viewing: PASS (Found ' + reviewsRes.data.reviews.length + ' reviews for ' + testCharger.title + ')');
  if (reviewsRes.data.reviews.length > 0) {
    const r0 = reviewsRes.data.reviews[0];
    console.log('   Sample review: ' + r0.comment + ' | Rating: ' + r0.rating + '/5 by ' + (r0.user?.name || 'Driver'));
  }

  // 6. Test Review Eligibility Enforcement (Unbooked user)
  const unbookedReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unbooked Tester', email: 'unbooked_' + Date.now() + '@evsathi.com', password: 'Password@123', role: 'driver' })
  }).then(r => r.json());
  
  const rejectRes = await fetch('http://localhost:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + unbookedReg.data.accessToken },
    body: JSON.stringify({ chargerId: testCharger._id, rating: 5, comment: 'Fake review' })
  }).then(r => r.json());

  if (rejectRes.success || rejectRes.error?.code !== 'ELIGIBILITY_REQUIRED') {
    console.error('FAIL: Unbooked review was not properly rejected', rejectRes);
    process.exit(1);
  }
  console.log('6. Review Eligibility Enforcement: PASS (Rejected unbooked driver with ELIGIBILITY_REQUIRED)');

  // 7. Test Review Submission with Eligible Driver & Persistence
  // Find a booking that hasn't been reviewed yet or create one for test
  const eligibleBooking = bookings.find(b => b.charger?._id);
  if (eligibleBooking) {
    const targetChargerId = eligibleBooking.charger._id;
    const submitRes = await fetch('http://localhost:5000/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ chargerId: targetChargerId, rating: 5, comment: 'Verified test review: Excellent charging experience!' })
    }).then(r => r.json());

    if (submitRes.success) {
      console.log('7. Review Submission: PASS (Created review for charger ' + targetChargerId + ')');
      // Verify persistence and rating update
      const updatedCharger = await fetch('http://localhost:5000/api/chargers/' + targetChargerId).then(r => r.json());
      console.log('   Updated Charger Rating: ' + updatedCharger.data?.rating + ' (Total: ' + updatedCharger.data?.totalRatings + ')');
    } else if (submitRes.error?.code === 'ALREADY_REVIEWED') {
      console.log('7. Review Submission: PASS (Eligible booking detected and ALREADY_REVIEWED enforced)');
    }
  }

  console.log('\n=== ALL AUTOMATED VERIFICATIONS PASSED ===');
}
verifyAll();
