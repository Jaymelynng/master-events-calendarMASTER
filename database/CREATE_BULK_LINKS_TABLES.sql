-- ============================================================================
-- BULK LINKS TABLES — Migrated from Bulk Link PRO into Calendar's Supabase
-- ============================================================================
-- This is the "Phase 1" of consolidating Bulk Link PRO into Calendar.
-- After this runs:
--   - Calendar's Supabase holds all Bulk Link PRO page/section/field data
--   - Bulk Link PRO's old Supabase project becomes read-only / retired
--   - Calendar gets a new top-level tab: 📦 Bulk Links
--
-- Schema mirrors BLP's v2 structure but is namespaced with `bulk_` so it
-- never collides with Calendar's existing tables (notably `gym_links` which
-- has a different schema on the Calendar side).
--
-- Locations are NOT re-created — we re-use Calendar's existing `gyms` table
-- since the gym IDs are identical (CCP, CPF, CRR, RBA, RBK, HGA, EST, OAS,
-- SGT, TIG). This avoids any sync drift.
--
-- Run order: this file once, then run the data migration script separately.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. bulk_pages — top-level navigation tabs for the Bulk Links section
-- ----------------------------------------------------------------------------
-- Each row = a tab in the Bulk Links UI (e.g. "General Links", "Summer Camp",
-- "Program Links", "Active Campaign"). Adding a new row = new tab, no code.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  emoji TEXT,
  active_color TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
  display_order INTEGER NOT NULL DEFAULT 0,
  component_override TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_pages_status_order
  ON bulk_pages(status, display_order);

-- ----------------------------------------------------------------------------
-- 2. bulk_sections — grouping headers within a page
-- ----------------------------------------------------------------------------
-- e.g. "GYM INFO", "SOCIAL MEDIA", "ICLASS — PORTAL"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES bulk_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_sections_page_order
  ON bulk_sections(page_id, display_order);

-- ----------------------------------------------------------------------------
-- 3. bulk_fields — individual rows within a section
-- ----------------------------------------------------------------------------
-- e.g. "Phone", "Website", "Member Login", "Full Day Daily"
-- field_type controls how the value is rendered/interacted with.
-- allow_copy / allow_open control whether this field participates in
-- the bulk copy/open actions at the top of the page.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES bulk_sections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  emoji TEXT,
  field_type TEXT NOT NULL DEFAULT 'link'
    CHECK (field_type IN ('link', 'text', 'email', 'phone')),
  display_order INTEGER NOT NULL DEFAULT 0,
  allow_copy BOOLEAN NOT NULL DEFAULT TRUE,
  allow_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_fields_section_order
  ON bulk_fields(section_id, display_order);

-- ----------------------------------------------------------------------------
-- 4. bulk_field_values — the actual per-gym values
-- ----------------------------------------------------------------------------
-- One row per (field × gym). A field can have multiple rows per gym for
-- multi-value fields (e.g. camp weeks with dates). status='active' is the
-- normal state; 'N/A' is a deliberate "this gym doesn't have this".
--
-- gym_id is TEXT (not FK) so it never blocks bulk imports if a gym row is
-- temporarily missing. Joined to gyms.id at read time in the UI.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES bulk_fields(id) ON DELETE CASCADE,
  gym_id TEXT NOT NULL,
  value TEXT,
  label TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_field_values_field_gym
  ON bulk_field_values(field_id, gym_id);
CREATE INDEX IF NOT EXISTS idx_bulk_field_values_gym
  ON bulk_field_values(gym_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers (mirrors Calendar's existing pattern)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bulk_pages_updated_at ON bulk_pages;
CREATE TRIGGER trg_bulk_pages_updated_at
  BEFORE UPDATE ON bulk_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bulk_field_values_updated_at ON bulk_field_values;
CREATE TRIGGER trg_bulk_field_values_updated_at
  BEFORE UPDATE ON bulk_field_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security — public read, anon write
-- (Matches Calendar's existing posture. Tighten before SaaS rollout.)
-- ----------------------------------------------------------------------------
ALTER TABLE bulk_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk_pages_all" ON bulk_pages;
CREATE POLICY "bulk_pages_all" ON bulk_pages
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bulk_sections_all" ON bulk_sections;
CREATE POLICY "bulk_sections_all" ON bulk_sections
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bulk_fields_all" ON bulk_fields;
CREATE POLICY "bulk_fields_all" ON bulk_fields
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bulk_field_values_all" ON bulk_field_values;
CREATE POLICY "bulk_field_values_all" ON bulk_field_values
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON bulk_pages TO anon, authenticated;
GRANT ALL ON bulk_sections TO anon, authenticated;
GRANT ALL ON bulk_fields TO anon, authenticated;
GRANT ALL ON bulk_field_values TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Seed: 4 default pages matching BLP's current tabs
-- ----------------------------------------------------------------------------
INSERT INTO bulk_pages (slug, title, emoji, active_color, display_order)
VALUES
  ('general-links',   'General Links',   '📋', '#b48f8f', 0),
  ('summer-camp',     'Summer Camp',     '🟠', '#d4a574', 1),
  ('program-links',   'Programs',        '📚', '#8b6f9b', 2),
  ('active-campaign', 'Active Campaign', '📧', '#8b7355', 3)
ON CONFLICT (slug) DO NOTHING;

-- Active Campaign uses a custom component (multi-account opener with session manager)
UPDATE bulk_pages
   SET component_override = 'ActiveCampaign'
 WHERE slug = 'active-campaign';
