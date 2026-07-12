// ============================================================================
// ADMIN ERRORS COMMAND CENTER
// The one screen that answers "what did the audit catch, and where?"
// Layout: summary strip → horizontal topic tabs → three panels
//   LEFT   = gyms with live error counts (click to focus one gym)
//   MIDDLE = event cards matching the current gym + topic filter
//   RIGHT  = full detail for the selected event: every error, iClass link,
//            dismiss (one-time / all-in-program) and make-permanent-rule flows
// Data source: the same `events` array the calendar renders (validation_errors
// written by the Python engine during sync) — no separate fetch for errors.
// ============================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { acknowledgedPatternsApi, rulesApi, appConfigApi, errorEmailLogApi, verifiedEventsApi } from '../../lib/api';
import { buildErrorEmailUrl, buildBulkGymEmailUrl, fmtSentStamp, descriptionIssueLine } from '../../lib/errorEmail';
import DismissRuleModal from '../EventsDashboard/DismissRuleModal';
import {
  isErrorAcknowledgedAnywhere,
  canAddAsRule,
  extractRuleValue,
  getErrorLabel,
} from '../../lib/validationHelpers';

// Topic groups — same groupings as validationHelpers filter groups
const TOPICS = [
  { id: 'all',         label: 'All',            icon: '🗂️', types: null },
  // NOTE: 'price' topic removed July 1, 2026 — Jayme removed all pricing
  // validation (checks deleted from rules table, stored errors stripped).
  // See database/REMOVED_PRICING_VALIDATION_2026_07_01.sql to restore.
  { id: 'time',        label: 'Time',           icon: '🕐', types: ['time_mismatch'] },
  { id: 'date',        label: 'Dates',          icon: '📅', types: ['date_mismatch', 'day_mismatch', 'year_mismatch', 'impossible_date'] },
  { id: 'age',         label: 'Age',            icon: '👶', types: ['age_mismatch'] },
  // Program = ONE topic in Jayme's head: settings↔text (program_mismatch) AND
  // text↔text (title_desc_mismatch) are two halves of the same question.
  { id: 'program',     label: 'Program',        icon: '🏷️', types: ['program_mismatch', 'missing_program_in_title', 'skill_mismatch', 'title_desc_mismatch'] },
  { id: 'ai',          label: 'AI Review',      icon: '🤖', types: [] }, // special: ai_review_flags (suggestions, own lane)
  { id: 'description', label: 'No Description', icon: '📄', types: [] }, // special: description_status issues
];

const parseYmd = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  const d = parseYmd(s);
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
};

export default function AdminErrorsCenter({ gyms, events }) {
  const [patterns, setPatterns] = useState([]);
  const [gymFilter, setGymFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set()); // multi-select for bulk email
  const [verifiedIds, setVerifiedIds] = useState(new Set()); // Jayme's personal "I checked this" marks
  const [showDismissed, setShowDismissed] = useState(false);
  // Local overlay of acknowledged_errors edits so the UI updates instantly
  // without waiting for the calendar's realtime refresh to reach this prop.
  const [ackOverride, setAckOverride] = useState({}); // { eventId: [acks] }
  const [dismissModal, setDismissModal] = useState(null); // { eventId, errorMessage, errorObj, gymId, eventType, ruleEligible, ruleInfo }

  const [appConfig, setAppConfig] = useState({});
  // Every "Email the Gym" send, newest first. Used to show "you emailed them
  // on X" next to a still-active error and to offer a follow-up.
  const [emailLog, setEmailLog] = useState([]);

  useEffect(() => {
    acknowledgedPatternsApi.getAll().then(setPatterns).catch(() => setPatterns([]));
    appConfigApi.getAll().then(setAppConfig).catch(() => setAppConfig({}));
    errorEmailLogApi.getAll().then(setEmailLog).catch(() => setEmailLog([]));
    verifiedEventsApi.getAll().then(ids => setVerifiedIds(new Set(ids))).catch(() => setVerifiedIds(new Set()));
  }, []);

  // Toggle Jayme's personal "verified" mark on an event (optimistic).
  const toggleVerified = (eventId) => {
    const on = !verifiedIds.has(eventId);
    setVerifiedIds(prev => {
      const n = new Set(prev);
      on ? n.add(eventId) : n.delete(eventId);
      return n;
    });
    verifiedEventsApi.setVerified(eventId, on).catch(() => {
      // revert on failure
      setVerifiedIds(prev => {
        const n = new Set(prev);
        on ? n.delete(eventId) : n.add(eventId);
        return n;
      });
    });
  };

  // How many days before we nudge a follow-up (configurable, no hardcoding).
  const followupDays = parseInt(appConfig.error_email_followup_days, 10) || 3;

  // Send history for a whole EVENT (one email per event, not per error).
  const sendsForEvent = (eventId) => emailLog.filter(r => r.event_id === eventId);

  // Open ONE pre-filled Outlook compose listing ALL the event's errors, and
  // record the send against the event. Sends from Jayme's own Powers account
  // (she's signed into Outlook); she reviews and hits Send.
  const emailEventErrors = (ev, errorLines) => {
    const gym = gyms?.find(g => g.id === ev.gym_id) || {};
    const cc = (appConfig.error_email_cc || '').trim();
    const fromName = appConfig.error_email_from_name || 'Jayme';
    const { url, recipients, summary } = buildErrorEmailUrl({ event: ev, errorLines, gym, cc, fromName });
    if (!url) {
      alert(`No email on file for ${ev.gym_id}. Add the manager / front desk email in the Contacts tab first.`);
      return;
    }
    window.open(url, '_blank');

    const optimistic = {
      id: `tmp-${ev.id}-${Date.now()}`,
      event_id: ev.id,
      gym_id: ev.gym_id,
      event_title: ev.title || null,
      error_message: summary,
      recipients: recipients.join('; '),
      cc: cc || null,
      sent_at: new Date().toISOString(),
    };
    setEmailLog(prev => [optimistic, ...prev]);
    errorEmailLogApi.log({
      event_id: ev.id,
      gym_id: ev.gym_id,
      event_title: ev.title,
      error_message: summary,
      recipients: recipients.join('; '),
      cc,
    }).then(saved => {
      setEmailLog(prev => [saved, ...prev.filter(r => r.id !== optimistic.id)]);
    }).catch(() => {/* keep optimistic row; a refresh will reconcile */});
  };

  // ONE event-level email button + "Emailed N days ago" stamp. `lines` is the
  // formatted "Label: message" list of every error on the event.
  const eventEmailBlock = (ev, lines) => {
    const sends = sendsForEvent(ev.id);
    const emailed = sends.length > 0;
    const stamp = emailed ? fmtSentStamp(sends[0].sent_at) : null;
    const overdue = stamp && stamp.days >= followupDays;
    return (
      <div className="mb-3">
        <button
          onClick={() => emailEventErrors(ev, lines)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 cursor-pointer"
          style={{ background: !emailed ? '#2563eb' : overdue ? '#d97706' : '#6b7280' }}
          title={emailed
            ? 'Send another email about this event — not fixed yet'
            : 'Email this gym’s manager + front desk about all the issues on this event'}
        >
          {emailed
            ? '📧 Send follow-up email'
            : `📧 Email the Gym${lines.length > 1 ? ` (all ${lines.length} issues)` : ''}`}
        </button>
        {emailed && (
          <div className="mt-1.5 text-[11px] font-semibold flex items-center gap-1 flex-wrap"
               style={{ color: overdue ? '#b45309' : '#6b7280' }}>
            <span>📧 Emailed {stamp.dateStr} · {stamp.ago}</span>
            {sends.length > 1 && <span>· {sends.length} emails sent</span>}
            {overdue && <span className="font-black">· follow-up overdue</span>}
          </div>
        )}
      </div>
    );
  };

  // Every issue on an event as "What to update" lines (errors + AI + no-desc).
  const eventIssueLines = (ev) => {
    const lines = (ev.activeErrors || []).map(e => `${getErrorLabel(e.type)}: ${e.message}`);
    (ev.activeAiFlags || []).forEach(f => lines.push(f.message));
    if (ev.descIssue) {
      const d = descriptionIssueLine(ev.description_status);
      if (d) lines.push(d);
    }
    return lines;
  };

  // Bulk email: for the CHECKED events, group by gym and open ONE pre-filled
  // email per gym listing all their events. Logs each send (documents when).
  const emailChecked = (chosen) => {
    if (!chosen || chosen.length === 0) return;
    const cc = (appConfig.error_email_cc || '').trim();
    const fromName = appConfig.error_email_from_name || 'Jayme';
    const byGym = {};
    chosen.forEach(e => { (byGym[e.gym_id] = byGym[e.gym_id] || []).push(e); });
    const optimistic = [];
    Object.entries(byGym).forEach(([gymId, evs]) => {
      const gym = gyms?.find(g => g.id === gymId) || { id: gymId };
      const items = evs.map(e => ({
        title: e.title,
        date: fmtDate(e.start_date || e.date),
        url: e.event_url,
        lines: eventIssueLines(e),
      }));
      const { url, recipients } = buildBulkGymEmailUrl({ gym, items, cc, fromName });
      if (!url) {
        alert(`No email on file for ${gymId}. Add the manager / front desk email in the Contacts tab first.`);
        return;
      }
      window.open(url, '_blank');
      evs.forEach((e, i) => {
        const summary = eventIssueLines(e).join('\n');
        optimistic.push({
          id: `tmp-${e.id}-${i}`, event_id: e.id, gym_id: gymId, event_title: e.title || null,
          error_message: summary, recipients: recipients.join('; '), cc: cc || null,
          sent_at: new Date().toISOString(),
        });
        errorEmailLogApi.log({
          event_id: e.id, gym_id: gymId, event_title: e.title,
          error_message: summary, recipients: recipients.join('; '), cc,
        }).catch(() => {});
      });
    });
    if (optimistic.length) setEmailLog(prev => [...optimistic, ...prev]);
    setCheckedIds(new Set());
  };

  // ── Build the working set: every event with at least one issue ────────────
  const issueEvents = useMemo(() => {
    return (events || [])
      .map(ev => {
        const acks = ackOverride[ev.id] !== undefined ? ackOverride[ev.id] : (ev.acknowledged_errors || []);
        const evWithAcks = { ...ev, acknowledged_errors: acks };
        const allErrors = (ev.validation_errors || []).filter(e => e.type !== 'sold_out');
        const active = allErrors.filter(e => !isErrorAcknowledgedAnywhere(evWithAcks, e.message, patterns));
        const dismissed = allErrors.filter(e => isErrorAcknowledgedAnywhere(evWithAcks, e.message, patterns));
        // AI review suggestions live in their own lane (ai_review_flags) —
        // same dismiss mechanism (acknowledged_errors keyed by message)
        const allAiFlags = ev.ai_review_flags || [];
        const activeAiFlags = allAiFlags.filter(f => !isErrorAcknowledgedAnywhere(evWithAcks, f.message, patterns));
        const dismissedAiFlags = allAiFlags.filter(f => isErrorAcknowledgedAnywhere(evWithAcks, f.message, patterns));
        const descIssue = ev.description_status === 'none' || ev.description_status === 'flyer_only';
        return { ...evWithAcks, activeErrors: active, dismissedErrors: dismissed, activeAiFlags, dismissedAiFlags, descIssue };
      })
      .filter(ev => ev.activeErrors.length > 0 || ev.dismissedErrors.length > 0 || ev.activeAiFlags.length > 0 || ev.dismissedAiFlags.length > 0 || ev.descIssue);
  }, [events, patterns, ackOverride]);

  // ── Topic + gym filtering ──────────────────────────────────────────────────
  const topicMatches = (ev, topicId) => {
    if (topicId === 'all') return ev.activeErrors.length > 0 || ev.activeAiFlags.length > 0 || ev.descIssue || (showDismissed && (ev.dismissedErrors.length > 0 || ev.dismissedAiFlags.length > 0));
    if (topicId === 'description') return ev.descIssue;
    if (topicId === 'ai') return ev.activeAiFlags.length > 0 || (showDismissed && ev.dismissedAiFlags.length > 0);
    const topic = TOPICS.find(t => t.id === topicId);
    const pool = showDismissed ? [...ev.activeErrors, ...ev.dismissedErrors] : ev.activeErrors;
    return pool.some(e => topic?.types?.includes(e.type));
  };

  const gymCounts = useMemo(() => {
    const counts = {};
    issueEvents.forEach(ev => {
      if (!topicMatches(ev, topicFilter)) return;
      counts[ev.gym_id] = (counts[ev.gym_id] || 0) +
        ev.activeErrors.length + ev.activeAiFlags.length + (ev.descIssue ? 1 : 0) +
        (showDismissed ? ev.dismissedErrors.length + ev.dismissedAiFlags.length : 0);
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueEvents, topicFilter, showDismissed]);

  const topicCounts = useMemo(() => {
    const counts = {};
    TOPICS.forEach(t => {
      counts[t.id] = 0;
      issueEvents.forEach(ev => {
        if (gymFilter !== 'all' && ev.gym_id !== gymFilter) return;
        if (t.id === 'all') {
          counts.all += ev.activeErrors.length + ev.activeAiFlags.length + (ev.descIssue ? 1 : 0);
        } else if (t.id === 'description') {
          if (ev.descIssue) counts.description += 1;
        } else if (t.id === 'ai') {
          counts.ai += ev.activeAiFlags.length;
        } else {
          counts[t.id] += ev.activeErrors.filter(e => t.types.includes(e.type)).length;
        }
      });
    });
    return counts;
  }, [issueEvents, gymFilter]);

  const visibleEvents = useMemo(() => {
    return issueEvents
      .filter(ev => (gymFilter === 'all' || ev.gym_id === gymFilter) && topicMatches(ev, topicFilter))
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueEvents, gymFilter, topicFilter, showDismissed]);

  const selectedEvent = visibleEvents.find(ev => ev.id === selectedEventId)
    || issueEvents.find(ev => ev.id === selectedEventId)
    || null;

  // ── Summary numbers (respect nothing — always the global truth) ───────────
  const summary = useMemo(() => {
    let errors = 0, warnings = 0, descIssues = 0, dismissed = 0, aiFlags = 0;
    issueEvents.forEach(ev => {
      ev.activeErrors.forEach(e => (e.severity === 'warning' ? warnings++ : errors++));
      aiFlags += ev.activeAiFlags.length;
      if (ev.descIssue) descIssues++;
      dismissed += ev.dismissedErrors.length + ev.dismissedAiFlags.length;
    });
    return { events: issueEvents.filter(e => e.activeErrors.length > 0 || e.activeAiFlags.length > 0 || e.descIssue).length, errors, warnings, descIssues, dismissed, aiFlags };
  }, [issueEvents]);

  // ── Dismiss / rule writes (same contract as the calendar side panel) ──────
  const writeAcknowledgment = async (eventId, errorMessage, note, hasRule = false) => {
    const { data: current, error: fetchErr } = await supabase
      .from('events').select('acknowledged_errors').eq('id', eventId).single();
    if (fetchErr) throw fetchErr;
    const acks = current?.acknowledged_errors || [];
    const already = acks.some(a => (typeof a === 'string' ? a === errorMessage : a.message === errorMessage));
    if (already) return acks;
    const updated = [...acks, { message: errorMessage, note: note || null, dismissed_at: new Date().toISOString(), ...(hasRule ? { has_rule: true } : {}) }];
    const { error: updErr } = await supabase.from('events').update({ acknowledged_errors: updated }).eq('id', eventId);
    if (updErr) throw updErr;
    return updated;
  };

  const handleDismiss = async (note, scope) => {
    const { eventId, errorMessage, gymId, eventType } = dismissModal;
    try {
      if (scope === 'all_in_program') {
        const created = await acknowledgedPatternsApi.create({ gym_id: gymId, event_type: eventType || 'CAMP', error_message: errorMessage, note });
        setPatterns(p => [...p, created]);
      } else {
        const updated = await writeAcknowledgment(eventId, errorMessage, note);
        setAckOverride(o => ({ ...o, [eventId]: updated }));
      }
    } catch (err) {
      alert(`Failed to dismiss: ${err.message}`);
    }
    setDismissModal(null);
  };

  const handleDismissAndRule = async (note, label, _eventType, duration = {}) => {
    const { eventId, errorMessage, gymId, eventType, ruleInfo } = dismissModal;
    const temporary = duration.isPermanent === false;
    try {
      const updated = await writeAcknowledgment(eventId, errorMessage, note, true);
      setAckOverride(o => ({ ...o, [eventId]: updated }));
      if (ruleInfo && gymId) {
        const isProgramSynonym = ruleInfo.ruleType === 'program_synonym';
        const ruleTypeMap = { price: 'valid_price', time: 'valid_time', program_synonym: 'program_synonym' };
        await rulesApi.create({
          is_permanent: !temporary,
          start_date: temporary ? duration.startDate : null,
          end_date: temporary ? duration.endDate : null,
          gym_ids: [gymId],
          program: isProgramSynonym ? label.toUpperCase() : (eventType || 'CAMP'),
          scope: 'all_events',
          rule_type: ruleTypeMap[ruleInfo.ruleType] || ruleInfo.ruleType,
          value: isProgramSynonym ? String(ruleInfo.value).toLowerCase() : ruleInfo.value,
          label,
          created_by: 'errors_center',
        });
      }
    } catch (err) {
      alert(`Dismissed OK, but rule failed: ${err.message}. Add it manually in Gym Rules.`);
    }
    setDismissModal(null);
  };

  const handleUndoAll = async (eventId) => {
    try {
      const { error } = await supabase.from('events').update({ acknowledged_errors: [] }).eq('id', eventId);
      if (error) throw error;
      setAckOverride(o => ({ ...o, [eventId]: [] }));
    } catch (err) {
      alert(`Failed to undo: ${err.message}`);
    }
  };

  const gymName = (id) => gyms?.find(g => g.id === id)?.name || id;
  const sevColor = (sev) => (sev === 'warning'
    ? { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', chip: '#f59e0b' }
    : { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', chip: '#dc2626' });

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-stretch gap-3 mb-4">
        {[
          { label: 'Events needing attention', value: summary.events, color: '#6e5658', bg: '#f7f3f3' },
          { label: 'Errors (wrong info)', value: summary.errors, color: '#991b1b', bg: '#fef2f2' },
          { label: 'Warnings', value: summary.warnings, color: '#9a3412', bg: '#fff7ed' },
          { label: 'AI suggestions', value: summary.aiFlags, color: '#3730a3', bg: '#eef2ff' },
          { label: 'No description', value: summary.descIssues, color: '#374151', bg: '#f3f4f6' },
          { label: 'Accepted', value: summary.dismissed, color: '#166534', bg: '#f0fdf4' },
        ].map(card => (
          <div key={card.label} className="flex-1 min-w-[140px] rounded-xl px-4 py-3 border"
            style={{ background: card.bg, borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(70,50,52,.08)' }}>
            <div className="text-3xl font-black" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: card.color, opacity: 0.75 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Horizontal topic tabs ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {TOPICS.map(t => {
          const active = topicFilter === t.id;
          const count = topicCounts[t.id] || 0;
          return (
            <button
              key={t.id}
              onClick={() => setTopicFilter(t.id)}
              className="px-3 py-1.5 rounded-full text-sm font-bold border transition-all cursor-pointer"
              style={active
                ? { background: '#6e5658', borderColor: '#6e5658', color: '#ffffff', boxShadow: '0 3px 8px rgba(110,86,88,.35)' }
                : { background: '#ffffff', borderColor: '#d8cccc', color: '#6e5658' }}
            >
              {t.icon} {t.label}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-black"
                style={active
                  ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { background: count > 0 ? '#fee2e2' : '#f3f4f6', color: count > 0 ? '#b91c1c' : '#9ca3af' }}>
                {count}
              </span>
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none" style={{ color: '#6e5658' }}>
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} />
          Show accepted
        </label>
      </div>

      {/* ── Three panels ──────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* LEFT — gyms */}
        <div className="w-52 flex-shrink-0 rounded-xl border bg-white overflow-hidden"
          style={{ borderColor: '#d8cccc', boxShadow: '0 2px 10px rgba(70,50,52,.10)' }}>
          <div className="px-3 py-2 text-xs font-black uppercase tracking-wider" style={{ background: '#f7f3f3', color: '#6e5658' }}>
            Gyms
          </div>
          <button
            onClick={() => setGymFilter('all')}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold border-t cursor-pointer transition-colors"
            style={gymFilter === 'all'
              ? { background: '#6e5658', color: '#fff', borderColor: 'transparent' }
              : { color: '#4a4a4a', borderColor: '#f0e8e8' }}
          >
            <span>All Gyms</span>
            <span className="px-1.5 rounded-full text-xs font-black"
              style={gymFilter === 'all' ? { background: 'rgba(255,255,255,.25)' } : { background: '#fee2e2', color: '#b91c1c' }}>
              {Object.values(gymCounts).reduce((a, b) => a + b, 0)}
            </span>
          </button>
          {(gyms || []).map(g => {
            const count = gymCounts[g.id] || 0;
            const active = gymFilter === g.id;
            return (
              <button
                key={g.id}
                onClick={() => { setGymFilter(active ? 'all' : g.id); setSelectedEventId(null); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm border-t cursor-pointer transition-colors hover:bg-gray-50"
                style={active
                  ? { background: '#6e5658', color: '#fff', borderColor: 'transparent', fontWeight: 700 }
                  : { color: count > 0 ? '#4a4a4a' : '#b8adad', borderColor: '#f0e8e8', fontWeight: count > 0 ? 600 : 400 }}
                title={g.name}
              >
                <span className="truncate">{g.id} <span className="text-xs opacity-70">· {g.name?.split(' ')[0]}</span></span>
                <span className="ml-1 px-1.5 rounded-full text-xs font-black flex-shrink-0"
                  style={active
                    ? { background: 'rgba(255,255,255,.25)', color: '#fff' }
                    : count > 0 ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#f3f4f6', color: '#9ca3af' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* MIDDLE — event cards */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Bulk-email toolbar: check the events you verified, send one email
              per gym listing them all. */}
          {visibleEvents.length > 0 && (() => {
            const visibleChecked = visibleEvents.filter(e => checkedIds.has(e.id));
            const allChecked = visibleChecked.length === visibleEvents.length;
            return (
              <div className="flex items-center justify-between gap-2 mb-1 px-1">
                <button
                  onClick={() => setCheckedIds(allChecked ? new Set() : new Set(visibleEvents.map(e => e.id)))}
                  className="text-xs font-bold cursor-pointer hover:underline"
                  style={{ color: '#6e5658' }}
                >
                  {allChecked ? '✕ Clear selection' : `☑ Select all (${visibleEvents.length})`}
                </button>
                {visibleChecked.length > 0 && (
                  <button
                    onClick={() => emailChecked(visibleChecked)}
                    className="px-3 py-1.5 rounded-lg text-xs font-black text-white cursor-pointer"
                    style={{ background: '#2563eb', boxShadow: '0 2px 8px rgba(37,99,235,.3)' }}
                    title="Open one pre-filled email per gym listing the checked events (sends from your Outlook)"
                  >
                    📧 Email selected ({visibleChecked.length})
                  </button>
                )}
              </div>
            );
          })()}
          {visibleEvents.length === 0 && (
            <div className="rounded-xl border-2 border-dashed p-10 text-center" style={{ borderColor: '#d8cccc' }}>
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-bold" style={{ color: '#6e5658' }}>Nothing here</div>
              <div className="text-sm mt-1" style={{ color: '#9a8b8b' }}>
                No {topicFilter !== 'all' ? TOPICS.find(t => t.id === topicFilter)?.label.toLowerCase() + ' ' : ''}issues
                {gymFilter !== 'all' ? ` for ${gymFilter}` : ' anywhere'} right now.
              </div>
            </div>
          )}
          {visibleEvents.map(ev => {
            const isSelected = selectedEventId === ev.id;
            const topic = TOPICS.find(t => t.id === topicFilter);
            const shownErrors = topicFilter === 'all' || topicFilter === 'description'
              ? ev.activeErrors
              : ev.activeErrors.filter(e => topic?.types?.includes(e.type));
            const isChecked = checkedIds.has(ev.id);
            return (
              <div key={ev.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => setCheckedIds(prev => {
                  const n = new Set(prev);
                  n.has(ev.id) ? n.delete(ev.id) : n.add(ev.id);
                  return n;
                })}
                className="mt-4 w-4 h-4 flex-shrink-0 cursor-pointer"
                style={{ accentColor: '#2563eb' }}
                title="Check to include in a bulk email"
              />
              <button
                onClick={() => setSelectedEventId(isSelected ? null : ev.id)}
                className="flex-1 min-w-0 text-left rounded-xl border bg-white px-4 py-3 cursor-pointer transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: isSelected ? '#6e5658' : '#e5dada',
                  boxShadow: isSelected ? '0 6px 16px rgba(110,86,88,.25)' : '0 2px 8px rgba(70,50,52,.08)',
                  outline: isSelected ? '2px solid #6e5658' : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-black text-white flex-shrink-0" style={{ background: '#8b6f6f' }}>
                      {ev.gym_id}
                    </span>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#9a8b8b' }}>
                      {ev.type || ev.event_type || 'EVENT'} · {fmtDate(ev.start_date || ev.date)}
                    </span>
                  </div>
                  {/* Personal "I checked this" mark — just Jayme's tracking, does
                      not accept/dismiss the error. */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggleVerified(ev.id); }}
                    className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors"
                    style={verifiedIds.has(ev.id)
                      ? { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }
                      : { background: '#fff', color: '#9a8b8b', border: '1px solid #e5dada' }}
                    title={verifiedIds.has(ev.id) ? 'You marked this verified — click to unmark' : 'Mark as verified (your personal note)'}
                  >
                    {verifiedIds.has(ev.id) ? '✓ Verified' : '○ Verify'}
                  </span>
                </div>
                <div className="font-bold text-sm mt-1 truncate" style={{ color: '#4a4a4a' }}>
                  {ev.title || '(no title)'}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {shownErrors.map((e, i) => {
                    const c = sevColor(e.severity);
                    return (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                        style={{ background: c.bg, borderColor: c.border, color: c.text }}>
                        {getErrorLabel(e.type)}
                      </span>
                    );
                  })}
                  {(topicFilter === 'all' || topicFilter === 'ai') && ev.activeAiFlags.map((f, i) => (
                    <span key={`ai-${i}`} className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                      style={{ background: '#eef2ff', borderColor: '#a5b4fc', color: '#3730a3' }}
                      title={f.message}>
                      🤖 {f.message.length > 42 ? f.message.slice(0, 42) + '…' : f.message}
                    </span>
                  ))}
                  {ev.descIssue && (topicFilter === 'all' || topicFilter === 'description') && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-gray-100 border-gray-300 text-gray-600">
                      📄 {ev.description_status === 'none' ? 'No description' : 'Flyer only'}
                    </span>
                  )}
                  {showDismissed && ev.dismissedErrors.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-green-50 border-green-300 text-green-700">
                      ✓ {ev.dismissedErrors.length} accepted
                    </span>
                  )}
                </div>
              </button>
              </div>
            );
          })}
        </div>

        {/* RIGHT — detail panel */}
        <div className="w-96 flex-shrink-0 rounded-xl border bg-white sticky top-4 max-h-[75vh] overflow-y-auto"
          style={{ borderColor: '#d8cccc', boxShadow: '0 2px 10px rgba(70,50,52,.10)' }}>
          {!selectedEvent ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">👈</div>
              <div className="font-bold text-sm" style={{ color: '#6e5658' }}>Pick an event</div>
              <div className="text-xs mt-1" style={{ color: '#9a8b8b' }}>
                Click any card to see its errors, open it in iClassPro, or create a custom rule.
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 rounded text-[11px] font-black text-white" style={{ background: '#8b6f6f' }}>
                  {selectedEvent.gym_id}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#9a8b8b' }}>
                  {gymName(selectedEvent.gym_id)}
                </span>
              </div>
              <div className="font-bold text-base leading-snug" style={{ color: '#4a4a4a' }}>
                {selectedEvent.title || '(no title)'}
              </div>
              <div className="text-xs mt-1 mb-3" style={{ color: '#9a8b8b' }}>
                {selectedEvent.type || selectedEvent.event_type || 'EVENT'} · {fmtDate(selectedEvent.start_date || selectedEvent.date)}
                {selectedEvent.price ? ` · $${selectedEvent.price}` : ''}
              </div>

              {selectedEvent.event_url && (
                <a href={selectedEvent.event_url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 mb-3"
                  style={{ background: '#2563eb', boxShadow: '0 3px 8px rgba(37,99,235,.3)' }}>
                  🔗 Open in iClassPro to verify
                </a>
              )}

              {/* ONE email for the whole event, listing every data error AND a
                  missing-description issue. The + Create Custom Rule buttons
                  stay per-error below. (Jayme: one event = one email.) */}
              {(selectedEvent.activeErrors.length > 0 || selectedEvent.descIssue) &&
                eventEmailBlock(
                  selectedEvent,
                  [
                    ...selectedEvent.activeErrors.map(e => `${getErrorLabel(e.type)}: ${e.message}`),
                    ...(selectedEvent.descIssue ? [descriptionIssueLine(selectedEvent.description_status)].filter(Boolean) : []),
                  ]
                )}

              {/* Active errors with actions */}
              {selectedEvent.activeErrors.length > 0 && (
                <div className="space-y-2 mb-3">
                  {selectedEvent.activeErrors.map((e, i) => {
                    const c = sevColor(e.severity);
                    return (
                      <div key={i} className="rounded-lg border p-2.5" style={{ background: c.bg, borderColor: c.border }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black" style={{ color: c.text }}>{getErrorLabel(e.type)}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black text-white" style={{ background: c.chip }}>
                            {e.severity === 'warning' ? 'WARNING' : 'ERROR'}
                          </span>
                        </div>
                        <div className="text-xs mt-1" style={{ color: c.text }}>{e.message}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setDismissModal({
                              eventId: selectedEvent.id,
                              errorMessage: e.message,
                              errorObj: e,
                              gymId: selectedEvent.gym_id,
                              eventType: selectedEvent.type || selectedEvent.event_type || 'CAMP',
                              ruleEligible: canAddAsRule(e.type),
                              ruleInfo: extractRuleValue(e, selectedEvent),
                            })}
                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-white border transition-colors hover:bg-green-50 cursor-pointer"
                            style={{ borderColor: c.border, color: c.text }}
                          >
                            ＋ Create Custom Rule
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI review suggestions — separate lane, clearly labeled */}
              {selectedEvent.activeAiFlags.length > 0 && (
                <div className="space-y-2 mb-3">
                  {selectedEvent.activeAiFlags.map((f, i) => (
                    <div key={`aif-${i}`} className="rounded-lg border p-2.5" style={{ background: '#eef2ff', borderColor: '#a5b4fc' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black" style={{ color: '#3730a3' }}>🤖 AI Review</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black text-white" style={{ background: '#6366f1' }}>
                          SUGGESTION
                        </span>
                      </div>
                      <div className="text-xs mt-1 font-semibold" style={{ color: '#3730a3' }}>{f.message}</div>
                      {f.reason && (
                        <div className="text-[11px] mt-1 italic" style={{ color: '#4f46e5' }}>{f.reason}</div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setDismissModal({
                            eventId: selectedEvent.id,
                            errorMessage: f.message,
                            errorObj: f,
                            gymId: selectedEvent.gym_id,
                            eventType: selectedEvent.type || selectedEvent.event_type || 'CAMP',
                            ruleEligible: false,
                            ruleInfo: null,
                          })}
                          className="px-2.5 py-1 rounded-md text-xs font-bold bg-white border transition-colors hover:bg-green-50 cursor-pointer"
                          style={{ borderColor: '#a5b4fc', color: '#3730a3' }}
                        >
                          ＋ Create Custom Rule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description issue */}
              {selectedEvent.descIssue && (
                <div className="rounded-lg border bg-gray-50 border-gray-300 p-2.5 mb-3">
                  <div className="text-xs font-black text-gray-700">
                    📄 {selectedEvent.description_status === 'none' ? 'No description' : 'Flyer only — no text description'}
                  </div>
                  <div className="text-xs mt-1 text-gray-600">
                    Validation checks can't run without description text. Fix it in iClassPro.
                  </div>
                </div>
              )}

              {/* Dismissed errors */}
              {selectedEvent.dismissedErrors.length > 0 && (
                <div className="rounded-lg border bg-green-50 border-green-200 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-green-800">✓ Accepted ({selectedEvent.dismissedErrors.length})</span>
                    <button onClick={() => handleUndoAll(selectedEvent.id)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-800 underline cursor-pointer">
                      Undo all
                    </button>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {selectedEvent.dismissedErrors.map((e, i) => (
                      <li key={i} className="text-[11px] text-green-700 line-through">{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dismiss modal — same component + contract as the calendar side panel */}
      {dismissModal && (
        <DismissRuleModal
          errorMessage={dismissModal.errorMessage}
          gymId={dismissModal.gymId}
          eventType={dismissModal.eventType}
          ruleEligible={dismissModal.ruleEligible}
          ruleInfo={dismissModal.ruleInfo}
          scopeOptions="both"
          onCancel={() => setDismissModal(null)}
          onDismiss={handleDismiss}
          onDismissAndRule={handleDismissAndRule}
        />
      )}
    </div>
  );
}
