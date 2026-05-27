# Dawri Medical / دوري الطبي

MVP web application for Iraqi private clinic appointment and queue management.

## What This MVP Includes

- Arabic-first RTL responsive web UI
- Patient doctor search, doctor profile, booking flow, confirmation, and live queue tracking
- Clinic secretary dashboard for today's bookings, patient status changes, and queue controls
- Clinic admin schedule and doctor management screens
- Super admin dashboard for platform stats, clinics, specialties, governorates, areas, and bookings
- Node.js API server with a JSON-backed mock database in `data/db.json`
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
- `server/database.js`: persistence boundary with JSON fallback and PostgreSQL/Supabase support through `DATABASE_URL`
- `server/db/schema.sql`: PostgreSQL schema used by the automatic database setup
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

## Latest MVP Upgrade

- Professional Arabic RTL healthcare SaaS UI polish across homepage, booking, tracking, dashboard, and admin.
- Upgraded booking confirmation with full booking details, remaining patients, queue progress, and WhatsApp share link.
- Live tracking now shows current queue, patient queue number, remaining patients, estimated wait, clinic status, and queue progress.
- Clinic queue sessions support: `open`, `delayed`, `paused`, `closed`, and `doctor_absent`, with delay reason and estimated delay duration.
- Secretary dashboard includes practical queue controls, delay controls, clinic close/paused/doctor absent states, and patient status actions.
- Super admin dashboard has visual statistics and management placeholders for clinic approval, doctors, specialties, governorates, and areas.

## PostgreSQL / Supabase

The app now uses PostgreSQL automatically when `DATABASE_URL` is available. Without `DATABASE_URL`, it keeps using `data/db.json` for local demos.

Supabase setup:

1. Create a Supabase project.
2. Copy the PostgreSQL connection string from Project Settings > Database.
3. Add it to Vercel as an environment variable named `DATABASE_URL`.
4. Redeploy the Vercel project.
5. On first request, the app creates the schema and seeds the Iraqi demo data if the database is empty.

For local development with PostgreSQL, create a `.env` from `.env.example` or set `DATABASE_URL` in your shell before running:

```powershell
$env:DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
node server/server.js
```

To reset and reseed the connected database:

```powershell
node server/reset-db.js
```

## Staff Access Codes

Patient booking and tracking stay public. Clinic and owner operations are protected with access-code headers.

Set these in Vercel Environment Variables:

- `STAFF_ACCESS_CODE`: code for secretary / clinic admin dashboard.
- `SUPER_ADMIN_ACCESS_CODE`: code for platform owner dashboard.

Fallback demo codes are available if env vars are not set:

- Clinic staff: `clinic-2026`
- Platform owner: `owner-2026`

Change both before using the demo with real clinics.

## Multi-Clinic SaaS Flow

The MVP now supports the first multi-tenant workflow:

- Clinics submit registration requests from `/clinic-register`.
- New clinics are saved as `pending` with a generated `slug`, trial plan, and private clinic access code.
- Super admin reviews requests in `/admin/clinics`, approves active clinics, or disables them.
- Each active clinic gets a public patient page at `/clinics/{slug}`.
- Clinic access codes scope dashboard data to one clinic: doctors, schedules, bookings, queue sessions, and notifications.
- Clinic staff can add doctors only to their own clinic; the server ignores any forged `clinic_id`.

This is still access-code based for MVP speed. The next production step is replacing access codes with real user accounts, password reset, and session tokens.

## Vercel Deployment

This MVP is now prepared for Vercel:

- Static files are served from `public/`.
- Client-side routes are rewritten to `/index.html` through `vercel.json`.
- API routes under `/api/*` are handled by `api/[...path].js`.
- If `DATABASE_URL` is configured, Vercel persists data in PostgreSQL/Supabase. If not, it falls back to temporary JSON storage for demos.

Recommended Vercel settings:

- Framework preset: Other
- Build command: `npm run build`
- Output directory: leave empty/default
- Install command: `npm install`
