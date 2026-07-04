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
import { inferErrorCategory, isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';

// Decide whether a variant should show the data-error indicator.
// Mirrors the EventCard.js logic: filter out sold_out, drop anything
// acknowledged via patterns, then keep only data_error category.
function variantHasDataErrors(variant, acknowledgedPatterns) {
  const all = variant.validation_errors || [];
  if (all.length === 0) return false;
  const active = all.filter(
    err => err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(variant, err.message, acknowledgedPatterns)
  );
  return active.some(err => inferErrorCategory(err) === 'data_error');
}

// "Needs attention" check for Errors Focus mode: data errors OR a
// missing/flyer-only description. AI review lives in the Errors tab, not the
// calendar (Jayme, July 2).
function variantHasIssue(variant, acknowledgedPatterns) {
  if (variantHasDataErrors(variant, acknowledgedPatterns)) return true;
  return variant.description_status === 'none' || variant.description_status === 'flyer_only';
}

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
  acknowledgedPatterns = [],
  errorFocus = false,
}) {
  if (!campEvents || campEvents.length === 0) return null;

  const runs = groupCampsByRun(campEvents).map(run =>
    run.slice().sort((a, b) => variantSortKey(a) - variantSortKey(b))
  );

  // Determine the "lane" a variant occupies. Same lane = same row in the
  // band, regardless of which week it belongs to. This way a summer of
  // 4 camp weeks (each with Gym Full / Gym Half / Ninja Full / Ninja Half)
  // renders as 4 ROWS total, not 16 — every "Gym Full" bar sits on row 1,
  // every "Gym Half" on row 2, etc., with their gridColumn anchored to
  // each week's actual dates.
  // Lane order: Gym Full, Gym Half, Ninja Full, Ninja Half, then anything
  // unrecognized in insertion order beyond.
  const KNOWN_LANES = {
    'gym-full':   0,
    'gym-half':   1,
    'ninja-full': 2,
    'ninja-half': 3,
  };
  const laneKeyForVariant = (event) => {
    const text = `${event.title || ''} ${event.program_name || ''}`.toLowerCase();
    const isNinja = text.includes('ninja');
    const isHalf  = text.includes('half');
    return `${isNinja ? 'ninja' : 'gym'}-${isHalf ? 'half' : 'full'}`;
  };

  // First pass: figure out which lanes are actually used and assign each a
  // contiguous row index (so we don't render empty gaps).
  const usedLaneKeys = new Set();
  for (const run of runs) {
    for (const variant of run) {
      usedLaneKeys.add(laneKeyForVariant(variant));
    }
  }
  // Sort the used lane keys by KNOWN_LANES priority; unknown keys go after.
  const sortedLaneKeys = Array.from(usedLaneKeys).sort((a, b) => {
    const aRank = a in KNOWN_LANES ? KNOWN_LANES[a] : 100;
    const bRank = b in KNOWN_LANES ? KNOWN_LANES[b] : 100;
    return aRank - bRank;
  });
  const laneToRow = {};
  sortedLaneKeys.forEach((key, idx) => { laneToRow[key] = idx + 1; });

  // Second pass: place every variant in its lane's row, with the date-range
  // gridColumn computed per-variant.
  const placements = [];
  for (const run of runs) {
    for (const variant of run) {
      const startDateStr = variant.start_date || variant.date;
      if (!startDateStr) continue;

      const startObj = parseYmdLocal(startDateStr);
      const endObj = getActualEndDate(variant, parseYmdLocal);

      // Clip to visible range when the camp starts before / ends after the
      // current month, so we always render something visible.
      let startIdx;
      if (startObj.getFullYear() === currentYear && startObj.getMonth() === currentMonth) {
        startIdx = displayDates.indexOf(startObj.getDate());
      }
      if (startIdx == null || startIdx === -1) startIdx = 0;

      let endIdx;
      if (endObj.getFullYear() === currentYear && endObj.getMonth() === currentMonth) {
        endIdx = displayDates.indexOf(endObj.getDate());
      }
      if (endIdx == null || endIdx === -1) endIdx = displayDates.length - 1;

      // Grid columns 1-indexed; CSS grid end is exclusive so end is +2.
      const gridColumn = `${startIdx + 1} / ${endIdx + 2}`;

      placements.push({
        variant,
        gridColumn,
        gridRow: laneToRow[laneKeyForVariant(variant)],
      });
    }
  }

  if (placements.length === 0) return null;

  const totalRows = sortedLaneKeys.length;

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
        // Error indicators (red border / dot) ONLY in Errors Focus mode —
        // normal calendar view stays clean (Jayme).
        const hasErrors = errorFocus && variantHasDataErrors(variant, acknowledgedPatterns);
        // Errors Focus: dim clean variants, leave flagged ones bright.
        const hasIssue = errorFocus ? variantHasIssue(variant, acknowledgedPatterns) : false;
        const dimmed = errorFocus && !hasIssue;

        return (
          <div
            key={variant.id}
            className="camp-bar"
            style={{
              gridColumn,
              gridRow,
              borderRadius: '7px',
              ...(dimmed ? { opacity: 0.25, filter: 'grayscale(1)' } : {}),
              // When a variant has unresolved data errors, switch the border
              // to red and add a soft red glow so the bar pops as "needs
              // attention" without redrawing the whole bar.
              border: hasErrors ? '2px solid #dc3545' : `1.5px solid ${style.border}`,
              background: style.bg,
              color: style.color,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: hasErrors
                ? '0 0 0 2px rgba(220,53,69,0.18), 0 1px 2px rgba(0,0,0,0.06)'
                : '0 1px 2px rgba(0,0,0,0.06)',
              minWidth: 0,
              overflow: 'hidden',
              position: 'relative',
            }}
            onClick={() => onEventSelect && onEventSelect(variant)}
            title={
              hasErrors
                ? `⚠️ Has data error(s) — click for details. ${variant.title || variantLabel(variant)}`
                : (variant.title || variantLabel(variant))
            }
          >
            {hasErrors && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  width: '12px',
                  height: '12px',
                  background: '#dc3545',
                  borderRadius: '50%',
                  border: '1.5px solid white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  zIndex: 2,
                }}
                title="Data error — click to see what's wrong"
              />
            )}
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
