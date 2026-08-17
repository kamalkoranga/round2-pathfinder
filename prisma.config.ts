import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js reads .env.local; the Prisma CLI does not, so load it explicitly.
// Later files do not override earlier ones, so .env.local wins.
loadEnv({ path: [".env.local", ".env"], quiet: true });

/**
 * Prisma 7 configuration.
 *
 * Connection URLs live here rather than in schema.prisma (a v7 change).
 *
 * On Supabase, `DATABASE_URL` should be the **pooled** Supavisor connection
 * (port 6543) used at runtime, and `DIRECT_URL` the **direct** connection
 * (port 5432) — migrations need a real session that a transaction pooler
 * cannot provide. Locally both point at the same Postgres, so DIRECT_URL
 * falls back to DATABASE_URL.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // This URL is used by the Prisma CLI (migrate, studio) only. Migrations
    // need a real session, which a transaction pooler cannot give us, so prefer
    // the direct connection here. The *runtime* client uses the pooled
    // DATABASE_URL via the driver adapter in src/lib/db.ts.
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
