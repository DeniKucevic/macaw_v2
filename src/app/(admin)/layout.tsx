import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || (user.role !== "OWNER" && user.role !== "STAFF")) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav role={user.role} />
      <main className="container mx-auto px-4 py-6 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
