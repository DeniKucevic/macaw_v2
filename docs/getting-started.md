# Getting Started

## Prerequisites

- Node.js 20+
- PostgreSQL 14+

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy `.env` and fill in your values:

```env
DATABASE_URL="postgresql://USER@localhost:5432/macaw_v2?schema=public"

BETTER_AUTH_SECRET="generate-a-random-string-here"
BETTER_AUTH_URL="http://localhost:3000"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

## 3. Set up the database

Start PostgreSQL (macOS with Homebrew):
```bash
brew services start postgresql@14
```

Create the database and run migrations:
```bash
createdb macaw_v2
npm run db:migrate
```

## 4. Generate Prisma client

```bash
npm run db:generate
```

## 5. Start the dev server

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

---

## First-time setup — create your gym and owner account

The app is blank on first run. Call the setup endpoint once to create your gym and owner account:

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "gymName": "My Gym",
    "ownerName": "Your Name",
    "ownerEmail": "owner@example.com",
    "ownerPassword": "yourpassword123"
  }'
```

A successful response looks like:
```json
{
  "gym": { "id": "...", "name": "My Gym", "slug": "my-gym" },
  "owner": { "id": "...", "email": "owner@example.com" },
  "message": "Setup complete. You can now log in."
}
```

This endpoint returns `403` after the first call — it can only be used once.

---

## Logging in

Go to `http://localhost:3000/login` and sign in with the email and password from the setup step.

- **Owners and staff** are redirected to `/admin/members`
- **Members** are redirected to `/dashboard`

---

## Useful scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply new migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run typecheck` | Run TypeScript type check |

---

## Production deployment

1. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your public domain
2. Set `BETTER_AUTH_SECRET` to a strong random value (never reuse the dev one)
3. Run `npm run build && npm run start`
4. Make sure PostgreSQL is accessible from your server
5. Run `npm run db:migrate` on first deploy
