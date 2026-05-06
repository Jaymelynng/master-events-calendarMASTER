import React, { useState, useEffect } from 'react';
import AdminGymRules from './AdminGymRules';
import AdminPricing from './AdminPricing';
import AdminQuickActions from './AdminQuickActions';
import AdminChangeHistory from './AdminChangeHistory';
import EmailComposer from './EmailComposer';
import AdminFuturePlans from './AdminFuturePlans';
import { monthlyRequirementsApi } from '../../lib/api';

// ─── Monthly Requirements Bar (lives at top of Admin, above the tabs) ─────────
// Foundational concept: each gym must hit at least N events of certain
// program types per month. Adding/editing/removing here writes to the
// `monthly_requirements` Supabase table and bubbles the change up via
// onChange so the calendar (summary card + per-gym table) recalculates
// "complete vs missing" using the new threshold immediately.
function MonthlyRequirementsBar({ requirements, eventTypes, onChange }) {
  const [saving, setSaving] = useState(null); // event_type currently being saved
  const [editing, setEditing] = useState(null); // event_type being edited inline
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('');
  const [newCount, setNewCount] = useState('1');

  const PROGRAM_LABELS = {
    'CLINIC': 'Clinics',
    'KIDS NIGHT OUT': 'KNOs',
    'OPEN GYM': 'Open Gym',
    'CAMP': 'Camps',
    'SPECIAL EVENT': 'Special',
  };
  const PROGRAM_COLORS = {
    'CLINIC':         { bg: '#eadcf8', border: '#e1cff1', text: '#5a2980' },
    'KIDS NIGHT OUT': { bg: '#ffbfc0', border: '#f1aaaa', text: '#7a2a2c' },
    'OPEN GYM':       { bg: '#bee3c2', border: '#add5b2', text: '#1f6635' },
    'CAMP':           { bg: '#fde6c4', border: '#f4cf91', text: '#7a4a13' },
    'SPECIAL EVENT':  { bg: '#e0e7ef', border: '#c4cfdc', text: '#37475a' },
  };
  const fallbackColor = { bg: '#ececec', border: '#cfcfcf', text: '#444' };

  const entries = Object.entries(requirements || {});
  const configuredTypes = new Set(entries.map(([t]) => t));
  // Event types from the DB that aren't yet in monthly_requirements
  const availableToAdd = (eventTypes || [])
    .map(et => (typeof et === 'string' ? et : et.name || et.event_type))
    .filter(Boolean)
    .filter(t => !configuredTypes.has(t));

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
      className="border-b"
      style={{ background: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(6px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center flex-wrap gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/85 mr-2 flex-shrink-0">
          📋 Monthly Requirements
        </span>

        {entries.length === 0 && !adding && (
          <span className="text-xs text-white/70 italic">None configured yet</span>
        )}

        {entries.map(([type, count]) => {
          const color = PROGRAM_COLORS[type] || fallbackColor;
          const label = PROGRAM_LABELS[type] || type;
          const isEditing = editing === type;
          const isSaving = saving === type;

          if (isEditing) {
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold"
                style={{ background: color.bg, borderColor: color.border, color: color.text }}
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
                  className="w-12 px-1 py-0.5 rounded border text-center text-xs font-bold bg-white"
                  style={{ borderColor: color.border, color: color.text }}
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(type)} disabled={isSaving} className="text-green-700 font-bold px-1">✓</button>
                <button onClick={() => setEditing(null)} className="text-gray-500 px-1">✕</button>
              </span>
            );
          }

          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-shadow hover:shadow-sm"
              style={{ background: color.bg, borderColor: color.border, color: color.text }}
            >
              <button
                onClick={() => { setEditing(type); setEditValue(String(count)); }}
                disabled={isSaving}
                className="hover:underline cursor-pointer disabled:opacity-50"
                title="Click to edit count"
              >
                {label} <span className="font-black">{count}</span>
              </button>
              <button
                onClick={() => handleDelete(type)}
                disabled={isSaving}
                className="ml-0.5 text-[10px] opacity-50 hover:opacity-100 hover:text-red-700 disabled:opacity-30"
                title={`Remove ${label} from requirements`}
              >
                ✕
              </button>
            </span>
          );
        })}

        {adding ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white text-xs font-bold text-gray-700" style={{ borderColor: '#aaa' }}>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="text-xs font-bold bg-transparent outline-none"
              autoFocus
            >
              <option value="">Pick program…</option>
              {availableToAdd.map(t => (
                <option key={t} value={t}>{PROGRAM_LABELS[t] || t}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              max="99"
              value={newCount}
              onChange={e => setNewCount(e.target.value)}
              className="w-12 px-1 py-0.5 rounded border text-center text-xs font-bold"
              style={{ borderColor: '#ccc' }}
              placeholder="#"
            />
            <button onClick={handleAdd} disabled={!newType} className="text-green-700 font-bold px-1 disabled:opacity-30">✓</button>
            <button onClick={() => { setAdding(false); setNewType(''); setNewCount('1'); }} className="text-gray-500 px-1">✕</button>
          </span>
        ) : (
          availableToAdd.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed text-xs font-bold text-white/85 hover:text-white hover:bg-white/10 transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.45)' }}
            >
              + Add Requirement
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({
  gyms,
  events,
  eventTypes,
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
    { id: 'rules', label: '📏 Gym Rules', alwaysShow: true },
    { id: 'pricing', label: '💰 Pricing', alwaysShow: true },
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
        {activeTab === 'rules' && (
          <AdminGymRules gyms={gyms} />
        )}

        {activeTab === 'pricing' && (
          <AdminPricing gyms={gyms} />
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
