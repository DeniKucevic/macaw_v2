-- Move the staff note from Membership onto User so it survives membership
-- expiry/renewal.

-- AlterTable: add the user-level note column
ALTER TABLE "User" ADD COLUMN "note" TEXT;

-- Backfill: copy each member's most recent non-empty membership note onto the
-- user. Ties (same createdAt) are broken by id so the pick is deterministic.
UPDATE "User" u
SET "note" = m."notes"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "notes"
  FROM "Membership"
  WHERE "notes" IS NOT NULL AND btrim("notes") <> ''
  ORDER BY "userId", "createdAt" DESC, "id" DESC
) m
WHERE m."userId" = u."id";

-- Drop the now-redundant per-membership note column
ALTER TABLE "Membership" DROP COLUMN "notes";
