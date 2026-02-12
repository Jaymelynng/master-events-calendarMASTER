import React, { useState, useEffect } from 'react';
import { gymValidValuesApi, eventPricingApi, campPricingApi } from '../../lib/api';

export default function AdminGymRules({ gyms }) {
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newRuleGym, setNewRuleGym] = useState('');
  const [newRuleType, setNewRuleType] = useState('price');
  const [newRuleEventType, setNewRuleEventType] = useState('CAMP');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');

  const [eventPricing, setEventPricing] = useState([]);
  const [loadingEventPricing, setLoadingEventPricing] = useState(false);
  const [newEventGym, setNewEventGym] = useState('');
  const [newEventType, setNewEventType] = useState('CLINIC');
  const [newEventPrice, setNewEventPrice] = useState('');
  const [campPricing, setCampPricing] = useState([]);
  const [loadingCampPricing, setLoadingCampPricing] = useState(false);

  const gymList = (gyms || []).map(g => ({ id: g.id, name: g.name })).sort((a, b) => a.id.localeCompare(b.id));

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentPrice = (row) => {
    const eff = row.effective_date || '';
    const end = row.end_date;
    return eff <= today && (!end || end >= today);
  };

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const data = await gymValidValuesApi.getAll();
      setRules(data);
    } catch (err) {
      console.error('Error loading rules:', err);
    }
    setLoadingRules(false);
  };

  const loadEventPricing = async () => {
    setLoadingEventPricing(true);
    try {
      const data = await eventPricingApi.getAll();
      setEventPricing(data || []);
    } catch (err) {
      console.error('Error loading event pricing:', err);
    }
    setLoadingEventPricing(false);
  };
  const loadCampPricing = async () => {
    setLoadingCampPricing(true);
    try {
      const data = await campPricingApi.getAll();
      setCampPricing(data || []);
    } catch (err) {
      console.error('Error loading camp pricing:', err);
    }
    setLoadingCampPricing(false);
  };

  useEffect(() => {
    loadRules();
    loadEventPricing();
    loadCampPricing();
  }, []);

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this rule? The validation check will start flagging this value again on next sync.')) return;
    try {
      await gymValidValuesApi.delete(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting rule:', err);
      alert('Failed to delete rule.');
    }
  };

  const handleAddRule = async () => {
    if (!newRuleGym || !newRuleValue.trim() || !newRuleLabel.trim()) {
      alert('Please fill in gym, value, and label.');
      return;
    }
    try {
      const eventType = newRuleType === 'program_synonym' ? newRuleLabel.trim().toUpperCase() : newRuleEventType;
      const created = await gymValidValuesApi.create({
        gym_id: newRuleGym,
        rule_type: newRuleType,
        value: newRuleValue.trim().toLowerCase(),
        label: newRuleLabel.trim(),
        event_type: eventType
      });
      setRules([...rules, created]);
      setNewRuleValue('');
      setNewRuleLabel('');
    } catch (err) {
      console.error('Error adding rule:', err);
      alert('Failed to add rule. It may already exist.');
    }
  };

  // Group rules by gym
  const rulesByGym = rules.reduce((acc, rule) => {
    const key = rule.gym_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});

  const gymOrder = Object.keys(rulesByGym).sort((a, b) => {
    if (a === 'ALL') return -1;
    if (b === 'ALL') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {/* Existing Rules */}
      <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
        <div className="px-5 py-4 bg-blue-50 border-b border-blue-200">
          <h3 className="font-bold text-blue-800 flex items-center gap-2">
            📋 All Gym Rules
            <span className="text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{rules.length} rules</span>
          </h3>
          <p className="text-xs text-blue-600 mt-1">Prices, times, and program synonyms per gym. Rules suppress validation errors during sync.</p>
          {gymOrder.length > 0 && (
            <p className="text-xs font-medium text-blue-700 mt-2">
              Gyms with rules: {gymOrder.join(', ')} — others (CCP, HGA, etc.) only appear in the “Add New Rule” dropdown if you want to add a rule for them.
            </p>
          )}
        </div>

        <div className="p-4">
          {loadingRules ? (
            <p className="text-sm text-blue-600 py-4 text-center">Loading rules...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No rules yet. Add rules here or click "+ Rule" on validation errors during sync.</p>
          ) : (
            <div className="space-y-4">
              {gymOrder.map(gymId => (
                <div key={gymId}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                      {gymId === 'ALL' ? '🌐 ALL (Global)' : gymId}
                    </span>
                    <span className="text-xs text-gray-400">{rulesByGym[gymId].length} rule{rulesByGym[gymId].length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-1 ml-2">
                    {rulesByGym[gymId].map(rule => (
                      <div key={rule.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm hover:bg-gray-100 transition-colors">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${
                            rule.rule_type === 'price' ? 'text-green-700' :
                            rule.rule_type === 'program_synonym' ? 'text-orange-700' :
                            'text-purple-700'
                          }`}>
                            {rule.rule_type === 'price' ? `$${rule.value}` : rule.value}
                          </span>
                          <span className="text-gray-400">=</span>
                          <span className="text-gray-700">"{rule.label}"</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            rule.rule_type === 'price' ? 'bg-green-100 text-green-600' :
                            rule.rule_type === 'program_synonym' ? 'bg-orange-100 text-orange-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {rule.rule_type === 'program_synonym' ? 'synonym' : rule.rule_type}
                          </span>
                          <span className="text-gray-400 text-[10px]">({rule.event_type})</span>
                        </span>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors text-sm"
                          title="Delete this rule"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add New Rule Form */}
      <div className="bg-white rounded-xl border-2 border-green-200 overflow-hidden">
        <div className="px-5 py-4 bg-green-50 border-b border-green-200">
          <h3 className="font-bold text-green-800 flex items-center gap-2">
            ➕ Add New Rule
          </h3>
          <p className="text-xs text-green-600 mt-1">Manually add a validation rule. You can also add rules from the Audit & Review tab.</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <span className="text-xs font-semibold text-gray-600 block mb-1">Gym</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setNewRuleGym('ALL')}
                className={`px-2 py-1 rounded text-xs font-medium ${newRuleGym === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                ALL (Global)
              </button>
              {gymList.map(g => (
                <button
                  key={g.id}
                  onClick={() => setNewRuleGym(g.id)}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${newRuleGym === g.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {g.id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-600 block mb-1">Rule type</span>
            <div className="flex gap-1">
              {['price', 'time', 'program_synonym'].map(t => (
                <button
                  key={t}
                  onClick={() => setNewRuleType(t)}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${newRuleType === t ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                >
                  {t === 'program_synonym' ? 'Program Synonym' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {newRuleType !== 'program_synonym' && (
            <div>
              <span className="text-xs font-semibold text-gray-600 block mb-1">Program</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: 'CAMP', label: 'CAMP' },
                  { value: 'CLINIC', label: 'CLINIC' },
                  { value: 'KIDS NIGHT OUT', label: 'KNO' },
                  { value: 'OPEN GYM', label: 'OPEN GYM' },
                  { value: 'ALL', label: 'ALL' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setNewRuleEventType(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-medium ${newRuleEventType === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={newRuleValue}
              onChange={(e) => setNewRuleValue(e.target.value)}
              placeholder={newRuleType === 'price' ? '20' : newRuleType === 'program_synonym' ? 'Gym Fun Friday' : '8:30 AM'}
              className="px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
            />
            <input
              type="text"
              value={newRuleLabel}
              onChange={(e) => setNewRuleLabel(e.target.value)}
              placeholder={newRuleType === 'program_synonym' ? 'OPEN GYM' : 'Before Care'}
              className="px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
            />
            <button
              onClick={handleAddRule}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              + Add Rule
            </button>
          </div>
        </div>
      </div>

      {/* Event Pricing — Clinic, KNO, Open Gym (base expected prices) */}
      <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-200">
          <h3 className="font-bold text-amber-800 flex items-center gap-2">
            💰 Event Pricing (Clinic, KNO, Open Gym)
            <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{eventPricing.length} rows</span>
          </h3>
          <p className="text-xs text-amber-600 mt-1">Base expected prices for validation. View, add, or delete below. Used for event_price_mismatch checks.</p>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          {loadingEventPricing ? (
            <p className="text-sm text-amber-600 py-4 text-center">Loading...</p>
          ) : (
            <>
            {eventPricing.length === 0 && <p className="text-sm text-gray-500 py-2">No event pricing yet. Add below.</p>}
            <div className="space-y-1">
              {eventPricing.map(row => (
                <div key={row.id} className="flex items-center justify-between gap-2 p-2 bg-amber-50 rounded border text-sm">
                  <span className="font-medium text-amber-800">{row.gym_id}</span>
                  <span className="text-gray-600">{row.event_type}</span>
                  <span className="font-bold text-green-700">${row.price}</span>
                  <span className="text-[10px] text-gray-400">{row.effective_date || '—'}{row.end_date ? ` → ${row.end_date}` : ''}</span>
                  {isCurrentPrice(row) && <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-[10px] rounded">current</span>}
                  <button
                    onClick={async () => {
                      if (!window.confirm('Delete this pricing row?')) return;
                      try {
                        await eventPricingApi.delete(row.id);
                        setEventPricing(eventPricing.filter(r => r.id !== row.id));
                      } catch (e) {
                        alert('Failed to delete.');
                      }
                    }}
                    className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-2">➕ Add Event Pricing</p>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-amber-700 mr-2">Gym:</span>
                  <div className="flex flex-wrap gap-1 inline">
                    {gymList.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setNewEventGym(g.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${newEventGym === g.id ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                      >
                        {g.id}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-amber-700 mr-2">Type:</span>
                  {['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'].map(t => (
                    <button
                      key={t}
                      onClick={() => setNewEventType(t)}
                      className={`px-2 py-0.5 rounded text-xs font-medium mr-1 ${newEventType === t ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                    >
                      {t === 'KIDS NIGHT OUT' ? 'KNO' : t}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input type="number" value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} placeholder="Price" className="w-20 px-2 py-1.5 border rounded text-sm" />
                <button
                  onClick={async () => {
                    if (!newEventGym || !newEventPrice) { alert('Gym and price required.'); return; }
                    try {
                      const created = await eventPricingApi.create({ gym_id: newEventGym, event_type: newEventType, price: newEventPrice });
                      setEventPricing([...eventPricing, created]);
                      setNewEventPrice('');
                    } catch (e) { alert('Failed to add.'); }
                  }}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700"
                >
                  Add
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Camp Pricing — Full/Half Day Daily & Weekly */}
      <div className="bg-white rounded-xl border-2 border-emerald-200 overflow-hidden">
        <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-200">
          <h3 className="font-bold text-emerald-800 flex items-center gap-2">
            🏕️ Camp Pricing (Full Day / Half Day)
            <span className="text-xs font-normal text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{campPricing.length} gyms</span>
          </h3>
          <p className="text-xs text-emerald-600 mt-1">Base expected camp prices for validation. One row per gym. Edit in Supabase camp_pricing table.</p>
        </div>
        <div className="p-4 overflow-x-auto">
          {loadingCampPricing ? (
            <p className="text-sm text-emerald-600 py-4 text-center">Loading...</p>
          ) : campPricing.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No camp pricing. Add rows in Supabase camp_pricing table.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-200">
                  <th className="text-left py-2 font-semibold text-emerald-800">Gym</th>
                  <th className="text-right py-2">FD Daily</th>
                  <th className="text-right py-2">FD Weekly</th>
                  <th className="text-right py-2">HD Daily</th>
                  <th className="text-right py-2">HD Weekly</th>
                </tr>
              </thead>
              <tbody>
                {campPricing.map(row => (
                  <tr key={row.gym_id} className="border-b border-emerald-100 hover:bg-emerald-50">
                    <td className="py-1.5 font-medium">{row.gym_id}</td>
                    <td className="text-right">${row.full_day_daily ?? '—'}</td>
                    <td className="text-right">${row.full_day_weekly ?? '—'}</td>
                    <td className="text-right">${row.half_day_daily ?? '—'}</td>
                    <td className="text-right">${row.half_day_weekly ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
