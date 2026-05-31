# Membership Management

## Roles

| Role | Can do |
|---|---|
| `OWNER` | Everything — manage plans, members, devices, open doors |
| `STAFF` | Add members, assign memberships, log entries, open doors |
| `MEMBER` | View own membership, history, open door from phone |

---

## Membership Plans

Plans are templates defined per gym. Create them before assigning to members.

**Go to:** Admin → Plans → Add Plan

### Time-based plan
- Member gets access for N calendar days from the start date
- Entry is allowed once per day (configurable)
- Expires automatically when the date passes

**Example:** Monthly (30 days), Quarterly (90 days), Week pass (7 days)

### Session-based plan
- Member gets a fixed number of sessions
- Each entry deducts 1 session
- Expires automatically when sessions reach 0

**Example:** 10 sessions, 20 sessions, Single entry

### Max entries per day
Both plan types have a `maxPerDay` setting (default: 1). This prevents membership sharing — once someone enters, no one else can use the same membership that day.

To allow a specific member to train twice a day, edit their membership and set a custom override.

---

## Managing Members

**Go to:** Admin → Members

### Add a member
Click **Add Member** → enter name, email, phone, role. This creates a login account with no membership yet.

> The member will need a password set before they can log in. Currently passwords are set by you as the owner (future: invite email flow).

### Assign a membership
Click **View** on a member → **Assign Plan** → pick the plan, set the start date, add optional notes (e.g. payment reference).

The membership being `ACTIVE` means the person has paid and can enter.

### Search
Use the search box on the Members page to filter by name, email, or phone number.

---

## Membership Status

| Status | Meaning |
|---|---|
| `ACTIVE` | Valid, member can enter |
| `EXPIRED` | Time ran out or sessions exhausted (set automatically on next entry attempt) |
| `SUSPENDED` | Manually paused by owner/staff |
| `CANCELLED` | Cancelled, won't be reactivated |

### Editing a membership
On the member detail page → **Edit** button:

- **Extend** — add N days to the expiry date (time-based plans)
- **Add Sessions** — top up session count (session-based plans)
- **Status** — manually change the status

---

## Recording Entries

### Automatic
- RFID scan at the door (via ESP32)
- Phone door open (PWA "Open Door" button)

Both are validated against the membership and logged automatically.

### Manual (staff/owner)
On the member detail page → **Log Entry**. Use this when someone walks in and you're at the desk. Optionally add a note.

### Entry rules
The system checks on every entry attempt:
1. Does the member have an active membership?
2. Is it within the valid date range (time-based) or are there sessions left (session-based)?
3. Have they already entered today (respects `maxPerDay`)?

If any check fails, entry is denied with a reason.

---

## Tracking who paid / who didn't

- Members with `ACTIVE` membership = paid
- Members showing **None** in the membership column = have not paid / no plan assigned
- Members with `EXPIRED` status = membership lapsed, need renewal

The `notes` field on a membership is a good place to store payment references, transaction IDs, or any custom notes.
