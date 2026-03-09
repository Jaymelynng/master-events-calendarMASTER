-- ============================================================================
-- MIGRATE gym_valid_values → rules TABLE
-- ============================================================================
-- Part of the rules unification project (March 2026).
--
-- WHAT THIS DOES:
-- 1. Copies any gym_valid_values entries that haven't already been migrated
-- 2. Maps old rule_type names to new ones (price→valid_price, time→valid_time)
-- 3. Converts gym_id (single) to gym_ids (array)
-- 4. Sets all migrated rules as permanent with scope 'all_events'
--
-- SAFE TO RUN MULTIPLE TIMES — uses NOT EXISTS to avoid duplicates.
--
-- AFTER VERIFYING: You can drop gym_valid_values when ready:
--   DROP TABLE gym_valid_values;
-- ============================================================================

-- Step 1: Migrate gym_valid_values data to rules table
-- Maps: price → valid_price, time → valid_time, program_synonym stays the same
INSERT INTO rules (
  is_permanent,
  gym_ids,
  program,
  scope,
  rule_type,
  value,
  label,
  created_by
)
SELECT
  true,
  ARRAY[gvv.gym_id],
  CASE
    WHEN gvv.rule_type = 'program_synonym' THEN COALESCE(NULLIF(gvv.event_type, ''), 'ALL')
    ELSE COALESCE(NULLIF(gvv.event_type, ''), 'ALL')
  END,
  'all_events',
  CASE
    WHEN gvv.rule_type = 'price' THEN 'valid_price'
    WHEN gvv.rule_type = 'time' THEN 'valid_time'
    ELSE gvv.rule_type  -- program_synonym stays as-is
  END,
  gvv.value,
  gvv.label,
  'migrated_from_gym_valid_values'
FROM gym_valid_values gvv
WHERE NOT EXISTS (
  -- Skip if an equivalent rule already exists in the rules table
  SELECT 1 FROM rules r
  WHERE r.gym_ids @> ARRAY[gvv.gym_id]
    AND r.value = gvv.value
    AND r.rule_type = CASE
      WHEN gvv.rule_type = 'price' THEN 'valid_price'
      WHEN gvv.rule_type = 'time' THEN 'valid_time'
      ELSE gvv.rule_type
    END
);

-- Step 2: Verify migration
SELECT 'gym_valid_values count' AS source, count(*) AS total FROM gym_valid_values
UNION ALL
SELECT 'rules (migrated)' AS source, count(*) AS total FROM rules WHERE created_by = 'migrated_from_gym_valid_values'
UNION ALL
SELECT 'rules (all active)' AS source, count(*) AS total FROM rules WHERE is_permanent = true OR end_date >= CURRENT_DATE;

-- Step 3: Show what was migrated
SELECT
  gym_ids,
  rule_type,
  value,
  label,
  program,
  created_by
FROM rules
WHERE created_by = 'migrated_from_gym_valid_values'
ORDER BY gym_ids, rule_type;

-- ============================================================================
-- WHEN READY TO DROP OLD TABLE (uncomment and run manually):
-- ============================================================================
-- DROP TABLE IF EXISTS gym_valid_values;
-- ============================================================================
