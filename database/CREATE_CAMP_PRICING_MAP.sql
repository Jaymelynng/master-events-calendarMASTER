-- camp_pricing_map: direct ID bridge (portal camp -> iClass pricing schedule)
-- Populated by automation/populate_camp_pricing_map.py from /api/v1/camps detail.
-- Does not replace or reference legacy camp_pricing / event_pricing workaround tables.

CREATE TABLE IF NOT EXISTS public.camp_pricing_map (
  camp_id BIGINT NOT NULL,
  gym_slug TEXT NOT NULL,
  pricing_schedule_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (camp_id, gym_slug)
);

CREATE INDEX IF NOT EXISTS idx_camp_pricing_map_gym_slug
  ON public.camp_pricing_map (gym_slug);

CREATE INDEX IF NOT EXISTS idx_camp_pricing_map_pricing_schedule_id
  ON public.camp_pricing_map (pricing_schedule_id);

COMMENT ON TABLE public.camp_pricing_map IS
  'Maps iClassPro camp id (per org) to pricing_schedule_id from authenticated /api/v1/camps/{id} detail.';

COMMENT ON COLUMN public.camp_pricing_map.camp_id IS
  'Camp id from iClassPro backend (same id used in portal camp detail URLs / open API).';

COMMENT ON COLUMN public.camp_pricing_map.gym_slug IS
  'Portal iclass_slug for the gym (e.g. oasisgymnastics).';

COMMENT ON COLUMN public.camp_pricing_map.pricing_schedule_id IS
  'pricingScheduleId from camp detail JSON — joins to pricing_schedules.schedule_id for that gym.';
