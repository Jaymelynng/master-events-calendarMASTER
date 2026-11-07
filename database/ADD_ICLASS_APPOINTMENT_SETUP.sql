-- Signed-in (staff-side) APPOINTMENT setup + appointment price tables, read ONLY from iClass.
-- Built 2026-11-07. Jayme: "ok so i need to get u the pricing for apts and the calls???" -> "Yes, build it".
-- Planet is the gym that runs main events as appointments (Open Gym, KNO, tryouts) - Jayme 2026-11-07:
-- "only planet i think uses them for main events". The read still runs at every gym; a gym with none saves none.
--
-- Shape proven on her Planet recording 2026-11-07 12:28 (planetgymnasticsnatick):
--   POST /api/v1/appointment-timeslots/filtered  -> a SEARCH (changes nothing): every time slot in a date
--        range, hidden ones too, each with appointmentId + pricingScheduleId; data.lastPage says how many pages
--   GET  /api/v1/appointments/{id}               -> one appointment's whole setup (pricingScheduleId,
--        showOnCustomerPortal, allowWebRegistration, ages, maxStudents, service, staff, timeslots, recurrence)
--        The portal link appointment-details/{id} is this same id (1768 = Rocket Cheer Prep Team Tryouts).
--   GET  /api/v1/appointment-pricing-schedules/  -> every appointment price table:
--        tableCells[][] of {studentEnum = child #, timeslotEnum = # of time slots, amount}
--   GET  /api/v1/appointments-settings           -> cancellation / rescheduling fees (iclass_gym_settings)
--
-- Appointment price table ids are their OWN numbers: appointment price table 14 is not camp price table 14,
-- so they get their own table (never mixed into iclass_price_tables).
--
-- PRIVACY - the one part NOT stored whole: an appointment reply lists every sign-up with the child's name
-- (bookings[].student). These tables are readable by the app's public key, so the sign-up lists
-- (bookings, bookingTimeslots) are taken out before saving and replaced by counts in bookings_summary.
-- Everything else in the reply is stored whole.

create table if not exists public.iclass_appointment_setup (
  gym_id text not null references public.gyms(id),
  appointment_id bigint not null,
  raw jsonb not null,
  bookings_summary jsonb,
  read_at timestamptz not null,
  primary key (gym_id, appointment_id)
);
comment on table public.iclass_appointment_setup is
  'Every iClass APPOINTMENT with a time slot from today on (hidden ones included), as GET /api/v1/appointments/{id} sends it to a signed-in staff read: pricingScheduleId (-> iclass_appointment_price_tables), showOnCustomerPortal, allowWebRegistration, ages, maxStudents, service, staff, timeslots, recurrence. appointment_id = the id in the portal link appointment-details/{id} (events.event_url). The sign-up lists (bookings, bookingTimeslots) are REMOVED from raw because they name children; bookings_summary = {listed, not_cancelled}. Never deleted: an appointment keeps its last read after its last time slot passes.';

create table if not exists public.iclass_appointment_price_tables (
  gym_id text not null references public.gyms(id),
  price_table_id int not null,
  name text,
  raw jsonb not null,
  read_at timestamptz not null,
  gone_from_iclass_at timestamptz,
  primary key (gym_id, price_table_id)
);
comment on table public.iclass_appointment_price_tables is
  'Every iClass APPOINTMENT price table at a gym, exactly as GET /api/v1/appointment-pricing-schedules/ sends it (raw = whole object; tableCells[][] of studentEnum = child #, timeslotEnum = # of time slots, amount). Separate from iclass_price_tables (camps): the ids are a different numbering. gone_from_iclass_at = iClass stopped listing it (never deleted). View: iclass_appointment_price_cells.';

create or replace view public.iclass_appointment_price_cells as
select t.gym_id,
       t.price_table_id,
       t.name as price_table_name,
       (c ->> 'studentEnum')::int  as child_number,
       (c ->> 'timeslotEnum')::int as time_slots,
       nullif(c ->> 'amount', '')::numeric as amount,
       t.read_at
from public.iclass_appointment_price_tables t
cross join lateral jsonb_array_elements(coalesce(t.raw -> 'tableCells', '[]'::jsonb)) as r(row_cells)
cross join lateral jsonb_array_elements(r.row_cells) as c;
alter view public.iclass_appointment_price_cells set (security_invoker = true);
comment on view public.iclass_appointment_price_cells is
  'iclass_appointment_price_tables flattened: one row per price box - child_number (1st, 2nd, 3rd child), time_slots (number of time slots booked), amount (null = blank box in iClass).';

alter table public.iclass_appointment_setup enable row level security;
alter table public.iclass_appointment_price_tables enable row level security;
-- The app reads; only the server (service key) writes.
create policy "Public read iclass_appointment_setup" on public.iclass_appointment_setup for select using (true);
create policy "Public read iclass_appointment_price_tables" on public.iclass_appointment_price_tables for select using (true);

-- The setup read's own record says how many appointments it read (null = the read did not cover appointments).
alter table public.iclass_setup_reads add column if not exists appointments_read int;
alter table public.iclass_setup_reads add column if not exists appointment_price_tables_read int;
comment on column public.iclass_setup_reads.appointments_read is
  'Appointments read in this setup read. 0 = the gym has no appointments with a time slot from today on. null = appointments were not read (an older read, a prices-only read, or the appointment part stopped - see note).';
