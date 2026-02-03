import React from 'react';
import { inferErrorCategory, isErrorAcknowledged, getAcknowledgmentDetails, getErrorLabel, isErrorVerified } from '../../lib/validationHelpers';

export default function AdminAuditErrorCard({
  event,
  onDismissError,
  onVerifyError,
  dismissingError,
  showDismissedErrors = true,
  showActiveErrors = true,
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

  const verified = event.verified_errors || [];
  const hasDescriptionIssue = event.description_status === 'none' || event.description_status === 'flyer_only';
  const totalActive = activeDataErrors.length + activeFormattingErrors.length + activeStatusErrors.length + (hasDescriptionIssue ? 1 : 0);
  const totalDismissed = dismissedDataErrors.length + dismissedFormattingErrors.length + dismissedStatusErrors.length;

  const visibleActive = showActiveErrors ? totalActive : 0;
  const visibleDismissed = showDismissedErrors ? totalDismissed : 0;
  if (visibleActive === 0 && visibleDismissed === 0) {
    return null;
  }

  const renderErrorRow = (error, isDismissed = false) => {
    const isLoading = dismissingError === `${event.id}-${error.message}`;
    const ackDetails = isDismissed ? getAcknowledgmentDetails(acknowledged, error.message) : null;
    const category = inferErrorCategory(error);
    const verifiedEntry = isErrorVerified(verified, error.message);

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
          {verifiedEntry && (
            <span className={`text-xs block mt-0.5 ${verifiedEntry.verdict === 'incorrect' ? 'text-red-600' : 'text-green-600'}`}>
              <span className={`px-1 rounded text-[10px] ${verifiedEntry.verdict === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {verifiedEntry.verdict === 'incorrect' ? '✗ incorrect' : '✓ verified'}
              </span>
              <span className="text-gray-400 ml-1">({new Date(verifiedEntry.verified_at).toLocaleDateString()})</span>
            </span>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {/* Verify correct checkbox (green) */}
          {onVerifyError && (
            <button
              onClick={() => onVerifyError(event, error.message, verifiedEntry?.verdict === 'correct' ? null : 'correct', error)}
              className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                verifiedEntry?.verdict === 'correct'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white border-gray-400 hover:border-green-500 hover:bg-green-50 text-gray-300 hover:text-green-500'
              }`}
              title={verifiedEntry?.verdict === 'correct' ? 'Uncheck — remove verification' : 'Check — verified this is a real issue'}
            >
              <span className="text-sm font-bold">{verifiedEntry?.verdict === 'correct' ? '✓' : '☐'}</span>
            </button>
          )}
          {/* Mark incorrect button (red X) */}
          {onVerifyError && (
            <button
              onClick={() => onVerifyError(event, error.message, verifiedEntry?.verdict === 'incorrect' ? null : 'incorrect', error)}
              className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                verifiedEntry?.verdict === 'incorrect'
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-white border-gray-400 hover:border-red-500 hover:bg-red-50 text-gray-300 hover:text-red-500'
              }`}
              title={verifiedEntry?.verdict === 'incorrect' ? 'Unmark — remove incorrect flag' : 'Mark — system was wrong/buggy'}
            >
              <span className="text-sm font-bold">{verifiedEntry?.verdict === 'incorrect' ? '✗' : '✗'}</span>
            </button>
          )}
          {/* Dismiss button */}
          {!isDismissed && (
            <button
              onClick={() => onDismissError(event, error.message, error)}
              disabled={isLoading}
              className="px-2.5 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors font-medium disabled:opacity-50"
              title="Dismiss with optional note"
            >
              {isLoading ? '...' : '✓ OK'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title, badge, activeErrors, dismissedErrors, bgColor, textColor) => {
    const showActive = showActiveErrors && activeErrors.length > 0;
    const showDismissed = showDismissedErrors && dismissedErrors.length > 0;
    if (!showActive && !showDismissed) return null;
    return (
      <div className="mt-2">
        <div className={`text-xs font-semibold ${textColor} mb-1 flex items-center gap-1`}>
          <span className={`${bgColor} text-white px-1.5 py-0.5 rounded text-[10px]`}>{badge}</span>
          {title}
        </div>
        <div className="space-y-1">
          {showActiveErrors && activeErrors.map(error => renderErrorRow(error, false))}
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
        {/* Data Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'data_error') &&
          renderSection('Data Errors (Wrong Info):', 'HIGH', activeDataErrors, dismissedDataErrors, 'bg-red-500', 'text-red-700')}

        {/* Formatting Errors + Description Issues */}
        {(selectedCategory === 'all' || selectedCategory === 'formatting') && (() => {
          const hasFormatActive = showActiveErrors && (activeFormattingErrors.length > 0 || hasDescriptionIssue);
          const hasFormatDismissed = showDismissedErrors && dismissedFormattingErrors.length > 0;
          if (!hasFormatActive && !hasFormatDismissed) return null;
          return (
            <div className="mt-2">
              <div className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
                <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">FORMAT</span>
                Missing/Incomplete Info:
              </div>
              <div className="space-y-1">
                {showActiveErrors && hasDescriptionIssue && (() => {
                  const descMsg = `description:${event.description_status}`;
                  const descVerified = isErrorVerified(verified, descMsg);
                  return (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg border-l-4 border-orange-400 bg-orange-50">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">
                          {event.description_status === 'none' ? '⚠️' : '📸'}
                          {' '}
                          <strong className="text-xs">
                            {event.description_status === 'none' ? 'No Description' : 'Flyer Only (no text)'}
                          </strong>
                        </span>
                        <span className="text-xs block text-gray-600 mt-0.5">
                          {event.description_status === 'none' ? 'Event has no description text or flyer image' : 'Event has a flyer image but no text description'}
                        </span>
                        {descVerified && (
                          <span className={`text-xs block mt-0.5 ${descVerified.verdict === 'incorrect' ? 'text-red-600' : 'text-green-600'}`}>
                            <span className={`px-1 rounded text-[10px] ${descVerified.verdict === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {descVerified.verdict === 'incorrect' ? '✗ incorrect' : '✓ verified'}
                            </span>
                            <span className="text-gray-400 ml-1">({new Date(descVerified.verified_at).toLocaleDateString()})</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1.5">
                        {onVerifyError && (
                          <button
                            onClick={() => onVerifyError(event, descMsg, descVerified?.verdict === 'correct' ? null : 'correct', null)}
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              descVerified?.verdict === 'correct'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'bg-white border-gray-400 hover:border-green-500 hover:bg-green-50 text-gray-300 hover:text-green-500'
                            }`}
                            title={descVerified?.verdict === 'correct' ? 'Uncheck — remove verification' : 'Check — verified this is a real issue'}
                          >
                            <span className="text-sm font-bold">{descVerified?.verdict === 'correct' ? '✓' : '☐'}</span>
                          </button>
                        )}
                        {onVerifyError && (
                          <button
                            onClick={() => onVerifyError(event, descMsg, descVerified?.verdict === 'incorrect' ? null : 'incorrect', null)}
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              descVerified?.verdict === 'incorrect'
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'bg-white border-gray-400 hover:border-red-500 hover:bg-red-50 text-gray-300 hover:text-red-500'
                            }`}
                            title={descVerified?.verdict === 'incorrect' ? 'Unmark — remove incorrect flag' : 'Mark — system was wrong/buggy'}
                          >
                            <span className="text-sm font-bold">{descVerified?.verdict === 'incorrect' ? '✗' : '✗'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {showActiveErrors && activeFormattingErrors.map(error => renderErrorRow(error, false))}
                {showDismissedErrors && dismissedFormattingErrors.map(error => renderErrorRow(error, true))}
              </div>
            </div>
          );
        })()}

        {/* Status Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'status') &&
          renderSection('Status:', 'INFO', activeStatusErrors, dismissedStatusErrors, 'bg-blue-500', 'text-blue-700')}
      </div>
    </div>
  );
}
