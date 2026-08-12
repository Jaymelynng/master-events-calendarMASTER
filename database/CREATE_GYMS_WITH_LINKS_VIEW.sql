-- ============================================================================
-- gyms_with_links VIEW
-- ============================================================================
-- Single source of truth for "gym info" — combines the `gyms` table (boring
-- identity + Calendar-managed columns) with live editable fields stored in
-- `bulk_field_values` (Phone, Email, Address, Website, Google Maps), which
-- are managed via the 📦 Bulk Links tab in the React app.
--
-- Why a VIEW (not a column copy):
--   - No data duplication. Edits in Bulk Links UI are visible immediately.
--   - Other tools (email cloner, future agents) can SELECT from this view
--     using familiar column names and get live values.
--   - To "switch off" the view: DROP VIEW gyms_with_links; — nothing else
--     in the database changes.
--
-- Created: May 18, 2026
-- ============================================================================

CREATE OR REPLACE VIEW gyms_with_links AS
SELECT
  g.id, g.name, g.location, g.manager, g.iclass_slug, g.logo_url,
  g.brand_colors, g.manager_name, g.manager_email,
  g.created_at, g.updated_at,
  -- These 5 prefer bulk_field_values, fall back to whatever's on gyms
  COALESCE(v.phone,   g.phone)           AS phone,
  COALESCE(v.email,   g.email)           AS email,
  COALESCE(v.address, g.address)         AS address,
  COALESCE(v.website, g.website_url)     AS website_url,
  COALESCE(v.gmaps,   g.google_maps_url) AS google_maps_url
FROM gyms g
LEFT JOIN (
  SELECT
    fv.gym_id,
    MAX(CASE WHEN f.label = 'Phone'       THEN fv.value END) AS phone,
    MAX(CASE WHEN f.label = 'Email'
             THEN regexp_replace(fv.value, '^mailto:', '', 'i') END) AS email,
    MAX(CASE WHEN f.label = 'Address'     THEN fv.value END) AS address,
    MAX(CASE WHEN f.label = 'Website'     THEN fv.value END) AS website,
    MAX(CASE WHEN f.label = 'Google Maps' THEN fv.value END) AS gmaps
  FROM bulk_fields f
  JOIN bulk_field_values fv ON fv.field_id = f.id
  WHERE f.label IN ('Phone','Email','Address','Website','Google Maps')
    AND fv.status = 'active'
  GROUP BY fv.gym_id
) v ON v.gym_id = g.id;

GRANT SELECT ON gyms_with_links TO anon, authenticated;
