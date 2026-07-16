import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUPABASE_CA_CERT } from "@/lib/supabase-ca";

function createPrismaClient() {
  const raw = process.env.DATABASE_URL!;
  const url = new URL(raw);

  // Recent pg treats `sslmode=require` as `verify-full` AND lets that override an
  // explicit `ssl` config, which would ignore our pinned CA below. Strip the
  // query flags and drive TLS entirely from the `ssl` object.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("pgbouncer");
  const connectionString = url.toString();

  // TLS policy by host:
  //  - local dev: no TLS;
  //  - Supabase pooler: pin Supabase's private root CA (not in Node's trust
  //    store) and verify;
  //  - any other managed host (e.g. Neon, whose cert is publicly trusted): use
  //    the system trust store and verify.
  // Verification stays on in every non-local case.
  const host = url.hostname;
  const ssl =
    host === "localhost" || host === "127.0.0.1"
      ? undefined
      : host.endsWith(".supabase.com")
        ? { ca: SUPABASE_CA_CERT, rejectUnauthorized: true }
        : { rejectUnauthorized: true };

  // Runtime traffic goes through Supabase's transaction pooler (port 6543).
  // Keep the per-instance pool small so many serverless invocations don't
  // exhaust the pooler's connection budget.
  const adapter = new PrismaPg({ connectionString, max: 3, ssl });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
