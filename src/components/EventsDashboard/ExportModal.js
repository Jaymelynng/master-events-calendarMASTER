// ============================================================================
// EXPORT & COPY - pick the dates, gyms, buckets, sections and columns; then Download OR Copy the same thing
// ============================================================================
// Rebuilt 2026-11-07. Jayme: "the export needs to be totally redone to include everything we have just done
// and also i want the option that whatever is chosen to download can also be bulk copied".
//
// - Every section is built once (src/lib/exportData.js) and the same tables go to the CSV / JSON file, the
//   printable page and the clipboard, so a download and a copy can never disagree.
// - The data behind every section is read as soon as the filters change, so Copy writes to the clipboard
//   right on the click (browsers refuse a clipboard write that comes too long after it).
// - Nothing typed: buckets from event_types, requirements from monthly_requirements, gym colors from
//   gyms.brand_colors, prices from the signed-in iClass price tables. Before this rebuild the window had a
//   typed gym-color list (AGA instead of AAG, MGC's old color, no EAG), typed requirement fallbacks
//   (1 / 2 / 1) and a "SPECIAL EVENT" count for a bucket that no longer exists.
// - Your picks (sections, dropped columns) are remembered on this computer.
// ============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';
import { eventsApi } from '../../lib/api';
import { EVENT_COLUMNS, COLUMN_GROUPS } from '../../lib/eventRow';
import { fetchNotLiveRows, toNotLiveEvents } from '../../lib/iclassCamp';
import {
  SECTIONS, buildSections, fetchExportExtras, fetchSetupReads,
  toCSVFile, toJSONFile, toClipboardAll, toHTMLPage,
} from '../../lib/exportData';
import { copyToClipboardRich } from './copyVisible';
import { getErrorLabel } from './constants';

const ALL_COLUMNS = EVENT_COLUMNS.map((c) => c.key);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mdyShort = (s) => { const [y, m, d] = s.split('-').map(Number); return `${m}/${d}/${y}`; };
const load = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch (e) { return fallback; } };
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ } };

// One-tap starting points. Each sets the sections and the event columns; change anything after.
const QUICK_PICKS = [
  { key: 'everything', label: 'Everything', sections: ['events', 'price_tables', 'requirements', 'audit', 'dismissed', 'setup_reads'], columns: ALL_COLUMNS },
  { key: 'spots', label: 'Spots check', sections: ['events'], columns: ['gym', 'gym_name', 'bucket', 'title', 'start', 'end', 'spots', 'spots_by_day', 'status', 'max_kids', 'signup', 'reg_open', 'reg_close', 'link'] },
  { key: 'prices', label: 'Prices', sections: ['events', 'price_tables'], columns: ['gym', 'gym_name', 'bucket', 'title', 'start', 'end', 'category', 'price_table', 'prices', 'due_at_signup', 'link'] },
  { key: 'live', label: 'Live on the portal?', sections: ['events'], columns: ['gym', 'gym_name', 'bucket', 'title', 'start', 'end', 'live', 'why_not_live', 'show_on_web', 'registration_on', 'reg_open', 'reg_close', 'link'], notLive: true },
  { key: 'requirements', label: 'Monthly requirements', sections: ['requirements'], columns: null },
  { key: 'audit', label: 'Audit', sections: ['audit', 'dismissed', 'setup_reads'], columns: null },
];

export default function ExportModal({ onClose, gyms, monthlyRequirements, currentMonth, currentYear, acknowledgedPatterns = [] }) {
  // ---------------------------------------------------------------- picks
  const [startDate, setStartDate] = useState(iso(new Date(currentYear, currentMonth, 1)));
  const [endDate, setEndDate] = useState(iso(new Date(currentYear, currentMonth + 1, 0)));
  const [selectedGyms, setSelectedGyms] = useState(gyms.map((g) => g.id));
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sections, setSections] = useState(() => load('export_sections', ['events']));
  const [dropped, setDropped] = useState(() => load('export_columns_dropped', []));
  const [includeNotLive, setIncludeNotLive] = useState(false);
  const [format, setFormat] = useState('csv');
  const [note, setNote] = useState('');

  useEffect(() => {
    supabase.from('event_types').select('name').order('name').then(({ data }) => {
      const names = (data || []).map((r) => r.name).filter(Boolean);
      setEventTypes(names);
      setSelectedTypes(names);
    });
  }, []);
  useEffect(() => save('export_sections', sections), [sections]);
  useEffect(() => save('export_columns_dropped', dropped), [dropped]);

  const requiredTypes = Object.keys(monthlyRequirements || {}).filter((t) => Number(monthlyRequirements[t]) > 0);
  const columnKeys = useMemo(() => ALL_COLUMNS.filter((k) => !dropped.includes(k)), [dropped]);

  // Sync log: only after the * PIN unlock (same unlock as before this rebuild)
  const ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('export_admin_unlocked') === 'true');
  useEffect(() => {
    if (isAdmin) return undefined;
    const onKey = (e) => {
      if (e.key !== '*') return;
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
    // every event that touches the dates, page by page
    eventsApi.getAll(startDate, endDate)
      .then((d) => { if (alive) setEvents(d || []); })
      .catch(() => { if (alive) setEvents([]); })
      .finally(() => { if (alive) setLoadingEvents(false); });
    return () => { alive = false; };
  }, [startDate, endDate]);

  useEffect(() => {
    let alive = true;
    setNotLiveRaw(null);
    if (!includeNotLive) return undefined;
    fetchNotLiveRows(startDate, endDate).then((r) => { if (alive) setNotLiveRaw(r); }).catch(() => { if (alive) setNotLiveRaw({ rows: [], rules: [] }); });
    return () => { alive = false; };
  }, [includeNotLive, startDate, endDate]);

  // The first and last event dates in the database, for "Entire database"
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
    supabase.from('sync_log').select('*').order('last_synced', { ascending: false }).limit(100)
      .then(({ data }) => setSyncLog(data || []));
  }, [isAdmin, sections, syncLog.length]);

  const gymEvents = useMemo(() => events.filter((e) => selectedGyms.includes(e.gym_id)), [events, selectedGyms]);
  const notLiveEvents = useMemo(() => (includeNotLive && notLiveRaw
    ? toNotLiveEvents(notLiveRaw.rows, notLiveRaw.rules, gyms, events).filter((e) => selectedGyms.includes(e.gym_id))
    : []), [includeNotLive, notLiveRaw, gyms, events, selectedGyms]);
  const pickedEvents = useMemo(() => [...gymEvents, ...notLiveEvents].filter((e) => selectedTypes.includes(e.type)),
    [gymEvents, notLiveEvents, selectedTypes]);

  // Read the iClass setup facts for exactly these events as soon as they change
  const eventsKey = pickedEvents.map((e) => e.id).join(',');
  useEffect(() => {
    let alive = true;
    if (!pickedEvents.length) { setExtrasState({ key: eventsKey, dayCounts: {}, extras: {} }); return undefined; }
    fetchExportExtras(pickedEvents)
      .then((r) => { if (alive) setExtrasState({ key: eventsKey, ...r }); })
      .catch((err) => { if (alive) setExtrasState({ key: eventsKey, dayCounts: {}, extras: {}, error: err.message }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);
  const extrasReady = extrasState.key === eventsKey;

  const gymsKey = selectedGyms.join(',');
  useEffect(() => {
    let alive = true;
    fetchSetupReads(selectedGyms).then((r) => { if (alive) setSetupReads(r); }).catch(() => { if (alive) setSetupReads([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymsKey]);

  // ---------------------------------------------------------------- the tables
  const ctx = useMemo(() => ({
    events: pickedEvents,
    reqEvents: gymEvents,
    columnKeys,
    gyms,
    gymIds: selectedGyms,
    gymName: (id) => gyms.find((g) => g.id === id)?.name || '',
    dayCounts: extrasState.dayCounts,
    extras: extrasState.extras,
    isDismissed: (e, msg) => isErrorAcknowledgedAnywhere(e, msg, acknowledgedPatterns),
    errorLabel: (t) => getErrorLabel(t) || t,
    requirements: monthlyRequirements,
    startDate, endDate, setupReads, syncLog,
  }), [pickedEvents, gymEvents, columnKeys, gyms, selectedGyms, extrasState, acknowledgedPatterns, monthlyRequirements, startDate, endDate, setupReads, syncLog]);

  const visibleSections = SECTIONS.filter((s) => !s.admin || isAdmin);
  const activeKeys = sections.filter((k) => visibleSections.some((s) => s.key === k));
  // Every section's table, built once - the counts on the cards and what downloads / copies are the same thing
  const allTables = useMemo(() => {
    // requirements count by gym only (every bucket), whatever buckets are ticked for the other sections
    const tables = buildSections(visibleSections.map((s) => s.key), ctx);
    const req = buildSections(['requirements'], { ...ctx, events: ctx.reqEvents })[0];
    return tables.map((t) => (t.key === 'requirements' ? req : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, isAdmin]);
  const tableOf = (k) => allTables.find((t) => t.key === k);
  const chosenTables = activeKeys.map(tableOf).filter(Boolean);

  const busy = loadingEvents || !extrasReady || (includeNotLive && !notLiveRaw);
  const totalRows = chosenTables.reduce((n, t) => n + t.rows.length, 0);
  const canGo = !busy && chosenTables.length > 0 && !(activeKeys.length === 1 && activeKeys[0] === 'events' && !columnKeys.length);

  // ---------------------------------------------------------------- actions
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const applyQuick = (q) => {
    setSections(q.sections);
    if (q.columns) setDropped(ALL_COLUMNS.filter((k) => !q.columns.includes(k)));
    setIncludeNotLive(!!q.notLive);
  };
  const setRange = (a, b) => { setStartDate(a); setEndDate(b); };
  const today = new Date();

  const heading = `Master Events Calendar - ${mdyShort(startDate)} to ${mdyShort(endDate)}`;
  const subheading = `${selectedGyms.length} of ${gyms.length} gyms · ${selectedTypes.length} of ${eventTypes.length} buckets · made ${new Date().toLocaleString('en-US')}`;
  const fileName = (ext) => `master-calendar-${activeKeys.length > 2 ? 'combined' : activeKeys.join('-').replace(/_/g, '-')}-${startDate}_to_${endDate}.${ext}`;

  const download = () => {
    if (!canGo) return;
    if (format === 'html') {
      const url = URL.createObjectURL(new Blob([toHTMLPage(chosenTables, heading, subheading)], { type: 'text/html' }));
      window.open(url, '_blank');
      setNote(`Opened the printable page: ${chosenTables.length} section${chosenTables.length === 1 ? '' : 's'}, ${totalRows} rows`);
      return;
    }
    const content = format === 'json'
      ? toJSONFile(chosenTables, { made: new Date().toISOString(), dates: { from: startDate, to: endDate }, gyms: selectedGyms, buckets: selectedTypes },
        activeKeys.includes('events') ? pickedEvents : null)
      : toCSVFile(chosenTables, `${heading} (${subheading})`);
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName(format);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNote(`Downloaded ${fileName(format)}: ${totalRows} rows`);
  };

  const copy = async () => {
    if (!canGo) return;
    try {
      const payload = toClipboardAll(chosenTables);
      await copyToClipboardRich(payload);
      setNote(`Copied ${chosenTables.length} section${chosenTables.length === 1 ? '' : 's'}, ${payload.rows} rows - paste into email, Docs, Sheets or Excel`);
    } catch (err) {
      setNote(`Could not copy: ${err.message}`);
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ---------------------------------------------------------------- screen
  const chip = (on) => `text-sm font-semibold px-3 py-1.5 rounded-full border-2 transition-colors cursor-pointer ${on ? 'bg-gray-900 border-gray-900 text-white hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-800 hover:border-gray-500'}`;
  const smallBtn = 'text-xs font-bold px-2.5 py-1 rounded-md bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 cursor-pointer';
  const panel = 'bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex flex-col min-h-0';
  const panelHead = 'px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-100 rounded-2xl w-full max-w-7xl max-h-[96vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header + dates */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 mr-2">📤 Export &amp; Copy</h2>
          <div className="flex flex-wrap gap-1.5">
            <button className={chip(false)} onClick={() => setRange(iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)))}>This month</button>
            <button className={chip(false)} onClick={() => setRange(iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)), iso(new Date(today.getFullYear(), today.getMonth() + 2, 0)))}>Next month</button>
            <button className={chip(false)} onClick={() => setRange(iso(today), dbRange?.last || iso(new Date(today.getFullYear() + 1, 11, 31)))}>Today on</button>
            <button className={chip(false)} disabled={!dbRange} onClick={() => dbRange && setRange(dbRange.first, dbRange.last)}>Entire database</button>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-800">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border border-gray-400 rounded-md" />
            <span>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border border-gray-400 rounded-md" />
          </div>
          <div className="ml-auto text-sm font-semibold text-gray-800">
            {loadingEvents ? 'Loading events…' : `${events.length} events in these dates`}
          </div>
          <button onClick={onClose} className="text-gray-700 hover:text-black text-3xl leading-none w-9 h-9 rounded-full hover:bg-gray-100" aria-label="Close">×</button>
        </div>

        {/* Three panels: WHO · WHAT · COLUMNS */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)]">

          {/* WHO: gyms + buckets */}
          <div className={panel}>
            <div className={panelHead}>
              <div>
                <h3 className="font-bold text-gray-900">🏢 Gyms</h3>
                <p className="text-xs text-gray-700">{selectedGyms.length} of {gyms.length}</p>
              </div>
              <div className="flex gap-1">
                <button className={smallBtn} onClick={() => setSelectedGyms(gyms.map((g) => g.id))}>All</button>
                <button className={smallBtn} onClick={() => setSelectedGyms([])}>None</button>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {gyms.map((g) => {
                const on = selectedGyms.includes(g.id);
                const color = (g.brand_colors && g.brand_colors[0]) || '#4b5563';
                return (
                  <button key={g.id} type="button" onClick={() => toggle(selectedGyms, setSelectedGyms, g.id)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-all hover:shadow-md"
                    style={{ border: `2px solid ${on ? color : '#d1d5db'}`, borderLeftWidth: 6, borderLeftColor: color, background: on ? `${color}18` : '#fff' }}>
                    {g.logo_url
                      ? <img src={g.logo_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white shadow" />
                      : <span className="w-7 h-7 rounded-full" style={{ background: color }} />}
                    <span className="font-bold text-sm text-gray-900">{g.id}</span>
                    <span className="ml-auto text-sm font-bold" style={{ color: on ? color : '#9ca3af' }}>{on ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>
            <div className={`${panelHead} border-t`}>
              <div>
                <h3 className="font-bold text-gray-900">🎯 Buckets</h3>
                <p className="text-xs text-gray-700">{selectedTypes.length} of {eventTypes.length} · <span className="text-red-700 font-bold">*</span> has a monthly requirement</p>
              </div>
              <div className="flex gap-1">
                <button className={smallBtn} onClick={() => setSelectedTypes([...eventTypes])}>All</button>
                <button className={smallBtn} onClick={() => setSelectedTypes([])}>None</button>
              </div>
            </div>
            <div className="p-3 flex flex-wrap gap-1.5">
              {eventTypes.map((t) => (
                <button key={t} type="button" className={chip(selectedTypes.includes(t))} onClick={() => toggle(selectedTypes, setSelectedTypes, t)}>
                  {t}{requiredTypes.includes(t) && <span className={selectedTypes.includes(t) ? 'text-red-300' : 'text-red-700'}> *</span>}
                </button>
              ))}
            </div>
          </div>

          {/* WHAT: quick picks + sections */}
          <div className={panel}>
            <div className={panelHead}>
              <div>
                <h3 className="font-bold text-gray-900">📦 What to include</h3>
                <p className="text-xs text-gray-700">Tick any. Download and Copy both give you exactly these.</p>
              </div>
            </div>
            <div className="px-3 pt-3 flex flex-wrap gap-1.5">
              <span className="text-xs font-bold text-gray-800 self-center mr-1">Quick pick:</span>
              {QUICK_PICKS.map((q) => (
                <button key={q.key} type="button" onClick={() => applyQuick(q)}
                  className="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-700 text-white hover:bg-indigo-800 cursor-pointer shadow-sm">{q.label}</button>
              ))}
            </div>
            <div className="p-3 space-y-2">
              {visibleSections.map((s) => {
                const on = sections.includes(s.key);
                const t = tableOf(s.key);
                const count = busy ? '…' : (t ? t.rows.length : 0);
                return (
                  <div key={s.key} className={`rounded-xl border-2 transition-colors ${on ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                    <button type="button" onClick={() => toggle(sections, setSections, s.key)} className="w-full flex items-center gap-3 p-2.5 text-left cursor-pointer">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0 ${on ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-gray-400 text-transparent'}`}>✓</span>
                      <span className="text-lg flex-shrink-0">{s.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-sm text-gray-900">{s.label}{s.admin && <span className="ml-2 text-[11px] font-bold bg-gray-800 text-white px-1.5 py-0.5 rounded">ADMIN</span>}</span>
                        <span className="block text-xs text-gray-700">{s.desc}</span>
                      </span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${on ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-900'}`}>{count}</span>
                    </button>
                    {s.key === 'events' && (
                      <label className="flex items-center gap-2 px-3 pb-2.5 -mt-1 text-sm text-gray-900 cursor-pointer">
                        <input type="checkbox" checked={includeNotLive} onChange={(e) => setIncludeNotLive(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                        <span>Also add camps built in iClass but <b>not live</b> on the portal yet
                          {includeNotLive && notLiveRaw && <b> ({notLiveEvents.filter((e) => selectedTypes.includes(e.type)).length})</b>}</span>
                      </label>
                    )}
                    {on && t?.note && !busy && <div className="px-3 pb-2.5 -mt-1 text-xs text-gray-800">{t.note}</div>}
                  </div>
                );
              })}
              {extrasState.error && <div className="text-sm font-bold text-red-700">iClass setup facts did not load: {extrasState.error}. Those columns will be blank.</div>}
            </div>
          </div>

          {/* COLUMNS (Events section) */}
          <div className={`${panel} ${sections.includes('events') ? '' : 'opacity-60'}`}>
            <div className={panelHead}>
              <div>
                <h3 className="font-bold text-gray-900">🧩 Event columns</h3>
                <p className="text-xs text-gray-700">{columnKeys.length} of {ALL_COLUMNS.length} · used by the Events section</p>
              </div>
              <div className="flex gap-1">
                <button className={smallBtn} onClick={() => setDropped([])}>All</button>
                <button className={smallBtn} onClick={() => setDropped([...ALL_COLUMNS])}>None</button>
              </div>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto">
              {COLUMN_GROUPS.map((grp) => {
                const cols = EVENT_COLUMNS.filter((c) => c.group === grp);
                const allOn = cols.every((c) => !dropped.includes(c.key));
                return (
                  <div key={grp}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-900">{grp}</span>
                      <button className="text-xs font-bold text-indigo-800 hover:underline cursor-pointer"
                        onClick={() => setDropped(allOn ? [...new Set([...dropped, ...cols.map((c) => c.key)])] : dropped.filter((k) => !cols.some((c) => c.key === k)))}>
                        {allOn ? 'none' : 'all'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cols.map((c) => {
                        const on = !dropped.includes(c.key);
                        return (
                          <button key={c.key} type="button" onClick={() => toggle(dropped, setDropped, c.key)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border-2 cursor-pointer transition-colors ${on ? 'bg-indigo-700 border-indigo-700 text-white hover:bg-indigo-800' : 'bg-white border-gray-300 text-gray-800 hover:border-gray-500'}`}>
                            {on ? '✓ ' : ''}{c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer: what will happen, format, Copy, Download */}
        <div className="bg-white border-t border-gray-200 px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] text-sm text-gray-900">
            {busy ? <span className="font-semibold">Reading the data…</span>
              : chosenTables.length === 0 ? <span className="font-semibold text-red-700">Tick at least one section.</span>
                : <span><b>Will include:</b> {chosenTables.map((t) => `${t.title} ${t.rows.length}${t.key === 'events' ? ` rows × ${columnKeys.length} columns` : ''}`).join(' · ')}</span>}
            {note && <div className="text-sm font-bold text-green-800 mt-0.5">{note}</div>}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[['csv', 'CSV (Excel, Sheets)'], ['json', 'JSON (backup)'], ['html', 'Printable page']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFormat(k)}
                className={`text-sm font-semibold px-3 py-1.5 rounded-md cursor-pointer ${format === k ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-white'}`}>{label}</button>
            ))}
          </div>
          <button onClick={copy} disabled={!canGo}
            title="Copies every section you ticked: tables for email / Docs, cells for Sheets / Excel"
            className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 ${canGo ? 'bg-indigo-700 hover:bg-indigo-800 text-white shadow-lg cursor-pointer' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}>
            📋 Copy {busy ? '' : `${totalRows} rows`}
          </button>
          <button onClick={download} disabled={!canGo}
            className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 ${canGo ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg cursor-pointer' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}>
            {format === 'html' ? '🖨️ Open page' : `⬇️ Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
