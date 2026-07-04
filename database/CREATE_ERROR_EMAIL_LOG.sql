-- ============================================================================
-- error_email_log  —  tracks every "Email the Gym" send from the Errors Center
-- ----------------------------------------------------------------------------
-- Applied to Supabase (project xftiwouxpefchwoxxgpf) July 4, 2026.
--
-- WHY: When Jayme emails a gym about a data error, we record it. On the next
-- sync, if the gym fixed it the error disappears from the event, so nothing
-- shows — clean. If they DIDN'T fix it, the error is still there and the panel
-- shows "📧 Emailed Jul 4 · 2 days ago", and the button becomes "Send follow-up"
-- (amber once past the configurable follow-up window).
--
-- One row per click/send. Keyed to event_id + error_message so the send record
-- attaches to the exact still-active error after a resync. No hard FK to events
-- because events archive/delete; event_title is snapshotted for history.
-- ============================================================================

create table if not exists public.error_email_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid,
  gym_id        varchar,
  event_title   text,
  error_message text,
  recipients    text,
  cc            text,
  sent_at       timestamptz not null default now()
);

create index if not exists idx_error_email_log_event on public.error_email_log (event_id);
create index if not exists idx_error_email_log_lookup on public.error_email_log (event_id, error_message);

alter table public.error_email_log enable row level security;

drop policy if exists error_email_log_all on public.error_email_log;
create policy error_email_log_all on public.error_email_log
  for all using (true) with check (true);

-- Configurable "reasonable time" (days) before a follow-up is nudged.
-- Managed from Admin, no hardcoding. Default 3.
insert into public.app_config (key, value)
values ('error_email_followup_days', '3')
on conflict (key) do nothing;
