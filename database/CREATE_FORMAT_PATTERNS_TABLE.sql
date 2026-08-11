-- ============================================================================
-- FORMAT PATTERNS TABLE — UI-managed catalog of recognized formats
-- ============================================================================
-- Each row = one format the validation engine knows how to recognize in
-- manager-written titles and descriptions. Examples:
--   - Date formats:  "5/20/26", "May 20th 2026", "5.20.2026"
--   - Time formats:  "9am", "9:00am", "9-3"
--   - Price formats: "$25", "$25/day"
--   - Age formats:   "Ages 5+", "5-12"
--   - Program names: "Kids Night Out", "KNO", "Open Gym"
--   - Skills:        "cartwheel", "back handspring"
--
-- Before this table existed, every format the engine recognized lived
-- INSIDE Python functions in automation/validation_engine.py — invisible
-- to the admin UI, editable only by changing code.
--
-- After this table exists:
--   - Every recognized format is one row Jayme can see and edit
--   - Adding a new format = one row insert (UI: + New Pattern button)
--   - Engine reads from this table; falls back to hardcoded regex if
--     the table is empty (safety net during transition)
--
-- Created: May 20, 2026
-- ============================================================================

-- Define the updated_at helper if it doesn't already exist (was missing from
-- a fresh Supabase deploy; safe to recreate)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS format_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- What KIND of format this recognizes
  category TEXT NOT NULL CHECK (category IN (
    'date', 'time', 'price', 'age', 'program', 'skill'
  )),

  -- Short identifier (e.g. 'iso_date', 'slash_short_year', 'kids_night_out')
  name TEXT NOT NULL,

  -- The actual pattern. Interpretation depends on match_type.
  pattern TEXT NOT NULL,

  -- How to interpret the pattern:
  --   'regex'   — pattern is a Python-style regular expression
  --   'keyword' — pattern is a literal substring (case-insensitive match)
  match_type TEXT NOT NULL DEFAULT 'regex' CHECK (match_type IN ('regex', 'keyword')),

  -- Plain-English explanation for the UI
  example TEXT,          -- e.g. "5/20/26"
  description TEXT,      -- e.g. "Slash-separated date with 2-digit year"

  -- Whether the engine should actively use this pattern
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Scoping (mirrors the existing rules table)
  gym_ids TEXT[] NOT NULL DEFAULT '{ALL}',  -- global or per-gym
  program TEXT NOT NULL DEFAULT 'ALL',       -- ALL or specific program type

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'manual',

  -- Same (category, name) pair shouldn't repeat
  UNIQUE(category, name)
);

CREATE INDEX IF NOT EXISTS idx_format_patterns_category
  ON format_patterns(category);
CREATE INDEX IF NOT EXISTS idx_format_patterns_active_category
  ON format_patterns(category, is_active);

-- Auto-update timestamp on edits (reuses existing helper function)
DROP TRIGGER IF EXISTS trg_format_patterns_updated_at ON format_patterns;
CREATE TRIGGER trg_format_patterns_updated_at
  BEFORE UPDATE ON format_patterns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security — public read+write (mirrors existing rules table posture)
ALTER TABLE format_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "format_patterns_all" ON format_patterns;
CREATE POLICY "format_patterns_all" ON format_patterns
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON format_patterns TO anon, authenticated;

-- ============================================================================
-- SEED DATA — every format pattern from real-data research (May 20, 2026)
-- ============================================================================

-- ─── DATE CATEGORY ────────────────────────────────────────────────────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, created_by) VALUES
  ('date', 'four_digit_year',     '\b(20\d{2})\b',                              'regex',   '2026',           '4-digit year starting with 20 (current behavior)',                       'seed'),
  ('date', 'slash_short_year',    '\b\d{1,2}/\d{1,2}/\d{2}\b',                  'regex',   '5/20/26',        'M/D/YY with 2-digit year (slash separator)',                              'seed'),
  ('date', 'slash_full_year',     '\b\d{1,2}/\d{1,2}/\d{4}\b',                  'regex',   '5/20/2026',      'M/D/YYYY with 4-digit year (slash separator)',                            'seed'),
  ('date', 'dot_short_year',      '\b\d{1,2}\.\d{1,2}\.\d{2}\b',                'regex',   '5.20.26',        'M.D.YY with 2-digit year (dot separator)',                                'seed'),
  ('date', 'dot_full_year',       '\b\d{1,2}\.\d{1,2}\.\d{4}\b',                'regex',   '5.20.2026',      'M.D.YYYY with 4-digit year (dot separator)',                              'seed'),
  ('date', 'month_name_day_year', '(?i)(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}', 'regex', 'May 20th, 2026', 'Full month name + day (with optional ordinal) + 4-digit year', 'seed'),
  ('date', 'month_abbrev_day',    '(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?\b', 'regex', 'May 20th', 'Month abbreviation + day (with optional ordinal)', 'seed'),
  ('date', 'iso_date',            '\d{4}-\d{2}-\d{2}',                          'regex',   '2026-05-20',     'ISO format YYYY-MM-DD',                                                   'seed');

-- ─── TIME CATEGORY ────────────────────────────────────────────────────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, created_by) VALUES
  ('time', 'hour_min_ampm',       '(?i)\d{1,2}:\d{2}\s*(am|pm|a\.m\.|p\.m\.)',  'regex',   '9:00am',         'Hour:minutes with am/pm marker',                                           'seed'),
  ('time', 'hour_ampm',           '(?i)\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)',        'regex',   '9am',            'Hour only with am/pm marker',                                              'seed'),
  ('time', 'hour_short_ampm',     '(?i)\d{1,2}(?::\d{2})?\s*[ap]\b',            'regex',   '9a, 9p, 9:30a',  'Hour with single-letter a/p (TIG-style)',                                  'seed'),
  ('time', 'time_range_ampm',     '(?i)\d{1,2}(?::\d{2})?\s*(am|pm)\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(am|pm)', 'regex', '9am-3pm', 'Full time range with am/pm on both sides', 'seed'),
  ('time', 'time_range_no_ampm',  '\b\d{1,2}\s*[-–]\s*\d{1,2}\b',               'regex',   '9-3 (no am/pm)', 'Bare hour-to-hour range (no am/pm marker) — needs context check',          'seed'),
  ('time', 'time_range_colon',    '\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}',       'regex',   '9:00-5:00',      'Time range with colons but no am/pm',                                     'seed'),
  ('time', 'noon_midnight',       '(?i)\b(noon|midnight)\b',                    'regex',   'noon',           'Word-based time',                                                          'seed');

-- ─── PRICE CATEGORY ───────────────────────────────────────────────────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, created_by) VALUES
  ('price', 'dollar_int',         '\$\d+\b',                                    'regex',   '$25',            'Dollar sign + integer',                                                    'seed'),
  ('price', 'dollar_decimal',     '\$\d+\.\d{2}',                               'regex',   '$25.00',         'Dollar sign + decimal (with cents)',                                       'seed'),
  ('price', 'dollar_per_unit',    '(?i)\$\d+(?:\.\d{2})?\s*/?\s*(day|week|child|kid|hour|class)', 'regex', '$25/day', 'Dollar amount with per-unit suffix', 'seed'),
  ('price', 'dollar_for_unit',    '(?i)\$\d+(?:\.\d{2})?\s+(for|per)\s+(the\s+)?(day|week|child|kid|hour|class)', 'regex', '$25 for the week', 'Dollar amount followed by "for/per" unit', 'seed');

-- ─── AGE CATEGORY ─────────────────────────────────────────────────────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, created_by) VALUES
  ('age', 'age_plus',             '(?i)ages?\s*\d{1,2}\s*\+',                   'regex',   'Ages 5+',        'Ages X+ (open-ended upper bound)',                                         'seed'),
  ('age', 'age_range_dash',       '(?i)ages?\s*\d{1,2}\s*[-–]\s*\d{1,2}',       'regex',   'Ages 5-12',      'Ages X-Y (dash or en-dash)',                                               'seed'),
  ('age', 'age_range_to',         '(?i)ages?\s*\d{1,2}\s*to\s*\d{1,2}',         'regex',   'Ages 5 to 12',   'Ages X to Y',                                                              'seed'),
  ('age', 'age_years_old',        '(?i)\b\d{1,2}\s*(years?|yrs?)\s*(old)?',     'regex',   '5 years old',    'Number + years/yrs (with optional "old")',                                'seed'),
  ('age', 'age_bare_range',       '\b\d{1,2}\s*[-–]\s*\d{1,2}\b',               'regex',   '5-12',           'Bare number range (needs context — could be ages or hours)',               'seed');

-- ─── PROGRAM CATEGORY (keyword matches) ──────────────────────────────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, program, created_by) VALUES
  ('program', 'kids_night_out',   'kids night out',          'keyword', 'Kids Night Out',     'Standard KNO name',                       'KIDS NIGHT OUT', 'seed'),
  ('program', 'kno_abbrev',       'kno',                     'keyword', 'KNO',                'Abbreviation',                            'KIDS NIGHT OUT', 'seed'),
  ('program', 'kids_apostrophe',  'kid''s night out',        'keyword', 'Kid''s Night Out',   'Apostrophe variant (singular possessive)','KIDS NIGHT OUT', 'seed'),
  ('program', 'kids_apostrophe2', 'kids'' night out',        'keyword', 'Kids'' Night Out',   'Apostrophe variant (plural possessive)',  'KIDS NIGHT OUT', 'seed'),
  ('program', 'parents_night',    'parents night out',       'keyword', 'Parents Night Out',  'Parents NO variant',                      'KIDS NIGHT OUT', 'seed'),
  ('program', 'ninja_night',      'ninja night out',         'keyword', 'Ninja Night Out',    'Theme-named variant',                     'KIDS NIGHT OUT', 'seed'),
  ('program', 'night_out_short',  'night out',               'keyword', 'Night Out',          'Short version (KNO with theme prefix)',   'KIDS NIGHT OUT', 'seed'),
  ('program', 'clinic_word',      'clinic',                  'keyword', 'Clinic',             'Standard clinic',                         'CLINIC',         'seed'),
  ('program', 'skill_clinic',     'skill clinic',            'keyword', 'Skill Clinic',       'iClass section name',                     'CLINIC',         'seed'),
  ('program', 'workshop',         'workshop',                'keyword', 'Workshop',           'Workshop (alternate clinic name)',        'CLINIC',         'seed'),
  ('program', 'open_gym',         'open gym',                'keyword', 'Open Gym',           'Standard open gym',                       'OPEN GYM',       'seed'),
  ('program', 'open_workout',     'open workout',            'keyword', 'Open Workout',       'CCP variant',                             'OPEN GYM',       'seed'),
  ('program', 'gym_fun_friday',   'gym fun friday',          'keyword', 'Gym Fun Friday',     'CCP/CPF/CRR open gym variant',            'OPEN GYM',       'seed'),
  ('program', 'fun_gym',          'fun gym',                 'keyword', 'Fun Gym',            'Open gym variant',                        'OPEN GYM',       'seed'),
  ('program', 'preschool_fun',    'preschool fun',           'keyword', 'Preschool Fun',      'Preschool open gym',                      'OPEN GYM',       'seed'),
  ('program', 'camp_word',        'camp',                    'keyword', 'Camp',               'Standard camp',                           'CAMP',           'seed'),
  ('program', 'summer_camp',      'summer camp',             'keyword', 'Summer Camp',        'Seasonal camp variant',                   'CAMP',           'seed'),
  ('program', 'half_day_camp',    'half day camp',           'keyword', 'Half Day Camp',      'Half-day variant',                        'CAMP',           'seed'),
  ('program', 'full_day_camp',    'full day camp',           'keyword', 'Full Day Camp',      'Full-day variant',                        'CAMP',           'seed');

-- ─── SKILL CATEGORY (keyword matches — all from real clinic data) ────────
INSERT INTO format_patterns (category, name, pattern, match_type, example, description, program, created_by) VALUES
  ('skill', 'cartwheel',          'cartwheel',          'keyword', 'Cartwheel',          'Cartwheel skill',                'CLINIC', 'seed'),
  ('skill', 'back_handspring',    'back handspring',    'keyword', 'Back Handspring',    'BHS — back handspring',          'CLINIC', 'seed'),
  ('skill', 'backhandspring',     'backhandspring',     'keyword', 'Backhandspring',     'BHS one-word variant',           'CLINIC', 'seed'),
  ('skill', 'handstand',          'handstand',          'keyword', 'Handstand',          'Handstand skill',                'CLINIC', 'seed'),
  ('skill', 'tumbling',           'tumbling',           'keyword', 'Tumbling',           'Generic tumbling',               'CLINIC', 'seed'),
  ('skill', 'pullover',           'pullover',           'keyword', 'Pullover',           'Bars — pullover',                'CLINIC', 'seed'),
  ('skill', 'roundoff',           'roundoff',           'keyword', 'Roundoff',           'Roundoff skill',                 'CLINIC', 'seed'),
  ('skill', 'round_off',          'round off',          'keyword', 'Round Off',          'Roundoff two-word variant',      'CLINIC', 'seed'),
  ('skill', 'bridge_kickover',    'bridge kickover',    'keyword', 'Bridge Kickover',    'Bridge + kickover combo',        'CLINIC', 'seed'),
  ('skill', 'kickover',           'kickover',           'keyword', 'Kickover',           'Kickover skill',                 'CLINIC', 'seed'),
  ('skill', 'back_walkover',      'back walkover',      'keyword', 'Back Walkover',      'BWO',                            'CLINIC', 'seed'),
  ('skill', 'front_walkover',     'front walkover',     'keyword', 'Front Walkover',     'FWO',                            'CLINIC', 'seed'),
  ('skill', 'walkover',           'walkover',           'keyword', 'Walkover',           'Generic walkover',               'CLINIC', 'seed'),
  ('skill', 'aerial',             'aerial',             'keyword', 'Aerial',             'Aerial cartwheel',               'CLINIC', 'seed'),
  ('skill', 'front_handspring',   'front handspring',   'keyword', 'Front Handspring',   'FHS',                            'CLINIC', 'seed'),
  ('skill', 'front_flip',         'front flip',         'keyword', 'Front Flip',         'Front flip',                     'CLINIC', 'seed'),
  ('skill', 'back_tuck',          'back tuck',          'keyword', 'Back Tuck',          'Back tuck',                      'CLINIC', 'seed'),
  ('skill', 'front_tuck',         'front tuck',         'keyword', 'Front Tuck',         'Front tuck',                     'CLINIC', 'seed'),
  ('skill', 'flip_flop',          'flip flop',          'keyword', 'Flip Flop',          'Flip flop (BHS slang)',          'CLINIC', 'seed'),
  ('skill', 'flip_flop_dash',     'flip-flop',          'keyword', 'Flip-Flop',          'Flip-flop hyphenated',           'CLINIC', 'seed'),
  ('skill', 'back_hip_circle',    'back hip circle',    'keyword', 'Back Hip Circle',    'Bars — BHC',                     'CLINIC', 'seed'),
  ('skill', 'cast',               'cast',               'keyword', 'Cast',               'Bars — cast',                    'CLINIC', 'seed'),
  ('skill', 'tap_swing',          'tap swing',          'keyword', 'Tap Swing',          'Bars — tap swing',               'CLINIC', 'seed'),
  ('skill', 'front_support',      'front support',      'keyword', 'Front Support',      'Bars — front support',           'CLINIC', 'seed'),
  ('skill', 'pivot_turn',         'pivot turn',         'keyword', 'Pivot Turn',         'Beam — pivot turn',              'CLINIC', 'seed'),
  ('skill', 'backward_roll',      'backward roll',      'keyword', 'Backward Roll',      'Backward roll',                  'CLINIC', 'seed'),
  ('skill', 'backbend',           'backbend',           'keyword', 'Backbend',           'Backbend',                       'CLINIC', 'seed'),
  ('skill', 'bridge',             'bridge',             'keyword', 'Bridge',             'Bridge position',                'CLINIC', 'seed'),
  ('skill', 'tumbltrak',          'tumbltrak',          'keyword', 'TumblTrak',          'TumblTrak apparatus',            'CLINIC', 'seed'),
  ('skill', 'trampoline',         'trampoline',         'keyword', 'Trampoline',         'Trampoline apparatus',           'CLINIC', 'seed'),
  ('skill', 'bars_apparatus',     'bars',               'keyword', 'Bars',               'Bars apparatus',                 'CLINIC', 'seed'),
  ('skill', 'beam_apparatus',     'beam',               'keyword', 'Beam',               'Beam apparatus',                 'CLINIC', 'seed'),
  ('skill', 'floor_apparatus',    'floor',              'keyword', 'Floor',              'Floor apparatus',                'CLINIC', 'seed'),
  ('skill', 'vault_apparatus',    'vault',              'keyword', 'Vault',              'Vault apparatus',                'CLINIC', 'seed'),
  ('skill', 'ninja',              'ninja',              'keyword', 'Ninja',              'Ninja program / discipline',     'CLINIC', 'seed'),
  ('skill', 'cheer',              'cheer',              'keyword', 'Cheer',              'Cheer discipline',               'CLINIC', 'seed'),
  ('skill', 'cheer_prep',         'cheer prep',         'keyword', 'Cheer Prep',         'Cheer preparation',              'CLINIC', 'seed'),
  ('skill', 'dance',              'dance',              'keyword', 'Dance',              'Dance',                          'CLINIC', 'seed'),
  ('skill', 'flexibility',        'flexibility',        'keyword', 'Flexibility',        'Flexibility / stretching',       'CLINIC', 'seed'),
  ('skill', 'stretching',         'stretching',         'keyword', 'Stretching',         'Stretching',                     'CLINIC', 'seed'),
  ('skill', 'strength',           'strength',           'keyword', 'Strength',           'Strength training',              'CLINIC', 'seed'),
  ('skill', 'conditioning',       'conditioning',       'keyword', 'Conditioning',       'Conditioning',                   'CLINIC', 'seed');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT category, COUNT(*) FROM format_patterns GROUP BY category ORDER BY category;
-- Expected:
--   age     —  5
--   date    —  8
--   price   —  4
--   program — 19
--   skill   — 41
--   time    —  7
--
-- SELECT category, name, pattern, example FROM format_patterns ORDER BY category, name;
-- ============================================================================
