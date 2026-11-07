// ============================================================================
// EXPORT DATA - every section the Export window offers, built ONCE and handed to every way out
// ============================================================================
// Jayme 2026-11-07: "the export needs to be totally redone to include everything we have just done and also
// i want the option that whatever is chosen to download can also be bulk copied".
//
// So each section builds one table { key, title, note, columns, rows }, and the same tables become:
//   - the CSV file      (toCSVFile)        - each table under its title, one file
//   - the JSON file     (toJSONFile)       - each table as a list of records, plus every event's saved fields
//   - the printable page (toHTMLPage)      - each table on one page, opened in a new tab
//   - the clipboard     (toClipboardAll)   - a real table per section for email / Docs + tab-separated
//                                            cells for Sheets / Excel
// A section can never say something different in the file and in the copy.
//
// Nothing here is typed: buckets come from event_types, requirements from monthly_requirements, gym names
// and codes from the gyms table, prices from the signed-in iClass price tables. A value nobody read stays
// blank, never a guess.
// ============================================================================
import { supabase } from './supabase';
import { iclassCampId } from './iclassCamp';
import {
  buildEventRows, fetchDayCounts, formatPrices, iclassAppointmentId, setupOf, tableHTML,
} from './eventRow';

const ymd = (v) => (v ? String(v).split('T')[0] : '');
const mdy = (v) => { const d = ymd(v); if (!d) return ''; const [y, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}/${y}`; };
const when = (v) => (v ? new Date(v).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const col = (label, key) => ({ label, key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, '_') });

// Read by exact gym + id, a few hundred ids at a time, every page (Supabase answers 1,000 rows max).
// extraOrder makes the order unique, so pages never skip or repeat a row.
async function readByIds(table, select, gyms, idColumn, ids, extraOrder = []) {
  const out = [];
  for (let i = 0; i < ids.length; i += 300) {
    for (let from = 0; ; from += 1000) {
      let q = supabase.from(table).select(select)
        .in('gym_id', gyms).in(idColumn, ids.slice(i, i + 300))
        .order('gym_id').order(idColumn);
      extraOrder.forEach((c) => { q = q.order(c); });
      const { data, error } = await q.range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

// Everything the new columns and sections read, for these events, in one go.
export async function fetchExportExtras(events) {
  const list = events || [];
  const camps = list.filter((e) => !iclassAppointmentId(e) && iclassCampId(e));
  const appts = list.filter((e) => iclassAppointmentId(e));
  const campGyms = [...new Set(camps.map((e) => e.gym_id))];
  const campIds = [...new Set(camps.map((e) => iclassCampId(e)))];
  const apptGyms = [...new Set(appts.map((e) => e.gym_id))];
  const apptIds = [...new Set(appts.map((e) => iclassAppointmentId(e)))];

  const [dayCounts, setupRows, apptRows] = await Promise.all([
    fetchDayCounts(camps),
    campIds.length ? readByIds('iclass_camp_audit',
      'gym_id, camp_id, show_on_web, allow_registration, max_entries, due_at_signup, price_table_id, price_table_name, camp_type_name, program_name, charge_category_name, charge_category_expires, read_at',
      campGyms, 'camp_id', campIds) : [],
    apptIds.length ? readByIds('iclass_appointment_setup', 'gym_id, appointment_id, raw, read_at', apptGyms, 'appointment_id', apptIds) : [],
  ]);

  const campsByKey = {};
  setupRows.forEach((r) => { campsByKey[`${r.gym_id}:${r.camp_id}`] = r; });
  const apptsByKey = {};
  apptRows.forEach((r) => { apptsByKey[`${r.gym_id}:${r.appointment_id}`] = r; });

  // The price boxes of every price table those events use
  const campTables = [...new Set(setupRows.filter((r) => r.price_table_id != null).map((r) => r.price_table_id))];
  const apptTables = [...new Set(apptRows.map((r) => r.raw?.pricingScheduleId).filter((v) => v != null))];
  const [campCellRows, apptCellRows, apptTableRows] = await Promise.all([
    campTables.length ? readByIds('iclass_price_cells', 'gym_id, price_table_id, price_table_name, child_number, days, amount', campGyms, 'price_table_id', campTables, ['child_number', 'days']) : [],
    apptTables.length ? readByIds('iclass_appointment_price_cells', 'gym_id, price_table_id, child_number, time_slots, amount', apptGyms, 'price_table_id', apptTables, ['child_number', 'time_slots']) : [],
    apptTables.length ? readByIds('iclass_appointment_price_tables', 'gym_id, price_table_id, name', apptGyms, 'price_table_id', apptTables) : [],
  ]);
  const campCells = {};
  campCellRows.forEach((c) => { (campCells[`${c.gym_id}:${c.price_table_id}`] ||= []).push({ rows: c.days, child: c.child_number, amount: c.amount }); });
  const appointmentCells = {};
  apptCellRows.forEach((c) => { (appointmentCells[`${c.gym_id}:${c.price_table_id}`] ||= []).push({ rows: c.time_slots, child: c.child_number, amount: c.amount }); });
  const appointmentTableNames = {};
  apptTableRows.forEach((t) => { appointmentTableNames[`${t.gym_id}:${t.price_table_id}`] = t.name; });

  return { dayCounts, extras: { camps: campsByKey, appointments: apptsByKey, campCells, appointmentCells, appointmentTableNames } };
}

// The latest signed-in setup read per gym (so a gym that was never read says so, never "fine").
export async function fetchSetupReads(gymIds) {
  if (!gymIds.length) return [];
  const { data, error } = await supabase.from('iclass_setup_reads')
    .select('id, gym_id, status, what, started_at, finished_at, camps_read, price_tables_read, appointments_read, appointment_price_tables_read, note')
    .in('gym_id', gymIds).order('id', { ascending: false }).range(0, 999);
  if (error) throw new Error(error.message);
  const latest = {};
  (data || []).forEach((r) => { if (!latest[r.gym_id]) latest[r.gym_id] = r; });
  return gymIds.map((g) => latest[g] || { gym_id: g, status: 'never read' });
}

// ---------------------------------------------------------------- the sections

// Events: the picked columns, one row per event (plus camps built in iClass but not live, when ticked).
function eventsSection(ctx) {
  const t = buildEventRows(ctx.events, { columnKeys: ctx.columnKeys, gymsList: ctx.gyms, dayCounts: ctx.dayCounts, extras: ctx.extras, isDismissed: ctx.isDismissed });
  const notLive = ctx.events.filter((e) => e.not_on_portal).length;
  return { key: 'events', title: 'Events', note: notLive ? `${notLive} of these are built in iClass but not live on the portal yet (marked "Not live").` : '', ...t };
}

// Price tables: every price table the picked events use, once, with its prices.
function priceTablesSection(ctx) {
  const used = {};
  ctx.events.forEach((e) => {
    const s = setupOf(e, ctx.extras);
    if (!s || !s.priceTable || s.priceTable === 'No price table set') return;
    const k = `${e.gym_id}|${s.kind}|${s.priceTable}`;
    if (!used[k]) used[k] = { gym: e.gym_id, kind: s.kind === 'appointment' ? 'Appointment' : 'Camp / event', table: s.priceTable, prices: s.prices, count: 0, buckets: new Set() };
    used[k].count += 1;
    if (e.type) used[k].buckets.add(e.type);
  });
  const missing = ctx.events.filter((e) => setupOf(e, ctx.extras)?.priceTable === 'No price table set').length;
  const notRead = ctx.events.filter((e) => !setupOf(e, ctx.extras)).length;
  const rows = Object.values(used)
    .sort((a, b) => a.gym.localeCompare(b.gym) || a.table.localeCompare(b.table))
    .map((u) => [u.gym, ctx.gymName(u.gym), u.kind, u.table, u.prices, u.count, [...u.buckets].join(', ')]);
  const notes = [];
  if (missing) notes.push(`${missing} event${missing === 1 ? ' has' : 's have'} no price table set in iClass.`);
  if (notRead) notes.push(`${notRead} event${notRead === 1 ? '' : 's'} not read from iClass setup yet - no price shown for ${notRead === 1 ? 'it' : 'them'}.`);
  return {
    key: 'price_tables', title: 'Price tables', note: notes.join(' '),
    columns: [col('Gym'), col('Gym Name'), col('Kind'), col('Price Table'), col('Prices'), col('Events Using It'), col('Buckets')],
    rows,
  };
}

// Monthly requirements: per gym, per month in the dates picked, each required bucket have / need.
function requirementsSection(ctx) {
  const required = Object.entries(ctx.requirements || {}).filter(([, n]) => Number(n) > 0);
  const live = ctx.events.filter((e) => !e.not_on_portal);   // a camp that isn't live never counts
  const months = [];
  const [sy, sm] = ctx.startDate.split('-').map(Number);
  const [ey, em] = ctx.endDate.split('-').map(Number);
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y += 1, m = 1) : (m += 1)) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const monthName = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
  const rows = [];
  ctx.gymIds.forEach((g) => months.forEach((mk) => {
    const inMonth = live.filter((e) => e.gym_id === g && ymd(e.start_date || e.date).startsWith(mk));
    const cells = required.map(([bucket, need]) => `${inMonth.filter((e) => e.type === bucket).length} of ${need}`);
    const short = required.filter(([bucket, need]) => inMonth.filter((e) => e.type === bucket).length < Number(need))
      .map(([bucket, need]) => `${Number(need) - inMonth.filter((e) => e.type === bucket).length} ${bucket}`);
    rows.push([g, ctx.gymName(g), monthName(mk), ...cells, short.length ? 'No' : 'Yes', short.join(', ')]);
  }));
  return {
    key: 'requirements', title: 'Monthly requirements',
    note: required.length ? 'Counts only events live on the portal, by the month each one starts.' : 'No monthly requirements are set (Admin > requirements).',
    columns: [col('Gym'), col('Gym Name'), col('Month'), ...required.map(([b]) => col(`${b} (have of need)`, `req_${b}`)), col('Meets All'), col('Short')],
    rows,
  };
}

// Audit findings: one row per thing a manager has to fix - data errors, missing descriptions, AI review flags.
function auditSection(ctx) {
  const rows = [];
  [...ctx.events].sort((a, b) => (a.gym_id || '').localeCompare(b.gym_id || '') || ymd(a.start_date || a.date).localeCompare(ymd(b.start_date || b.date)))
    .forEach((e) => {
      const base = [e.gym_id, (e.title || '').replace(/\s+/g, ' ').trim(), mdy(e.start_date || e.date), e.type || ''];
      (e.validation_errors || []).forEach((err) => {
        if (!err || err.type === 'sold_out' || (ctx.isDismissed && ctx.isDismissed(e, err.message))) return;
        rows.push([...base, 'Data error', ctx.errorLabel(err.type), err.message, e.event_url || '']);
      });
      if (e.description_status === 'none') rows.push([...base, 'Description', 'No description', 'The event has no description text', e.event_url || '']);
      if (e.description_status === 'flyer_only') rows.push([...base, 'Description', 'Flyer only', 'The description is only a picture (no text)', e.event_url || '']);
      (e.ai_review_flags || []).forEach((f) => {
        if (!f || (ctx.isDismissed && ctx.isDismissed(e, f.message))) return;
        rows.push([...base, 'AI review', 'AI review', f.reason ? `${f.message} - ${f.reason}` : f.message, e.event_url || '']);
      });
    });
  return {
    key: 'audit', title: 'Audit findings',
    note: 'Dismissed warnings are left out (they have their own section). Sold-out is not an error.',
    columns: [col('Gym'), col('Event'), col('Start'), col('Bucket'), col('Kind'), col('Check'), col('What Is Wrong'), col('Link', 'link')],
    rows,
  };
}

// Dismissed warnings: one row per warning someone dismissed, with the note.
function dismissedSection(ctx) {
  const rows = [];
  ctx.events.forEach((e) => (e.acknowledged_errors || []).forEach((ack) => {
    const a = typeof ack === 'string' ? { message: ack } : (ack || {});
    rows.push([e.gym_id, (e.title || '').replace(/\s+/g, ' ').trim(), mdy(e.start_date || e.date), e.type || '', a.message || '', a.note || '', a.dismissed_at ? mdy(a.dismissed_at) : '', e.event_url || '']);
  }));
  return {
    key: 'dismissed', title: 'Dismissed warnings', note: '',
    columns: [col('Gym'), col('Event'), col('Start'), col('Bucket'), col('Warning'), col('Note'), col('Dismissed On'), col('Link', 'link')],
    rows,
  };
}

// iClass setup read: per gym, when the signed-in read last ran and what it read.
function setupReadsSection(ctx) {
  return {
    key: 'setup_reads', title: 'iClass setup read per gym',
    note: 'A gym not read has no settings or prices in this export - blank there means not read, not "fine".',
    columns: [col('Gym'), col('Gym Name'), col('Status'), col('Finished'), col('Camps Read'), col('Camp Price Tables'), col('Appointments Read'), col('Appointment Price Tables'), col('Note')],
    rows: (ctx.setupReads || []).map((r) => [r.gym_id, ctx.gymName(r.gym_id), r.status, when(r.finished_at), r.camps_read ?? '', r.price_tables_read ?? '', r.appointments_read ?? '', r.appointment_price_tables_read ?? '', r.note || '']),
  };
}

// Sync log (admin only): the last syncs per gym and bucket.
function syncSection(ctx) {
  return {
    key: 'sync', title: 'Sync log', note: 'The last 100 syncs.',
    columns: [col('Gym'), col('Bucket'), col('Last Synced'), col('Events Found'), col('Events Imported')],
    rows: (ctx.syncLog || []).map((l) => [l.gym_id, l.event_type, when(l.last_synced), l.events_found ?? '', l.events_imported ?? '']),
  };
}

// The sections, in the order they print. `admin` = only after the * PIN unlock.
export const SECTIONS = [
  { key: 'events', label: 'Events', icon: '📋', desc: 'One row per event, the columns you pick.', build: eventsSection },
  { key: 'price_tables', label: 'Price tables', icon: '💲', desc: 'Every iClass price table those events use, with its prices.', build: priceTablesSection },
  { key: 'requirements', label: 'Monthly requirements', icon: '📊', desc: 'Per gym, per month: each required bucket, have of need.', build: requirementsSection },
  { key: 'audit', label: 'Audit findings', icon: '⚠️', desc: 'Data errors, missing descriptions and AI review flags - one row each.', build: auditSection },
  { key: 'dismissed', label: 'Dismissed warnings', icon: '✓', desc: 'Warnings someone dismissed, with the note.', build: dismissedSection },
  { key: 'setup_reads', label: 'iClass setup read per gym', icon: '🔐', desc: 'When each gym\'s settings and prices were last read.', build: setupReadsSection },
  { key: 'sync', label: 'Sync log', icon: '🔄', desc: 'The last 100 syncs.', build: syncSection, admin: true },
];

export function buildSections(keys, ctx) {
  return SECTIONS.filter((s) => keys.includes(s.key)).map((s) => s.build(ctx));
}

// ---------------------------------------------------------------- the ways out

const csvCell = (v) => (typeof v === 'number' ? String(v) : `"${String(v ?? '').replace(/"/g, '""')}"`);

export function toCSVFile(tables, heading) {
  const parts = [csvCell(heading), ''];
  tables.forEach((t) => {
    parts.push(csvCell(`${t.title.toUpperCase()} (${t.rows.length})`));
    if (t.note) parts.push(csvCell(t.note));
    parts.push(t.columns.map((c) => csvCell(c.label)).join(','));
    t.rows.forEach((r) => parts.push(r.map(csvCell).join(',')));
    parts.push('');
  });
  return parts.join('\n');
}

export function toJSONFile(tables, meta, events) {
  const out = { ...meta, sections: {} };
  tables.forEach((t) => {
    out.sections[t.key] = {
      title: t.title, note: t.note || undefined,
      rows: t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c.label, r[i]]))),
    };
  });
  if (events) out.events_all_saved_fields = events;
  return JSON.stringify(out, null, 2);
}

// Clipboard: every chosen section, each under its title - pastes as tables in Gmail / Outlook / Docs and
// as cells (a blank row between sections) in Sheets / Excel.
export function toClipboardAll(tables) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tsvRow = (r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t');
  const text = tables.map((t) => [
    `${t.title} (${t.rows.length})`,
    tsvRow(t.columns.map((c) => c.label)),
    ...t.rows.map(tsvRow),
  ].join('\n')).join('\n\n');
  const html = tables.map((t) => `<h3 style="font-family:Arial,sans-serif;margin:16px 0 6px;">${esc(t.title)} (${t.rows.length})</h3>`
    + (t.note ? `<p style="font-family:Arial,sans-serif;font-size:12px;margin:0 0 6px;">${esc(t.note)}</p>` : '')
    + tableHTML(t)).join('');
  return { text, html, rows: tables.reduce((n, t) => n + t.rows.length, 0) };
}

// A plain printable page with every chosen section (opened in a new tab; print or save from there).
export function toHTMLPage(tables, heading, subheading) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = tables.map((t) => `
  <section>
    <h2>${esc(t.title)} <span class="n">${t.rows.length}</span></h2>
    ${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}
    <div class="wrap"><table>
      <thead><tr>${t.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map((r) => `<tr>${r.map((v, i) => `<td>${t.columns[i]?.key === 'link' && v ? `<a href="${esc(v)}" target="_blank">Open</a>` : esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${t.columns.length}">Nothing for these filters.</td></tr>`}</tbody>
    </table></div>
  </section>`).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(heading)}</title>
<style>
  body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;margin:0;padding:24px;color:#1f2933;background:#fff}
  header{border-bottom:3px solid #1f2933;padding-bottom:10px;margin-bottom:20px}
  h1{font-size:24px;margin:0}
  .sub{font-size:14px;margin-top:4px}
  h2{font-size:18px;margin:28px 0 6px;display:flex;align-items:center;gap:8px}
  .n{background:#1f2933;color:#fff;border-radius:999px;font-size:12px;padding:2px 10px}
  .note{font-size:13px;margin:0 0 8px}
  .wrap{overflow-x:auto}
  table{border-collapse:collapse;font-size:12px;width:100%}
  th{background:#1f2933;color:#fff;text-align:left;padding:6px 8px;white-space:nowrap}
  td{border-bottom:1px solid #d9dee3;padding:5px 8px;vertical-align:top}
  tr:nth-child(even) td{background:#f5f7f9}
  a{color:#1d4ed8}
  @media print{body{padding:0}th{background:#1f2933 !important;color:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:auto}}
</style></head><body>
<header><h1>${esc(heading)}</h1><div class="sub">${esc(subheading)}</div></header>
${body}
</body></html>`;
}

export { formatPrices };
