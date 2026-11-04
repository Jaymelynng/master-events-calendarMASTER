-- Old price tables removed 2026-11-04. Jayme: "i have told u a million times that those prices needed to be
-- removed and we would add them later" · "forget the old pricing rules that didnt work" · "Yes, remove them".
-- Replaced by the signed-in iClass read: iclass_price_tables / iclass_price_cells / iclass_camp_setup
-- (database/ADD_ICLASS_CAMP_SETUP_TABLES.sql, automation/camp_setup_reader.py).
--
-- Checked before removal (2026-11-04):
--   * no view or foreign key depended on them
--   * the only database function using them was get_current_price (event_pricing); no JS/Python
--     in any project calls it, no skill names it
--   * nothing in src/, f12_collect_and_import.py, local_api_server.py or validation_engine.py reads them
-- Every row is in database/backups/REMOVED_OLD_PRICE_TABLES_2026_11_04_backup.json
-- (camp_pricing 10, event_pricing 30, archive.pricing_schedules 274 - counts matched the live tables).

drop function if exists public.get_current_price(character varying, character varying, date);
drop table if exists public.camp_pricing;
drop table if exists public.event_pricing;
drop table if exists archive.pricing_schedules;

-- ============================================================ RESTORE (only if ever needed)
-- create table public.camp_pricing (id integer not null primary key, gym_id text not null,
--   full_day_daily numeric, full_day_weekly numeric, created_at timestamptz, updated_at timestamptz,
--   half_day_daily numeric, half_day_weekly numeric);
-- create table public.event_pricing (id uuid not null primary key, gym_id varchar not null,
--   event_type varchar not null, price numeric not null, duration_hours numeric, effective_date date not null,
--   end_date date, notes text, created_at timestamptz, updated_at timestamptz);
-- create table archive.pricing_schedules (id bigint not null primary key, gym_id text not null,
--   schedule_id integer not null, schedule_name text not null, is_deleted boolean, price_data jsonb not null,
--   deposits jsonb, raw_data jsonb, created_at timestamptz, updated_at timestamptz);
-- then load the rows from the backup JSON.
-- get_current_price(p_gym_id varchar, p_event_type varchar, p_date date default current_date):
--   newest event_pricing row for the gym + event type with effective_date <= p_date and (end_date null or >= p_date).
