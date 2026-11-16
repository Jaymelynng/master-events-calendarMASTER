-- Every camp sign-up, read signed-in and read-only by automation/camp_setup_reader.py (Jayme 2026-11-16: "Yes, add it",
-- after her Tigar recording showed POST /api/v1/camps/{id}/enrollment-details/ {"recordId": id} - the camp screen's own
-- sign-up list). One row per enrollment, the reply kept WHOLE except studentName (children's names never stored in this
-- database; names come with the Data Center's enrollment home).
-- Nothing is deleted: a sign-up iClass no longer lists for a camp that was read gets gone_from_iclass_at (a drop).
-- The table is NOT readable by the public key (it holds student / family ids and ages). The shared /camps page reads only
-- totals, through iclass_camp_signup_totals (per camp) and camp_signup_kids() (different kids across a set of camps).
create table if not exists public.iclass_camp_enrollments (
  gym_id text not null references public.gyms(id),
  enrollment_id bigint not null,
  camp_id bigint not null,
  student_id bigint,
  family_id bigint,
  enrollment_status text,
  enrollment_type text,
  approved boolean,
  block_count int,
  created_date timestamptz,
  raw jsonb,
  read_at timestamptz not null,
  gone_from_iclass_at timestamptz,
  primary key (gym_id, enrollment_id)
);
create index if not exists iclass_camp_enrollments_camp on public.iclass_camp_enrollments (gym_id, camp_id);
comment on table public.iclass_camp_enrollments is
  'Every camp sign-up from POST /api/v1/camps/{id}/enrollment-details/ (signed-in, read-only), one row per enrollment, raw = the reply row WITHOUT studentName. block_count = days booked. gone_from_iclass_at = iClass stopped listing it (a drop); never deleted. Not public: the page reads iclass_camp_signup_totals + camp_signup_kids(). SQL: database/ADD_ICLASS_CAMP_ENROLLMENTS.sql';
alter table public.iclass_camp_enrollments enable row level security;   -- no public policy: service key only

-- Per camp: sign-ups by type, different kids, days booked. Only rows iClass still lists.
create or replace view public.iclass_camp_signup_totals as
select gym_id, camp_id,
       count(*) filter (where enrollment_type = 'ACTIVE') as active_signups,
       count(*) filter (where enrollment_type is distinct from 'ACTIVE') as other_signups,
       string_agg(distinct enrollment_type, ', ') filter (where enrollment_type is distinct from 'ACTIVE') as other_types,
       count(distinct student_id) filter (where enrollment_type = 'ACTIVE') as active_kids,
       coalesce(sum(block_count) filter (where enrollment_type = 'ACTIVE'), 0) as active_days_booked,
       max(read_at) as read_at
from public.iclass_camp_enrollments
where gone_from_iclass_at is null
group by gym_id, camp_id;
comment on view public.iclass_camp_signup_totals is
  'Per camp totals of iclass_camp_enrollments (still listed rows): active_signups (enrollment_type ACTIVE), other_signups + other_types (any other type, shown by name), active_kids (different student ids), active_days_booked (block_count added). Counts only - no ids. Read by Admin > Camp Data and /camps.';
grant select on public.iclass_camp_signup_totals to anon, authenticated;

-- Different kids with an ACTIVE sign-up across a set of camps (e.g. a gym's summer camps). Returns a count only.
create or replace function public.camp_signup_kids(p_gym text, p_camp_ids bigint[])
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct student_id)::int from public.iclass_camp_enrollments
  where gym_id = p_gym and camp_id = any(p_camp_ids) and enrollment_type = 'ACTIVE' and gone_from_iclass_at is null
$$;
comment on function public.camp_signup_kids(text, bigint[]) is
  'Count of different kids (student ids) with an ACTIVE, still-listed sign-up in the given camps of one gym. Count only, no ids. Used by Admin > Camp Data / camps page.';
grant execute on function public.camp_signup_kids(text, bigint[]) to anon, authenticated;

-- When each camp's sign-up list was last read (null = not read: the page shows the busiest-day count instead)
alter table public.iclass_camp_setup add column if not exists signups_read_at timestamptz;
comment on column public.iclass_camp_setup.signups_read_at is 'When this camp''s sign-up list (iclass_camp_enrollments) was last read; null = not read (the page then shows the busiest-day count instead). Set by camp_setup_reader.save.';
