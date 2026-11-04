-- Signed-in (staff-side) camp setup + price tables, read ONLY from iClass.
-- Built 2026-11-04. Jayme: "forget the old pricing rules that didnt work ... customize it to pull in
-- the data now the way u know u can get it so the pricing table in supabase will be designed around this"
--
-- Shape proven on her CCP recording 2026-11-04 (1,036 camps, 41 price tables):
--   GET /api/v1/camps/               -> every camp id (hidden ones too); most settings come back BLANK here
--   GET /api/v1/camps/{id}           -> the whole camp setup (show on web, registration, max, price table id, days)
--   GET /api/v1/get-camp-occupancy/{id} -> per day: occ, occwait, requests, pending, open
--   GET /api/v1/pricing-schedules/   -> every price table: tableCells[][] of {studentEnum = child #, blockEnum = # of days, amount}
-- Rule: store each reply WHOLE in raw; meaning is defined after, in the views below.

create table if not exists public.iclass_setup_reads (
  id bigserial primary key,
  gym_id text not null references public.gyms(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'ok', 'no_login', 'sign_in_failed', 'stopped')),
  camps_listed int,
  camps_read int,
  price_tables_read int,
  note text
);
comment on table public.iclass_setup_reads is
  'One row per gym per signed-in iClass setup read. status ok = this gym''s camp setup + price tables were read at finished_at. Any other status = NOT READ: setup checks must show "setup not read" for that gym, never "no errors".';

create table if not exists public.iclass_price_tables (
  gym_id text not null references public.gyms(id),
  price_table_id int not null,
  name text,
  raw jsonb not null,
  read_at timestamptz not null,
  primary key (gym_id, price_table_id)
);
comment on table public.iclass_price_tables is
  'Every iClass price table (pricing schedule) at a gym, exactly as GET /api/v1/pricing-schedules/ sends it (raw = the whole object). Read by the signed-in setup read. Use view iclass_price_cells for days x child -> amount. Replaces the old camp_pricing / event_pricing tables.';

create table if not exists public.iclass_camp_setup (
  gym_id text not null references public.gyms(id),
  camp_id bigint not null,
  raw jsonb not null,
  occupancy jsonb,
  read_at timestamptz not null,
  primary key (gym_id, camp_id)
);
comment on table public.iclass_camp_setup is
  'Every camp that has not ended, hidden ones included, exactly as iClass sends it to a signed-in staff read: raw = GET /api/v1/camps/{id} data (showOnWeb, allowWebRegistration, registration dates, maxStudent, pricingScheduleId, schedule, blocks, description, image ...), occupancy = GET /api/v1/get-camp-occupancy/{id} data (per day: occ, occwait, requests, pending, open). camp_id = events.event_id (the iClass camp id). A hidden camp has no events row yet.';

-- One row per price cell. A blank box in iClass = amount null.
create or replace view public.iclass_price_cells as
select t.gym_id,
       t.price_table_id,
       t.name as price_table_name,
       (c ->> 'studentEnum')::int as child_number,
       (c ->> 'blockEnum')::int   as days,
       nullif(c ->> 'amount', '')::numeric as amount,
       t.read_at
from public.iclass_price_tables t
cross join lateral jsonb_array_elements(coalesce(t.raw -> 'tableCells', '[]'::jsonb)) as r(row_cells)
cross join lateral jsonb_array_elements(r.row_cells) as c;
-- The view follows the table's own read rules (was flagged UNRESTRICTED in Supabase until this was set).
alter view public.iclass_price_cells set (security_invoker = true);
comment on view public.iclass_price_cells is
  'iclass_price_tables flattened: one row per price box - child_number (1st, 2nd, 3rd child), days (number of days booked), amount (null = blank box in iClass).';

alter table public.iclass_setup_reads enable row level security;
alter table public.iclass_price_tables enable row level security;
alter table public.iclass_camp_setup enable row level security;
-- The app reads; only the server (service key) writes.
create policy "Public read iclass_setup_reads" on public.iclass_setup_reads for select using (true);
create policy "Public read iclass_price_tables" on public.iclass_price_tables for select using (true);
create policy "Public read iclass_camp_setup" on public.iclass_camp_setup for select using (true);

-- ============================================================ 2026-11-04 (later): gym-wide reads + never delete
-- Jayme: "ur not deleting them are u?" -> camp rows are never deleted; ended camps keep their last read.
create table if not exists public.iclass_gym_settings (
  gym_id text not null references public.gyms(id),
  setting_key text not null,
  raw jsonb not null,
  read_at timestamptz not null,
  primary key (gym_id, setting_key)
);
comment on table public.iclass_gym_settings is
  'Gym-wide iClass setup, one row per signed-in call per gym, reply stored WHOLE in raw. setting_key = the call: camp-types (type names + charge category), programs, charge-categories (expiration dates), parent-portal-camp-registration (requests when full / not meeting requirements, modify schedule), parent-portal-general (portal shows camps/openings, priority mode).';
alter table public.iclass_gym_settings enable row level security;
create policy "Public read iclass_gym_settings" on public.iclass_gym_settings for select using (true);

alter table public.iclass_camp_setup add column if not exists public_raw jsonb;
alter table public.iclass_camp_setup add column if not exists gone_from_iclass_at timestamptz;
alter table public.iclass_price_tables add column if not exists gone_from_iclass_at timestamptz;
comment on table public.iclass_camp_setup is
  'Every iClass camp the signed-in setup read has seen, hidden ones included. NEVER deleted: a camp is re-read while it has not ended, then keeps its last read; gone_from_iclass_at is set when iClass no longer lists it. raw = GET /api/v1/camps/{id} data, occupancy = GET /api/v1/get-camp-occupancy/{id} data, public_raw = the public reply (waitlist requests on/off). camp_id = events.event_id.';
