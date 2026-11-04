// ============================================================================
// SETUP READ CHIP - the iClass setup read that runs after each gym's sync
// ============================================================================
// When a gym's event sync finishes, the sync panel asks Railway to read that gym's iClass setup
// (camp settings, each day's enrollment, price tables). Railway reads one gym at a time, so this
// shows where each gym stands: waiting its turn -> reading -> camps read (or why it failed).
// Status comes from the iclass_setup_reads table - the row Railway writes - never from a guess.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { startSetupRead } from '../../lib/syncApi';

const FINISHED = ['ok', 'no_login', 'sign_in_failed', 'stopped'];

export function useSetupReadLine() {
  // gymId -> { baseline: highest read id before we asked, error?: string }
  const [asked, setAsked] = useState({});
  const [rows, setRows] = useState({}); // gymId -> newest read row after its baseline
  const askedRef = useRef(asked);
  askedRef.current = asked;

  const queue = useCallback(async (gymIds) => {
    if (!gymIds || !gymIds.length) return;
    // Remember the newest read row BEFORE asking, so an older read is never shown as this one.
    const { data: last } = await supabase
      .from('iclass_setup_reads').select('id').order('id', { ascending: false }).limit(1);
    const baseline = last && last[0] ? last[0].id : 0;
    setAsked((prev) => {
      const next = { ...prev };
      gymIds.forEach((g) => { next[g] = { baseline }; });
      return next;
    });
    setRows((prev) => {
      const next = { ...prev };
      gymIds.forEach((g) => { delete next[g]; });
      return next;
    });
    const res = await startSetupRead(gymIds);
    if (!res.success) {
      setAsked((prev) => {
        const next = { ...prev };
        gymIds.forEach((g) => { next[g] = { baseline, error: res.error }; });
        return next;
      });
    }
  }, []);

  // While any asked gym has not finished, look at the table every few seconds.
  const pending = Object.entries(asked)
    .filter(([g, a]) => !a.error && !(rows[g] && FINISHED.includes(rows[g].status)))
    .map(([g]) => g);
  const pendingKey = pending.sort().join(',');
  useEffect(() => {
    if (!pendingKey) return undefined;
    let stop = false;
    const look = async () => {
      const gymIds = pendingKey.split(',');
      const minBase = Math.min(...gymIds.map((g) => askedRef.current[g]?.baseline || 0));
      const { data } = await supabase
        .from('iclass_setup_reads')
        .select('id, gym_id, status, camps_read, note, what')
        .in('gym_id', gymIds)
        .eq('what', 'full')
        .gt('id', minBase)
        .order('id', { ascending: false });
      if (stop || !data) return;
      setRows((prev) => {
        const next = { ...prev };
        gymIds.forEach((g) => {
          const row = data.find((r) => r.gym_id === g && r.id > (askedRef.current[g]?.baseline || 0));
          if (row) next[g] = row;
        });
        return next;
      });
    };
    look();
    const t = setInterval(look, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [pendingKey]);

  const statusFor = (gymId) => {
    const a = asked[gymId];
    if (!a) return null;
    if (a.error) return { kind: 'failed', text: `could not start - ${a.error}` };
    const row = rows[gymId];
    if (!row) return { kind: 'waiting', text: 'waiting its turn' };
    if (row.status === 'running') return { kind: 'reading', text: 'reading now' };
    if (row.status === 'ok') return { kind: 'ok', text: `${row.camps_read ?? 0} camps read` };
    if (row.status === 'no_login') return { kind: 'failed', text: 'no iClass login saved in Railway' };
    if (row.status === 'sign_in_failed') return { kind: 'failed', text: 'iClass sign-in failed' };
    return { kind: 'failed', text: row.note || 'stopped' };
  };

  return { queue, statusFor };
}

const LOOK = {
  waiting: { bg: '#eef1f5', color: '#334155', border: '#cbd5e1', icon: '⏳' },
  reading: { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd', icon: '🔄' },
  ok:      { bg: '#dcfce7', color: '#14532d', border: '#86efac', icon: '✅' },
  failed:  { bg: '#fee2e2', color: '#7f1d1d', border: '#fca5a5', icon: '❌' },
};

export default function SetupReadChip({ status }) {
  if (!status) return null;
  const look = LOOK[status.kind] || LOOK.waiting;
  return (
    <span
      title="The iClass setup read: every camp's settings, each day's enrollment and the price tables, read signed-in after this gym's sync"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
        fontSize: 12, fontWeight: 700, background: look.bg, color: look.color, border: `1px solid ${look.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {look.icon} iClass setup: {status.text}
    </span>
  );
}
