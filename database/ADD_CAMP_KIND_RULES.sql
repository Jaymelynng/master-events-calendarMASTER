-- Admin > Camp Data (2026-11-16, Jayme on Metro: "u need to label the camps that are dance").
-- A label (tag) on camps, from a word in the iClass CAMP TYPE name (never the camp title - a gymnastics camp themed
-- "Dance Party" must not become Dance). Kept in the database, not in code (no-hardcoding law): add a row to add a label.
--   word      whole word in the camp type name, any case, plural s allowed ("dance" matches SUMMER CAMP (DANCE))
--   kind      the label shown on the tag, and the name of its own section in the Master link list / chip in the price list
--   color     the tag's fill (white text on it)
--   gym_id    null = every gym; a gym code = that gym only (checked first)
-- Display only: changes nothing in iClass or in the audit.
create table if not exists public.camp_kind_rules (
  id serial primary key,
  word text not null,
  kind text not null,
  color text not null default '#6d28d9',
  sort int not null default 0,
  gym_id text references public.gyms(id),
  note text
);
comment on table public.camp_kind_rules is
  'Admin > Camp Data: labels camps by a whole word in the iClass camp TYPE name (never the title). kind = tag text + its own Master link list section and price list chip; gym_id null = every gym, a code = that gym only (wins). Display only.';

alter table public.camp_kind_rules enable row level security;
drop policy if exists "Public read camp_kind_rules" on public.camp_kind_rules;
create policy "Public read camp_kind_rules" on public.camp_kind_rules for select using (true);

insert into public.camp_kind_rules (word, kind, color, sort, gym_id, note)
select 'dance', 'Dance', '#6d28d9', 10, null, 'Jayme 2026-11-16 (Metro SUMMER CAMP (DANCE))'
where not exists (select 1 from public.camp_kind_rules);
