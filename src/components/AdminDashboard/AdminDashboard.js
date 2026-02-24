import React, { useState, useEffect } from 'react';
import AdminAuditReview from './AdminAuditReview';
import AdminGymRules from './AdminGymRules';
import AdminPricing from './AdminPricing';
import AdminQuickActions from './AdminQuickActions';
import AdminChangeHistory from './AdminChangeHistory';
import EmailComposer from './EmailComposer';

export default function AdminDashboard({
  gyms,
  events,
  monthlyRequirements,
  currentMonth,
  currentYear,
  initialCalendarMonth,
  initialTab,
  onClose,
  onOpenSyncModal,
  onOpenBulkImport,
}) {
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'audit');
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
    { id: 'history', label: '📜 Change History', alwaysShow: true },
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center gap-1"
              >
                ← Back to Calendar
              </button>
              <div className="h-6 w-px bg-white/20"></div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                🪄 Admin Dashboard
                {superAdminMode ? (
                  <span className="text-xs bg-red-500/20 text-red-100 px-2.5 py-1 rounded-full font-semibold border border-red-400/30">🔐 Super Admin</span>
                ) : (
                  <span className="text-xs bg-white/15 text-white/80 px-2.5 py-1 rounded-full font-semibold border border-white/20">Admin</span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEmailComposer(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              >
                ✉️ Email Managers
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

          <div className="flex gap-1 -mb-px overflow-x-auto pb-0">
            {tabs.filter(t => t.alwaysShow).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${
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

        {activeTab === 'history' && (
          <AdminChangeHistory gyms={gyms} />
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
