// ============================================================================
// EXPORT & COPY - 1 Filter -> 2 See it -> 3 Take it (Copy or Download the same thing)
// ============================================================================
// Rebuilt 2026-11-07. Jayme: "the export needs to be totally redone to include everything we have just done
// and also i want the option that whatever is chosen to download can also be bulk copied".
// Redone again the same night. Jayme: "its flat its like a spreadsheet with zero filters for programs - so many
// words zero visual communication everything's off center ... there's no way i can export school year camps
// only? or specific programs?"
//
// - FILTER (left): every way the data can be sliced, each with live counts that follow the other filters:
//   gyms, bucket, iClass Event Type (search "school" -> "Only these" ticks every school-year type at every gym),
//   iClass Program, spots, live on the portal or not. Every value comes from the data - nothing typed here.
// - SEE IT (middle): the count, the filters in play as chips, then the events as cards grouped by gym in the
//   gym's own colors. "Columns" shows exactly what the file / copy will hold. The other sections are tabs.
// - TAKE IT (right): the columns, the format, Copy, Download.
// - Every section is built once (src/lib/exportData.js); the CSV / JSON file, the printable page and the
//   clipboard all get the same tables. The data is read as soon as the filters change, so Copy writes to the
//   clipboard on the click (browsers refuse a clipboard write that comes too long after it).
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';
import { eventsApi } from '../../lib/api';
import {
  EVENT_COLUMNS, COLUMN_GROUPS, DEFAULT_COPY_COLUMNS, setupOf, spotsOf, statusOf,
  eventTypeOf, programOf, hoursOf, agesOf, sortEvents,
} from '../../lib/eventRow';
import { fetchNotLiveRows, toNotLiveEvents } from '../../lib/iclassCamp';
import {
  SECTIONS, buildSections, fetchExportExtras, fetchSetupReads,
  toCSVFile, toJSONFile, toClipboardAll, toHTMLPage,
} from '../../lib/exportData';
import { copyToClipboardRich } from './copyVisible';
import { getErrorLabel } from './constants';

const ALL_COLUMNS = EVENT_COLUMNS.map((c) => c.key);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ymd = (v) => (v ? String(v).split('T')[0] : '');
const mdyShort = (s) => { const [y, m, d] = s.split('-').map(Number); return `${m}/${d}/${y}`; };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const load = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch (e) { return fallback; } };
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ } };

// Column sets: one tap sets the Events columns; change any column after.
const COLUMN_SETS = [
  { key: 'basics', label: 'Basics', columns: DEFAULT_COPY_COLUMNS },
  { key: 'spots', label: 'Spots', columns: ['gym', 'bucket', 'title', 'start', 'end', 'spots', 'spots_by_day', 'status', 'max_kids', 'signup', 'reg_open', 'reg_close', 'link'] },
  { key: 'prices', label: 'Prices', columns: ['gym', 'bucket', 'title', 'start', 'end', 'category', 'price_table', 'prices', 'due_at_signup', 'link'] },
  { key: 'live', label: 'Live?', columns: ['gym', 'bucket', 'title', 'start', 'end', 'live', 'why_not_live', 'show_on_web', 'registration_on', 'reg_open', 'reg_close', 'link'] },
  { key: 'iclass', label: 'iClass setup', columns: ['gym', 'bucket', 'title', 'start', 'end', 'category', 'program', 'charge_category', 'price_table', 'setup_read', 'link'] },
  { key: 'all', label: 'Everything', columns: ALL_COLUMNS },
];

// Readable text on any gym color: near-black on light fills, white on dark ones.
const inkOn = (hex) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#fff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1f1a1b' : '#fff';
};

// The look (CORE-VISUAL-DESIGN-PHILOSOPHY): dark shell -> white container floating on it -> recessed side
// columns -> lifted white cards. One accent: the calendar's own rose.
const C = {
  shell: '#2b2326', page: '#ffffff', side: '#f1e9ea', card: '#ffffff', ink: '#1f1a1b', soft: '#5a4d50',
  accent: '#7a4f57', accentHover: '#64404a', tint: '#f6e9eb', line: '#e4d8da', head: '#3a2e31',
  open: '#166534', openBg: '#dcfce7', almost: '#92400e', almostBg: '#fef3c7', full: '#991b1b', fullBg: '#fee2e2',
};
const LIFT = '0 6px 18px rgba(0,0,0,.10), 0 2px 5px rgba(0,0,0,.08)';
const FLOAT = '0 20px 60px rgba(0,0,0,.35), 0 8px 20px rgba(0,0,0,.25)';
const SPOT_STYLE = {
  Open: { bg: C.openBg, fg: C.open },
  'Almost full': { bg: C.almostBg, fg: C.almost },
  FULL: { bg: C.fullBg, fg: C.full },
  'No count': { bg: '#ece6e7', fg: C.soft },
};

// The filters. value(e, x) = the event's value for that filter; x = { extras, dayCounts }.
const FACETS = [
  { key: 'gym', label: 'Gyms', value: (e) => e.gym_id },
  { key: 'bucket', label: 'Bucket', value: (e) => e.type || '(none)' },
  { key: 'etype', label: 'iClass Event Type', search: true, value: (e, x) => eventTypeOf(e, x.extras) || '(not read)' },
  { key: 'program', label: 'iClass Program', search: true, value: (e, x) => programOf(e, x.extras) || '(no program)' },
  { key: 'spots', label: 'Spots', value: (e, x) => statusOf(e, x.dayCounts) || 'No count' },
  { key: 'live', label: 'Live on the portal', value: (e) => (e.not_on_portal ? 'Not live yet' : 'Live') },
];
const NO_FILTER = { gym: null, bucket: null, etype: null, program: null, spots: null, live: ['Live'] };

export default function ExportModal({ onClose, gyms, monthlyRequirements, currentMonth, currentYear, acknowledgedPatterns = [] }) {
  // ---------------------------------------------------------------- picks
  const [startDate, setStartDate] = useState(iso(new Date(currentYear, currentMonth, 1)));
  const [endDate, setEndDate] = useState(iso(new Date(currentYear, currentMonth + 1, 0)));
  const [filters, setFilters] = useState(NO_FILTER);   // facet key -> null (everything) or the values kept
  const [search, setSearch] = useState('');             // words in the event name
  const [facetSearch, setFacetSearch] = useState({});   // facet key -> typed words
  const [eventTypes, setEventTypes] = useState([]);     // buckets, in the event_types table's order
  const [sections, setSections] = useState(() => load('export_sections', ['events']));
  const [dropped, setDropped] = useState(() => load('export_columns_dropped', []));
  const [format, setFormat] = useState('csv');
  const [note, setNote] = useState('');
  const [previewKey, setPreviewKey] = useState('events');
  const [eventsView, setEventsView] = useState('cards');
  const [showColumnList, setShowColumnList] = useState(false);

  useEffect(() => {
    supabase.from('event_types').select('name').order('name').then(({ data }) => setEventTypes((data || []).map((r) => r.name).filter(Boolean)));
  }, []);
  useEffect(() => save('export_sections', sections), [sections]);
  useEffect(() => save('export_columns_dropped', dropped), [dropped]);
  const columnKeys = useMemo(() => ALL_COLUMNS.filter((k) => !dropped.includes(k)), [dropped]);

  // Sync log: only after the * PIN unlock (same unlock as before)
  const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('export_admin_unlocked') === 'true');
  useEffect(() => {
    if (isAdmin) return undefined;
    const onKey = (e) => {
      if (e.key !== '*' || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      const pin = prompt('Enter PIN to unlock the Sync log:');
      if (pin === ADMIN_PIN) { setIsAdmin(true); sessionStorage.setItem('export_admin_unlocked', 'true'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAdmin, ADMIN_PIN]);

  // ---------------------------------------------------------------- data
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [notLiveRaw, setNotLiveRaw] = useState(null);
  const [extrasState, setExtrasState] = useState({ key: '', dayCounts: {}, extras: {} });
  const [setupReads, setSetupReads] = useState([]);
  const [syncLog, setSyncLog] = useState([]);
  const [dbRange, setDbRange] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoadingEvents(true);
    eventsApi.getAll(startDate, endDate)       // every event that touches the dates, page by page
      .then((d) => { if (alive) setEvents(d || []); })
      .catch(() => { if (alive) setEvents([]); })
      .finally(() => { if (alive) setLoadingEvents(false); });
    setNotLiveRaw(null);
    fetchNotLiveRows(startDate, endDate)       // camps built in iClass but not live (the faded calendar camps)
      .then((r) => { if (alive) setNotLiveRaw(r); })
      .catch(() => { if (alive) setNotLiveRaw({ rows: [], rules: [] }); });
    return () => { alive = false; };
  }, [startDate, endDate]);

  useEffect(() => {
    Promise.all([
      supabase.from('events').select('start_date').is('deleted_at', null).order('start_date', { ascending: true }).limit(1),
      supabase.from('events').select('end_date').is('deleted_at', null).order('end_date', { ascending: false }).limit(1),
    ]).then(([a, b]) => {
      const first = a.data?.[0]?.start_date; const last = b.data?.[0]?.end_date;
      if (first && last) setDbRange({ first: String(first).slice(0, 10), last: String(last).slice(0, 10) });
    });
  }, []);

  useEffect(() => {
    if (!isAdmin || !sections.includes('sync') || syncLog.length) return;
    supabase.from('sync_log').select('*').order('last_synced', { ascending: false }).limit(100).then(({ data }) => setSyncLog(data || []));
  }, [isAdmin, sections, syncLog.length]);

  // Every event the filters can choose from: live ones + the not-live camps
  const notLiveEvents = useMemo(() => (notLiveRaw ? toNotLiveEvents(notLiveRaw.rows, notLiveRaw.rules, gyms, events) : []), [notLiveRaw, gyms, events]);
  const pool = useMemo(() => [...events, ...notLiveEvents], [events, notLiveEvents]);

  // The iClass setup facts (event type, program, spots by day, prices) for the whole pool - the filters need them
  const poolKey = pool.map((e) => e.id).join(',');
  useEffect(() => {
    let alive = true;
    if (!pool.length) { setExtrasState({ key: poolKey, dayCounts: {}, extras: {} }); return undefined; }
    fetchExportExtras(pool)
      .then((r) => { if (alive) setExtrasState({ key: poolKey, ...r }); })
      .catch((err) => { if (alive) setExtrasState({ key: poolKey, dayCounts: {}, extras: {}, error: err.message }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey]);
  const extrasReady = extrasState.key === poolKey;
  const x = useMemo(() => ({ extras: extrasState.extras, dayCounts: extrasState.dayCounts }), [extrasState]);

  // ---------------------------------------------------------------- filtering
  const words = search.trim().toLowerCase();
  const passes = (e, skip) => FACETS.every((f) => f.key === skip || !filters[f.key] || filters[f.key].includes(f.value(e, x)))
    && (!words || String(e.title || '').toLowerCase().includes(words));
  const picked = useMemo(() => pool.filter((e) => passes(e, null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, filters, words, x]);

  // Each filter's options + counts (counts follow every OTHER filter, so a number is what you'd get by ticking it)
  const facetData = useMemo(() => {
    const out = {};
    FACETS.forEach((f) => {
      const all = {};
      if (f.key === 'gym') gyms.forEach((g) => { all[g.id] = 0; });          // every gym shows, even with 0 events
      if (f.key === 'bucket') eventTypes.forEach((t) => { all[t] = 0; });    // every bucket shows
      pool.forEach((e) => { const v = f.value(e, x); all[v] = all[v] || 0; });
      pool.filter((e) => passes(e, f.key)).forEach((e) => { const v = f.value(e, x); all[v] += 1; });
      let values = Object.keys(all);
      if (f.key === 'gym') values = gyms.map((g) => g.id).filter((id) => id in all).concat(values.filter((v) => !gyms.some((g) => g.id === v)));
      else if (f.key === 'bucket') values = eventTypes.filter((t) => t in all).concat(values.filter((v) => !eventTypes.includes(v)));
      else if (f.key === 'spots') values = ['Open', 'Almost full', 'FULL', 'No count'].filter((v) => v in all);
      else if (f.key === 'live') values = ['Live', 'Not live yet'].filter((v) => v in all);
      else values.sort((a, b) => (all[b] - all[a]) || a.localeCompare(b));
      out[f.key] = { values, counts: all };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, filters, words, x, gyms, eventTypes]);

  const isOn = (fk, v) => !filters[fk] || filters[fk].includes(v);
  const toggleValue = (fk, v) => setFilters((prev) => {
    const all = facetData[fk].values;
    const cur = prev[fk] || all;
    const next = cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v];
    return { ...prev, [fk]: next.length === all.length ? null : next };
  });
  const onlyValues = (fk, vals) => setFilters((prev) => ({ ...prev, [fk]: vals }));
  const resetFacet = (fk) => setFilters((prev) => ({ ...prev, [fk]: NO_FILTER[fk] }));
  const clearAll = () => { setFilters(NO_FILTER); setSearch(''); setFacetSearch({}); };

  // ---------------------------------------------------------------- the tables
  const reqEvents = useMemo(() => events.filter((e) => isOn('gym', e.gym_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, filters]);
  const pickedGyms = gyms.map((g) => g.id).filter((id) => isOn('gym', id));
  const gymsKey = pickedGyms.join(',');
  useEffect(() => {
    let alive = true;
    fetchSetupReads(pickedGyms).then((r) => { if (alive) setSetupReads(r); }).catch(() => { if (alive) setSetupReads([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymsKey]);

  const ctx = useMemo(() => ({
    events: picked,
    columnKeys,
    gyms,
    gymIds: pickedGyms,
    gymName: (id) => gyms.find((g) => g.id === id)?.name || '',
    dayCounts: extrasState.dayCounts,
    extras: extrasState.extras,
    isDismissed: (e, msg) => isErrorAcknowledgedAnywhere(e, msg, acknowledgedPatterns),
    errorLabel: (t) => getErrorLabel(t) || t,
    requirements: monthlyRequirements,
    startDate, endDate, setupReads, syncLog,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [picked, columnKeys, gyms, gymsKey, extrasState, acknowledgedPatterns, monthlyRequirements, startDate, endDate, setupReads, syncLog]);

  const visibleSections = SECTIONS.filter((s) => !s.admin || isAdmin);
  const activeKeys = sections.filter((k) => visibleSections.some((s) => s.key === k));
  const allTables = useMemo(() => {
    const tables = buildSections(visibleSections.map((s) => s.key), ctx);
    // requirements count live events by gym only (every bucket), whatever else is filtered
    const req = buildSections(['requirements'], { ...ctx, events: reqEvents })[0];
    return tables.map((t) => (t.key === 'requirements' ? req : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, isAdmin, reqEvents]);
  const tableOf = (k) => allTables.find((t) => t.key === k);
  const chosenTables = activeKeys.map(tableOf).filter(Boolean);

  const busy = loadingEvents || !extrasReady || !notLiveRaw;
  const totalRows = chosenTables.reduce((n, t) => n + t.rows.length, 0);
  const canGo = !busy && chosenTables.length > 0 && !(activeKeys.length === 1 && activeKeys[0] === 'events' && !columnKeys.length);

  // ---------------------------------------------------------------- actions
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((y) => y !== v) : [...list, v]);
  const setRange = (a, b) => { setStartDate(a); setEndDate(b); };
  const today = new Date();
  const ranges = [
    ['This month', iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0))],
    ['Next month', iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)), iso(new Date(today.getFullYear(), today.getMonth() + 2, 0))],
    ['Today on', iso(today), dbRange?.last || iso(new Date(today.getFullYear() + 1, 11, 31))],
    ['Everything', dbRange?.first, dbRange?.last],
  ];

  // The filters in play, as words (shown as chips, and written at the top of the file / copy)
  const chips = [];
  FACETS.forEach((f) => {
    const kept = filters[f.key];
    if (!kept || JSON.stringify(kept) === JSON.stringify(NO_FILTER[f.key])) return;
    chips.push({ key: f.key, text: `${f.label}: ${kept.length ? kept.join(', ') : 'none'}` });
  });
  if (words) chips.push({ key: 'search', text: `Name has "${search.trim()}"` });
  const liveNote = filters.live === null ? 'live + not live' : (filters.live || []).join(' + ');

  const heading = `Master Events Calendar - ${mdyShort(startDate)} to ${mdyShort(endDate)}`;
  const subheading = [chips.length ? chips.map((c) => c.text).join(' · ') : `every gym, every bucket, ${liveNote}`, `made ${new Date().toLocaleString('en-US')}`].join(' · ');
  const fileName = (ext) => `master-calendar-${activeKeys.length > 2 ? 'combined' : activeKeys.join('-').replace(/_/g, '-')}-${startDate}_to_${endDate}.${ext}`;

  const download = () => {
    if (!canGo) return;
    if (format === 'html') {
      const url = URL.createObjectURL(new Blob([toHTMLPage(chosenTables, heading, subheading)], { type: 'text/html' }));
      window.open(url, '_blank');
      setNote(`Opened the printable page · ${totalRows} rows`);
      return;
    }
    const content = format === 'json'
      ? toJSONFile(chosenTables, { made: new Date().toISOString(), dates: { from: startDate, to: endDate }, filters: chips.map((c) => c.text) },
        activeKeys.includes('events') ? picked : null)
      : toCSVFile(chosenTables, `${heading} (${subheading})`);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName(format);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNote(`Downloaded · ${totalRows} rows`);
  };

  const copy = async () => {
    if (!canGo) return;
    try {
      const payload = toClipboardAll(chosenTables);
      await copyToClipboardRich(payload);
      setNote(`Copied ${payload.rows} rows - paste into email, Docs, Sheets or Excel`);
    } catch (err) {
      setNote(`Could not copy: ${err.message}`);
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ---------------------------------------------------------------- pieces
  const gymOf = (id) => gyms.find((g) => g.id === id);
  const colorOf = (id) => (gymOf(id)?.brand_colors || [])[0] || C.accent;
  const checkbox = (on) => (
    <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[12px] font-black flex-shrink-0"
      style={{ background: on ? C.accent : '#fff', color: '#fff', border: `2px solid ${on ? C.accent : '#b9aaad'}` }}>{on ? '✓' : ''}</span>
  );

  const facetCard = (f) => {
    const d = facetData[f.key] || { values: [], counts: {} };
    const kept = filters[f.key];
    const changed = JSON.stringify(kept) !== JSON.stringify(NO_FILTER[f.key]);
    const q = (facetSearch[f.key] || '').trim().toLowerCase();
    const shown = q ? d.values.filter((v) => v.toLowerCase().includes(q)) : d.values;
    const keptCount = kept ? kept.length : d.values.length;

    if (f.key === 'gym') {
      return (
        <div key={f.key} className="rounded-xl p-3" style={{ background: C.card, boxShadow: LIFT }}>
          {facetHead(f, `${keptCount} of ${d.values.length}`, changed)}
          <div className="grid grid-cols-2 gap-1.5">
            {d.values.map((id) => {
              const g = gymOf(id); const on = isOn('gym', id); const n = d.counts[id] || 0;
              return (
                <button key={id} type="button" onClick={() => toggleValue('gym', id)} title={`${g?.name || id} - tap to ${on ? 'leave out' : 'add'}`}
                  className="group relative flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg cursor-pointer transition-all"
                  style={{ background: on ? '#fff' : '#f3eeee', boxShadow: on ? `inset 0 0 0 2px ${colorOf(id)}` : 'none', opacity: on ? 1 : 0.55 }}>
                  {g?.logo_url ? <img src={g.logo_url} alt="" className="w-6 h-6 rounded-full object-cover bg-white flex-shrink-0" /> : <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: colorOf(id) }} />}
                  <span className="text-[13px] font-black" style={{ color: C.ink }}>{id}</span>
                  <span className="ml-auto text-[13px] font-bold" style={{ color: C.soft }}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (f.key === 'spots' || f.key === 'live') {
      return (
        <div key={f.key} className="rounded-xl p-3" style={{ background: C.card, boxShadow: LIFT }}>
          {facetHead(f, null, changed)}
          <div className="flex flex-wrap gap-1.5">
            {d.values.map((v) => {
              const on = isOn(f.key, v); const st = f.key === 'spots' ? SPOT_STYLE[v] : (v === 'Live' ? SPOT_STYLE.Open : SPOT_STYLE['No count']);
              return (
                <button key={v} type="button" onClick={() => toggleValue(f.key, v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold cursor-pointer"
                  style={{ background: on ? st.bg : '#fff', color: on ? st.fg : C.soft, border: `2px solid ${on ? st.fg : C.line}`, opacity: on ? 1 : 0.6 }}>
                  {v} <span className="font-black">{d.counts[v] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div key={f.key} className="rounded-xl p-3" style={{ background: C.card, boxShadow: LIFT }}>
        {facetHead(f, `${keptCount} of ${d.values.length}`, changed)}
        {f.search && d.values.length > 6 && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <input value={facetSearch[f.key] || ''} onChange={(e) => setFacetSearch((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.key === 'etype' ? 'Type: school year, summer, half day…' : 'Type to find…'}
              className="flex-1 min-w-0 text-[13px] px-2.5 py-1.5 rounded-lg outline-none" style={{ background: C.tint, color: C.ink, border: `1.5px solid ${C.line}` }} />
            {q && shown.length > 0 && (
              <button type="button" onClick={() => onlyValues(f.key, shown)} className="text-[12px] font-black px-2.5 py-1.5 rounded-lg text-white cursor-pointer flex-shrink-0" style={{ background: C.accent }}>
                Only these {shown.length}
              </button>
            )}
          </div>
        )}
        <div className="space-y-0.5 max-h-[230px] overflow-y-auto pr-1">
          {shown.map((v) => {
            const on = isOn(f.key, v); const n = d.counts[v] || 0;
            return (
              <div key={v} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#f6eff0]" style={{ opacity: n === 0 && !on ? 0.45 : 1 }}>
                <button type="button" onClick={() => toggleValue(f.key, v)} className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer">
                  {checkbox(on)}
                  <span className="text-[13px] font-semibold truncate" style={{ color: C.ink }} title={v}>{v}</span>
                </button>
                <button type="button" onClick={() => onlyValues(f.key, [v])} className="hidden group-hover:inline text-[11px] font-black px-1.5 py-0.5 rounded cursor-pointer" style={{ color: C.accent, background: C.tint }}>only</button>
                <span className="text-[13px] font-bold w-8 text-right flex-shrink-0" style={{ color: C.soft }}>{n}</span>
              </div>
            );
          })}
          {!shown.length && <div className="text-[13px] px-1.5 py-1" style={{ color: C.soft }}>Nothing matches "{facetSearch[f.key]}"</div>}
        </div>
      </div>
    );
  };
  function facetHead(f, countText, changed) {
    return (
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: C.ink }}>{f.label}</span>
        <span className="flex items-center gap-2">
          {countText && <span className="text-[12px] font-bold" style={{ color: C.soft }}>{countText}</span>}
          {changed && <button type="button" onClick={() => resetFacet(f.key)} className="text-[12px] font-black hover:underline cursor-pointer" style={{ color: C.accent }}>Reset</button>}
        </span>
      </div>
    );
  }

  // One event as a card: date block · name + facts · spots + price
  const eventCard = (e) => {
    const s = setupOf(e, x.extras);
    const start = ymd(e.start_date || e.date); const end = ymd(e.end_date);
    const [, m, d] = start ? start.split('-').map(Number) : [0, 0, 0];
    const endDay = end && end !== start ? Number(end.split('-')[2]) : null;
    const endMon = end && end !== start && Number(end.split('-')[1]) !== m ? MON[Number(end.split('-')[1]) - 1] : '';
    const sp = spotsOf(e, x.dayCounts); const st = statusOf(e, x.dayCounts) || 'No count'; const ss = SPOT_STYLE[st];
    const etype = eventTypeOf(e, x.extras);
    const facts = [etype || e.type, agesOf(e) && `Ages ${agesOf(e)}`, hoursOf(e).split(' | ')[0]].filter(Boolean);
    return (
      <div key={e.id} className="flex items-stretch gap-3 rounded-xl p-2.5"
        style={{ background: C.card, boxShadow: LIFT, opacity: e.not_on_portal ? 0.62 : 1, border: e.not_on_portal ? `1.5px dashed ${C.soft}` : '1.5px solid transparent' }}>
        <div className="w-[58px] flex-shrink-0 rounded-lg flex flex-col items-center justify-center py-1" style={{ background: C.tint }}>
          <span className="text-[11px] font-black tracking-wider" style={{ color: C.accent }}>{m ? MON[m - 1] : ''}</span>
          <span className="text-[22px] font-black leading-none" style={{ color: C.ink }}>{d || ''}</span>
          {endDay && <span className="text-[11px] font-bold" style={{ color: C.soft }}>to {endMon} {endDay}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold leading-snug line-clamp-2" style={{ color: C.ink }} title={e.title}>{e.title}</div>
          <div className="text-[13px] mt-0.5 truncate" style={{ color: C.soft }}>{facts.join(' · ')}</div>
          {e.not_on_portal && <div className="text-[12px] font-bold mt-0.5" style={{ color: C.ink }}>Not live: {(e.not_live_reasons || [])[0] || 'not on the portal'}</div>}
          {!e.not_on_portal && s?.prices && <div className="text-[12px] mt-0.5 truncate" style={{ color: C.soft }} title={s.prices}>{s.prices}</div>}
        </div>
        <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0">
          <span className="text-[13px] font-black px-2.5 py-1 rounded-full" style={{ background: ss.bg, color: ss.fg }}>
            {sp.left === null ? 'no count' : sp.left <= 0 ? 'FULL' : `${sp.left} left`}
          </span>
          {e.event_url && <a href={e.event_url} target="_blank" rel="noreferrer" className="text-[12px] font-bold hover:underline" style={{ color: C.accent }}>Open ↗</a>}
        </div>
      </div>
    );
  };

  const cardsView = () => {
    const sorted = sortEvents(picked);
    const groups = [];
    sorted.forEach((e) => {
      const last = groups[groups.length - 1];
      if (last && last.gym === e.gym_id) last.items.push(e); else groups.push({ gym: e.gym_id, items: [e] });
    });
    return (
      <div className="p-4 space-y-5">
        {groups.map((grp) => {
          const g = gymOf(grp.gym); const color = colorOf(grp.gym);
          return (
            <div key={grp.gym}>
              <div className="flex items-center gap-2.5 mb-2 px-3 py-2 rounded-xl sticky top-0 z-10" style={{ background: color, boxShadow: LIFT }}>
                {g?.logo_url && <img src={g.logo_url} alt="" className="w-7 h-7 rounded-full object-cover bg-white" />}
                <span className="text-[15px] font-black" style={{ color: inkOn(color) }}>{g?.name || grp.gym}</span>
                <span className="ml-auto text-[13px] font-black px-2.5 py-0.5 rounded-full" style={{ background: '#fff', color: C.ink }}>{grp.items.length}</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
                {grp.items.map(eventCard)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const tableView = (t, droppable) => (
    <table className="min-w-full text-[13px] border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr>
          {t.columns.map((c) => (
            <th key={c.key} className="text-left font-bold px-2.5 py-2 whitespace-nowrap" style={{ background: C.head, color: '#fff' }}>
              <span className="inline-flex items-center gap-1.5">
                {c.label}
                {droppable && <button type="button" onClick={() => toggle(dropped, setDropped, c.key)} title="Leave this column out" className="w-4 h-4 rounded-full text-[11px] leading-none bg-white/20 hover:bg-white/40 cursor-pointer">×</button>}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {t.rows.slice(0, 200).map((r, i) => (
          <tr key={i} style={{ background: i % 2 ? '#faf6f6' : '#fff' }}>
            {r.map((v, j) => (
              <td key={j} className="px-2.5 py-1.5 align-top" style={{ color: C.ink, borderBottom: `1px solid ${C.line}`, maxWidth: 320 }}>
                <div className="line-clamp-2">{t.columns[j]?.key === 'link' && v ? <a href={v} target="_blank" rel="noreferrer" style={{ color: C.accent }} className="font-bold underline">Open</a> : String(v ?? '')}</div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const preview = tableOf(previewKey);
  const eventsChosen = activeKeys.includes('events');

  // ---------------------------------------------------------------- screen
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(20,14,16,.72)' }} onClick={onClose}>
      <div className="w-full h-full max-w-[1560px] max-h-[95vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: C.shell, boxShadow: FLOAT }} onClick={(e) => e.stopPropagation()}>

        {/* Top bar: title · dates · close - one line, centered on its own axis */}
        <div className="flex items-center gap-4 px-5 py-3">
          <h2 className="text-[22px] font-black text-white whitespace-nowrap">Export &amp; Copy</h2>
          <div className="flex items-center rounded-xl p-1" style={{ background: 'rgba(255,255,255,.12)' }}>
            {ranges.map(([label, a, b]) => {
              const on = a && b && a === startDate && b === endDate;
              return (
                <button key={label} type="button" disabled={!a || !b} onClick={() => setRange(a, b)}
                  className="text-[14px] font-bold px-3.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"
                  style={{ background: on ? '#fff' : 'transparent', color: on ? C.ink : '#fff', boxShadow: on ? '0 2px 6px rgba(0,0,0,.3)' : 'none' }}>{label}</button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white" style={{ color: C.ink }} />
            <span>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white" style={{ color: C.ink }} />
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-10 h-10 rounded-full text-white text-[26px] leading-none hover:bg-white/15 cursor-pointer flex-shrink-0">×</button>
        </div>

        {/* The page floats on the shell: 1 Filter | 2 See it | 3 Take it */}
        <div className="flex-1 min-h-0 mx-3 mb-3 rounded-2xl overflow-hidden flex" style={{ background: C.page, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>

          {/* 1 FILTER */}
          <div className="w-[300px] flex-shrink-0 flex flex-col min-h-0" style={{ background: C.side, borderRight: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-black text-white" style={{ background: C.accent }}>1</span>
                <span className="text-[16px] font-black" style={{ color: C.ink }}>Filter</span>
              </span>
              {(chips.length > 0) && <button type="button" onClick={clearAll} className="text-[13px] font-black hover:underline cursor-pointer" style={{ color: C.accent }}>Clear all</button>}
            </div>
            <div className="px-4 pb-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event names…"
                className="w-full text-[14px] px-3 py-2 rounded-lg outline-none" style={{ background: '#fff', color: C.ink, border: `1.5px solid ${C.line}`, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.06)' }} />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
              {FACETS.map(facetCard)}
            </div>
          </div>

          {/* 2 SEE IT */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-black text-white" style={{ background: C.accent }}>2</span>
                  <span className="text-[34px] font-black leading-none" style={{ color: C.ink }}>{busy ? '…' : picked.length}</span>
                  <span className="text-[16px] font-bold" style={{ color: C.soft }}>events · {mdyShort(startDate)} – {mdyShort(endDate)}</span>
                </span>
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {chips.length === 0 && <span className="text-[13px] font-semibold px-2.5 py-1 rounded-full" style={{ background: C.tint, color: C.ink }}>Every gym · every bucket · live on the portal</span>}
                  {chips.map((c) => (
                    <span key={c.key} title={c.text} className="flex items-center gap-1 text-[13px] font-bold pl-2.5 pr-1 py-1 rounded-full max-w-[420px]" style={{ background: C.accent, color: '#fff' }}>
                      <span className="truncate">{c.text}</span>
                      <button type="button" onClick={() => (c.key === 'search' ? setSearch('') : resetFacet(c.key))} className="w-5 h-5 rounded-full hover:bg-white/25 cursor-pointer flex-shrink-0" aria-label="Remove">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* What goes in: each section is a tab; the box puts it in the file / copy */}
              <div className="flex flex-wrap items-end gap-1 mt-3">
                {visibleSections.map((s) => {
                  const on = sections.includes(s.key); const showing = previewKey === s.key; const t = tableOf(s.key);
                  return (
                    <div key={s.key} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-t-xl"
                      style={{ background: showing ? C.tint : 'transparent', borderBottom: `3px solid ${showing ? C.accent : 'transparent'}` }}>
                      <button type="button" onClick={() => toggle(sections, setSections, s.key)} aria-label={`Put ${s.label} in the file`} className="cursor-pointer">{checkbox(on)}</button>
                      <button type="button" onClick={() => setPreviewKey(s.key)} className="text-[14px] font-bold cursor-pointer whitespace-nowrap" style={{ color: on ? C.ink : C.soft }}>
                        {s.label}{s.admin ? ' · admin' : ''} <span className="font-black" style={{ color: C.accent }}>{busy ? '' : (t ? t.rows.length : 0)}</span>
                      </button>
                    </div>
                  );
                })}
                {previewKey === 'events' && (
                  <div className="ml-auto flex items-center rounded-lg p-0.5 mb-1" style={{ background: C.tint }}>
                    {[['cards', 'Cards'], ['columns', 'Columns']].map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setEventsView(k)} className="text-[13px] font-bold px-3 py-1 rounded-md cursor-pointer"
                        style={{ background: eventsView === k ? '#fff' : 'transparent', color: C.ink, boxShadow: eventsView === k ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
              {preview?.note && !busy && <p className="text-[13px] mt-2" style={{ color: C.soft }}>{preview.note}</p>}
              {extrasState.error && <p className="text-[13px] mt-2 font-bold" style={{ color: C.full }}>iClass setup facts did not load ({extrasState.error}) - those columns are blank.</p>}
            </div>

            <div className="flex-1 min-h-0 overflow-auto" style={{ background: previewKey === 'events' && eventsView === 'cards' ? '#f7f2f3' : '#fff' }}>
              {busy ? (
                <div className="p-8 text-[15px] font-bold" style={{ color: C.soft }}>Reading the data…</div>
              ) : !preview ? null : (previewKey === 'events' ? picked.length === 0 : preview.rows.length === 0) ? (
                <div className="p-8 text-[15px] font-bold" style={{ color: C.soft }}>Nothing matches these filters.{chips.length ? ' ' : ''}{chips.length > 0 && <button type="button" onClick={clearAll} className="underline cursor-pointer" style={{ color: C.accent }}>Clear all filters</button>}</div>
              ) : previewKey === 'events' && eventsView === 'cards' ? cardsView() : tableView(preview, previewKey === 'events')}
              {!busy && preview && (previewKey !== 'events' || eventsView === 'columns') && preview.rows.length > 200 && (
                <div className="px-5 py-3 text-[13px] font-semibold" style={{ color: C.soft }}>First 200 of {preview.rows.length} rows shown here - Copy and Download include all {preview.rows.length}.</div>
              )}
            </div>
          </div>

          {/* 3 TAKE IT */}
          <div className="w-[290px] flex-shrink-0 flex flex-col min-h-0" style={{ background: C.side, borderLeft: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-black text-white" style={{ background: C.accent }}>3</span>
              <span className="text-[16px] font-black" style={{ color: C.ink }}>Take it</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
              <div className="rounded-xl p-3" style={{ background: C.card, boxShadow: LIFT, opacity: eventsChosen ? 1 : 0.5 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: C.ink }}>Event columns</span>
                  <span className="text-[12px] font-bold" style={{ color: C.soft }}>{columnKeys.length} of {ALL_COLUMNS.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {COLUMN_SETS.map((cs) => {
                    const on = cs.columns.length === columnKeys.length && cs.columns.every((k) => columnKeys.includes(k));
                    return (
                      <button key={cs.key} type="button" onClick={() => setDropped(ALL_COLUMNS.filter((k) => !cs.columns.includes(k)))}
                        className="text-[13px] font-bold px-2 py-2 rounded-lg cursor-pointer"
                        style={{ background: on ? C.accent : '#fff', color: on ? '#fff' : C.ink, border: `1.5px solid ${on ? C.accent : C.line}`, boxShadow: on ? '0 3px 8px rgba(122,79,87,.35)' : '0 1px 2px rgba(0,0,0,.06)' }}>{cs.label}</button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setShowColumnList((v) => !v)} className="w-full mt-2 text-[13px] font-black py-1.5 rounded-lg cursor-pointer" style={{ color: C.accent, background: C.tint }}>
                  {showColumnList ? 'Hide the column list' : 'Pick columns one by one'}
                </button>
                {showColumnList && (
                  <div className="mt-2 space-y-2">
                    {COLUMN_GROUPS.map((grp) => (
                      <div key={grp}>
                        <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: C.soft }}>{grp}</div>
                        {EVENT_COLUMNS.filter((c) => c.group === grp).map((c) => {
                          const on = !dropped.includes(c.key);
                          return (
                            <button key={c.key} type="button" onClick={() => toggle(dropped, setDropped, c.key)} className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#f6eff0] cursor-pointer text-left">
                              {checkbox(on)}<span className="text-[13px] font-semibold" style={{ color: C.ink }}>{c.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl p-3" style={{ background: C.card, boxShadow: LIFT }}>
                <div className="text-[12px] font-black uppercase tracking-wider mb-2" style={{ color: C.ink }}>In the file / copy</div>
                {chosenTables.length === 0
                  ? <div className="text-[13px] font-bold" style={{ color: C.full }}>Tick a section in the middle (the boxes on the tabs).</div>
                  : chosenTables.map((t) => (
                    <div key={t.key} className="flex justify-between text-[13px] py-0.5" style={{ color: C.ink }}>
                      <span className="font-semibold">{t.title}</span><span className="font-black">{busy ? '…' : t.rows.length}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* The actions - pinned at the bottom of step 3 */}
            <div className="p-4 space-y-2" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex rounded-lg p-0.5" style={{ background: '#e6dcde' }}>
                {[['csv', 'CSV'], ['json', 'JSON'], ['html', 'Printable']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setFormat(k)} className="flex-1 text-[13px] font-bold py-1.5 rounded-md cursor-pointer"
                    style={{ background: format === k ? '#fff' : 'transparent', color: C.ink, boxShadow: format === k ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>{label}</button>
                ))}
              </div>
              <button onClick={copy} disabled={!canGo} title="Tables for email / Docs, cells for Sheets / Excel"
                className="w-full py-3 rounded-xl font-black text-[15px] text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: C.accent, boxShadow: '0 6px 16px rgba(122,79,87,.45)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}>
                Copy {busy ? '' : `${totalRows} rows`}
              </button>
              <button onClick={download} disabled={!canGo}
                className="w-full py-3 rounded-xl font-black text-[15px] text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: C.head, boxShadow: '0 6px 16px rgba(0,0,0,.30)' }}>
                {format === 'html' ? 'Open printable page' : `Download ${format.toUpperCase()}`}
              </button>
              {note && <div className="text-[13px] font-bold text-center" style={{ color: C.open }}>{note}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
