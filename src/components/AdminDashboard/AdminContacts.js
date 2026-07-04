// ============================================================================
// ADMIN CONTACTS — who error emails go to, per gym. Jayme manages these.
// Manager + Front Desk email per gym, plus one global CC (e.g. Kim).
// The "Email the Gym" button on each error uses these.
// ============================================================================
import React, { useState, useEffect } from 'react';
import { gymsApi, appConfigApi } from '../../lib/api';

export default function AdminContacts({ gyms: gymsProp, onGymsChange }) {
  const [gyms, setGyms] = useState(gymsProp || []);
  const [cc, setCc] = useState('');
  const [fromName, setFromName] = useState('');
  const [savingCc, setSavingCc] = useState(false);
  const [savingGym, setSavingGym] = useState(null); // gym id currently saving
  const [savedGym, setSavedGym] = useState(null);    // gym id that just saved (for the ✓)

  useEffect(() => {
    // Always pull fresh so contact fields are current
    gymsApi.getAll().then(setGyms).catch(() => {});
    appConfigApi.getAll().then(cfg => {
      setCc(cfg.error_email_cc || '');
      setFromName(cfg.error_email_from_name || 'Jayme');
    }).catch(() => {});
  }, []);

  const setField = (gymId, field, value) => {
    setGyms(prev => prev.map(g => g.id === gymId ? { ...g, [field]: value } : g));
  };

  const saveGym = async (gym) => {
    setSavingGym(gym.id);
    try {
      await gymsApi.update(gym.id, {
        manager_name: gym.manager_name || null,
        manager_email: gym.manager_email || null,
        front_desk_email: gym.front_desk_email || null,
      });
      setSavedGym(gym.id);
      setTimeout(() => setSavedGym(null), 1500);
      if (onGymsChange) { try { onGymsChange(await gymsApi.getAll()); } catch (e) {} }
    } catch (err) {
      alert(`Failed to save ${gym.id}: ${err.message}`);
    } finally {
      setSavingGym(null);
    }
  };

  const saveCc = async () => {
    setSavingCc(true);
    try {
      await appConfigApi.set('error_email_cc', cc.trim());
      await appConfigApi.set('error_email_from_name', (fromName || 'Jayme').trim());
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSavingCc(false);
    }
  };

  const input = "px-2 py-1.5 rounded-lg border text-sm w-full";
  const inputStyle = { borderColor: '#d8cccc' };

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h2 className="text-lg font-black" style={{ color: '#6e5658' }}>✉️ Contacts</h2>
        <p className="text-sm mt-0.5" style={{ color: '#9a8b8b' }}>
          Where the “Email the Gym” button sends error notifications. Emails send from YOUR Outlook — you review and hit send.
        </p>
      </div>

      {/* Global CC + signature */}
      <div className="rounded-xl border bg-white p-4 mb-5" style={{ borderColor: '#d8cccc', boxShadow: '0 2px 8px rgba(70,50,52,.08)' }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-black uppercase tracking-wide block mb-1" style={{ color: '#6e5658' }}>CC on every error email (e.g. Kim)</label>
            <input className={input} style={inputStyle} type="email" value={cc} onChange={e => setCc(e.target.value)} placeholder="kim@powersgym.com" />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wide block mb-1" style={{ color: '#6e5658' }}>Sign emails as</label>
            <input className={input} style={inputStyle} type="text" value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Jayme" />
          </div>
        </div>
        <button onClick={saveCc} disabled={savingCc}
          className="mt-3 px-4 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#6e936f' }}>
          {savingCc ? 'Saving…' : 'Save CC & Signature'}
        </button>
      </div>

      {/* Per-gym contacts */}
      <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#d8cccc', boxShadow: '0 2px 8px rgba(70,50,52,.08)' }}>
        <div className="grid grid-cols-[70px_1fr_1fr_1fr_90px] gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-wide"
          style={{ background: '#f7f3f3', color: '#6e5658' }}>
          <span>Gym</span><span>Manager name</span><span>Manager email</span><span>Front desk email</span><span></span>
        </div>
        {gyms.map(g => (
          <div key={g.id} className="grid grid-cols-[70px_1fr_1fr_1fr_90px] gap-2 px-3 py-2 items-center border-t" style={{ borderColor: '#f0e8e8' }}>
            <span className="text-sm font-black" style={{ color: '#8b6f6f' }}>{g.id}</span>
            <input className={input} style={inputStyle} value={g.manager_name || ''} onChange={e => setField(g.id, 'manager_name', e.target.value)} placeholder="Name" />
            <input className={input} style={inputStyle} type="email" value={g.manager_email || ''} onChange={e => setField(g.id, 'manager_email', e.target.value)} placeholder="manager@…" />
            <input className={input} style={inputStyle} type="email" value={g.front_desk_email || ''} onChange={e => setField(g.id, 'front_desk_email', e.target.value)} placeholder="frontdesk@…" />
            <button onClick={() => saveGym(g)} disabled={savingGym === g.id}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: savedGym === g.id ? '#6e936f' : '#8b6f6f' }}>
              {savingGym === g.id ? '…' : savedGym === g.id ? '✓ Saved' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
