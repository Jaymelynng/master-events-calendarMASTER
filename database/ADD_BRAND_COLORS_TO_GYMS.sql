-- ============================================================================
-- ADD brand_colors COLUMN TO gyms
-- ============================================================================
-- Why: the Bulk Links feature renders each gym card with a gradient header
-- in that gym's actual brand colors. The colors lived in Bulk Link PRO's
-- `locations` table; this migration brings them into Calendar's `gyms` so
-- one DB owns the truth and any future tool can read them.
--
-- Format: text[]  (Postgres array of hex strings)
-- Convention: [primary, secondary, tertiary, white-or-light]
-- ============================================================================

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS brand_colors TEXT[];

-- Populate from BLP's locations.brand_colors (May 14, 2026 migration)
UPDATE gyms SET brand_colors = ARRAY['#1f53a3','#bf0a30','#d8d8d8','#ffffff'] WHERE id = 'CCP';
UPDATE gyms SET brand_colors = ARRAY['#1f53a3','#bf0a30','#d8d8d8','#ffffff'] WHERE id = 'CPF';
UPDATE gyms SET brand_colors = ARRAY['#ff1493','#c0c0c0','#ffffff','#3c3939'] WHERE id = 'CRR';
UPDATE gyms SET brand_colors = ARRAY['#011837','#666666','#100f0f','#ffffff'] WHERE id = 'EST';
UPDATE gyms SET brand_colors = ARRAY['#c91724','#262626','#d0d0d8','#ffffff'] WHERE id = 'HGA';
UPDATE gyms SET brand_colors = ARRAY['#3eb29f','#3e266b','#e7e6f0','#ffffff'] WHERE id = 'OAS';
UPDATE gyms SET brand_colors = ARRAY['#1a3c66','#c52928','#739ab9','#ffffff'] WHERE id = 'RBA';
UPDATE gyms SET brand_colors = ARRAY['#1a3c66','#c52928','#739ab9','#ffffff'] WHERE id = 'RBK';
UPDATE gyms SET brand_colors = ARRAY['#c72b12','#e6e6e6','#000000','#ffffff'] WHERE id = 'SGT';
UPDATE gyms SET brand_colors = ARRAY['#f57f20','#0a3651','#7fc4e0','#ffffff'] WHERE id = 'TIG';
