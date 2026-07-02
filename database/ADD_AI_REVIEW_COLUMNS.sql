-- ============================================================================
-- AI EVENT REVIEW columns — added July 1, 2026 (already applied to Supabase
-- as migration add_ai_review_flags_columns; this file is the repo record).
-- ============================================================================
-- Claude reviews new/changed upcoming events like a gymnastics-literate human
-- (title vs description vs iClass settings) and writes suggestion flags HERE.
-- NEVER into validation_errors — sync owns that column and overwrites it.
-- Procedure/contract: docs/OPERATIONS/AI_EVENT_REVIEW.md
-- Flag shape: {type:'ai_review', severity:'warning', category:'ai_review',
--              message, reason, flagged_at}  (message = dismiss key)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ai_review_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;
ALTER TABLE events_archive
  ADD COLUMN IF NOT EXISTS ai_review_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

-- events_with_gym view: both new columns are appended at the END of the
-- column list (CREATE OR REPLACE VIEW requirement) on both the events and
-- events_archive halves of the UNION. See migration
-- add_ai_review_flags_columns in Supabase for the full view definition.
