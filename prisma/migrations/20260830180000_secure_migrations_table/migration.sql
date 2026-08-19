-- Lock down Prisma's own bookkeeping table.
--
-- `_prisma_migrations` is created by the Prisma CLI, not by our schema, so the
-- previous RLS migration did not cover it. On Supabase that leaves it exposed
-- through PostgREST: an unauthenticated request with the public anon key can
-- read the project's entire migration history, including names and checksums.
--
-- No user data lives there, so the severity is low, but it is free to close and
-- there is no reason to publish our schema history.
--
-- Prisma itself is unaffected: it connects as the table owner, which bypasses
-- RLS (FORCE ROW LEVEL SECURITY is deliberately not set).

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON "_prisma_migrations" FROM anon, authenticated';
  END IF;
END $$;
