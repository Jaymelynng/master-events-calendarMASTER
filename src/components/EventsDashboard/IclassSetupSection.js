// "iClass setup" block in the event side panel.
// Shows what the signed-in setup read (automation/camp_setup_reader.py) saved for this camp:
// portal settings, sign-up settings, max kids, the price table it uses (each day's enrollment is in the spots card),
// program and charge category. Reads the iclass_camp_audit view (camp connected to its price
// table / type / charge category / program) + iclass_camp_setup (per-day counts) + iclass_price_cells.
// A gym that was never read says so - a missing read is never shown as blank or "fine".
// An APPOINTMENT (Planet's Open Gym / KNO / tryouts - link ".../appointment-details/1768") reads
// iclass_appointment_setup + iclass_appointment_price_cells instead: a separate price-table numbering.
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

// The iClass appointment number, from the event's own link (".../appointment-details/1768?serviceId=13").
// Proven on Jayme's Planet recording 2026-11-07: GET /api/v1/appointments/1768 is that same appointment.
const iclassAppointmentId = (event) => {
  const m = String(event?.event_url || '').match(/\/appointment-details\/(\d+)/);
  return m ? Number(m[1]) : null;
};

// One read per opened event, shared by the spots card (per-day counts) and this section.
export function useIclassSetup(event) {
  const [state, setState] = useState({ loading: true });
  const appointmentId = iclassAppointmentId(event);
  const campId = appointmentId ? null : iclassCampId(event);

  useEffect(() => {
    let alive = true;
    if (appointmentId && event?.gym_id) {
      setState({ loading: true });
      (async () => {
        const { data: appt } = await supabase.from('iclass_appointment_setup')
          .select('appointment_id, raw, bookings_summary, read_at')
          .eq('gym_id', event.gym_id).eq('appointment_id', appointmentId).maybeSingle();
        const tableId = appt?.raw?.pricingScheduleId;
        let cells = [];
        let tableName = null;
        if (tableId != null) {
          const [{ data: c }, { data: t }] = await Promise.all([
            supabase.from('iclass_appointment_price_cells').select('child_number, time_slots, amount')
              .eq('gym_id', event.gym_id).eq('price_table_id', tableId),
            supabase.from('iclass_appointment_price_tables').select('name')
              .eq('gym_id', event.gym_id).eq('price_table_id', tableId).maybeSingle(),
          ]);
          cells = c || [];
          tableName = t?.name || null;
        }
        if (alive) setState({ loading: false, camp: null, appointment: appt || null, isAppointment: true, days: [], cells, tableName });
      })().catch(() => alive && setState({ loading: false, error: true, days: [] }));
      return () => { alive = false; };
    }
    if (!campId || !event?.gym_id) {
      setState({ loading: false, camp: null, days: [] });
      return undefined;
    }
    setState({ loading: true });
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
    })().catch(() => alive && setState({ loading: false, error: true, days: [] }));
    return () => { alive = false; };
  }, [campId, appointmentId, event?.gym_id]);

  return state;
}

// An APPOINTMENT's setup: portal + online sign-up, max kids, how many signed up, its price table
// (rows = number of time slots booked, columns = 1st / 2nd / 3rd child - iClass's own grid).
function AppointmentSetup({ state }) {
  const a = state.appointment;
  if (!a) {
    return (
      <Card>
        <div style={{ color: C.ink, fontSize: 14, fontWeight: 600 }}>Setup not read yet for this appointment.</div>
        <div style={{ color: C.ink, fontSize: 13, marginTop: 2 }}>It appears after this gym's iClass setup read runs.</div>
      </Card>
    );
  }
  const r = a.raw || {};
  const cells = state.cells || [];
  const slotRows = [...new Set(cells.map((x) => x.time_slots))].sort((x, y) => x - y);
  const kids = [...new Set(cells.map((x) => x.child_number))].sort((x, y) => x - y);
  const cell = (k, t) => cells.find((x) => x.child_number === k && x.time_slots === t);
  const kidLabel = (k) => (k === 1 ? '1st' : k === 2 ? '2nd' : k === 3 ? '3rd' : `${k}th`);
  return (
    <>
      <Card title="Portal & sign-up">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip value={r.showOnCustomerPortal ?? null} label="Show on portal" />
          <Chip value={r.allowWebRegistration ?? null} label="Online sign-up" />
        </div>
      </Card>

      {/* Spots left is on the card (the portal's own number). No "signed up" tile: iClass's booking list
          (12 on #1768) did not match max minus spots left (30 - 19 = 11) on 2026-11-07, cause unknown. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Stat big={r.maxStudents ?? '—'} label="Max kids" />
      </div>

      <Card title="Price table">
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: cells.length ? 8 : 0 }}>
          {r.pricingScheduleId == null
            ? <span style={{ color: C.bad }}>No price table set</span>
            : (state.tableName || <span style={{ color: C.bad }}>Price table {r.pricingScheduleId} not read yet</span>)}
        </div>
        {cells.length > 0 && (
          <div style={{ borderRadius: 10, overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.head, color: '#fff' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 800, whiteSpace: 'nowrap' }}>Time slots · child →</th>
                  {kids.map((k) => (
                    <th key={k} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 800, whiteSpace: 'nowrap' }}>{kidLabel(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slotRows.map((t, i) => (
                  <tr key={t} style={{ background: i % 2 ? '#f7f4ef' : '#ffffff' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>{t} {t === 1 ? 'slot' : 'slots'}</td>
                    {kids.map((k) => {
                      const x = cell(k, t);
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

      <Card title="Where it lives in iClass">
        <div style={{ display: 'grid', gap: 4, fontSize: 14, color: C.ink }}>
          <div><b>Service</b> · {r.service?.name || '—'}</div>
          <div><b>Appointment</b> · #{a.appointment_id}</div>
        </div>
      </Card>
    </>
  );
}

// An iClass age setting in iClass's own words: 13.9167 -> "13 years 11 months", 5 -> "5 years".
// iClass stores months as twelfths of a year, so 0.9167 x 12 = 11 months.
export function iclassAgeText(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  let years = Math.floor(n);
  let months = Math.round((n - years) * 12);
  if (months === 12) { years += 1; months = 0; }
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  return months ? `${y} ${months} ${months === 1 ? 'month' : 'months'}` : y;
}

export default function IclassSetupSection({ setup, event }) {
  const state = setup || { loading: true };

  const frame = (children) => (
    <div style={{ background: C.frame, borderRadius: 16, boxShadow: lift, margin: '16px 0', overflow: 'hidden' }}>
      <div style={{ background: C.head, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em' }}>🔐 iClass setup</span>
        {(state.camp?.read_at || state.appointment?.read_at) && (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.18)', padding: '3px 8px', borderRadius: 999 }}>
            read {new Date(state.camp?.read_at || state.appointment.read_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', alignItems: 'start' }}>{children}</div>
    </div>
  );

  if (state.loading) return frame(<Card><span style={{ color: C.ink, fontSize: 14 }}>Loading…</span></Card>);
  if (state.error) return frame(<Card><span style={{ color: C.bad, fontSize: 14, fontWeight: 700 }}>Could not load the iClass setup.</span></Card>);
  if (state.isAppointment) return frame(<AppointmentSetup state={state} />);
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
  // Max kids: the spots card already shows each day's limit ("of 50"). The camp's own max only shows
  // when it says something new - it is 0, or it differs from the day limits.
  const dayCaps = (state.days || []).map((d) => Number(d.occ || 0) + Number(d.open || 0));
  const capsDiffer = dayCaps.length > 0 && c.max_entries != null && dayCaps.some((x) => x !== c.max_entries);
  const showMax = c.max_entries === 0 || capsDiffer || (dayCaps.length === 0 && c.max_entries != null);
  const maxLabel = capsDiffer ? `Camp max · days set to ${dayCaps.join(' / ')}` : 'Max kids';
  // Ages: the top tile shows iClass's setting word for word ("5 years – 13 years 11 months").
  // Here only the portal's numbers show, and only when they differ in WHOLE years: iClass stores
  // "13 years 11 months" as 13.9167 and the portal shows 13 - the same camp, not a mismatch
  // (comparing raw numbers flagged 67 EST camps, 2026-11-04).
  const wholeYears = (v) => (v == null || v === '' ? null : Math.floor(Number(v)));
  const agesDiffer = event && c.min_age != null && c.max_age != null &&
    (wholeYears(event.age_min) !== wholeYears(c.min_age) || wholeYears(event.age_max) !== wholeYears(c.max_age));
  const childLabel = (k) => (k === 1 ? '1st child' : k === 2 ? '2nd child' : k === 3 ? '3rd child' : `${k}th child`);

  return frame(
    <>
      <Card title="Portal & sign-up">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip value={c.show_on_web} label="Show on Web" />
          <Chip value={c.allow_registration} label="Registration" />
          {/* per-day lives in the schedule badge; shown here only if iClass's setting disagrees with it */}
          {event?.allow_choose_days != null && c.per_day_signup != null && c.per_day_signup !== event.allow_choose_days && (
            <Chip value={c.per_day_signup} label="Per-day (differs from portal)" />
          )}
          <Chip value={c.auto_approve} label="Auto-approve" />
          <Chip value={c.waitlist_requests} label="Waitlist requests" />
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {showMax && <Stat big={c.max_entries ?? '—'} label={maxLabel} danger />}
        {agesDiffer && <Stat big={`${event.age_min ?? '—'}–${event.age_max ?? '—'}`} label="Ages the portal shows (differs from the setting)" danger />}
        <Stat big={c.due_at_signup || '—'} label="Due at sign-up" />
      </div>

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
