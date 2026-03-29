# GymOS Documentation

Gym membership management system with RFID and phone-based door access.

## Contents

- [Getting Started](./getting-started.md) — first-time setup, environment, running the app
- [Membership Management](./membership-management.md) — plans, memberships, entries
- [ESP32 Integration](./esp32-integration.md) — door reader wiring and firmware
- [API Reference](./api-reference.md) — all API endpoints

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL 14 |
| ORM | Prisma 7 |
| Auth | Better Auth |
| UI | Tailwind CSS + shadcn/ui |
| Language | TypeScript |

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                   Browser                   │
│  Admin Dashboard  │  Client PWA (phone)     │
└────────┬──────────┴──────────┬──────────────┘
         │                     │
         ▼                     ▼
┌─────────────────────────────────────────────┐
│           Next.js API Routes                │
│  /api/members  /api/memberships  /api/door  │
└─────────────────────┬───────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                        ▼
┌─────────────────┐    ┌──────────────────────┐
│   PostgreSQL    │    │   ESP32 Door Reader  │
│   (Prisma ORM)  │    │  polls /api/device/  │
└─────────────────┘    └──────────────────────┘
```

## Multi-tenancy

Every record is scoped to a `gymId`. Multiple gyms can run on the same deployment — each gym's data is fully isolated. Each gym owner has their own account.
