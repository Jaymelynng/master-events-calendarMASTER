// ============================================================================
// EVENT DETAIL PANEL - Slide-out panel showing full event details
// ============================================================================
import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Clock, Users, Copy, CheckCircle } from 'lucide-react';
import { theme, getEventTypeColor, getErrorLabel } from './constants';
import { parseYmdLocal, formatTime, formatTimeShort, parseCampOptionFromTitle } from './utils';
import { isErrorAcknowledgedAnywhere, inferErrorCategory, canAddAsRule, extractRuleValue } from '../../lib/validationHelpers';
import { appConfigApi, errorEmailLogApi } from '../../lib/api';
import { buildErrorEmailUrl, fmtSentStamp, descriptionIssueLine } from '../../lib/errorEmail';
import IclassSetupSection from './IclassSetupSection';

const PANEL_DEFAULT_WIDTH = 384; // the panel's width before it could be resized (w-96)
const PANEL_MIN_WIDTH = 320;

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
  // Panel width: drag the left edge to resize; remembered on this browser. Double-click the edge to reset.
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = parseInt(window.localStorage.getItem('eventPanelWidth'), 10);
      return saved >= PANEL_MIN_WIDTH ? saved : PANEL_DEFAULT_WIDTH;
    } catch { return PANEL_DEFAULT_WIDTH; }
  });
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const move = (ev) => {
      const w = Math.max(PANEL_MIN_WIDTH, Math.min(window.innerWidth * 0.95, startW + (startX - ev.clientX)));
      setPanelWidth(Math.round(w));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPanelWidth((w) => { try { window.localStorage.setItem('eventPanelWidth', String(w)); } catch { /* private mode */ } return w; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const resetWidth = () => {
    setPanelWidth(PANEL_DEFAULT_WIDTH);
    try { window.localStorage.removeItem('eventPanelWidth'); } catch { /* private mode */ }
  };
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
  const hasSchedule = Array.isArray(event.daily_schedule) && event.daily_schedule.length > 0;

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
      className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out"
      style={{ width: `min(${panelWidth}px, 100vw)`, borderLeft: `4px solid ${theme.colors.primary}` }}
    >
      {/* Drag handle on the left edge - resize the panel; double-click resets */}
      <div
        onPointerDown={startResize}
        onDoubleClick={resetWidth}
        title="Drag to resize · double-click to reset"
        className="group absolute top-0 h-full z-20 flex items-center justify-center"
        style={{ left: -10, width: 16, cursor: 'col-resize', touchAction: 'none' }}
      >
        <div
          className="rounded-full shadow-md transition-all group-hover:scale-y-110"
          style={{ width: 8, height: 56, background: theme.colors.primary, boxShadow: '0 2px 6px rgba(0,0,0,.3)' }}
        />
      </div>
      <div className="h-full overflow-y-auto">
      {/* Header with close button */}
      <div className="sticky top-0 z-10 bg-white border-b p-4 flex items-center justify-between" style={{ borderColor: theme.colors.primary }}>
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
        />

        {/* (hasSchedule: a camp with a per-weekday schedule from iClass) */}
        {/* Event Details - raised tiles that wrap to the panel width; the daily schedule is a wide
            tile in the same dashboard (it is time information), filling the room beside Ages */}
        <div
          className="mb-4 rounded-2xl p-3 flex flex-wrap gap-2.5"
          style={{
            background: '#f1ece4',
            boxShadow: '0 8px 25px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.10)',
          }}
        >
          <DetailTile icon={<MapPin className="w-4 h-4" />} label="Location">
            {gymsList.find(g => g.gym_code === event.gym_code || g.id === event.gym_id)?.name ||
             event.gym_name || event.gym_code}
          </DetailTile>
          <DetailTile icon={<Calendar className="w-4 h-4" />} label="Date">
            {parseYmdLocal(event.start_date || event.date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            })}
            {event.end_date && event.end_date !== (event.start_date || event.date) && (
              <>
                {' – '}
                {parseYmdLocal(event.end_date).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric'
                })}
              </>
            )}
          </DetailTile>
          {/* Time tile only when there is no daily schedule - the schedule chips already show every day's hours */}
          {!hasSchedule && (
            <DetailTile icon={<Clock className="w-4 h-4" />} label="Time">
              {formatTime(event.time || event.event_time) || '—'}
              <SignupMode event={event} />
            </DetailTile>
          )}
          {(event.age_min || event.age_max) && (
            <DetailTile icon={<Users className="w-4 h-4" />} label="Ages">
              {event.age_min && event.age_max
                ? `${event.age_min} – ${event.age_max} years`
                : event.age_min
                  ? `${event.age_min}+ years`
                  : `Up to ${event.age_max} years`}
            </DetailTile>
          )}
          {/* Daily Schedule — per-weekday hours for camps; a mis-set day shows solid red */}
          {hasSchedule && (
            <DailySchedule days={event.daily_schedule} event={event} />
          )}
        </div>

        {/* Availability Status */}
        {(event.has_openings === false || event.openings != null || event.registration_end_date) && (
          <AvailabilityStatus event={event} />
        )}

        {/* iClass setup — what the signed-in setup read saved for this camp */}
        <IclassSetupSection event={event} />

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
    </div>
  );
}

// Daily schedule tile (inside the Event Details dashboard) — one chip per weekday. Highlights any day whose
// hours differ from the majority (a mis-set day like Monday at 1hr while the
// rest run 3hr) so a settings mistake beyond day 1 is impossible to miss.
function DailySchedule({ days, event }) {
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
    <div
      className="rounded-xl bg-white px-3 py-2"
      style={{ flex: '2 1 260px', boxShadow: '0 3px 10px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.08)' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-1 mb-1.5">
        <span className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#2f6f72' }}>📅 Daily schedule</span>
          <SignupMode event={event} inline />
        </span>
        {anyOddDay && (
          <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#c62828' }}>
            ⚠️ A day doesn't match the rest
          </span>
        )}
      </div>
      {/* day chips centered in the tile - one day sits in the middle, a full week fills the row */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {days.map((d, i) => {
          const isOdd = anyOddDay && majority && hoursOf(d) !== majority;
          return (
            <div
              key={i}
              className="rounded-lg px-2.5 py-1.5 text-center"
              style={{
                background: isOdd ? '#c62828' : '#f1ece4',
                color: isOdd ? '#ffffff' : '#1f2a33',
                boxShadow: '0 2px 0 rgba(0,0,0,.12)',
                minWidth: 70,
              }}
              title={d.duration != null && d.duration !== '' ? `${d.duration} hr` : undefined}
            >
              <div className="text-xs font-extrabold uppercase">{d.day || `Day ${i + 1}`}</div>
              <div className="text-xs font-semibold whitespace-nowrap">
                {(d.start_time || '—').replace(/:00 /g, ' ')}–{(d.end_time || '').replace(/:00 /g, ' ')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Camp sign-up mode badge (only for CAMPs that have the setting): per-day vs full week.
function SignupMode({ event, inline }) {
  if (!event || event.type !== 'CAMP' || event.allow_choose_days == null) return null;
  const badge = (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white whitespace-nowrap"
      style={{ background: event.allow_choose_days ? '#1d4ed8' : '#6d28d9', boxShadow: '0 2px 0 rgba(0,0,0,.25)' }}
      title={event.allow_choose_days ? 'Parents can register for individual days' : 'Parents must register for the entire camp'}
    >
      {event.allow_choose_days ? '✓ Per-day sign-up' : '📦 Full week only'}
    </span>
  );
  return inline ? badge : <div className="mt-1.5">{badge}</div>;
}

// One raised tile in the Event Details grid: small teal label + icon, near-black value.
function DetailTile({ icon, label, children }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2" style={{ flex: '1 1 150px', boxShadow: '0 3px 10px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.08)' }}>
      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide" style={{ color: '#2f6f72' }}>
        {icon}{label}
      </div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: '#1f2a33' }}>{children}</div>
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

  // Registration close date as 11/6/2026 (read as a local date - new Date('2026-11-06') would be UTC
  // and land on the previous day in US time zones)
  const regEnd = event.registration_end_date ? String(event.registration_end_date).slice(0, 10) : null;
  let regLabel = null;
  let regPassed = false;
  if (regEnd) {
    const [y, m, d] = regEnd.split('-').map(Number);
    regLabel = `${m}/${d}/${y}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    regPassed = new Date(y, m - 1, d) < today;
  }

  const tone = isFull
    ? { bg: '#c62828', fg: '#ffffff' }
    : isLow
      ? { bg: '#fff1e0', fg: '#9a3412' }
      : { bg: '#e7f5ec', fg: '#14532d' };

  return (
    <div
      className="mb-4 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2"
      style={{ background: tone.bg, color: tone.fg, boxShadow: '0 6px 18px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.08)' }}
    >
      <div>
        {isFull && <div className="text-lg font-extrabold">🔴 SOLD OUT</div>}
        {!isFull && hasCount && (
          <div className="text-lg font-extrabold">
            {isLow ? '⚠️' : '🟢'} {count} {count === 1 ? 'spot' : 'spots'} remaining
          </div>
        )}
        {!isFull && !hasCount && <div className="text-base font-bold">Spots not shown by iClass</div>}
        {event.show_openings === false && (
          <div className="text-xs font-semibold italic mt-0.5">Internal — gym hides this count from parents</div>
        )}
      </div>
      {regLabel && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap"
          style={{ background: regPassed ? '#7f1d1d' : '#2f6f72', color: '#ffffff', boxShadow: '0 2px 0 rgba(0,0,0,.25)' }}
        >
          {regPassed ? 'Registration closed' : 'Registration closes'} {regLabel}
        </span>
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
function RegistrationOptions({ event, copiedUrl, onCopyUrl }) {
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
                      {formatTimeShort(option.time)}
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
        // Single option - two equal buttons side by side (was three full-width stacked buttons,
        // incl. an Edit Event button Jayme does not want in this panel)
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              const url = event.event_url || event.registration_url;
              if (url) window.open(url, '_blank');
            }}
            className="flex-1 text-white font-bold text-sm py-2.5 px-3 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5 whitespace-nowrap"
            style={{ backgroundColor: theme.colors.primary, boxShadow: '0 3px 0 rgba(0,0,0,.25), 0 6px 14px rgba(0,0,0,.15)' }}
          >
            🔗 View Event Page
          </button>
          <button
            onClick={() => {
              const url = event.event_url || event.registration_url;
              if (url) copyToClipboard(url, event.id);
            }}
            className="flex-1 font-bold text-sm py-2.5 px-3 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5 whitespace-nowrap"
            style={copiedUrl === event.id
              ? { background: '#2e7d4f', color: '#fff', boxShadow: '0 3px 0 rgba(0,0,0,.25), 0 6px 14px rgba(0,0,0,.15)' }
              : { background: '#2f6f72', color: '#fff', boxShadow: '0 3px 0 rgba(0,0,0,.25), 0 6px 14px rgba(0,0,0,.15)' }}
          >
            {copiedUrl === event.id
              ? (<><CheckCircle className="w-4 h-4" /> Copied!</>)
              : (<><Copy className="w-4 h-4" /> Copy Link</>)}
          </button>
        </div>
      )}
    </div>
  );
}
