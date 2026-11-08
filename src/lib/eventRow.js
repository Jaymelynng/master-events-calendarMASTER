// ============================================================================
// EVENT ROWS - the ONE list of columns every event export uses
// ============================================================================
// Used by: the Export window (every format + its Copy button) and the dashboard's "Copy what's shown".
// Before 2026-11-06 each had its own column list, so they drifted (Jayme: "all of it needs to be updated
// and formatted"). A column added here shows up everywhere.
//
// 2026-11-07 (Jayme: "the export needs to be totally redone to include everything we have just done"):
// columns from the signed-in iClass setup read were added - live on the portal or why not, Show on Web,
// Registration, max kids, iClass Event Type / program / charge category, the price table and its prices,
// due at sign-up - plus the data errors and AI review flags. They read `extras` (src/lib/exportData.js
// fetchExportExtras). A camp or appointment whose setup was not read shows BLANK, never a guess.
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
const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '');
const money = (n) => (n == null || n === '' ? '' : `$${Number(n).toFixed(2).replace(/\.00$/, '')}`);

// The iClass appointment number, from the event's own link (".../appointment-details/1768").
export const iclassAppointmentId = (e) => {
  const m = String(e?.event_url || '').match(/\/appointment-details\/(\d+)/);
  return m ? Number(m[1]) : null;
};
export const setupKey = (e) => `${e.gym_id}:${iclassCampId(e)}`;
export const appointmentKey = (e) => `${e.gym_id}:${iclassAppointmentId(e)}`;

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

// FULL / Almost full (3 or fewer) / Open, from spotsOf; '' when no count was read. Shared by the Status
// column and the Export window's Spots filter so they can never disagree.
export function statusOf(e, dayCounts) {
  const s = spotsOf(e, dayCounts);
  if (s.left === null) return '';
  return s.left <= 0 ? 'FULL' : s.left <= 3 ? 'Almost full' : 'Open';
}
// iClass Event Type / Program for the filters: the signed-in setup read first, else what the sync saved.
export const eventTypeOf = (e, extras) => setupOf(e, extras)?.eventType || e.camp_type || '';
export const programOf = (e, extras) => setupOf(e, extras)?.program || e.program_name || '';
// A price table's boxes as one line, in iClass's own grid: rows = number of days (camps) or time slots
// (appointments), across = 1st / 2nd / 3rd child. A row where every child pays the same shows once
// ("1 day $120"); otherwise "1st $35, 2nd+ $30". A blank box in iClass says BLANK.
const ordinal = (k) => (k === 1 ? '1st' : k === 2 ? '2nd' : k === 3 ? '3rd' : `${k}th`);
export function formatPrices(cells, unit = 'day') {
  if (!Array.isArray(cells) || !cells.length) return '';
  const rows = [...new Set(cells.map((c) => c.rows))].sort((a, b) => a - b);
  return rows.map((r) => {
    const line = cells.filter((c) => c.rows === r).sort((a, b) => a.child - b.child);
    const label = `${r} ${unit}${r === 1 ? '' : 's'}`;
    const amounts = line.map((c) => (c.amount == null ? 'BLANK' : money(c.amount)));
    if (amounts.every((a) => a === amounts[0])) return `${label} ${amounts[0]}`;
    // "1st $35, 2nd+ $30": once the rest repeat, say it once
    const parts = [];
    for (let i = 0; i < line.length; i += 1) {
      const rest = amounts.slice(i);
      if (i > 0 && rest.every((a) => a === amounts[i]) && rest.length > 1) { parts.push(`${ordinal(line[i].child)}+ ${amounts[i]}`); break; }
      parts.push(`${ordinal(line[i].child)} ${amounts[i]}`);
    }
    return `${label}: ${parts.join(', ')}`;
  }).join(' · ');
}

export const hoursOf = (e) => {
  if (Array.isArray(e.daily_schedule) && e.daily_schedule.length) {
    return e.daily_schedule.map((d) => {
      const hrs = d.start_time ? `${d.start_time}${d.end_time ? '-' + d.end_time : ''}` : '';
      return clean(`${d.day || ''} ${hrs}`);
    }).join(' | ');
  }
  return e.time || '';
};

export const agesOf = (e) => {
  const hasMin = e.age_min !== null && e.age_min !== undefined;
  const hasMax = e.age_max !== null && e.age_max !== undefined;
  if (hasMin && hasMax) return `${e.age_min}-${e.age_max}`;
  if (hasMin) return `${e.age_min}+`;
  return '';
};

// The signed-in setup facts for one event, whichever kind it is. null = not read (column stays blank).
// Shape: { kind, showOnWeb, registration, maxKids, eventType, program, chargeCategory, chargeExpires,
//          priceTable, prices, dueAtSignup, readAt }
export function setupOf(e, extras) {
  const x = extras || {};
  const apptId = iclassAppointmentId(e);
  if (apptId) {
    const a = (x.appointments || {})[appointmentKey(e)];
    if (!a) return null;
    const r = a.raw || {};
    const tableKey = `${e.gym_id}:${r.pricingScheduleId}`;
    return {
      kind: 'appointment',
      showOnWeb: r.showOnCustomerPortal ?? null,
      registration: r.allowWebRegistration ?? null,
      maxKids: r.maxStudents ?? null,
      eventType: r.service?.name || null,
      program: null,
      chargeCategory: null,
      chargeExpires: null,
      priceTable: r.pricingScheduleId == null ? 'No price table set' : ((x.appointmentTableNames || {})[tableKey] || ''),
      prices: formatPrices((x.appointmentCells || {})[tableKey], 'slot'),
      dueAtSignup: null,
      readAt: a.read_at,
    };
  }
  const c = (x.camps || {})[setupKey(e)];
  if (!c) return null;
  return {
    kind: 'camp',
    showOnWeb: c.show_on_web ?? null,
    registration: c.allow_registration ?? null,
    maxKids: c.max_entries ?? null,
    eventType: c.camp_type_name || null,
    program: c.program_name || null,
    chargeCategory: c.charge_category_name || null,
    chargeExpires: c.charge_category_expires || null,
    priceTable: c.price_table_id == null ? 'No price table set' : (c.price_table_name || ''),
    prices: formatPrices((x.campCells || {})[`${e.gym_id}:${c.price_table_id}`], 'day'),
    dueAtSignup: c.due_at_signup ?? null,
    readAt: c.read_at,
  };
}

// The errors a manager has to fix on this event, minus the ones dismissed (ctx.isDismissed).
const dataErrorsOf = (e, ctx) => (e.validation_errors || [])
  .filter((err) => err && err.type !== 'sold_out' && !(ctx.isDismissed && ctx.isDismissed(e, err.message)))
  .map((err) => err.message);
const aiFlagsOf = (e, ctx) => (e.ai_review_flags || [])
  .filter((f) => f && !(ctx.isDismissed && ctx.isDismissed(e, f.message)))
  .map((f) => f.message);

// Every column, in order, in groups for the picker. key = what the picker remembers; get(e, ctx) = the cell.
// ctx = { gymName(id), dayCounts, extras, isDismissed(event, message) }
export const COLUMN_GROUPS = ['Event', 'Spots & sign-up', 'Live on the portal', 'Price', 'Where it lives in iClass', 'Errors'];
export const EVENT_COLUMNS = [
  { group: 'Event', key: 'gym', label: 'Gym', get: (e) => e.gym_id || '' },
  { group: 'Event', key: 'gym_name', label: 'Gym Name', get: (e, c) => c.gymName(e.gym_id) || e.gym_name || '' },
  { group: 'Event', key: 'bucket', label: 'Bucket', get: (e) => e.type || '' },
  { group: 'Event', key: 'title', label: 'Event', get: (e) => clean(e.title) },
  { group: 'Event', key: 'start', label: 'Start', get: (e) => mdy(e.start_date || e.date) },
  { group: 'Event', key: 'end', label: 'End', get: (e) => { const s = ymd(e.start_date || e.date); const en = ymd(e.end_date); return en && en !== s ? mdy(en) : ''; } },
  { group: 'Event', key: 'day', label: 'Day', get: (e) => e.day_of_week || '' },
  { group: 'Event', key: 'hours', label: 'Hours', get: (e) => hoursOf(e) },
  { group: 'Event', key: 'ages', label: 'Ages', get: (e) => agesOf(e) },
  { group: 'Event', key: 'description', label: 'Description', get: (e) => clean(e.description) },
  { group: 'Event', key: 'desc_status', label: 'Description Status', get: (e) => e.description_status || '' },
  { group: 'Event', key: 'link', label: 'Link', get: (e) => e.event_url || '' },

  { group: 'Spots & sign-up', key: 'spots', label: 'Spots Left', get: (e, c) => { const s = spotsOf(e, c.dayCounts); return s.left === null ? '' : s.left; } },
  { group: 'Spots & sign-up', key: 'spots_by_day', label: 'Spots by Day', get: (e, c) => spotsOf(e, c.dayCounts).byDay },
  { group: 'Spots & sign-up', key: 'status', label: 'Status', get: (e, c) => statusOf(e, c.dayCounts) },
  { group: 'Spots & sign-up', key: 'max_kids', label: 'Max Kids', get: (e, c) => setupOf(e, c.extras)?.maxKids ?? '' },
  // per day vs whole camp only means something when the event runs more than one day (blank for a one-day event)
  { group: 'Spots & sign-up', key: 'signup', label: 'Sign-up', get: (e) => {
    const s = ymd(e.start_date || e.date); const en = ymd(e.end_date);
    if (!en || en === s) return '';
    return e.allow_choose_days === true ? 'Per day' : e.allow_choose_days === false ? 'Whole camp only' : '';
  } },
  { group: 'Spots & sign-up', key: 'reg_open', label: 'Registration Opens', get: (e) => mdy(e.registration_start_date) },
  { group: 'Spots & sign-up', key: 'reg_close', label: 'Registration Closes', get: (e) => mdy(e.registration_end_date) },

  { group: 'Live on the portal', key: 'live', label: 'Live on Portal', get: (e) => (e.not_on_portal ? 'Not live' : 'Live') },
  { group: 'Live on the portal', key: 'why_not_live', label: 'Why Not Live', get: (e) => (e.not_live_reasons || []).join('; ') },
  { group: 'Live on the portal', key: 'show_on_web', label: 'Show on Web', get: (e, c) => yesNo(setupOf(e, c.extras)?.showOnWeb) },
  { group: 'Live on the portal', key: 'registration_on', label: 'Online Registration', get: (e, c) => yesNo(setupOf(e, c.extras)?.registration) },

  { group: 'Price', key: 'price_table', label: 'Price Table', get: (e, c) => setupOf(e, c.extras)?.priceTable || '' },
  { group: 'Price', key: 'prices', label: 'Prices', get: (e, c) => setupOf(e, c.extras)?.prices || '' },
  { group: 'Price', key: 'due_at_signup', label: 'Due at Sign-up', get: (e, c) => setupOf(e, c.extras)?.dueAtSignup ?? '' },

  { group: 'Where it lives in iClass', key: 'category', label: 'iClass Event Type', get: (e, c) => eventTypeOf(e, c.extras) },
  { group: 'Where it lives in iClass', key: 'program', label: 'iClass Program', get: (e, c) => programOf(e, c.extras) },
  { group: 'Where it lives in iClass', key: 'charge_category', label: 'Charge Category', get: (e, c) => {
    const s = setupOf(e, c.extras);
    if (!s?.chargeCategory) return '';
    const expired = s.chargeExpires && ymd(s.chargeExpires) < ymd(new Date().toISOString());
    return expired ? `${s.chargeCategory} (EXPIRED ${mdy(s.chargeExpires)})` : s.chargeCategory;
  } },
  { group: 'Where it lives in iClass', key: 'setup_read', label: 'iClass Setup Read', get: (e, c) => { const s = setupOf(e, c.extras); return s?.readAt ? mdy(s.readAt) : 'not read'; } },

  { group: 'Errors', key: 'data_errors', label: 'Data Errors', get: (e, c) => dataErrorsOf(e, c).join('; ') },
  { group: 'Errors', key: 'ai_flags', label: 'AI Review Flags', get: (e, c) => aiFlagsOf(e, c).join('; ') },
];

// The columns "Copy what's shown" uses when nobody picked (short enough to paste into an email).
export const DEFAULT_COPY_COLUMNS = ['gym', 'gym_name', 'bucket', 'title', 'start', 'end', 'hours', 'ages', 'spots', 'signup', 'link'];

export const sortEvents = (events) => [...events].sort((a, b) =>
  (a.gym_id || '').localeCompare(b.gym_id || '')
  || ymd(a.start_date || a.date).localeCompare(ymd(b.start_date || b.date))
  || (a.title || '').localeCompare(b.title || ''));

// Rows for the picked columns: { columns, rows } with rows as arrays of cell values.
export function buildEventRows(events, { columnKeys, gymsList = [], dayCounts = {}, extras = {}, isDismissed = null }) {
  const cols = EVENT_COLUMNS.filter((c) => !columnKeys || columnKeys.includes(c.key));
  const nameOf = (id) => gymsList.find((g) => g.id === id)?.name || '';
  const ctx = { gymName: nameOf, dayCounts, extras, isDismissed };
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
  return { text, html: tableHTML({ columns, rows }), count: rows.length };
}

export function tableHTML({ columns, rows }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = 'border:1px solid #ccc;padding:4px 8px;font-family:Arial,sans-serif;font-size:13px;vertical-align:top;';
  const linkAt = columns.findIndex((c) => c.key === 'link');
  return '<table style="border-collapse:collapse;">'
    + '<tr>' + columns.map((c) => `<th style="${cell}background:#eee;text-align:left;">${esc(c.label)}</th>`).join('') + '</tr>'
    + rows.map((r) => '<tr>' + r.map((v, i) => `<td style="${cell}">${i === linkAt && v ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)}</td>`).join('') + '</tr>').join('')
    + '</table>';
}
