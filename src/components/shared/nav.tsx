"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dumbbell, Users, CreditCard, LogIn, Settings, BarChart3, Cpu, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavProps {
  role?: string;
}

export function Nav({ role }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isAdmin = role === "OWNER" || role === "STAFF";

  const adminLinks = [
    { href: "/admin/members", label: "Članovi", icon: Users },
    { href: "/admin/plans", label: "Planovi", icon: CreditCard },
    { href: "/admin/entries", label: "Evidencija", icon: BarChart3 },
    { href: "/admin/devices", label: "Uređaji", icon: Cpu },
    { href: "/admin/settings", label: "Podešavanja", icon: Settings },
  ];

  const clientLinks = [
    { href: "/dashboard", label: "Početna", icon: Dumbbell },
    { href: "/history", label: "Istorija", icon: BarChart3 },
    { href: "/door", label: "Otvori vrata", icon: DoorOpen },
  ];

  const links = isAdmin ? adminLinks : clientLinks;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center gap-4 px-4">
        <Link href={isAdmin ? "/admin/members" : "/dashboard"} className="flex items-center gap-2 font-semibold mr-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Macaw</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {isAdmin && (
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline hidden sm:block">
            Korisnički prikaz
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-medium">{session?.user?.name}</div>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground">{session?.user?.email}</div>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin/members">
                  <Settings className="h-4 w-4 mr-2" /> Admin panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogIn className="h-4 w-4 mr-2" /> Odjavi se
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
