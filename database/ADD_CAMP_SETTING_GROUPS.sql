-- Admin > Camp Data (2026-11-12, Jayme: "Yes, start step 1").
-- How the Camp Data tab groups a camp's iClass settings when a camp is opened. Kept in the database, not in code
-- (no-hardcoding law): each row is one group, in `sort` order; a setting joins the FIRST group whose
-- field_pattern (a regular expression on the iClass field name, e.g. allowParentsToChooseDays) matches it.
-- A setting no group matches shows under "Other" - it is never hidden. Display only: changes nothing in iClass.
create table if not exists public.camp_setting_groups (
  id serial primary key,
  group_name text not null,
  sort int not null default 0,
  field_pattern text not null,
  case_sensitive boolean not null default false,
  note text
);
comment on table public.camp_setting_groups is
  'Admin > Camp Data: how an opened camp''s iClass settings are grouped. A field joins the first group (by sort) whose field_pattern regex matches the iClass field name; unmatched fields show under Other. Display only.';

alter table public.camp_setting_groups enable row level security;
drop policy if exists "Public read camp_setting_groups" on public.camp_setting_groups;
create policy "Public read camp_setting_groups" on public.camp_setting_groups for select using (true);

insert into public.camp_setting_groups (group_name, sort, field_pattern, case_sensitive, note)
select * from (values
  ('Name and record', 10, '^(id|name|image|showAlias|updatedAt|updatedBy)$', false, 'checked first so image is not read as an age field'),
  ('Who can see and book it', 20, '^(active|showOnWeb|allowWebRegistration|registration|priorityReg|autoApprove|dueAtSignUp|allowParentsToChooseDays|allowToRequest|campRegisterExpired|hasOpenings|openings|showOpenings)', false, null),
  ('Spots and days', 30, '^(maxStudent|scheduleType|startDate|endDate|zoneId|locationId|roomName|instructors|events)', false, null),
  ('Ages and who it is for', 40, 'Age|^(gender|grade|level|prerequisite)', true, 'case sensitive: Age with a capital (minAge, maxAgeYear)'),
  ('Program, type and price', 50, '^(programId|programName|programIsDeleted|campType|typeId|pricingScheduleId|tax|promoCodes|programPromoCodes|disciplines|keywords|option)', false, null)
) v(group_name, sort, field_pattern, case_sensitive, note)
where not exists (select 1 from public.camp_setting_groups);
