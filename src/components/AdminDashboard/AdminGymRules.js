import React, { useState, useEffect } from 'react';
import { rulesApi } from '../../lib/api';
import RuleWizard from './RuleWizard';

export default function AdminGymRules({ gyms }) {
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const data = await rulesApi.getAllIncludeExpired();
      setRules(data);
    } catch (err) {
      console.error('Error loading rules:', err);
    }
    setLoadingRules(false);
  };

  useEffect(() => { loadRules(); }, []);

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this rule? Validation will start flagging this again on next sync.')) return;
    try {
      await rulesApi.delete(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting rule:', err);
      alert('Failed to delete rule.');
    }
  };

  const handleSaveRule = async (ruleData) => {
    try {
      if (editingRule) {
        const updated = await rulesApi.update(editingRule.id, ruleData);
        setRules(prev => prev.map(r => r.id === editingRule.id ? updated : r));
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

  const today = new Date().toISOString().split('T')[0];
  const isExpired = (rule) => !rule.is_permanent && rule.end_date && rule.end_date < today;

  const filteredRules = rules.filter(r => {
    if (filter === 'permanent') return r.is_permanent;
    if (filter === 'temporary') return !r.is_permanent && !isExpired(r);
    if (filter === 'exceptions') return r.rule_type === 'exception';
    if (filter === 'expired') return isExpired(r);
    return true;
  });

  const permanentRules = filteredRules.filter(r => r.is_permanent && r.rule_type !== 'exception');
  const tempRules = filteredRules.filter(r => !r.is_permanent && !isExpired(r) && r.rule_type !== 'exception');
  const exceptions = filteredRules.filter(r => r.rule_type === 'exception' && !isExpired(r));
  const expiredRules = filteredRules.filter(r => isExpired(r));

  const ruleTypeColor = (type) => {
    if (type === 'valid_price' || type === 'price') return 'bg-green-100 text-green-700';
    if (type === 'sibling_price') return 'bg-emerald-100 text-emerald-700';
    if (type === 'valid_time' || type === 'time') return 'bg-purple-100 text-purple-700';
    if (type === 'program_synonym') return 'bg-orange-100 text-orange-700';
    if (type === 'requirement_exception') return 'bg-slate-100 text-slate-700';
    if (type === 'exception') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const ruleTypeLabel = (type) => {
    if (type === 'valid_price' || type === 'price') return 'Price';
    if (type === 'sibling_price') return 'Sibling Pricing';
    if (type === 'valid_time' || type === 'time') return 'Time';
    if (type === 'program_synonym') return 'Program Name';
    if (type === 'requirement_exception') return 'Requirement Excused';
    if (type === 'exception') return 'Exception';
    return type;
  };

  const formatGyms = (gymIds) => {
    if (!gymIds || gymIds.length === 0) return 'Unknown';
    if (gymIds.includes('ALL')) return 'All Gyms';
    return gymIds.join(', ');
  };

  const formatScope = (rule) => {
    if (rule.scope === 'keyword' && rule.keyword) return `Title contains "${rule.keyword}"`;
    if (rule.scope === 'single_event') return 'Single event';
    return 'All events';
  };

  const RuleCard = ({ rule }) => (
    <div 
      className={`flex items-start justify-between gap-3 p-3.5 rounded-lg text-sm transition-all ${isExpired(rule) ? 'opacity-50' : 'hover:translate-y-[-1px]'}`}
      style={{ 
        background: isExpired(rule) ? '#fafafa' : 'white', 
        boxShadow: isExpired(rule) ? 'none' : '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.06)'
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ruleTypeColor(rule.rule_type)}`}>
            {ruleTypeLabel(rule.rule_type)}
          </span>
          <span className="text-xs font-medium text-gray-500">{formatGyms(rule.gym_ids)}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{rule.program || 'ALL'}</span>
          {rule.scope === 'keyword' && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-blue-600 font-medium">"{rule.keyword}"</span>
            </>
          )}
          {rule.scope === 'single_event' && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-amber-600 font-medium">Single event</span>
            </>
          )}
          {!rule.is_permanent && rule.end_date && (
            <>
              <span className="text-xs text-gray-400">•</span>
              <span className={`text-xs font-medium ${isExpired(rule) ? 'text-red-500' : 'text-blue-600'}`}>
                {isExpired(rule) ? `Expired ${rule.end_date}` : `Ends ${rule.end_date}`}
              </span>
            </>
          )}
        </div>
        <div className="text-sm text-gray-800">
          {rule.rule_type === 'sibling_price' ? (
            <span>Kid 1: <strong>${rule.value}</strong> • Kid 2: <strong>${rule.value_kid2}</strong> • Kid 3: <strong>${rule.value_kid3}</strong></span>
          ) : rule.rule_type === 'valid_price' || rule.rule_type === 'price' ? (
            <span><strong>${rule.value}</strong> is valid</span>
          ) : rule.rule_type === 'program_synonym' ? (
            <span>"{rule.value}" = <strong>{rule.label}</strong></span>
          ) : (
            <span>{rule.value}</span>
          )}
        </div>
        {rule.label && rule.rule_type !== 'program_synonym' && (
          <div className="text-xs text-gray-500 mt-0.5">{rule.label}</div>
        )}
        {rule.note && (
          <div className="text-xs text-gray-400 mt-0.5 italic">Note: {rule.note}</div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => { setEditingRule(rule); setShowWizard(true); }}
          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-medium transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => handleDeleteRule(rule.id)}
          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-medium transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const Section = ({ title, icon, count, color, children }) => (
    count > 0 && (
      <div className="rounded-xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className={`px-5 py-3.5 border-b ${color}`} style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,245,245,0.9))' }}>
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
            {icon} {title}
            <span className="text-xs font-normal text-gray-500 px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>{count}</span>
          </h3>
        </div>
        <div className="p-3 space-y-2">{children}</div>
      </div>
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {[
            { v: 'all', l: 'All', c: rules.length },
            { v: 'permanent', l: 'Permanent', c: rules.filter(r => r.is_permanent).length },
            { v: 'temporary', l: 'Temporary', c: rules.filter(r => !r.is_permanent && !isExpired(r)).length },
            { v: 'exceptions', l: 'Exceptions', c: rules.filter(r => r.rule_type === 'exception').length },
            { v: 'expired', l: 'Expired', c: rules.filter(r => isExpired(r)).length },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === f.v ? 'text-white' : 'text-gray-600 hover:bg-gray-200'}`}
              style={filter === f.v ? { background: 'linear-gradient(135deg, #8b6f6f, #b48f8f)', boxShadow: '0 2px 8px rgba(139,111,111,0.3)' } : { background: 'rgba(0,0,0,0.04)' }}
            >
              {f.l} ({f.c})
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingRule(null); setShowWizard(true); }}
              className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-1 hover:translate-y-[-1px]"
              style={{ background: 'linear-gradient(135deg, #5a9a5a, #6b8e6b)', boxShadow: '0 2px 10px rgba(90,154,90,0.3)' }}
        >
          + New Rule
        </button>
      </div>

      {loadingRules ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading rules...</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-gray-600 font-medium">No rules yet</div>
          <div className="text-sm text-gray-400 mt-1">Click "+ New Rule" to create your first validation rule</div>
        </div>
      ) : (
        <div className="space-y-4">
          <Section title="Permanent Rules" icon="🔒" count={permanentRules.length} color="border-blue-200">
            {permanentRules.map(r => <RuleCard key={r.id} rule={r} />)}
          </Section>

          <Section title="Temporary Rules" icon="⏱️" count={tempRules.length} color="border-amber-200">
            {tempRules.map(r => <RuleCard key={r.id} rule={r} />)}
          </Section>

          <Section title="Event Exceptions" icon="✓" count={exceptions.length} color="border-green-200">
            {exceptions.map(r => <RuleCard key={r.id} rule={r} />)}
          </Section>

          <Section title="Expired" icon="📦" count={expiredRules.length} color="border-gray-200">
            {expiredRules.map(r => <RuleCard key={r.id} rule={r} />)}
          </Section>
        </div>
      )}

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
