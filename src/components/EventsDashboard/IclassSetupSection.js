// "iClass setup" block in the event side panel.
// Shows what the signed-in setup read (automation/camp_setup_reader.py) saved for this camp:
// portal settings, sign-up settings, max kids, every day's enrollment, the price table it uses,
// program and charge category. Reads the iclass_camp_audit view (camp connected to its price
// table / type / charge category / program) + iclass_camp_setup (per-day counts) + iclass_price_cells.
// A gym that was never read says so - a missing read is never shown as blank or "fine".
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { theme } from './constants';

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtMoney = (n) => (n == null ? null : `$${Number(n).toFixed(2).replace(/\.00$/, '')}`);

function YesNo({ value, label }) {
  if (value == null) return <span className="text-gray-400">{label} —</span>;
  return (
    <span className={value ? 'text-green-800' : 'text-gray-700'}>
      {label} <span className="font-bold">{value ? '✓' : '✗'}</span>
    </span>
  );
}

// The iClass camp number. events.event_id is empty on every event today (checked 2026-11-04: 0 of 507),
// so it is read from the event's own iClass link (".../camp-details/2015") - the exact id, never a guess.
const iclassCampId = (event) => {
  if (event?.event_id) return event.event_id;
  const m = String(event?.event_url || '').match(/\/(?:camp-details|camps)\/(\d+)/);
  return m ? Number(m[1]) : null;
};

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

  const box = (children) => (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      <div className="font-semibold text-xs text-gray-500 uppercase mb-2 flex items-center justify-between">
        <span>🔐 iClass setup</span>
        {state.camp?.read_at && (
          <span className="normal-case font-normal text-gray-500">
            read {new Date(state.camp.read_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      {children}
    </div>
  );

  if (state.loading) return box(<div className="text-sm text-gray-500">Loading…</div>);
  if (state.error) return box(<div className="text-sm text-red-700">Could not load the iClass setup.</div>);
  if (!state.camp) {
    return box(
      <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
        Setup not read yet for this camp. It appears after this gym's iClass setup read runs.
      </div>
    );
  }

  const c = state.camp;
  const cells = state.cells || [];
  const dayRows = [...new Set(cells.map((x) => x.days))].sort((a, b) => a - b);
  const kids = [...new Set(cells.map((x) => x.child_number))].sort((a, b) => a - b);
  const cell = (k, d) => cells.find((x) => x.child_number === k && x.days === d);
  const chargeExpired = c.charge_category_expires && new Date(c.charge_category_expires) < new Date();

  return box(
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-1.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs font-semibold text-gray-500 w-20">Portal</span>
          <YesNo value={c.show_on_web} label="Show on Web" />
          <YesNo value={c.allow_registration} label="Registration" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs font-semibold text-gray-500 w-20">Reg. dates</span>
          <span className="text-gray-800">{fmtDate(c.registration_start)} → {fmtDate(c.registration_end)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs font-semibold text-gray-500 w-20">Sign-up</span>
          <YesNo value={c.per_day_signup} label="Per-day" />
          <YesNo value={c.auto_approve} label="Auto-approve" />
          <YesNo value={c.waitlist_requests} label="Waitlist requests" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs font-semibold text-gray-500 w-20">Max kids</span>
          <span className={`font-bold ${c.max_entries === 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {c.max_entries ?? '—'}
          </span>
          <span className="text-gray-600">Ages {c.min_age ?? '—'}–{c.max_age ?? '—'}</span>
          {c.due_at_signup && <span className="text-gray-600">Due at sign-up: {c.due_at_signup}</span>}
        </div>
      </div>

      {state.days.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1">Each day</div>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            {state.days.map((d, i) => {
              const cap = Number(d.occ || 0) + Number(d.open || 0);
              const full = Number(d.open) === 0;
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-1.5 ${i ? 'border-t border-gray-100' : ''}`}
                  style={full ? { background: '#fef2f2' } : {}}>
                  <span className="font-medium text-gray-800">
                    {fmtDate(d.sqlDate).replace(/, \d{4}$/, '')}
                  </span>
                  <span className={full ? 'text-red-800 font-semibold' : 'text-gray-700'}>
                    <b>{d.occ}</b> in · {d.open} open
                    <span className="text-gray-400"> / {cap}</span>
                    {Number(d.occwait) > 0 && <span className="ml-1 text-orange-800">· {d.occwait} wait</span>}
                    {Number(d.requests) > 0 && <span className="ml-1 text-orange-800">· {d.requests} req</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">
          Price table <span className="font-normal text-gray-700">{c.price_table_name || '— none set —'}</span>
        </div>
        {cells.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-2 py-1 font-semibold">Days</th>
                  {kids.map((k) => (
                    <th key={k} className="text-right px-2 py-1 font-semibold">
                      {k === 1 ? '1st child' : k === 2 ? '2nd child' : `${k}rd child`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayRows.map((d) => (
                  <tr key={d} className="border-t border-gray-100">
                    <td className="px-2 py-1 text-gray-700">{d} {d === 1 ? 'day' : 'days'}</td>
                    {kids.map((k) => {
                      const x = cell(k, d);
                      const blank = !x || x.amount == null;
                      return (
                        <td key={k} className={`px-2 py-1 text-right ${blank ? 'text-red-700 font-semibold bg-red-50' : 'text-gray-900'}`}>
                          {blank ? 'blank' : fmtMoney(x.amount)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
        <span><span className="text-xs font-semibold text-gray-500">Program</span> {c.program_name || '—'}</span>
        <span><span className="text-xs font-semibold text-gray-500">Type</span> {c.camp_type_name || '—'}</span>
        <span className={chargeExpired ? 'text-red-700 font-semibold' : ''}>
          <span className="text-xs font-semibold text-gray-500">Charge category</span> {c.charge_category_name || '—'}
          {chargeExpired && ` (expired ${fmtDate(c.charge_category_expires)})`}
        </span>
      </div>
    </div>
  );
}
