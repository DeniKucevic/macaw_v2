import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Nav } from "@/components/shared/nav";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Nav role={user.role} />
      <main className="container mx-auto px-4 py-6 max-w-2xl">{children}</main>
    </div>
  );
}
