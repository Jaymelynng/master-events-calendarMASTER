-- ============================================================================
-- Re-enable the TITLE-vs-DESCRIPTION price check (July 12, 2026)
-- ----------------------------------------------------------------------------
-- Context: On July 1, 2026 all 3 pricing checks were removed
-- (check_price_mismatch, check_camp_price, check_event_price) — see
-- database/REMOVED_PRICING_VALIDATION_2026_07_01.sql.
--
-- Jayme's clarification: removing PRICE SOURCE OF TRUTH (description price vs a
-- pricing TABLE) is correct and stays off. But "title says one price and the
-- description says another" is an INTERNAL CONTRADICTION — a data-quality error
-- that needs no true price at all (same idea as the title-vs-description PROGRAM
-- check). So only check_price_mismatch comes back.
--
-- check_price_mismatch (validation_engine.py) fires ONLY when there is a price
-- in BOTH the title and the description and they don't match. It never touches
-- camp_pricing / event_pricing. The two source-of-truth checks stay OFF.
--
-- Takes effect on the next sync (the engine loads active check_* rules from the
-- rules table each run). No code change, no Railway redeploy.
-- ============================================================================

insert into public.rules
  (rule_type, label, description, gym_ids, program, scope, value,
   is_system, is_permanent, is_active, created_by)
select
  'check_price_mismatch',
  'Price Mismatch (Title vs Description)',
  'INTERNAL CONSISTENCY ONLY — not a source-of-truth check. Fires only when the '
    || 'TITLE has a price AND the description has a price, and they do not match '
    || '("title says $30 but description says $25"). Uses NO pricing table; the '
    || 'camp/event price-vs-table checks stay OFF (Jayme, July 1). Re-enabled July 2026.',
  ARRAY['ALL']::text[],
  'ALL', 'all_events', 'system_check',
  true, true, true, 'system'
where not exists (select 1 from public.rules where rule_type = 'check_price_mismatch');
