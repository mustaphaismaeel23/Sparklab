# SPARKLAB QR Code Attendance Management System

A full-stack Next.js application for SPARKLAB Creativity and Innovation Hub. Admins register students, staff, visitors, guests, and subscribers, start no-limit or time-limited sessions, and manage walk-in visitor check-ins. Subscriber records include a Daily, Weekly, or Monthly Pass and its active dates.

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

1. Open **Users** and register students, staff, registered visitors, or subscribers. Guests use the separate walk-in check-in and do not need an account. Enter a unique username for registered people (3–24 letters, numbers, or hyphens; spaces become hyphens). Subscribers also need a pass plan and start/expiry dates.
2. Open **QR Session** and download the reusable QR code once. Print it and post it at the attendance table.
3. Start a session to enable check-in. **No time limit** is selected by default; the session remains active until you start another one. You can still select a limited duration when needed. The printed QR stays the same.
4. Participants scan the posted QR and choose registered-person, Visitor, or Guest check-in. Registered people select their category and enter their username. Subscribers can check in only from their start date through their expiry date, inclusive, in the Africa/Lagos timezone. Existing registered Guest accounts remain supported.
5. Visitors and Guests enter their name and select a host/inviter, or choose **Other** and enter a name. Each category is recorded separately and a normalized name can be recorded once per category per day. No account is needed for walk-in Guests or Visitors.
6. Admins manage walk-in records in the **Visitors & Guests** dashboard, including filtering by category/date, searching by name or host, and deleting an incorrect record. These records remain stored separately and are included under their respective categories in attendance exports.
7. Admins can search/filter all five categories across registered people and walk-in records, see each registered person's distinct attendance-day count and subscriber pass dates, and export attendance plus Visitor and Guest walk-ins to Excel or PDF. The Attendance table shows one latest row per person; filtering by date shows their check-in for that day. Admins can also activate/deactivate users, edit details, delete a user with their attendance history, or delete an individual attendance record. Deletions require confirmation. The Attendance tab refreshes when opened and every 10 seconds while visible.

## Important deployment notes

- The reusable QR points to the same host used by the admin page, so participants reach the deployment where the session was started.
- Use a managed PostgreSQL database. Apply schema changes before deploying; this project currently uses `prisma db push` and has no committed migration history. Schema updates add fields/indexes with defaults that preserve existing visitor records as Visitors. Run `npm run db:push` before deploying schema changes.
- Set strong, private `JWT_SECRET` and admin credentials. Do not commit `.env`.
- `.env.example` contains placeholders only; keep `.env` out of Git.
- Set the deployment/runtime timezone to UTC if possible; attendance timestamps are stored as server timestamps and displayed in `Africa/Lagos`.
- Attendance relies on the registered username and an active QR session; it is not strong identity proof.
- Add provider/edge rate limiting (for example, Cloudflare or your hosting platform) to public check-in endpoints before public production use. In-memory rate limiting is intentionally not used because it is unreliable across serverless instances.
- Back up PostgreSQL regularly and restrict admin access to trusted personnel.

## Deploy to Vercel

1. Rotate any database or administrator passwords that were previously placed in `.env.example`. Copy `.env.example` to `.env` locally and use the new credentials.
2. Before deploying schema changes to an existing database, run `npm run db:push`. If existing people still need usernames, then run `npm run db:backfill-usernames`. For schema changes, use Supabase's direct connection or Session Pooler (port `5432`); the Transaction Pooler (port `6543`) is intended for app runtime and may stall schema operations. The backfill script generates usernames from existing names and is safe to rerun. Share generated usernames with users before they check in.
3. Create the first admin with `npm run db:seed` if one does not already exist.
4. Push the project to your GitHub repository, then import that repository into Vercel.
5. Add these Vercel environment variables for Production:
   - `DATABASE_URL`: Supabase Transaction Pooler connection string (port `6543`) for Vercel serverless deployments.
   - `JWT_SECRET`: a private random secret of at least 32 characters.
6. Deploy. The build script generates Prisma Client and builds Next.js.

The app automatically enables Prisma's PgBouncer-compatible mode for Supabase Transaction Pooler URLs.

Keep `ADMIN_EMAIL` and `ADMIN_PASSWORD` local for initial seeding or password resets; never commit them or place them in client-side code.

## Main routes

- `/admin/login` — administrator login
- `/admin` — admin dashboard, users, QR sessions, attendance, and visitors
- `/attendance` — participant page opened by the reusable printed QR
- `/api/visitor-hosts` — public active host list used by walk-in visitor check-in
- `/api/visitor-visits` — visitor check-in and authenticated visitor listing
- `/api/visitor-visits/[id]` — authenticated visitor-record deletion
- `/api/people` — authenticated registration/listing
- `/api/people/[id]` — authenticated user editing/deletion
- `/api/sessions` — authenticated session and QR generation
- `/api/attendance/verify` — public attendance verification
- `/api/attendance` — authenticated attendance listing
- `/api/attendance/[id]` — authenticated attendance-record deletion
- `/api/reports/export?format=xlsx|pdf` — authenticated exports

## Notes

All registered categories use their registered usernames; subscriber access is limited to the recorded pass dates. Walk-in visitors may submit their name and host without creating an account. Only administrators can register and manage people. The first administrator is created by the seed script.
