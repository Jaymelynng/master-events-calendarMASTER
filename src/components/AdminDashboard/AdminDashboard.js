import React, { useState, useEffect, useRef } from 'react';
import AdminErrorsCenter from './AdminErrorsCenter';
import AdminContacts from './AdminContacts';
import AdminGymRules from './AdminGymRules';
import AdminQuickActions from './AdminQuickActions';
import AdminChangeHistory from './AdminChangeHistory';
import EmailComposer from './EmailComposer';
import AdminFuturePlans from './AdminFuturePlans';
import { monthlyRequirementsApi, eventTypesApi } from '../../lib/api';

// ─── Color helpers ────────────────────────────────────────────────────────────
// Derive a soft-tint background, medium border, and text color from a single
// hex color stored in event_types.color. One color in DB → consistent triple
// across pills/cards/badges everywhere (after consumers are refactored).
function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(180,143,143,${alpha})`;
  const clean = hex.replace('#', '');
  const v = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
function colorTriple(hex) {
  return {
    bg: hexToRgba(hex, 0.18),
    border: hexToRgba(hex, 0.55),
    text: hex || '#444',
  };
}

// ─── Monthly Requirements Bar (lives at top of Admin, above the tabs) ─────────
// Foundational concept: each gym must hit at least N events of certain
// program types per month. Adding/editing/removing here writes to the
// `monthly_requirements` Supabase table and bubbles the change up via
// onChange so the calendar (summary card + per-gym table) recalculates
// "complete vs missing" using the new threshold immediately.
function MonthlyRequirementsBar({ requirements, eventTypes, onChange, onEventTypesChange }) {
  const [saving, setSaving] = useState(null); // event_type currently being saved
  const [editing, setEditing] = useState(null); // event_type being edited inline
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [savingColor, setSavingColor] = useState(null); // event_type whose color is saving
  // Hex paste popover — opens when user clicks the color circle. We deliberately
  // skipped the native <input type="color"> because Chrome's picker defaults to
  // RGB sliders and hides the hex field behind a tab. Jayme's workflow is "paste
  // a hex code and be done" — that's what this gives her.
  const [colorPopoverFor, setColorPopoverFor] = useState(null); // event_type whose hex picker is open
  const [hexInput, setHexInput] = useState('');                  // raw text the user is typing
  const popoverRef = useRef(null);

  // Accept "d5a36d", "#d5a36d", "DCE" etc. Returns "#d5a36d" or null if invalid.
  const normalizeHex = (raw) => {
    if (!raw) return null;
    const v = String(raw).trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(v)) return '#' + v.split('').map(c => c + c).join('');
    if (/^[0-9a-f]{6}$/.test(v)) return '#' + v;
    return null;
  };

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!colorPopoverFor) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setColorPopoverFor(null);
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setColorPopoverFor(null); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [colorPopoverFor]);

  const PROGRAM_LABELS = {
    'CLINIC': 'Clinics',
    'KIDS NIGHT OUT': 'KNOs',
    'OPEN GYM': 'Open Gym',
    'CAMP': 'Camps',
    'SPECIAL EVENT': 'Special',
  };
  // Fallback colors used only when an event_type row doesn't exist in DB
  // for that requirement (e.g. you added a custom requirement type that
  // isn't in event_types yet). Once the DB has the row, we use its color.
  const FALLBACK_COLORS = {
    'CLINIC':         '#8B5CF6',
    'KIDS NIGHT OUT': '#EC4899',
    'OPEN GYM':       '#10B981',
    'CAMP':           '#F59E0B',
    'SPECIAL EVENT':  '#64748B',
  };
  const FALLBACK_DEFAULT = '#8b6f6f';

  // Lookup helper: event_types DB rows keyed by name (uppercase to be safe)
  const eventTypeByName = {};
  (eventTypes || []).forEach(et => {
    const key = (et.name || et.event_type || '').toUpperCase();
    if (key) eventTypeByName[key] = et;
  });
  const colorForType = (type) => {
    const dbRow = eventTypeByName[(type || '').toUpperCase()];
    return dbRow?.color || FALLBACK_COLORS[type] || FALLBACK_DEFAULT;
  };

  const handleColorChange = async (type, newColor) => {
    const dbRow = eventTypeByName[(type || '').toUpperCase()];
    if (!dbRow?.id) {
      alert(`"${type}" isn't in your event_types table yet — color can't be saved permanently. Add it via the database first.`);
      return;
    }
    setSavingColor(type);
    try {
      await eventTypesApi.update(dbRow.id, { color: newColor });
      const refreshed = await eventTypesApi.getAll();
      onEventTypesChange?.(refreshed);
    } catch (err) {
      alert(`Failed to save color: ${err.message}`);
    } finally {
      setSavingColor(null);
    }
  };

  const entries = Object.entries(requirements || {});
  const configuredTypes = new Set(entries.map(([t]) => t));

  // Common program types we know about across the app — used as the picker
  // dropdown so you can add a requirement even if event_types table is sparse.
  // The custom text input below this list lets you add anything else.
  const KNOWN_PROGRAMS = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'CAMP', 'SPECIAL EVENT'];
  const dbEventTypes = (eventTypes || [])
    .map(et => (typeof et === 'string' ? et : et.name || et.event_type))
    .filter(Boolean);
  const allCandidateTypes = Array.from(new Set([...KNOWN_PROGRAMS, ...dbEventTypes]));
  const availableToAdd = allCandidateTypes.filter(t => !configuredTypes.has(t));

  const refreshFromDb = async () => {
    const rows = await monthlyRequirementsApi.getAll();
    const map = {};
    rows.forEach(r => { map[r.event_type] = r.required_count; });
    onChange?.(map);
  };

  const handleSaveEdit = async (eventType) => {
    const count = parseInt(editValue, 10);
    if (Number.isNaN(count) || count < 0) {
      setEditing(null);
      return;
    }
    setSaving(eventType);
    try {
      await monthlyRequirementsApi.upsert(eventType, count);
      await refreshFromDb();
      setEditing(null);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (eventType) => {
    if (!window.confirm(`Remove "${PROGRAM_LABELS[eventType] || eventType}" from monthly requirements?`)) return;
    setSaving(eventType);
    try {
      await monthlyRequirementsApi.delete(eventType);
      await refreshFromDb();
    } catch (err) {
      alert(`Failed to remove: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newType) return;
    const count = parseInt(newCount, 10);
    if (Number.isNaN(count) || count < 0) return;
    setSaving(newType);
    try {
      await monthlyRequirementsApi.upsert(newType, count);
      await refreshFromDb();
      setAdding(false);
      setNewType('');
      setNewCount('1');
    } catch (err) {
      alert(`Failed to add: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="py-4 px-4 sm:px-6 lg:px-8"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.18)',
        borderBottom: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      <div
        className="max-w-5xl mx-auto rounded-2xl px-5 py-4 flex items-center justify-center flex-wrap gap-3"
        style={{
          background: '#f7f3f3',
          border: '1px solid #c5b4b4',
          boxShadow: '0 10px 22px rgba(70,50,52,.22), inset 0 1px 0 rgba(255,255,255,.8)',
        }}
      >
        <span
          className="text-sm font-black uppercase tracking-wider mr-1 flex-shrink-0"
          style={{ color: '#6e5658' }}
        >
          📋 Monthly Requirements
        </span>

        {entries.length === 0 && !adding && (
          <span className="text-sm italic" style={{ color: '#9a8b8b' }}>
            None configured yet
          </span>
        )}

        {entries.map(([type, count]) => {
          const hex = colorForType(type);
          const color = colorTriple(hex);
          const label = PROGRAM_LABELS[type] || type;
          const isEditing = editing === type;
          const isSaving = saving === type;
          const isColorSaving = savingColor === type;
          const dbRow = eventTypeByName[(type || '').toUpperCase()];
          const canChangeColor = !!dbRow?.id;
          // (color triple computed above is used in both edit and display modes)
          if (isEditing) {
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold"
                style={{
                  background: color.bg,
                  borderColor: color.border,
                  color: color.text,
                  boxShadow: '0 2px 6px rgba(70,60,75,.14), inset 0 1px 0 rgba(255,255,255,.55)',
                }}
              >
                <span>{label}:</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit(type);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="w-14 px-1 py-0.5 rounded border text-center text-sm font-black bg-white"
                  style={{ borderColor: color.border, color: color.text }}
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(type)} disabled={isSaving} className="text-green-700 font-bold text-base px-1 disabled:opacity-30">✓</button>
                <button onClick={() => setEditing(null)} className="text-gray-500 px-1">✕</button>
              </span>
            );
          }

          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full border text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{
                background: color.bg,
                borderColor: color.border,
                color: color.text,
                boxShadow: '0 2px 6px rgba(70,60,75,.14), inset 0 1px 0 rgba(255,255,255,.55)',
              }}
            >
              {/* 1. Color circle — click opens a small popover with a HEX paste
                     field (NOT Chrome's native color picker, which defaults to
                     RGB sliders). Live preview as you type, Enter to save,
                     Escape or click outside to cancel. */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!canChangeColor || isColorSaving) return;
                    if (colorPopoverFor === type) {
                      setColorPopoverFor(null);
                    } else {
                      setColorPopoverFor(type);
                      setHexInput(hex.replace('#', ''));
                    }
                  }}
                  disabled={!canChangeColor || isColorSaving}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${isColorSaving ? 'animate-pulse' : ''} ${!canChangeColor ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ background: hex, borderColor: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                  title={canChangeColor ? `Change ${label} color (currently ${hex})` : `${label} isn't in event_types — color can't be edited`}
                  aria-label={`Open color picker for ${label}`}
                />

                {colorPopoverFor === type && (
                  <div
                    ref={popoverRef}
                    className="absolute top-full left-0 mt-2 z-50 rounded-lg border bg-white p-3 shadow-xl"
                    style={{ minWidth: '14rem', borderColor: '#c5b4b4', boxShadow: '0 8px 24px rgba(70,50,52,.28)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={{ color: '#6e5658' }}>
                      Paste a hex color for {label}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Live preview swatch — reflects what the input currently parses to */}
                      <div
                        className="w-7 h-7 rounded-full border-2 flex-shrink-0"
                        style={{
                          background: normalizeHex(hexInput) || hex,
                          borderColor: 'rgba(0,0,0,0.15)',
                        }}
                        title={normalizeHex(hexInput) ? `Preview: ${normalizeHex(hexInput)}` : 'Type a valid hex code'}
                      />
                      <span className="text-base font-black" style={{ color: '#6e5658' }}>#</span>
                      <input
                        type="text"
                        value={hexInput}
                        onChange={e => setHexInput(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const norm = normalizeHex(hexInput);
                            if (norm) {
                              handleColorChange(type, norm);
                              setColorPopoverFor(null);
                            }
                          }
                        }}
                        placeholder="d5a36d"
                        autoFocus
                        spellCheck={false}
                        className="flex-1 px-2 py-1 rounded border text-sm font-mono uppercase tracking-wider"
                        style={{ borderColor: '#c5b4b4', minWidth: '6rem' }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] italic" style={{ color: '#9a8b8b' }}>
                        3 or 6 hex chars • Enter to save • Esc to cancel
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setColorPopoverFor(null)}
                          className="px-2 py-1 rounded text-xs font-bold bg-gray-100 hover:bg-gray-200"
                          style={{ color: '#6e5658' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!normalizeHex(hexInput)}
                          onClick={() => {
                            const norm = normalizeHex(hexInput);
                            if (norm) {
                              handleColorChange(type, norm);
                              setColorPopoverFor(null);
                            }
                          }}
                          className="px-2 py-1 rounded text-xs font-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: '#6e936f' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Label + count — the COUNT itself is the click target for editing. */}
              <button
                onClick={() => { setEditing(type); setEditValue(String(count)); }}
                disabled={isSaving}
                className="inline-flex items-baseline gap-1.5 px-2 py-1 rounded-full hover:bg-white/60 transition-colors disabled:opacity-50 cursor-pointer"
                title={`Click to change ${label} required count (currently ${count})`}
              >
                <span>{label}</span>
                <span
                  className="font-black text-base px-1.5 rounded"
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                    minWidth: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              </button>

              {/* 3. Remove button — separate red-hover trash, far right. */}
              <button
                onClick={() => handleDelete(type)}
                disabled={isSaving}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-red-100 transition-colors disabled:opacity-30 flex-shrink-0"
                title={`Remove ${label}`}
                aria-label={`Remove ${label}`}
              >
                <span className="text-sm">🗑️</span>
              </button>
            </span>
          );
        })}

        {adding ? (
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white text-sm font-bold text-gray-700"
            style={{
              borderColor: '#8b6f6f',
              boxShadow: '0 2px 6px rgba(70,60,75,.14), inset 0 1px 0 rgba(255,255,255,.55)',
            }}
          >
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="text-sm font-bold bg-transparent outline-none cursor-pointer"
              autoFocus
            >
              <option value="">— pick program —</option>
              {availableToAdd.map(t => (
                <option key={t} value={t}>{PROGRAM_LABELS[t] || t}</option>
              ))}
              <option value="__custom__">Other (type below)…</option>
            </select>
            {newType === '__custom__' && (
              <input
                type="text"
                value={''}
                onChange={e => setNewType(e.target.value.toUpperCase())}
                placeholder="TYPE NAME"
                className="w-32 px-2 py-0.5 rounded border text-sm font-bold uppercase"
                style={{ borderColor: '#ccc' }}
              />
            )}
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-500">Required:</span>
            <input
              type="number"
              min="0"
              max="99"
              value={newCount}
              onChange={e => setNewCount(e.target.value)}
              className="w-14 px-1 py-0.5 rounded border text-center text-sm font-black"
              style={{ borderColor: '#ccc' }}
              placeholder="#"
            />
            <button
              onClick={handleAdd}
              disabled={!newType || newType === '__custom__'}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-black hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Save"
            >
              ✓
            </button>
            <button
              onClick={() => { setAdding(false); setNewType(''); setNewCount('1'); }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-400"
              title="Cancel"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-dashed text-sm font-black transition-all hover:bg-white hover:-translate-y-0.5"
            style={{ borderColor: '#8b6f6f', color: '#8b6f6f' }}
          >
            <span className="text-base leading-none">+</span>
            <span>Add Requirement</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  gyms,
  events,
  eventTypes,
  onEventTypesChange,
  monthlyRequirements,
  onMonthlyRequirementsChange,
  currentMonth,
  currentYear,
  initialCalendarMonth,
  initialTab,
  onClose,
  onOpenSyncModal,
  onOpenBulkImport,
}) {
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'rules');
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const SUPER_ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';

  // Listen for * key to toggle super admin
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '*') {
        if (superAdminMode) {
          setSuperAdminMode(false);
        } else {
          setShowPinModal(true);
          setPinInput('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [superAdminMode]);

  const handlePinSubmit = () => {
    if (pinInput === SUPER_ADMIN_PIN) {
      setSuperAdminMode(true);
      setShowPinModal(false);
      setPinInput('');
    } else {
      alert('Incorrect PIN');
      setPinInput('');
    }
  };

  const tabs = [
    { id: 'audit', label: '🚨 Errors', alwaysShow: true },
    { id: 'rules', label: '📏 Gym Rules', alwaysShow: true },
    { id: 'contacts', label: '✉️ Contacts', alwaysShow: true },
    { id: 'history', label: '📜 Change History', alwaysShow: true },
    { id: 'plans', label: '📅 Future Plans', alwaysShow: true },
    { id: 'actions', label: '⚡ Quick Actions', alwaysShow: true },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f5f5 0%, #f0ecec 100%)' }}>
      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              🔐 Super Admin Access
            </h3>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl tracking-widest mb-4 focus:border-purple-500 focus:outline-none"
              autoFocus
              maxLength={10}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePinSubmit}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: 'linear-gradient(135deg, #8b6f6f 0%, #a08080 50%, #b48f8f 100%)', boxShadow: '0 4px 20px rgba(139, 111, 111, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-auto py-3 sm:h-16 sm:py-0 flex-wrap sm:flex-nowrap gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={onClose}
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
              >
                ← <span className="hidden sm:inline">Back to Calendar</span><span className="sm:hidden">Back</span>
              </button>
              <div className="h-5 w-px bg-white/20 hidden sm:block"></div>
              <h1 className="text-base sm:text-xl font-bold text-white flex items-center gap-2 truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                <span className="hidden sm:inline">🪄 Admin Dashboard</span>
                <span className="sm:hidden">🪄 Admin</span>
                {superAdminMode ? (
                  <span className="text-[10px] sm:text-xs bg-red-500/20 text-red-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-semibold border border-red-400/30">🔐</span>
                ) : (
                  <span className="text-[10px] sm:text-xs bg-white/15 text-white/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-semibold border border-white/20">Admin</span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onOpenSyncModal}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.4)'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.3)'; }}
              >
                🔄 Sync
              </button>
              <button
                onClick={() => setShowEmailComposer(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              >
                ✉️ <span className="hidden sm:inline">Email Managers</span><span className="sm:hidden">Email</span>
              </button>
              {superAdminMode ? (
                <button onClick={() => setSuperAdminMode(false)} className="text-red-200 hover:text-white text-sm font-medium px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  Exit Super Admin
                </button>
              ) : (
                <button onClick={() => { setShowPinModal(true); setPinInput(''); }} className="text-white/50 hover:text-white text-xl px-2 py-1 hover:bg-white/10 rounded-lg transition-colors" title="Super Admin Access (or press *)">
                  🔐
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Requirements bar — foundational config visible on every tab */}
        <MonthlyRequirementsBar
          requirements={monthlyRequirements}
          eventTypes={eventTypes}
          onChange={onMonthlyRequirementsChange}
          onEventTypesChange={onEventTypesChange}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0.5 sm:gap-1 -mb-px overflow-x-auto pb-0 scrollbar-hide">
            {tabs.filter(t => t.alwaysShow).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-gray-800'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/10'
                }`}
                style={activeTab === tab.id ? { 
                  background: 'linear-gradient(180deg, #f8f5f5 0%, #f0ecec 100%)', 
                  boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
                } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeTab === 'audit' && (
          <AdminErrorsCenter gyms={gyms} events={events} />
        )}

        {activeTab === 'rules' && (
          <AdminGymRules gyms={gyms} />
        )}

        {activeTab === 'contacts' && (
          <AdminContacts gyms={gyms} />
        )}

        {activeTab === 'history' && (
          <AdminChangeHistory gyms={gyms} />
        )}

        {activeTab === 'plans' && (
          <AdminFuturePlans />
        )}

        {activeTab === 'actions' && (
          <AdminQuickActions
            superAdminMode={superAdminMode}
            onOpenSyncModal={onOpenSyncModal}
            onOpenBulkImport={onOpenBulkImport}
            onViewChangeHistory={() => setActiveTab('history')}
          />
        )}
      </div>

      {showEmailComposer && (
        <EmailComposer
          gyms={gyms}
          events={events}
          monthlyRequirements={monthlyRequirements}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onClose={() => setShowEmailComposer(false)}
        />
      )}
    </div>
  );
}
