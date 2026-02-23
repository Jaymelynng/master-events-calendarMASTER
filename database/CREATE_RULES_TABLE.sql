-- ============================================================================
-- CREATE RULES TABLE - Unified validation rules system
-- ============================================================================
-- Replaces the simpler gym_valid_values table with a full rules engine
-- that supports: permanent/temporary, per-gym/all-gym, keyword matching,
-- single event exceptions, sibling pricing, and program synonyms.
--
-- Created: February 23, 2026
-- ============================================================================

-- Step 1: Create the new rules table
CREATE TABLE IF NOT EXISTS rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Q1: Permanent or Temporary?
  is_permanent BOOLEAN NOT NULL DEFAULT true,
  end_date DATE,  -- null for permanent, set for temporary
  
  -- Q2: Which gym(s)?
  gym_ids TEXT[] NOT NULL DEFAULT '{ALL}',  -- array of gym IDs, or {ALL}
  
  -- Q3: Which program(s)?
  program TEXT NOT NULL DEFAULT 'ALL',  -- CAMP, CLINIC, OPEN GYM, KNO, SPECIAL EVENT, ALL
  camp_season TEXT,  -- school_year, summer, both, null (only for CAMP)
  
  -- Q4: How specific?
  scope TEXT NOT NULL DEFAULT 'all_events',  -- all_events, keyword, single_event
  keyword TEXT,  -- title keyword to match (null if all_events)
  event_id UUID,  -- specific event ID (null unless single_event)
  
  -- What the rule does
  rule_type TEXT NOT NULL,  -- valid_price, valid_time, program_synonym, sibling_price, exception
  value TEXT,  -- the value ($10, 8:30 AM, program name, etc.)
  value_kid2 TEXT,  -- sibling price for kid 2 (null if not sibling_price)
  value_kid3 TEXT,  -- sibling price for kid 3 (null if not sibling_price)
  label TEXT,  -- human-readable description
  note TEXT,  -- optional user note
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'manual'
);

-- Step 2: Indexes for fast lookups during validation
CREATE INDEX IF NOT EXISTS idx_rules_gym ON rules USING GIN (gym_ids);
CREATE INDEX IF NOT EXISTS idx_rules_program ON rules (program);
CREATE INDEX IF NOT EXISTS idx_rules_type ON rules (rule_type);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules (is_permanent, end_date)
  WHERE is_permanent = false;

-- Step 3: Enable RLS
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to rules" ON rules FOR ALL USING (true) WITH CHECK (true);

-- Step 4: Grant access
GRANT ALL ON rules TO anon, authenticated;

-- Step 5: Migrate existing gym_valid_values data
-- This copies existing rules into the new format
INSERT INTO rules (is_permanent, gym_ids, program, scope, rule_type, value, label, created_by)
SELECT 
  true,
  ARRAY[gym_id],
  COALESCE(NULLIF(event_type, ''), 'ALL'),
  'all_events',
  rule_type,
  value,
  label,
  'migrated_from_gym_valid_values'
FROM gym_valid_values
ON CONFLICT DO NOTHING;

-- Step 6: Migrate single-event exceptions from acknowledged_errors
-- These become temporary rules with scope = 'single_event'
INSERT INTO rules (is_permanent, gym_ids, program, scope, event_id, rule_type, value, label, note, created_by)
SELECT DISTINCT
  false,
  ARRAY[e.gym_id],
  e.type,
  'single_event',
  e.id,
  'exception',
  ack_item->>'message',
  'Event exception: ' || LEFT(e.title, 50),
  ack_item->>'note',
  'migrated_from_acknowledged_errors'
FROM events e,
  jsonb_array_elements(e.acknowledged_errors) AS ack_item
WHERE jsonb_array_length(e.acknowledged_errors) > 0
  AND e.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT count(*) AS total_rules FROM rules;
-- SELECT rule_type, count(*) FROM rules GROUP BY rule_type;
-- SELECT gym_ids, program, rule_type, value, label FROM rules ORDER BY created_at;
-- ============================================================================
