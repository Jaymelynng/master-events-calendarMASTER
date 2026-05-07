-- ============================================================================
-- ENABLE RLS ON UNGUARDED TABLES — closes the 3 RLS gaps surfaced by the
-- Supabase advisor on May 6, 2026
-- ============================================================================
-- Before this migration, three tables had Row Level Security DISABLED entirely:
--   public.sync_log
--   public.camp_pricing_map
--   public.extractors
-- That meant anyone with the browser-side anon key (which ships in the JS
-- bundle) could read / modify / delete every row.
--
-- The right policy for each was determined by inspecting actual code usage:
--
--   Table              | Frontend reads | Frontend writes | Decision
--   -------------------+----------------+-----------------+-----------------
--   sync_log           | YES (api.js,   | YES (api.js     | FOR ALL policy
--                      |  ExportModal)  |  log() upsert)  | (same as `rules`)
--   camp_pricing_map   | NO             | NO              | RLS on, no policy
--   extractors         | NO             | NO              | RLS on, no policy
--
-- Service-role (Railway/Python) bypasses RLS entirely, so locking
-- camp_pricing_map and extractors with no policy does NOT break any
-- service-role code that may use them in the future. Frontend access
-- is the only thing that gets denied.
--
-- Live fix already applied to production via Supabase MCP migration
-- "enable_rls_on_sync_log_camp_pricing_map_extractors". This file
-- backfills the SQL so the change is reproducible from the repo.
--
-- Created: May 6, 2026
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) sync_log — frontend read+write, treat like other anon-accessed tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sync_log" ON public.sync_log;
CREATE POLICY "Allow all access to sync_log"
  ON public.sync_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.sync_log TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) camp_pricing_map — abandoned scaffold from April pricing breakthrough.
--    Zero references in any JS or Python file in this repo. Locking it down
--    is the safest cleanup; if a future PR needs it, it adds the right
--    policy at that time.
-- ----------------------------------------------------------------------------
ALTER TABLE public.camp_pricing_map ENABLE ROW LEVEL SECURITY;
-- (intentionally no policy — anon and authenticated cannot read or write;
--  service-role bypasses RLS so admin tooling still works)

-- ----------------------------------------------------------------------------
-- 3) extractors — seeded for a future "format-aware extractors" feature in
--    the validation engine. No JS or Python code references it yet.
--    Python uses the service-role key and bypasses RLS, so when the engine
--    is wired up to read this table it will continue to work without any
--    policy change. Frontend should never read this directly — it goes
--    through the validation engine.
-- ----------------------------------------------------------------------------
ALTER TABLE public.extractors ENABLE ROW LEVEL SECURITY;
-- (intentionally no policy — same reasoning as camp_pricing_map)

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Confirm RLS is enabled on all 3 tables:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname='public'
--     AND tablename IN ('sync_log','camp_pricing_map','extractors');
--
-- Confirm sync_log has the FOR ALL policy:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='sync_log';
--
-- Verify lockdown as the anon role (camp_pricing_map and extractors should
-- return 0 rows even though they may have data):
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM camp_pricing_map;  -- should be 0
--   SELECT count(*) FROM extractors;         -- should be 0
-- ============================================================================

-- ============================================================================
-- FOLLOW-UPS NOT IN THIS MIGRATION
-- ============================================================================
-- 1. The "RLS Policy Always True" advisor still warns on 16 tables that use
--    USING (true) WITH CHECK (true). That's the entire app's anon-as-internal-
--    tool pattern. Tightening it requires Supabase Auth (JWT-based per-user
--    policies) and is the right pre-flight check BEFORE rolling out to gym
--    managers or selling SaaS. Out of scope here.
--
-- 2. `events_with_gym` and `gym_links_detailed` views are SECURITY DEFINER.
--    Worth investigating whether SECURITY INVOKER (the safer default) is
--    enough — but changing that mid-app could break read paths, needs care.
--
-- 3. Three functions have mutable search_path (`get_current_price`,
--    `archive_single_event`, `auto_archive_old_events`). One-line fix per
--    function: add `SET search_path = public` to the definition.
--
-- 4. `camp_pricing_map` is unused — recommend dropping after confirming.
-- ============================================================================
