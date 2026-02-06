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
-- CURRENT PRICING (effective now)
-- ============================================

-- Capital Gymnastics - Cedar Park (CCP)
INSERT INTO event_pricing (gym_id, event_type, price, duration_hours, effective_date, notes) VALUES
('CCP', 'KIDS NIGHT OUT', 35.00, NULL, '2026-01-01', 'Sibling discount: $30 per sibling'),
('CCP', 'CLINIC', 30.00, 1.0, '2026-01-01', '1 hour clinic'),
('CCP', 'CLINIC', 35.00, 1.5, '2026-01-01', '1.5 hour clinic'),
('CCP', 'OPEN GYM', 10.00, NULL, '2026-01-01', NULL);

-- Capital Gymnastics - Pflugerville (CPF)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CPF', 'KIDS NIGHT OUT', 35.00, '2026-01-01', 'Sibling discount: $30 for 2nd child'),
('CPF', 'CLINIC', 25.00, '2026-01-01', 'No discounts'),
('CPF', 'OPEN GYM', 10.00, '2026-01-01', 'No discounts');

-- Capital Gymnastics - Round Rock (CRR)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CRR', 'KIDS NIGHT OUT', 35.00, '2026-01-01', 'Sibling discount: $30 per sibling'),
('CRR', 'CLINIC', 25.00, '2026-01-01', 'No discounts'),
('CRR', 'OPEN GYM', 10.00, '2026-01-01', 'No discounts');

-- Houston Gymnastics Academy (HGA)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('HGA', 'KIDS NIGHT OUT', 40.00, '2026-01-01', 'Sibling discount: $35 each for 2+ children'),
('HGA', 'CLINIC', 25.00, '2026-01-01', NULL),
('HGA', 'OPEN GYM', 20.00, '2026-01-01', NULL);

-- Rowland Ballard - Atascocita (RBA)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('RBA', 'KIDS NIGHT OUT', 35.00, '2026-01-01', 'No sibling discounts'),
('RBA', 'CLINIC', 25.00, '2026-01-01', 'No sibling discounts'),
('RBA', 'OPEN GYM', 20.00, '2026-01-01', 'No sibling discounts');

-- Rowland Ballard - Kingwood (RBK)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('RBK', 'KIDS NIGHT OUT', 35.00, '2026-01-01', 'Standard 2.5 hrs'),
('RBK', 'KIDS NIGHT OUT', 40.00, '2026-01-01', 'Extended 3 hrs - use duration_hours or notes to distinguish'),
('RBK', 'CLINIC', 25.00, '2026-01-01', NULL),
('RBK', 'OPEN GYM', 15.00, '2026-01-01', 'Also called Bonus Tumbling');

-- Estrella Gymnastics (EST)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('EST', 'KIDS NIGHT OUT', 40.00, '2026-01-01', NULL),
('EST', 'OPEN GYM', 35.00, '2026-01-01', NULL);
-- Note: EST has no Clinic pricing listed

-- Oasis Gymnastics (OAS)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('OAS', 'KIDS NIGHT OUT', 40.00, '2026-01-01', NULL),
('OAS', 'CLINIC', 25.00, '2026-01-01', NULL),
('OAS', 'OPEN GYM', 20.00, '2026-01-01', NULL);

-- Scottsdale Gymnastics (SGT)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('SGT', 'KIDS NIGHT OUT', 45.00, '2026-01-01', NULL),
('SGT', 'CLINIC', 25.00, '2026-01-01', NULL),
('SGT', 'OPEN GYM', 30.00, '2026-01-01', NULL);

-- TIGAR Gymnastics (TIG)
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('TIG', 'KIDS NIGHT OUT', 35.00, '2026-01-01', 'No sibling discounts'),
('TIG', 'CLINIC', 25.00, '2026-01-01', 'No sibling discounts'),
('TIG', 'OPEN GYM', 20.00, '2026-01-01', 'No sibling discounts');


-- ============================================
-- NEW PRICING EFFECTIVE MONDAY FEB 10, 2026
-- These will automatically become active on Monday
-- ============================================

-- First, end the old CLINIC and KNO prices on Feb 9
UPDATE event_pricing 
SET end_date = '2026-02-09'
WHERE event_type IN ('CLINIC', 'KIDS NIGHT OUT')
AND end_date IS NULL
AND gym_id IN ('CCP', 'CPF', 'CRR', 'EST', 'HGA', 'OAS', 'RBA', 'RBK', 'SGT', 'TIG');

-- Now insert the NEW prices effective Monday Feb 10, 2026

-- CCP: Clinic $35, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CCP', 'CLINIC', 35.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('CCP', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- CPF: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CPF', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('CPF', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- CRR: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CRR', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('CRR', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- EST: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('EST', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026 - NEW! EST now has clinics'),
('EST', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- HGA: Clinic $30, KNO $45
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('HGA', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('HGA', 'KIDS NIGHT OUT', 45.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- OAS: Clinic $30, KNO $45
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('OAS', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('OAS', 'KIDS NIGHT OUT', 45.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- RBA: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('RBA', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('RBA', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- RBK: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('RBK', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('RBK', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- SGT: Clinic $30, KNO $45
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('SGT', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('SGT', 'KIDS NIGHT OUT', 45.00, '2026-02-10', 'Price increase Feb 10, 2026');

-- TIG: Clinic $30, KNO $40
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('TIG', 'CLINIC', 30.00, '2026-02-10', 'Price increase Feb 10, 2026'),
('TIG', 'KIDS NIGHT OUT', 40.00, '2026-02-10', 'Price increase Feb 10, 2026');


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
