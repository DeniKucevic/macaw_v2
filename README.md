# GymOS — Gym Membership Management System

Next.js 16 app for managing gym memberships, RFID/PIN door access, and member tracking.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **PostgreSQL** via Neon (production) / local Homebrew (development)
- **Prisma 7** with `@prisma/adapter-pg`
- **Better Auth** for authentication
- **Tailwind CSS + shadcn/ui**

## Local Development

```bash
npm install
npm run dev
```

Requires a `.env.local` file:
```
DATABASE_URL=postgresql://brixi@localhost:5432/macaw_v2?schema=public
BETTER_AUTH_SECRET=any-random-string
BETTER_AUTH_URL=http://localhost:3000
SETUP_SECRET=your-setup-secret
```

Start local Postgres:
```bash
brew services start postgresql@14
```

Run migrations:
```bash
npx prisma migrate dev
```

## Deployment (Vercel + Neon)

Required environment variables in Vercel:
- `DATABASE_URL` — Neon connection string (set automatically via Vercel Neon integration)
- `BETTER_AUTH_SECRET` — random 32+ char string (`openssl rand -base64 32`)
- `BETTER_AUTH_URL` — your Vercel URL (e.g. `https://macaw-v2.vercel.app`)
- `SETUP_SECRET` — secret required to call `/api/setup`

After deploying, run migrations against Neon:
```bash
DATABASE_URL="<neon-url>" npx prisma migrate deploy
```

## Creating the First Gym (Tenant Setup)

`POST /api/setup` is the one-time endpoint to create a gym and its owner account.
It requires `SETUP_SECRET` and is blocked once any gym exists.

```bash
curl -X POST https://macaw-v2.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "setupSecret": "your-setup-secret",
    "gymName": "My Gym",
    "ownerName": "Your Name",
    "ownerEmail": "you@example.com",
    "ownerPassword": "yourpassword"
  }'
```

After this, log in at `/login` with the owner credentials.

## Roles

- `OWNER` — full access (members, plans, entries, devices, settings)
- `STAFF` — manage members and entries
- `MEMBER` — client portal (dashboard, history, door open)

## Door Access Methods

- **PIN** — 6-digit code entered on keypad connected to ESP32
- **RFID** — card/tag scanned by ESP32 reader
- **Phone** — member taps "Otvori vrata" in the web app

ESP32 endpoints:
- `POST /api/device/[deviceId]/rfid` — RFID scan
- `POST /api/device/[deviceId]/poll` — poll for queued door commands
- `POST /api/device/[deviceId]/confirm` — confirm door was opened
