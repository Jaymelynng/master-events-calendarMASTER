// ============================================================================
// EVENT DETAIL PANEL - Slide-out panel showing full event details
// ============================================================================
import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, DollarSign, Users, Copy, CheckCircle } from 'lucide-react';
import { theme, getEventTypeColor, getErrorLabel } from './constants';
import { parseYmdLocal, formatTime, formatTimeShort, parseCampOptionFromTitle } from './utils';
import { isErrorAcknowledgedAnywhere, inferErrorCategory, canAddAsRule, extractRuleValue } from '../../lib/validationHelpers';
import { appConfigApi, errorEmailLogApi } from '../../lib/api';
import { buildErrorEmailUrl, fmtSentStamp, descriptionIssueLine } from '../../lib/errorEmail';

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
  acknowledgedPatterns = [],
  eventTypes = []
}) {
  // Contacts + notification settings for the "Email the Gym" button, and the
  // send history so an already-emailed error shows "Emailed N days ago".
  const [appConfig, setAppConfig] = useState({});
  const [emailLog, setEmailLog] = useState([]);
  useEffect(() => {
    appConfigApi.getAll().then(setAppConfig).catch(() => setAppConfig({}));
    errorEmailLogApi.getAll().then(setEmailLog).catch(() => setEmailLog([]));
  }, []);
  const followupDays = parseInt(appConfig.error_email_followup_days, 10) || 3;
  // One send record per EVENT (not per error) — the email covers the whole event.
  const sendsForEvent = (eventId) => emailLog.filter(r => r.event_id === eventId);

  // Open ONE pre-filled email to this gym listing ALL the event's data errors,
  // and record the send against the event.
  const emailEventErrors = (ev, errorLines) => {
    const gym = (gymsList || []).find(g => g.id === ev.gym_id) || {};
    const cc = (appConfig.error_email_cc || '').trim();
    const fromName = appConfig.error_email_from_name || 'Jayme';
    const { url, recipients, summary } = buildErrorEmailUrl({ event: ev, errorLines, gym, cc, fromName });
    if (!url) {
      alert(`No email on file for ${ev.gym_id}. Add the manager / front desk email in the Contacts tab (Admin) first.`);
      return;
    }
    window.open(url, '_blank');
    const optimistic = {
      id: `tmp-${ev.id}-${Date.now()}`,
      event_id: ev.id, gym_id: ev.gym_id, event_title: ev.title || null,
      error_message: summary, recipients: recipients.join('; '), cc: cc || null,
      sent_at: new Date().toISOString(),
    };
    setEmailLog(prev => [optimistic, ...prev]);
    errorEmailLogApi.log({
      event_id: ev.id, gym_id: ev.gym_id, event_title: ev.title,
      error_message: summary, recipients: recipients.join('; '), cc,
    }).then(saved => setEmailLog(prev => [saved, ...prev.filter(r => r.id !== optimistic.id)]))
      .catch(() => {});
  };

  if (!event) return null;

  // Get validation status — rules apply everywhere (per-event + patterns)
  const acknowledgedErrors = event.acknowledged_errors || [];
  const activeErrors = (event.validation_errors || []).filter(
    error => error.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(event, error.message, acknowledgedPatterns)
  );
  const hasDescriptionIssue = event.description_status === 'flyer_only' || event.description_status === 'none';

  // Separate errors by category
  const dataErrors = activeErrors.filter(e => inferErrorCategory(e) === 'data_error');
  const statusErrors = activeErrors.filter(e => inferErrorCategory(e) === 'status');

  const totalIssues = activeErrors.length + (hasDescriptionIssue ? 1 : 0);

  // Handler for dismissing - opens the custom modal
  const handleDismissWithNote = (errorMessage, errorObj = null) => {
    const gymId = event?.gym_id || '';
    const ruleEligible = errorObj ? canAddAsRule(errorObj.type) : false;
    const ruleInfo = errorObj ? extractRuleValue(errorObj, event) : null;
    const eventType = event?.type || event?.event_type || 'CAMP';
    onDismissError({ eventId: event.id, errorMessage, errorObj, gymId, ruleEligible, ruleInfo, eventType });
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
              backgroundColor: getEventTypeColor(event.type || event.event_type, eventTypes),
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

        {/* Registration Options — moved to top of panel (was at bottom) so
            the register/copy buttons are immediately accessible without
            scrolling past the description, flyer, etc. */}
        <RegistrationOptions
          event={event}
          copiedUrl={copiedUrl}
          onCopyUrl={onCopyUrl}
          onEditEvent={onEditEvent}
        />

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
              {/* Camp signup mode — inline tag under price (only for CAMPs that have data) */}
              {event.type === 'CAMP' && event.allow_choose_days != null && (
                <div className="mt-1">
                  {event.allow_choose_days ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200" title="Parents can register for individual days">
                      ✓ Per-Day Signup
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200" title="Parents must register for the entire camp">
                      📦 Full Week Only
                    </span>
                  )}
                </div>
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

        {/* Daily Schedule — per-weekday hours for camps (shows when iClass
            gives a multi-day schedule; makes a single mis-set day obvious) */}
        {Array.isArray(event.daily_schedule) && event.daily_schedule.length > 0 && (
          <DailySchedule days={event.daily_schedule} />
        )}

        {/* Camp Quick Access Links */}
        {event.type === 'CAMP' && (
          <CampQuickAccess event={event} gymLinks={gymLinks} />
        )}

        {/* Availability Status */}
        {(event.has_openings === false || event.openings != null || event.registration_end_date) && (
          <AvailabilityStatus event={event} />
        )}

        {/* Validation Issues */}
        {(totalIssues > 0 || acknowledgedErrors.length > 0) && (
          <ValidationIssues
            event={event}
            activeErrors={activeErrors}
            dataErrors={dataErrors}
            statusErrors={statusErrors}
            hasDescriptionIssue={hasDescriptionIssue}
            totalIssues={totalIssues}
            acknowledgedErrors={acknowledgedErrors}
            onDismiss={handleDismissWithNote}
            onResetAcknowledged={() => onResetAcknowledgedErrors(event.id)}
            isMatchedByRule={isMatchedByRule}
            onEmailEvent={(lines) => emailEventErrors(event, lines)}
            eventSends={sendsForEvent(event.id)}
            followupDays={followupDays}
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

        {/* (Registration Options moved to the top of the panel —
             see right after Event Title above.) */}
      </div>
    </div>
  );
}

// Daily schedule component — one row per weekday. Highlights any day whose
// hours differ from the majority (a mis-set day like Monday at 1hr while the
// rest run 3hr) so a settings mistake beyond day 1 is impossible to miss.
function DailySchedule({ days }) {
  // Build an "hours" key per day to detect the odd one out.
  const hoursOf = (d) => {
    if (d.duration != null && d.duration !== '') return String(d.duration);
    if (d.start_time && d.end_time) return `${d.start_time}-${d.end_time}`;
    return '';
  };
  // Find the majority hours value; anything different gets flagged.
  const counts = {};
  days.forEach(d => { const k = hoursOf(d); if (k) counts[k] = (counts[k] || 0) + 1; });
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const anyOddDay = days.length > 1 && Object.keys(counts).length > 1;

  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      <div className="font-semibold text-xs text-gray-500 uppercase mb-2 flex items-center justify-between">
        <span>📅 Daily Schedule</span>
        {anyOddDay && (
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded normal-case">
            ⚠️ A day doesn't match the rest
          </span>
        )}
      </div>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {days.map((d, i) => {
          const isOdd = anyOddDay && majority && hoursOf(d) !== majority;
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-1.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
              style={isOdd ? { background: '#fef2f2' } : {}}
            >
              <span className={`font-medium ${isOdd ? 'text-red-800' : 'text-gray-700'}`}>
                {d.day || `Day ${i + 1}`}
              </span>
              <span className={isOdd ? 'text-red-800 font-semibold' : 'text-gray-600'}>
                {d.start_time || '—'}{d.end_time ? ` – ${d.end_time}` : ''}
                {d.duration != null && d.duration !== '' && (
                  <span className="text-xs text-gray-400 ml-1.5">({d.duration} hr)</span>
                )}
              </span>
            </div>
          );
        })}
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
  const hasCount = event.openings != null;
  const count = event.openings;
  // Color thresholds: 0 = red (treated as sold out), 1-3 = orange (almost full), 4+ = green
  const isLow = hasCount && count > 0 && count <= 3;
  const isFull = event.has_openings === false || count === 0;

  return (
    <div className="border-t pt-4 mb-4" style={{ borderColor: theme.colors.secondary }}>
      {isFull && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-2">
          <div className="font-bold text-red-800 flex items-center gap-2">
            🔴 SOLD OUT
          </div>
          <div className="text-sm text-red-700 mt-1">
            This event is full - no spots available
          </div>
        </div>
      )}
      {!isFull && hasCount && (
        <div className={`border rounded-lg p-3 mb-2 ${isLow ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
          <div className={`font-bold flex items-center gap-2 ${isLow ? 'text-orange-800' : 'text-green-800'}`}>
            {isLow ? '⚠️' : '🟢'} {count} {count === 1 ? 'spot' : 'spots'} remaining
            {event.openings_display && !/\d/.test(event.openings_display) && (
              <span className="text-xs font-normal opacity-70 ml-1">({event.openings_display})</span>
            )}
          </div>
          {event.show_openings === false && (
            <div className={`text-xs mt-1 ${isLow ? 'text-orange-700' : 'text-green-700'} italic`}>
              (Internal — gym hides this count from public)
            </div>
          )}
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
  statusErrors,
  hasDescriptionIssue,
  totalIssues,
  acknowledgedErrors,
  onDismiss,
  onResetAcknowledged,
  isMatchedByRule,
  onEmailEvent,
  eventSends = [],
  followupDays = 3
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

          {/* ONE email for the whole event — lists every data error AND a
              missing-description issue. (Not one email per error — Jayme.) The
              + Rule buttons stay per-error above. */}
          {(dataErrors.length > 0 || hasDescriptionIssue) && onEmailEvent && (() => {
            const emailed = eventSends.length > 0;
            const stamp = emailed ? fmtSentStamp(eventSends[0].sent_at) : null;
            const overdue = stamp && stamp.days >= followupDays;
            const descLine = hasDescriptionIssue ? descriptionIssueLine(event.description_status) : null;
            const lines = [
              ...dataErrors.map(e => `${getErrorLabel(e.type)}: ${e.message}`),
              ...(descLine ? [descLine] : []),
            ];
            return (
              <div className="mt-3">
                <button
                  onClick={() => onEmailEvent(lines)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                  style={{ background: !emailed ? '#2563eb' : overdue ? '#d97706' : '#6b7280' }}
                  title={emailed ? 'Send another email about this event — not fixed yet' : 'Email this gym’s manager + front desk about all the issues on this event'}
                >
                  {emailed
                    ? '📧 Send follow-up email'
                    : `📧 Email the Gym${dataErrors.length > 1 ? ` (all ${dataErrors.length} issues)` : ''}`}
                </button>
                {emailed && (
                  <div className="mt-1 text-[11px] font-semibold flex items-center gap-1 flex-wrap"
                       style={{ color: overdue ? '#b45309' : '#6b7280' }}>
                    <span>📧 Emailed {stamp.dateStr} · {stamp.ago}</span>
                    {eventSends.length > 1 && <span>· {eventSends.length} emails sent</span>}
                    {overdue && <span className="font-black">· follow-up overdue</span>}
                  </div>
                )}
              </div>
            );
          })()}

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
            <span className="flex items-center gap-2">✓ Accepted ({acknowledgedErrors.length})</span>
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
                      Accepted on {dismissedAt}
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
          {title.includes('Data') ? 'HIGH PRIORITY' : 'INFO'}
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
              onClick={(e) => { e.stopPropagation(); onDismiss(error.message, error); }}
              className="flex-shrink-0 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-md transition-colors font-medium"
              title="Create a custom rule for this"
            >
              ＋ Rule
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
