# TravelSphere

A full-stack travel booking platform — flights, hotels, buses, and holiday packages — with cart/checkout, sandbox payments, wallet, coupons, visa applications, and an admin dashboard.

Built as a technical assessment for LemonTrip.

- **Live app:** [ADD YOUR VERCEL URL]
- **Live API:** [ADD YOUR RENDER URL]/api/health
- **GitHub repo:** [ADD YOUR REPO URL]

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Bootstrap |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Payments | Razorpay (sandbox/test mode) |
| Email | SendGrid |
| File storage | AWS S3 (visa documents) |
| Auth | JWT + bcrypt |
| Containerization | Docker |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## 2. Features

- **Auth & authorization** — registration, login, JWT sessions, role-based access (`user` / `admin`) enforced on both frontend routes (`PrivateRoute`) and backend middleware.
- **Search & booking** — flights, hotels, buses, and holiday packages, each with its own search, booking, and payment flow.
- **Cart** — add/update/remove items before checkout.
- **Payments** — Razorpay checkout in sandbox mode, with server-side order creation and webhook-based payment confirmation (idempotent — see [Section 7](#7-known-limitations--next-steps)).
- **Wallet** — pay from wallet balance as an alternative to Razorpay; wallet top-ups and refund credits.
- **Coupons** — coupon codes with validity windows, minimum order thresholds, and usage limits.
- **Cancellation & refunds** — refund processing for both Razorpay and wallet payments, with a retry mechanism for failed refunds.
- **Visa applications** — document upload (S3) and application status tracking.
- **Notifications** — transactional welcome email via SendGrid (fire-and-forget, does not block registration).
- **Admin dashboard** — platform stats, bookings (filterable/paginated), users, payments, refunds, coupons, and visa application management.

---

## 3. Project Structure

```
travelsphere/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api/                # axios client + per-domain API modules
│   │   ├── Components/         # Navbar, PrivateRoute, AuthTicketPanel, VisaSection, ...
│   │   ├── context/             # AuthContext
│   │   ├── pages/               # Login, Register, FlightSearch, HotelSearch, BusSearch,
│   │   │                        # PackageSearch, CartPage, Profile, AdminDashboard, Home
│   │   └── styles/
│   └── vite.config.js
│
└── server/                    # Express backend
    ├── src/
    │   ├── config/              # db.js, razorpay.js, s3.js
    │   ├── controllers/         # auth, booking, payment, cart, admin, visa,
    │   │                        # flight/hotel/bus/package (+ their payment controllers)
    │   ├── models/              # one model per domain entity
    │   ├── middleware/          # authMiddleware, validators
    │   ├── routes/
    │   ├── jobs/                 # scheduled/background tasks (e.g. refund retry)
    │   ├── services/             # emailService
    │   └── app.js
    ├── Dockerfile
    └── server.js
```

---

## 4. Environment Variables

### `server/.env`

```env
# Server
PORT=5000

# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# Auth
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d

# Razorpay (sandbox/test keys)
RAZORPAY_KEY_ID=<rzp_test_...>
RAZORPAY_KEY_SECRET=<...>
RAZORPAY_WEBHOOK_SECRET=<...>

# SendGrid
SENDGRID_API_KEY=<...>
EMAIL_FROM=<verified-sender@yourdomain.com>

# AWS S3 (visa documents)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<...>
AWS_SECRET_ACCESS_KEY=<...>
AWS_S3_BUCKET=travelsphere-visa-documents
```

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

> None of the values above are real credentials — replace every placeholder before running the app. Never commit a populated `.env` file; both `client/.gitignore` and `server/.gitignore` already exclude it.

---

## 5. Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (running locally or a hosted instance)
- A Razorpay test account, a SendGrid account, and an AWS S3 bucket (only required for payments / email / visa uploads respectively — the rest of the app runs without them)

### Backend

```bash
cd server
npm install
cp .env.example .env      # then fill in the values from Section 4
npm run dev                # starts on http://localhost:5000
```

The server logs `DB connected at: <timestamp>` on startup if the database connection succeeds. Health check: `GET /api/health`.

### Frontend

```bash
cd client
npm install
cp .env.example .env      # then fill in VITE_API_BASE_URL
npm run dev                 # starts on http://localhost:5173
```

### Database

Run your schema/migration scripts against `DATABASE_URL` before starting the server (see `[ADD PATH TO YOUR SCHEMA/MIGRATIONS]`). An ER diagram is included at `[ADD PATH, e.g. /docs/er-diagram.png]`.

---

## 6. Running with Docker

The backend ships with a `Dockerfile`:

```bash
cd server
docker build -t travelsphere-server .
docker run -p 5000:5000 --env-file docker.env travelsphere-server
```

`docker.env` should contain the same variables listed in [Section 4](#4-environment-variables). On successful startup you'll see:

```
Server running on port 5000
DB connected at: <timestamp>
```

---

## 7. Known Limitations / Next Steps

In the interest of an honest submission, the following items from the assessment brief are **not yet implemented**:

- **Redis** — no search-result caching or rate limiting is currently in place.
- **Automated test suite** — no unit/integration/load tests are included yet.
- **CI/CD pipeline** — deployments are currently manual (push → Vercel/Render auto-deploy from `main`), no GitHub Actions pipeline yet.
- **API documentation (Swagger) and Postman collection** — not yet published.
- **Formal monitoring** — only a basic `/api/health` endpoint exists; no uptime/alerting integration.
- **Database backup/restore strategy** — not yet documented; relying on the hosting provider's default backups.

What **is** handled:
- Razorpay webhook idempotency — payment confirmation checks `alreadyProcessed` before crediting flights, hotels, buses, packages, or wallet top-ups, so a webhook fired multiple times does not double-process a payment.
- Failed refunds are retried via an admin-triggered retry endpoint (`POST /admin/refunds/retry`) that re-attempts every refund left in a `failed` state.

See the accompanying Security Considerations and Performance Considerations documents for further detail on what's in place and what's planned.

---

## 8. API Overview

Base URL: `/api/v1`

| Resource | Base path |
|---|---|
| Auth | `/auth` |
| Flights | `/flights` |
| Hotels | `/hotels` |
| Buses | `/buses` |
| Packages | `/packages` |
| Cart | `/cart` |
| Bookings | `/bookings` |
| Payments | `/payments` (webhook at `/payments/webhook`) |
| Wallet | `/wallet` |
| Visa | `/visa` |
| Admin | `/admin` |

Full endpoint-level documentation: `[ADD LINK TO SWAGGER / POSTMAN COLLECTION ONCE PUBLISHED]`.

---

## 9. License

[ADD LICENSE OR "Private — submitted as a technical assessment for LemonTrip"]
