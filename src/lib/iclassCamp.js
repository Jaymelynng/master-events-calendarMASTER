// Shared helpers for the signed-in iClass setup data (iclass_camp_setup).
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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
