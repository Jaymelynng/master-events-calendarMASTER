import React, { useState, useEffect, useCallback } from 'react';
import { rulesApi } from '../../lib/api';
import RuleWizard from './RuleWizard';

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

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  valid_price:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
  price:         { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
  sibling_price: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
  valid_time:    { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Time' },
  time:          { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Time' },
  program_synonym: { bg: 'bg-blue-100', text: 'text-blue-700',  label: 'Program' },
  exception:     { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Exception' },
  requirement_exception: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Exception' },
  // System check types
  check_date_mismatch:       { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Date' },
  check_year_mismatch:       { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Date' },
  check_impossible_date:     { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Date' },
  check_day_mismatch:        { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Date' },
  check_time_mismatch:       { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Time' },
  check_age_mismatch:        { bg: 'bg-pink-100',   text: 'text-pink-700',   label: 'Age' },
  check_program_mismatch:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Program' },
  check_title_desc_mismatch: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Program' },
  check_price_mismatch:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
  check_camp_price:          { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
  check_event_price:         { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Price' },
};

const FILTER_TYPE_MAP = {
  Date:      ['check_date_mismatch','check_year_mismatch','check_impossible_date','check_day_mismatch'],
  Program:   ['program_synonym','check_program_mismatch','check_title_desc_mismatch'],
  Age:       ['check_age_mismatch'],
  Price:     ['valid_price','price','sibling_price','check_price_mismatch','check_camp_price','check_event_price'],
  Time:      ['valid_time','time','check_time_mismatch'],
  System:    [], // handled separately via is_system flag
  Exception: ['exception','requirement_exception'],
};

const SYSTEM_CHECKS_SEED = [
  { rule_type: 'check_date_mismatch', label: 'Date/Month Mismatch', description: 'Month in title/description vs actual event dates', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_year_mismatch', label: 'Wrong Year', description: 'Year in title/description vs actual event year', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_time_mismatch', label: 'Time Mismatch', description: 'Time in title/description vs iClassPro time', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_age_mismatch', label: 'Age Mismatch', description: 'Age range in title/description vs iClassPro', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_program_mismatch', label: 'Program Type Mismatch', description: 'Program type cross-contamination between title/description and iClass type', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_title_desc_mismatch', label: 'Title vs Description Conflict', description: 'Title and description contradict each other on program type', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_impossible_date', label: 'Impossible Date', description: 'Dates that cannot exist (June 31st, Feb 30th)', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_price_mismatch', label: 'Price Mismatch (Title vs Description)', description: 'Price in title differs from price in description', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_day_mismatch', label: 'Day of Week Mismatch', description: 'Day of week in description vs actual event day', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_camp_price', label: 'Camp Price vs Pricing Table', description: 'Camp prices against valid prices in pricing table', gym_ids: ['ALL'], program: 'CAMP', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
  { rule_type: 'check_event_price', label: 'Event Price vs Pricing Table', description: 'Clinic/KNO/Open Gym prices against valid prices in pricing table', gym_ids: ['ALL'], program: 'ALL', is_system: true, is_permanent: true, is_active: true, created_by: 'system', scope: 'all_events', value: 'system_check' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTypeBadge(ruleType) {
  const cfg = TYPE_COLORS[ruleType] || { bg: 'bg-slate-100', text: 'text-slate-700', label: ruleType };
  return cfg;
}

function getRuleDisplayName(rule) {
  if (rule.label) return rule.label;
  if (rule.description) return rule.description;
  if (rule.rule_type === 'valid_price' || rule.rule_type === 'price') return `$${rule.value} is valid`;
  if (rule.rule_type === 'sibling_price') return `Sibling: $${rule.value} / $${rule.value_kid2} / $${rule.value_kid3}`;
  if (rule.rule_type === 'valid_time' || rule.rule_type === 'time') return `${rule.value} is valid`;
  if (rule.rule_type === 'program_synonym') return `"${rule.value}" = ${rule.label}`;
  if (rule.rule_type === 'exception') return rule.value;
  if (rule.rule_type === 'requirement_exception') return rule.value;
  return rule.rule_type;
}

function formatGymScope(rule) {
  const gymPart = (!rule.gym_ids || rule.gym_ids.length === 0 || rule.gym_ids.includes('ALL'))
    ? 'All Gyms'
    : rule.gym_ids.join(', ');
  const progPart = rule.program || 'ALL';
  return `${gymPart} · ${progPart}`;
}

function isRuleExpiringSoon(rule, days = 14) {
  if (rule.is_permanent || !rule.end_date) return false;
  const endMs = new Date(rule.end_date).getTime();
  const nowMs = Date.now();
  const diffDays = (endMs - nowMs) / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= days;
}

function isRuleExpired(rule) {
  if (rule.is_permanent || !rule.end_date) return false;
  return new Date(rule.end_date) < new Date(new Date().toISOString().split('T')[0]);
}

function isSystemRule(rule) {
  return rule.is_system === true || (rule.rule_type && rule.rule_type.startsWith('check_'));
}

function isExceptionRule(rule) {
  return rule.rule_type === 'exception' || rule.rule_type === 'requirement_exception';
}

function ruleMatchesGym(rule, gymId) {
  if (!rule.gym_ids || rule.gym_ids.length === 0) return true;
  if (rule.gym_ids.includes('ALL')) return true;
  return rule.gym_ids.includes(gymId);
}

function ruleMatchesTypeFilter(rule, activeTypes) {
  if (activeTypes.length === 0) return true;
  for (const filterName of activeTypes) {
    if (filterName === 'System' && isSystemRule(rule)) return true;
    const types = FILTER_TYPE_MAP[filterName] || [];
    if (types.includes(rule.rule_type)) return true;
  }
  return false;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminGymRules({ gyms }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [selectedGym, setSelectedGym] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilters, setTypeFilters] = useState([]);
  const [detailRule, setDetailRule] = useState(null);
  const [togglingIds, setTogglingIds] = useState(new Set());
  const [seeding, setSeeding] = useState(false);

  // ─── Load Rules ──────────────────────────────────────────────────────────
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rulesApi.getAllIncludeExpired();
      setRules(data);
    } catch (err) {
      console.error('Error loading rules:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  // ─── Toggle active ────────────────────────────────────────────────────────
  const handleToggle = async (rule) => {
    const newVal = rule.is_active === false ? true : false;
    setTogglingIds(prev => new Set(prev).add(rule.id));
    try {
      const updated = await rulesApi.update(rule.id, { is_active: newVal });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
      if (detailRule && detailRule.id === rule.id) setDetailRule(updated);
    } catch (err) {
      console.error('Error toggling rule:', err);
    }
    setTogglingIds(prev => { const n = new Set(prev); n.delete(rule.id); return n; });
  };

  // ─── Delete Rule ──────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule? Validation will start flagging this again on next sync.')) return;
    try {
      await rulesApi.delete(id);
      setRules(prev => prev.filter(r => r.id !== id));
      if (detailRule && detailRule.id === id) setDetailRule(null);
    } catch (err) {
      console.error('Error deleting rule:', err);
      alert('Failed to delete rule.');
    }
  };

  // ─── Save Rule (create or update via wizard) ─────────────────────────────
  const handleSaveRule = async (ruleData) => {
    try {
      if (editingRule) {
        const updated = await rulesApi.update(editingRule.id, ruleData);
        setRules(prev => prev.map(r => r.id === editingRule.id ? updated : r));
        if (detailRule && detailRule.id === editingRule.id) setDetailRule(updated);
      } else {
        const created = await rulesApi.create(ruleData);
        setRules(prev => [created, ...prev]);
      }
      setShowWizard(false);
      setEditingRule(null);
    } catch (err) {
      console.error('Error saving rule:', err);
      alert('Failed to save rule.');
    }
  };

  // ─── Seed System Checks ──────────────────────────────────────────────────
  const handleSeedSystemChecks = async () => {
    setSeeding(true);
    try {
      for (const seed of SYSTEM_CHECKS_SEED) {
        const created = await rulesApi.create(seed);
        setRules(prev => [created, ...prev]);
      }
    } catch (err) {
      console.error('Error seeding system checks:', err);
      alert('Failed to seed some system checks.');
    }
    setSeeding(false);
  };

  // ─── Computed Values ──────────────────────────────────────────────────────
  const activeRules = rules.filter(r => r.is_active !== false);
  const offRules = rules.filter(r => r.is_active === false);
  const expiringRules = rules.filter(r => isRuleExpiringSoon(r));
  const errorsCaught = rules.reduce((sum, r) => sum + (r.last_hit_count || 0), 0);

  // gym rule counts
  const gymRuleCounts = {};
  (gyms || []).forEach(g => { gymRuleCounts[g.id] = 0; });
  rules.forEach(r => {
    if (!r.gym_ids || r.gym_ids.includes('ALL')) {
      Object.keys(gymRuleCounts).forEach(k => { gymRuleCounts[k]++; });
    } else {
      r.gym_ids.forEach(gid => { if (gymRuleCounts[gid] !== undefined) gymRuleCounts[gid]++; });
    }
  });

  // Apply filters
  let filtered = rules;

  // Gym filter
  if (selectedGym !== 'ALL') {
    filtered = filtered.filter(r => ruleMatchesGym(r, selectedGym));
  }

  // Status filter
  if (statusFilter === 'Active') filtered = filtered.filter(r => r.is_active !== false);
  if (statusFilter === 'Off') filtered = filtered.filter(r => r.is_active === false);
  if (statusFilter === 'Expiring') filtered = filtered.filter(r => isRuleExpiringSoon(r));

  // Type filter
  if (typeFilters.length > 0) {
    filtered = filtered.filter(r => ruleMatchesTypeFilter(r, typeFilters));
  }

  // Group into sections
  const systemRules = filtered.filter(r => isSystemRule(r));
  const perGymRules = filtered.filter(r => !isSystemRule(r) && !isExceptionRule(r));
  const exceptionRules = filtered.filter(r => !isSystemRule(r) && isExceptionRule(r));

  const sectionActiveLabel = (sectionRules) => {
    const active = sectionRules.filter(r => r.is_active !== false).length;
    if (active === sectionRules.length) return 'All Active';
    return `${active} of ${sectionRules.length} Active`;
  };

  // Type filter counts
  const typeFilterCounts = {};
  const countableRules = selectedGym === 'ALL' ? rules : rules.filter(r => ruleMatchesGym(r, selectedGym));
  ['Date','Program','Age','Price','Time','System','Exception'].forEach(name => {
    if (name === 'System') {
      typeFilterCounts[name] = countableRules.filter(r => isSystemRule(r)).length;
    } else {
      const types = FILTER_TYPE_MAP[name] || [];
      typeFilterCounts[name] = countableRules.filter(r => types.includes(r.rule_type)).length;
    }
  });

  // Status counts (for pills)
  const statusCounts = {
    All: countableRules.length,
    Active: countableRules.filter(r => r.is_active !== false).length,
    Off: countableRules.filter(r => r.is_active === false).length,
    Expiring: countableRules.filter(r => isRuleExpiringSoon(r)).length,
  };

  const toggleTypeFilter = (name) => {
    setTypeFilters(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  };

  // ─── Empty State ──────────────────────────────────────────────────────────
  if (!loading && rules.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8 sm:p-12 text-center" style={{ background: 'linear-gradient(135deg, #f8f5f5, #f0ecec)', border: '2px dashed rgba(139,111,111,0.25)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)' }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">No Rules Yet</h3>
          <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
            Rules control how validation works. System checks catch data errors automatically.
            Custom rules tell the system what's valid for each gym.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleSeedSystemChecks}
              disabled={seeding}
              className="px-6 py-3 text-white rounded-xl text-sm font-semibold transition-all hover:translate-y-[-1px] inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)', boxShadow: '0 4px 14px rgba(139,111,111,0.3)' }}
            >
              {seeding ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Load System Checks
                </>
              )}
            </button>
            <button
              onClick={() => { setEditingRule(null); setShowWizard(true); }}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:translate-y-[-1px] inline-flex items-center justify-center gap-2"
              style={{ background: 'white', color: '#8b6f6f', border: '2px solid rgba(139,111,111,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            >
              <span className="text-lg leading-none">+</span> Create Custom Rule
            </button>
          </div>
        </div>
        {showWizard && (
          <RuleWizard
            gyms={gyms}
            prefill={editingRule || {}}
            onSave={handleSaveRule}
            onCancel={() => { setShowWizard(false); setEditingRule(null); }}
          />
        )}
      </div>
    );
  }

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-6 w-6 mr-3" style={{ color: '#8b6f6f' }} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        <span className="text-sm text-gray-500 font-medium">Loading rules...</span>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Rules', value: rules.length, color: '#8b6f6f' },
          { label: 'Active', value: activeRules.length, color: '#5a9a5a' },
          { label: 'Off', value: offRules.length, color: '#9ca3af' },
          { label: 'Errors Caught', value: errorsCaught, color: '#d97706' },
          { label: 'Expiring Soon', value: expiringRules.length, color: '#dc2626' },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-xl p-3.5 sm:p-4"
            style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div className="text-xs font-medium text-gray-500 mb-1">{card.label}</div>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main Layout: Sidebar + Content ─────────────────────────────── */}
      <div className="flex gap-4 min-h-0">
        {/* ── Left Sidebar: Gym Filter ───────────────────────────────── */}
        <div className="hidden sm:flex flex-col w-48 flex-shrink-0 rounded-xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gyms</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* All Gyms */}
            <button
              onClick={() => setSelectedGym('ALL')}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors ${selectedGym === 'ALL' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              style={selectedGym === 'ALL' ? { borderLeft: '3px solid #8b6f6f' } : { borderLeft: '3px solid transparent' }}
            >
              <span className={selectedGym === 'ALL' ? 'text-gray-900' : 'text-gray-600'}>All Gyms</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{rules.length}</span>
            </button>
            {/* Each gym */}
            {(gyms || []).sort((a, b) => a.id.localeCompare(b.id)).map(gym => {
              const count = gymRuleCounts[gym.id] || 0;
              const hasActive = rules.some(r => r.is_active !== false && ruleMatchesGym(r, gym.id));
              return (
                <button
                  key={gym.id}
                  onClick={() => setSelectedGym(gym.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${selectedGym === gym.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  style={selectedGym === gym.id ? { borderLeft: '3px solid #8b6f6f' } : { borderLeft: '3px solid transparent' }}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <span className={`font-medium ${selectedGym === gym.id ? 'text-gray-900' : 'text-gray-600'}`}>{gym.id}</span>
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{count}</span>
                </button>
              );
            })}
          </div>
          {/* + New Rule button */}
          <div className="p-3 border-t border-gray-100">
            <button
              onClick={() => { setEditingRule(null); setShowWizard(true); }}
              className="w-full px-3 py-2 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1 hover:translate-y-[-1px]"
              style={{ background: 'linear-gradient(135deg, #5a9a5a, #6b8e6b)', boxShadow: '0 2px 8px rgba(90,154,90,0.3)' }}
            >
              + New Rule
            </button>
          </div>
        </div>

        {/* ── Right Content Area ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Mobile gym selector */}
          <div className="sm:hidden">
            <select
              value={selectedGym}
              onChange={e => setSelectedGym(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="ALL">All Gyms ({rules.length})</option>
              {(gyms || []).sort((a, b) => a.id.localeCompare(b.id)).map(g => (
                <option key={g.id} value={g.id}>{g.id} ({gymRuleCounts[g.id] || 0})</option>
              ))}
            </select>
          </div>

          {/* Filter bar */}
          <div className="rounded-xl p-3" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
              {/* Status pills */}
              <div className="flex gap-1.5 flex-wrap">
                {['All','Active','Off','Expiring'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                    style={statusFilter === s ? { background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)', boxShadow: '0 2px 8px rgba(139,111,111,0.3)' } : {}}
                  >
                    {s} ({statusCounts[s]})
                  </button>
                ))}
              </div>
              {/* Type pills */}
              <div className="flex gap-1.5 flex-wrap">
                {['Date','Program','Age','Price','Time','System','Exception'].map(name => {
                  const active = typeFilters.includes(name);
                  const colorMap = {
                    Date: { bg: 'bg-purple-100', text: 'text-purple-700', activeBg: '#7c3aed' },
                    Program: { bg: 'bg-blue-100', text: 'text-blue-700', activeBg: '#2563eb' },
                    Age: { bg: 'bg-pink-100', text: 'text-pink-700', activeBg: '#db2777' },
                    Price: { bg: 'bg-green-100', text: 'text-green-700', activeBg: '#16a34a' },
                    Time: { bg: 'bg-amber-100', text: 'text-amber-700', activeBg: '#d97706' },
                    System: { bg: 'bg-slate-100', text: 'text-slate-700', activeBg: '#475569' },
                    Exception: { bg: 'bg-yellow-100', text: 'text-yellow-700', activeBg: '#ca8a04' },
                  };
                  const c = colorMap[name];
                  return (
                    <button
                      key={name}
                      onClick={() => toggleTypeFilter(name)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${active ? 'text-white' : `${c.bg} ${c.text}`}`}
                      style={active ? { background: c.activeBg } : {}}
                    >
                      {name} ({typeFilterCounts[name]})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile New Rule button */}
          <div className="sm:hidden">
            <button
              onClick={() => { setEditingRule(null); setShowWizard(true); }}
              className="w-full px-3 py-2.5 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1"
              style={{ background: 'linear-gradient(135deg, #5a9a5a, #6b8e6b)', boxShadow: '0 2px 8px rgba(90,154,90,0.3)' }}
            >
              + New Rule
            </button>
          </div>

          {/* Rule sections */}
          <div className="space-y-4 pb-4">
            {filtered.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="text-gray-400 text-sm">No rules match the current filters.</div>
              </div>
            ) : (
              <>
                {/* SYSTEM CHECKS */}
                {systemRules.length > 0 && (
                  <RuleSection
                    title="System Checks"
                    subtitle={sectionActiveLabel(systemRules)}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    borderColor="rgba(100,116,139,0.3)"
                    rules={systemRules}
                    onToggle={handleToggle}
                    onSelect={setDetailRule}
                    togglingIds={togglingIds}
                    selectedId={detailRule?.id}
                  />
                )}

                {/* PER-GYM RULES */}
                {perGymRules.length > 0 && (
                  <RuleSection
                    title="Per-Gym Rules"
                    subtitle={sectionActiveLabel(perGymRules)}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    borderColor="rgba(139,111,111,0.3)"
                    rules={perGymRules}
                    onToggle={handleToggle}
                    onSelect={setDetailRule}
                    togglingIds={togglingIds}
                    selectedId={detailRule?.id}
                  />
                )}

                {/* EXCEPTIONS */}
                {exceptionRules.length > 0 && (
                  <RuleSection
                    title="Exceptions"
                    subtitle={sectionActiveLabel(exceptionRules)}
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
                    borderColor="rgba(202,138,4,0.3)"
                    rules={exceptionRules}
                    onToggle={handleToggle}
                    onSelect={setDetailRule}
                    togglingIds={togglingIds}
                    selectedId={detailRule?.id}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Panel (slide in from right) ────────────────────────── */}
      {detailRule && (
        <DetailPanel
          rule={detailRule}
          onClose={() => setDetailRule(null)}
          onEdit={(rule) => { setEditingRule(rule); setShowWizard(true); }}
          onDelete={handleDelete}
          onToggle={handleToggle}
          toggling={togglingIds.has(detailRule.id)}
        />
      )}

      {/* ── Rule Wizard Modal ─────────────────────────────────────────── */}
      {showWizard && (
        <RuleWizard
          gyms={gyms}
          prefill={editingRule || {}}
          onSave={handleSaveRule}
          onCancel={() => { setShowWizard(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

// ─── Rule Section Component ──────────────────────────────────────────────────
function RuleSection({ title, subtitle, icon, borderColor, rules, onToggle, onSelect, togglingIds, selectedId }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderBottomColor: borderColor, background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,245,245,0.95))' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#8b6f6f' }}>{icon}</span>
          <h3 className="font-bold text-sm text-gray-800">{title}</h3>
          <span className="text-xs font-normal text-gray-400 px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>{rules.length}</span>
        </div>
        <span className="text-xs text-gray-500">{subtitle}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {rules.map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onToggle={onToggle}
            onSelect={onSelect}
            toggling={togglingIds.has(rule.id)}
            selected={selectedId === rule.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Rule Row Component ──────────────────────────────────────────────────────
function RuleRow({ rule, onToggle, onSelect, toggling, selected }) {
  const badge = getTypeBadge(rule.rule_type);
  const displayName = getRuleDisplayName(rule);
  const scope = formatGymScope(rule);
  const hitCount = rule.last_hit_count || 0;
  const isOff = rule.is_active === false;
  const expired = isRuleExpired(rule);
  const expiring = isRuleExpiringSoon(rule);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group ${selected ? 'bg-gray-50' : 'hover:bg-gray-50/60'} ${expired ? 'opacity-50' : ''}`}
      onClick={() => onSelect(rule)}
    >
      {/* Type badge */}
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>

      {/* Name + scope */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{displayName}</div>
        <div className="text-xs text-gray-400 truncate flex items-center gap-1.5">
          <span>{scope}</span>
          {expiring && (
            <span className="text-red-500 font-medium">
              · Expires {rule.end_date}
            </span>
          )}
          {expired && (
            <span className="text-red-400 font-medium">· Expired</span>
          )}
        </div>
      </div>

      {/* Hit count */}
      <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
        {hitCount > 0 ? (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{hitCount} caught</span>
        ) : (
          <span className="text-xs text-gray-300 px-2 py-0.5">0 caught</span>
        )}
      </div>

      {/* Toggle */}
      <div className="flex-shrink-0" onClick={e => { e.stopPropagation(); onToggle(rule); }}>
        <Toggle checked={!isOff} onChange={() => {}} disabled={toggling} />
      </div>
    </div>
  );
}

// ─── Detail Panel Component ──────────────────────────────────────────────────
function DetailPanel({ rule, onClose, onEdit, onDelete, onToggle, toggling }) {
  const badge = getTypeBadge(rule.rule_type);
  const expired = isRuleExpired(rule);

  const fieldRows = [
    { label: 'Rule Type', value: rule.rule_type },
    { label: 'Gym(s)', value: (!rule.gym_ids || rule.gym_ids.includes('ALL')) ? 'All Gyms' : rule.gym_ids.join(', ') },
    { label: 'Program', value: rule.program || 'ALL' },
    { label: 'Scope', value: rule.scope || 'all_events' },
    rule.keyword ? { label: 'Keyword', value: `"${rule.keyword}"` } : null,
    { label: 'Value', value: rule.value || '(none)' },
    rule.value_kid2 ? { label: 'Kid 2 Price', value: `$${rule.value_kid2}` } : null,
    rule.value_kid3 ? { label: 'Kid 3 Price', value: `$${rule.value_kid3}` } : null,
    rule.label ? { label: 'Label', value: rule.label } : null,
    rule.description ? { label: 'Description', value: rule.description } : null,
    rule.note ? { label: 'Note', value: rule.note } : null,
    { label: 'Duration', value: rule.is_permanent ? 'Permanent' : `${rule.start_date || '?'} to ${rule.end_date || '?'}` },
    { label: 'Status', value: rule.is_active === false ? 'Off' : (expired ? 'Expired' : 'Active') },
    { label: 'Created By', value: rule.created_by || 'manual' },
    rule.created_at ? { label: 'Created', value: new Date(rule.created_at).toLocaleDateString() } : null,
    rule.last_hit_count ? { label: 'Errors Caught', value: rule.last_hit_count } : null,
  ].filter(Boolean);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[65] w-full sm:w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, rgba(248,245,245,1), rgba(240,236,236,1))' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${badge.bg} ${badge.text}`}>{badge.label}</span>
            <h3 className="font-bold text-gray-800 text-sm truncate">{getRuleDisplayName(rule)}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Toggle row */}
          <div className="flex items-center justify-between mb-5 p-3 rounded-lg" style={{ background: rule.is_active === false ? '#fef2f2' : '#f0fdf4' }}>
            <span className="text-sm font-medium" style={{ color: rule.is_active === false ? '#dc2626' : '#16a34a' }}>
              {rule.is_active === false ? 'Rule is OFF' : 'Rule is ON'}
            </span>
            <Toggle checked={rule.is_active !== false} onChange={() => onToggle(rule)} disabled={toggling} />
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {fieldRows.map((row, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-xs font-medium text-gray-400 w-24 flex-shrink-0 pt-0.5">{row.label}</div>
                <div className="text-sm text-gray-800 flex-1 break-words">{row.value}</div>
              </div>
            ))}
          </div>

          {/* Preview placeholder */}
          <div className="mt-6 p-4 rounded-lg border border-dashed border-gray-200 bg-gray-50">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Preview</div>
            <div className="text-xs text-gray-400">Affected events preview coming soon.</div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => { onClose(); onEdit(rule); }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all text-white hover:translate-y-[-1px]"
            style={{ background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)', boxShadow: '0 2px 8px rgba(139,111,111,0.3)' }}
          >
            Edit Rule
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all text-red-600 bg-red-50 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
