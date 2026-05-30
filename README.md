# Dawri Medical / دوري الطبي

SaaS web application for Iraqi private clinic appointment and queue management.

## What This SaaS Includes

- Arabic-first RTL responsive web UI
- Patient doctor search, doctor profile, booking flow, confirmation, and live queue tracking
- Clinic secretary dashboard for today's bookings, patient status changes, and queue controls
- Clinic admin schedule and doctor management screens
- Super admin dashboard for platform stats, clinics, specialties, governorates, areas, and bookings
- Node.js API server with relational Supabase PostgreSQL persistence and an explicit JSON fallback for local development only
- Supabase Auth-ready protected API access for `super_admin`, `clinic_admin`, `secretary`, and `patient`
- Business rules for duplicate bookings, max daily capacity, automatic queue numbers, approximate times, cancellation, and live queue updates

## Run Locally

If Node is available on your PATH:

```bash
node server/server.js
```

In the Codex desktop workspace, the bundled runtime can be used:

```powershell
& 'C:\Users\muhammed\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server\server.js
```

Open:

```text
http://localhost:4173
```

## Reset Demo Data

```powershell
& 'C:\Users\muhammed\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server\reset-db.js
```

## Architecture

- `server/server.js`: HTTP server, API routes, booking rules, queue rules, and static SPA serving
- `server/seed.js`: Iraqi demo data and scalable mock data model
- `server/database.js`: persistence boundary using relational PostgreSQL tables when `DATABASE_URL` is configured
- `server/db/schema.sql`: Supabase/PostgreSQL relational schema for clinics, doctors, users, bookings, queue sessions, subscriptions, and supporting tables
- `public/js/app.js`: client-side router and page logic
- `public/js/api.js`: fetch client for the backend API
- `public/js/components.js`: reusable UI render helpers
- `public/styles.css`: mobile-first Arabic RTL styling

## Demo Roles

Use `/login` to switch between:

- Login as Patient
- Login as Secretary
- Login as Clinic Admin
- Login as Super Admin

## Product Note

The app intentionally avoids promising exact appointment times. It combines approximate time, queue number, live queue status, and reminders:

> احجز دورك، تابع رقمك، وروح للعيادة بس يقرب موعدك.

## Latest SaaS Upgrade

- Professional Arabic RTL healthcare SaaS UI polish across homepage, booking, tracking, dashboard, and admin.
- Upgraded booking confirmation with full booking details, remaining patients, queue progress, and WhatsApp share link.
- Live tracking now shows current queue, patient queue number, remaining patients, estimated wait, clinic status, and queue progress.
- Clinic queue sessions support: `open`, `delayed`, `paused`, `closed`, and `doctor_absent`, with delay reason and estimated delay duration.
- Secretary dashboard includes practical queue controls, delay controls, clinic close/paused/doctor absent states, and patient status actions.
- Super admin dashboard has visual statistics and management placeholders for clinic approval, doctors, specialties, governorates, and areas.

## Supabase PostgreSQL / Auth

Production must use Supabase PostgreSQL through `DATABASE_URL`. Vercel/serverless production will fail fast without `DATABASE_URL` so real clinic data is not accidentally saved to temporary JSON storage.

The database schema is now relational. Core SaaS tables include:

- `clinics`
- `doctors`
- `users`
- `bookings`
- `queue_sessions`
- `subscriptions`

Supporting tables include schedules, notifications, specialties, governorates, and app metadata.

Supabase setup:

1. Create a Supabase project.
2. Copy the PostgreSQL connection string from Project Settings > Database.
3. Add it to Vercel as an environment variable named `DATABASE_URL`.
4. Copy Project URL and anon key from Project Settings > API.
5. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Vercel.
6. Add `SUPABASE_SERVICE_ROLE_KEY` so clinic registration can create the clinic admin account through Supabase Auth.
7. Add `NEXT_PUBLIC_APP_URL` or `APP_URL` with the production Vercel domain so WhatsApp tracking links never point to localhost.
8. Redeploy the Vercel project.
9. On first request, the app creates/updates the relational schema and seeds Iraqi demo data if the database is empty.

The full Supabase SQL schema is kept in `server/db/schema.sql`. You can run it manually in Supabase SQL Editor, but the server also applies the schema automatically when `DATABASE_URL` is configured.

For local development with PostgreSQL, create a `.env` from `.env.example` or set `DATABASE_URL` in your shell before running:

```powershell
$env:DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
node server/server.js
```

For offline local demos only, set:

```powershell
$env:DAWRI_ALLOW_JSON_FALLBACK="true"
```

To reset and reseed the connected database:

```powershell
node server/reset-db.js
```

## Staff Access Codes

Patient booking and tracking stay public. Clinic and owner APIs support Supabase Auth bearer tokens. Access codes remain as a transition/demo fallback.

Set these in Vercel Environment Variables:

- `STAFF_ACCESS_CODE`: optional global staff fallback. Keep disabled unless `ALLOW_GLOBAL_STAFF_ACCESS=true`.
- `SUPER_ADMIN_ACCESS_CODE`: code for platform owner dashboard.
- `ALLOW_GLOBAL_STAFF_ACCESS`: keep `false` in production so clinics cannot see other clinic data.

Fallback demo codes are available if env vars are not set:

- Clinic staff demo fallback: use the clinic-specific access code from `/admin/clinics`
- Platform owner: `owner-2026`

Change both before using the demo with real clinics.

## Multi-Clinic SaaS Flow

The app supports the first multi-tenant SaaS workflow:

- Clinics submit registration requests from `/clinic-register` with clinic information plus the clinic admin email and password.
- New clinics are saved as `pending` with a generated `slug`, trial plan, private clinic access code, and a pending `clinic_admin` user linked to the clinic.
- When `SUPABASE_SERVICE_ROLE_KEY` is configured, the registration flow also creates the admin in Supabase Auth automatically.
- Super admin reviews requests in `/admin/clinics`, approves active clinics, or disables them.
- Each active clinic gets a public patient page at `/clinics/{slug}`.
- Clinic access codes scope dashboard data to one clinic: doctors, schedules, bookings, queue sessions, and notifications.
- Clinic staff can add doctors only to their own clinic; the server ignores any forged `clinic_id`.
- Clinic registration confirmation includes a WhatsApp handoff to the platform owner number `07767088664`.
- The clinic access code is not delivered automatically to applicants. The platform owner approves the clinic, then sends the code manually from `/admin/clinics` through the prepared WhatsApp message.
- Each clinic has SaaS settings for trial plan status and WhatsApp booking delivery from the clinic dashboard.
- Clinic staff can send booking details to the patient's WhatsApp from the daily bookings table. Fully automatic background sending is prepared for WhatsApp Business API integration.

For production SaaS accounts, create Supabase Auth users and mirror each account in the `users` table with:

- `auth_user_id`
- `clinic_id`
- `role`: `super_admin`, `clinic_admin`, `secretary`, or `patient`

The server verifies `Authorization: Bearer <token>` with Supabase Auth, resolves the user role, and scopes clinic dashboard data by `clinic_id`.

## Vercel Deployment

This SaaS is prepared for Vercel:

- Static files are served from `public/`.
- Client-side routes are rewritten to `/index.html` through `vercel.json`.
- API routes under `/api/*` are handled by `api/[...path].js`.
- If `DATABASE_URL` is configured, Vercel persists data in Supabase PostgreSQL. If it is missing in production, the app refuses to use temporary JSON storage.

Recommended Vercel settings:

- Framework preset: Other
- Build command: `npm run build`
- Output directory: leave empty/default
- Install command: `npm install`
