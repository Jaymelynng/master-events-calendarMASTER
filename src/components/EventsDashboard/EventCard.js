// ============================================================================
// EVENT CARD - Individual event card displayed in the calendar grid
// ============================================================================
import React from 'react';
import { getEventTypeColor } from './constants';
import { formatTimeShort } from './utils';
import { isErrorAcknowledged, inferErrorCategory } from '../../lib/validationHelpers';

export default function EventCard({
  event,
  eventTypes,
  onClick
}) {
  const eventTypeName = event.type || event.event_type;
  const eventTypeData = eventTypes.find(et => et.name === eventTypeName);
  const displayName = eventTypeData?.display_name || eventTypeName || 'Event';

  // Get validation status indicators
  const getValidationIndicator = () => {
    const acknowledged = event.acknowledged_errors || [];
    const activeErrors = (event.validation_errors || []).filter(
      err => err.type !== 'sold_out' && !isErrorAcknowledged(acknowledged, err.message)
    );

    // Separate by category
    const dataErrors = activeErrors.filter(err => inferErrorCategory(err) === 'data_error');
    const formattingErrors = activeErrors.filter(err => inferErrorCategory(err) === 'formatting');
    const hasDataErrors = dataErrors.length > 0;
    const hasFormattingErrors = formattingErrors.length > 0;

    // Show colored dots based on error types
    if (hasDataErrors && hasFormattingErrors) {
      // Both types - show TWO dots: red + orange side by side
      return (
        <span className="absolute -top-1 -right-1 flex items-center" title={`DATA: ${dataErrors.length} | FORMAT: ${formattingErrors.length}`}>
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm inline-block border border-red-700"></span>
          <span className="w-2 h-2 bg-orange-400 rounded-full shadow-sm inline-block border border-orange-600 -ml-1"></span>
        </span>
      );
    } else if (hasDataErrors) {
      // Data errors only - red dot
      return (
        <span className="absolute -top-1 -right-1" title={`${dataErrors.length} DATA ERROR(S) - wrong info!`}>
          <span className="w-3 h-3 bg-red-500 rounded-full shadow-sm inline-block border border-red-700"></span>
        </span>
      );
    } else if (hasFormattingErrors) {
      // Formatting only - orange dot
      return (
        <span className="absolute -top-1 -right-1" title={`${formattingErrors.length} formatting issue(s) - incomplete info`}>
          <span className="w-2.5 h-2.5 bg-orange-400 rounded-full shadow-sm inline-block border border-orange-600"></span>
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
        <div className="text-gray-600 mt-0.5 leading-tight text-xs">
          {event.isGrouped ? (
            <span className="text-gray-500 italic">{event.optionCount} options available</span>
          ) : (
            formatTimeShort(event.time || event.event_time)
          )}
        </div>
      </div>
    </div>
  );
}
