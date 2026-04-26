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
  acknowledgedPatterns = []
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

  // Get validation status indicators — rules apply everywhere (per-event + patterns)
  const getValidationIndicator = () => {
    const activeErrors = (event.validation_errors || []).filter(
      err => err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(event, err.message, acknowledgedPatterns)
    );

    // Separate by category
    const dataErrors = activeErrors.filter(err => inferErrorCategory(err) === 'data_error');
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
    }

    return null;
  };

  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => onClick(event)}
    >
      <div
        className="text-xs rounded text-gray-700 text-center font-medium transition-all duration-200 border p-2 hover:shadow-md hover:scale-105 relative"
        style={{
          backgroundColor: getEventTypeColor(eventTypeName),
          borderColor: 'rgba(0,0,0,0.1)'
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

        {/* Compact Card View */}
        <div className="font-semibold leading-tight text-sm">
          {displayName}
        </div>
        {/* Time / options line */}
        <div className="text-gray-600 mt-0.5 leading-tight text-xs">
          {event.isGrouped
            ? `${event.optionCount} opts`
            : formatTimeShort(event.time || event.event_time)}
        </div>
        {/* Openings count line — own row, sits below time */}
        {showCount && (
          <div
            className={`mt-0.5 leading-tight text-xs font-semibold ${isLow ? 'text-orange-700' : 'text-green-700'}`}
            title={countTooltip}
          >
            {isLow ? '⚠️' : '🟢'} {totalOpenings}
          </div>
        )}
      </div>
    </div>
  );
}
