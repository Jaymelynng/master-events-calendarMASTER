import React, { useState, useEffect } from 'react';

export default function AdminPortalModal({
  onClose,
  onOpenBulkImport,
  onOpenSyncModal,
  onOpenAuditHistory,
}) {
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  
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
