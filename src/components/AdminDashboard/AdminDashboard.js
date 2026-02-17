import React, { useState, useEffect } from 'react';
import AdminAuditReview from './AdminAuditReview';
import AdminGymRules from './AdminGymRules';
import AdminPricing from './AdminPricing';
import AdminQuickActions from './AdminQuickActions';

export default function AdminDashboard({
  gyms,
  initialCalendarMonth,
  onClose,
  onOpenSyncModal,
  onOpenBulkImport,
  onOpenAuditHistory,
}) {
  const [activeTab, setActiveTab] = useState('audit');
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
    { id: 'audit', label: '📋 Audit & Review', alwaysShow: true },
    { id: 'pricing', label: '💰 Pricing', alwaysShow: true },
    { id: 'rules', label: '📏 Gym Rules', alwaysShow: true },
    { id: 'actions', label: '⚡ Quick Actions', alwaysShow: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
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
      <div className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back button + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                ← Back to Calendar
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                🪄 Admin Dashboard
                {superAdminMode ? (
                  <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold">🔐 Super Admin</span>
                ) : (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-semibold">Admin</span>
                )}
              </h1>
            </div>

            {/* Right: Super Admin toggle */}
            <div className="flex items-center gap-2">
              {superAdminMode ? (
                <button
                  onClick={() => setSuperAdminMode(false)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Exit Super Admin
                </button>
              ) : (
                <button
                  onClick={() => { setShowPinModal(true); setPinInput(''); }}
                  className="text-gray-400 hover:text-purple-600 text-xl px-2 py-1 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Super Admin Access (or press *)"
                >
                  🔐
                </button>
              )}
            </div>
          </div>

          {/* Tab Bar — all 4 tabs visible, scroll on small screens */}
          <div className="flex gap-0.5 -mb-px overflow-x-auto">
            {tabs.filter(t => t.alwaysShow).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-700 bg-purple-50 shadow-sm'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'audit' && (
          <AdminAuditReview gyms={gyms} initialMonth={initialCalendarMonth} />
        )}

        {activeTab === 'rules' && (
          <AdminGymRules gyms={gyms} />
        )}

        {activeTab === 'pricing' && (
          <AdminPricing gyms={gyms} />
        )}

        {activeTab === 'actions' && (
          <AdminQuickActions
            superAdminMode={superAdminMode}
            onOpenSyncModal={onOpenSyncModal}
            onOpenBulkImport={onOpenBulkImport}
            onOpenAuditHistory={onOpenAuditHistory}
          />
        )}
      </div>
    </div>
  );
}
