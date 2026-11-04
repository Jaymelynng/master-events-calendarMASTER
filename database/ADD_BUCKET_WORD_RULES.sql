-- ============================================================================
-- Buckets: WORD rules - a category lands in its bucket whatever each gym calls it
-- Applied 2026-11-04.
--
-- Jayme (2026-11-04): "thats the entire point of the buckets where if there are any names not
-- exactly the same u still define and recognize it as that like before care after care all that
-- is the same category".
--
-- Before: a rule matched only the EXACT iClass Event Type name, so "CLINICS" (Metro) missed the
-- "CLINIC" rule, "SUMMER CAMP AFTER CARE" (SGT) missed "CAMP AFTER CARE", and so on.
-- Now a row can be match_type = 'word': the word (or phrase) anywhere in the name, whole word,
-- a plural "s" allowed. Order the sync uses (f12_collect_and_import.resolve_type_mapping):
--   1. exact name, this gym   2. exact name, every gym   3. same iClass type id (a rename)
--   4. word rule, this gym    5. word rule, every gym    -- the LONGEST word wins
--      ("SUMMER CAMP AFTER CARE": "after care" beats "camp" -> CAMP CARE)
--   6. nothing -> UNSORTED (Needs a home)
-- Dry run before applying: no category that already had an exact rule changes bucket.
-- The words come from Jayme's own mappings; she edits them on the Buckets screen.
-- ============================================================================

alter table public.event_type_mappings
  add column if not exists match_type text not null default 'exact';

alter table public.event_type_mappings
  drop constraint if exists event_type_mappings_match_type_check;
alter table public.event_type_mappings
  add constraint event_type_mappings_match_type_check check (match_type in ('exact', 'word'));

comment on column public.event_type_mappings.match_type is
  'exact = the iClass Event Type name must match (any capitals). word = iclass_type_name is a word or phrase found anywhere in the name (whole word, plural s allowed); the longest matching word wins. Exact rules always beat word rules.';

-- A word rule and an exact rule may share the same text ("clinic"), so the unique key includes it.
drop index if exists public.idx_etm_name_scope;
create unique index idx_etm_name_scope
  on public.event_type_mappings (lower(iclass_type_name), coalesce(gym_id, '*'), match_type);

insert into public.event_type_mappings (iclass_type_name, event_type, gym_id, is_active, hide_from_calendar, match_type, note)
values
  ('clinic',        'CLINIC',         null, true, false, 'word', 'Word rule 2026-11-04 - CLINIC / CLINICS / Bar Clinic ...'),
  ('night out',     'KIDS NIGHT OUT', null, true, false, 'word', 'Word rule 2026-11-04 - Kids / Parents Night Out'),
  ('open gym',      'OPEN GYM',       null, true, false, 'word', 'Word rule 2026-11-04 - Open Gym / Team Open Gym ...'),
  ('before care',   'CAMP CARE',      null, true, false, 'word', 'Word rule 2026-11-04 - from CAMP BEFORE CARE'),
  ('after care',    'CAMP CARE',      null, true, false, 'word', 'Word rule 2026-11-04 - from CAMP AFTER CARE'),
  ('extended care', 'CAMP CARE',      null, true, false, 'word', 'Word rule 2026-11-04 - MGC SUMMER CAMP (EXTENDED CARE)'),
  ('extended day',  'CAMP CARE',      null, true, false, 'word', 'Word rule 2026-11-04 - from PLG extended day = care'),
  ('camp',          'CAMP',           null, true, false, 'word', 'Word rule 2026-11-04 - any camp'),
  ('day program',   'CAMP',           null, true, false, 'word', 'Word rule 2026-11-04 - PLG Day Program'),
  ('full day',      'CAMP',           null, true, false, 'word', 'Word rule 2026-11-04 - WINTER BREAK - FULL DAY ...'),
  ('half day',      'CAMP',           null, true, false, 'word', 'Word rule 2026-11-04 - WINTER BREAK - HALF DAY ...'),
  ('tryout',        'SPECIALTY',      null, true, false, 'word', 'Word rule 2026-11-04 - from RBA: tryouts live in Specialty')
on conflict do nothing;
