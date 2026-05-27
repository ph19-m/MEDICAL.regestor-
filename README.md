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
- `server/database.js`: JSON persistence boundary, ready to replace with PostgreSQL/Prisma later
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
