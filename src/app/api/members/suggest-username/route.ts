import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { suggestUsernameBase } from "@/lib/username";

// Suggests an available username from a member's name (firstname + first 2 of
// last name), appending 2, 3, … until one is free. Usernames are unique
// globally, so this checks the whole User table, not just the caller's gym.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const name = req.nextUrl.searchParams.get("name") ?? "";
  const base = suggestUsernameBase(name);
  if (base.length < 3) {
    return err("Unesite ime da bismo predložili korisničko ime", 400);
  }

  // Pull existing usernames that start with the base so we can pick the first
  // free suffix without a query per candidate.
  const taken = new Set(
    (
      await db.user.findMany({
        where: { username: { startsWith: base } },
        select: { username: true },
      })
    ).map((u) => u.username)
  );

  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }

  return ok({ username: candidate });
}
