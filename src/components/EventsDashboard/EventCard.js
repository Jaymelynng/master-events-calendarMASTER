// ============================================================================
// EVENT CARD - Individual event card displayed in the calendar grid
// ============================================================================
import React from 'react';
import { getEventTypeColor } from './constants';
import { formatTimeShort } from './utils';
import { isErrorAcknowledgedAnywhere, inferErrorCategory } from '../../lib/validationHelpers';

export default function EventCard({
  event,
  eventTypes,
  onClick,
  acknowledgedPatterns = [],
  errorFocus = false
}) {
  const eventTypeName = event.type || event.event_type;
  const eventTypeData = eventTypes.find(et => et.name === eventTypeName);
  const displayName = eventTypeData?.display_name || eventTypeName || 'Event';

  // Calculate spots remaining (sum across grouped variants if applicable)
  const isFull = event.has_openings === false;
  let totalOpenings = null;
  if (event.isGrouped && Array.isArray(event.groupedEvents)) {
    const variantsWithData = event.groupedEvents.filter(v => v.openings != null);
    if (variantsWithData.length > 0) {
      totalOpenings = variantsWithData.reduce((sum, v) => sum + (v.openings || 0), 0);
    }
  } else if (event.openings != null) {
    totalOpenings = event.openings;
  }
  const isLow = totalOpenings != null && totalOpenings > 0 && totalOpenings <= 3;
  const showCount = totalOpenings != null && !isFull;
  const countTooltip = event.isGrouped
    ? `${totalOpenings} spots open across ${event.optionCount} options`
    : `${totalOpenings} spots open`;

  // What counts as "needs attention" — data errors, AI suggestions, or a
  // missing/flyer-only description. Drives both the corner dots and the
  // Errors Focus dim/spotlight behavior.
  const activeErrors = (event.validation_errors || []).filter(
    err => err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(event, err.message, acknowledgedPatterns)
  );
  const dataErrors = activeErrors.filter(err => inferErrorCategory(err) === 'data_error');
  const activeAiFlags = (event.ai_review_flags || []).filter(
    f => !isErrorAcknowledgedAnywhere(event, f.message, acknowledgedPatterns)
  );
  const hasDescIssue = event.description_status === 'none' || event.description_status === 'flyer_only';
  const hasIssue = dataErrors.length > 0 || activeAiFlags.length > 0 || hasDescIssue;
  // The single line we surface on the card in Errors Focus mode (data error
  // wins over AI suggestion wins over description problem).
  const focusReason = dataErrors[0]?.message
    || activeAiFlags[0]?.message
    || (event.description_status === 'none' ? 'No description'
        : event.description_status === 'flyer_only' ? 'Flyer only — no text' : null);

  // Get validation status indicators — rules apply everywhere (per-event + patterns)
  const getValidationIndicator = () => {
    const hasDataErrors = dataErrors.length > 0;

    // Show colored dot for data errors
    if (hasDataErrors) {
      return (
        <span className="absolute -top-1 -right-1" title={`${dataErrors.length} DATA ERROR(S) - wrong info!`}>
          <span className="w-3 h-3 bg-red-500 rounded-full shadow-sm inline-block border border-red-700"></span>
        </span>
      );
    } else if (event.description_status === 'flyer_only') {
      // Flyer only - small gray dot
      return (
        <span className="absolute -top-1 -right-1" title="Has flyer but no text description">
          <span className="w-2 h-2 bg-gray-400 rounded-full shadow-sm inline-block"></span>
        </span>
      );
    } else if (event.description_status === 'none') {
      // No description - hollow red circle
      return (
        <span className="absolute -top-1 -right-1" title="No description at all">
          <span className="w-2.5 h-2.5 border-2 border-red-500 rounded-full inline-block bg-white"></span>
        </span>
      );
    } else if (activeAiFlags.length > 0) {
      // AI suggestion (no hard data error) — small indigo dot
      return (
        <span className="absolute -top-1 -right-1" title={`🤖 AI suggestion: ${activeAiFlags[0].message}`}>
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#6366f1', border: '1px solid #4338ca' }}></span>
        </span>
      );
    }

    return null;
  };

  // Build hover tooltip with the info we removed from the card
  const eventTime = formatTimeShort(event.time || event.event_time);
  const tooltipParts = [event.title || displayName];
  if (eventTime) tooltipParts.push(`Time: ${eventTime}`);
  if (showCount) tooltipParts.push(`${totalOpenings} spots open`);
  if (event.isGrouped) tooltipParts.push(`${event.optionCount} options`);
  if (event.has_openings === false) tooltipParts.push('SOLD OUT');
  const cardTooltip = tooltipParts.join(' · ');

  // Errors Focus mode: clean events fade back, issue events pop with a red ring.
  const dimmed = errorFocus && !hasIssue;
  const spotlit = errorFocus && hasIssue;

  return (
    <div
      className="relative group cursor-pointer transition-all duration-200"
      onClick={() => onClick(event)}
      title={cardTooltip}
      style={dimmed ? { opacity: 0.25, filter: 'grayscale(1)' } : {}}
    >
      <div
        className="text-xs rounded text-gray-700 text-center font-medium transition-all duration-200 border p-2 hover:shadow-md hover:scale-105 relative"
        style={{
          backgroundColor: getEventTypeColor(eventTypeName, eventTypes),
          borderColor: spotlit ? '#dc2626' : 'rgba(0,0,0,0.1)',
          ...(spotlit ? { boxShadow: '0 0 0 2px #dc2626, 0 3px 10px rgba(220,38,38,.3)' } : {})
        }}
      >
        {/* SOLD OUT badge - top left */}
        {event.has_openings === false && (
          <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[8px] font-bold px-1 rounded" title="SOLD OUT - no spots available">
            FULL
          </span>
        )}

        {/* Validation status indicator */}
        {getValidationIndicator()}

        {/* Compact Card View — TYPE name */}
        <div className="font-semibold leading-tight text-sm">
          {displayName}
        </div>
        {/* Options count for grouped events (single events skip this row entirely) */}
        {event.isGrouped && (
          <div className="text-gray-500 italic mt-0.5 leading-tight text-xs">
            {event.optionCount} opts
          </div>
        )}
        {/* Errors Focus: show WHY it's flagged instead of the spot count. */}
        {spotlit && focusReason ? (
          <div className="mt-0.5 leading-tight text-[10px] font-semibold text-red-700 line-clamp-2">
            {focusReason}
          </div>
        ) : (
          /* Openings count line (normal mode) */
          showCount && (
            <div
              className={`mt-0.5 leading-tight text-xs font-semibold ${isLow ? 'text-orange-700' : 'text-green-700'}`}
            >
              {isLow ? '⚠️' : '🟢'} {totalOpenings}
            </div>
          )
        )}
      </div>
    </div>
  );
}
