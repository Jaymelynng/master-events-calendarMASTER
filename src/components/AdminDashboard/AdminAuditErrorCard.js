import React, { useState } from 'react';
import { inferErrorCategory, isErrorAcknowledged, matchesAcknowledgedPattern, getAcknowledgmentDetails, getErrorLabel, isErrorVerified, matchesErrorTypeFilter, parsePriceErrorDetails } from '../../lib/validationHelpers';

export default function AdminAuditErrorCard({
  event,
  acknowledgedPatterns = [],
  onDismissError,
  onVerifyError,
  onUndoDismiss,
  onUndoPattern,
  dismissingError,
  statusFilter = 'active',
  selectedCategory = 'all',
  errorTypeFilter = 'all',
  hidePrices = false,
  onUpdateEventPrice,
  onAddCampPrice,
}) {
  // Track which error is being edited for notes
  const [editingNote, setEditingNote] = useState(null); // { message, verdict }
  const [noteText, setNoteText] = useState('');
  const [campPricePicker, setCampPricePicker] = useState(null); // { errorObj, foundPrice }

  const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
  const acknowledged = event.acknowledged_errors || [];
  const verified = event.verified_errors || [];

  // Helper functions
  const isVerifiedAccurate = (msg) => verified.some(v => v.message === msg && v.verdict === 'correct');
  const isMarkedBug = (msg) => verified.some(v => v.message === msg && v.verdict === 'incorrect');

  // Separate by category
  const dataErrors = errors.filter(e => inferErrorCategory(e) === 'data_error');
  const formattingErrors = errors.filter(e => inferErrorCategory(e) === 'formatting');
  const statusErrors = errors.filter(e => inferErrorCategory(e) === 'status');

  // Filter errors based on status filter + error type filter
  const filterByStatus = (errorList) => {
    return errorList.filter(e => {
      // Apply error type filter first
      if (!matchesErrorTypeFilter(e.type, errorTypeFilter, hidePrices)) return false;

      const patternMatch = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, e.message);
      const isDismissed = isErrorAcknowledged(acknowledged, e.message, patternMatch);
      const isVerified = isVerifiedAccurate(e.message);
      const isBug = isMarkedBug(e.message);

      if (statusFilter === 'active') return !isDismissed && !isVerified && !isBug;
      if (statusFilter === 'verified') return isVerified;
      if (statusFilter === 'bugs') return isBug;
      if (statusFilter === 'resolved') return isDismissed;
      return true; // 'all'
    });
  };

  const visibleDataErrors = filterByStatus(dataErrors);
  const visibleFormattingErrors = filterByStatus(formattingErrors);
  const visibleStatusErrors = filterByStatus(statusErrors);

  const isDismissedForError = (e) => {
    const pm = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, e.message);
    return isErrorAcknowledged(acknowledged, e.message, pm);
  };
  // For backwards compat with rendering
  const activeDataErrors = dataErrors.filter(e => !isDismissedForError(e) && !isVerifiedAccurate(e.message) && !isMarkedBug(e.message));
  const activeFormattingErrors = formattingErrors.filter(e => !isDismissedForError(e) && !isVerifiedAccurate(e.message) && !isMarkedBug(e.message));
  const activeStatusErrors = statusErrors.filter(e => !isDismissedForError(e) && !isVerifiedAccurate(e.message) && !isMarkedBug(e.message));
  const dismissedDataErrors = dataErrors.filter(e => isDismissedForError(e));
  const dismissedFormattingErrors = formattingErrors.filter(e => isDismissedForError(e));
  const dismissedStatusErrors = statusErrors.filter(e => isDismissedForError(e));

  const hasDescriptionIssue = event.description_status === 'none' || event.description_status === 'flyer_only';
  const descMsg = `description:${event.description_status}`;
  const descVerified = isVerifiedAccurate(descMsg);
  const descBug = isMarkedBug(descMsg);

  // Calculate totals for display badges
  const totalActive = activeDataErrors.length + activeFormattingErrors.length + activeStatusErrors.length + (hasDescriptionIssue && !descVerified && !descBug ? 1 : 0);
  const totalDismissed = dismissedDataErrors.length + dismissedFormattingErrors.length + dismissedStatusErrors.length;

  // Check if anything is visible based on status filter
  const totalVisible = visibleDataErrors.length + visibleFormattingErrors.length + visibleStatusErrors.length;
  const showDescIssue = hasDescriptionIssue && (errorTypeFilter === 'all' || errorTypeFilter === 'format') && (
    (statusFilter === 'active' && !descVerified && !descBug) ||
    (statusFilter === 'verified' && descVerified) ||
    (statusFilter === 'bugs' && descBug) ||
    statusFilter === 'all'
  );

  if (totalVisible === 0 && !showDescIssue) {
    return null;
  }

  const renderErrorRow = (error, isDismissed = false, patternMatch = false) => {
    const isLoading = dismissingError === `${event.id}-${error.message}`;
    const ackDetails = isDismissed && !patternMatch ? getAcknowledgmentDetails(acknowledged, error.message) : patternMatch ? { note: 'All in program' } : null;
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
                {verifiedEntry.verdict === 'incorrect' ? '✗ bug' : '✓ verified'}
              </span>
              <span className="text-gray-400 ml-1">({new Date(verifiedEntry.verified_at).toLocaleDateString()})</span>
              {verifiedEntry.note && <span className="italic text-gray-600 ml-1">— "{verifiedEntry.note}"</span>}
            </span>
          )}
          {/* Note input when marking as Invalid/Bug - NOTE IS REQUIRED */}
          {editingNote?.message === error.message && (
            <div className="mt-2">
              <div className="text-xs text-red-600 font-medium mb-1">
                ⚠️ Explain what's wrong with the code / what needs fixing:
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g., 'Logic wrong - 9am-12pm is valid half day time' (REQUIRED)"
                  className="flex-1 text-xs px-2 py-1 border border-red-300 rounded focus:outline-none focus:border-red-500 bg-red-50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && noteText.trim()) {
                      onVerifyError(event, error.message, editingNote.verdict, error, noteText);
                      setEditingNote(null);
                      setNoteText('');
                    } else if (e.key === 'Escape') {
                      setEditingNote(null);
                      setNoteText('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (noteText.trim()) {
                      onVerifyError(event, error.message, editingNote.verdict, error, noteText);
                      setEditingNote(null);
                      setNoteText('');
                    }
                  }}
                  disabled={!noteText.trim()}
                  className={`text-xs px-2 py-1 rounded ${noteText.trim() ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  Save Bug
                </button>
                <button
                  onClick={() => {
                    setEditingNote(null);
                    setNoteText('');
                  }}
                  className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {/* Verify Accurate checkbox (green) - saves immediately, no note needed */}
          {onVerifyError && (
            <button
              onClick={() => {
                if (verifiedEntry?.verdict === 'correct') {
                  // Uncheck - remove verification
                  onVerifyError(event, error.message, null, error, null);
                } else {
                  // Save immediately - system was accurate, no note needed
                  onVerifyError(event, error.message, 'correct', error, null);
                }
              }}
              className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                verifiedEntry?.verdict === 'correct'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white border-gray-400 hover:border-green-500 hover:bg-green-50 text-gray-300 hover:text-green-500'
              }`}
              title={verifiedEntry?.verdict === 'correct' ? 'Uncheck — remove verification' : 'Verified Accurate — system caught a real error'}
            >
              <span className="text-sm font-bold">✓</span>
            </button>
          )}
          {/* Invalid/Bug button (red X) - REQUIRES note to explain the bug */}
          {onVerifyError && (
            <button
              onClick={() => {
                if (verifiedEntry?.verdict === 'incorrect') {
                  // Unmark - remove incorrect flag
                  onVerifyError(event, error.message, null, error, null);
                } else {
                  // Show note input - REQUIRED for bugs
                  setEditingNote({ message: error.message, verdict: 'incorrect' });
                  setNoteText(verifiedEntry?.note || '');
                }
              }}
              className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                verifiedEntry?.verdict === 'incorrect'
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-white border-gray-400 hover:border-red-500 hover:bg-red-50 text-gray-300 hover:text-red-500'
              }`}
              title={verifiedEntry?.verdict === 'incorrect' ? 'Unmark — remove bug flag' : 'Invalid/Bug — system was wrong, needs code fix'}
            >
              <span className="text-sm font-bold">✗</span>
            </button>
          )}
          {/* Update Price button for price mismatch errors */}
          {!isDismissed && error.type === 'event_price_mismatch' && onUpdateEventPrice && (() => {
            const priceDetails = parsePriceErrorDetails(error, event);
            if (!priceDetails) return null;
            return (
              <button
                onClick={() => {
                  if (window.confirm(`Update ${event.type} price to $${priceDetails.foundPrice} for ${event.gym_id}?\n\nThis will end-date the current price and create a new entry.`)) {
                    onUpdateEventPrice(event, error, priceDetails.foundPrice);
                  }
                }}
                className="px-2 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors font-medium border border-amber-300"
                title={`Update ${event.type} price to $${priceDetails.foundPrice} in the pricing table`}
              >
                Update to ${priceDetails.foundPrice}
              </button>
            );
          })()}
          {!isDismissed && error.type === 'camp_price_mismatch' && onAddCampPrice && (() => {
            const priceDetails = parsePriceErrorDetails(error, event);
            if (!priceDetails) return null;
            return (
              <button
                onClick={() => setCampPricePicker({ errorObj: error, foundPrice: priceDetails.foundPrice })}
                className="px-2 py-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors font-medium border border-amber-300"
                title={`Add $${priceDetails.foundPrice} as valid camp price for ${event.gym_id}`}
              >
                Add ${priceDetails.foundPrice}
              </button>
            );
          })()}
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
          {/* Undo button for dismissed errors */}
          {isDismissed && (patternMatch ? onUndoPattern : onUndoDismiss) && (
            <button
              onClick={() => patternMatch
                ? onUndoPattern(event.gym_id, event.type, error.message)
                : onUndoDismiss(event, error.message)}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded transition-colors"
              title={patternMatch ? 'Undo program-wide override' : 'Undo dismissal'}
            >
              ↩ Undo
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title, badge, visibleErrors, bgColor, textColor) => {
    if (visibleErrors.length === 0) return null;
    return (
      <div className="mt-2">
        <div className={`text-xs font-semibold ${textColor} mb-1 flex items-center gap-1`}>
          <span className={`${bgColor} text-white px-1.5 py-0.5 rounded text-[10px]`}>{badge}</span>
          {title}
        </div>
        <div className="space-y-1">
          {visibleErrors.map(error => {
            const isDismissed = isDismissedForError(error);
            const patternMatch = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, error.message);
            return renderErrorRow(error, isDismissed, patternMatch);
          })}
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
          renderSection('Data Errors (Wrong Info):', 'HIGH', visibleDataErrors, 'bg-red-500', 'text-red-700')}

        {/* Formatting Errors + Description Issues */}
        {(selectedCategory === 'all' || selectedCategory === 'formatting') && (() => {
          const hasVisibleFormat = visibleFormattingErrors.length > 0 || showDescIssue;
          if (!hasVisibleFormat) return null;
          return (
            <div className="mt-2">
              <div className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
                <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">FORMAT</span>
                Missing/Incomplete Info:
              </div>
              <div className="space-y-1">
                {showDescIssue && (() => {
                  const descVerifiedEntry = isErrorVerified(verified, descMsg);
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
                        {descVerifiedEntry && (
                          <span className={`text-xs block mt-0.5 ${descVerifiedEntry.verdict === 'incorrect' ? 'text-red-600' : 'text-green-600'}`}>
                            <span className={`px-1 rounded text-[10px] ${descVerifiedEntry.verdict === 'incorrect' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {descVerifiedEntry.verdict === 'incorrect' ? '✗ bug' : '✓ verified'}
                            </span>
                            <span className="text-gray-400 ml-1">({new Date(descVerifiedEntry.verified_at).toLocaleDateString()})</span>
                            {descVerifiedEntry.note && <span className="italic text-gray-600 ml-1">— "{descVerifiedEntry.note}"</span>}
                          </span>
                        )}
                        {/* Note input for description issues - REQUIRED for bugs */}
                        {editingNote?.message === descMsg && (
                          <div className="mt-2">
                            <div className="text-xs text-red-600 font-medium mb-1">
                              ⚠️ Explain what's wrong with the code / what needs fixing:
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="e.g., 'Actually has description, detection is wrong' (REQUIRED)"
                                className="flex-1 text-xs px-2 py-1 border border-red-300 rounded focus:outline-none focus:border-red-500 bg-red-50"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && noteText.trim()) {
                                    onVerifyError(event, descMsg, editingNote.verdict, null, noteText);
                                    setEditingNote(null);
                                    setNoteText('');
                                  } else if (e.key === 'Escape') {
                                    setEditingNote(null);
                                    setNoteText('');
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (noteText.trim()) {
                                    onVerifyError(event, descMsg, editingNote.verdict, null, noteText);
                                    setEditingNote(null);
                                    setNoteText('');
                                  }
                                }}
                                disabled={!noteText.trim()}
                                className={`text-xs px-2 py-1 rounded ${noteText.trim() ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                              >
                                Save Bug
                              </button>
                              <button
                                onClick={() => {
                                  setEditingNote(null);
                                  setNoteText('');
                                }}
                                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1.5">
                        {onVerifyError && (
                          <button
                            onClick={() => {
                              if (descVerifiedEntry?.verdict === 'correct') {
                                onVerifyError(event, descMsg, null, null, null);
                              } else {
                                // Save immediately - system was accurate
                                onVerifyError(event, descMsg, 'correct', null, null);
                              }
                            }}
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              descVerifiedEntry?.verdict === 'correct'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'bg-white border-gray-400 hover:border-green-500 hover:bg-green-50 text-gray-300 hover:text-green-500'
                            }`}
                            title={descVerifiedEntry?.verdict === 'correct' ? 'Uncheck — remove verification' : 'Verified Accurate — system caught a real issue'}
                          >
                            <span className="text-sm font-bold">✓</span>
                          </button>
                        )}
                        {onVerifyError && (
                          <button
                            onClick={() => {
                              if (descVerifiedEntry?.verdict === 'incorrect') {
                                onVerifyError(event, descMsg, null, null, null);
                              } else {
                                setEditingNote({ message: descMsg, verdict: 'incorrect' });
                                setNoteText(descVerifiedEntry?.note || '');
                              }
                            }}
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              descVerifiedEntry?.verdict === 'incorrect'
                                ? 'bg-red-500 border-red-500 text-white'
                                : 'bg-white border-gray-400 hover:border-red-500 hover:bg-red-50 text-gray-300 hover:text-red-500'
                            }`}
                            title={descVerifiedEntry?.verdict === 'incorrect' ? 'Unmark — remove bug flag' : 'Invalid/Bug — system was wrong, needs code fix'}
                          >
                            <span className="text-sm font-bold">✗</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {visibleFormattingErrors.map(error => {
                  const isDismissed = isDismissedForError(error);
                  const patternMatch = matchesAcknowledgedPattern(acknowledgedPatterns, event.gym_id, event.type, error.message);
                  return renderErrorRow(error, isDismissed, patternMatch);
                })}
              </div>
            </div>
          );
        })()}

        {/* Status Errors */}
        {(selectedCategory === 'all' || selectedCategory === 'status') &&
          renderSection('Status:', 'INFO', visibleStatusErrors, 'bg-blue-500', 'text-blue-700')}

        {/* Camp Price Picker - shown when user clicks "Add $XX" on a camp_price_mismatch */}
        {campPricePicker && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-xs font-semibold text-amber-800 mb-2">
              What is ${campPricePicker.foundPrice}? Pick a camp price type for {event.gym_id}:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { col: 'full_day_daily', label: 'Full Day Daily' },
                { col: 'full_day_weekly', label: 'Full Day Weekly' },
                { col: 'half_day_daily', label: 'Half Day Daily' },
                { col: 'half_day_weekly', label: 'Half Day Weekly' },
              ].map(opt => (
                <button
                  key={opt.col}
                  onClick={() => {
                    onAddCampPrice(event, campPricePicker.errorObj, campPricePicker.foundPrice, opt.col);
                    setCampPricePicker(null);
                  }}
                  className="px-3 py-1.5 text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-medium transition-colors"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setCampPricePicker(null)}
                className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
