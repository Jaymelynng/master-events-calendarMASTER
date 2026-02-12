-- ============================================
-- EVENT PRICING TABLE
-- Source of truth for Clinic, KNO, Open Gym prices
-- ============================================
-- Created: February 5, 2026
-- Purpose: Validate event prices against known correct prices
-- Similar to camp_pricing table but for non-camp events
-- ============================================

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS event_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL REFERENCES gyms(id),
  event_type VARCHAR NOT NULL,  -- 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'
  price DECIMAL(10,2) NOT NULL,
  duration_hours DECIMAL(3,1),  -- For clinics: 1.0, 1.5, etc. NULL for standard
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,  -- NULL means "current/no end"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_pricing_lookup 
ON event_pricing(gym_id, event_type, effective_date);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE event_pricing ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policy for public read access
CREATE POLICY "Allow public read access" ON event_pricing
  FOR SELECT USING (true);

-- Step 5: Create policy for authenticated insert/update
CREATE POLICY "Allow authenticated write access" ON event_pricing
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- NO HARDCODED PRICING — Manage via Admin Dashboard
-- ============================================
-- Event pricing is managed in: Admin Dashboard → Gym Rules tab → Event Pricing section.
-- Add, edit, or delete rows in Supabase event_pricing table or via the Admin UI.
-- DO NOT add hardcoded INSERT statements here.


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View all current prices (as of today)
-- SELECT * FROM event_pricing 
-- WHERE effective_date <= CURRENT_DATE 
-- AND (end_date IS NULL OR end_date >= CURRENT_DATE)
-- ORDER BY gym_id, event_type;

-- View prices that will be active on Monday Feb 10
-- SELECT * FROM event_pricing 
-- WHERE effective_date <= '2026-02-10' 
-- AND (end_date IS NULL OR end_date >= '2026-02-10')
-- ORDER BY gym_id, event_type;

-- Compare old vs new prices
-- SELECT 
--   old.gym_id,
--   old.event_type,
--   old.price as old_price,
--   new.price as new_price,
--   new.price - old.price as increase
-- FROM event_pricing old
-- JOIN event_pricing new ON old.gym_id = new.gym_id AND old.event_type = new.event_type
-- WHERE old.end_date = '2026-02-09'
-- AND new.effective_date = '2026-02-10'
-- ORDER BY old.gym_id, old.event_type;


-- ============================================
-- HELPER FUNCTION: Get current price for gym/type
-- ============================================

CREATE OR REPLACE FUNCTION get_current_price(
  p_gym_id VARCHAR,
  p_event_type VARCHAR,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(price DECIMAL, notes TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ep.price, ep.notes
  FROM event_pricing ep
  WHERE ep.gym_id = p_gym_id
  AND ep.event_type = p_event_type
  AND ep.effective_date <= p_date
  AND (ep.end_date IS NULL OR ep.end_date >= p_date)
  ORDER BY ep.effective_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM get_current_price('CCP', 'KIDS NIGHT OUT');
-- Usage: SELECT * FROM get_current_price('CCP', 'KIDS NIGHT OUT', '2026-02-15');


-- ============================================
-- SUMMARY
-- ============================================
-- 
-- This table stores pricing history with effective dates.
-- 
-- HOW IT WORKS:
-- - Each row has an effective_date (when price starts)
-- - Each row has an optional end_date (when price ends)
-- - To find current price: WHERE effective_date <= TODAY AND (end_date IS NULL OR end_date >= TODAY)
-- 
-- PRICE CHANGES:
-- 1. Set end_date on old price row
-- 2. Insert new row with new effective_date
-- 
-- MONDAY'S CHANGES:
-- - Old prices end Feb 9, 2026
-- - New prices start Feb 10, 2026
-- - System will automatically use correct prices based on date
--
-- OPEN GYM: Not touched - stays at current prices
-- ============================================
