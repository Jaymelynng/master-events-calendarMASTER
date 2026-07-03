-- ============================================================================
-- DAILY SCHEDULE column — added July 2, 2026 (already applied to Supabase as
-- migration add_daily_schedule_column; this file is the repo record).
-- ============================================================================
-- Sync historically kept only the FIRST day's hours (schedule[0]) in the
-- `time` column. A camp can have a different start/duration per weekday — real
-- case: a SGT "Half Day" camp where Monday was mis-set to a 1-hour block
-- (9-10 AM) while Tue-Fri ran 3 hours (9-12). A wrong day beyond Monday was
-- invisible. This column keeps the WHOLE per-day array so the side panel shows
-- every day and the AI review can flag a single day that doesn't match its
-- siblings.
--
-- Shape: jsonb array of {day, start_time, end_time, duration}.
-- ADDITIVE ONLY — `time` is unchanged (still the first day); nothing existing
-- shifted. Captured in f12_collect_and_import.py (step 4b), allowlisted in
-- local_api_server.py, persisted through SyncModal.js (4 write spots),
-- displayed in EventDetailPanel.js, exported in ExportModal.js.

ALTER TABLE events         ADD COLUMN IF NOT EXISTS daily_schedule jsonb;
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS daily_schedule jsonb;

-- events_with_gym view: daily_schedule appended at the END of the column list
-- (CREATE OR REPLACE VIEW requirement) on both halves of the UNION. See
-- migration add_daily_schedule_column in Supabase for the full view definition.
