// ============================================================================
// RuleManager — Three-panel modal for viewing + editing a single rule.
// ============================================================================
// Replaces the cramped right-side DetailPanel inside AdminGymRules.js.
// Layout (desktop): [ WHAT IT CATCHES | WHERE IT APPLIES (editable) | LIVE IMPACT ]
// On mobile the three columns stack vertically.
//
// Goal: every word visible is plain English. No raw rule_type strings, no
// "all_events" or "system_check" jargon in the main surface. Internal names
// live in a small metadata block at the bottom of the right column.
//
// Inline editing handles the common moves: toggle on/off, change which gyms
// or programs a rule applies to, switch permanent <-> expires, add a note.
// For per-gym rules with structured values (sibling pricing kid1/kid2/kid3,
// program-synonym keyword/label) the old Rule Wizard is still the editor —
// this v1 keeps the wizard for those advanced edits.
// ============================================================================

import React, { useState, useMemo } from 'react';
import { rulesApi } from '../../lib/api';

// ─── Plain-language descriptions per check type ──────────────────────────────
// Keyed by rule_type. Used to fill the left "What it catches" column for the
// 11 system checks. Per-gym rules fall back to their stored label/description.
const RULE_PLAIN_LANGUAGE = {
  check_year_mismatch: {
    title: 'Wrong Year',
    catches: "Catches when an event's title or description shows a year that doesn't match the actual event year.",
    example: 'Event is in 2026 but title says "Summer Camp 2025" — copied from last year\'s listing.',
  },
  check_age_mismatch: {
    title: 'Age Mismatch',
    catches: "Catches when the minimum age in iClass doesn't match the age in the title or description (or when title and description disagree).",
    example: 'iClass says ages 5+, but description says "Ages 7-12".',
  },
  check_date_mismatch: {
    title: 'Date / Month Mismatch',
    catches: "Catches when a month name in the description doesn't match the actual event month.",
    example: 'April event with "Join us in March" in the description.',
  },
  check_time_mismatch: {
    title: 'Time Mismatch',
    catches: "Catches when the time written in title or description doesn't match iClass's scheduled time.",
    example: 'iClass schedule says 7:00 PM but title says "6:30-9:30 pm".',
  },
  check_event_price: {
    title: 'Event Price vs Pricing Table',
    catches: "For Clinic, KNO, Open Gym — catches when the price in title or description doesn't match the price in your event_pricing table for that gym.",
    example: 'HGA KNO is set to $45 in your pricing table but the description says $40.',
  },
  check_camp_price: {
    title: 'Camp Price vs Pricing Table',
    catches: "For Camp — catches when the price doesn't match valid prices in camp_pricing (full day daily / weekly, half day daily / weekly).",
    example: 'RBA Half Day camp description shows a Full Day price.',
  },
  check_day_mismatch: {
    title: 'Day of Week Mismatch',
    catches: "Catches when the actual day of the event doesn't match the day mentioned in the description. Skipped for camps.",
    example: 'Friday KNO with "join us Saturday" in the description.',
  },
  check_program_mismatch: {
    title: 'Program Type Mismatch',
    catches: "Catches when title or description keywords don't match iClass's event category.",
    example: 'Event is in iClass\'s "Clinic" section but title says "Kids Night Out".',
  },
  check_title_desc_mismatch: {
    title: 'Title vs Description Conflict',
    catches: 'Catches when the title and description contradict each other about what type of event it is.',
    example: 'Title: "Clinic at HGA" / Description: "Join our Kids Night Out…"',
  },
  check_impossible_date: {
    title: 'Impossible Date',
    catches: "Catches dates that physically can't exist anywhere in the text.",
    example: '"June 31st" or "February 30th".',
  },
  check_price_mismatch: {
    title: 'Price Mismatch (Title vs Description)',
    catches: "Catches when the dollar amount in the title doesn't match the dollar amount in the description.",
    example: 'Title: "Clinic $25" / Description: "Sign up for $30!"',
  },
};

// Programs the rule can be scoped to. Mirror of what RuleWizard / the rules
// table support today.
const PROGRAMS = ['ALL', 'CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'SPECIAL EVENT'];

// ─── Main Component ─────────────────────────────────────────────────────────
export default function RuleManager({ rule, gyms, onClose, onSaved, onDeleted, onOpenWizard }) {
  // Local editable state — initialised from the rule on mount.
  const [gymIds, setGymIds] = useState(rule.gym_ids && rule.gym_ids.length > 0 ? rule.gym_ids : ['ALL']);
  const [program, setProgram] = useState(rule.program || 'ALL');
  const [isPermanent, setIsPermanent] = useState(rule.is_permanent !== false);
  const [endDate, setEndDate] = useState(rule.end_date || '');
  const [note, setNote] = useState(rule.note || '');
  const [isActive, setIsActive] = useState(rule.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isSystem = rule.rule_type && rule.rule_type.startsWith('check_');
  const hitCount = rule.last_hit_count || 0;
  const lastSyncedAt = rule.last_sync_at ? new Date(rule.last_sync_at) : null;

  // Pick the plain-language record for system checks. For non-system rules
  // we fall back to whatever's stored on the row.
  const lang = RULE_PLAIN_LANGUAGE[rule.rule_type] || {
    title: rule.label || rule.rule_type || 'Rule',
    catches: rule.description || `Custom ${rule.rule_type || 'rule'}. ${rule.value ? 'Value: ' + rule.value : ''}`.trim(),
    example: rule.note || 'Created manually — see the Notes / Internal Name section for details.',
  };

  // Has anything changed since open? Drives the Save button's enabled state.
  const isDirty = useMemo(() => {
    const origGyms = (rule.gym_ids && rule.gym_ids.length ? rule.gym_ids : ['ALL']).slice().sort().join(',');
    const newGyms = gymIds.slice().sort().join(',');
    return (
      origGyms !== newGyms ||
      (rule.program || 'ALL') !== program ||
      (rule.is_permanent !== false) !== isPermanent ||
      (rule.end_date || '') !== (endDate || '') ||
      (rule.note || '') !== (note || '') ||
      (rule.is_active !== false) !== isActive
    );
  }, [rule, gymIds, program, isPermanent, endDate, note, isActive]);

  // Gym chip toggle — selecting "All Gyms" clears the rest, and vice versa.
  const toggleGym = (gymId) => {
    setGymIds((prev) => {
      if (gymId === 'ALL') return ['ALL'];
      const next = prev.includes('ALL') ? [] : [...prev];
      if (next.includes(gymId)) {
        const filtered = next.filter((g) => g !== gymId);
        return filtered.length === 0 ? ['ALL'] : filtered;
      }
      return [...next, gymId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = {
        gym_ids: gymIds,
        program,
        is_permanent: isPermanent,
        end_date: isPermanent ? null : (endDate || null),
        note: note || null,
        is_active: isActive,
      };
      const updated = await rulesApi.update(rule.id, updates);
      onSaved && onSaved(updated);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const warn = isSystem
      ? `Delete "${lang.title}"? This system check will stop running on every sync. You can re-add system checks from the "Load System Checks" button on the empty state, but that re-adds ALL of them.`
      : `Delete "${lang.title}"?`;
    if (!window.confirm(warn)) return;
    setSaving(true);
    try {
      await rulesApi.delete(rule.id);
      onDeleted && onDeleted(rule.id);
    } catch (err) {
      setError(err.message || 'Failed to delete');
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal shell — large, centered, responsive */}
      <div
        className="fixed inset-x-4 sm:inset-x-8 top-6 bottom-6 z-[65] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-7xl mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-manager-title"
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, #faf7f7, #f5f0f0)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 flex-shrink-0">
              {isSystem ? 'System Check' : (rule.rule_type || 'Rule').replace(/_/g, ' ')}
            </span>
            <h2
              id="rule-manager-title"
              className="text-lg sm:text-xl font-bold text-gray-800 truncate"
            >
              {lang.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — 3 columns desktop, stacked mobile */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x divide-gray-100">
            {/* ── COLUMN 1: WHAT IT CATCHES ───────────────────────────── */}
            <section className="p-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                What it catches
              </div>
              <p className="text-base text-gray-800 leading-relaxed mb-5">
                {lang.catches}
              </p>
              <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Example
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed">
                  {lang.example}
                </p>
              </div>
              {isSystem && (
                <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                  This is a built-in system check. The detection logic lives in code — you can change which gyms or programs it applies to, but not what it looks for.
                </p>
              )}
              {!isSystem && rule.value && (
                <div className="mt-4 rounded-lg p-3 bg-amber-50 border border-amber-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                    Stored value
                  </div>
                  <div className="text-sm text-amber-900 font-mono break-all">{rule.value}</div>
                  {onOpenWizard && (
                    <button
                      onClick={() => onOpenWizard(rule)}
                      className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
                    >
                      Edit value in wizard →
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ── COLUMN 2: WHERE IT APPLIES (editable) ────────────────── */}
            <section className="p-6 space-y-5" style={{ background: '#fafaf8' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Where it applies
              </div>

              {/* On / Off row */}
              <div className="rounded-lg p-3 border border-gray-200 bg-white flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {isActive ? 'Rule is ON' : 'Rule is OFF'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isActive ? 'Running on every sync' : 'Not running'}
                  </div>
                </div>
                <Toggle checked={isActive} onChange={() => setIsActive((v) => !v)} />
              </div>

              {/* Gyms */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Gyms</label>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={gymIds.includes('ALL')}
                    onClick={() => toggleGym('ALL')}
                    label="All Gyms"
                  />
                  {(gyms || []).map((g) => (
                    <Chip
                      key={g.id}
                      active={gymIds.includes(g.id) && !gymIds.includes('ALL')}
                      onClick={() => toggleGym(g.id)}
                      label={g.id}
                      disabled={gymIds.includes('ALL')}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Select "All Gyms" or pick specific ones. Picking specific gyms turns off "All Gyms".
                </p>
              </div>

              {/* Programs */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Programs</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROGRAMS.map((p) => (
                    <Chip
                      key={p}
                      active={program === p}
                      onClick={() => setProgram(p)}
                      label={p === 'ALL' ? 'All Programs' : p}
                    />
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Duration</label>
                <div className="flex gap-2 mb-2">
                  <Chip active={isPermanent} onClick={() => setIsPermanent(true)} label="Permanent" />
                  <Chip active={!isPermanent} onClick={() => setIsPermanent(false)} label="Expires" />
                </div>
                {!isPermanent && (
                  <input
                    type="date"
                    value={endDate || ''}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                    aria-label="Expiration date"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this scope? Reminder for future you…"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                />
              </div>
            </section>

            {/* ── COLUMN 3: LIVE IMPACT ────────────────────────────────── */}
            <section className="p-6 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Live impact
              </div>

              {/* Last-sync hit count card */}
              <div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
                <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider mb-1">
                  Last sync
                </div>
                <div className="text-3xl font-bold text-amber-700">{hitCount}</div>
                <div className="text-sm text-amber-700/80">
                  {hitCount === 1 ? 'event flagged' : 'events flagged'}
                </div>
                {lastSyncedAt && (
                  <div className="text-xs text-amber-600/70 mt-2">
                    {lastSyncedAt.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Affected events — placeholder until per-rule drill-down is built */}
              <div className="rounded-lg p-4 bg-white border border-gray-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Affected events
                </div>
                {hitCount === 0 ? (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Nothing to show — this check caught <strong>0 events</strong> on the most recent sync. No drill-down needed.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 leading-relaxed">
                    This check caught <strong>{hitCount} {hitCount === 1 ? 'event' : 'events'}</strong> on the most recent sync. A built-in list of WHICH events isn't here yet — that's the next thing to add. For now: any event with a red dot on the calendar has at least one rule flagging it (could be this one, could be another).
                  </p>
                )}
              </div>

              {/* Metadata — internal names live here, out of the way */}
              <div className="rounded-lg p-4 bg-white border border-gray-200 text-xs text-gray-500 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Internal
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Created by:</span>{' '}
                  {rule.created_by || 'manual'}
                </div>
                {rule.created_at && (
                  <div>
                    <span className="font-semibold text-gray-700">Created:</span>{' '}
                    {new Date(rule.created_at).toLocaleDateString()}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-gray-700">Internal name:</span>{' '}
                  <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                    {rule.rule_type}
                  </code>
                </div>
                {rule.id && (
                  <div className="break-all">
                    <span className="font-semibold text-gray-700">ID:</span>{' '}
                    <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                      {rule.id}
                    </code>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white flex-wrap">
          <div className="text-sm">
            {error && <span className="text-red-600 font-medium">{error}</span>}
            {!error && isDirty && (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            )}
            {!error && !isDirty && (
              <span className="text-gray-400">No unsaved changes</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{
                background:
                  !isDirty || saving
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #5a9a5a, #6b8e6b)',
                boxShadow: !isDirty || saving ? 'none' : '0 2px 8px rgba(90,154,90,0.3)',
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Small reusable bits ────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      style={{ background: checked ? '#5a9a5a' : '#d1d5db' }}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Chip({ active, onClick, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
        active
          ? 'text-white'
          : disabled
          ? 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
      }`}
      style={active ? { background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)' } : {}}
    >
      {label}
    </button>
  );
}
