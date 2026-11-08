// Shared helpers for the signed-in iClass setup data (iclass_camp_setup).
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { resolveRule } from './bucketRules';

// The iClass camp number. events.event_id is empty on every event today (checked 2026-11-04: 0 of 507),
// so it is read from the event's own iClass link (".../camp-details/2015") - the exact id, never a guess.
export const iclassCampId = (event) => {
  if (event?.event_id) return Number(event.event_id);
  const m = String(event?.event_url || '').match(/\/(?:camp-details|event-details|camps)\/(\d+)/);
  return m ? Number(m[1]) : null;
};

// Per-day counts for a set of calendar camps, keyed "GYM:campId" -> [{sqlDate, occ, open, occwait, requests}].
// Only camps whose gym has had a signed-in setup read have counts; the rest are simply absent (the bar
// then falls back to the public number), never shown as 0.
export function useCampOccupancy(campEvents) {
  const [byCamp, setByCamp] = useState({});
  const key = (campEvents || [])
    .map((e) => `${e.gym_id}:${iclassCampId(e)}`)
    .filter((k) => !k.endsWith(':null'))
    .sort()
    .join(',');

  useEffect(() => {
    let alive = true;
    if (!key) { setByCamp({}); return undefined; }
    const pairs = key.split(',').map((k) => k.split(':'));
    const gyms = [...new Set(pairs.map((p) => p[0]))];
    const ids = [...new Set(pairs.map((p) => Number(p[1])))];
    supabase.from('iclass_camp_setup').select('gym_id, camp_id, occupancy')
      .in('gym_id', gyms).in('camp_id', ids)
      .then(({ data }) => {
        if (!alive) return;
        const map = {};
        (data || []).forEach((r) => {
          if (Array.isArray(r.occupancy) && r.occupancy.length) map[`${r.gym_id}:${r.camp_id}`] = r.occupancy;
        });
        setByCamp(map);
      });
    return () => { alive = false; };
  }, [key]);

  return byCamp;
}

// Why a camp built in iClass is not live on the portal - read from its own iClass settings, never guessed.
// Jayme 2026-11-06: "show faded ... to see errors or if things are on the calendar but something is stopping
// it from being live". Checked against the data that day: every active camp missing from the portal had one
// of these (PLG: 24 camps of one category listed, the 1 whose registration opens 11/16 was not; EST #739 and
// SGT #2077 dropped off when their registration END passed). None of them = shown on the portal list but not
// synced into the calendar yet.
const mdy = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${m}/${d}/${y}`; };
export function notLiveReasons(r, today = new Date()) {
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const rs = r.registration_start ? String(r.registration_start).slice(0, 10) : null;
  const re = r.registration_end ? String(r.registration_end).slice(0, 10) : null;
  const out = [];
  if (r.show_on_web === false || r.show_on_web === null) out.push('"Show on portal" is off');
  if (rs && rs > t) out.push(`Registration opens ${mdy(rs)} - the portal lists a camp only after it opens`);
  if (re && re < t) out.push(`Registration closed ${mdy(re)} - the portal stops listing a camp when it closes`);
  if (!out.length) out.push('On the portal, but not synced into the calendar yet - press Sync');
  return out;
}

// Of the events a sync is about to take off the calendar, which ones iClass itself still has as an ACTIVE camp
// that the portal is not showing (Show on portal off / registration not open / closed)? Those are not lost:
// the calendar draws them faded the moment they leave the events list. Jayme 2026-11-07, SGT turned
// "Show on portal" off on 20 summer care weeks and Sync All stopped with "20 of 39 would be deleted".
// Read by exact gym + camp id from the last setup read; an event with no stored camp record is NOT explained.
// Returns Map eventId -> the reason in iClass's own settings.
export async function hiddenButActiveInIclass(events) {
  const out = new Map();
  const withIds = (events || []).map((e) => ({ e, id: iclassCampId(e) })).filter((x) => x.id);
  if (!withIds.length) return out;
  const gyms = [...new Set(withIds.map((x) => x.e.gym_id))];
  const ids = [...new Set(withIds.map((x) => x.id))];
  const audit = new Map();
  const active = new Set();
  for (let i = 0; i < ids.length; i += 300) {
    const part = ids.slice(i, i + 300);
    const [a, s] = await Promise.all([
      supabase.from('iclass_camp_audit')
        .select('gym_id, camp_id, registration_start, registration_end, show_on_web')
        .in('gym_id', gyms).in('camp_id', part).is('gone_from_iclass_at', null)
        .order('gym_id').order('camp_id').range(0, 999),
      supabase.from('iclass_camp_setup')
        .select('gym_id, camp_id, active:raw->>active')
        .in('gym_id', gyms).in('camp_id', part).is('gone_from_iclass_at', null)
        .order('gym_id').order('camp_id').range(0, 999),
    ]);
    if (a.error) throw new Error(a.error.message);
    if (s.error) throw new Error(s.error.message);
    (a.data || []).forEach((r) => audit.set(`${r.gym_id}:${r.camp_id}`, r));
    (s.data || []).forEach((r) => { if (String(r.active) === '1') active.add(`${r.gym_id}:${r.camp_id}`); });
  }
  withIds.forEach(({ e, id }) => {
    const k = `${e.gym_id}:${id}`;
    const row = audit.get(k);
    if (!row || !active.has(k)) return;
    const reasons = notLiveReasons(row).filter((r) => !r.startsWith('On the portal'));
    if (reasons.length) out.set(e.id, reasons[0]);
  });
  return out;
}

// Camps built in iClass that the portal does NOT show (see notLiveReasons). The calendar draws them faded
// with a "NOT ON PORTAL" tag (Jayme 2026-11-04: "show it but make it a diff color or transparent to show that
// it's there but not on portal"). They are never in the events table, so no count, requirement, email or error
// total includes them. The Export window can add them as rows marked "Not live" when she ticks it (2026-11-07).
// A camp the calendar already has (same gym + iClass camp id) is skipped. Bucket = Jayme's Buckets rules
// (src/lib/bucketRules.js); a category she hid from the calendar stays hidden here too.

// Every ACTIVE camp touching firstIso..lastIso, read page by page (Supabase answers 1,000 rows max), plus the
// Buckets rules. Inactive camps stay off (Jayme 2026-11-06: "just bringing in live events that are active");
// "active" is in the camp's stored iClass record, read by exact gym + camp id.
export async function fetchNotLiveRows(firstIso, lastIso) {
  const list = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('iclass_camp_audit')
      .select('gym_id, camp_id, camp_name, start_date, end_date, min_age, max_age, per_day_signup, camp_type_name, registration_start, registration_end, allow_registration, show_on_web')
      .is('gone_from_iclass_at', null)
      .lte('start_date', lastIso).gte('end_date', firstIso)
      .order('gym_id').order('camp_id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    list.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { data: rules } = await supabase.from('event_type_mappings').select('*');
  const active = new Set();
  const gyms = [...new Set(list.map((c) => c.gym_id))];
  const ids = [...new Set(list.map((c) => c.camp_id))];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from('iclass_camp_setup')
      .select('gym_id, camp_id, active:raw->>active')
      .in('gym_id', gyms).in('camp_id', ids.slice(i, i + 300))
      .order('gym_id').order('camp_id').range(0, 999);
    (data || []).forEach((x) => { if (String(x.active) === '1') active.add(`${x.gym_id}:${x.camp_id}`); });
  }
  return { rows: list.filter((c) => active.has(`${c.gym_id}:${c.camp_id}`)), rules: rules || [] };
}

// Those camps as calendar events, minus the ones the calendar already has.
export function toNotLiveEvents(rows, rules, gymsList, existingEvents) {
  const have = new Set((existingEvents || []).map((e) => `${e.gym_id}:${iclassCampId(e)}`));
  return (rows || [])
    .filter((r) => !have.has(`${r.gym_id}:${r.camp_id}`))
    .map((r) => {
      const gym = (gymsList || []).find((g) => g.id === r.gym_id);
      const rule = resolveRule(r.camp_type_name, r.gym_id, rules);
      if (rule && rule.hide_from_calendar) return null;
      return {
        id: `notonportal-${r.gym_id}-${r.camp_id}`,
        not_on_portal: true,
        not_live_reasons: notLiveReasons(r),
        gym_id: r.gym_id,
        gym_code: r.gym_id,
        gym_name: gym?.name,
        title: r.camp_name,
        date: String(r.start_date).slice(0, 10),
        start_date: String(r.start_date).slice(0, 10),
        end_date: String(r.end_date).slice(0, 10),
        type: rule ? rule.event_type : 'UNSORTED',
        camp_type: r.camp_type_name,
        age_min: r.min_age,
        age_max: r.max_age,
        allow_choose_days: r.per_day_signup,
        registration_start_date: r.registration_start ? String(r.registration_start).slice(0, 10) : null,
        registration_end_date: r.registration_end ? String(r.registration_end).slice(0, 10) : null,
        event_url: gym?.iclass_slug ? `https://portal.iclasspro.com/${gym.iclass_slug}/camp-details/${r.camp_id}` : null,
        validation_errors: [],
      };
    })
    .filter(Boolean);
}

// One month of them, for the calendar picture.
export function useNotOnPortalCamps(year, month, gymsList, existingEvents) {
  const [state, setState] = useState({ rows: [], rules: [] });

  useEffect(() => {
    let alive = true;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fetchNotLiveRows(iso(new Date(year, month, 1)), iso(new Date(year, month + 1, 0)))
      .then((r) => { if (alive) setState(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [year, month]);

  return toNotLiveEvents(state.rows, state.rules, gymsList, existingEvents);
}
