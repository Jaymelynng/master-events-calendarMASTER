// ============================================================================
// ADMIN BUCKETS — where Jayme decides which bucket an event lands in.
//
// Every gym names its iClass categories its own way. This screen is how the
// calendar learns them, with nothing hardcoded:
//   • TRAIN a category  → a row in event_type_mappings (one gym, or every gym).
//                         Every event in that category follows it on every sync.
//   • FORCE one event   → events.type_locked. The sync leaves that event's
//                         bucket alone, whatever category the gym filed it in.
// Anything with no rule shows up here under "Needs a home".
// The bucket list itself comes from the event_types table.
// ============================================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { eventTypeMappingsApi, bucketsApi, appConfigApi } from '../../lib/api';

// The app_config row that says which gyms' iClass APPOINTMENTS the sync also
// collects (APPOINTMENT_GYMS_KEY in automation/f12_collect_and_import.py).
const APPOINTMENT_GYMS_KEY = 'sync_appointments_gyms';

// The holding bucket the sync uses for a category with no rule
// (UNMAPPED_EVENT_TYPE in automation/f12_collect_and_import.py).
const UNSORTED = 'UNSORTED';

const INK = '#2b2224';
const MUTED = '#5c4a4c';
const ACCENT = '#8b6f6f';
const LINE = '#d8cccc';

const lower = (s) => (s || '').trim().toLowerCase();

// Dark text on a light fill, white text on a dark fill.
const textOn = (hex) => {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? INK : '#ffffff';
};

const fmtDate = (ev) => {
  const s = (ev.start_date || ev.date || '').split('T')[0];
  const e = (ev.end_date || '').split('T')[0];
  const f = (d) => { const [y, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}/${y.slice(2)}`; };
  if (!s) return '';
  return e && e !== s ? `${f(s)} – ${f(e)}` : f(s);
};

export default function AdminBuckets({ gyms = [], eventTypes = [] }) {
  const [mappings, setMappings] = useState([]);
  const [unsorted, setUnsorted] = useState([]);
  const [forced, setForced] = useState([]);
  const [forceReady, setForceReady] = useState(true); // false until events.type_locked exists
  const [sel, setSelState] = useState(null);  // { kind: 'unsorted'|'rule'|'forced', gymId, name, rule }
  const selRef = useRef(null);                // the latest selection, for reloads after a save
  const setSel = (s) => { selRef.current = s; setSelState(s); };
  const [selEvents, setSelEvents] = useState([]);
  const [scope, setScope] = useState('gym');  // 'gym' | 'all' — only for a new rule
  const [busy, setBusy] = useState(false);
  const [openEvent, setOpenEvent] = useState(null); // the one event whose own bucket buttons are showing
  const [msg, setMsg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [apptGyms, setApptGyms] = useState([]); // gym ids whose appointments get pulled

  useEffect(() => {
    appConfigApi.getAll()
      .then(cfg => setApptGyms((cfg[APPOINTMENT_GYMS_KEY] || '').split(',').map(g => g.trim()).filter(Boolean)))
      .catch(() => {});
  }, []);

  const toggleApptGym = async (gymId) => {
    const next = apptGyms.includes(gymId) ? apptGyms.filter(g => g !== gymId) : [...apptGyms, gymId].sort();
    setBusy(true);
    try {
      await appConfigApi.set(APPOINTMENT_GYMS_KEY, next.join(','));
      setApptGyms(next);
      setMsg({ bad: false, text: next.includes(gymId)
        ? `${gymId}: appointments will be pulled on the next sync. They show up here to be sorted like any other category.`
        : `${gymId}: appointments switched off. The next full sync removes its upcoming appointment events from the calendar.` });
    } catch (e) {
      setMsg({ bad: true, text: `Could not save: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const buckets = useMemo(
    () => (eventTypes || []).filter(t => t.name !== UNSORTED),
    [eventTypes]
  );
  const bucketOf = (name) => buckets.find(b => b.name === name);
  const bucketLabel = (name) => bucketOf(name)?.display_name || name;
  const gymName = (id) => gyms.find(g => g.id === id)?.name || id;

  // The bucket a category resolves to: the gym's own rule, else the every-gym rule.
  const resolve = useCallback((name, gymId, rules) => {
    const hits = rules.filter(r => r.is_active && lower(r.iclass_type_name) === lower(name));
    const rule = hits.find(r => r.gym_id === gymId) || hits.find(r => !r.gym_id);
    return rule?.event_type || UNSORTED;
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, u] = await Promise.all([
        eventTypeMappingsApi.getAll(),
        bucketsApi.getUnsorted(UNSORTED),
      ]);
      setMappings(m || []);
      setUnsorted(u || []);
      setLoadError(null);
      try {
        setForced(await bucketsApi.getForced());
        setForceReady(true);
      } catch (e) {
        setForced([]);
        setForceReady(false);
      }
      return m || [];
    } catch (e) {
      setLoadError(e.message);
      return [];
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Events filed under the selected category.
  const loadSelEvents = useCallback(async (s) => {
    if (!s || s.kind === 'forced') { setSelEvents([]); return; }
    try {
      setSelEvents(await bucketsApi.getByCategory(s.name, s.gymId || null));
    } catch (e) {
      setSelEvents([]);
      setMsg({ bad: true, text: `Could not load events: ${e.message}` });
    }
  }, []);

  const select = (s) => { setSel(s); setScope('gym'); setMsg(null); loadSelEvents(s); };

  // "Needs a home" — one row per gym + iClass category.
  const groups = useMemo(() => {
    const map = new Map();
    unsorted.forEach(ev => {
      const name = ev.camp_type || '(no category name saved)';
      const key = `${ev.gym_id}|${lower(name)}`;
      if (!map.has(key)) map.set(key, { gymId: ev.gym_id, name, count: 0, hasName: !!ev.camp_type });
      map.get(key).count++;
    });
    return [...map.values()].sort((a, b) => a.gymId.localeCompare(b.gymId) || a.name.localeCompare(b.name));
  }, [unsorted]);

  const rulesByBucket = useMemo(() => {
    const out = {};
    mappings.forEach(r => { (out[r.event_type] = out[r.event_type] || []).push(r); });
    return out;
  }, [mappings]);

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      const fresh = await load();
      await loadSelEvents(selRef.current);
      setMsg({ bad: false, text });
      return fresh;
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  // TRAIN: every event in this category goes to `bucket`.
  const train = (bucket) => run(async () => {
    const isRule = sel.kind === 'rule';
    const ruleGym = isRule ? (sel.rule.gym_id || null) : (scope === 'gym' ? sel.gymId : null);
    const existing = isRule
      ? sel.rule
      : mappings.find(r => lower(r.iclass_type_name) === lower(sel.name) && (r.gym_id || null) === ruleGym);

    if (existing) {
      await eventTypeMappingsApi.update(existing.id, { event_type: bucket, is_active: true });
    } else {
      await eventTypeMappingsApi.create({
        iclass_type_name: sel.name, event_type: bucket, gym_id: ruleGym,
        hide_from_calendar: false, is_active: true, note: 'Set on the Buckets screen',
      });
    }

    // Move what is already on the calendar so she doesn't wait for a sync.
    // A gym with its own rule for this name keeps its own; forced events stay put.
    const inCategory = await bucketsApi.getByCategory(sel.name, ruleGym);
    const ownRuleGyms = new Set(mappings
      .filter(r => r.is_active && r.gym_id && lower(r.iclass_type_name) === lower(sel.name))
      .map(r => r.gym_id));
    const toMove = inCategory.filter(ev =>
      !ev.type_locked && ev.type !== bucket && (ruleGym || !ownRuleGyms.has(ev.gym_id)));
    const moved = await bucketsApi.moveEvents(toMove, bucket, undefined, 'Buckets screen (category rule)');

    if (!isRule) setSel({ ...sel, kind: 'rule', gymId: ruleGym, rule: { ...(existing || {}), iclass_type_name: sel.name, gym_id: ruleGym, event_type: bucket } });
    return `“${sel.name}” ${ruleGym ? `at ${ruleGym}` : 'at every gym'} now goes to ${bucketLabel(bucket)}. ${moved} event${moved === 1 ? '' : 's'} moved.`;
  });

  // FORCE: just this one event.
  const force = (ev, bucket) => run(async () => {
    await bucketsApi.moveEvents([ev], bucket, true, 'Buckets screen (forced)');
    return `“${ev.title}” is forced to ${bucketLabel(bucket)}. Syncs will leave it there.`;
  });

  const unforce = (ev) => run(async () => {
    const back = resolve(ev.camp_type, ev.gym_id, mappings);
    await bucketsApi.moveEvents([ev], back, false, 'Buckets screen (un-forced)');
    return `“${ev.title}” follows its category again → ${bucketLabel(back)}.`;
  });

  const removeRule = (rule) => {
    if (!window.confirm(`Remove the rule for “${rule.iclass_type_name}” (${rule.gym_id || 'every gym'})?\n\nIts events go back to whatever rule is left, or to Needs a home.`)) return;
    run(async () => {
      await eventTypeMappingsApi.delete(rule.id);
      const rest = mappings.filter(r => r.id !== rule.id);
      const inCategory = await bucketsApi.getByCategory(rule.iclass_type_name, rule.gym_id || null);
      let moved = 0;
      for (const ev of inCategory) {
        if (ev.type_locked) continue;
        const back = resolve(ev.camp_type, ev.gym_id, rest);
        if (back !== ev.type) moved += await bucketsApi.moveEvents([ev], back, undefined, 'Buckets screen (rule removed)');
      }
      setSel(null);
      return `Rule removed. ${moved} event${moved === 1 ? '' : 's'} moved.`;
    });
  };

  const toggleHide = (rule) => run(async () => {
    await eventTypeMappingsApi.update(rule.id, { hide_from_calendar: !rule.hide_from_calendar });
    setSel({ ...sel, rule: { ...rule, hide_from_calendar: !rule.hide_from_calendar } });
    return rule.hide_from_calendar
      ? `“${rule.iclass_type_name}” will be collected again on the next sync.`
      : `“${rule.iclass_type_name}” will be skipped by the sync from now on.`;
  });

  // ---------- small pieces ----------
  const BucketButton = ({ b, onClick, active, small }) => {
    const fill = b.color || ACCENT;
    return (
      <button
        onClick={onClick}
        disabled={busy}
        className={`${small ? 'px-2.5 py-1' : 'px-4 py-2'} rounded-lg font-bold transition-all hover:brightness-90 hover:shadow-md disabled:opacity-50`}
        style={{
          background: fill, color: textOn(fill), fontSize: small ? 15 : 16, cursor: busy ? 'wait' : 'pointer',
          border: active ? `3px solid ${INK}` : '3px solid transparent',
        }}
        title={active ? 'Current bucket' : `Send to ${b.display_name || b.name}`}
      >
        {active ? '✓ ' : ''}{b.display_name || b.name}
      </button>
    );
  };

  const Pill = ({ name }) => {
    const b = bucketOf(name);
    const fill = name === UNSORTED ? '#b91c1c' : (b?.color || ACCENT);
    return (
      <span className="px-2 py-0.5 rounded-md font-bold whitespace-nowrap" style={{ background: fill, color: textOn(fill), fontSize: 15 }}>
        {name === UNSORTED ? 'Needs a home' : bucketLabel(name)}
      </span>
    );
  };

  const LeftRow = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-white"
      style={{ background: active ? '#ffffff' : 'transparent', border: `2px solid ${active ? ACCENT : 'transparent'}`, color: INK, fontSize: 15, cursor: 'pointer' }}
    >
      {children}
    </button>
  );

  const isSel = (kind, gymId, name) => sel && sel.kind === kind && (sel.gymId || null) === (gymId || null) && lower(sel.name) === lower(name);
  const currentRuleBucket = sel?.kind === 'rule' ? sel.rule?.event_type : null;

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-black" style={{ color: INK }}>🗂️ Buckets</h2>
        <p style={{ color: MUTED, fontSize: 15 }}>
          Tell the calendar where each gym’s iClass categories belong. Train a whole category, or force a single event.
        </p>
      </div>

      {loadError && (
        <div className="mb-3 px-3 py-2 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#7f1d1d', fontSize: 15 }}>
          Could not load: {loadError}
        </div>
      )}
      {!forceReady && (
        <div className="mb-3 px-3 py-2 rounded-lg font-semibold" style={{ background: '#fef3c7', color: '#713f12', fontSize: 15 }}>
          Forcing a single event isn’t switched on yet — the database is missing one column (events.type_locked). Training a category works now.
        </div>
      )}
      {msg && (
        <div className="mb-3 px-3 py-2 rounded-lg font-semibold" style={{ background: msg.bad ? '#fee2e2' : '#dcfce7', color: msg.bad ? '#7f1d1d' : '#14532d', fontSize: 15 }}>
          {msg.text}
        </div>
      )}

      {/* Appointments switch - per gym, on or off */}
      <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2 flex-wrap" style={{ background: '#ffffff', border: `1px solid ${LINE}` }}>
        <span className="font-black" style={{ color: INK, fontSize: 15 }}>Also pull iClass appointments for:</span>
        {[...gyms].sort((a, b) => (a.id || '').localeCompare(b.id || '')).map(g => {
          const on = apptGyms.includes(g.id);
          return (
            <button key={g.id} onClick={() => toggleApptGym(g.id)} disabled={busy}
              className="px-2.5 py-1 rounded-lg font-black hover:brightness-90 hover:shadow-md"
              style={{ background: on ? '#15803d' : '#e7dede', color: on ? '#ffffff' : INK, fontSize: 15, cursor: 'pointer', border: `1px solid ${on ? '#15803d' : ACCENT}` }}
              title={on ? `${g.name}: appointments are being pulled - click to switch off` : `${g.name}: click to also pull its appointments`}>
              {on ? '✓ ' : ''}{g.id}
            </button>
          );
        })}
        <span style={{ color: MUTED, fontSize: 15 }}>For a gym that runs Kids Night Out or Open Gym as appointments. Off for everyone else.</span>
      </div>

      <div className="flex gap-4 items-start">
        {/* LEFT — what needs a home, what is trained, what is forced */}
        <div className="w-80 flex-shrink-0 rounded-xl p-2 overflow-y-auto" style={{ background: '#ece4e4', border: `1px solid ${LINE}`, maxHeight: 'calc(100vh - 250px)' }}>
          <div className="px-2 pt-1 pb-1 font-black flex items-center justify-between" style={{ color: INK, fontSize: 15 }}>
            <span>Needs a home</span>
            <span className="px-2 rounded-md" style={{ background: unsorted.length ? '#b91c1c' : '#15803d', color: '#fff' }}>{unsorted.length}</span>
          </div>
          {groups.length === 0 && (
            <div className="px-3 py-2" style={{ color: MUTED, fontSize: 15 }}>Nothing waiting. Every category has a bucket.</div>
          )}
          {groups.map(g => (
            <LeftRow key={`${g.gymId}|${g.name}`} active={isSel('unsorted', g.gymId, g.name)}
              onClick={() => select({ kind: 'unsorted', gymId: g.gymId, name: g.name, hasName: g.hasName })}>
              <span className="font-black">{g.gymId}</span> · {g.name}
              <span className="float-right font-bold" style={{ color: '#b91c1c' }}>{g.count}</span>
            </LeftRow>
          ))}

          <div className="px-2 pt-3 pb-1 font-black flex items-center justify-between" style={{ color: INK, fontSize: 15, borderTop: `1px solid ${LINE}`, marginTop: 8 }}>
            <span>Forced events</span>
            <span className="px-2 rounded-md" style={{ background: ACCENT, color: '#fff' }}>{forced.length}</span>
          </div>
          {forced.length > 0 && (
            <LeftRow active={sel?.kind === 'forced'} onClick={() => select({ kind: 'forced', name: '' })}>
              Show the {forced.length} forced event{forced.length === 1 ? '' : 's'}
            </LeftRow>
          )}

          <div className="px-2 pt-3 pb-1 font-black" style={{ color: INK, fontSize: 15, borderTop: `1px solid ${LINE}`, marginTop: 8 }}>
            Trained categories ({mappings.length})
          </div>
          {buckets.map(b => (rulesByBucket[b.name] || []).length > 0 && (
            <div key={b.name} className="mb-1">
              <div className="px-2 py-0.5"><Pill name={b.name} /></div>
              {(rulesByBucket[b.name] || []).map(r => (
                <LeftRow key={r.id} active={isSel('rule', r.gym_id, r.iclass_type_name)}
                  onClick={() => select({ kind: 'rule', gymId: r.gym_id || null, name: r.iclass_type_name, rule: r })}>
                  {r.iclass_type_name}
                  <span className="float-right font-bold" style={{ color: MUTED }}>{r.gym_id || 'all gyms'}{r.hide_from_calendar ? ' · hidden' : ''}</span>
                </LeftRow>
              ))}
            </div>
          ))}
        </div>

        {/* RIGHT — the selected category and its events */}
        <div className="flex-1 min-w-0 rounded-xl p-4" style={{ background: '#ffffff', border: `1px solid ${LINE}` }}>
          {!sel && (
            <div style={{ color: MUTED, fontSize: 16 }}>
              Pick something on the left. <b style={{ color: INK }}>Needs a home</b> is every event whose iClass category has no bucket yet.
            </div>
          )}

          {sel?.kind === 'forced' && (
            <div>
              <div className="font-black mb-2" style={{ color: INK, fontSize: 18 }}>Forced events</div>
              <p className="mb-3" style={{ color: MUTED, fontSize: 15 }}>These stay in the bucket you chose. Un-force one and it follows its iClass category again.</p>
              {forced.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 py-2" style={{ borderTop: `1px solid ${LINE}`, fontSize: 15, color: INK }}>
                  <span className="font-black w-12">{ev.gym_id}</span>
                  <span className="w-28" style={{ color: MUTED }}>{fmtDate(ev)}</span>
                  <a href={ev.event_url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 font-semibold underline" style={{ color: INK }}>{ev.title}</a>
                  <Pill name={ev.type} />
                  <button onClick={() => unforce(ev)} disabled={busy}
                    className="px-3 py-1 rounded-lg font-bold hover:brightness-90" style={{ background: INK, color: '#fff', fontSize: 15, cursor: 'pointer' }}>
                    Un-force
                  </button>
                </div>
              ))}
            </div>
          )}

          {sel && sel.kind !== 'forced' && (
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="font-black" style={{ color: INK, fontSize: 20 }}>{sel.name}</div>
                <div className="font-bold" style={{ color: MUTED, fontSize: 15 }}>
                  iClass category · {sel.gymId ? `${sel.gymId} — ${gymName(sel.gymId)}` : 'every gym'}
                </div>
              </div>

              {sel.kind === 'unsorted' && sel.hasName === false ? (
                <p className="mt-3" style={{ color: '#7f1d1d', fontSize: 15 }}>
                  These events were saved without a category name, so a category rule can’t be made for them. Force each one below.
                </p>
              ) : (
                <div className="mt-3 p-3 rounded-xl" style={{ background: '#f6f1f1', border: `1px solid ${LINE}` }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-black" style={{ color: INK, fontSize: 16 }}>
                      {currentRuleBucket
                        ? `✓ Sorted. Every event in this category, now and in the future, goes to ${bucketLabel(currentRuleBucket)}. Click another bucket to change it.`
                        : 'Pick the bucket for this whole category (covers future events too):'}
                    </span>
                    {sel.kind === 'unsorted' && (
                      <span className="flex rounded-lg overflow-hidden ml-auto" style={{ border: `2px solid ${INK}` }}>
                        {[['gym', `Only ${sel.gymId}`], ['all', 'Every gym']].map(([v, label]) => (
                          <button key={v} onClick={() => setScope(v)}
                            className="px-3 py-1 font-bold"
                            style={{ background: scope === v ? INK : '#fff', color: scope === v ? '#fff' : INK, fontSize: 15, cursor: 'pointer' }}>
                            {label}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {buckets.map(b => (
                      <BucketButton key={b.name} b={b} active={currentRuleBucket === b.name} onClick={() => train(b.name)} />
                    ))}
                  </div>
                  {sel.kind === 'rule' && sel.rule?.id && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => toggleHide(sel.rule)} disabled={busy}
                        className="px-3 py-1 rounded-lg font-bold hover:brightness-90" style={{ background: '#e7dede', color: INK, fontSize: 15, cursor: 'pointer', border: `1px solid ${ACCENT}` }}>
                        {sel.rule.hide_from_calendar ? 'Hidden from calendar — show it again' : 'Hide this category from the calendar'}
                      </button>
                      <button onClick={() => removeRule(sel.rule)} disabled={busy}
                        className="px-3 py-1 rounded-lg font-bold hover:brightness-90" style={{ background: '#b91c1c', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
                        Remove this rule
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 font-black" style={{ color: INK, fontSize: 16 }}>
                Events in this category ({selEvents.length})
              </div>
              {selEvents.length === 0 && (
                <div className="py-2" style={{ color: MUTED, fontSize: 15 }}>No events on the calendar in this category right now.</div>
              )}
              {selEvents.map(ev => (
                <div key={ev.id} className="py-2" style={{ borderTop: `1px solid ${LINE}`, fontSize: 15, color: INK }}>
                  <div className="flex items-center gap-3">
                    {!sel.gymId && <span className="font-black w-12">{ev.gym_id}</span>}
                    <span className="w-32 flex-shrink-0" style={{ color: MUTED }}>{fmtDate(ev)}</span>
                    <a href={ev.event_url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 font-semibold underline" style={{ color: INK }}>{ev.title} ↗</a>
                    <Pill name={ev.type} />
                    {forceReady && !ev.type_locked && (
                      <button onClick={() => setOpenEvent(openEvent === ev.id ? null : ev.id)} disabled={busy}
                        className="px-2.5 py-1 rounded-lg font-bold hover:brightness-90"
                        style={{ background: openEvent === ev.id ? INK : '#e7dede', color: openEvent === ev.id ? '#fff' : INK, fontSize: 15, cursor: 'pointer', border: `1px solid ${ACCENT}` }}
                        title="Put only this event in a different bucket than the rest of its category">
                        {openEvent === ev.id ? 'Cancel' : 'Move only this one'}
                      </button>
                    )}
                    {ev.type_locked && (
                      <button onClick={() => unforce(ev)} disabled={busy}
                        className="px-2.5 py-1 rounded-lg font-bold hover:brightness-90" style={{ background: INK, color: '#fff', fontSize: 15, cursor: 'pointer' }}>
                        Forced · un-force
                      </button>
                    )}
                  </div>
                  {forceReady && !ev.type_locked && openEvent === ev.id && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span style={{ color: MUTED }}>Only this event goes to →</span>
                      {buckets.map(b => (
                        <BucketButton key={b.name} b={b} small active={false} onClick={() => force(ev, b.name)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
