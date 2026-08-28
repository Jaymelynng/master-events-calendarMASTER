// ============================================================================
// MONTHLY REQUIREMENTS TABLE - Shows event counts vs requirements per gym
// ============================================================================
import React from 'react';
import { theme, getEventTypeColor } from './constants';
import { parseYmdLocal } from './utils';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';

export default function MonthlyRequirementsTable({
  onEmailShortGyms,
  currentMonth,
  currentYear,
  allGyms,
  events,
  eventTypes,
  monthlyRequirements,
  gymLinks,
  scrollToGym,
  getGymLinkUrl,
  handleMagicControlClick,
  getEventCounts,
  acknowledgedPatterns = []
}) {
  const counts = getEventCounts();

  // Get missing event types for a gym
  const getMissingEventTypes = (gym) => {
    const missing = [];
    Object.keys(monthlyRequirements).forEach(eventType => {
      const requiredCount = monthlyRequirements[eventType];
      const currentCount = counts[gym]?.[eventType] || 0;
      if (currentCount < requiredCount) {
        const deficit = requiredCount - currentCount;
        const shortLabel = eventType === 'KIDS NIGHT OUT' ? 'KNO' : eventType;
        missing.push(`+${deficit} ${shortLabel}`);
      }
    });
    return missing;
  };

  // Count quality issues for a gym
  const getQualityIssues = (gym) => {
    const gymEvents = events.filter(e => {
      const eventDate = parseYmdLocal(e.date);
      return e.gym_name === gym &&
             eventDate.getMonth() === currentMonth &&
             eventDate.getFullYear() === currentYear;
    });

    const errors = gymEvents.filter(e =>
      (e.validation_errors || []).some(err =>
        err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(e, err.message, acknowledgedPatterns)
      )
    ).length;

    const warnings = gymEvents.filter(e => e.description_status === 'flyer_only').length;
    const missing = gymEvents.filter(e => e.description_status === 'none').length;

    return errors + warnings + missing;
  };

  // ── The redesign ─────────────────────────────────────────────────────────
  // Before: 14 rows x 45px, six columns, every cell a 48x40 button. Nine of the
  // fourteen rows said "Complete" - nine rows of nothing - and a full-width
  // Status column existed to hold a pill that repeated what the numbers said.
  //
  // Three changes:
  //   1. Gyms that are SHORT come first and are the only ones open. The gyms
  //      that are fine collapse to one line you can expand. Work first, done
  //      out of the way.
  //   2. Counts become dots against the goal - filled = have it, hollow = still
  //      needed. You read "short by one" without doing arithmetic, and the
  //      Status column disappears because the dots ARE the status.
  //   3. Rows are one line each, not a grid of padded buttons.
  const tracked = (eventTypes || []).filter(et => et.is_tracked);
  const typeNames = tracked.length ? tracked.map(t => t.name) : Object.keys(monthlyRequirements);

  const rows = allGyms.map(gym => ({
    gym,
    missing: getMissingEventTypes(gym),
    issues: getQualityIssues(gym),
    counts: typeNames.map(t => ({
      name: t,
      label: (tracked.find(x => x.name === t) || {}).display_name || t,
      have: counts[gym]?.[t] || 0,
      goal: monthlyRequirements[t] || 0,
      color: getEventTypeColor(t, eventTypes),
    })),
  }));

  const short = rows.filter(r => r.missing.length > 0);
  const done  = rows.filter(r => r.missing.length === 0);

  // Dots: one per required event, filled when it exists. Anything above the
  // goal is a small "+n" so an over-delivering gym doesn't sprout 8 dots.
  // "Capital Gymnastics Cedar Park" -> "Capital Cedar Park". The word
  // Gymnastics is on all fourteen of them and carries no information.
  const shortName = (n) => n.replace(/\s*Gymnastics?( Academy| Center)?\s*/i, ' ').replace(/\s+/g, ' ').trim();

  const Dots = ({ c }) => {
    const filled = Math.min(c.have, c.goal);
    const extra = Math.max(c.have - c.goal, 0);
    return (
      <span className="inline-flex items-center gap-1" title={`${c.label}: ${c.have} of ${c.goal}`}>
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#7a6f75' }}>
          {c.label}
        </span>
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: c.goal }).map((_, i) => (
            <span key={i} className="inline-block rounded-full"
              style={{
                width: 13, height: 13,
                backgroundColor: i < filled ? c.color : 'transparent',
                border: `2px solid ${i < filled ? c.color : '#b9a5ab'}`,
              }} />
          ))}
          {extra > 0 && <span className="text-[10px] font-bold" style={{ color: '#7a6f75' }}>+{extra}</span>}
        </span>
      </span>
    );
  };

  const GymRow = ({ r, dim }) => (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/70 hover:bg-white transition-colors"
      style={{ opacity: dim ? 0.75 : 1, border: '1px solid #e2d7da' }}
    >
      <button
        onClick={() => scrollToGym(r.gym)}
        className="text-left text-[12.5px] font-bold hover:underline truncate shrink-0"
        style={{ color: '#4a4046', width: 118 }}
        title={`Jump to ${r.gym} on the calendar`}
      >
        {shortName(r.gym)}
      </button>

      {/* Dots spread across the cell instead of hugging the left edge. */}
      <div className="flex items-center justify-around flex-1 gap-2">
        {r.counts.map(c => {
          const url = getGymLinkUrl(r.gym, c.name) || getGymLinkUrl(r.gym, 'BOOKING');
          const inner = <Dots c={c} />;
          return url
            ? <a key={c.name} href={url} target="_blank" rel="noopener noreferrer"
                 className="hover:opacity-70 transition-opacity">{inner}</a>
            : <span key={c.name}>{inner}</span>;
        })}
      </div>

      {r.issues > 0 && (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black text-white shrink-0"
              style={{ backgroundColor: '#c27878' }}
              title={`${r.issues} data issue${r.issues === 1 ? '' : 's'}`}>
          {r.issues}
        </span>
      )}

      <button
        onClick={() => handleMagicControlClick(r.gym)}
        className="text-sm opacity-40 hover:opacity-100 transition-opacity shrink-0"
        title={`Open ${typeNames.join(', ')} portal pages for ${r.gym}`}
      >
        ✨
      </button>
    </div>
  );

  return (
    <div className="rounded-lg shadow-lg px-2 py-2 mb-2 mx-2"
         style={{ backgroundColor: '#efeaea', border: '1px solid #d6c9cc' }}>

      {short.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-3 pb-1">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#a4485c' }}>
              {short.length} gym{short.length === 1 ? '' : 's'} short this month
            </span>
            {onEmailShortGyms && (
              <button
                onClick={onEmailShortGyms}
                className="rounded-full px-3 py-0.5 text-[11px] font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: '#8f4a55' }}
                title="Compose the shortfall email for these gyms"
              >
                Email them →
              </button>
            )}
          </div>
          <div className="grid gap-1.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {short.map(r => <GymRow key={r.gym} r={r} />)}
          </div>
        </>
      )}

      {done.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer list-none px-3 py-1.5 rounded-md text-[11px] font-bold hover:bg-white transition-colors"
                   style={{ color: '#4f7d5c' }}>
            ✓ {done.length} gym{done.length === 1 ? '' : 's'} complete
            <span className="font-normal opacity-70"> — {done.map(r => shortName(r.gym)).join(', ')}</span>
          </summary>
          <div className="mt-1 grid gap-1.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {done.map(r => <GymRow key={r.gym} r={r} dim />)}
          </div>
        </details>
      )}

      {rows.length === 0 && (
        <div className="px-3 py-4 text-center text-sm" style={{ color: '#8b7f85' }}>
          No gyms loaded yet.
        </div>
      )}
    </div>
  );
}
