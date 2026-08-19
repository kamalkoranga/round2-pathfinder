-- Lock the application tables away from Supabase's auto-generated REST API.
--
-- Supabase exposes every table in the `public` schema through PostgREST, using
-- the anon key for authentication. That key is published to every browser, so
-- without RLS these tables are world-readable and world-writable over HTTP.
--
-- We enable RLS and deliberately create NO policies. The effect:
--
--   · the `anon` and `authenticated` roles (i.e. anything coming through
--     PostgREST) are denied every row — RLS with no matching policy is a deny.
--   · the application is unaffected. Prisma connects as the table owner, and a
--     table owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set, which we
--     do not set.
--
-- Authorisation therefore stays where it is testable and reviewable: in
-- src/lib/repo.ts, where every query is scoped by the caller's userId. This
-- migration is a second line of defence, not the primary control.
--
-- If a table is ever added that genuinely should be reachable from the browser,
-- it needs an explicit policy rather than having RLS left off.

ALTER TABLE "LearnerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillLevel"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Completion"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningPath"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PathStep"       ENABLE ROW LEVEL SECURITY;

-- Belt and braces: revoke the grants PostgREST relies on, so the tables are
-- not merely filtered but invisible to those roles.

-- The anon/authenticated roles exist only on Supabase. Guard the REVOKEs so
-- this migration also applies cleanly to a plain local Postgres.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH t IN ARRAY ARRAY[
      'LearnerProfile','SkillLevel','Completion','Feedback',
      'LearningPath','Milestone','PathStep'
    ] LOOP
      EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    END LOOP;
  END IF;
END $$;
