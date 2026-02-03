import React from 'react';
import { inferErrorCategory, isErrorAcknowledged, getAcknowledgmentDetails, getErrorLabel } from '../../lib/validationHelpers';

export default function AdminAuditErrorCard({
  event,
  onDismissError,
  dismissingError,
  showDismissedErrors = true,
  selectedCategory = 'all',
}) {
  const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
  const acknowledged = event.acknowledged_errors || [];

  // Separate by category
  const dataErrors = errors.filter(e => inferErrorCategory(e) === 'data_error');
  const formattingErrors = errors.filter(e => inferErrorCategory(e) === 'formatting');
  const statusErrors = errors.filter(e => inferErrorCategory(e) === 'status');

  // Count active vs dismissed
  const activeDataErrors = dataErrors.filter(e => !isErrorAcknowledged(acknowledged, e.message));
  const activeFormattingErrors = formattingErrors.filter(e => !isErrorAcknowledged(acknowledged, e.message));
  const activeStatusErrors = statusErrors.filter(e => !isErrorAcknowledged(acknowledged, e.message));
  const dismissedDataErrors = dataErrors.filter(e => isErrorAcknowledged(acknowledged, e.message));
  const dismissedFormattingErrors = formattingErrors.filter(e => isErrorAcknowledged(acknowledged, e.message));
  const dismissedStatusErrors = statusErrors.filter(e => isErrorAcknowledged(acknowledged, e.message));

  const totalActive = activeDataErrors.length + activeFormattingErrors.length + activeStatusErrors.length;
  const totalDismissed = dismissedDataErrors.length + dismissedFormattingErrors.length + dismissedStatusErrors.length;
  const hasDescriptionIssue = event.description_status === 'none' || event.description_status === 'flyer_only';

  if (totalActive === 0 && !hasDescriptionIssue && (!showDismissedErrors || totalDismissed === 0)) {
    return null;
  }

  const renderErrorRow = (error, isDismissed = false) => {
    const isLoading = dismissingError === `${event.id}-${error.message}`;
    const ackDetails = isDismissed ? getAcknowledgmentDetails(acknowledged, error.message) : null;
    const category = inferErrorCategory(error);

    return (
      <div
        key={error.message}
        className={`flex items-center justify-between gap-2 p-2 rounded-lg border-l-4 ${
          isDismissed
            ? 'bg-gray-50 border-gray-300 opacity-60'
            : category === 'data_error'
              ? 'bg-red-50 border-red-500'
              : category === 'status'
                ? 'bg-blue-50 border-blue-400'
                : 'bg-orange-50 border-orange-400'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm">
            {isDismissed ? '✅' : category === 'data_error' ? '🚨' : category === 'status' ? 'ℹ️' : '⚠️'}
            {' '}
            <strong className="text-xs">{getErrorLabel(error.type)}</strong>
          </span>
          <span className="text-xs block text-gray-600 mt-0.5 truncate">{error.message}</span>
          {isDismissed && ackDetails && (
            <span className="text-xs block text-green-600 mt-0.5">
              {ackDetails.has_rule && <span className="bg-blue-100 text-blue-700 px-1 rounded text-[10px] mr-1">permanent rule</span>}
              {ackDetails.note && <span className="italic">"{ackDetails.note}"</span>}
              {ackDetails.dismissed_at && (
                <span className="text-gray-400 ml-1">
                  ({new Date(ackDetails.dismissed_at).toLocaleDateString()})
                </span>
              )}
            </span>
          )}
        </div>
        {!isDismissed && (
          <button
            onClick={() => onDismissError(event, error.message, error)}
            disabled={isLoading}
            className="flex-shrink-0 px-2.5 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-medium disabled:opacity-50"
            title="Dismiss with optional note"
          >
            {isLoading ? '...' : '✓ OK'}
          </button>
        )}
      </div>
    );
  };

  const renderSection = (title, badge, activeErrors, dismissedErrors, bgColor, textColor) => {
    if (activeErrors.length === 0 && (!showDismissedErrors || dismissedErrors.length === 0)) return null;
    return (
      <div className="mt-2">
        <div className={`text-xs font-semibold ${textColor} mb-1 flex items-center gap-1`}>
          <span className={`${bgColor} text-white px-1.5 py-0.5 rounded text-[10px]`}>{badge}</span>
          {title}
        </div>
        <div className="space-y-1">
          {activeErrors.map(error => renderErrorRow(error, false))}
          {showDismissedErrors && dismissedErrors.map(error => renderErrorRow(error, true))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Event Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 truncate">{event.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{event.date || event.start_date}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              event.type === 'CAMP' ? 'bg-blue-100 text-blue-700' :
              event.type === 'CLINIC' ? 'bg-purple-100 text-purple-700' :
              event.type === 'OPEN GYM' ? 'bg-green-100 text-green-700' :
              event.type === 'KIDS NIGHT OUT' ? 'bg-pink-100 text-pink-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {event.type}
            </span>
            {totalActive > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                {totalActive} active
              </span>
            )}
            {totalDismissed > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                {totalDismissed} resolved
              </span>
            )}
          </div>
        </div>
        {event.event_url && (
          <a
            href={event.event_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
          >
            🔗 iClass
          </a>
        )}
      </div>

      {/* Errors */}
      <div className="px-4 py-3 space-y-1">
        {/* Description Issue */}
        {hasDescriptionIssue && (selectedCategory === 'all' || selectedCategory === 'description') && (
          <div className="p-2 rounded-lg border-l-4 border-gray-400 bg-gray-50">
            <span className="text-sm">
              {event.description_status === 'none' ? '❌' : '📸'}
              {' '}
              <strong className="text-xs">
                {event.description_status === 'none' ? 'No description' : 'Flyer only (no text)'}
              </strong>
            </span>
          </div>
        )}

        {/* Data Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'data_error') &&
          renderSection('Data Errors (Wrong Info):', 'HIGH', activeDataErrors, dismissedDataErrors, 'bg-red-500', 'text-red-700')}

        {/* Formatting Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'formatting') &&
          renderSection('Missing/Incomplete Info:', 'FORMAT', activeFormattingErrors, dismissedFormattingErrors, 'bg-orange-500', 'text-orange-700')}

        {/* Status Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'status') &&
          renderSection('Status:', 'INFO', activeStatusErrors, dismissedStatusErrors, 'bg-blue-500', 'text-blue-700')}
      </div>
    </div>
  );
}
