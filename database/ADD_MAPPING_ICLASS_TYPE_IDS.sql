-- ============================================================================
-- event_type_mappings.iclass_type_ids - a bucket survives an iClass rename
-- Applied 2026-11-04.
--
-- Why: the sync matched a camp category to its bucket by NAME only. Planet renamed
-- "Summer Swim & Gym - Full Day" -> "Day Program - Full Day" (same iClass type id 3;
-- Half Day = id 4), so 39 camps fell into UNSORTED even though Jayme had mapped them.
--
-- Now each mapping row remembers the iClass type id it matched at each gym:
--   {"PLG": 3, "SGT": 12}
-- The sync (f12_collect_and_import.py) matches by name first; if the name is new but the
-- gym's type id is one a row already knows, it is the same iClass category renamed - it keeps
-- Jayme's bucket and logs "RENAMED". The sync fills new ids itself whenever a name matches.
-- Additive: nothing that read this table before changes.
-- ============================================================================

alter table public.event_type_mappings
  add column if not exists iclass_type_ids jsonb not null default '{}'::jsonb;

comment on column public.event_type_mappings.iclass_type_ids is
  'iClass camp type id this mapping matched, per gym: {"PLG": 3}. Filled by the sync. Lets a mapping survive when a gym renames the category in iClass (same id, new name).';

-- Backfill from events already synced: the id each mapped name had at each gym.
-- Checked first: no (gym, type id) is claimed by two rows, and no row has two ids at one gym.
with seen as (
  select distinct m.id as mapping_id, e.gym_id, e.type_id
  from public.events e
  join public.event_type_mappings m
    on lower(trim(m.iclass_type_name)) = lower(trim(e.camp_type))
   and (m.gym_id is null or m.gym_id = e.gym_id)
  where e.type_id is not null and m.is_active
)
update public.event_type_mappings m
set iclass_type_ids = sub.ids
from (select mapping_id, jsonb_object_agg(gym_id, type_id) as ids from seen group by mapping_id) sub
where m.id = sub.mapping_id;
