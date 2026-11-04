// "iClass setup" block in the event side panel.
// Shows what the signed-in setup read (automation/camp_setup_reader.py) saved for this camp:
// portal settings, sign-up settings, max kids, every day's enrollment, the price table it uses,
// program and charge category. Reads the iclass_camp_audit view (camp connected to its price
// table / type / charge category / program) + iclass_camp_setup (per-day counts) + iclass_price_cells.
// A gym that was never read says so - a missing read is never shown as blank or "fine".
//
// Look (Jayme's CORE-VISUAL-DESIGN-PHILOSOPHY): every layer contrasts with the one it touches and
// lifts off the page - cream container floating on the white panel, teal header bar, white raised
// cards per group, solid filled ON/OFF chips, big numbers, dark table header, solid red for blanks.
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  frame: '#f1ece4',      // cream container - steps off the white panel
  head: '#2f6f72',       // deep teal header bar
  card: '#ffffff',
  ink: '#1f2a33',        // near-black text on light
  label: '#2f6f72',      // group titles
  on: '#2e7d4f',
  off: '#4a4a4a',
  bad: '#c62828',
  warn: '#b45309',
};
const lift = '0 8px 25px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12)';
const cardLift = '0 4px 14px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.10)';

const fmtDate = (d, withYear = true) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  if (withYear) return `${m}/${day}/${y}`; // her format: 11/6/2026
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtMoney = (n) => (n == null ? null : `$${Number(n).toFixed(2).replace(/\.00$/, '')}`);

// The iClass camp number. events.event_id is empty on every event today (checked 2026-11-04: 0 of 507),
// so it is read from the event's own iClass link (".../camp-details/2015") - the exact id, never a guess.
const iclassCampId = (event) => {
  if (event?.event_id) return event.event_id;
  const m = String(event?.event_url || '').match(/\/(?:camp-details|camps)\/(\d+)/);
  return m ? Number(m[1]) : null;
};

function Card({ title, children }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, boxShadow: cardLift, padding: '10px 12px' }}>
      {title && (
        <div style={{ color: C.label, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// Solid filled chip - readable at a glance, never a pale hint.
function Chip({ value, label }) {
  const known = value != null;
  const bg = !known ? '#9ca3af' : value ? C.on : C.off;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, color: '#fff',
      fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
      boxShadow: '0 2px 0 rgba(0,0,0,.25)',
    }}>
      <span style={{ fontSize: 13 }}>{!known ? '?' : value ? '✓' : '✕'}</span>
      {label}
      <span style={{ fontWeight: 800, opacity: .95 }}>{!known ? '' : value ? 'ON' : 'OFF'}</span>
    </span>
  );
}

function Stat({ big, label, danger }) {
  return (
    <div style={{
      flex: '1 1 90px', minWidth: 90, background: danger ? C.bad : C.card, color: danger ? '#fff' : C.ink,
      borderRadius: 12, boxShadow: cardLift, padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: danger ? '#fff' : C.label, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

export default function IclassSetupSection({ event }) {
  const [state, setState] = useState({ loading: true });
  const campId = iclassCampId(event);

  useEffect(() => {
    let alive = true;
    if (!campId || !event?.gym_id) {
      setState({ loading: false, camp: null });
      return undefined;
    }
    (async () => {
      const [{ data: camp }, { data: setup }] = await Promise.all([
        supabase.from('iclass_camp_audit').select('*')
          .eq('gym_id', event.gym_id).eq('camp_id', campId).maybeSingle(),
        supabase.from('iclass_camp_setup').select('occupancy')
          .eq('gym_id', event.gym_id).eq('camp_id', campId).maybeSingle(),
      ]);
      let cells = [];
      if (camp?.price_table_id != null) {
        const { data } = await supabase.from('iclass_price_cells').select('child_number, days, amount')
          .eq('gym_id', event.gym_id).eq('price_table_id', camp.price_table_id);
        cells = data || [];
      }
      if (alive) setState({ loading: false, camp, days: Array.isArray(setup?.occupancy) ? setup.occupancy : [], cells });
    })().catch(() => alive && setState({ loading: false, error: true }));
    return () => { alive = false; };
  }, [campId, event?.gym_id]);

  const frame = (children) => (
    <div style={{ background: C.frame, borderRadius: 16, boxShadow: lift, margin: '16px 0', overflow: 'hidden' }}>
      <div style={{ background: C.head, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em' }}>🔐 iClass setup</span>
        {state.camp?.read_at && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.18)', padding: '3px 8px', borderRadius: 999 }}>
            read {new Date(state.camp.read_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', alignItems: 'start' }}>{children}</div>
    </div>
  );

  if (state.loading) return frame(<Card><span style={{ color: C.ink, fontSize: 14 }}>Loading…</span></Card>);
  if (state.error) return frame(<Card><span style={{ color: C.bad, fontSize: 14, fontWeight: 700 }}>Could not load the iClass setup.</span></Card>);
  if (!state.camp) {
    return frame(
      <Card>
        <div style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>Setup not read yet for this camp.</div>
        <div style={{ color: C.ink, fontSize: 13, marginTop: 2 }}>It appears after this gym's iClass setup read runs.</div>
      </Card>
    );
  }

  const c = state.camp;
  const cells = state.cells || [];
  const dayRows = [...new Set(cells.map((x) => x.days))].sort((a, b) => a - b);
  const kids = [...new Set(cells.map((x) => x.child_number))].sort((a, b) => a - b);
  const cell = (k, d) => cells.find((x) => x.child_number === k && x.days === d);
  const chargeExpired = c.charge_category_expires && new Date(c.charge_category_expires) < new Date();
  const childLabel = (k) => (k === 1 ? '1st child' : k === 2 ? '2nd child' : k === 3 ? '3rd child' : `${k}th child`);

  return frame(
    <>
      <Card title="Portal & sign-up">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip value={c.show_on_web} label="Show on Web" />
          <Chip value={c.allow_registration} label="Registration" />
          <Chip value={c.per_day_signup} label="Per-day" />
          <Chip value={c.auto_approve} label="Auto-approve" />
          <Chip value={c.waitlist_requests} label="Waitlist requests" />
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: C.ink }}>
          <span style={{ fontWeight: 800 }}>Registration open</span>{' '}
          <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.registration_start)}</span> <span style={{ fontWeight: 800 }}>→</span> <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.registration_end)}</span>
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Stat big={c.max_entries ?? '—'} label="Max kids" danger={c.max_entries === 0} />
        <Stat big={`${c.min_age ?? '—'}–${c.max_age ?? '—'}`} label="Ages" />
        <Stat big={c.due_at_signup || '—'} label="Due at sign-up" />
      </div>

      {state.days.length > 0 && (
        <Card title="Each day">
          <div style={{ display: 'grid', gap: 6 }}>
            {state.days.map((d, i) => {
              const occ = Number(d.occ || 0);
              const open = Number(d.open || 0);
              const cap = occ + open;
              const full = open === 0;
              return (
                <div key={i} style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, rowGap: 2,
                  background: full ? C.bad : '#f7f4ef', color: full ? '#fff' : C.ink,
                  borderRadius: 10, padding: '7px 10px', boxShadow: '0 1px 3px rgba(0,0,0,.12)',
                }}>
                  <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap' }}>{fmtDate(d.sqlDate, false)}</span>
                  <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
                    <b style={{ fontSize: 16 }}>{occ}</b> in · <b style={{ fontSize: 16 }}>{open}</b> open
                    <span style={{ fontWeight: 600 }}> of {cap}</span>
                    {Number(d.occwait) > 0 && <b style={{ marginLeft: 6, color: full ? '#fff' : C.warn }}>· {d.occwait} waitlist</b>}
                    {Number(d.requests) > 0 && <b style={{ marginLeft: 6, color: full ? '#fff' : C.warn }}>· {d.requests} requests</b>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card title="Price table">
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: cells.length ? 8 : 0 }}>
          {c.price_table_name || <span style={{ color: C.bad }}>No price table set</span>}
        </div>
        {cells.length > 0 && (
          <div style={{ borderRadius: 10, overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.head, color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 800, whiteSpace: 'nowrap' }}>Days · child →</th>
                  {kids.map((k) => (
                    <th key={k} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, whiteSpace: 'nowrap' }}>{childLabel(k).replace(' child', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((d, r) => (
                  <tr key={d} style={{ background: r % 2 ? '#f7f4ef' : '#ffffff' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>{d} {d === 1 ? 'day' : 'days'}</td>
                    {kids.map((k) => {
                      const x = cell(k, d);
                      const blank = !x || x.amount == null;
                      return (
                        <td key={k} style={{
                          padding: '6px 8px', textAlign: 'right', fontWeight: blank ? 800 : 600,
                          background: blank ? C.bad : undefined, color: blank ? '#fff' : C.ink,
                        }}>
                          {blank ? 'BLANK' : fmtMoney(x.amount)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Where the money goes">
        <div style={{ display: 'grid', gap: 4, fontSize: 14, color: C.ink }}>
          <div><b>Program</b> · {c.program_name || '—'}</div>
          <div><b>Camp type</b> · {c.camp_type_name || '—'}</div>
          <div style={chargeExpired ? { color: C.bad, fontWeight: 800 } : undefined}>
            <b>Charge category</b> · {c.charge_category_name || '—'}
            {chargeExpired && ` — EXPIRED ${fmtDate(c.charge_category_expires)}`}
          </div>
        </div>
      </Card>
    </>
  );
}
