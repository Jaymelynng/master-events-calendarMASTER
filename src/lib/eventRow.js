// ============================================================================
// EVENT ROWS - the ONE list of columns every event export uses
// ============================================================================
// Used by: the Export window's CSV file and its Copy button, and the dashboard's "Copy what's shown".
// Before 2026-11-06 each had its own column list, so they drifted (Jayme: "all of it needs to be updated
// and formatted"). A column added here shows up everywhere.
//
// Spots = the FULLEST day, the same number the calendar's camp bars show: each day's count from the
// signed-in iClass setup read (iclass_camp_setup.occupancy). Only when a camp has no setup read does it
// fall back to the portal's own number (which is day 1 only). Measured 2026-11-06: 62 of 248 camps had a
// first-day number different from their fullest day. A value iClass did not send stays blank - never a guess.
// ============================================================================
import { supabase } from './supabase';
import { iclassCampId } from './iclassCamp';

const ymd = (v) => (v ? String(v).split('T')[0] : '');
const mdy = (v) => {
  const d = ymd(v);
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${Number(m)}/${Number(day)}/${y}`;
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowOf = (iso) => {
  const [y, m, d] = ymd(iso).split('-').map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
};
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Each day's counts for these events, keyed "GYM:campId" -> [{sqlDate, open, occ, ...}].
// Read by exact gym + iClass camp id, a few hundred ids at a time (Supabase answers 1,000 rows max).
export async function fetchDayCounts(events) {
  const pairs = (events || [])
    .map((e) => [e.gym_id, iclassCampId(e)])
    .filter(([g, id]) => g && id);
  const gyms = [...new Set(pairs.map((p) => p[0]))];
  const ids = [...new Set(pairs.map((p) => p[1]))];
  const map = {};
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase.from('iclass_camp_setup')
      .select('gym_id, camp_id, occupancy')
      .in('gym_id', gyms).in('camp_id', ids.slice(i, i + 300))
      .order('gym_id').order('camp_id')
      .range(0, 999);
    if (error) throw new Error(error.message);
    (data || []).forEach((r) => {
      if (Array.isArray(r.occupancy) && r.occupancy.length) map[`${r.gym_id}:${r.camp_id}`] = r.occupancy;
    });
  }
  return map;
}

// The spots facts for one event: fullest day + every day, from the setup read; else the portal number.
export function spotsOf(e, dayCounts) {
  const days = (dayCounts || {})[`${e.gym_id}:${iclassCampId(e)}`];
  if (Array.isArray(days) && days.length) {
    const sorted = [...days].sort((a, b) => String(a.sqlDate).localeCompare(String(b.sqlDate)));
    const opens = sorted.map((d) => Number(d.open || 0));
    return {
      left: Math.min(...opens),
      byDay: sorted.map((d) => `${dowOf(d.sqlDate)} ${mdy(d.sqlDate).replace(/\/\d{4}$/, '')}: ${Number(d.open || 0)}`).join(' | '),
      source: 'each day (iClass setup)',
    };
  }
  if (e.has_openings === false) return { left: 0, byDay: '', source: 'portal' };
  if (e.openings === null || e.openings === undefined) return { left: null, byDay: '', source: '' };
  return { left: Number(e.openings), byDay: '', source: 'portal (day 1 only)' };
}

const hoursOf = (e) => {
  if (Array.isArray(e.daily_schedule) && e.daily_schedule.length) {
    return e.daily_schedule.map((d) => {
      const hrs = d.start_time ? `${d.start_time}${d.end_time ? '-' + d.end_time : ''}` : '';
      return clean(`${d.day || ''} ${hrs}`);
    }).join(' | ');
  }
  return e.time || '';
};

const agesOf = (e) => {
  const hasMin = e.age_min !== null && e.age_min !== undefined;
  const hasMax = e.age_max !== null && e.age_max !== undefined;
  if (hasMin && hasMax) return `${e.age_min}-${e.age_max}`;
  if (hasMin) return `${e.age_min}+`;
  return '';
};

// Every column, in order. key = what the picker remembers; get(e, ctx) = the cell.
// ctx = { gymName(id), dayCounts }
export const EVENT_COLUMNS = [
  { key: 'gym', label: 'Gym', get: (e) => e.gym_id || '' },
  { key: 'gym_name', label: 'Gym Name', get: (e, c) => c.gymName(e.gym_id) || e.gym_name || '' },
  { key: 'bucket', label: 'Bucket', get: (e) => e.type || '' },
  { key: 'category', label: 'iClass Category', get: (e) => e.camp_type || '' },
  { key: 'title', label: 'Event', get: (e) => clean(e.title) },
  { key: 'start', label: 'Start', get: (e) => mdy(e.start_date || e.date) },
  { key: 'end', label: 'End', get: (e) => { const s = ymd(e.start_date || e.date); const en = ymd(e.end_date); return en && en !== s ? mdy(en) : ''; } },
  { key: 'day', label: 'Day', get: (e) => e.day_of_week || '' },
  { key: 'hours', label: 'Hours', get: (e) => hoursOf(e) },
  { key: 'ages', label: 'Ages', get: (e) => agesOf(e) },
  { key: 'spots', label: 'Spots Left', get: (e, c) => { const s = spotsOf(e, c.dayCounts); return s.left === null ? '' : s.left; } },
  { key: 'spots_by_day', label: 'Spots by Day', get: (e, c) => spotsOf(e, c.dayCounts).byDay },
  { key: 'status', label: 'Status', get: (e, c) => { const s = spotsOf(e, c.dayCounts); if (s.left === null) return ''; return s.left <= 0 ? 'FULL' : s.left <= 3 ? 'Almost full' : 'Open'; } },
  // per day vs whole camp only means something when the event runs more than one day (blank for a one-day event)
  { key: 'signup', label: 'Sign-up', get: (e) => {
    const s = ymd(e.start_date || e.date); const en = ymd(e.end_date);
    if (!en || en === s) return '';
    return e.allow_choose_days === true ? 'Per day' : e.allow_choose_days === false ? 'Whole camp only' : '';
  } },
  { key: 'reg_open', label: 'Registration Opens', get: (e) => mdy(e.registration_start_date) },
  { key: 'reg_close', label: 'Registration Closes', get: (e) => mdy(e.registration_end_date) },
  { key: 'program', label: 'iClass Program', get: (e) => e.program_name || '' },
  { key: 'description', label: 'Description', get: (e) => clean(e.description) },
  { key: 'desc_status', label: 'Description Status', get: (e) => e.description_status || '' },
  { key: 'link', label: 'Link', get: (e) => e.event_url || '' },
];

// The columns "Copy what's shown" uses when nobody picked (short enough to paste into an email).
export const DEFAULT_COPY_COLUMNS = ['gym', 'gym_name', 'bucket', 'title', 'start', 'end', 'hours', 'ages', 'spots', 'signup', 'link'];

const sortEvents = (events) => [...events].sort((a, b) =>
  (a.gym_id || '').localeCompare(b.gym_id || '')
  || ymd(a.start_date || a.date).localeCompare(ymd(b.start_date || b.date))
  || (a.title || '').localeCompare(b.title || ''));

// Rows for the picked columns: { columns, rows } with rows as arrays of cell values.
export function buildEventRows(events, { columnKeys, gymsList = [], dayCounts = {} }) {
  const cols = EVENT_COLUMNS.filter((c) => !columnKeys || columnKeys.includes(c.key));
  const nameOf = (id) => gymsList.find((g) => g.id === id)?.name || '';
  const ctx = { gymName: nameOf, dayCounts };
  return { columns: cols, rows: sortEvents(events).map((e) => cols.map((c) => c.get(e, ctx))) };
}

// CSV text (quotes every text cell; Excel and Sheets read it as-is).
export function toCSV({ columns, rows }) {
  const q = (v) => (typeof v === 'number' ? String(v) : `"${String(v ?? '').replace(/"/g, '""')}"`);
  return [columns.map((c) => q(c.label)).join(','), ...rows.map((r) => r.map(q).join(','))].join('\n');
}

// Clipboard: a real table (Gmail, Outlook, Docs) + tab-separated text (Excel, Sheets).
export function toClipboard({ columns, rows }) {
  const text = [columns.map((c) => c.label), ...rows]
    .map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = 'border:1px solid #ccc;padding:4px 8px;font-family:Arial,sans-serif;font-size:13px;vertical-align:top;';
  const linkAt = columns.findIndex((c) => c.key === 'link');
  const html = '<table style="border-collapse:collapse;">'
    + '<tr>' + columns.map((c) => `<th style="${cell}background:#eee;text-align:left;">${esc(c.label)}</th>`).join('') + '</tr>'
    + rows.map((r) => '<tr>' + r.map((v, i) => `<td style="${cell}">${i === linkAt && v ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td>`).join('') + '</tr>').join('')
    + '</table>';
  return { text, html, count: rows.length };
}
