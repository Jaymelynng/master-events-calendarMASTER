// ============================================================================
// CAMP AUDIT - Run camp audit (step 1 of the plan, Jayme 2026-11-11: "Yes, start step 1")
// ============================================================================
// Pick gyms (all ticked; tap one to drop it) -> Run camp audit -> Railway audits them one at a time
// (automation/camp_audit_job.py, the same audit and rules as before) -> each gym's progress and result
// shows here as Railway writes it. Everything on screen is read from camp_audit_runs / camp_audit_gym_results,
// never guessed. Step 2 brings the full checklist (edit, delete, status, email) into this tab; until then the
// rows are counted here and the claude.ai audit page is where the email is edited.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { startCampAudit } from '../../lib/syncApi';
import CampAuditEmail from './CampAuditEmail';

const INK = '#1f1a1a';
const ACCENT = '#8b6f6f';
const POLL_MS = 3000;

const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
const firstColor = (g) => (Array.isArray(g?.brand_colors) && g.brand_colors[0]) || ACCENT;
// text on a brand fill: near-black on a light color, white on a dark one ("I can't see it" = contrast)
const textOn = (hex) => {
  const h = (hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return '#fff';
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? INK : '#fff';
};

function Confetti() {
  const bits = Array.from({ length: 40 }, (_, i) => i);
  const colors = ['#8b6f6f', '#e0b04a', '#3b8f6a', '#3d6fb6', '#c2477d'];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      <style>{`@keyframes ca-fall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}`}</style>
      {bits.map(i => (
        <span key={i} style={{
          position: 'absolute', left: `${(i * 37) % 100}%`, top: -20, width: 8, height: 14,
          background: colors[i % colors.length], borderRadius: 2,
          animation: `ca-fall ${2.2 + (i % 7) * 0.25}s ease-in ${(i % 10) * 0.12}s forwards`,
        }} />
      ))}
    </div>
  );
}

const STATUS = {
  waiting: { label: 'Waiting its turn', bg: '#f1eded', fg: '#5a4a4a' },
  running: { label: 'Auditing now', bg: '#fff4d6', fg: '#6b4e00' },
  done: { label: 'Done', bg: '#dff3e8', fg: '#145c36' },
  failed: { label: 'Failed', bg: '#fde2e2', fg: '#8a1616' },
};

export default function AdminCampAudit({ gyms = [] }) {
  const sorted = useMemo(() => [...gyms].sort((a, b) => (a.id || '').localeCompare(b.id || '')), [gyms]);
  const [dropped, setDropped] = useState(() => new Set());
  const [run, setRun] = useState(null);          // newest camp_audit_runs row
  const [results, setResults] = useState([]);    // its camp_audit_gym_results rows
  const [loadError, setLoadError] = useState(null);
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [emailGym, setEmailGym] = useState(null);   // gym whose audit email is open (step 2)

  const picked = sorted.filter(g => !dropped.has(g.id));
  const gymById = useMemo(() => Object.fromEntries(sorted.map(g => [g.id, g])), [sorted]);

  const load = useCallback(async () => {
    const { data: runs, error } = await supabase.from('camp_audit_runs').select('*').order('id', { ascending: false }).limit(1);
    if (error) { setLoadError(error.message); return null; }
    setLoadError(null);
    const r = runs && runs[0];
    setRun(prev => {
      if (prev && prev.status === 'running' && r && r.id === prev.id && r.status === 'done') setCelebrate(true);
      return r || null;
    });
    if (r) {
      const { data: rs, error: e2 } = await supabase.from('camp_audit_gym_results')
        .select('id,gym_id,status,step,started_at,finished_at,source_read_at,camp_count,rows,error')
        .eq('run_id', r.id).order('id', { ascending: true });
      if (e2) setLoadError(e2.message); else setResults(rs || []);
    } else {
      setResults([]);
    }
    return r;
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!run || run.status !== 'running') return undefined;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [run, load]);
  useEffect(() => {
    if (!celebrate) return undefined;
    const t = setTimeout(() => setCelebrate(false), 5000);
    return () => clearTimeout(t);
  }, [celebrate]);

  const running = run && run.status === 'running';
  const total = results.length;
  const finished = results.filter(r => r.status === 'done' || r.status === 'failed').length;
  const pct = total ? Math.round((finished / total) * 100) : 0;
  const now = results.find(r => r.status === 'running');

  const toggle = (id) => setDropped(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const press = async () => {
    setStartError(null);
    setStarting(true);
    const res = await startCampAudit(picked.map(g => g.id));
    setStarting(false);
    if (!res.success) { setStartError(res.error || 'Railway did not start the audit'); return; }
    if (res.started === false && res.reason) setStartError(res.reason === 'a camp audit is already running' ? 'A camp audit is already running - showing it below.' : res.reason);
    await load();
  };

  return (
    <div className="space-y-5" style={{ color: INK }}>
      {celebrate && <Confetti />}

      {/* What this is + how to use it */}
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <h2 className="text-2xl font-bold">🏕️ Camp Audit</h2>
        <p className="mt-1 text-base" style={{ color: '#3a3030' }}>
          Checks every summer camp at the gyms you pick against its iClass settings and the Summer Camp Standards.
          Same audit and rules as the audit page.
        </p>
        <ol className="mt-3 text-sm space-y-1 list-decimal pl-5" style={{ color: '#3a3030' }}>
          <li>All gyms are ticked. Tap a gym to leave it out.</li>
          <li>Press <b>Run camp audit</b>. You can leave this screen; it keeps running on the server.</li>
          <li>Each gym shows its rows when it finishes. A gym takes about a minute.</li>
          <li>Press <b>Open email</b> on a gym to see its audit email: edit or delete any row, add a row, set the status, then <b>Copy email</b> and paste into Outlook.</li>
        </ol>
        <p className="mt-3 text-sm" style={{ color: '#3a3030' }}>
          The audit reads what iClass held at the last sync (<b>iClass read</b> on each gym). Sync first if you want today's settings.
          A row you edit, add or delete here stays that way when the audit runs again.
        </p>
      </div>

      {/* Gym picker */}
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="text-base font-semibold">Gyms to audit: {picked.length} of {sorted.length}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDropped(new Set())} disabled={running}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg border-2 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              style={{ borderColor: ACCENT, color: INK }}>Tick all</button>
            <button type="button" onClick={() => setDropped(new Set(sorted.map(g => g.id)))} disabled={running}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg border-2 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              style={{ borderColor: ACCENT, color: INK }}>Untick all</button>
          </div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {sorted.map(g => {
            const on = !dropped.has(g.id);
            const c = firstColor(g);
            return (
              <button key={g.id} type="button" onClick={() => toggle(g.id)} disabled={running}
                className="text-left rounded-lg px-3 py-2 border-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                style={on ? { background: c, borderColor: c, color: textOn(c) } : { background: '#fff', borderColor: '#d9cfcf', color: '#5a4a4a' }}>
                <div className="text-base font-bold">{on ? '✓ ' : ''}{g.id}</div>
                <div className="text-xs truncate" style={{ opacity: on ? 0.95 : 0.8 }}>{g.name}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={press} disabled={running || starting || picked.length === 0}
            className="px-6 py-3 text-base font-bold rounded-lg text-white cursor-pointer transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: ACCENT, boxShadow: '0 3px 10px rgba(139,111,111,0.35)' }}>
            {starting ? 'Starting…' : running ? 'Audit running…' : `▶ Run camp audit (${picked.length} gym${picked.length === 1 ? '' : 's'})`}
          </button>
          <div className="text-sm" style={{ color: '#3a3030' }}>
            {picked.length === 0 ? 'Tick at least one gym.' : `Will audit: ${picked.map(g => g.id).join(', ')}`}
          </div>
        </div>
        {startError && <div className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#fde2e2', color: '#8a1616' }}>{startError}</div>}
      </div>

      {/* Progress + results of the newest run */}
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        {loadError && <div className="mb-3 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#fde2e2', color: '#8a1616' }}>Could not read the audit results: {loadError}</div>}
        {!run && !loadError && <div className="text-base">No camp audit has run here yet. Pick gyms and press Run camp audit.</div>}
        {run && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-lg font-bold">
                {running ? 'Auditing…' : run.status === 'done' ? '✅ DONE' : run.status === 'stopped' ? '⛔ Stopped' : '❌ Failed'}
                <span className="ml-2 text-sm font-normal" style={{ color: '#3a3030' }}>Run {run.id} · started {when(run.started_at)}{run.finished_at ? ` · finished ${when(run.finished_at)}` : ''}</span>
              </div>
              <div className="text-base font-semibold">{finished} of {total} gyms · {pct}%</div>
            </div>
            <div className="mt-2 h-4 w-full rounded-full overflow-hidden" style={{ background: '#efe7e7' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, #b48f8f)` }} />
            </div>
            {now && <div className="mt-2 text-sm" style={{ color: '#3a3030' }}>Now: <b>{now.gym_id}</b>{now.step ? ` — ${now.step}` : ''}</div>}
            {run.note && !running && <div className="mt-2 text-sm" style={{ color: '#3a3030' }}>{run.note}</div>}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: '#3a3030' }}>
                    <th className="py-2 pr-3">Gym</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Camps</th>
                    <th className="py-2 pr-3">Rows</th><th className="py-2 pr-3">Your rows kept</th>
                    <th className="py-2 pr-3">iClass read</th><th className="py-2 pr-3">Audited</th><th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const st = STATUS[r.status] || STATUS.waiting;
                    const kept = (r.rows || []).filter(x => x && (x.by === 'hand' || x.by === 'eye')).length;
                    const g = gymById[r.gym_id];
                    return (
                      <tr key={r.id} className="border-t" style={{ borderColor: '#efe7e7' }}>
                        <td className="py-2 pr-3 font-bold"><span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: firstColor(g) }} />{r.gym_id}</td>
                        <td className="py-2 pr-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                          {r.status === 'failed' && r.error && <div className="mt-1 text-xs" style={{ color: '#8a1616' }}>{r.error.slice(0, 200)}</div>}
                        </td>
                        <td className="py-2 pr-3">{r.camp_count ?? '—'}</td>
                        <td className="py-2 pr-3">{r.rows ? r.rows.length : '—'}</td>
                        <td className="py-2 pr-3">{r.rows ? kept : '—'}</td>
                        <td className="py-2 pr-3">{when(r.source_read_at) || 'not read'}</td>
                        <td className="py-2 pr-3">{when(r.finished_at) || '—'}</td>
                        <td className="py-2 pr-3">{r.status === 'done' && (
                          <button type="button" onClick={() => { setEmailGym(r.gym_id); setTimeout(() => { const el = document.getElementById('camp-audit-email'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }}
                            className="px-3 py-1.5 text-sm font-bold rounded-lg cursor-pointer transition-all hover:brightness-110"
                            style={{ background: firstColor(g), color: textOn(firstColor(g)), boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                            {emailGym === r.gym_id ? 'Email open ▾' : 'Open email ▸'}
                          </button>)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Step 2: the open gym's audit email - edit, delete, add rows, status, copy for Outlook */}
      {emailGym && gymById[emailGym] && (
        <div id="camp-audit-email">
          <CampAuditEmail key={emailGym} gym={gymById[emailGym]} brand={firstColor(gymById[emailGym])} />
        </div>
      )}
    </div>
  );
}
