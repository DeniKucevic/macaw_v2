# API Reference

All endpoints return JSON. Authentication uses session cookies set by Better Auth.

Unless noted, **staff and owner** roles can access staff/owner-only routes. **Members** have read-only access to their own data.

---

## Authentication

### POST /api/auth/sign-in/email

Sign in with email and password (Better Auth).

```json
{
  "email": "owner@gym.com",
  "password": "your-password"
}
```

**Response:** Sets a session cookie. Returns user object.

### POST /api/auth/sign-out

Clears the session cookie.

---

## Setup

### POST /api/setup

One-time initialization. Creates the gym and owner account. Fails if a gym already exists in the database.

```json
{
  "gymName": "Iron Temple",
  "ownerName": "Jane Smith",
  "ownerEmail": "jane@irontemple.com",
  "ownerPassword": "secure-password"
}
```

**Response:**
```json
{
  "ok": true,
  "gymId": "...",
  "userId": "..."
}
```

> Run this once after deployment, then remove or disable the route.

---

## Members

### GET /api/members

Returns all members for the gym (OWNER/STAFF only).

```json
[
  {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "MEMBER",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "memberships": [ /* active membership, if any */ ]
  }
]
```

### POST /api/members

Create a new member (OWNER/STAFF only).

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",  // optional
  "role": "MEMBER"         // "MEMBER" | "STAFF", defaults to "MEMBER"
}
```

**Response:** `201` with created user object. Returns `409` if email already exists.

---

### GET /api/members/[id]

Get a single member with their memberships, recent entries, and RFID tags. Members can only access their own record. Staff/Owner can access any member in their gym.

**Response:**
```json
{
  "id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": null,
  "role": "MEMBER",
  "gymId": "...",
  "createdAt": "...",
  "memberships": [...],
  "entries": [...],    // last 50
  "rfidTags": [...]
}
```

### PUT /api/members/[id]

Update a member's name, phone, or role (OWNER/STAFF only).

```json
{
  "name": "John D.",     // optional
  "phone": "+1555...",   // optional
  "role": "STAFF"        // optional, "MEMBER" | "STAFF"
}
```

### DELETE /api/members/[id]

Delete a member (OWNER only). Cannot delete the gym owner.

---

## Membership Plans

### GET /api/plans

List all plans for the gym (any authenticated user).

**Response:**
```json
[
  {
    "id": "...",
    "name": "Monthly",
    "description": null,
    "type": "TIME_BASED",
    "durationDays": 30,
    "sessionCount": null,
    "price": "49.00",
    "currency": "EUR",
    "maxPerDay": 1,
    "isActive": true,
    "sortOrder": 0
  }
]
```

### POST /api/plans

Create a plan (OWNER only).

```json
{
  "name": "10-class Pack",
  "description": "Optional description",
  "type": "SESSION_BASED",   // "TIME_BASED" | "SESSION_BASED"
  "sessionCount": 10,        // required for SESSION_BASED
  "durationDays": 30,        // required for TIME_BASED
  "price": 89.00,
  "currency": "EUR",         // defaults to "EUR"
  "maxPerDay": 1,            // max entries per day, defaults to 1
  "sortOrder": 0
}
```

**Response:** `201` with created plan.

---

### PUT /api/plans/[id]

Update a plan (OWNER only). Only metadata — cannot change type or duration once created.

```json
{
  "name": "Updated name",    // optional
  "description": "...",      // optional
  "price": 55.00,            // optional
  "maxPerDay": 2,            // optional
  "isActive": true,          // optional
  "sortOrder": 1             // optional
}
```

### DELETE /api/plans/[id]

Soft-deactivates a plan (`isActive: false`). Does not delete existing memberships (OWNER only).

---

## Memberships

### GET /api/memberships

List memberships. Optional query param `?userId=<id>` to filter by member.

- Members: returns only their own memberships.
- Staff/Owner: returns all (or filtered by `userId`).

### POST /api/memberships

Assign a membership to a member (OWNER/STAFF only).

```json
{
  "userId": "...",
  "planId": "...",
  "startsAt": "2026-03-01T00:00:00.000Z",  // optional, defaults to now
  "notes": "Paid in cash",                  // optional
  "sessionsOverride": 12,                   // optional, overrides plan's sessionCount
  "maxPerDayOverride": 2                    // optional, overrides plan's maxPerDay
}
```

**Response:** `201` with created membership including plan and user info.

---

### GET /api/memberships/[id]

Get a single membership with its entries (last 20). Members can only access their own.

### PUT /api/memberships/[id]

Update a membership (OWNER/STAFF only).

```json
{
  "status": "SUSPENDED",        // optional: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED"
  "expiresAt": "2026-06-01",    // optional: set exact expiry (ISO date)
  "extendDays": 30,             // optional: add N days to current expiry
  "sessionsTotal": 15,          // optional: set total sessions
  "addSessions": 5,             // optional: add N sessions to current total
  "sessionsUsed": 0,            // optional: manually correct sessions used
  "maxPerDay": 2,               // optional: override entries per day
  "notes": "Extended for free"  // optional
}
```

> `extendDays` and `addSessions` are convenience helpers — they adjust the existing value rather than replacing it.

---

## Entries

### GET /api/entries

List entries. Optional query params: `?userId=<id>`, `?limit=50`, `?offset=0`.

- Members: returns only their own entries.
- Staff/Owner: returns all entries with `total` count for pagination.

**Staff/Owner response:**
```json
{
  "entries": [...],
  "total": 142
}
```

### POST /api/entries

Record a manual entry for a member (OWNER/STAFF only).

```json
{
  "userId": "...",
  "notes": "Walk-in"  // optional
}
```

Runs the same validation as RFID and phone entries (checks active membership, expiry, session count, daily limit). Returns `422` if not allowed.

**Response:** `201` with entry result.

---

## Devices

### GET /api/devices

List all ESP32 devices for the gym (OWNER only).

### POST /api/devices

Register a new device (OWNER only).

```json
{
  "name": "Main Door"
}
```

**Response:** `201` with device ID and secret key. **Save the secret — it is shown once.**

```json
{
  "id": "...",
  "name": "Main Door",
  "secret": "a3f9...b2d1",
  "createdAt": "..."
}
```

---

## Door / ESP32 Endpoints

These endpoints are called by the ESP32 firmware and the member PWA. See [esp32-integration.md](./esp32-integration.md) for the full flow.

### POST /api/device/[deviceId]/rfid

Called by ESP32 when a tag is scanned. Authenticates with device secret.

```json
{
  "tagId": "AB:CD:EF:12",
  "secret": "your-device-secret"
}
```

**Allowed:**
```json
{
  "allowed": true,
  "user": { "id": "...", "name": "John Doe" },
  "membership": { "type": "SESSION_BASED", "sessionsLeft": 4, "expiresAt": null }
}
```

**Denied:**
```json
{ "allowed": false, "reason": "No active membership" }
```

Entry is recorded automatically on success. No confirm step needed for RFID.

---

### POST /api/device/[deviceId]/poll

Called by ESP32 every 2–3 seconds to check for pending open commands.

```json
{ "secret": "your-device-secret" }
```

Updates the device's `lastSeenAt` and `isOnline` status.

**No command:**
```json
{ "command": null }
```

**Command waiting:**
```json
{
  "command": {
    "id": "cmd_abc123",
    "user": { "id": "...", "name": "Ana" },
    "createdAt": "2026-02-27T10:00:00.000Z"
  }
}
```

→ Open the relay, then call `/confirm`. Commands expire after **30 seconds**.

---

### POST /api/device/[deviceId]/confirm

Called by ESP32 after the relay fires. Records the entry and marks the command complete.

```json
{
  "secret": "your-device-secret",
  "commandId": "cmd_abc123"
}
```

**Response:**
```json
{
  "confirmed": true,
  "entryResult": {
    "allowed": true,
    "membership": { "sessionsLeft": 3, "expiresAt": null }
  }
}
```

---

### POST /api/door/open

Called by the member PWA to request the door to open.

Requires an active session (member must be logged in). Validates the member's membership, then queues a `DoorRequest` that the ESP32 picks up via `/poll`.

```json
{ "deviceId": "..." }
```

**Response:**
```json
{ "queued": true, "commandId": "..." }
```

Returns `422` if the member has no valid membership.

---

## Error responses

All errors follow this shape:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request / validation error |
| `401` | Not authenticated |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate email) |
| `422` | Entry denied (membership issue) |
| `500` | Internal server error |
