// ============================================================================
// CAMP BAND — long-narrow variant bars that span multiple days
// ============================================================================
// Each gym row shows non-camp events in the day cells (top zone) and camp
// variants here as horizontal bars spanning their start_date → end_date.
// One bar per variant. Designed for the "Jayme's Pick" combo layout drawn in
// mockups/calendar-camp-display-options.html (May 2026).
//
// Inputs:
//   campEvents      — array of CAMP-type events for ONE gym, already filtered
//                     to the visible month
//   displayDates    — array of day numbers visible in the current calendar
//                     view (e.g. [1,2,...,31] for full month)
//   currentYear, currentMonth — for cross-month edge cases
//   onEventSelect   — fires when a bar is clicked (opens side panel)
// ============================================================================

import React from 'react';
import { parseYmdLocal, getActualEndDate } from './utils';

// Group variants by their (start_date, end_date) so all variants of the same
// camp run land together in the same row block.
function groupCampsByRun(campEvents) {
  const groups = new Map();
  campEvents.forEach(e => {
    const key = `${e.start_date || e.date}-${e.end_date || e.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return Array.from(groups.values());
}

// Sort variants inside a single camp run for stable visual order.
// Gymnastics first, then Ninja. Within each, Full before Half.
function variantSortKey(event) {
  const text = `${event.title || ''} ${event.program_name || ''}`.toLowerCase();
  let typeRank = 1; // default = gymnastics-ish
  if (text.includes('ninja')) typeRank = 2;
  let durationRank = 0; // full day default
  if (text.includes('half')) durationRank = 1;
  return typeRank * 10 + durationRank;
}

// Visual classification used by the bar styling.
function variantStyle(event) {
  const text = `${event.title || ''} ${event.program_name || ''}`.toLowerCase();
  const isNinja = text.includes('ninja');
  return isNinja
    ? { bg: '#ffe5cc', border: '#c89770', color: '#7a4a20', icon: '🥷' }
    : { bg: '#fff5d4', border: '#d6a844', color: '#6b4f1f', icon: '🤸' };
}

// "Gym Full Day" / "Ninja Half Day" / etc. — short, always-fits label.
function variantLabel(event) {
  const text = `${event.title || ''} ${event.program_name || ''}`.toLowerCase();
  const isNinja = text.includes('ninja');
  const isHalf = text.includes('half');
  return `${isNinja ? 'Ninja' : 'Gym'} ${isHalf ? 'Half Day' : 'Full Day'}`;
}

// Capacity status — same logic as EventCard.js
function spotsStatus(event) {
  if (event.has_openings === false) return { kind: 'full', text: '🔴 FULL' };
  const o = event.openings;
  if (o == null) return null;
  if (o === 0) return { kind: 'full', text: '🔴 FULL' };
  if (o <= 3) return { kind: 'low', text: `⚠️ ${o} left` };
  return { kind: 'open', text: `🟢 ${o} left` };
}

const STATUS_COLORS = {
  open: '#2f7c39',
  low: '#b07020',
  full: '#c0392b',
};

export default function CampBand({
  campEvents,
  displayDates,
  currentYear,
  currentMonth,
  onEventSelect,
}) {
  if (!campEvents || campEvents.length === 0) return null;

  const runs = groupCampsByRun(campEvents).map(run =>
    run.slice().sort((a, b) => variantSortKey(a) - variantSortKey(b))
  );

  // Compute placements: which grid column does each variant start/end at,
  // and which row does it sit on.
  const placements = [];
  let nextRow = 0;
  for (const run of runs) {
    for (const variant of run) {
      // start day number (use start_date, fall back to date)
      const startDateStr = variant.start_date || variant.date;
      const endDateStr = variant.end_date || variant.date;
      if (!startDateStr) continue;

      const startObj = parseYmdLocal(startDateStr);
      const endObj = getActualEndDate(variant, parseYmdLocal);

      // Day-of-month for start/end (only if same month as visible)
      // For cross-month spans, clip to first/last visible day.
      let startIdx;
      if (startObj.getFullYear() === currentYear && startObj.getMonth() === currentMonth) {
        startIdx = displayDates.indexOf(startObj.getDate());
      }
      // If start is before the visible range, clip to first column
      if (startIdx == null || startIdx === -1) startIdx = 0;

      let endIdx;
      if (endObj.getFullYear() === currentYear && endObj.getMonth() === currentMonth) {
        endIdx = displayDates.indexOf(endObj.getDate());
      }
      if (endIdx == null || endIdx === -1) endIdx = displayDates.length - 1;

      // Grid columns are 1-indexed; we add 1 because col 1 inside the band is
      // the first day. End is exclusive in CSS grid, so we add 1 again.
      const gridColumn = `${startIdx + 1} / ${endIdx + 2}`;

      placements.push({
        variant,
        gridColumn,
        gridRow: nextRow + 1,
      });
      nextRow++;
    }
  }

  if (placements.length === 0) return null;

  const totalRows = nextRow;

  return (
    <div
      className="camp-band"
      style={{
        gridColumn: '2 / -1',
        display: 'grid',
        gridTemplateColumns: `repeat(${displayDates.length}, 1fr)`,
        gridTemplateRows: `repeat(${totalRows}, 28px)`,
        gap: '3px',
        padding: '3px 4px 4px',
        // Subtle bg tint that matches the gym cell's gray-50 — visually
        // claims this strip as part of the same gym row rather than letting
        // it look like a new row starting. No top border (dashed line was
        // confusing — read as a row divider).
        background: '#f9fafb',
      }}
    >
      {placements.map(({ variant, gridColumn, gridRow }) => {
        const style = variantStyle(variant);
        const status = spotsStatus(variant);
        const statusColor = status ? STATUS_COLORS[status.kind] : null;

        return (
          <div
            key={variant.id}
            className="camp-bar"
            style={{
              gridColumn,
              gridRow,
              borderRadius: '7px',
              border: `1.5px solid ${style.border}`,
              background: style.bg,
              color: style.color,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              minWidth: 0,
              overflow: 'hidden',
            }}
            onClick={() => onEventSelect && onEventSelect(variant)}
            title={variant.title || variantLabel(variant)}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              overflow: 'hidden',
            }}>
              <span style={{ fontSize: '13px', flexShrink: 0 }}>{style.icon}</span>
              <span style={{
                fontWeight: 900,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {variantLabel(variant)}
              </span>
            </div>
            {status && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginLeft: '8px',
                  color: statusColor,
                }}
              >
                {status.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
