import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export default async function RootPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  if (user.role === "OWNER" || user.role === "STAFF") {
    redirect("/admin/members");
  }

  redirect("/dashboard");
}
