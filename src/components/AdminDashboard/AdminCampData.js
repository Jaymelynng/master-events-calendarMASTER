// ============================================================================
// CAMP DATA - every gym's summer camps, live from the calendar's own Supabase (Jayme 2026-11-12:
// "Yes, start step 1"). Replaces the hand-copied claude.ai "Summer Camp Data" page: this tab reads the same
// tables the sync fills, so it is current after every sync and nothing is copied by hand. Read-only.
//
//   Camps + the names behind the ids  iclass_camp_audit (view)
//   Every setting, description, days  iclass_camp_setup (raw = the whole signed-in iClass reply)
//   Price tables                      iclass_price_cells (view)
//   When iClass was read              iclass_setup_reads
//   Summer dates                      camp_audit_standards (settings.window)
//   Which camps are summer camps      Admin > Buckets (event_type_mappings) -> CAMP / CAMP CARE, the same
//                                     filter as automation/camp_audit.py
//   How settings are grouped          camp_setting_groups (database/ADD_CAMP_SETTING_GROUPS.sql)
//
// Look: Jayme's CORE-VISUAL-DESIGN-PHILOSOPHY - every layer contrasts with the one it touches and lifts
// (two-layer shadows); the open camp is a recessed tray with raised cards; each week is its own raised card.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { resolveRule } from '../../lib/bucketRules';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ymd = (s) => String(s || '').slice(0, 10).split('-').map(Number);
const fmtDate = (s) => { if (!s) return ''; const [, m, d] = ymd(s); return `${MONTHS[m - 1]} ${d}`; };
const fullDate = (s) => { if (!s) return '?'; const [y, m, d] = ymd(s); return `${m}/${d}/${y}`; };
const wk = (s) => { const [y, m, d] = ymd(s); return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
const weekOf = (s) => { const [y, m, d] = ymd(s); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const money = (n) => (n == null ? '' : `$${Number.isInteger(n) ? n : Number(n).toFixed(2)}`);
const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
const clock = (sec) => { if (sec == null) return '?'; const mins = Math.floor(Number(sec) / 60); const h = Math.floor(mins / 60); const mi = mins % 60; const ap = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 || 12; return mi ? `${h12}:${String(mi).padStart(2, '0')} ${ap}` : `${h12} ${ap}`; };
// iClass's own words: 13.9167 -> "13 years 11 months" (same as automation/audit_page_sheets.py age_text)
const ageText = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v); let y = Math.floor(n); let m = Math.round((n - y) * 12);
  if (m === 12) { y += 1; m = 0; }
  return `${y} ${y === 1 ? 'year' : 'years'}${m ? ` ${m} ${m === 1 ? 'month' : 'months'}` : ''}`;
};
const childLabel = (k) => (k === 1 ? '1st child' : k === 2 ? '2nd child' : k === 3 ? '3rd child' : `${k}th child`);
// Brand: the first brand color white text reads on (4.5:1), else the darkest
const lum = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const brandOf = (g) => {
  const cols = (g?.brand_colors || []).filter(c => /^#[0-9a-f]{6}$/i.test(c));
  if (!cols.length) return { main: '#1747c9', colors: [] };
  return { main: cols.find(c => 1.05 / (lum(c) + 0.05) >= 4.5) || [...cols].sort((a, b) => lum(a) - lum(b))[0], colors: cols };
};
// What a price table gives the 2nd / 3rd child (its 1-day column), from the table itself
const sibText = (p) => {
  const r1 = p.rows.find(r => r.child === 1); const a1 = r1 && r1.amounts[0];
  if (!a1) return 'no 1-day price to compare';
  const pct = (k) => { const r = p.rows.find(x => x.child === k); return r && r.amounts[0] != null ? Math.round((1 - r.amounts[0] / a1) * 100) : null; };
  const p2 = pct(2); const p3 = pct(3);
  if (p2 == null && p3 == null) return 'no 2nd-child row';
  if (!p2 && !p3) return 'none';
  if (p3 == null) return `${p2}% off the 2nd child (no 3rd-child row)`;
  return p2 === p3 ? `${p2}% off the 2nd and 3rd child` : `${p2}% off the 2nd, ${p3}% off the 3rd`;
};

// The description exactly as iClass formats it (its own HTML), cleaned: only text tags and real links survive.
const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'BLOCKQUOTE', 'HR', 'SUB', 'SUP', 'S']);
const cleanHtml = (html) => {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = (el) => [...el.children].forEach(ch => {
    if (!KEEP.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); walk(el); return; }
    [...ch.attributes].forEach(a => { if (!(ch.tagName === 'A' && a.name === 'href' && /^https?:/i.test(a.value))) ch.removeAttribute(a.name); });
    if (ch.tagName === 'A') { ch.target = '_blank'; ch.rel = 'noopener'; }
    walk(ch);
  });
  const root = doc.body.firstElementChild; walk(root); return root.innerHTML;
};
const label = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase()).replace(/\bId\b/g, 'id');

// Every row of a read, paged on a unique order (Supabase stops at 1,000 rows and still says success)
async function readAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

async function loadGym(gym, win, rules) {
  const all = await readAll(() => supabase.from('iclass_camp_audit').select('*')
    .eq('gym_id', gym.id).is('gone_from_iclass_at', null).gte('start_date', win[0]).lte('start_date', win[1])
    .order('camp_id'));
  // The SAME summer-camp filter as the audit (camp_audit.py / audit_page_sheets.py): bucket CAMP / CAMP CARE,
  // minus school-year / school-closure camps in the window. Left-out camps are named, never silently dropped.
  // NOTE (no-hardcoding law): the school-year/closure words are the audit's own test, kept identical here on
  // purpose; they move to a Summer / School-year tag per camp type in Buckets (open item), then both read that.
  const bucketOf = (c) => { const r = resolveRule(c.camp_type_name, gym.id, rules); return r ? r.event_type : null; };
  const schoolYear = (c) => /school\s*(year|closure)/i.test(`${c.camp_type_name || ''} ${c.camp_name || ''}`);
  const leftOut = all.filter(c => !['CAMP', 'CAMP CARE'].includes(bucketOf(c)) || schoolYear(c));
  const camps = all.filter(c => !leftOut.includes(c));
  const ids = camps.map(c => c.camp_id);
  const setups = {};
  for (let i = 0; i < ids.length; i += 200) {
    const part = await readAll(() => supabase.from('iclass_camp_setup').select('camp_id, raw, public_raw, occupancy, read_at')
      .eq('gym_id', gym.id).in('camp_id', ids.slice(i, i + 200)).order('camp_id'));
    part.forEach(s => { setups[s.camp_id] = s; });
  }
  const tableIds = [...new Set(camps.map(c => c.price_table_id).filter(x => x != null))];
  const cells = tableIds.length ? await readAll(() => supabase.from('iclass_price_cells')
    .select('price_table_id, price_table_name, child_number, days, amount')
    .eq('gym_id', gym.id).in('price_table_id', tableIds).order('price_table_id').order('child_number').order('days')) : [];
  const { data: reads } = await supabase.from('iclass_setup_reads').select('finished_at, status')
    .eq('gym_id', gym.id).not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1);

  const list = camps.map(c => {
    const s = setups[c.camp_id] || {}; const raw = s.raw || {};
    const dayList = [];
    (raw.schedule || []).forEach(sch => (sch.blocks || []).forEach(b => dayList.push({ date: b.date, start: clock(sch.startTimeInt), end: clock(sch.endTimeInt) })));
    dayList.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const occ = Array.isArray(s.occupancy) ? s.occupancy : [];
    const amin = ageText(c.min_age); const amax = ageText(c.max_age);
    const pub = s.public_raw || {};
    return {
      id: c.camp_id, name: c.camp_name, type: c.camp_type_name || 'No camp type',
      start: c.start_date, end: c.end_date, dayList,
      active: raw.active == null ? null : raw.active === 1,
      ages: amin && amax ? `${amin} – ${amax}` : amin ? `${amin} and up` : amax ? `up to ${amax}` : 'not set',
      singleDay: c.per_day_signup, showOnWeb: c.show_on_web, regStart: c.registration_start, regEnd: c.registration_end,
      maxKids: c.max_entries, enrolled: Math.max(0, ...occ.map(d => Number(d.occ) || 0)),
      priceTableId: c.price_table_id,
      link: gym.iclass_slug ? `https://portal.iclasspro.com/${gym.iclass_slug}/camp-details/${c.camp_id}?typeId=${c.camp_type_id}` : null,
      picture: c.picture_path ? `https://images.iclasspro.com/images/${c.picture_path}` : null,
      html: raw.description || '',
      settings: Object.fromEntries(Object.entries(raw).filter(([k]) => !['description', 'schedule', 'blocks'].includes(k))),
      portal: Object.fromEntries(Object.entries(pub).filter(([k, v]) => !['description', 'schedule', 'blocks'].includes(k) && JSON.stringify(raw[k]) !== JSON.stringify(v))),
      names: { program_name: c.program_name, camp_type_name: c.camp_type_name, price_table_name: c.price_table_name, charge_category_name: c.charge_category_name, charge_category_expires: c.charge_category_expires },
      dayCaps: occ.map(d => ({ date: String(d.sqlDate || '').slice(0, 10), in: d.occ, open: d.open, wait: d.occwait })),
      readAt: s.read_at,
    };
  }).sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.type.localeCompare(b.type) || String(a.name).localeCompare(String(b.name)));

  const pricing = tableIds.map(tid => {
    const mine = cells.filter(x => x.price_table_id === tid);
    const days = [...new Set(mine.map(x => x.days))].sort((a, b) => a - b);
    const rows = [...new Set(mine.map(x => x.child_number))].sort((a, b) => a - b).map(k => ({
      child: k, amounts: days.map(d => { const x = mine.find(y => y.child_number === k && y.days === d); return x && x.amount != null ? Number(x.amount) : null; }),
    }));
    const users = list.filter(c => c.priceTableId === tid);
    return { id: tid, schedule: (mine[0] && mine[0].price_table_name) || (camps.find(c => c.price_table_id === tid) || {}).price_table_name || `Price table ${tid}`, campCount: users.length, types: [...new Set(users.map(c => c.type))], days, rows };
  });
  return { camps: list, pricing, leftOut: leftOut.map(c => ({ name: c.camp_name, type: c.camp_type_name })), readAt: reads && reads[0] ? reads[0].finished_at : null };
}

function SettingsPanel({ c, groups }) {
  const s = c.settings || {}; const keys = Object.keys(s);
  if (!keys.length) return <p className="cdt-note">The settings for this camp were not read.</p>;
  const tests = groups.map(g => { let re = null; try { re = new RegExp(g.field_pattern, g.case_sensitive ? '' : 'i'); } catch (e) { re = null; } return { name: g.group_name, re }; });
  const groupOf = (k) => (tests.find(t => t.re && t.re.test(k)) || { name: 'Other' }).name;
  const order = [...tests.map(t => t.name), 'Other'];
  const by = {}; keys.forEach(k => { (by[groupOf(k)] = by[groupOf(k)] || []).push(k); });
  const n = c.names || {};
  const named = { programId: n.program_name, campType: n.camp_type_name, typeId: n.camp_type_name, pricingScheduleId: n.price_table_name };
  const val = (k, v) => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return <span className="cdt-blank">blank</span>;
    if (v === true) return <span className="cdt-yes">Yes</span>;
    if (v === false) return <span className="cdt-no">No</span>;
    if (k === 'active') return v === 1 ? <span className="cdt-yes">Active</span> : v === 0 ? <span className="cdt-no">Inactive</span> : String(v);
    if (Array.isArray(v)) return v.map((x, i) => <div key={i}>{x && typeof x === 'object' ? (x.Name || x.name || x.title || x.code || JSON.stringify(x)) : String(x)}</div>);
    if (typeof v === 'object') return JSON.stringify(v);
    if (/date/i.test(k) && /^\d{4}-\d\d-\d\d/.test(String(v))) return `${fullDate(String(v))}${String(v).length > 10 ? ` ${String(v).slice(11, 16)}` : ''}`;
    return <>{String(v)}{named[k] ? <> · <b>{named[k]}</b></> : null}</>;
  };
  const kv = (k, v) => (
    <div className="cdt-kv" key={k}><div className="cdt-k">{label(k)}<small>{k}</small></div><div className="cdt-v">{val(k, v)}</div></div>
  );
  const portalKeys = Object.keys(c.portal || {});
  return (
    <>
      {order.filter(g => by[g]).map(g => (
        <div className="cdt-sgroup" key={g}>
          <h5>{g}</h5>
          <div className="cdt-kvgrid">
            {by[g].map(k => kv(k, s[k]))}
            {g === 'Program, type and price' && n.charge_category_name && (
              <div className="cdt-kv"><div className="cdt-k">Charge category<small>from the camp type</small></div>
                <div className="cdt-v">{n.charge_category_name}{n.charge_category_expires ? ` · expires ${fullDate(n.charge_category_expires)}` : ''}</div></div>
            )}
          </div>
        </div>
      ))}
      {portalKeys.length > 0 && (
        <div className="cdt-sgroup"><h5>What the parent portal reports</h5>
          <div className="cdt-kvgrid">{portalKeys.map(k => kv(k, c.portal[k]))}</div></div>
      )}
    </>
  );
}

function CampDetail({ c, groups }) {
  const caps = Object.fromEntries((c.dayCaps || []).map(d => [d.date, d]));
  const anyWait = (c.dayCaps || []).some(d => d.wait);
  const desc = useMemo(() => (c.html ? cleanHtml(c.html) : ''), [c.html]);
  return (
    <div className="cdt-detail">
      <div className="cdt-cdgrid">
        <div className="cdt-left">
          <section className="cdt-card">
            <div className="cdt-head"><h5>Description <small>as iClass shows it</small></h5>
              <div className="cdt-links">
                {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer">Parent page ↗</a>}
                {c.picture && <a href={c.picture} target="_blank" rel="noopener noreferrer">Full-size picture ↗</a>}
              </div></div>
            <div className="cdt-pic">{c.picture ? <img src={c.picture} alt={c.name} loading="lazy" /> : <p className="cdt-miss">No picture</p>}</div>
            {desc ? <div className="cdt-rich" dangerouslySetInnerHTML={{ __html: desc }} /> : <p className="cdt-miss">No description</p>}
          </section>
          <section className="cdt-card">
            <div className="cdt-head"><h5>Each day <small>hours · signed up · spots open</small></h5></div>
            {c.dayList.length ? (
              <table className="cdt-daytbl"><thead><tr><th>Day</th><th>Hours</th><th className="cdt-num">In</th><th className="cdt-num">Open</th>{anyWait && <th className="cdt-num">Wait</th>}</tr></thead>
                <tbody>{c.dayList.map(d => { const x = caps[d.date] || {}; return (
                  <tr key={d.date}><td><b>{wk(d.date)} {fmtDate(d.date)}</b></td><td>{d.start}–{d.end}</td><td className="cdt-num">{x.in ?? '—'}</td><td className="cdt-num">{x.open ?? '—'}</td>{anyWait && <td className="cdt-num">{x.wait ?? 0}</td>}</tr>); })}</tbody></table>
            ) : <p className="cdt-note">No camp days set.</p>}
          </section>
        </div>
        <section className="cdt-card">
          <div className="cdt-head"><h5>Every iClass setting <small>{Object.keys(c.settings || {}).length} fields{c.readAt ? ` · read ${when(c.readAt)}` : ''}</small></h5></div>
          <SettingsPanel c={c} groups={groups} />
        </section>
      </div>
    </div>
  );
}

export default function AdminCampData({ gyms = [] }) {
  const sorted = useMemo(() => [...gyms].sort((a, b) => (a.id || '').localeCompare(b.id || '')), [gyms]);
  const [current, setCurrent] = useState(() => { try { return localStorage.getItem('campdata-gym') || null; } catch (e) { return null; } });
  const [base, setBase] = useState(null);          // { win, rules, groups }
  const [data, setData] = useState({});            // gym id -> loaded gym data
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: std, error: e1 }, { data: rules, error: e2 }, { data: groups, error: e3 }] = await Promise.all([
          supabase.from('camp_audit_standards').select('id, settings'),
          supabase.from('event_type_mappings').select('*'),
          supabase.from('camp_setting_groups').select('*').order('sort'),
        ]);
        if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message);
        const withWin = (std || []).filter(s => s.settings && Array.isArray(s.settings.window) && s.settings.window[0]);
        if (!withWin.length) throw new Error('The Summer Camp Standards have no summer dates (camp_audit_standards).');
        if (alive) setBase({ win: withWin[withWin.length - 1].settings.window, stdId: withWin[withWin.length - 1].id, rules: rules || [], groups: groups || [] });
      } catch (e) { if (alive) setError(e.message); }
    })();
    return () => { alive = false; };
  }, []);

  const gym = sorted.find(g => g.id === current) || sorted[0];
  // each gym loads once per visit to the tab (a fresh visit reads again, so it shows the newest sync)
  const started = useRef(new Set());
  useEffect(() => {
    if (!base || !gym || started.current.has(gym.id)) return;
    started.current.add(gym.id);
    const id = gym.id;
    loadGym(gym, base.win, base.rules)
      .then(r => setData(d => ({ ...d, [id]: r })))
      .catch(e => setData(d => ({ ...d, [id]: { error: e.message } })));
  }, [base, gym]);

  const pick = (id) => { setCurrent(id); setFilter('all'); try { localStorage.setItem('campdata-gym', id); } catch (e) { /* per-viewer only */ } };
  const toggle = (id) => setOpen(prev => { const n = new Set(prev); const k = `${gym.id}:${id}`; n.has(k) ? n.delete(k) : n.add(k); return n; });
  const b = brandOf(gym);
  const d = gym ? data[gym.id] : null;

  return (
    <div className="cdt" style={{ '--brand': b.main }}>
      <style>{CSS}</style>
      <div className="cdt-wrap">
        <nav className="cdt-rail" aria-label="Gyms">
          {sorted.map(g => { const gb = brandOf(g); const on = g.id === gym?.id; return (
            <button key={g.id} type="button" className="cdt-gym" aria-current={on} onClick={() => pick(g.id)} style={{ '--g': gb.main }}>
              <span className="cdt-logo">{g.logo_url ? <img src={g.logo_url} alt="" /> : g.id.slice(0, 1)}</span>
              <span className="cdt-gname"><b>{g.id}</b><small>{g.name}</small></span>
              {data[g.id] && data[g.id].camps && <span className="cdt-pill">{data[g.id].camps.length}</span>}
            </button>); })}
        </nav>

        <main className="cdt-page">
          {error && <div className="cdt-err">Could not load camp data: {error}</div>}
          {gym && (
            <section className="cdt-band">
              <div className="cdt-band-in">
                <div className="cdt-biglogo">{gym.logo_url ? <img src={gym.logo_url} alt="" /> : <b>{gym.id}</b>}</div>
                <div className="cdt-who"><h2>{gym.name}</h2>
                  <div className="cdt-sub">{gym.id} · Summer camps {base ? `${fmtDate(base.win[0])} – ${fmtDate(base.win[1])}` : ''} · iClass read {d && d.readAt ? when(d.readAt) : d && d.camps ? 'not read yet' : '…'}</div></div>
              </div>
              {b.colors.length > 0 && <div className="cdt-stripe" aria-hidden>{b.colors.map(c => <span key={c} style={{ background: c }} />)}</div>}
            </section>
          )}
          {(!d || d.loading) && !error && <div className="cdt-sheet"><p className="cdt-note">Loading {gym ? gym.id : ''} camps…</p></div>}
          {d && d.error && <div className="cdt-err">Could not load {gym.id}: {d.error}</div>}
          {d && d.camps && <GymSheet d={d} filter={filter} setFilter={setFilter} open={open} toggle={toggle} gymId={gym.id} groups={base.groups} />}
        </main>
      </div>
    </div>
  );
}

function GymSheet({ d, filter, setFilter, open, toggle, gymId, groups }) {
  const { camps, pricing, leftOut } = d;
  const N = camps.length; const today = todayIso();
  if (!N) return (
    <div className="cdt-sheet"><p className="cdt-note">No summer camps in iClass for {gymId} at the last read. Once the gym enters them and the gym is synced, they show up here.</p>
      {leftOut.length > 0 && <div className="cdt-leftout"><b>Not summer camps (left out):</b> {leftOut.map(x => x.name).join(' · ')}</div>}</div>
  );
  const types = [...new Set(camps.map(c => c.type))];
  const weeks = [...new Set(camps.map(c => weekOf(c.start)))].sort();
  const count = (f) => camps.filter(f).length;
  const live = count(c => c.active !== false && c.showOnWeb && c.regStart && c.regStart <= today && (!c.regEnd || c.regEnd >= today));
  const inactive = count(c => c.active === false);
  const single = count(c => c.singleDay);
  const signed = camps.reduce((n, c) => n + (c.enrolled || 0), 0);
  const opens = Object.entries(camps.reduce((m, c) => { const k = c.regStart || 'not set'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const ageSet = [...new Set(camps.map(c => c.ages))];
  const splitT = new Set(camps.filter(c => /ninja/i.test(c.name || '')).map(c => c.type).filter(t => camps.some(c => c.type === t && !/ninja/i.test(c.name || ''))));
  const colOf = (c) => (splitT.has(c.type) ? `${c.type} · ${/ninja/i.test(c.name || '') ? 'Ninja' : 'Gymnastics'}` : c.type);
  const cols = types.flatMap(t => (splitT.has(t) ? [`${t} · Gymnastics`, `${t} · Ninja`] : [t]));
  const list = camps.filter(c => filter === 'all' || c.type === filter);
  const byWeek = [...new Set(list.map(c => weekOf(c.start)))].sort().map(w => [w, list.filter(c => weekOf(c.start) === w)]);
  const jump = (ids) => { setFilter('all'); ids.forEach(id => { if (!open.has(`${gymId}:${id}`)) toggle(id); }); setTimeout(() => { const el = document.getElementById(`cdt-camp-${ids[0]}`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 50); };
  const tile = (k, v, s) => <div className="cdt-tile"><div className="cdt-tk">{k}</div><div className="cdt-tv">{v}</div>{s && <div className="cdt-ts">{s}</div>}</div>;

  return (
    <>
      <div className="cdt-sec"><div className="cdt-sec-h"><h3>At a glance</h3></div>
        <div className="cdt-dash">
          {tile('Camp weeks', weeks.length, weeks.length ? `${fmtDate(weeks[0])} – ${fmtDate(weeks[weeks.length - 1])}` : '')}
          {tile('Camps', N, `${N - inactive} Active · ${inactive} Inactive`)}
          {tile('Parents can see now', live, live ? 'Visible on the portal today' : 'None visible today')}
          {tile('Registration opens', opens[0] ? fullDate(opens[0][0]) : '?', opens.length > 1 ? opens.slice(1).map(([dt, n]) => `${n} on ${fullDate(dt)}`).join(' · ') : `All ${N} camps`)}
          {tile('Single-day sign-up', `${single} of ${N}`, single === N ? 'Every camp sells single days' : single ? 'Some camps sell single days' : 'Full week only')}
          {tile('Signed up so far', signed, 'Kids on the busiest day, all camps added')}
        </div>
        <div className="cdt-dash2">
          <div className="cdt-tile"><div className="cdt-tk">Camps offered (Event Types)</div><ul>{types.map(t => <li key={t}><b>{t}</b> · {count(c => c.type === t)} camps · {[...new Set(camps.filter(c => c.type === t).map(c => c.ages))].join(' / ')}</li>)}</ul></div>
          <div className="cdt-tile"><div className="cdt-tk">Price tables · sibling discount</div><ul>{pricing.map(p => <li key={p.id}><b>{p.schedule}</b> · {p.campCount} camps · <b>{sibText(p)}</b></li>)}</ul></div>
          <div className="cdt-tile"><div className="cdt-tk">Ages (from the settings)</div><ul>{ageSet.map(a => <li key={a}>{a} · {count(c => c.ages === a)} camps</li>)}</ul></div>
        </div>
        {leftOut.length > 0 && <div className="cdt-leftout"><b>Not on this sheet:</b> {leftOut.length} camp{leftOut.length === 1 ? '' : 's'} in these dates that are not summer camps (school-year or school-closure): {leftOut.map(x => x.name).join(' · ')}</div>}
      </div>

      <div className="cdt-sec"><div className="cdt-sec-h"><h3>Every week × every camp</h3></div>
        <div className="cdt-tablewrap"><table className="cdt-mx"><thead><tr><th>Week of</th>{cols.map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>
          {weeks.map(w => <tr key={w}><td><b>{fmtDate(w)}</b></td>{cols.map(t => { const here = camps.filter(c => weekOf(c.start) === w && colOf(c) === t);
            return here.length ? <td key={t} className={here.length > 1 ? 'two' : 'ok'} title={here.map(c => c.name).join('\n')} onClick={() => jump(here.map(c => c.id))}>{here.length > 1 ? `${here.length} camps` : '✓'}</td> : <td key={t} className="none">none</td>; })}</tr>)}
        </tbody></table></div>
        <p className="cdt-note">Click a cell to open that week's camp below. Yellow = more than one camp in that spot (often the same camp entered twice).</p>
      </div>

      <div className="cdt-sec"><div className="cdt-sec-h"><h3>Price tables</h3></div>
        <div className="cdt-ptgrid">{pricing.map(p => (
          <div key={p.id}><h4>{p.schedule}</h4><p className="cdt-note">{p.campCount} camp{p.campCount === 1 ? '' : 's'} · {p.types.join(', ')} · sibling: {sibText(p)}</p>
            <div className="cdt-tablewrap"><table><thead><tr><th>Days</th>{p.days.map(x => <th key={x} className="cdt-num">{x}</th>)}</tr></thead><tbody>
              {p.rows.map(r => <tr key={r.child}><td><b>{childLabel(r.child)}</b></td>{r.amounts.map((a, i) => (a == null ? <td key={i} className="cdt-num cdt-blankcell">blank</td> : <td key={i} className="cdt-num">{money(a)}</td>))}</tr>)}
            </tbody></table></div></div>))}</div>
      </div>

      <div className="cdt-sec"><div className="cdt-sec-h"><h3>Every camp week</h3></div>
        <div className="cdt-chips" role="group" aria-label="Show Event Type">
          <button type="button" className="cdt-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All <span>{N}</span></button>
          {types.map(t => <button type="button" key={t} className="cdt-chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>{t} <span>{count(c => c.type === t)}</span></button>)}
        </div>
        <p className="cdt-note">Press <b>Open</b> on any camp to see its full description, every setting, each day's hours and its picture.</p>
        {byWeek.map(([w, wl]) => (
          <section className="cdt-weekcard" key={w}>
            <div className="cdt-weekhead"><span>Week {weeks.indexOf(w) + 1} · {fmtDate(w)}</span><span className="cdt-wkcount">{wl.length} camp{wl.length === 1 ? '' : 's'}</span></div>
            <div className="cdt-weekscroll"><table>
              <colgroup><col style={{ width: 92 }} /><col style={{ width: 120 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 170 }} /><col style={{ width: 130 }} /><col style={{ width: 150 }} /><col style={{ width: 70 }} /></colgroup>
              <thead><tr><th /><th>Dates</th><th>Camp</th><th>Status</th><th>Days &amp; times</th><th>Sign-up</th><th>Ages (setting)</th><th className="cdt-num">Spots</th></tr></thead>
              <tbody>{wl.map(c => { const isOpen = open.has(`${gymId}:${c.id}`); const times = [...new Set(c.dayList.map(x => `${x.start}–${x.end}`))].join(' · ') || '—'; return (
                <React.Fragment key={c.id}>
                  <tr className="cdt-camprow" id={`cdt-camp-${c.id}`} aria-expanded={isOpen} onClick={() => toggle(c.id)}>
                    <td><button type="button" className="cdt-openbtn" onClick={(e) => { e.stopPropagation(); toggle(c.id); }}>{isOpen ? 'Close ▾' : 'Open ▸'}</button></td>
                    <td className="cdt-nowrap"><b>{fmtDate(c.start)}–{fmtDate(c.end)}</b></td>
                    <td>{c.name}<small>{c.type}</small></td>
                    <td><span className={`cdt-su ${c.active === true ? 'on' : c.active === false ? 'off' : 'unk'}`}>{c.active === true ? 'Active' : c.active === false ? 'Inactive' : 'Not read'}</span><small>{c.showOnWeb ? 'On web' : 'Hidden'} · opens {fullDate(c.regStart)}</small></td>
                    <td>{c.dayList.length || '?'} days<small>{times}</small></td>
                    <td><span className={`cdt-su ${c.singleDay ? 'day' : 'week'}`}>{c.singleDay ? 'Single days' : 'Full week only'}</span></td>
                    <td>{c.ages}</td>
                    <td className="cdt-num">{c.enrolled} / {c.maxKids ?? '?'}</td>
                  </tr>
                  {isOpen && <tr className="cdt-detailrow"><td colSpan={8}><CampDetail c={c} groups={groups} /></td></tr>}
                </React.Fragment>); })}</tbody>
            </table></div>
          </section>
        ))}
      </div>
    </>
  );
}

// Styles live here (scoped under .cdt) so the tab carries the exact look approved on the claude.ai page.
const CSS = `
.cdt{--sheet:#fff;--ink:#14181f;--muted:#3f4857;--line:#c9d0db;--soft:#eef1f6;--zebra:#f6f8fb;--tray:#cfd6e2;--accent:#1747c9;--ok:#16794a;--bad:#b3261e;
  --sh1:0 1px 2px rgba(16,24,40,.10),0 2px 6px rgba(16,24,40,.08);--sh2:0 2px 4px rgba(16,24,40,.10),0 8px 20px rgba(16,24,40,.12);
  --sh3:0 4px 8px rgba(16,24,40,.14),0 16px 36px rgba(16,24,40,.18);--lift:0 14px 34px rgba(16,24,40,.24),0 4px 10px rgba(16,24,40,.16);
  color:var(--ink);font-size:15px;line-height:1.45}
.cdt-wrap{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:900px){.cdt-wrap{grid-template-columns:1fr}}
.cdt-rail{position:sticky;top:12px;display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 24px);overflow:auto;padding:2px 4px 8px 2px}
@media (max-width:900px){.cdt-rail{position:static;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));max-height:none}}
.cdt-gym{display:flex;align-items:center;gap:9px;width:100%;text-align:left;cursor:pointer;background:var(--sheet);color:var(--ink);border:1px solid var(--line);border-left:6px solid var(--g);border-radius:10px;padding:7px 9px;box-shadow:var(--sh1);transition:box-shadow .15s,transform .15s}
.cdt-gym:hover{box-shadow:var(--sh2);transform:translateY(-1px)}
.cdt-gym[aria-current="true"]{background:var(--g);color:#fff;border-color:var(--g);box-shadow:var(--sh3)}
.cdt-logo{flex:none;width:34px;height:34px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 2px 4px rgba(0,0,0,.18);display:grid;place-items:center;overflow:hidden;font-weight:800;color:#111}
.cdt-logo img{width:30px;height:30px;object-fit:contain}
.cdt-gname{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}
.cdt-gname b{font-weight:800;font-size:14px}.cdt-gname small{font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cdt-pill{flex:none;font-weight:700;font-size:12px;line-height:1;border-radius:999px;padding:4px 8px;background:var(--soft);color:var(--ink)}
.cdt-page{min-width:0;display:flex;flex-direction:column;gap:14px}
.cdt-band{background:var(--brand);color:#fff;border-radius:14px;box-shadow:var(--sh3);overflow:hidden}
.cdt-band-in{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:16px 18px}
.cdt-biglogo{flex:none;width:72px;height:72px;border-radius:16px;background:#fff;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.25),0 8px 18px rgba(0,0,0,.2);color:#111}
.cdt-biglogo img{width:62px;height:62px;object-fit:contain}
.cdt-band h2{font-weight:800;font-size:24px;margin:0}.cdt-sub{font-size:14px;font-weight:600}
.cdt-stripe{display:flex;height:10px}.cdt-stripe span{flex:1}
.cdt-sheet,.cdt-sec{background:var(--sheet);border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0;box-shadow:var(--sh2)}
.cdt-sec-h{margin-bottom:10px;padding-bottom:8px;border-bottom:3px solid var(--brand)}.cdt-sec-h h3{font-weight:800;font-size:17px;margin:0}
.cdt-note{color:var(--muted);font-size:13px;margin:6px 0}
.cdt-err{background:#fde2e2;color:#8a1616;border-radius:10px;padding:10px 12px;font-weight:700}
.cdt-dash{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.cdt-dash2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin-top:10px}
.cdt-tile{background:var(--sheet);border:1px solid var(--line);border-top:4px solid var(--brand);border-radius:10px;padding:10px 12px;box-shadow:var(--sh1);min-width:0}
.cdt-tk{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.cdt-tv{font-weight:800;font-size:26px;line-height:1.15;margin-top:2px}.cdt-ts{font-size:13px;margin-top:3px}
.cdt-tile ul{margin:6px 0 0;padding-left:18px;font-size:14px;line-height:1.5}
.cdt-leftout{margin-top:10px;font-size:13px;background:var(--soft);border-radius:10px;padding:10px 12px}
.cdt-tablewrap{overflow-x:auto;border-radius:10px;box-shadow:var(--sh2);border:1px solid var(--line)}
.cdt table{border-collapse:collapse;width:100%;font-size:14px;background:var(--sheet)}
.cdt th,.cdt td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.cdt th{background:var(--brand);color:#fff;font-weight:700;font-size:13px;letter-spacing:.03em;text-transform:uppercase}
.cdt-num{text-align:right!important;font-variant-numeric:tabular-nums;white-space:nowrap}.cdt-nowrap{white-space:nowrap}
.cdt-blankcell{color:var(--bad);font-weight:800}
.cdt-mx td,.cdt-mx th{text-align:center;padding:6px 8px}.cdt-mx td:first-child,.cdt-mx th:first-child{text-align:left;white-space:nowrap}
.cdt-mx .ok{background:#c8f0d9;font-weight:800;cursor:pointer}.cdt-mx .two{background:#ffe2a8;font-weight:800;cursor:pointer}.cdt-mx .none{background:var(--bad);color:#fff;font-weight:800}
.cdt-ptgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.cdt-ptgrid h4{font-weight:700;font-size:15px;margin:0 0 2px}
.cdt-chips{display:flex;flex-wrap:wrap;gap:8px}
.cdt-chip{flex:1 1 auto;background:var(--sheet);color:var(--ink);border:2px solid var(--line);border-radius:999px;padding:7px 14px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:var(--sh1)}
.cdt-chip span{font-weight:800;margin-left:4px}.cdt-chip:hover{border-color:var(--brand)}
.cdt-chip[aria-pressed="true"]{background:var(--brand);color:#fff;border-color:var(--brand);box-shadow:var(--sh2)}
.cdt-weekcard{background:var(--sheet);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh3);overflow:hidden;margin-top:20px}
.cdt-weekhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 16px;background:var(--brand);color:#fff;font-weight:800;font-size:17px}
.cdt-wkcount{font-weight:700;font-size:13px;background:rgba(255,255,255,.22);border-radius:999px;padding:3px 10px}
.cdt-weekscroll{overflow-x:auto}.cdt-weekcard table{table-layout:fixed;min-width:980px}
.cdt-weekcard th{background:var(--soft);color:var(--ink);border-bottom:2px solid var(--line)}
.cdt-camprow{cursor:pointer}.cdt-camprow:hover td{background:var(--soft)}
.cdt-camprow td small{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-top:2px}
.cdt-camprow[aria-expanded="true"] td{background:var(--soft);font-weight:600}
.cdt-openbtn{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:7px 11px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;box-shadow:var(--sh1);transition:box-shadow .12s,transform .12s,filter .12s}
.cdt-openbtn:hover{filter:brightness(1.12);box-shadow:var(--sh2);transform:translateY(-1px)}
.cdt-camprow[aria-expanded="true"] .cdt-openbtn{background:var(--ink)}
.cdt-su{display:inline-block;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13px;white-space:nowrap}
.cdt-su.on,.cdt-su.day{background:#c8f0d9;color:var(--ink)}.cdt-su.off{background:var(--bad);color:#fff}.cdt-su.unk,.cdt-su.week{background:var(--soft);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.cdt-detailrow td{padding:0;background:var(--tray)}
.cdt-detail{background:var(--tray);padding:18px;border-left:6px solid var(--brand);box-shadow:inset 0 4px 12px rgba(16,24,40,.18),inset 0 -2px 6px rgba(16,24,40,.08)}
.cdt-cdgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.45fr);gap:18px;align-items:start}
@media (max-width:1100px){.cdt-cdgrid{grid-template-columns:1fr}}
.cdt-left{display:flex;flex-direction:column;gap:18px;min-width:0}
.cdt-card{background:var(--sheet);border-radius:12px;padding:14px 16px;min-width:0;box-shadow:var(--lift)}
.cdt-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 12px;margin:-14px -16px 12px;padding:10px 16px;border-radius:12px 12px 0 0;background:var(--soft);border-bottom:3px solid var(--brand)}
.cdt-head h5{font-weight:800;font-size:16px;margin:0}.cdt-head h5 small{font-weight:600;font-size:12px;color:var(--muted);margin-left:6px}
.cdt-links{display:flex;gap:12px}.cdt-links a{color:var(--accent);font-weight:700}
.cdt-pic{float:right;width:min(46%,300px);margin:0 0 10px 14px;border-radius:10px;overflow:hidden;box-shadow:0 10px 24px rgba(16,24,40,.28),0 3px 8px rgba(16,24,40,.18)}
.cdt-pic img{display:block;width:100%;height:auto}
@media (max-width:560px){.cdt-pic{float:none;width:100%;margin:0 0 10px}}
.cdt-miss{display:inline-block;background:var(--bad);color:#fff;font-weight:700;border-radius:999px;padding:4px 10px;margin:0;font-size:13px}
.cdt-rich{font-size:14px;line-height:1.5;word-break:break-word}.cdt-rich::after{content:"";display:block;clear:both}
.cdt-rich p{margin:0 0 6px}.cdt-rich p:empty{display:none}.cdt-rich ul,.cdt-rich ol{margin:2px 0 8px;padding-left:20px}
.cdt-rich h1,.cdt-rich h2,.cdt-rich h3,.cdt-rich h4{font-weight:800;font-size:15px;margin:8px 0 4px}.cdt-rich a{color:var(--accent);font-weight:700}
.cdt-sgroup{border-radius:10px;padding:0 12px 8px;box-shadow:var(--sh2);background:var(--sheet);border:1px solid var(--line)}
.cdt-sgroup:nth-of-type(even){background:var(--zebra)}.cdt-sgroup + .cdt-sgroup{margin-top:14px}
.cdt-sgroup h5{display:inline-block;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px -12px;padding:6px 12px;border-radius:10px 0 10px 0;background:var(--brand);color:#fff;box-shadow:0 2px 6px rgba(16,24,40,.25)}
.cdt-kvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));column-gap:16px}
.cdt-kv{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px;align-items:baseline}
.cdt-k{font-weight:700;line-height:1.25}.cdt-k small{display:block;font-weight:600;font-size:12px;color:var(--muted)}
.cdt-v{word-break:break-word;line-height:1.3}
.cdt-blank{color:var(--muted);font-style:italic}.cdt-yes{color:var(--ok);font-weight:800}.cdt-no{color:var(--bad);font-weight:800}
.cdt-weekcard .cdt-daytbl{border-radius:10px;overflow:hidden;box-shadow:var(--sh2);border:1px solid var(--line);table-layout:auto;min-width:0;width:100%}
.cdt-weekcard .cdt-daytbl th{padding:7px 10px;background:var(--brand);color:#fff;border-bottom:0}.cdt-daytbl td{padding:7px 10px}.cdt-daytbl tbody tr:nth-child(even) td{background:var(--zebra)}
`;
