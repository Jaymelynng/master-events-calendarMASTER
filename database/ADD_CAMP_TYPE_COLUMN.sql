-- ============================================================================
-- ADD camp_type COLUMN — the iClass "Camp Type" (booking category) per event
-- ============================================================================
-- Aug 3, 2026. iClass has TWO independent fields on a camp:
--   • Camp Type (aka booking category, e.g. "SCHOOL YEAR CAMP - FULL DAY") —
--     this is what decides which SECTION families browse it under.
--   • Program (program_name, e.g. "SUMMER CAMP") — a separate back-end grouping.
-- They can disagree (real case: SGT Fall Break camps have Camp Type =
-- School Year but Program = Summer). The section follows Camp Type, so Camp
-- Type is the reliable "what kind of camp is this" signal — the calendar
-- colors by it, and a Camp-Type-vs-Program mismatch becomes a catch.
--
-- Additive + safe: new nullable column on events + events_archive, exposed in
-- events_with_gym. Nothing existing changes. Mirrors the program_name pattern.
-- ============================================================================

ALTER TABLE public.events         ADD COLUMN IF NOT EXISTS camp_type text;
ALTER TABLE public.events_archive ADD COLUMN IF NOT EXISTS camp_type text;

-- Recreate the read view with camp_type exposed (added right after program_name
-- in BOTH halves of the UNION so column positions line up).
CREATE OR REPLACE VIEW public.events_with_gym AS
 SELECT e.id, e.gym_id, e.title, e.date, e."time", e.price, e.type, e.event_url,
    e.day_of_week, e.start_date, e.end_date, e.description, e.age_min, e.age_max,
    e.deleted_at, e.created_at, e.updated_at, e.availability_status, e.has_flyer,
    e.flyer_url, e.description_status, e.validation_errors, e.acknowledged_errors,
    e.verified_errors, e.has_openings, e.openings, e.openings_display,
    e.show_openings, e.allow_choose_days, e.type_id, e.program_name,
    e.registration_start_date, e.registration_end_date,
    g.name AS gym_name, g.id AS gym_code,
    sl.last_synced AS last_synced_at, sl.events_found AS sync_events_found,
    sl.events_imported AS sync_events_imported,
    e.ai_review_flags, e.ai_reviewed_at, e.daily_schedule, e.camp_type
   FROM events e
     LEFT JOIN gyms g ON e.gym_id::text = g.id::text
     LEFT JOIN sync_log sl ON sl.gym_id = e.gym_id::text AND sl.event_type = e.type::text
  WHERE e.deleted_at IS NULL
UNION ALL
 SELECT a.id, a.gym_id, a.title, a.date, a."time", a.price, a.type, a.event_url,
    a.day_of_week, a.start_date, a.end_date, a.description, a.age_min, a.age_max,
    a.deleted_at, a.created_at, a.updated_at, a.availability_status, a.has_flyer,
    a.flyer_url, a.description_status, a.validation_errors, a.acknowledged_errors,
    a.verified_errors, a.has_openings, a.openings, a.openings_display,
    a.show_openings, a.allow_choose_days, a.type_id, a.program_name,
    a.registration_start_date, a.registration_end_date,
    g.name AS gym_name, g.id AS gym_code,
    sl.last_synced AS last_synced_at, sl.events_found AS sync_events_found,
    sl.events_imported AS sync_events_imported,
    a.ai_review_flags, a.ai_reviewed_at, a.daily_schedule, a.camp_type
   FROM events_archive a
     LEFT JOIN gyms g ON a.gym_id = g.id::text
     LEFT JOIN sync_log sl ON sl.gym_id = a.gym_id AND sl.event_type = a.type;
