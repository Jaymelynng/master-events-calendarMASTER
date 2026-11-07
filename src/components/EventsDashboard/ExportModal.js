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
  const [previewKey, setPreviewKey] = useState(() => load('export_sections', ['events'])[0] || 'events');   // the section shown in the preview
  const [colGroup, setColGroup] = useState(COLUMN_GROUPS[0]);

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
  // Workflow layout (Jayme's multi-view blueprint: one frame, steps on the left, the result beside them,
  // one action bar): 1 Gyms & buckets -> 2 What to include -> live preview of exactly what will download /
  // copy -> act. Look (CORE-VISUAL-DESIGN-PHILOSOPHY): dark shell, white container floating on it, recessed
  // rail, the section being previewed lifts as a white card; one accent - the calendar's own rose.
  const C = {
    shell: '#2b2326', rail: '#f3ecec', card: '#ffffff', ink: '#1f1a1b', soft: '#4a3f42',
    accent: '#7a4f57', accentHover: '#64404a', tint: '#f6e9eb', line: '#e2d6d8', head: '#3a2e31',
  };
  const lift = '0 8px 25px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12)';
  const float = '0 20px 60px rgba(0,0,0,.35), 0 8px 20px rgba(0,0,0,.25)';
  const stepTitle = (n, text, extra) => (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ background: C.accent }}>{n}</span>
        <span className="text-sm font-black uppercase tracking-wide" style={{ color: C.ink }}>{text}</span>
      </div>
      {extra}
    </div>
  );
  const linkBtn = (label, onClick) => (
    <button type="button" onClick={onClick} className="text-xs font-bold hover:underline cursor-pointer" style={{ color: C.accent }}>{label}</button>
  );
  const pill = (on) => ({
    background: on ? C.accent : C.card, color: on ? '#fff' : C.ink,
    border: `1.5px solid ${on ? C.accent : C.line}`, boxShadow: on ? '0 2px 6px rgba(122,79,87,.35)' : '0 1px 2px rgba(0,0,0,.06)',
  });
  const preview = tableOf(previewKey);
  const PREVIEW_ROWS = 150;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(20,14,16,.72)' }} onClick={onClose}>
      <div className="w-full h-full max-w-[1500px] max-h-[94vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: C.shell, boxShadow: float }} onClick={(e) => e.stopPropagation()}>

        {/* Top bar - pinned: title + dates */}
        <div className="relative flex flex-wrap items-center gap-3 pl-5 pr-14 py-3">
          <h2 className="text-xl font-black text-white mr-3">Export &amp; Copy</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              ['This month', () => setRange(iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)))],
              ['Next month', () => setRange(iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)), iso(new Date(today.getFullYear(), today.getMonth() + 2, 0)))],
              ['Today on', () => setRange(iso(today), dbRange?.last || iso(new Date(today.getFullYear() + 1, 11, 31)))],
              ['Entire database', () => dbRange && setRange(dbRange.first, dbRange.last)],
            ].map(([label, fn]) => (
              <button key={label} type="button" onClick={fn}
                className="text-sm font-bold px-3 py-1.5 rounded-full bg-white hover:bg-[#f3ecec] cursor-pointer" style={{ color: C.ink, boxShadow: '0 2px 6px rgba(0,0,0,.3)' }}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 rounded-md bg-white" style={{ color: C.ink }} />
            <span>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 rounded-md bg-white" style={{ color: C.ink }} />
          </div>
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 rounded-full text-white text-2xl leading-none hover:bg-white/15 cursor-pointer">×</button>
        </div>

        {/* Step 1 on the shell: gyms, then buckets - one row each, all ticked, tap to drop */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: '#fff', color: C.ink }}>1</span>
            {gyms.map((g) => {
              const on = selectedGyms.includes(g.id);
              const color = (g.brand_colors && g.brand_colors[0]) || C.soft;
              return (
                <button key={g.id} type="button" onClick={() => toggle(selectedGyms, setSelectedGyms, g.id)} title={g.name}
                  className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full cursor-pointer transition-all"
                  style={{ background: on ? '#fff' : 'rgba(255,255,255,.14)', boxShadow: on ? `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,.35)` : 'none' }}>
                  {g.logo_url ? <img src={g.logo_url} alt="" className="w-6 h-6 rounded-full object-cover bg-white" style={{ opacity: on ? 1 : 0.6 }} /> : <span className="w-6 h-6 rounded-full" style={{ background: color }} />}
                  <span className="text-xs font-black" style={{ color: on ? C.ink : '#fff' }}>{g.id}</span>
                </button>
              );
            })}
            <span className="flex gap-3 ml-1">
              <button type="button" onClick={() => setSelectedGyms(gyms.map((g) => g.id))} className="text-xs font-bold text-white underline cursor-pointer">All gyms</button>
              <button type="button" onClick={() => setSelectedGyms([])} className="text-xs font-bold text-white underline cursor-pointer">None</button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pl-[30px]">
            {eventTypes.map((t) => {
              const on = selectedTypes.includes(t);
              return (
                <button key={t} type="button" onClick={() => toggle(selectedTypes, setSelectedTypes, t)}
                  className="text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer"
                  style={{ background: on ? '#fff' : 'rgba(255,255,255,.14)', color: on ? C.ink : '#fff', boxShadow: on ? '0 3px 8px rgba(0,0,0,.35)' : 'none' }}>
                  {t}{requiredTypes.includes(t) ? ' *' : ''}
                </button>
              );
            })}
            <span className="text-xs font-semibold text-white ml-1">* has a monthly requirement</span>
            <span className="flex gap-3 ml-1">
              <button type="button" onClick={() => setSelectedTypes([...eventTypes])} className="text-xs font-bold text-white underline cursor-pointer">All buckets</button>
              <button type="button" onClick={() => setSelectedTypes([])} className="text-xs font-bold text-white underline cursor-pointer">None</button>
            </span>
          </div>
        </div>

        {/* The container floats on the shell: steps rail | live preview */}
        <div className="flex-1 min-h-0 mx-3 rounded-2xl overflow-hidden flex flex-col lg:flex-row" style={{ background: C.card, boxShadow: lift }}>

          {/* Rail - recessed */}
          <div className="lg:w-[300px] flex-shrink-0 overflow-y-auto p-4 space-y-5" style={{ background: C.rail, borderRight: `1px solid ${C.line}` }}>

            {/* Step 2 - what */}
            <div>
              {stepTitle(2, 'What to include')}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {QUICK_PICKS.map((q) => (
                  <button key={q.key} type="button" onClick={() => { applyQuick(q); setPreviewKey(q.sections[0]); }}
                    className="text-xs font-bold px-2 py-1 rounded-md cursor-pointer bg-white hover:bg-[#f6e9eb]" style={{ color: C.ink, border: `1px solid ${C.line}` }}>{q.label}</button>
                ))}
              </div>
              <div className="space-y-1.5">
                {visibleSections.map((s) => {
                  const on = sections.includes(s.key);
                  const showing = previewKey === s.key;
                  const t = tableOf(s.key);
                  return (
                    <div key={s.key} className="rounded-xl transition-all"
                      style={{ background: showing ? C.card : 'transparent', boxShadow: showing ? lift : 'none', borderLeft: `4px solid ${showing ? C.accent : 'transparent'}` }}>
                      <div className="flex items-center gap-2.5 px-2.5 py-2">
                        <button type="button" onClick={() => toggle(sections, setSections, s.key)} aria-label={`Include ${s.label}`}
                          className="w-5 h-5 rounded flex items-center justify-center text-xs font-black flex-shrink-0 cursor-pointer"
                          style={{ background: on ? C.accent : C.card, color: '#fff', border: `2px solid ${on ? C.accent : '#b9aaad'}` }}>{on ? '✓' : ''}</button>
                        <button type="button" onClick={() => setPreviewKey(s.key)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <span className="block text-sm font-bold" style={{ color: C.ink }}>{s.label}{s.admin ? ' · admin' : ''}</span>
                          {showing && <span className="block text-xs" style={{ color: C.soft }}>{s.desc}</span>}
                        </button>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: on ? C.tint : '#e9e2e3', color: C.ink }}>{busy ? '…' : (t ? t.rows.length : 0)}</span>
                      </div>
                      {showing && s.key === 'events' && (
                        <label className="flex items-start gap-2 px-3 pb-2.5 text-xs cursor-pointer" style={{ color: C.ink }}>
                          <input type="checkbox" checked={includeNotLive} onChange={(e) => setIncludeNotLive(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: C.accent }} />
                          <span>Add camps built in iClass but <b>not live</b> yet{includeNotLive && notLiveRaw ? ` (${notLiveEvents.filter((e) => selectedTypes.includes(e.type)).length})` : ''}</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live preview - exactly what will download / copy for the section picked on the left */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-black" style={{ color: C.ink }}>{preview ? preview.title : 'Pick a section'}</h3>
                {preview && <span className="text-sm font-semibold" style={{ color: C.soft }}>{busy ? 'reading…' : `${preview.rows.length} rows${previewKey === 'events' ? ` · ${columnKeys.length} columns` : ''}`}</span>}
                {preview && !sections.includes(previewKey) && (
                  <button type="button" onClick={() => toggle(sections, setSections, previewKey)}
                    className="text-xs font-bold px-2.5 py-1 rounded-md text-white cursor-pointer" style={{ background: C.accent }}>+ Include this section</button>
                )}
              </div>
              {preview?.note && !busy && <p className="text-sm mt-1" style={{ color: C.soft }}>{preview.note}</p>}
              {extrasState.error && <p className="text-sm mt-1 font-bold" style={{ color: '#b91c1c' }}>iClass setup facts did not load ({extrasState.error}) - those columns are blank.</p>}

              {/* Event columns - one group at a time; or click × on a column header in the preview */}
              {previewKey === 'events' && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-end gap-1">
                    {COLUMN_GROUPS.map((grp) => {
                      const cols = EVENT_COLUMNS.filter((c) => c.group === grp);
                      const onCount = cols.filter((c) => !dropped.includes(c.key)).length;
                      const active = colGroup === grp;
                      return (
                        <button key={grp} type="button" onClick={() => setColGroup(grp)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-t-lg cursor-pointer"
                          style={{ background: active ? C.tint : 'transparent', color: C.ink, borderBottom: `3px solid ${active ? C.accent : 'transparent'}` }}>
                          {grp} <span style={{ color: C.soft }}>{onCount}/{cols.length}</span>
                        </button>
                      );
                    })}
                    <span className="ml-auto flex gap-3 pb-1.5">{linkBtn('All columns', () => setDropped([]))}{linkBtn('No columns', () => setDropped([...ALL_COLUMNS]))}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-b-lg" style={{ background: C.tint }}>
                    {EVENT_COLUMNS.filter((c) => c.group === colGroup).map((c) => {
                      const on = !dropped.includes(c.key);
                      return (
                        <button key={c.key} type="button" onClick={() => toggle(dropped, setDropped, c.key)}
                          className="text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer" style={pill(on)}>
                          {on ? '✓ ' : '+ '}{c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {busy ? (
                <div className="p-6 text-sm font-semibold" style={{ color: C.soft }}>Reading the data…</div>
              ) : !preview ? null : preview.rows.length === 0 ? (
                <div className="p-6 text-sm font-semibold" style={{ color: C.soft }}>Nothing for these dates, gyms and buckets.</div>
              ) : (
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c.key} className="text-left font-bold px-2.5 py-2 whitespace-nowrap" style={{ background: C.head, color: '#fff' }}>
                          <span className="inline-flex items-center gap-1.5">
                            {c.label}
                            {previewKey === 'events' && (
                              <button type="button" onClick={() => toggle(dropped, setDropped, c.key)} title="Drop this column"
                                className="w-4 h-4 rounded-full text-[11px] leading-none bg-white/20 hover:bg-white/40 cursor-pointer">×</button>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#faf6f6' : '#fff' }}>
                        {r.map((v, j) => (
                          <td key={j} className="px-2.5 py-1.5 align-top" style={{ color: C.ink, borderBottom: `1px solid ${C.line}`, maxWidth: 320 }}>
                            <div className="line-clamp-2">{preview.columns[j]?.key === 'link' && v ? <a href={v} target="_blank" rel="noreferrer" style={{ color: C.accent }} className="font-bold underline">Open</a> : String(v ?? '')}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!busy && preview && preview.rows.length > PREVIEW_ROWS && (
                <div className="px-5 py-3 text-xs font-semibold" style={{ color: C.soft }}>Showing the first {PREVIEW_ROWS} of {preview.rows.length} rows here - Download and Copy include all {preview.rows.length}.</div>
              )}
            </div>
          </div>
        </div>

        {/* Action bar - pinned */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex-1 min-w-[260px] text-sm text-white">
            {busy ? <b>Reading the data…</b>
              : chosenTables.length === 0 ? <b>Tick at least one section on the left.</b>
                : <span><b>You get:</b> {chosenTables.map((t) => `${t.title} (${t.rows.length})`).join(' · ')}</span>}
            {note && <div className="font-bold mt-0.5" style={{ color: '#bff0cf' }}>{note}</div>}
          </div>
          <div className="flex items-center rounded-lg p-1" style={{ background: 'rgba(255,255,255,.12)' }}>
            {[['csv', 'CSV'], ['json', 'JSON'], ['html', 'Printable page']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFormat(k)}
                className="text-sm font-bold px-3 py-1.5 rounded-md cursor-pointer"
                style={{ background: format === k ? '#fff' : 'transparent', color: format === k ? C.ink : '#fff' }}>{label}</button>
            ))}
          </div>
          <button onClick={copy} disabled={!canGo} title="Copies every ticked section: tables for email / Docs, cells for Sheets / Excel"
            className="px-5 py-2.5 rounded-lg font-black text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: '#fff', color: C.ink, boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}>
            Copy {busy ? '' : `${totalRows} rows`}
          </button>
          <button onClick={download} disabled={!canGo}
            className="px-5 py-2.5 rounded-lg font-black text-sm text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: C.accent, boxShadow: '0 4px 14px rgba(0,0,0,.45)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}>
            {format === 'html' ? 'Open printable page' : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
