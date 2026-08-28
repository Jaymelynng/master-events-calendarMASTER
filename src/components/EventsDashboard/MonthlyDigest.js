// ============================================================================
// MONTHLY DIGEST — read the state of all 14 gyms at zero clicks
// ============================================================================
// Replaces the requirements list, which was 14 rows telling you almost nothing:
// nine of them said "Complete", and the five that mattered were buried among
// them with the actual work three screens away in the Admin Dashboard.
//
// Three bands, in the order the question gets asked:
//
//   1. THE NUMBERS   — four figures for the whole month. Each one clicks
//                      through to the thing it counts.
//   2. WHO'S SHORT   — only the gyms with a gap, and exactly what they need.
//                      A gym that's fine does not get a row.
//   3. WHAT TO DO    — the actions, wired. Emailing the short gyms was
//                      Shift+Click the wand → Admin → Email Managers → select
//                      → compose. It is now one click from the number that
//                      told you to do it.
//
// Every figure is computed from the events already loaded — no extra calls.
// ============================================================================

import React from 'react';
import { parseYmdLocal } from './utils';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';

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
  onEmailShortGyms,
  onOpenAdminPortal,
  setViewMode,
  setSelectedGym,
  setSelectedEventType,
  setErrorFocus,
  acknowledgedPatterns = [],
}) {
  const counts = getEventCounts();
  const tracked = (eventTypes || []).filter(et => et.is_tracked);
  const typeNames = tracked.length ? tracked.map(t => t.name) : Object.keys(monthlyRequirements || {});
  const labelOf = (t) => (tracked.find(x => x.name === t) || {}).display_name || t;
  const colorOf = (t) => (tracked.find(x => x.name === t) || {}).color || '#b48f8f';

  // "Capital Gymnastics Cedar Park" -> "Capital Cedar Park". All fourteen say
  // Gymnastics; the word carries no information here.
  const shortName = (n) => n.replace(/\s*Gymnastics?( Academy| Center)?\s*/i, ' ').replace(/\s+/g, ' ').trim();

  const gymsEvents = (gym) => events.filter(e => {
    const d = parseYmdLocal(e.date);
    return e.gym_name === gym && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const issuesFor = (gym) => {
    const ge = gymsEvents(gym);
    const errors = ge.filter(e => (e.validation_errors || []).some(err =>
      err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(e, err.message, acknowledgedPatterns))).length;
    const flyerOnly = ge.filter(e => e.description_status === 'flyer_only').length;
    const noDesc = ge.filter(e => e.description_status === 'none').length;
    return errors + flyerOnly + noDesc;
  };

  const rows = allGyms.map(gym => {
    const gaps = typeNames.map(t => {
      const have = counts[gym]?.[t] || 0;
      const goal = monthlyRequirements?.[t] || 0;
      return { name: t, label: labelOf(t), color: colorOf(t), have, goal, need: Math.max(goal - have, 0) };
    });
    return { gym, gaps, short: gaps.filter(g => g.need > 0), issues: issuesFor(gym) };
  });

  const short = rows.filter(r => r.short.length > 0);
  const totalIssues = rows.reduce((a, r) => a + r.issues, 0);
  const noEvents = rows.filter(r => gymsEvents(r.gym).length === 0);

  const metrics = [
    { n: short.length, l: short.length === 1 ? 'gym short' : 'gyms short',
      d: short.length ? short.map(r => shortName(r.gym)).join(', ') : 'every gym has met its goals',
      tone: short.length ? 'bad' : 'ok',
      go: () => setViewMode && setViewMode('table') },
    { n: events.length, l: 'events', d: `across ${allGyms.length} gyms this month`, tone: 'plain',
      go: () => { setSelectedGym && setSelectedGym('all'); setSelectedEventType && setSelectedEventType('all'); setViewMode && setViewMode('calendar'); } },
    { n: totalIssues, l: totalIssues === 1 ? 'data issue' : 'data issues',
      d: totalIssues ? 'wrong dates, times, ages or missing descriptions' : 'nothing flagged',
      tone: totalIssues ? 'warn' : 'ok',
      go: () => setErrorFocus && setErrorFocus(true) },
    { n: noEvents.length, l: 'gyms with nothing', d: noEvents.length ? noEvents.map(r => shortName(r.gym)).join(', ') : 'all gyms have events',
      tone: noEvents.length ? 'warn' : 'ok',
      go: () => onOpenAdminPortal && onOpenAdminPortal() },
  ];

  const TONE = {
    bad:   { n: '#a4485c', pill: '#c94b76' },
    warn:  { n: '#9a6a1f', pill: '#d99a2a' },
    ok:    { n: '#3f6b52', pill: '#4f7d5c' },
    plain: { n: '#4a4046', pill: '#8b7f85' },
  };

  const actions = [
    short.length && onEmailShortGyms && {
      tone: 'bad', text: `Email ${short.length} gym${short.length === 1 ? '' : 's'} about what they still owe`,
      run: onEmailShortGyms,
    },
    totalIssues > 0 && setErrorFocus && {
      tone: 'warn', text: `Fix ${totalIssues} data issue${totalIssues === 1 ? '' : 's'} on live events`,
      run: () => setErrorFocus(true),
    },
    noEvents.length > 0 && onOpenAdminPortal && {
      tone: 'warn', text: `Sync ${noEvents.length} gym${noEvents.length === 1 ? '' : 's'} with no events yet`,
      run: onOpenAdminPortal,
    },
  ].filter(Boolean);

  return (
    <div className="mx-2 mb-2 flex flex-col gap-2">

      {/* 1 · THE NUMBERS — each one clicks through to what it counts */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={m.go}
            className="text-left rounded-xl bg-white px-4 py-2.5 transition hover:-translate-y-0.5"
            style={{ boxShadow: '0 5px 14px rgba(90,70,70,.14)', border: '1px solid #e7dcdf' }}
            title={m.d}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-black leading-none" style={{ fontSize: 30, color: TONE[m.tone].n }}>{m.n}</span>
              <span className="text-xs font-bold" style={{ color: '#6a5f70' }}>{m.l}</span>
            </div>
            <div className="mt-1 text-[11px] truncate" style={{ color: '#9a8fa0' }}>{m.d}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr]">

        {/* 2 · WHO'S SHORT — only gyms with a gap, and exactly what they need */}
        <section className="rounded-xl bg-white px-4 py-3"
                 style={{ boxShadow: '0 5px 14px rgba(90,70,70,.14)', border: '1px solid #e7dcdf' }}>
          <header className="mb-2 flex items-center">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6a5f70' }}>
              Who's short
            </span>
            <button
              onClick={() => setViewMode && setViewMode('table')}
              className="ml-auto text-[10px] font-black" style={{ color: '#b0466a' }}
            >
              View all {allGyms.length} →
            </button>
          </header>

          {short.length === 0 ? (
            <div className="py-3 text-sm font-semibold" style={{ color: '#3f6b52' }}>
              ✓ All {allGyms.length} gyms have met their goals this month.
            </div>
          ) : (
            <div className="grid gap-1 md:grid-cols-2">
              {short.map(r => (
                <div key={r.gym}
                     className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#faf6f0] transition-colors">
                  <button
                    onClick={() => scrollToGym(r.gym)}
                    className="text-[12.5px] font-bold hover:underline truncate shrink-0"
                    style={{ color: '#4a4046', width: 108 }}
                    title={`Jump to ${r.gym} on the calendar`}
                  >
                    {shortName(r.gym)}
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    {r.short.map(g => (
                      <span key={g.name}
                            className="rounded-full px-2 py-0.5 text-[10px] font-black text-white whitespace-nowrap"
                            style={{ backgroundColor: g.color }}
                            title={`${g.have} of ${g.goal} ${g.label}`}>
                        need {g.need} {g.label}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleMagicControlClick(r.gym)}
                    className="ml-auto text-sm opacity-40 hover:opacity-100 transition-opacity shrink-0"
                    title={`Open ${r.gym}'s portal pages`}
                  >
                    ✨
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3 · WHAT TO DO — wired, not decorative */}
        <section className="rounded-xl bg-white px-4 py-3"
                 style={{ boxShadow: '0 5px 14px rgba(90,70,70,.14)', border: '1px solid #e7dcdf' }}>
          <header className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: '#6a5f70' }}>
            What to do
          </header>
          {actions.length === 0 ? (
            <div className="py-3 text-sm font-semibold" style={{ color: '#3f6b52' }}>
              ✓ Nothing needs you right now.
            </div>
          ) : (
            <ul className="flex flex-col">
              {actions.map((a, i) => (
                <li key={i}>
                  <button
                    onClick={a.run}
                    className="flex w-full items-center gap-2.5 py-1.5 text-left text-[12.5px] hover:opacity-70 transition-opacity"
                    style={{ color: '#4a4046', borderBottom: i < actions.length - 1 ? '1px solid #f1eae0' : 'none' }}
                  >
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white shrink-0"
                          style={{ backgroundColor: TONE[a.tone].pill }}>!</span>
                    {a.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
