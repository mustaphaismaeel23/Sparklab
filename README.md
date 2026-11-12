# SPARKLAB QR Code Attendance Management System

A full-stack Next.js application for SPARKLAB Creativity and Innovation Hub. Admins register people and start no-limit or time-limited attendance sessions. Participants scan a reusable printed QR code with a phone camera, enter their username, and check in only when the server verifies their location is within the office geofence.

## Technology

- Next.js 15 / React 19 / TypeScript
- Tailwind CSS 4
- PostgreSQL + Prisma 6
- Signed, HTTP-only admin session cookie (Jose JWT)
- Reusable QR generation (`qrcode`) and phone-camera scanning
- Excel (`exceljs`) and PDF (`pdfkit`) reports

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 14 or newer
- npm

## Setup (Windows PowerShell or macOS/Linux terminal)

1. Extract this project and open a terminal in the `sparklab-attendance` folder.
2. Install packages:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set your real database connection and secrets. For example:

   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sparklab_attendance?schema=public"
   JWT_SECRET="use-a-random-secret-of-at-least-32-characters"
   APP_URL="http://localhost:3000"
   OFFICE_LATITUDE="YOUR_OFFICE_LATITUDE"
   OFFICE_LONGITUDE="YOUR_OFFICE_LONGITUDE"
   OFFICE_RADIUS_METERS="100"
   ADMIN_NAME="SPARKLAB Administrator"
   ADMIN_EMAIL="admin@yourdomain.com"
   ADMIN_PASSWORD="use-a-strong-unique-password"
   ```

   Generate a strong JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

4. Create an empty PostgreSQL database named `sparklab_attendance`.
5. Generate Prisma client and create tables:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

   If you are only testing locally and do not want a migration yet, use `npx prisma db push` instead.

6. Create the first administrator:

   ```bash
   npm run db:seed
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

8. Open `http://localhost:3000/admin/login`. Sign in with the admin email/password from `.env`.

## Reset the administrator password

1. Set `ADMIN_EMAIL` to the existing administrator's email and `ADMIN_PASSWORD` to the new password in `.env`.
2. Run:

   ```bash
   npm run db:reset-admin-password
   ```

The command updates the password for that existing administrator. It does not create an account if the email is not found.

## How to use

1. Open **Users** and register students and staff. Enter a unique username for each person (3–24 letters, numbers, or hyphens; spaces become hyphens).
2. Open **QR Session** and download the reusable QR code once. Print it and post it at the attendance table.
3. Start an attendance session. **No time limit** is selected by default; the session remains active until you start another one. You can still select a limited duration when needed. The printed QR stays the same.
4. Participants scan the posted QR with their phone camera, enter their username, and allow location access.
5. The server checks the active session, registered person, and GPS position against the configured office radius, then records attendance. It does not save the participant's coordinates. In a no-limit session, each person can check in once per Africa/Lagos calendar day.
6. Admins can search users and attendance, see each user's distinct attendance-day count, activate/deactivate users, edit details, delete a user with their attendance history, or delete an individual attendance record. Deletions require confirmation. The Attendance tab refreshes when opened and every 10 seconds while visible.

## Important deployment notes

- Geolocation requires HTTPS on deployed sites. On localhost, browsers generally allow location access without HTTPS.
- Set `APP_URL` to the public HTTPS origin before deployment; the reusable QR points to this address.
- Set `OFFICE_LATITUDE`, `OFFICE_LONGITUDE`, and `OFFICE_RADIUS_METERS` on the server. Check-ins are rejected unless the reported GPS position and its accuracy fit within the configured radius.
- Use a managed PostgreSQL database. Apply schema changes before deploying; this project currently uses `prisma db push` and has no committed migration history.
- Set strong, private `JWT_SECRET` and admin credentials. Do not commit `.env`.
- `.env.example` contains placeholders only; keep `.env` out of Git.
- Set the deployment/runtime timezone to UTC if possible; attendance timestamps are stored as server timestamps and displayed in `Africa/Lagos`.
- GPS readings can be inaccurate indoors and can be spoofed. The geofence is a basic presence check, not strong identity proof; the app does not store coordinates.
- Add provider/edge rate limiting (for example, Cloudflare or your hosting platform) to `/api/attendance/verify` before public production use. In-memory rate limiting is intentionally not used because it is unreliable across serverless instances.
- Back up PostgreSQL regularly and restrict admin access to trusted personnel.

## Deploy to Vercel

1. Rotate any database or administrator passwords that were previously placed in `.env.example`. Copy `.env.example` to `.env` locally and use the new credentials.
2. Before deploying the username update to a database that already has users, run `npm run db:push`, then `npm run db:backfill-usernames`. For schema changes, use Supabase's direct connection or Session Pooler (port `5432`); the Transaction Pooler (port `6543`) is intended for app runtime and may stall schema operations. The backfill script generates usernames from existing names and is safe to rerun. Share the generated usernames with users before they check in.
3. Create the first admin with `npm run db:seed` if one does not already exist.
4. Push the project to your GitHub repository, then import that repository into Vercel.
5. Add these Vercel environment variables for Production:
   - `DATABASE_URL`: Supabase Transaction Pooler connection string (port `6543`) for Vercel serverless deployments.
   - `JWT_SECRET`: a private random secret of at least 32 characters.
   - `APP_URL`: your deployed HTTPS origin, for example `https://your-project.vercel.app`.
   - `OFFICE_LATITUDE` and `OFFICE_LONGITUDE`: the office center coordinates.
   - `OFFICE_RADIUS_METERS`: the allowed radius, such as `100`.
6. Deploy. The build script generates Prisma Client and builds Next.js. Set `APP_URL` to the final Vercel domain and redeploy if the domain changes.

The app automatically enables Prisma's PgBouncer-compatible mode for Supabase Transaction Pooler URLs.

Keep `ADMIN_EMAIL` and `ADMIN_PASSWORD` local for initial seeding or password resets; never commit them or place them in client-side code.

## Main routes

- `/admin/login` — administrator login
- `/admin` — admin dashboard, users, QR session and attendance reports
- `/attendance` — participant page opened by the reusable printed QR
- `/api/people` — authenticated registration/listing
- `/api/people/[id]` — authenticated user editing/deletion
- `/api/sessions` — authenticated session and QR generation
- `/api/attendance/verify` — public attendance verification
- `/api/attendance` — authenticated attendance listing
- `/api/attendance/[id]` — authenticated attendance-record deletion
- `/api/reports/export?format=xlsx|pdf` — authenticated exports

## Notes

The system intentionally has no student/staff accounts: participants use their short unique ID after scanning the posted QR. Only administrators can register and manage people. The first administrator is created by the seed script.
