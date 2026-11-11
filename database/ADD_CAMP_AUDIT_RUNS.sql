-- Camp audit in the calendar app (step 1 of the plan, Jayme 2026-11-11: "Yes, start step 1").
-- The Run camp audit button (Admin > Camp Audit) asks Railway (POST /camp-audit) to run
-- automation/camp_audit.py for the gyms she ticked. Railway writes these tables with its service key;
-- the app only READS them (public read, no public write) - same pattern as iclass_setup_reads.
-- Additive only: no existing table, view or column changes.

create table if not exists public.camp_audit_runs (
  id           bigserial primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',      -- running | done | failed | stopped
  gyms         text[] not null default '{}',          -- calendar gym codes in this run, in order
  note         text
);
comment on table public.camp_audit_runs is
  'One press of Run camp audit (Admin > Camp Audit). Railway (POST /camp-audit) runs automation/camp_audit.py for each gym in gyms[]; each gym''s result is a row in camp_audit_gym_results. status: running / done / failed / stopped (a Railway restart cut it off).';

create table if not exists public.camp_audit_gym_results (
  id              bigserial primary key,
  run_id          bigint not null references public.camp_audit_runs(id) on delete cascade,
  gym_id          text not null,                       -- calendar code (gyms.id)
  status          text not null default 'waiting',     -- waiting | running | done | failed
  step            text,                                -- what it is doing now, shown under the progress bar
  started_at      timestamptz,
  finished_at     timestamptz,
  source_read_at  timestamptz,                         -- when iClass was last read for this gym (iclass_setup_reads), NOT when the audit ran
  camp_count      integer,
  script_rows     jsonb,                               -- the rows camp_audit.py wrote, untouched
  rows            jsonb,                               -- script rows merged with her kept rows and deleted rows (camp_audit_gym_state)
  confirmed       text,                                -- the Confirmed block the script wrote
  coverage        jsonb,                               -- per camp id: every check that ran and what it found
  error           text,
  unique (run_id, gym_id)
);
comment on table public.camp_audit_gym_results is
  'One gym in one Run camp audit press. script_rows = what automation/camp_audit.py found; rows = those merged with her own rows and deletions (camp_audit_gym_state), the same merge the audit page used. source_read_at = when iClass data was last read for the gym - separate from finished_at (when the audit ran), so an audit of old data shows as old.';

create table if not exists public.camp_audit_gym_state (
  gym_id       text primary key,                       -- calendar code (gyms.id)
  page_code    text,                                   -- the code the claude.ai audit page used (AAR / EGF / PGN for AAG / EAG / PLG)
  status       text,                                   -- not | missing | auditing | ready | sent
  rows         jsonb,                                  -- the email rows as she left them; rows tagged by eye / hand are kept by every run
  hidden       jsonb,                                  -- [{err, camp}] rows she deleted - a run never brings them back
  confirmed    text,
  subject      text,
  intro        text,
  signoff      text,
  gm           text,
  name         text,
  copied_from  text,                                   -- where this came from (the audit page link + version)
  copied_at    timestamptz not null default now()
);
comment on table public.camp_audit_gym_state is
  'Her work on each gym''s summer camp audit email: rows she edited or added (by hand) and rows found by reading (by eye), rows she deleted (hidden), status, Confirmed block and email text. Copied once from the claude.ai audit page (artifact LczbQJLqT3QZmLv59KsiQv) on 2026-11-11; until the Camp Audit tab (step 2) is built she still edits on that page, so edits made there after copied_at are not in here.';

create table if not exists public.camp_audit_standards (
  id          text primary key,                        -- 'summer-2027'
  title       text,
  settings    jsonb,                                   -- {launch, due, window:[from,to], closures:[{date,name}]} - what the audit uses
  sections    jsonb,                                   -- the Standards page text (Kim's rules, every check)
  copied_from text,
  copied_at   timestamptz not null default now()
);
comment on table public.camp_audit_standards is
  'The Summer Camp Standards the audit runs on: settings (launch date, due date, summer window, closures) and the Standards page text. Copied from the claude.ai audit page on 2026-11-11; Railway reads settings for every Run camp audit.';

alter table public.camp_audit_gym_state add column if not exists earlier_rows jsonb, add column if not exists page_doc jsonb;
comment on column public.camp_audit_gym_state.earlier_rows is 'For a Sent or Ready gym: the email rows as they stood when it was sent / marked ready ({status, saved, rows}) - never overwritten.';
comment on column public.camp_audit_gym_state.page_doc is 'The whole audit-page document for this gym exactly as copied (every field), so nothing she wrote is lost.';

alter table public.camp_audit_runs        enable row level security;
alter table public.camp_audit_gym_results enable row level security;
alter table public.camp_audit_gym_state   enable row level security;
alter table public.camp_audit_standards   enable row level security;
create policy "Public read camp_audit_runs"        on public.camp_audit_runs        for select using (true);
create policy "Public read camp_audit_gym_results" on public.camp_audit_gym_results for select using (true);
create policy "Public read camp_audit_gym_state"   on public.camp_audit_gym_state   for select using (true);
create policy "Public read camp_audit_standards"   on public.camp_audit_standards   for select using (true);
