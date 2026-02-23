import React, { useState, useEffect } from 'react';
import { eventPricingApi, campPricingApi } from '../../lib/api';

export default function AdminPricing({ gyms }) {
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
    loadEventPricing();
    loadCampPricing();
  }, []);

  const eventTypeStyles = {
    'CLINIC': { bg: '#F3E8FF', border: 'border-purple-300', text: 'text-purple-800' },
    'KIDS NIGHT OUT': { bg: '#FFCCCB', border: 'border-pink-300', text: 'text-pink-800' },
    'OPEN GYM': { bg: '#C8E6C9', border: 'border-green-300', text: 'text-green-800' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold text-gray-800">💰 Pricing</h2>
        <span className="text-sm text-gray-500">Event & Camp base prices for validation</span>
      </div>

      {/* Event Pricing — Clinic, KNO, Open Gym (base expected prices) */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
          <h3 className="font-bold text-amber-900 flex items-center gap-2">
            Event Pricing (Clinic, KNO, Open Gym)
            <span className="text-xs font-normal text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded-full shadow-sm">{eventPricing.length} rows</span>
          </h3>
          <p className="text-xs text-amber-800/90 mt-1">Base expected prices for validation. View, add, or delete below. Used for event_price_mismatch checks.</p>
        </div>
        <div className="p-4">
          {loadingEventPricing ? (
            <p className="text-sm text-amber-600 py-4 text-center">Loading...</p>
          ) : (
            <>
              {eventPricing.length === 0 && <p className="text-sm text-gray-500 py-2">No event pricing yet. Add below.</p>}
              <div className="space-y-1">
                {eventPricing.map(row => {
                  const style = eventTypeStyles[row.event_type] || { bg: '#f5f5f5', border: 'border-gray-200', text: 'text-gray-700' };
                  return (
                  <div key={row.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm shadow-sm" style={{ backgroundColor: style.bg }}>
                    <span className="font-medium text-gray-800">{row.gym_id}</span>
                    <span className={`font-medium ${style.text}`}>{row.event_type === 'KIDS NIGHT OUT' ? 'KNO' : row.event_type}</span>
                    <span className="font-bold text-green-700">${row.price}</span>
                    <span className="text-[10px] text-gray-400">{row.effective_date || '—'}{row.end_date ? ` → ${row.end_date}` : ''}</span>
                    {isCurrentPrice(row) && <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-[10px] rounded">current</span>}
                    <button
                      onClick={async () => {
                        if (!window.confirm('Delete this pricing row?')) return;
                        try {
                          await eventPricingApi.delete(row.id);
                          setEventPricing(prev => prev.filter(r => r.id !== row.id));
                        } catch (e) {
                          alert('Failed to delete.');
                        }
                      }}
                      className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs"
                    >
                      ✕
                    </button>
                  </div>
                );})}
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
                    <span className="text-xs font-semibold text-gray-600 mr-2">Type:</span>
                    {['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'].map(t => {
                      const s = eventTypeStyles[t] || {};
                      return (
                      <button
                        key={t}
                        onClick={() => setNewEventType(t)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium mr-1 border shadow-sm transition-all ${newEventType === t ? 'ring-2 ring-offset-1 ring-gray-400 scale-105' : 'opacity-80 hover:opacity-100'}`}
                        style={{ backgroundColor: s.bg || '#f5f5f5' }}
                      >
                        {t === 'KIDS NIGHT OUT' ? 'KNO' : t}
                      </button>
                    );})}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="number" value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} placeholder="Price" className="w-20 px-2 py-1.5 border rounded text-sm" />
                    <button
                      onClick={async () => {
                        if (!newEventGym || !newEventPrice) { alert('Gym and price required.'); return; }
                        try {
                          const created = await eventPricingApi.create({ gym_id: newEventGym, event_type: newEventType, price: newEventPrice });
                          setEventPricing(prev => [...prev, created]);
                          setNewEventPrice('');
                        } catch (e) { alert('Failed to add.'); }
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Camp Pricing — Full/Half Day Daily & Weekly */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde685 100%)' }}>
          <h3 className="font-bold text-amber-900 flex items-center gap-2">
            🏕️ Camp Pricing (Full Day / Half Day)
            <span className="text-xs font-normal text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full shadow-sm">{campPricing.length} gyms</span>
          </h3>
          <p className="text-xs text-amber-800/90 mt-1">Base expected camp prices for validation. One row per gym. Edit in Supabase camp_pricing table.</p>
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
