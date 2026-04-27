// ============================================================================
// AUDIT RULES — Live management UI
// ============================================================================
// Reads from the `rules` table (system check rules). Provides toggle,
// edit-label, edit-description, scope display per rule.
//
// Phase 1 of the audit redo plan (memory: project_audit_full_redo_plan.md).
// Replaces the previous hardcoded 48-rule reference array which lied about
// what was actually active.
//
// Constraints respected:
//   - Frontend-only (no Python changes)
//   - Uses existing rulesApi (no new API surface)
//   - Backward-compatible — does not remove any rule, only manages existing
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { rulesApi } from '../../lib/api';

// ─── Toggle Switch (matches AdminGymRules pattern) ──────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ background: checked ? '#5a9a5a' : '#d1d5db' }}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatScope(rule) {
  const gymPart = (!rule.gym_ids || rule.gym_ids.length === 0 || rule.gym_ids.includes('ALL'))
    ? 'All Gyms'
    : rule.gym_ids.join(', ');
  const progPart = rule.program || 'ALL';
  return `${gymPart} · ${progPart}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AdminAuditRulesReference() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Load rules from DB
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await rulesApi.getAll();
      // Filter for system check rules only (rule_type starts with 'check_' OR is_system flag)
      const systemRules = all.filter(r =>
        (r.rule_type && r.rule_type.startsWith('check_')) || r.is_system === true
      );
      setRules(systemRules);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Toggle a rule's is_active flag
  const handleToggle = async (rule) => {
    setTogglingIds(prev => new Set(prev).add(rule.id));
    try {
      await rulesApi.update(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err) {
      alert(`Failed to toggle: ${err.message}`);
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(rule.id);
        return next;
      });
    }
  };

  // Start editing label/description
  const startEdit = (rule) => {
    setEditingRuleId(rule.id);
    setEditLabel(rule.label || '');
    setEditDescription(rule.description || '');
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setEditLabel('');
    setEditDescription('');
  };

  const saveEdit = async (rule) => {
    setSavingId(rule.id);
    try {
      await rulesApi.update(rule.id, {
        label: editLabel.trim() || null,
        description: editDescription.trim() || null,
      });
      setRules(prev => prev.map(r =>
        r.id === rule.id
          ? { ...r, label: editLabel.trim() || null, description: editDescription.trim() || null }
          : r
      ));
      cancelEdit();
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  // ─── Computed stats ──────────────────────────────────────────────────────
  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.is_active).length;
  const inactiveRules = totalRules - activeRules;
  const totalHits = rules.reduce((sum, r) => sum + (r.last_hit_count || 0), 0);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading audit rules from database...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="font-semibold text-red-800">Failed to load rules</h3>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <button
          onClick={loadRules}
          className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="font-bold text-amber-800 mb-2">No audit rules in the database</h3>
        <p className="text-sm text-amber-700">
          The <code>rules</code> table is empty for system checks. The audit engine
          has nothing to run. Visit the <strong>Gym Rules</strong> tab — there's a
          "Seed System Checks" button that adds the 11 standard checks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Header / Summary Bar ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">🔍 Audit Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live from the <code>rules</code> table. Toggle to enable/disable. Click any rule to edit its label or description.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-bold text-gray-800 tabular-nums">{totalRules}</span>
              <span className="text-gray-500 ml-1">total</span>
            </div>
            <span className="text-gray-300">·</span>
            <div>
              <span className="font-bold text-green-700 tabular-nums">{activeRules}</span>
              <span className="text-gray-500 ml-1">active</span>
            </div>
            <span className="text-gray-300">·</span>
            <div>
              <span className="font-bold text-gray-500 tabular-nums">{inactiveRules}</span>
              <span className="text-gray-500 ml-1">off</span>
            </div>
            <span className="text-gray-300">·</span>
            <div>
              <span className="font-bold text-amber-700 tabular-nums">{totalHits}</span>
              <span className="text-gray-500 ml-1">total hits (last sync)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Rule List ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {rules.map(rule => {
          const isToggling = togglingIds.has(rule.id);
          const isEditing = editingRuleId === rule.id;
          const isSaving = savingId === rule.id;
          const hits = rule.last_hit_count || 0;

          return (
            <div
              key={rule.id}
              className={`rounded-xl border p-4 shadow-sm transition-all ${
                rule.is_active
                  ? 'bg-white border-gray-200 hover:shadow-md'
                  : 'bg-gray-50 border-gray-200 opacity-75'
              }`}
            >
              {!isEditing ? (
                // ─── Display Mode ──────────────────────────────────────
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <div className="flex-shrink-0 pt-1">
                    <Toggle
                      checked={rule.is_active}
                      onChange={() => handleToggle(rule)}
                      disabled={isToggling}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold ${rule.is_active ? 'text-gray-800' : 'text-gray-500'}`}>
                        {rule.label || rule.rule_type}
                      </h3>
                      <code className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {rule.rule_type}
                      </code>
                      {hits > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {hits} hit{hits === 1 ? '' : 's'} last sync
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-xs text-gray-600 mt-1">{rule.description}</p>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1.5">
                      Scope: <span className="font-medium">{formatScope(rule)}</span>
                    </div>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => startEdit(rule)}
                    className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    ✎ Edit
                  </button>
                </div>
              ) : (
                // ─── Edit Mode ─────────────────────────────────────────
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Label (shown to user)</label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder={rule.rule_type}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description (what this check does)</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      placeholder="Plain-English explanation of what this rule catches..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(rule)}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Footer note ──────────────────────────────────────────────── */}
      <div className="text-[11px] text-gray-400 text-center pt-2">
        Per-gym scoping, threshold editing, and adding new check types — coming in Phases 2–3 of the audit redo.
      </div>
    </div>
  );
}
