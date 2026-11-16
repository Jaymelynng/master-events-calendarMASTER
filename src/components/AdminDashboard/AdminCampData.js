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
//   Flex Week links + camps left off  camp_link_extras (database/ADD_CAMP_LINK_EXTRAS.sql) - the only link facts
//                                     iClass's camp data does not have
//
// Views (Jayme 2026-11-16: "MASTER LINKS, MASTER PRICING ... THEN EACH GYM PAGE INDIVIDUALLY"):
//   Master price list  every gym's summer camp price tables side by side
//   Master link list   every gym's camp-type lists, Flex Week links and every camp's own page, with Copy buttons
//   Each gym           the gym's camp sheet (unchanged)
//
// Look: Jayme's CORE-VISUAL-DESIGN-PHILOSOPHY - every layer contrasts with the one it touches and lifts
// (two-layer shadows); the open camp is a recessed tray with raised cards; each week is its own raised card.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { resolveRule } from '../../lib/bucketRules';
import { copyRich } from '../../lib/copyRich';

const PRICES = '__prices';
const LINKS = '__links';

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

// The SAME summer-camp filter as the audit (camp_audit.py / audit_page_sheets.py): bucket CAMP / CAMP CARE,
// minus school-year / school-closure camps in the window. Left-out camps are named, never silently dropped.
// NOTE (no-hardcoding law): the school-year/closure words are the audit's own test, kept identical here on
// purpose; they move to a Summer / School-year tag per camp type in Buckets (open item), then both read that.
function summerSplit(all, gymId, rules) {
  const bucketOf = (c) => { const r = resolveRule(c.camp_type_name, gymId, rules); return r ? r.event_type : null; };
  const schoolYear = (c) => /school\s*(year|closure)/i.test(`${c.camp_type_name || ''} ${c.camp_name || ''}`);
  const leftOut = all.filter(c => !['CAMP', 'CAMP CARE'].includes(bucketOf(c)) || schoolYear(c));
  const camps = all.filter(c => !leftOut.includes(c)).map(c => ({ ...c, bucket: bucketOf(c) }));
  return { camps, leftOut };
}

// A camp's label (e.g. Dance) from camp_kind_rules: a whole word in the iClass camp TYPE name, plural s allowed;
// a rule for this gym wins over an every-gym rule. Never from the camp title. No rule = no label.
const kindOf = (typeName, gymId, kinds) => {
  const t = String(typeName || '');
  const hit = (r) => { try { return new RegExp(`\\b${r.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(t); } catch (e) { return false; } };
  const r = (kinds || []).find(k => k.gym_id === gymId && hit(k)) || (kinds || []).find(k => !k.gym_id && hit(k));
  return r ? { kind: r.kind, color: r.color } : null;
};
const KindTag = ({ k }) => (k ? <span className="cdt-kind" style={{ background: k.color }}>{k.kind}</span> : null);

// The parent-portal links, in the form iClass itself sends parents to (checked 11/16: /camps/<type> and
// /camp-details/<id> both forward to these).
const campURL = (slug, id, typeId) => `https://portal.iclasspro.com/${slug}/event-details/${id}${typeId != null ? `?typeId=${typeId}` : ''}`;
const typeURL = (slug, typeId) => `https://portal.iclasspro.com/${slug}/events/${typeId}?sortBy=time`;

// Every gym at once, for the two master lists: summer camps (light columns), Active/Inactive, price tables,
// the link extras and each gym's newest iClass read. Same tables and same filter as each gym's sheet.
async function loadAll(gyms, win, rules, kinds) {
  const [rows, acts, cells, extras, reads] = await Promise.all([
    readAll(() => supabase.from('iclass_camp_audit').select('gym_id, camp_id, camp_name, start_date, camp_type_id, camp_type_name, price_table_id, price_table_name')
      .is('gone_from_iclass_at', null).gte('start_date', win[0]).lte('start_date', win[1]).order('gym_id').order('camp_id')),
    readAll(() => supabase.from('iclass_camp_setup').select('gym_id, camp_id, active:raw->active').order('gym_id').order('camp_id')),
    readAll(() => supabase.from('iclass_price_cells').select('gym_id, price_table_id, price_table_name, child_number, days, amount')
      .order('gym_id').order('price_table_id').order('child_number').order('days')),
    readAll(() => supabase.from('camp_link_extras').select('*').order('id')),
    Promise.all(gyms.map(g => supabase.from('iclass_setup_reads').select('gym_id, finished_at').eq('gym_id', g.id)
      .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).then(r => (r.data && r.data[0]) || null))),
  ]);
  const active = {}; acts.forEach(a => { active[`${a.gym_id}:${a.camp_id}`] = a.active; });
  const camps = []; const tables = [];
  gyms.forEach(g => {
    const { camps: mine } = summerSplit(rows.filter(r => r.gym_id === g.id), g.id, rules);
    mine.forEach(c => {
      const a = active[`${g.id}:${c.camp_id}`];
      camps.push({ gym: g.id, slug: g.iclass_slug, id: c.camp_id, name: String(c.camp_name || '').replace(/\s+/g, ' ').trim(),
        type: c.camp_type_name || 'No camp type', typeId: c.camp_type_id, bucket: c.bucket, start: c.start_date, kind: kindOf(c.camp_type_name, g.id, kinds),
        active: a == null ? null : Number(a) === 1, priceTableId: c.price_table_id, priceTableName: c.price_table_name });
    });
    [...new Set(mine.map(c => c.price_table_id).filter(x => x != null))].forEach(tid => {
      const cs = cells.filter(x => x.gym_id === g.id && x.price_table_id === tid);
      const users = mine.filter(c => c.price_table_id === tid);
      const row = (k) => { const out = []; cs.filter(x => x.child_number === k).forEach(x => { out[x.days - 1] = x.amount == null ? null : Number(x.amount); }); return Array.from(out, v => (v === undefined ? null : v)); };
      const uk = [...new Set(users.map(c => (kindOf(c.camp_type_name, g.id, kinds) || {}).kind || ''))];
      tables.push({ gym: g.id, id: tid, name: (cs[0] && cs[0].price_table_name) || (users[0] && users[0].price_table_name) || `Price table ${tid}`,
        camps: users.length, care: users.every(c => c.bucket === 'CAMP CARE'), read: cs.length > 0, first: row(1), second: row(2),
        kind: uk.length === 1 && uk[0] ? kindOf(users[0].camp_type_name, g.id, kinds) : null });
    });
  });
  tables.sort((a, b) => a.gym.localeCompare(b.gym) || a.name.localeCompare(b.name));
  const readAt = {}; reads.forEach(r => { if (r) readAt[r.gym_id] = r.finished_at; });
  return { camps, tables, extras, readAt };
}

async function loadGym(gym, win, rules, kinds) {
  const all = await readAll(() => supabase.from('iclass_camp_audit').select('*')
    .eq('gym_id', gym.id).is('gone_from_iclass_at', null).gte('start_date', win[0]).lte('start_date', win[1])
    .order('camp_id'));
  const { camps, leftOut } = summerSplit(all, gym.id, rules);
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
      id: c.camp_id, name: c.camp_name, type: c.camp_type_name || 'No camp type', kind: kindOf(c.camp_type_name, gym.id, kinds),
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

// An object-valued setting written out as label: value lines (never raw JSON)
const HIDE_KEYS = /^(id|campId|taxId|sortOrder)$/;
const readable = (o) => {
  const rows = Object.entries(o || {}).filter(([k, v]) => !HIDE_KEYS.test(k) && v !== null && v !== undefined && v !== '' && !(k === 'isDeleted' && v === false));
  if (!rows.length) return o && o.id != null ? `id ${o.id}` : <span className="cdt-blank">blank</span>;
  return rows.map(([k, v]) => <div key={k}><b>{label(k)}:</b> {v === true ? 'Yes' : v === false ? 'No' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>);
};

// The camp's sign-up questions (iClass field "option"), in iClass's own order, written out as parents read them.
function Questions({ v }) {
  const list = (Array.isArray(v) ? v : [v]).filter(o => o && typeof o === 'object').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!list.length) return <p className="cdt-note">No sign-up questions.</p>;
  return (
    <div className="cdt-qlist">{list.map((o, i) => { const price = parseFloat(o.price); return (
      <div className="cdt-qcard" key={o.id ?? i}>
        <div className="cdt-q">{o.question || o.name || '(no question text)'}</div>
        {o.description && <div className="cdt-qd">{o.description}</div>}
        {o.additionalInfo && <div className="cdt-qd">{o.additionalInfo}</div>}
        <div className="cdt-qtags">
          {o.responseRequired ? <span className="cdt-qtag req">Required</span> : <span className="cdt-qtag">Optional</span>}
          {o.yesNoVisible && <span className="cdt-qtag">Yes/No</span>}
          {price > 0 && <span className="cdt-qtag flag">Costs {money(price)}</span>}
          {o.addTax && <span className="cdt-qtag flag">Taxed</span>}
          {o.isDeleted && <span className="cdt-qtag flag">Deleted</span>}
        </div>
      </div>); })}</div>
  );
}

function SettingsPanel({ c, groups }) {
  const s = c.settings || {}; const keys = Object.keys(s).filter(k => k !== 'option');
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
    if (Array.isArray(v)) return v.map((x, i) => <div key={i}>{x && typeof x === 'object' ? (x.Name || x.name || x.title || x.code || readable(x)) : String(x)}</div>);
    if (typeof v === 'object') return readable(v);
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
      {'option' in s && <div className="cdt-sgroup"><h5>Sign-up questions</h5><Questions v={s.option} /></div>}
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
          <div className="cdt-head"><h5>Every iClass setting <small>{Object.keys(c.settings || {}).filter(k => k !== 'option').length} fields{c.readAt ? ` · read ${when(c.readAt)}` : ''}</small></h5></div>
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
        const [{ data: std, error: e1 }, { data: rules, error: e2 }, { data: groups, error: e3 }, { data: kinds, error: e4 }] = await Promise.all([
          supabase.from('camp_audit_standards').select('id, settings'),
          supabase.from('event_type_mappings').select('*'),
          supabase.from('camp_setting_groups').select('*').order('sort'),
          supabase.from('camp_kind_rules').select('*').order('sort'),
        ]);
        if (e1 || e2 || e3 || e4) throw new Error((e1 || e2 || e3 || e4).message);
        const withWin = (std || []).filter(s => s.settings && Array.isArray(s.settings.window) && s.settings.window[0]);
        if (!withWin.length) throw new Error('The Summer Camp Standards have no summer dates (camp_audit_standards).');
        if (alive) setBase({ win: withWin[withWin.length - 1].settings.window, stdId: withWin[withWin.length - 1].id, rules: rules || [], groups: groups || [], kinds: kinds || [] });
      } catch (e) { if (alive) setError(e.message); }
    })();
    return () => { alive = false; };
  }, []);

  const master = current === PRICES || current === LINKS;
  const gym = master ? null : (sorted.find(g => g.id === current) || sorted[0]);
  // the two master lists load every gym once per visit to the tab
  const [allData, setAllData] = useState(null);
  const startedAll = useRef(false);
  useEffect(() => {
    if (!base || !master || !sorted.length || startedAll.current) return;
    startedAll.current = true;
    loadAll(sorted, base.win, base.rules, base.kinds).then(setAllData).catch(e => setAllData({ error: e.message }));
  }, [base, master, sorted]);
  // each gym loads once per visit to the tab (a fresh visit reads again, so it shows the newest sync)
  const started = useRef(new Set());
  useEffect(() => {
    if (!base || !gym || started.current.has(gym.id)) return;
    started.current.add(gym.id);
    const id = gym.id;
    loadGym(gym, base.win, base.rules, base.kinds)
      .then(r => setData(d => ({ ...d, [id]: r })))
      .catch(e => setData(d => ({ ...d, [id]: { error: e.message } })));
  }, [base, gym]);

  const pick = (id) => { setCurrent(id); setFilter('all'); try { localStorage.setItem('campdata-gym', id); } catch (e) { /* per-viewer only */ } };
  const toggle = (id) => setOpen(prev => { const n = new Set(prev); const k = `${gym.id}:${id}`; n.has(k) ? n.delete(k) : n.add(k); return n; });
  const b = gym ? brandOf(gym) : { main: '#1747c9', colors: [] };
  const d = gym ? data[gym.id] : null;
  const masterBtn = (code, icon, title) => (
    <button type="button" className="cdt-gym cdt-master" aria-current={current === code} onClick={() => pick(code)} style={{ '--g': '#14181f' }}>
      <span className="cdt-logo">{icon}</span>
      <span className="cdt-gname"><b>{title}</b><small>All gyms</small></span>
    </button>
  );

  return (
    <div className="cdt" style={{ '--brand': b.main }}>
      <style>{CSS}</style>
      <div className="cdt-wrap">
        <nav className="cdt-rail" aria-label="Gyms">
          {masterBtn(PRICES, '$', 'Master price list')}
          {masterBtn(LINKS, '↗', 'Master link list')}
          <div className="cdt-railgap" aria-hidden />
          {sorted.map(g => { const gb = brandOf(g); const on = g.id === gym?.id; return (
            <button key={g.id} type="button" className="cdt-gym" aria-current={on} onClick={() => pick(g.id)} style={{ '--g': gb.main }}>
              <span className="cdt-logo">{g.logo_url ? <img src={g.logo_url} alt="" /> : g.id.slice(0, 1)}</span>
              <span className="cdt-gname"><b>{g.id}</b><small>{g.name}</small></span>
              {data[g.id] && data[g.id].camps && <span className="cdt-pill">{data[g.id].camps.length}</span>}
            </button>); })}
        </nav>

        <main className="cdt-page">
          {error && <div className="cdt-err">Could not load camp data: {error}</div>}
          {master && (
            <section className="cdt-band">
              <div className="cdt-band-in">
                <div className="cdt-biglogo"><b style={{ fontSize: 30 }}>{current === PRICES ? '$' : '↗'}</b></div>
                <div className="cdt-who"><h2>{current === PRICES ? 'Master price list' : 'Master link list'}</h2>
                  <div className="cdt-sub">{current === PRICES ? "Every gym's summer camp price tables, side by side" : "Every gym's summer camp links. Copy one, a whole list, or one gym."}
                    {base ? ` · Summer camps ${fmtDate(base.win[0])} – ${fmtDate(base.win[1])}` : ''}</div></div>
              </div>
            </section>
          )}
          {master && !allData && !error && <div className="cdt-sheet"><p className="cdt-note">Loading every gym…</p></div>}
          {master && allData && allData.error && <div className="cdt-err">Could not load every gym: {allData.error}</div>}
          {current === PRICES && allData && !allData.error && <MasterPrices all={allData} gyms={sorted} />}
          {current === LINKS && allData && !allData.error && <MasterLinks all={allData} gyms={sorted} />}
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
          {gym && (!d || d.loading) && !error && <div className="cdt-sheet"><p className="cdt-note">Loading {gym ? gym.id : ''} camps…</p></div>}
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
  const kindOfType = (t) => { const c = camps.find(x => x.type === t || colOf(x) === t); return c ? c.kind : null; };
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
          <div className="cdt-tile"><div className="cdt-tk">Camps offered (Event Types)</div><ul>{types.map(t => <li key={t}><KindTag k={kindOfType(t)} /> <b>{t}</b> ·{count(c => c.type === t)} camps · {[...new Set(camps.filter(c => c.type === t).map(c => c.ages))].join(' / ')}</li>)}</ul></div>
          <div className="cdt-tile"><div className="cdt-tk">Price tables · sibling discount</div><ul>{pricing.map(p => <li key={p.id}><b>{p.schedule}</b> · {p.campCount} camps · <b>{sibText(p)}</b></li>)}</ul></div>
          <div className="cdt-tile"><div className="cdt-tk">Ages (from the settings)</div><ul>{ageSet.map(a => <li key={a}>{a} · {count(c => c.ages === a)} camps</li>)}</ul></div>
        </div>
        {leftOut.length > 0 && <div className="cdt-leftout"><b>Not on this sheet:</b> {leftOut.length} camp{leftOut.length === 1 ? '' : 's'} in these dates that are not summer camps (school-year or school-closure): {leftOut.map(x => x.name).join(' · ')}</div>}
      </div>

      <div className="cdt-sec"><div className="cdt-sec-h"><h3>Every week × every camp</h3></div>
        <div className="cdt-tablewrap"><table className="cdt-mx"><thead><tr><th>Week of</th>{cols.map(t => <th key={t}>{kindOfType(t) && <><KindTag k={kindOfType(t)} /><br /></>}{t}</th>)}</tr></thead><tbody>
          {weeks.map(w => <tr key={w}><td><b>{fmtDate(w)}</b></td>{cols.map(t => { const here = camps.filter(c => weekOf(c.start) === w && colOf(c) === t);
            return here.length ? <td key={t} className={here.length > 1 ? 'two' : 'ok'} title={here.map(c => c.name).join('\n')} onClick={() => jump(here.map(c => c.id))}>{here.length > 1 ? `${here.length} camps` : '✓'}</td> : <td key={t} className="none">none</td>; })}</tr>)}
        </tbody></table></div>
        <p className="cdt-note">Click a cell to open that week's camps below. ✓ = one camp that week · yellow = more than one camp that week (click to see them) · red "none" = no camp of that type that week.</p>
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
          {types.map(t => <button type="button" key={t} className="cdt-chip" aria-pressed={filter === t} onClick={() => setFilter(t)}><KindTag k={kindOfType(t)} /> {t} <span>{count(c => c.type === t)}</span></button>)}
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
                    <td>{c.kind && <><KindTag k={c.kind} /> </>}{c.name}<small>{c.type}</small></td>
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

// ---- shared by the two master lists
const XT = 'border:1px solid #cfcfcf;padding:5px 8px;vertical-align:top;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;';
const XH = `${XT}background:#f2f2f2;font-weight:bold;text-align:left;`;
const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function useToast() {
  const [msg, setMsg] = useState(null); const t = useRef(null);
  const show = (text, bad) => { setMsg({ text, bad }); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2400); };
  const el = msg ? <div className={`cdt-toast${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</div> : null;
  return [show, el];
}
const GymCell = ({ g, gyms }) => { const gy = gyms.find(x => x.id === g); return <td className="cdt-g" style={{ '--g': brandOf(gy).main }}>{g}</td>; };

// What a price table charges: 1-4 single days, the 5-day week, what the week saves, the 2nd-child discount, and any
// 2nd-child box that does not match the rest of its own table. All from the table itself.
const r2 = (n) => Math.round(n * 100) / 100;
function priceFacts(t) {
  const f = t.first || []; const s = t.second || []; const day = f[0]; const week = f.length >= 5 ? f[4] : null;
  const saves = week != null && day != null ? r2(day * 5 - week) : null;
  const ratios = s.map((v, i) => (v != null && f[i] ? v / f[i] : null)).filter(v => v != null).sort((a, b) => a - b);
  const ratio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  const pct = ratio == null ? null : Math.round((1 - ratio) * 100);
  const sib = ratio == null ? 'No 2nd-child price' : pct === 0 ? 'Same price as 1st child' : `${pct}% off`;
  const odd = [];
  if (ratio != null) s.forEach((v, i) => { if (v == null || !f[i]) return; const want = r2(f[i] * ratio);
    if (Math.abs(want - v) > 0.011) odd.push(`2nd child, ${i + 1} day${i ? 's' : ''}: ${money(v)}. The rest of this table is ${pct}% off, which would be ${money(want)}.`); });
  return { day, week, saves, sib, sibWeek: s.length >= 5 ? s[4] : null, odd, same4: week != null && f[3] === week && saves > 0, long: f.length > 5 ? f.length : 0, short: f.length && f.length < 5 ? f.length : 0 };
}

function MasterPrices({ all, gyms }) {
  const [pf, setPf] = useState('all');
  const [toast, toastEl] = useToast();
  const tables = all.tables;
  const kind = (t) => (t.care ? 'care' : 'camp');
  const kindNames = [...new Set(tables.filter(t => t.kind).map(t => t.kind.kind))];
  const list = tables.filter(t => pf === 'all' || (pf.startsWith('kind:') ? t.kind && t.kind.kind === pf.slice(5) : kind(t) === pf));
  const n = (k) => tables.filter(t => kind(t) === k).length;
  const missing = gyms.filter(g => !tables.some(t => t.gym === g.id));
  const cell = (v, i) => (v == null ? <td key={i} className="cdt-num">—</td> : <td key={i} className="cdt-num">{money(v)}</td>);
  const copyList = async () => {
    const H = ['Gym', 'Price table', 'Camps', '1 day', '2 days', '3 days', '4 days', '5 days (week)', 'Week saves', '2nd child', 'Look at'];
    const R = list.map(t => { const x = priceFacts(t); const f = t.first || [];
      return [t.gym, t.name, t.camps, ...[0, 1, 2, 3].map(i => (f[i] == null ? '' : money(f[i]))), x.week == null ? '' : money(x.week),
        x.saves == null ? '' : x.saves > 0 ? `${money(x.saves)} off` : 'No break', x.sib, x.odd.join(' ')]; });
    const html = `<table style="border-collapse:collapse;"><tr>${H.map(h => `<th style="${XH}">${h}</th>`).join('')}</tr>${R.map(r => `<tr>${r.map(c => `<td style="${XT}">${escH(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    toast((await copyRich(html, [H, ...R].map(r => r.join('\t')).join('\n'))) ? 'Price list copied' : 'Could not copy', false);
  };
  let last = null;
  return (
    <div className="cdt-sec">
      <div className="cdt-sec-h cdt-sec-hrow"><h3>Every price table <span className="cdt-n">· {list.length}</span></h3><button type="button" className="cdt-ghost" onClick={copyList}>Copy list</button></div>
      <div className="cdt-howto"><b>How to read it.</b> 1 to 4 days is what a parent pays picking single days. <b>5 days is the week price.</b> "Week saves" is
        5 single days minus the week price. A week that costs less than 5 single days is the gym's price break, not an error (Kim 11/11: "The per day price is
        higher and then they get a price break on a full week."). "No break" means the week is exactly 5 single days.</div>
      <div className="cdt-chips" role="group" aria-label="Show">
        <button type="button" className="cdt-chip" aria-pressed={pf === 'all'} onClick={() => setPf('all')}>All tables <span>{tables.length}</span></button>
        <button type="button" className="cdt-chip" aria-pressed={pf === 'camp'} onClick={() => setPf('camp')}>Camp <span>{n('camp')}</span></button>
        <button type="button" className="cdt-chip" aria-pressed={pf === 'care'} onClick={() => setPf('care')}>Before / After / Extended care <span>{n('care')}</span></button>
        {kindNames.map(kn => <button type="button" key={kn} className="cdt-chip" aria-pressed={pf === `kind:${kn}`} onClick={() => setPf(`kind:${kn}`)}>{kn} <span>{tables.filter(t => t.kind && t.kind.kind === kn).length}</span></button>)}
      </div>
      <div className="cdt-tablewrap" style={{ marginTop: 12 }}><table className="cdt-pl">
        <thead><tr><th>Gym</th><th>Price table</th><th className="cdt-num">1 day</th><th className="cdt-num">2 days</th><th className="cdt-num">3 days</th><th className="cdt-num">4 days</th><th className="cdt-num">5 days (week)</th><th>Week saves</th><th>2nd child</th><th>Look at</th></tr></thead>
        <tbody>{list.map(t => { const x = priceFacts(t); const f = t.first || []; const first = t.gym !== last; last = t.gym; return (
          <tr key={`${t.gym}:${t.id}`} className={first ? 'first' : ''}>
            {first ? <GymCell g={t.gym} gyms={gyms} /> : <td className="cdt-g" style={{ '--g': brandOf(gyms.find(y => y.id === t.gym)).main }} />}
            <td>{t.kind && <><KindTag k={t.kind} /> </>}<b>{t.name}</b><small>{t.camps} camp{t.camps === 1 ? '' : 's'} use it{!t.read ? ' · price table not read yet' : ''}{x.long ? ` · table goes to ${x.long} days: ${money(f[f.length - 1])}` : ''}{x.short ? ` · ${x.short}-day table, no 5-day price` : ''}</small></td>
            {[0, 1, 2, 3].map(i => cell(f[i], i))}
            <td className="cdt-num cdt-wk">{x.week == null ? '—' : money(x.week)}{x.same4 && <small>same as 4 days</small>}</td>
            <td>{x.saves == null ? '—' : x.saves > 0 ? <span className="cdt-su on">{money(x.saves)} off</span> : <span className="cdt-su week">No break</span>}</td>
            <td>{x.sib}{x.sibWeek != null && x.sib.endsWith('off') && <small>week: {money(x.sibWeek)}</small>}</td>
            <td className="cdt-look">{x.odd.map((o, i) => <div key={i}>{o}</div>)}</td>
          </tr>); })}</tbody>
      </table></div>
      <p className="cdt-note">{list.length} of {tables.length} price tables shown · {list.reduce((a, t) => a + (t.camps || 0), 0)} summer camps use them. Read live from each gym's iClass price table at its last sync.
        "Look at" lists a box that does not match the rest of its own table.{missing.length ? ` No summer camp price table read for: ${missing.map(g => g.id).join(', ')}.` : ''}</p>
      {toastEl}
    </div>
  );
}

function MasterLinks({ all, gyms }) {
  const [toast, toastEl] = useToast();
  const hide = {}; all.extras.filter(e => e.kind === 'leave_off').forEach(e => { hide[`${e.gym_id}:${e.camp_id}`] = e; });
  const listed = []; const out = [];
  all.camps.forEach(c => {
    if (!c.slug) { out.push({ ...c, url: null, reason: 'No iClass link name for this gym' }); return; }
    const row = { ...c, url: campURL(c.slug, c.id, c.typeId) };
    const h = hide[`${c.gym}:${c.id}`];
    if (h) out.push({ ...row, reason: h.reason, isPublic: h.is_public });
    else if (c.active === false) out.push({ ...row, reason: 'Inactive in iClass' });
    else listed.push(row);
  });
  const notPublic = out.filter(r => r.isPublic === true);
  const leftOff = out.filter(r => r.isPublic !== true);
  const types = [];
  gyms.forEach(g => { const mine = listed.filter(r => r.gym === g.id);
    [...new Map(mine.map(r => [r.typeId, r])).values()].forEach(r => types.push({ gym: g.id, bucket: r.bucket, kind: r.kind, label: r.type, n: mine.filter(x => x.typeId === r.typeId).length, url: typeURL(g.iclass_slug, r.typeId) })); });
  types.sort((a, b) => a.gym.localeCompare(b.gym) || a.label.localeCompare(b.label));
  const flex = (k) => all.extras.filter(e => e.kind === k).sort((a, b) => a.gym_id.localeCompare(b.gym_id) || String(a.label).localeCompare(String(b.label)));
  const copyRows = async (rows, lines, done) => {
    const html = `<table style="border-collapse:collapse;">${rows.map(([cells, u]) => `<tr>${cells.map(c => `<td style="${XT}">${escH(c)}</td>`).join('')}<td style="${XT}"><a href="${escH(u)}" style="color:#0b57d0;">${escH(u)}</a></td></tr>`).join('')}</table>`;
    const text = rows.map(([cells, u]) => (lines ? `${cells[0]} ${cells[1]}: ${u}` : [...cells, u].join('\t'))).join('\n');
    toast((await copyRich(html, text)) ? done : 'Could not copy', false);
  };
  const copyOne = async (u) => toast((await copyRich('', u)) ? 'Link copied' : 'Could not copy', false);
  const Lnk = ({ u }) => <a href={u} target="_blank" rel="noopener noreferrer">{u}</a>;
  const Cp = ({ u }) => <button type="button" className="cdt-cp" onClick={() => copyOne(u)}>Copy</button>;
  // camp types with a label (e.g. Dance) get their own list; the rest stay in Summer camp lists / Extended care lists
  const typeRows = (bucket) => types.filter(t => t.bucket === bucket && !t.kind);
  const kindNames = [...new Set(types.filter(t => t.kind).map(t => t.kind.kind))];
  const typeTable = (list) => <table className="cdt-lk"><thead><tr><th>Gym</th><th>Camp type</th><th>Link</th><th /></tr></thead><tbody>
    {list.map(t => <tr key={t.url}><GymCell g={t.gym} gyms={gyms} /><td><KindTag k={t.kind} /> {t.label} <span className="cdt-n">({t.n} camp{t.n === 1 ? '' : 's'})</span></td><td className="cdt-u"><Lnk u={t.url} /></td><td className="cdt-x"><Cp u={t.url} /></td></tr>)}</tbody></table>;
  const secs = [
    { k: 'camp', title: 'Summer camp lists', about: `Each gym's camp-type pages (the list parents scroll). One row per iClass Event Type in Buckets as CAMP${kindNames.length ? ` (${kindNames.join(', ')} camps have their own list below)` : ''}.`,
      rows: typeRows('CAMP').map(t => [[t.gym, `${t.label} (${t.n} camps)`], t.url]),
      body: typeTable(typeRows('CAMP')) },
    ...kindNames.map(kn => { const list = types.filter(t => t.kind && t.kind.kind === kn); return {
      k: `kind-${kn}`, title: `${kn} camp lists`, about: `Camp types labeled ${kn} (the word in the iClass camp type name; labels live in camp_kind_rules).`,
      rows: list.map(t => [[t.gym, `${t.label} (${t.n} camps)`], t.url]), body: typeTable(list) }; }),
    { k: 'care', title: 'Extended care lists', about: 'Before Care, After Care and Extended Day pages. One row per iClass Event Type in Buckets as CAMP CARE.',
      rows: typeRows('CAMP CARE').map(t => [[t.gym, `${t.label} (${t.n} camps)`], t.url]),
      body: <table className="cdt-lk"><thead><tr><th>Gym</th><th>Camp type</th><th>Link</th><th /></tr></thead><tbody>
        {typeRows('CAMP CARE').map(t => <tr key={t.url}><GymCell g={t.gym} gyms={gyms} /><td><KindTag k={t.kind} /> {t.label} <span className="cdt-n">({t.n} camp{t.n === 1 ? '' : 's'})</span></td><td className="cdt-u"><Lnk u={t.url} /></td><td className="cdt-x"><Cp u={t.url} /></td></tr>)}</tbody></table> },
    ...['flex_full', 'flex_half'].map(k => ({ k, title: k === 'flex_full' ? 'Flex Week – Full Day' : 'Flex Week – Half Day',
      about: "The gym's Flex Week product (buy a week, pick the days). These are iClass products, not camps, so they are kept in the calendar database (camp_link_extras), from your link page 11/16.",
      rows: flex(k).map(x => [[x.gym_id, `${x.label !== 'Full Day' && x.label !== 'Half Day' ? `${x.label} ` : ''}${money(Number(x.price))}`], x.url]),
      body: <table className="cdt-lk"><thead><tr><th>Gym</th><th className="cdt-num">Price</th><th>Link</th><th /></tr></thead><tbody>
        {flex(k).map(x => <tr key={x.id}><GymCell g={x.gym_id} gyms={gyms} /><td className="cdt-num">{money(Number(x.price))}{x.label !== 'Full Day' && x.label !== 'Half Day' && <span className="cdt-n"> {x.label.replace(/^Half Day /, '')}</span>}</td><td className="cdt-u"><Lnk u={x.url} /></td><td className="cdt-x"><Cp u={x.url} /></td></tr>)}</tbody></table> })),
  ];
  if (notPublic.length) secs.splice(2, 0, { k: 'notpublic', title: 'Not public – do not advertise', about: 'Real camps parents can find, kept out of every other list and every Copy all on purpose.', lines: true,
    rows: notPublic.map(r => [[r.gym, r.name], r.url]),
    body: <table className="cdt-lk"><thead><tr><th>Gym</th><th>Camp</th><th>Why</th><th>Link</th><th /></tr></thead><tbody>
      {notPublic.map(r => <tr key={`${r.gym}:${r.id}`}><GymCell g={r.gym} gyms={gyms} /><td><KindTag k={r.kind} />{r.kind ? ' ' : ''}{r.name}</td><td className="cdt-why">{r.reason}</td><td className="cdt-u"><Lnk u={r.url} /></td><td className="cdt-x"><Cp u={r.url} /></td></tr>)}</tbody></table> });
  secs.push({ k: 'every', title: 'Every camp', about: "Each camp's own page. Open a gym to see its camps, or copy one gym at a time.", lines: true,
    rows: listed.map(r => [[r.gym, r.name], r.url]),
    body: <div className="cdt-lkgyms">{gyms.map(g => { const mine = listed.filter(r => r.gym === g.id); if (!mine.length) return null; return (
      <details className="cdt-lkgym" key={g.id}><summary><span className="cdt-g" style={{ '--g': brandOf(g).main }}>{g.id}</span> · {mine.length} camps
        <button type="button" className="cdt-ghost" onClick={(e) => { e.preventDefault(); copyRows(mine.map(r => [[r.gym, r.name], r.url]), true, `${g.id} links copied`); }}>Copy all {g.id} camp links</button></summary>
        <table className="cdt-lk"><tbody>{mine.map(r => <tr key={r.id}><td><KindTag k={r.kind} />{r.kind ? ' ' : ''}{r.name}<small><Lnk u={r.url} /></small></td><td className="cdt-x"><Cp u={r.url} /></td></tr>)}</tbody></table></details>); })}</div> });
  if (leftOff.length) secs.push({ k: 'leftoff', title: 'Left off', about: 'Not on any list above, so a Copy all never picks them up. Inactive camps drop off by themselves; they come back once the gym makes them Active and the gym syncs.', noCopy: true,
    rows: [],
    body: <table className="cdt-lk"><thead><tr><th>Gym</th><th>Camp</th><th>Why</th><th>Link</th></tr></thead><tbody>
      {leftOff.map(r => <tr key={`${r.gym}:${r.id}`}><GymCell g={r.gym} gyms={gyms} /><td>{r.name}<small>{r.type}</small></td><td className="cdt-why">{r.reason}</td><td className="cdt-u">{r.url ? <Lnk u={r.url} /> : '—'}</td></tr>)}</tbody></table> });
  const noSlug = gyms.filter(g => !g.iclass_slug).map(g => g.id);
  return (
    <div className="cdt-sec">
      <p className="cdt-note">Camp lists and every camp's page are built from each gym's last iClass sync, so they update with every sync; a camp that is Inactive in iClass drops off by itself.{noSlug.length ? ` No iClass link name in the gyms table for: ${noSlug.join(', ')}.` : ''}</p>
      <nav className="cdt-jump" aria-label="Jump to">{secs.map(s => <a key={s.k} href={`#cdt-lk-${s.k}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(`cdt-lk-${s.k}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{s.title}</a>)}</nav>
      {secs.map(s => (
        <section className="cdt-lksec" id={`cdt-lk-${s.k}`} key={s.k}>
          <div className="cdt-sec-h cdt-sec-hrow"><h3>{s.title} <span className="cdt-n">· {s.k === 'every' ? listed.length : s.k === 'leftoff' ? leftOff.length : s.rows.length}</span></h3>
            {!s.noCopy && <button type="button" className="cdt-ghost" onClick={() => copyRows(s.rows, !!s.lines, `${s.title} copied`)}>Copy all {s.title}</button>}</div>
          <p className="cdt-note" style={{ margin: '-2px 0 8px' }}>{s.about}</p>
          <div className="cdt-tablewrap">{s.body}</div>
        </section>
      ))}
      {toastEl}
    </div>
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
/* Label tag (camp_kind_rules), e.g. Dance */
.cdt-kind{display:inline-block;vertical-align:1px;border-radius:999px;padding:2px 9px;font-weight:800;font-size:12px;line-height:1.3;letter-spacing:.03em;text-transform:uppercase;color:#fff;box-shadow:0 1px 3px rgba(16,24,40,.25)}
.cdt-chip[aria-pressed="true"] .cdt-kind{box-shadow:0 0 0 2px #fff}
/* Rail: the two master lists sit above the gyms */
.cdt-master .cdt-logo{font-size:17px;background:#fff}.cdt-railgap{height:6px;border-bottom:2px solid var(--line);margin:2px 4px 6px}
/* Sign-up questions */
.cdt-qlist{display:grid;gap:10px;padding:4px 0 6px}
.cdt-qcard{background:var(--sheet);border:1px solid var(--line);border-left:5px solid var(--brand);border-radius:8px;padding:10px 12px;box-shadow:var(--sh1);min-width:0}
.cdt-q{font-weight:700;font-size:15px;line-height:1.3}.cdt-qd{font-size:14px;margin-top:4px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.cdt-qtags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.cdt-qtag{border-radius:999px;padding:2px 10px;font-weight:700;font-size:12px;background:var(--soft);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.cdt-qtag.req{background:var(--brand);color:#fff;box-shadow:none}.cdt-qtag.flag{background:#b45309;color:#fff;box-shadow:none}
/* Master lists */
.cdt-sec-hrow{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
.cdt-n{font-weight:600;font-size:13px;color:var(--muted)}
.cdt-ghost{background:var(--sheet);color:var(--ink);border:2px solid var(--brand);border-radius:8px;padding:6px 12px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:var(--sh1)}
.cdt-ghost:hover{background:var(--brand);color:#fff;box-shadow:var(--sh2)}
.cdt-cp{background:var(--brand);color:#fff;border:0;border-radius:7px;padding:5px 10px;font-weight:800;font-size:12px;cursor:pointer;box-shadow:var(--sh1)}
.cdt-cp:hover{filter:brightness(1.12);box-shadow:var(--sh2)}
.cdt-howto{background:var(--soft);border-left:5px solid var(--brand);border-radius:8px;padding:10px 12px;box-shadow:var(--sh1);font-size:14px;margin-bottom:12px}
.cdt td.cdt-g,.cdt-lkgym .cdt-g{font-weight:800;font-size:15px;white-space:nowrap;border-left:6px solid var(--g,var(--accent))}
.cdt-lkgym .cdt-g{display:inline-block;padding-left:8px}
.cdt-pl td small,.cdt-lk td small{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-top:2px}
.cdt-lk td small{font-weight:600;word-break:break-all}
.cdt-pl tr.first td{border-top:3px solid var(--line)}
.cdt-pl td.cdt-wk{font-weight:800;background:#c8f0d9}
.cdt-look,.cdt-why{color:var(--bad);font-weight:700;font-size:13px}.cdt-why{min-width:180px}
.cdt-lk td.cdt-u{word-break:break-all;min-width:220px;font-size:13px}.cdt-lk a,.cdt-u a{color:var(--accent);font-weight:600}
.cdt-lk td.cdt-x{width:70px;text-align:right}
.cdt-jump{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 16px}
.cdt-jump a{flex:1 1 auto;text-align:center;background:var(--sheet);color:var(--accent);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-weight:700;font-size:14px;box-shadow:var(--sh1);text-decoration:underline}
.cdt-jump a:hover{box-shadow:var(--sh2);border-color:var(--accent)}
.cdt-lksec{scroll-margin-top:12px;margin-top:18px}
.cdt-lkgyms{padding:8px}
.cdt-lkgym{background:var(--sheet);border:1px solid var(--line);border-radius:10px;box-shadow:var(--sh1);margin-bottom:10px}
.cdt-lkgym summary{cursor:pointer;padding:10px 12px;font-weight:700;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cdt-lkgym summary .cdt-ghost{margin-left:auto}.cdt-lkgym[open] summary{border-bottom:3px solid var(--line)}
.cdt-toast{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));z-index:60;background:#0f5a36;color:#fff;font-weight:800;border-radius:10px;padding:10px 16px;box-shadow:var(--lift)}
.cdt-toast.bad{background:var(--bad)}
`;
