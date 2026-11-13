// ============================================================================
// CAMP AUDIT - step 2: each gym's audit email (Jayme 2026-11-12: "Yes, build step 2").
// Pick a gym -> its email: To, subject, intro, Confirmed (from the newest audit run), the checklist table
// (☐ · Error · Camp · Notes), sign-off. Edit any row, delete a row, add a row, set the status, copy for Outlook.
//
// Where it reads:  camp_audit_gym_results (the gym's newest finished run: rows + confirmed)
//                  camp_audit_gym_state   (her work: subject, To, intro, sign-off, status, her rows, deleted rows)
// Where it saves:  Railway POST /camp-audit/edit (service key) -> camp_audit_gym_state + the newest run's rows.
//   An edited or added row is tagged by:'hand'; a deleted script row goes on `hidden`. The next Run camp audit
//   merges with both (automation/camp_audit_merge.py), so a re-run never undoes her edit or brings a row back.
// Same rules as the claude.ai audit page this replaces.
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { saveCampAuditEdit } from '../../lib/syncApi';

const STATUS = [['not', 'Not started'], ['missing', 'Missing camps'], ['auditing', 'Auditing'], ['ready', 'Ready to send'], ['sent', 'Sent']];
const INK = '#14181f';
const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const br = (s) => esc(s).replace(/\n/g, '<br>');

// The email as Outlook takes it: fixed 600px table, set column widths, every cell wraps (same as the audit page).
const C = 'font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;';
const TD = `border:1px solid #cfcfcf;padding:6px 8px;vertical-align:top;${C}`;
const P = 'font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;margin:0 0 12px;';
function emailHtml(e) {
  const rows = e.rows.map(r => `<tr><td width="28" style="${TD}text-align:center;width:28px;">☐</td><td width="22%" style="${TD}width:22%;">${esc(r.err)}</td><td width="28%" style="${TD}width:28%;word-wrap:break-word;">${r.href ? `<a href="${esc(r.href)}" style="color:#0b57d0;">${esc(r.camp)}</a>` : esc(r.camp)}</td><td style="${TD}word-wrap:break-word;">${br(r.note)}</td></tr>`).join('');
  return `<div><p style="${P}">Hi ${esc(e.gm)},</p><p style="${P}">${br(e.intro)}</p>`
    + `<p style="${P}font-weight:bold;">Confirmed (from the camp settings)</p><p style="${P}">${br(e.confirmed)}</p>`
    + `<p style="${P}font-weight:bold;">Found</p>`
    + `<table width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:600px;max-width:100%;table-layout:fixed;"><tr><th width="28" style="${TD}background:#f2f2f2;text-align:left;width:28px;">☐</th><th width="22%" style="${TD}background:#f2f2f2;text-align:left;width:22%;">Error</th><th width="28%" style="${TD}background:#f2f2f2;text-align:left;width:28%;">Camp</th><th style="${TD}background:#f2f2f2;text-align:left;">Notes</th></tr>${rows}</table>`
    + `<p style="${P}margin-top:16px;">${br(e.signoff || 'Thank you,\nJayme')}</p></div>`;
}
const emailText = (e) => `Hi ${e.gm || ''},\n\n${e.intro || ''}\n\nConfirmed (from the camp settings)\n\n${e.confirmed || ''}\n\nFound\n\n☐\tError\tCamp\tNotes\n`
  + e.rows.map(r => `☐\t${r.err}\t${r.camp}\t${r.note}`).join('\n') + `\n\n${e.signoff || 'Thank you,\nJayme'}`;

// Copy, in order: a hidden formatted copy selected and copied (keeps the table for Outlook), the clipboard with HTML, plain text.
async function copy(html, text) {
  if (html) {
    const box = document.createElement('div');
    box.setAttribute('contenteditable', 'true');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:600px;opacity:0;background:#fff;color:#000';
    box.innerHTML = html; document.body.appendChild(box);
    const sel = window.getSelection(); const rg = document.createRange(); rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges(); box.remove();
    if (ok) return true;
    try { await navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return true; } catch (e) { /* next */ }
  }
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

const tagOf = (r) => (r.by === 'eye' ? 'found by eye' : r.by === 'hand' ? 'edited by you' : null);

export default function CampAuditEmail({ gym, brand }) {
  const [state, setState] = useState(null);     // camp_audit_gym_state row
  const [result, setResult] = useState(null);   // newest finished camp_audit_gym_results row
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ err: '', camp: '', href: '', note: '' });

  const load = useCallback(async () => {
    setError(null);
    const [s, r] = await Promise.all([
      supabase.from('camp_audit_gym_state').select('gym_id,status,rows,hidden,subject,intro,signoff,gm,name').eq('gym_id', gym.id).maybeSingle(),
      supabase.from('camp_audit_gym_results').select('id,run_id,rows,confirmed,finished_at,source_read_at').eq('gym_id', gym.id).eq('status', 'done').order('finished_at', { ascending: false }).limit(1),
    ]);
    if (s.error || r.error) { setError((s.error || r.error).message); return; }
    setState(s.data); setResult((r.data || [])[0] || null); setLoaded(true);
  }, [gym.id]);
  useEffect(() => { setLoaded(false); setState(null); setResult(null); load(); }, [load]);

  const flash = (msg, bad) => { setToast({ msg, bad }); setTimeout(() => setToast(null), 3000); };
  const save = async (patch, local) => {
    if (local) local();
    const res = await saveCampAuditEdit(gym.id, patch);
    if (!res.success) { flash(`Not saved: ${res.error}`, true); load(); return false; }
    flash('Saved');
    return true;
  };

  if (error) return <div className="cae-err">Could not load {gym.id}'s audit email: {error}</div>;
  if (!loaded) return <p className="cae-note">Loading {gym.id}…</p>;
  if (!state) return <p className="cae-note">{gym.id} has no audit email saved yet.</p>;
  if (!result) return <p className="cae-note">{gym.id} has no finished audit yet. Run camp audit above.</p>;
  const rows = result.rows || [];
  const hidden = state.hidden || [];
  const e = { gm: state.gm || '', intro: state.intro || '', signoff: state.signoff ?? 'Thank you,\nJayme', subject: state.subject || '', confirmed: result.confirmed || '', rows };

  const setRows = (next, extra = {}) => save({ rows: next, ...extra }, () => setResult(r => ({ ...r, rows: next })));
  const editRow = (i, k, v) => {
    if ((rows[i][k] || '') === v) return;
    const next = rows.map((r, j) => (j === i ? { ...r, [k]: v, by: r.by || 'hand' } : r));
    setRows(next);
  };
  const delRow = (i) => {
    const r = rows[i]; const next = rows.filter((_, j) => j !== i);
    // a script row goes on the deleted list so a re-run never brings it back; her own rows just go
    if (!r.by) { const h = [...hidden, { err: r.err, camp: r.camp }]; setRows(next, { hidden: h }); setState(s => ({ ...s, hidden: h })); }
    else setRows(next);
  };
  const addRow = (ev) => {
    ev.preventDefault();
    if (!draft.err.trim() || !draft.camp.trim() || !draft.note.trim()) return;
    const r = { err: draft.err.trim(), camp: draft.camp.trim(), note: draft.note.trim(), by: 'hand', ...(draft.href.trim() ? { href: draft.href.trim() } : {}) };
    setRows([...rows, r]); setDraft({ err: '', camp: '', href: '', note: '' });
  };
  const setField = (k, v) => { if ((state[k] ?? '') === v) return; save({ [k]: v }, () => setState(s => ({ ...s, [k]: v }))); };
  const ed = (k, ph, multi) => (
    <div key={`${k}:${state[k] ?? ''}`} className="cae-ed" contentEditable suppressContentEditableWarning data-ph={ph}
      onBlur={(x) => setField(k, x.currentTarget.innerText.replace(/\n+$/, ''))} style={multi ? { whiteSpace: 'pre-wrap' } : undefined}>{state[k] ?? ''}</div>
  );

  return (
    <div className="cae" style={{ '--brand': brand }}>
      <style>{CSS}</style>
      <div className="cae-bar">
        <div><b>{state.name || gym.name}</b> · audit email{state.gm ? ` to ${state.gm}` : ''}
          <small>Run {result.run_id} · audited {when(result.finished_at)} · iClass read {when(result.source_read_at) || 'not read'}</small></div>
        <div className="cae-btns">
          <select value={state.status || 'not'} onChange={(x) => setField('status', x.target.value)} aria-label="Status">
            {STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="button" className="cae-btn alt" onClick={async () => flash((await copy(null, e.subject)) ? 'Subject copied' : 'Copy failed', false)}>Copy subject</button>
          <button type="button" className="cae-btn" onClick={async () => flash((await copy(emailHtml(e), emailText(e))) ? 'Email copied — paste into Outlook' : 'Copy failed', false)}>Copy email</button>
          {toast && <span className={`cae-toast ${toast.bad ? 'bad' : ''}`} role="status">{toast.msg}</span>}
        </div>
      </div>

      <div className="cae-sheet">
        <div className="cae-field"><label>Subject</label>{ed('subject', 'Subject line')}</div>
        <div className="cae-field"><label>To</label>{ed('gm', "GM's first name")}</div>
        <p>Hi {state.gm || '…'},</p>
        {ed('intro', 'Opening line', true)}
        <h4>Confirmed (from the camp settings)</h4>
        <div className="cae-confirmed">{e.confirmed || <span className="cae-note">No Confirmed lines in this run.</span>}</div>
        <h4>Found <span className="cae-count">· {rows.length} rows</span></h4>
        <p className="cae-note">Click any Error or Notes text to change it. A row you edit or add, and a row you delete, stay that way when the audit runs again.</p>
        <div className="cae-tablewrap"><table>
          <thead><tr><th style={{ width: 34 }}>☐</th><th style={{ width: '20%' }}>Error</th><th style={{ width: '24%' }}>Camp</th><th>Notes</th><th style={{ width: 90 }} /></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={`${r.err}|${r.camp}|${r.note}|${i}`}>
              <td className="cae-box">☐</td>
              <td><div className="cae-ed" contentEditable suppressContentEditableWarning onBlur={(x) => editRow(i, 'err', x.currentTarget.innerText.trim())}><b>{r.err}</b></div>{tagOf(r) && <small className="cae-tag">{tagOf(r)}</small>}</td>
              <td>{r.href ? <a href={r.href} target="_blank" rel="noopener noreferrer">{r.camp}</a> : r.camp}</td>
              <td><div className="cae-ed" contentEditable suppressContentEditableWarning onBlur={(x) => editRow(i, 'note', x.currentTarget.innerText.trim())}>{r.note}</div></td>
              <td className="cae-x">
                <button type="button" className="cae-mini" title="Copy this row" onClick={async () => flash((await copy(`<b>${esc(r.err)}</b> – ${r.href ? `<a href="${esc(r.href)}">${esc(r.camp)}</a>` : esc(r.camp)}: ${esc(r.note)}`, `${r.err} – ${r.camp}: ${r.note}`)) ? 'Row copied' : 'Copy failed', false)}>Copy</button>
                <button type="button" className="cae-del" aria-label={`Delete row ${i + 1}`} title="Delete row" onClick={() => delRow(i)}>×</button>
              </td>
            </tr>))}</tbody>
        </table></div>
        <form className="cae-add" onSubmit={addRow}>
          <input placeholder="Error" value={draft.err} onChange={(x) => setDraft(d => ({ ...d, err: x.target.value }))} required />
          <input placeholder="Camp" value={draft.camp} onChange={(x) => setDraft(d => ({ ...d, camp: x.target.value }))} required />
          <input placeholder="Camp link (optional)" value={draft.href} onChange={(x) => setDraft(d => ({ ...d, href: x.target.value }))} />
          <input placeholder="Notes" value={draft.note} onChange={(x) => setDraft(d => ({ ...d, note: x.target.value }))} required />
          <button type="submit" className="cae-btn">Add row</button>
        </form>
        {ed('signoff', 'Sign-off', true)}
      </div>
    </div>
  );
}

const CSS = `
.cae{--ink:${INK};--line:#c9d0db;--soft:#eef1f6;--zebra:#f6f8fb;--sh2:0 2px 4px rgba(16,24,40,.10),0 8px 20px rgba(16,24,40,.12);--sh3:0 4px 8px rgba(16,24,40,.14),0 16px 36px rgba(16,24,40,.18);color:var(--ink)}
.cae-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;background:var(--brand);color:#fff;border-radius:12px 12px 0 0;padding:12px 16px;box-shadow:var(--sh3)}
.cae-bar b{font-size:18px}.cae-bar small{display:block;font-size:12px;font-weight:600;opacity:.95}
.cae-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cae-btns select{background:#fff;color:#111;border:0;border-radius:8px;padding:8px 10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,.2)}
.cae-btn{background:#fff;color:#111;border:0;border-radius:8px;padding:8px 14px;font-weight:800;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.2),0 4px 10px rgba(0,0,0,.15);transition:transform .12s}
.cae-btn:hover{transform:translateY(-1px)}.cae-btn.alt{background:rgba(0,0,0,.28);color:#fff}
.cae-sheet .cae-btn{background:var(--brand);color:#fff}
.cae-toast{background:#fff;color:#0f5a36;border-radius:8px;padding:5px 10px;font-weight:700}.cae-toast.bad{color:#b3261e}
.cae-sheet{background:#fff;border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;padding:16px 18px;box-shadow:var(--sh2);display:flex;flex-direction:column;gap:10px}
.cae-sheet h4{font-size:16px;font-weight:800;margin:6px 0 0}.cae-sheet p{margin:0}
.cae-field{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;align-items:baseline}
.cae-field label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.cae-ed{border:1px dashed transparent;border-radius:6px;padding:3px 6px;min-height:1.4em;word-break:break-word}
.cae-ed:hover{border-color:var(--line)}.cae-ed:focus{border-color:var(--brand);outline:none;background:var(--soft)}
.cae-ed:empty::before{content:attr(data-ph);color:#5a6372}
.cae-confirmed{white-space:pre-wrap;background:var(--soft);border-left:5px solid var(--brand);border-radius:8px;padding:10px 12px;box-shadow:0 1px 2px rgba(16,24,40,.1),0 2px 6px rgba(16,24,40,.08)}
.cae-count{font-weight:600;font-size:13px;color:#3f4857}
.cae-note{font-size:13px;color:#3f4857}
.cae-err{background:#fde2e2;color:#8a1616;border-radius:10px;padding:10px 12px;font-weight:700}
.cae-tablewrap{overflow-x:auto;border-radius:10px;box-shadow:var(--sh2);border:1px solid var(--line)}
.cae table{border-collapse:collapse;width:100%;font-size:14px;table-layout:fixed;min-width:760px}
.cae th,.cae td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.cae th{background:var(--brand);color:#fff;font-size:13px;letter-spacing:.03em;text-transform:uppercase}
.cae tbody tr:nth-child(even) td{background:var(--zebra)}
.cae td a{color:#1747c9;font-weight:700}
.cae-box{text-align:center;font-size:16px}
.cae-tag{display:inline-block;margin-top:4px;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:700;background:var(--soft);box-shadow:inset 0 0 0 1px var(--line)}
.cae-x{white-space:nowrap}
.cae-mini{background:#1747c9;color:#fff;border:0;border-radius:6px;padding:5px 9px;font-weight:700;font-size:12px;cursor:pointer;margin-right:4px}
.cae-del{background:none;border:0;color:#b3261e;cursor:pointer;font-weight:800;font-size:20px;padding:0 4px}
.cae-add{display:grid;grid-template-columns:1fr 1fr 1fr 2fr auto;gap:6px}
@media (max-width:820px){.cae-add{grid-template-columns:1fr}}
.cae-add input{background:var(--soft);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}
`;
