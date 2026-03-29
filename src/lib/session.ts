import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { Role } from "@/generated/prisma/client";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(minRole: Role) {
  const session = await requireAuth();
  const roleOrder: Role[] = [Role.MEMBER, Role.STAFF, Role.OWNER];
  const userRoleIndex = roleOrder.indexOf(session.user.role as Role);
  const requiredRoleIndex = roleOrder.indexOf(minRole);
  if (userRoleIndex < requiredRoleIndex) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function requireGymAccess(gymId: string) {
  const session = await requireAuth();
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.gymId !== gymId) {
    throw new Error("FORBIDDEN");
  }
  return { session, user };
}
