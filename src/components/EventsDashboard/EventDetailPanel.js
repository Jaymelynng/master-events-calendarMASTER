// ============================================================================
// EVENT DETAIL PANEL - Slide-out panel showing full event details
// ============================================================================
import React from 'react';
import { MapPin, Calendar, Clock, DollarSign, Users, Copy, CheckCircle } from 'lucide-react';
import { theme, getEventTypeColor, getErrorLabel } from './constants';
import { parseYmdLocal, formatTime, formatTimeShort, parseCampOptionFromTitle } from './utils';
import { isErrorAcknowledgedAnywhere, inferErrorCategory, canAddAsRule, extractRuleValue } from '../../lib/validationHelpers';

export default function EventDetailPanel({
  event,
  gymsList,
  gymLinks,
  copiedUrl,
  onClose,
  onCopyUrl,
  onEditEvent,
  onDismissError,
  onResetAcknowledgedErrors,
  isMatchedByRule,
  acknowledgedPatterns = []
}) {
  if (!event) return null;

  // Get validation status — rules apply everywhere (per-event + patterns)
  const acknowledgedErrors = event.acknowledged_errors || [];
  const activeErrors = (event.validation_errors || []).filter(
    error => error.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(event, error.message, acknowledgedPatterns)
  );
  const hasDescriptionIssue = event.description_status === 'flyer_only' || event.description_status === 'none';

  // Separate errors by category
  const dataErrors = activeErrors.filter(e => inferErrorCategory(e) === 'data_error');
  const formattingErrors = activeErrors.filter(e => inferErrorCategory(e) === 'formatting');
  const statusErrors = activeErrors.filter(e => inferErrorCategory(e) === 'status');

  const totalIssues = activeErrors.length + (hasDescriptionIssue ? 1 : 0);

  // Handler for dismissing - opens the custom modal
  const handleDismissWithNote = (errorMessage, errorObj = null) => {
    const gymId = event?.gym_id || '';
    const ruleEligible = errorObj ? canAddAsRule(errorObj.type) : false;
    const ruleInfo = errorObj ? extractRuleValue(errorObj, event) : null;
    onDismissError({ eventId: event.id, errorMessage, errorObj, gymId, ruleEligible, ruleInfo });
  };

  return (
    <div
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out"
      style={{ borderLeft: `4px solid ${theme.colors.primary}` }}
    >
      {/* Header with close button */}
      <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between" style={{ borderColor: theme.colors.primary }}>
        <h3 className="font-bold text-lg" style={{ color: theme.colors.textPrimary }}>Event Details</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all"
          title="Close"
        >
          <span className="text-xl text-gray-600">×</span>
        </button>
      </div>

      <div className="p-6">
        {/* Event Type Badge */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-gray-700 border"
            style={{
              backgroundColor: getEventTypeColor(event.type || event.event_type),
              borderColor: 'rgba(0,0,0,0.1)'
            }}
          >
            {event.type || event.event_type || 'EVENT'}
          </span>
          {event.isGrouped && (
            <span className="text-sm text-gray-600 font-semibold">
              {event.optionCount} options
            </span>
          )}
        </div>

        {/* Event Title */}
        <h4 className="font-bold text-xl mb-4 text-gray-800">
          {event.title || `${event.type || event.event_type} Event`}
        </h4>

        {/* Event Details */}
        <div className="space-y-3 mb-6 text-sm text-gray-700">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Location</div>
              <div>
                {gymsList.find(g => g.gym_code === event.gym_code || g.id === event.gym_id)?.name ||
                 event.gym_name || event.gym_code}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Date</div>
              <div>
                {parseYmdLocal(event.start_date || event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {event.end_date && event.end_date !== (event.start_date || event.date) && (
                  <span className="text-gray-500">
                    {' – '}
                    {parseYmdLocal(event.end_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Time</div>
              <div>{formatTime(event.time || event.event_time) || ''}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Price</div>
              {event.price ? (
                <div className="font-bold text-lg" style={{ color: theme.colors.primary }}>${event.price}</div>
              ) : (
                <div className="text-sm text-gray-500 italic">Price not in event details</div>
              )}
            </div>
          </div>

          {/* Age Range */}
          {(event.age_min || event.age_max) && (
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="font-semibold text-xs text-gray-500 uppercase mb-1">Ages</div>
                <div>
                  {event.age_min && event.age_max
                    ? `${event.age_min} - ${event.age_max} years`
                    : event.age_min
                      ? `${event.age_min}+ years`
                      : `Up to ${event.age_max} years`
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Camp Quick Access Links */}
        {event.type === 'CAMP' && (
          <CampQuickAccess event={event} gymLinks={gymLinks} />
        )}

        {/* Availability Status */}
        {(event.has_openings === false || event.registration_end_date) && (
          <AvailabilityStatus event={event} />
        )}

        {/* Validation Issues */}
        {(totalIssues > 0 || acknowledgedErrors.length > 0) && (
          <ValidationIssues
            event={event}
            activeErrors={activeErrors}
            dataErrors={dataErrors}
            formattingErrors={formattingErrors}
            statusErrors={statusErrors}
            hasDescriptionIssue={hasDescriptionIssue}
            totalIssues={totalIssues}
            acknowledgedErrors={acknowledgedErrors}
            onDismiss={handleDismissWithNote}
            onResetAcknowledged={() => onResetAcknowledgedErrors(event.id)}
            isMatchedByRule={isMatchedByRule}
          />
        )}

        {/* Description */}
        {event.description && (
          <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
            <div className="font-semibold text-xs text-gray-500 uppercase mb-2">Description</div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </div>
          </div>
        )}

        {/* Flyer Image */}
        {event.flyer_url && (
          <FlyerImage event={event} />
        )}

        {/* Registration Options */}
        <RegistrationOptions
          event={event}
          copiedUrl={copiedUrl}
          onCopyUrl={onCopyUrl}
          onEditEvent={onEditEvent}
        />
      </div>
    </div>
  );
}

// Camp quick access links component
function CampQuickAccess({ event, gymLinks }) {
  const gymId = event.gym_id;
  const fullDayLink = gymLinks.find(gl => gl.gym_id === gymId && gl.link_type_id === 'camps');
  const halfDayLink = gymLinks.find(gl => gl.gym_id === gymId && gl.link_type_id === 'camps_half');

  if (!fullDayLink && !halfDayLink) return null;

  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      <p className="font-semibold text-xs text-gray-500 uppercase mb-3">🔗 Quick Access</p>
      <div className="flex gap-2">
        {fullDayLink && (
          <button
            onClick={() => window.open(fullDayLink.url, '_blank')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200 hover:border-orange-400 transition-all hover:scale-105"
            title="View all Full Day camps at this gym"
          >
            <span className="text-2xl">🏕️</span>
            <span className="font-semibold text-sm text-orange-800">Full Day</span>
          </button>
        )}
        {halfDayLink && (
          <button
            onClick={() => window.open(halfDayLink.url, '_blank')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-400 transition-all hover:scale-105"
            title="View all Half Day camps at this gym"
          >
            <span className="text-2xl">🕐</span>
            <span className="font-semibold text-sm text-blue-800">Half Day</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Availability status component
function AvailabilityStatus({ event }) {
  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      {event.has_openings === false && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-2">
          <div className="font-bold text-red-800 flex items-center gap-2">
            🔴 SOLD OUT
          </div>
          <div className="text-sm text-red-700 mt-1">
            This event is full - no spots available
          </div>
        </div>
      )}
      {event.registration_end_date && (
        <div className="text-xs text-gray-600">
          <span className="font-semibold">Registration closes:</span> {event.registration_end_date}
          {(() => {
            const regEnd = new Date(event.registration_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (regEnd < today) {
              return <span className="ml-2 text-red-600 font-medium">(Registration closed)</span>;
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}

// Validation issues component
function ValidationIssues({
  event,
  activeErrors,
  dataErrors,
  formattingErrors,
  statusErrors,
  hasDescriptionIssue,
  totalIssues,
  acknowledgedErrors,
  onDismiss,
  onResetAcknowledged,
  isMatchedByRule
}) {
  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      {/* Active Issues */}
      {(activeErrors.length > 0 || hasDescriptionIssue) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <div className="font-semibold text-red-800 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">🚨 Data Issues Detected</span>
            <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-bold">
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''} to fix
            </span>
          </div>

          <ul className="text-sm text-red-700 space-y-2">
            {/* Description Status Issues */}
            {event.description_status === 'none' && (
              <li className="flex items-center gap-2 p-2 bg-red-100 rounded">
                <span>❌ <strong>No description</strong> - Event has no description text</span>
              </li>
            )}
            {event.description_status === 'flyer_only' && (
              <li className="flex items-center gap-2 p-2 bg-yellow-100 rounded">
                <span>⚠️ <strong>Flyer only</strong> - Has image but no text description</span>
              </li>
            )}

            {/* Data Errors */}
            {dataErrors.length > 0 && (
              <ErrorSection
                title="Data Errors (Wrong Info)"
                errors={dataErrors}
                bgColor="bg-red-100"
                borderColor="border-red-500"
                labelBgColor="bg-red-600"
                icon="🚨"
                onDismiss={onDismiss}
              />
            )}

            {/* Formatting Errors */}
            {formattingErrors.length > 0 && (
              <ErrorSection
                title="Missing/Incomplete Info"
                errors={formattingErrors}
                bgColor="bg-orange-50"
                borderColor="border-orange-400"
                labelBgColor="bg-orange-500"
                textColor="text-orange-800"
                icon="⚠️"
                onDismiss={onDismiss}
              />
            )}

            {/* Status Errors */}
            {statusErrors.length > 0 && (
              <ErrorSection
                title="Registration Status"
                errors={statusErrors}
                bgColor="bg-blue-50"
                borderColor="border-blue-400"
                labelBgColor="bg-blue-500"
                textColor="text-blue-800"
                icon="ℹ️"
                onDismiss={onDismiss}
              />
            )}
          </ul>

          {/* Link to fix in iClassPro */}
          {event.event_url && (
            <a
              href={event.event_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              🔗 View Event in iClassPro
            </a>
          )}
        </div>
      )}

      {/* Dismissed Errors with Notes */}
      {acknowledgedErrors.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="font-semibold text-green-800 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">✓ Dismissed Warnings ({acknowledgedErrors.length})</span>
            <button
              onClick={onResetAcknowledged}
              className="text-xs text-red-600 hover:text-red-800 underline"
              title="Restore all dismissed warnings"
            >
              Undo all
            </button>
          </div>

          <ul className="text-sm text-green-700 space-y-1">
            {acknowledgedErrors.map((ack, idx) => {
              const message = typeof ack === 'string' ? ack : ack.message;
              const note = typeof ack === 'object' ? ack.note : null;
              const dismissedAt = typeof ack === 'object' && ack.dismissed_at
                ? new Date(ack.dismissed_at).toLocaleDateString()
                : null;
              const hasPermanentRule = (typeof ack === 'object' && ack.has_rule) ||
                isMatchedByRule(message, event?.gym_id);

              return (
                <li key={`ack-${idx}`} className="p-1.5 bg-green-100 rounded text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-green-600">✓</span>
                    <span className="line-through text-green-600 flex-1">{message}</span>
                    {hasPermanentRule ? (
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold" title="Backed by a permanent rule">
                        📋 Permanent Rule
                      </span>
                    ) : (
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]" title="One-time exception">
                        One-time
                      </span>
                    )}
                  </div>
                  {note && (
                    <div className="mt-1 ml-4 text-green-700 italic bg-green-50 p-1 rounded">
                      📝 Note: {note}
                    </div>
                  )}
                  {dismissedAt && (
                    <div className="ml-4 text-green-500 text-[10px]">
                      Dismissed on {dismissedAt}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Error section component for different error types
function ErrorSection({ title, errors, bgColor, borderColor, labelBgColor, textColor = 'text-red-700', icon, onDismiss }) {
  return (
    <li className="pt-1">
      <div className={`text-xs font-semibold ${textColor} uppercase mb-1 flex items-center gap-1`}>
        <span className={`${labelBgColor} text-white px-1.5 py-0.5 rounded text-[10px]`}>
          {title.includes('Data') ? 'HIGH PRIORITY' : title.includes('Missing') ? 'FORMATTING' : 'INFO'}
        </span>
        {title}:
      </div>
      <ul className="space-y-1 ml-2">
        {errors.map((error, idx) => (
          <li key={idx} className={`flex items-center justify-between gap-2 p-1.5 ${bgColor} rounded border-l-4 ${borderColor} ${textColor}`}>
            <span className="flex-1">
              {icon} <strong>{getErrorLabel(error.type)}</strong>
              <span className="text-xs block mt-0.5 opacity-80">{error.message}</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(error.message, error);
              }}
              className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
              title="Dismiss with optional note"
            >
              ✓ OK
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

// Flyer image component
function FlyerImage({ event }) {
  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      <div className="font-semibold text-xs text-gray-500 uppercase mb-2">🖼️ Event Flyer</div>
      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <img
          src={event.flyer_url}
          alt={`Flyer for ${event.title}`}
          className="w-full h-auto"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Unable to load flyer image</div>';
          }}
        />
      </div>
      <a
        href={event.flyer_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-block"
      >
        Open flyer in new tab →
      </a>
    </div>
  );
}

// Registration options component
function RegistrationOptions({ event, copiedUrl, onCopyUrl, onEditEvent }) {
  const copyToClipboard = (url, id) => {
    navigator.clipboard.writeText(url);
    onCopyUrl(id);
  };

  return (
    <div className="border-t pt-4" style={{ borderColor: theme.colors.secondary }}>
      {event.isGrouped && event.groupedEvents ? (
        // Multiple options
        <div className="space-y-3">
          <p className="font-semibold text-gray-800 mb-3">🔗 View This Event:</p>
          {event.groupedEvents.map((option) => {
            const { icon, label } = parseCampOptionFromTitle(option.title);
            return (
              <div key={option.id} className="flex gap-2 items-center">
                <button
                  onClick={() => window.open(option.event_url, '_blank')}
                  className="flex-1 text-left text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-all hover:scale-102 hover:shadow-md flex items-center gap-2"
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs opacity-90 mt-0.5">
                      {formatTimeShort(option.time)} {option.price && `• $${option.price}`}
                    </span>
                  </span>
                  <span className="text-sm flex-shrink-0">→</span>
                </button>
                <button
                  onClick={() => copyToClipboard(option.event_url, option.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                    copiedUrl === option.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  title="Copy registration link"
                >
                  {copiedUrl === option.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        // Single option
        <div className="space-y-3">
          <button
            onClick={() => {
              const url = event.event_url || event.registration_url;
              if (url) window.open(url, '_blank');
            }}
            className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: theme.colors.primary }}
          >
            🔗 View Event Page
          </button>
          <button
            onClick={() => {
              const url = event.event_url || event.registration_url;
              if (url) copyToClipboard(url, event.id);
            }}
            className={`w-full font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${
              copiedUrl === event.id
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {copiedUrl === event.id ? (
              <>
                <CheckCircle className="w-5 h-5" />
                URL Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copy Registration URL
              </>
            )}
          </button>

          {/* Edit Button */}
          <button
            onClick={() => onEditEvent(event)}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            ✎ Edit Event
          </button>
        </div>
      )}
    </div>
  );
}
