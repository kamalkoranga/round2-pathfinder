import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma client singleton.
 *
 * Prisma 7 requires a driver adapter; `@prisma/adapter-pg` wraps node-postgres.
 * In development the client is cached on `globalThis` so Next.js hot reloads do
 * not open a new connection pool on every edit — the classic way to exhaust a
 * Postgres connection limit in about ninety seconds.
 *
 * On Supabase, DATABASE_URL should be the pooled Supavisor connection (port
 * 6543). Serverless functions are short-lived and each one opens its own pool,
 * so a small max keeps us well inside the pooler's client limit.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres instance.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    max: process.env.VERCEL ? 1 : 10,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when a database is configured at all. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
