-- ============================================================================
-- ALL PRICING REMOVED - 2026-10-02 (Jayme's decision)
-- ============================================================================
-- Why: there is no verified source to compare prices against, and no system
-- yet to pull the real price from iClass. Every price the calendar showed came
-- from a hand-kept lookup table or, failing that, from the first dollar amount
-- found in an event's title or description. None of it was verified.
--
-- What was removed from the live database on 2026-10-02:
--   1. events.price          -> set to NULL on every event (368 had a value).
--   2. validation_errors     -> 'price_mismatch' entries stripped (4 events).
--   3. rules                 -> the last price check deleted:
--                               check_price_mismatch
--                               "Price Mismatch (Title vs Description)".
--      (check_camp_price and check_event_price were already deleted 2026-07-01,
--       see REMOVED_PRICING_VALIDATION_2026_07_01.sql.)
--
-- What was removed from the code the same day:
--   - automation/f12_collect_and_import.py : no longer sets a price at all.
--   - automation/validation_engine.py      : the three price checks are gone.
--   - the app: price is gone from the event panel, table view, CSV export,
--     sync preview, add-event form, rule wizard and Gym Rules filters.
--
-- NOT touched: the camp_pricing and event_pricing tables still exist with
-- their rows. Nothing reads them any more.
--
-- BACKUP: every value removed is saved in
--   database/backups/REMOVED_PRICING_2026_10_02_backup.json
--   (event id + price, the 4 events' full validation_errors, the rule row).
--
-- Do NOT restore any of this without Jayme's explicit go.
-- ============================================================================

-- The statements that were run (for the record):
DELETE FROM rules
 WHERE rule_type IN ('check_price_mismatch','check_camp_price','check_event_price',
                     'valid_price','sibling_price','price');

UPDATE events e
   SET validation_errors = COALESCE((
         SELECT jsonb_agg(x) FROM jsonb_array_elements(e.validation_errors) x
          WHERE x->>'type' NOT IN ('price_mismatch','camp_price_mismatch','event_price_mismatch')
       ), '[]'::jsonb)
 WHERE jsonb_typeof(e.validation_errors) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(e.validation_errors) x
                WHERE x->>'type' IN ('price_mismatch','camp_price_mismatch','event_price_mismatch'));

UPDATE events SET price = NULL WHERE price IS NOT NULL;
