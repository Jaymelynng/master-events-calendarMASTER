import React, { useState, useEffect } from 'react';
import { gymValidValuesApi } from '../../lib/api';

export default function AdminPortalModal({
  onClose,
  onOpenBulkImport,
  onOpenSyncModal,
  onOpenAuditHistory,
  gyms,
}) {
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  // New rule form
  const [newRuleGym, setNewRuleGym] = useState('');
  const [newRuleType, setNewRuleType] = useState('price');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  
  // PIN from environment variable (fallback for local dev)
  const SUPER_ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';

  // Listen for * key to open PIN modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '*') {
        if (superAdminMode) {
          // Already in super admin, toggle off
          setSuperAdminMode(false);
        } else {
          // Show PIN modal
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
      const created = await gymValidValuesApi.create({
        gym_id: newRuleGym,
        rule_type: newRuleType,
        value: newRuleValue.trim(),
        label: newRuleLabel.trim(),
        event_type: 'CAMP'
      });
      setRules([...rules, created]);
      setNewRuleValue('');
      setNewRuleLabel('');
    } catch (err) {
      console.error('Error adding rule:', err);
      alert('Failed to add rule. It may already exist.');
    }
  };

  // Load rules when panel is opened
  useEffect(() => {
    if (showRules) loadRules();
  }, [showRules]);

  // Get gym list for dropdown (gyms is an array of {id, name} objects from Supabase)
  const gymList = (gyms || []).map(g => ({ id: g.id, name: g.name })).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-lg p-6 w-80 shadow-2xl">
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

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-hidden">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-3">
              🪄 Admin Control Center
              {superAdminMode ? (
                <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">🔐 Super Admin</span>
              ) : (
                <span className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Admin</span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {!superAdminMode && (
                <button
                  onClick={() => { setShowPinModal(true); setPinInput(''); }}
                  className="text-gray-400 hover:text-purple-600 text-xl"
                  title="Super Admin Access (or press *)"
                >
                  🔐
                </button>
              )}
              {superAdminMode && (
                <button
                  onClick={() => setSuperAdminMode(false)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Exit Super Admin
                </button>
              )}
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
            </div>
          </div>

          {/* Super Admin Section - Only visible with PIN */}
          {superAdminMode && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-2 border-red-300 shadow-sm">
              <h3 className="font-bold text-red-800 text-sm mb-3 flex items-center gap-2">
                🔐 Super Admin Tools
                <span className="text-xs text-red-600 font-normal">(Press * to exit)</span>
              </h3>
              <div className="flex gap-3">
                <a
                  href="https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf/editor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold text-center"
                >
                  🗄️ Supabase
                </a>
                <a
                  href="https://railway.app/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all font-semibold text-center"
                >
                  🚂 Railway
                </a>
                <button
                  onClick={() => { onOpenAuditHistory(); }}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
                >
                  🔍 Audit History
                </button>
              </div>
            </div>
          )}

          {/* Gym Rules Section - Super Admin only */}
          {superAdminMode && (
            <div className="mb-6">
              <button
                onClick={() => setShowRules(!showRules)}
                className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-colors text-left flex items-center justify-between"
              >
                <span className="font-bold text-blue-800 flex items-center gap-2">
                  📋 Gym Rules
                  <span className="text-xs font-normal text-blue-600">(valid prices, times per gym)</span>
                </span>
                <span className="text-blue-500">{showRules ? '▲' : '▼'}</span>
              </button>

              {showRules && (
                <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  {loadingRules ? (
                    <p className="text-sm text-blue-600">Loading rules...</p>
                  ) : (
                    <>
                      {/* Existing Rules */}
                      {rules.length === 0 ? (
                        <p className="text-sm text-gray-500 mb-3">No rules yet. Add rules here or click "+ Rule" on validation errors during sync.</p>
                      ) : (
                        <div className="mb-4 space-y-1 max-h-48 overflow-y-auto">
                          {rules.map(rule => (
                            <div key={rule.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded border text-xs">
                              <span>
                                <strong className="text-blue-800">{rule.gym_id}</strong>
                                <span className="mx-1 text-gray-400">|</span>
                                <span className={rule.rule_type === 'price' ? 'text-green-700' : 'text-purple-700'}>
                                  {rule.rule_type === 'price' ? `$${rule.value}` : rule.value}
                                </span>
                                <span className="mx-1 text-gray-400">=</span>
                                <span className="text-gray-700">"{rule.label}"</span>
                                <span className="ml-1 text-gray-400 text-[10px]">({rule.event_type})</span>
                              </span>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
                                title="Delete this rule"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add New Rule Form */}
                      <div className="border-t border-blue-200 pt-3">
                        <p className="text-xs font-semibold text-blue-700 mb-2">Add New Rule:</p>
                        <div className="flex gap-2 flex-wrap">
                          <select
                            value={newRuleGym}
                            onChange={(e) => setNewRuleGym(e.target.value)}
                            className="px-2 py-1.5 border rounded text-xs flex-shrink-0"
                          >
                            <option value="">Gym...</option>
                            {gymList.map(g => (
                              <option key={g.id} value={g.id}>{g.id}</option>
                            ))}
                          </select>
                          <select
                            value={newRuleType}
                            onChange={(e) => setNewRuleType(e.target.value)}
                            className="px-2 py-1.5 border rounded text-xs flex-shrink-0"
                          >
                            <option value="price">Price</option>
                            <option value="time">Time</option>
                          </select>
                          <input
                            type="text"
                            value={newRuleValue}
                            onChange={(e) => setNewRuleValue(e.target.value)}
                            placeholder={newRuleType === 'price' ? '20' : '8:30 AM'}
                            className="px-2 py-1.5 border rounded text-xs w-20"
                          />
                          <input
                            type="text"
                            value={newRuleLabel}
                            onChange={(e) => setNewRuleLabel(e.target.value)}
                            placeholder="Before Care"
                            className="px-2 py-1.5 border rounded text-xs flex-1 min-w-[100px]"
                          />
                          <button
                            onClick={handleAddRule}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Actions */}
          <div className="space-y-4">
            {/* Automated Sync - Primary Action */}
            <div className="p-5 bg-purple-50 rounded-lg border-2 border-purple-300 hover:border-purple-400 transition-colors">
              <h4 className="font-bold text-purple-800 mb-2 text-lg">⚡ Automated Sync</h4>
              <p className="text-sm text-purple-600 mb-4">Automatically collect events from iClassPro portals</p>
              <button
                onClick={onOpenSyncModal}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
              >
                Open Automated Sync
              </button>
            </div>

            {/* JSON Import - Secondary Action */}
            <div className="p-5 bg-green-50 rounded-lg border border-green-200 hover:border-green-300 transition-colors">
              <h4 className="font-semibold text-green-800 mb-2">🚀 JSON Import (F12 Method)</h4>
              <p className="text-sm text-green-600 mb-3">Import multiple events from F12 Copy Response</p>
              <button
                onClick={onOpenBulkImport}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Open JSON Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
