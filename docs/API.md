# EVsathi API Endpoints Documentation

All API responses follow the standard JSON response format:

**Success Response**:
```json
{
  "success": true,
  "data": {}
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error description"
  }
}
```

---

## 🔑 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register driver or host user account.
- `POST /api/auth/login` — Login user with email & password.
- `POST /api/auth/logout` — Logout user.
- `POST /api/auth/refresh` — Refresh access token using refresh token.
- `POST /api/auth/forgot-password` — Secure forgot-password request (SHA-256 token generated, generic enumeration-safe response).
- `POST /api/auth/reset-password` — Complete password reset with validated server-side single-use token `{ token, newPassword }`.
- `GET /api/auth/me` — Get current logged-in user profile.
- `PUT /api/auth/profile` — Update user profile information.
- `PUT /api/auth/password` — Change password.

---

## ⚡ Charger Discovery & Management (`/api/chargers`)
- `GET /api/chargers` — Filter & search chargers (params: `search`, `connectorType`, `chargerType`, `minPower`, `maxPrice`, `latitude`, `longitude`, `radius`).
- `GET /api/chargers/search` — Nearby 2DSphere location search.
- `GET /api/chargers/my-chargers` — Get host's listed chargers.
- `GET /api/chargers/:id` — Get single charger details with Rule-Based Smart Score.
- `POST /api/chargers` — Create new host charger listing (Host role required).
- `PUT /api/chargers/:id` — Update charger listing.
- `DELETE /api/chargers/:id` — Deactivate charger listing.
- `GET /api/chargers/:id/availability` — Check time slot availability.
- `POST /api/chargers/:id/disable` — Toggle charger active availability status.

---

## 📅 Booking & Reservations (`/api/bookings`)
- `POST /api/bookings` — Reserve charger slot with concurrency double-booking guard & price snapshot.
- `GET /api/bookings` — Get user booking list (supports `type=bookings` or `type=rentals`).
- `GET /api/bookings/upcoming` — Get driver upcoming reserved slots.
- `GET /api/bookings/past` — Get past completed/expired bookings.
- `GET /api/bookings/my-rentals` — Get host station rental bookings.
- `GET /api/bookings/:id` — Get booking details.
- `PUT /api/bookings/:id/cancel` — Cancel booking.
- `PUT /api/bookings/:id/checkin` — Check-in & start session.
- `PUT /api/bookings/:id/checkout` — Check-out & complete session.

---

## 💳 Payments & Razorpay (`/api/payments`)
- `POST /api/payments/create-order` — Create Razorpay order (or mock order in dev).
- `POST /api/payments/verify` — Verify HMAC SHA256 payment signature.
- `POST /api/payments/webhook` — Razorpay webhook event processor (Idempotent & Raw body verified).
- `POST /api/payments/dummy-charge` — Development test charge.

---

## 🚗 Navigation (`/api/navigation`)
- `POST /api/navigation/route` — Compute OSRM driving route between start & end.
- `POST /api/navigation/reroute` — Recalculate route upon GPS diversion.
- `GET /api/navigation/nearby-chargers` — Find chargers along route.

---

## 💬 Real-Time Chat & Socket.IO (`/api/chats`)
- `POST /api/chats` — Start or retrieve host-driver chat thread.
- `GET /api/chats` — List user active chat threads.
- `GET /api/chats/:id/messages` — Get separated message documents.
- `POST /api/chats/:id/messages` — Send message (emits `message:received` via Socket.IO).
- `PATCH /api/chats/:id/read` — Mark thread messages as read.

---

## 📊 Analytics & Metrics (`/api/analytics`)
- `GET /api/analytics/host` — Database-derived host earnings, active chargers, occupancy rate & revenue.
- `GET /api/analytics/driver` — Driver sessions, total kWh charged, spending, & off-peak savings.

---

## 🤖 ML Dataset & Fallback Interfaces (`/api/ml`)
- `GET /api/ml/status` — Microservice connection status.
- `GET /api/ml/demand` — Demand prediction interface (XGBoost fallback).
- `POST /api/ml/dynamic-pricing` — Dynamic pricing interface (PPO RL fallback).

---

## 🩺 System Health (`/api/health`)
- `GET /api/health` — Public diagnostic endpoint.
