// ============================================================================
// AdminFormatRules — UI-managed catalog of format recognition patterns
// ============================================================================
// Format patterns are the regex/keyword rules the validation engine uses
// to RECOGNIZE dates, times, prices, ages, program names, and skills in
// manager-written titles and descriptions.
//
// Before this tab existed, every pattern was hardcoded inside Python
// functions in automation/validation_engine.py — invisible and uneditable
// from the admin UI.
//
// Now: each pattern is a row in the `format_patterns` Supabase table that
// Jayme can SEE, TOGGLE on/off, EDIT, ADD, or DELETE without touching code.
//
// Engine wiring status (honest):
//   - DATE and TIME categories → engine integration in progress (Phase B)
//   - PRICE, AGE, PROGRAM, SKILL → catalog only, engine still uses hardcoded
//     patterns for now. Toggling them in this UI doesn't affect what gets
//     caught YET — that's the next session's work.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { formatPatternsApi } from '../../lib/api';

// ─── Category metadata ───────────────────────────────────────────────────────
// `engineWired: false` for ALL categories until validation_engine.py is
// updated to actually READ from format_patterns. Right now this tab is
// VISIBILITY ONLY — adding/editing patterns here doesn't yet change what
// the sync engine catches. That integration is the next step.
const CATEGORIES = [
  { id: 'date',    label: '📅 Date Formats',    color: '#7c3aed', engineWired: false },
  { id: 'time',    label: '🕐 Time Formats',    color: '#d97706', engineWired: false },
  { id: 'price',   label: '💰 Price Formats',   color: '#16a34a', engineWired: false },
  { id: 'age',     label: '👶 Age Formats',     color: '#db2777', engineWired: false },
  { id: 'program', label: '🏷️ Program Names',   color: '#2563eb', engineWired: false },
  { id: 'skill',   label: '⭐ Skills',          color: '#0891b2', engineWired: false },
];

// ─── Toggle Switch ───────────────────────────────────────────────────────────
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

// ─── Add / Edit Modal ────────────────────────────────────────────────────────
function PatternEditor({ pattern, onSave, onCancel, defaultCategory }) {
  const isNew = !pattern || !pattern.id;
  const [form, setForm] = useState({
    category: pattern?.category || defaultCategory || 'date',
    name: pattern?.name || '',
    pattern: pattern?.pattern || '',
    match_type: pattern?.match_type || 'regex',
    example: pattern?.example || '',
    description: pattern?.description || '',
    is_active: pattern?.is_active !== false,
    program: pattern?.program || 'ALL',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.pattern.trim()) { setError('Pattern is required'); return; }
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message || 'Save failed');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="fixed inset-x-4 sm:inset-x-8 top-12 z-[65] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-3xl mx-auto max-h-[80vh]"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #faf7f7, #f5f0f0)' }}
        >
          <h2 className="text-lg font-bold text-gray-800">
            {isNew ? '+ New Format Pattern' : 'Edit Format Pattern'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Name (short identifier)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. slash_short_year, kno_abbrev"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
            <p className="text-[11px] text-gray-500 mt-1">Lower-case, underscores. Used internally — must be unique per category.</p>
          </div>

          {/* Match type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Match type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, match_type: 'regex' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${form.match_type === 'regex' ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={form.match_type === 'regex' ? { background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)' } : {}}
              >
                Regex
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, match_type: 'keyword' })}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${form.match_type === 'keyword' ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={form.match_type === 'keyword' ? { background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)' } : {}}
              >
                Keyword (literal text)
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {form.match_type === 'regex'
                ? 'Regex = a pattern with special characters like \\d, \\b, [], etc.'
                : 'Keyword = a literal substring match (case-insensitive). Easier for non-regex users.'}
            </p>
          </div>

          {/* Pattern */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Pattern {form.match_type === 'regex' ? '(regex)' : '(literal text)'}
            </label>
            <input
              type="text"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder={form.match_type === 'regex' ? '\\b\\d{1,2}/\\d{1,2}/\\d{2}\\b' : 'kids night out'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>

          {/* Example */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Example (what this matches in real text)</label>
            <input
              type="text"
              value={form.example}
              onChange={(e) => setForm({ ...form, example: e.target.value })}
              placeholder="e.g. 5/20/26"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description (plain English)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this pattern catches and why it exists"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>

          {/* Active */}
          <div className="rounded-lg p-3 border border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">{form.is_active ? 'Active' : 'Inactive'}</div>
              <div className="text-xs text-gray-500">{form.is_active ? 'Engine will use this pattern' : 'Engine will ignore this pattern'}</div>
            </div>
            <Toggle checked={form.is_active} onChange={() => setForm({ ...form, is_active: !form.is_active })} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <div className="text-sm">
            {error && <span className="text-red-600 font-medium">{error}</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #5a9a5a, #6b8e6b)' }}
            >
              {saving ? 'Saving…' : (isNew ? 'Create Pattern' : 'Save Changes')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Pattern Row ─────────────────────────────────────────────────────────────
// Designed for non-coders: the EXAMPLE (what gets caught) is the visual hero.
// Internal name and the regex itself are hidden behind a small details toggle
// for the rare moments a developer needs to see them.
function PatternRow({ pattern, onToggle, onEdit, onDelete, toggling }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={`px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 ${!pattern.is_active ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Hero: the example. Big and readable — what this catches in real text. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900 font-mono">
              {pattern.example || '(no example)'}
            </span>
            {pattern.description && (
              <span className="text-sm text-gray-600">
                — {pattern.description}
              </span>
            )}
          </div>
          {/* Internal name + match-type, small and gray — for developer reference */}
          <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-2">
            <span>Internal name: <code className="bg-gray-100 px-1 py-0.5 rounded">{pattern.name}</code></span>
            <span>·</span>
            <span>Type: {pattern.match_type}</span>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="ml-1 text-amber-700 hover:text-amber-900 underline"
            >
              {showDetails ? 'hide pattern' : 'view raw pattern'}
            </button>
          </div>
          {showDetails && (
            <div className="mt-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
              <code className="text-[11px] text-gray-700 break-all">{pattern.pattern}</code>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(pattern)}
            className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => onDelete(pattern)}
            className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
            title="Delete"
          >
            🗑️
          </button>
          <Toggle checked={pattern.is_active} onChange={() => onToggle(pattern)} disabled={toggling} />
        </div>
      </div>
    </div>
  );
}

// ─── Category Section ────────────────────────────────────────────────────────
function CategorySection({ category, patterns, onToggle, onEdit, onDelete, onAdd, togglingIds }) {
  const activeCount = patterns.filter((p) => p.is_active).length;

  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderBottomColor: 'rgba(0,0,0,0.06)', background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,245,245,0.95))' }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-gray-800" style={{ color: category.color }}>{category.label}</h3>
          <span className="text-xs font-normal text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
            {activeCount} of {patterns.length} active
          </span>
          {category.engineWired ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
              Engine-wired
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Visibility only
            </span>
          )}
        </div>
        <button
          onClick={() => onAdd(category.id)}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-md hover:translate-y-[-1px] transition-all"
          style={{ background: 'linear-gradient(135deg, #5a9a5a, #6b8e6b)', boxShadow: '0 2px 8px rgba(90,154,90,0.3)' }}
        >
          + New Pattern
        </button>
      </div>

      {/* Rows */}
      {patterns.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">No patterns yet — click "+ New Pattern" to add one.</div>
      ) : (
        <div>
          {patterns.map((p) => (
            <PatternRow
              key={p.id}
              pattern={p}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              toggling={togglingIds.has(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminFormatRules() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [editingPattern, setEditingPattern] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('date');

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await formatPatternsApi.getAll();
      setPatterns(data);
    } catch (e) {
      setError(e.message || 'Failed to load patterns');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPatterns(); }, [loadPatterns]);

  const handleToggle = async (pattern) => {
    setTogglingIds((prev) => new Set(prev).add(pattern.id));
    try {
      const updated = await formatPatternsApi.toggle(pattern.id, !pattern.is_active);
      setPatterns((prev) => prev.map((p) => (p.id === pattern.id ? updated : p)));
    } catch (e) {
      setError(e.message || 'Toggle failed');
    }
    setTogglingIds((prev) => { const n = new Set(prev); n.delete(pattern.id); return n; });
  };

  const handleEdit = (pattern) => {
    setEditingPattern(pattern);
    setShowEditor(true);
  };

  const handleAdd = (category) => {
    setEditingPattern(null);
    setDefaultCategory(category);
    setShowEditor(true);
  };

  const handleDelete = async (pattern) => {
    if (!window.confirm(`Delete pattern "${pattern.name}"? This cannot be undone.`)) return;
    try {
      await formatPatternsApi.delete(pattern.id);
      setPatterns((prev) => prev.filter((p) => p.id !== pattern.id));
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleSave = async (form) => {
    try {
      if (editingPattern && editingPattern.id) {
        const updated = await formatPatternsApi.update(editingPattern.id, form);
        setPatterns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await formatPatternsApi.create(form);
        setPatterns((prev) => [...prev, created]);
      }
      setShowEditor(false);
      setEditingPattern(null);
    } catch (e) {
      throw e; // PatternEditor will display the error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-gray-500">Loading format patterns…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header explainer */}
      <div className="rounded-xl p-4 border border-amber-200 bg-amber-50/50">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📐</div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-800 mb-1">Format Rules</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              These are the <strong>format patterns</strong> the validation engine uses to RECOGNIZE dates, times, prices, ages, program names, and skills inside event titles and descriptions.
              Each row is one pattern — toggle, edit, add, or delete. New patterns take effect on the next sync.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              <strong>Engine wiring status:</strong> Categories marked <span className="font-bold">Engine-wired</span> currently use these patterns at sync time. Categories marked <span className="font-bold">Visibility only</span> are catalogged here for management but the engine still uses hardcoded patterns until that integration ships.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {/* One section per category, in fixed order */}
      {CATEGORIES.map((cat) => {
        const inCategory = patterns.filter((p) => p.category === cat.id);
        return (
          <CategorySection
            key={cat.id}
            category={cat}
            patterns={inCategory}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
            togglingIds={togglingIds}
          />
        );
      })}

      {showEditor && (
        <PatternEditor
          pattern={editingPattern}
          defaultCategory={defaultCategory}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingPattern(null); }}
        />
      )}
    </div>
  );
}
