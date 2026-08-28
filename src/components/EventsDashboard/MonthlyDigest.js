// ============================================================================
// MONTHLY DIGEST — every gym on screen at once, detail comes to you
// ============================================================================
// Two rules this had to satisfy and the earlier versions did not:
//
//   ALL FOURTEEN GYMS ARE ALWAYS VISIBLE. Collapsing the nine that were fine
//   into an expander meant she could not see her operation. Nine "Complete"
//   rows carried no information, but nine MISSING gyms carried less than none.
//   Every gym is a tile; the ones that need work are loud, the rest are quiet
//   but fully readable.
//
//   CONTRAST. The white-card-on-cream version was unreadable. This sits on the
//   dark frame with near-white text — never grey on dark — so the tiles read at
//   a glance and the short ones physically separate from the pack.
//
// Layering: clicking a tile slides a drawer over the page with that gym's whole
// month — what it owes, every event, its issues, its portal links. The grid
// stays underneath, so closing puts you exactly where you were. No navigation,
// no re-scrolling.
// ============================================================================

import React, { useState } from 'react';
import { parseYmdLocal } from './utils';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';

const INK = '#211a2b';
const CREAM = '#faf6f0';
const ROSE = '#e05c86';
const GOLD = '#e0a63a';
const MINT = '#5fc39a';

export default function MonthlyDigest({
  allGyms,
  events,
  eventTypes,
  monthlyRequirements,
  currentMonth,
  currentYear,
  getEventCounts,
  scrollToGym,
  handleMagicControlClick,
  getGymLinkUrl,
  onEmailShortGyms,
  onOpenAdminPortal,
  setViewMode,
  setSelectedGym,
  setSelectedEventType,
  setErrorFocus,
  acknowledgedPatterns = [],
}) {
  const [openGym, setOpenGym] = useState(null);

  const counts = getEventCounts();
  const tracked = (eventTypes || []).filter(et => et.is_tracked);
  const typeNames = tracked.length ? tracked.map(t => t.name) : Object.keys(monthlyRequirements || {});
  const labelOf = (t) => (tracked.find(x => x.name === t) || {}).display_name || t;
  const colorOf = (t) => (tracked.find(x => x.name === t) || {}).color || '#b48f8f';

  // All fourteen carry the word "Gymnastics". It is not information here.
  const shortName = (n) => n.replace(/\s*Gymnastics?( Academy| Center)?\s*/i, ' ').replace(/\s+/g, ' ').trim();

  const eventsFor = (gym) => events.filter(e => {
    const d = parseYmdLocal(e.date);
    return e.gym_name === gym && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const issuesFor = (gym) => {
    const ge = eventsFor(gym);
    return ge.filter(e => (e.validation_errors || []).some(err =>
        err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(e, err.message, acknowledgedPatterns))).length
      + ge.filter(e => e.description_status === 'flyer_only').length
      + ge.filter(e => e.description_status === 'none').length;
  };

  const rows = allGyms.map(gym => {
    const gaps = typeNames.map(t => {
      const have = counts[gym]?.[t] || 0;
      const goal = monthlyRequirements?.[t] || 0;
      return { name: t, label: labelOf(t), color: colorOf(t), have, goal, need: Math.max(goal - have, 0) };
    });
    const evs = eventsFor(gym);
    return {
      gym, gaps, evs,
      short: gaps.filter(g => g.need > 0),
      issues: issuesFor(gym),
      empty: evs.length === 0,
    };
  });

  const short = rows.filter(r => r.short.length > 0);
  const totalIssues = rows.reduce((a, r) => a + r.issues, 0);
  const empty = rows.filter(r => r.empty);

  // Loud gyms first — the pack sorts itself so the work rises to the top.
  const ordered = [...rows].sort((a, b) =>
    (b.short.length - a.short.length) || (b.issues - a.issues) || a.gym.localeCompare(b.gym));

  const metrics = [
    { n: short.length, l: short.length === 1 ? 'gym short' : 'gyms short', c: short.length ? ROSE : MINT,
      d: short.length ? short.map(r => shortName(r.gym)).join(', ') : 'every gym met its goals',
      go: () => setViewMode && setViewMode('table') },
    { n: events.length, l: 'events', c: CREAM, d: `across ${allGyms.length} gyms`,
      go: () => { setSelectedGym && setSelectedGym('all'); setSelectedEventType && setSelectedEventType('all'); setViewMode && setViewMode('calendar'); } },
    { n: totalIssues, l: totalIssues === 1 ? 'data issue' : 'data issues', c: totalIssues ? GOLD : MINT,
      d: totalIssues ? 'wrong dates, times, ages, descriptions' : 'nothing flagged',
      go: () => setErrorFocus && setErrorFocus(true) },
    { n: empty.length, l: 'with no events', c: empty.length ? GOLD : MINT,
      d: empty.length ? empty.map(r => shortName(r.gym)).join(', ') : 'all gyms have events',
      go: () => onOpenAdminPortal && onOpenAdminPortal() },
  ];

  const actions = [
    short.length && onEmailShortGyms && { c: ROSE, text: `Email ${short.length} gym${short.length === 1 ? '' : 's'} about what they owe`, run: onEmailShortGyms },
    totalIssues > 0 && setErrorFocus && { c: GOLD, text: `Fix ${totalIssues} data issue${totalIssues === 1 ? '' : 's'}`, run: () => setErrorFocus(true) },
    empty.length > 0 && onOpenAdminPortal && { c: GOLD, text: `Sync ${empty.length} gym${empty.length === 1 ? '' : 's'} with no events`, run: onOpenAdminPortal },
  ].filter(Boolean);

  const detail = openGym ? rows.find(r => r.gym === openGym) : null;

  return (
    <>
      <div className="mx-2 mb-2 rounded-2xl px-3 py-3" style={{ backgroundColor: INK }}>

        {/* THE NUMBERS + WHAT TO DO, one band */}
        <div className="mb-3 flex flex-wrap items-stretch gap-2">
          {metrics.map((m, i) => (
            <button key={i} onClick={m.go} title={m.d}
              className="flex-1 min-w-[150px] rounded-xl px-3 py-2 text-left transition hover:brightness-125"
              style={{ backgroundColor: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)' }}>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black leading-none" style={{ fontSize: 26, color: m.c }}>{m.n}</span>
                <span className="text-[11px] font-bold" style={{ color: CREAM }}>{m.l}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px]" style={{ color: 'rgba(250,246,240,.6)' }}>{m.d}</div>
            </button>
          ))}

          {actions.map((a, i) => (
            <button key={'a' + i} onClick={a.run}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[11.5px] font-bold transition hover:brightness-110"
              style={{ backgroundColor: a.c, color: INK }}>
              {a.text} →
            </button>
          ))}
        </div>

        {/* EVERY GYM — all fourteen, always. Short ones glow. */}
        <div className="grid gap-1.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-7">
          {ordered.map(r => {
            const bad = r.short.length > 0;
            return (
              <button key={r.gym} onClick={() => setOpenGym(r.gym)}
                className="rounded-xl px-2.5 py-2 text-left transition hover:-translate-y-0.5"
                style={{
                  backgroundColor: bad ? 'rgba(224,92,134,.16)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${bad ? 'rgba(224,92,134,.55)' : 'rgba(255,255,255,.13)'}`,
                }}
                title={`${r.gym} — click for the full month`}>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-black" style={{ color: CREAM }}>{shortName(r.gym)}</span>
                  {r.issues > 0 && (
                    <span className="ml-auto shrink-0 rounded-full px-1.5 text-[9px] font-black"
                          style={{ backgroundColor: GOLD, color: INK }} title={`${r.issues} data issues`}>
                      {r.issues}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  {r.gaps.map(g => (
                    <span key={g.name} className="flex items-center gap-1" title={`${g.label}: ${g.have} of ${g.goal}`}>
                      <span className="text-[9px] font-bold" style={{ color: 'rgba(250,246,240,.55)' }}>
                        {g.label.slice(0, 3)}
                      </span>
                      <span className="inline-flex gap-0.5">
                        {Array.from({ length: g.goal }).map((_, i) => (
                          <span key={i} className="inline-block rounded-full" style={{
                            width: 8, height: 8,
                            backgroundColor: i < Math.min(g.have, g.goal) ? g.color : 'transparent',
                            border: `1.5px solid ${i < Math.min(g.have, g.goal) ? g.color : 'rgba(250,246,240,.35)'}`,
                          }} />
                        ))}
                      </span>
                      {g.have > g.goal && (
                        <span className="text-[9px] font-bold" style={{ color: 'rgba(250,246,240,.5)' }}>+{g.have - g.goal}</span>
                      )}
                    </span>
                  ))}
                </div>

                <div className="mt-1 truncate text-[9.5px]" style={{ color: bad ? ROSE : 'rgba(250,246,240,.45)' }}>
                  {r.empty ? 'no events yet'
                    : bad ? `needs ${r.short.map(g => `${g.need} ${g.label}`).join(', ')}`
                    : `${r.evs.length} events · complete`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* LAYERING — the detail slides over, the grid stays underneath */}
      {detail && (
        <>
          <div onClick={() => setOpenGym(null)}
               style={{ position: 'fixed', inset: 0, background: 'rgba(33,26,43,.55)', zIndex: 60 }} />
          <aside style={{
            position: 'fixed', top: 0, right: 0, height: '100%', width: 'min(520px, 94vw)',
            background: CREAM, zIndex: 61, boxShadow: '-24px 0 60px rgba(0,0,0,.45)',
            display: 'flex', flexDirection: 'column',
          }}>
            <header className="px-5 py-4" style={{ backgroundColor: INK }}>
              <button onClick={() => setOpenGym(null)}
                className="float-right rounded-lg px-2 py-1 text-lg leading-none"
                style={{ backgroundColor: 'rgba(255,255,255,.12)', color: CREAM }}>✕</button>
              <div className="text-lg font-black" style={{ color: CREAM }}>{detail.gym}</div>
              <div className="mt-1 text-[11px]" style={{ color: 'rgba(250,246,240,.7)' }}>
                {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {' · '}{detail.evs.length} event{detail.evs.length === 1 ? '' : 's'}
                {detail.issues > 0 && ` · ${detail.issues} data issue${detail.issues === 1 ? '' : 's'}`}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex flex-wrap gap-1.5">
                {detail.gaps.map(g => (
                  <span key={g.name} className="rounded-full px-2.5 py-1 text-[11px] font-black"
                        style={{
                          backgroundColor: g.need ? ROSE : g.color,
                          color: g.need ? '#fff' : INK,
                        }}>
                    {g.label} {g.have}/{g.goal}{g.need ? ` — need ${g.need}` : ' ✓'}
                  </span>
                ))}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={() => { scrollToGym(detail.gym); setOpenGym(null); }}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                  style={{ backgroundColor: INK, color: CREAM }}>
                  Show on the calendar
                </button>
                <button onClick={() => handleMagicControlClick(detail.gym)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                  style={{ backgroundColor: '#46295c', color: CREAM }}>
                  ✨ Open its portal pages
                </button>
                {getGymLinkUrl && getGymLinkUrl(detail.gym, 'BOOKING') && (
                  <a href={getGymLinkUrl(detail.gym, 'BOOKING')} target="_blank" rel="noopener noreferrer"
                     className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
                     style={{ backgroundColor: '#6f8f93', color: '#fff' }}>
                    🌐 Booking page
                  </a>
                )}
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6a5f70' }}>
                This month
              </div>
              {detail.evs.length === 0 ? (
                <div className="py-4 text-sm" style={{ color: '#8b7f85' }}>
                  Nothing synced for this gym yet.
                </div>
              ) : (
                <ul className="mt-2">
                  {[...detail.evs].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => (
                    <li key={e.id} className="flex items-start gap-2 border-b py-1.5"
                        style={{ borderColor: '#eadfe2' }}>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black"
                            style={{ backgroundColor: colorOf(e.type) || '#ddd', color: INK }}>
                        {labelOf(e.type)}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold" style={{ color: '#6a5f70', width: 46 }}>
                        {(e.date || '').slice(5)}
                      </span>
                      {e.event_url
                        ? <a href={e.event_url} target="_blank" rel="noopener noreferrer"
                             className="text-[12px] hover:underline" style={{ color: '#2a2030' }}>{e.title}</a>
                        : <span className="text-[12px]" style={{ color: '#2a2030' }}>{e.title}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
