import React, { useState, useEffect } from 'react';

export default function AdminPortalModal({
  theme,
  onClose,
  onOpenAddEvent,
  onOpenBulkImport,
  onOpenSyncModal,
  onOpenAuditHistory,
  events = [],
  gyms = [],
}) {
  // Export functions
  const exportToCSV = () => {
    if (!events || events.length === 0) {
      alert('No events to export');
      return;
    }
    
    // CSV headers
    const headers = ['Gym', 'Title', 'Type', 'Date', 'Time', 'Price', 'Ages', 'URL'];
    
    // Convert events to CSV rows
    const rows = events.map(event => {
      const gym = gyms.find(g => g.id === event.gym_id);
      return [
        gym?.name || event.gym_id,
        `"${(event.title || '').replace(/"/g, '""')}"`,
        event.type || '',
        event.date || '',
        event.time || '',
        event.price || '',
        event.age_min && event.age_max ? `${event.age_min}-${event.age_max}` : (event.age_min ? `${event.age_min}+` : ''),
        event.event_url || ''
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, 'events-export.csv', 'text/csv');
  };

  const exportToJSON = () => {
    if (!events || events.length === 0) {
      alert('No events to export');
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalEvents: events.length,
      events: events.map(event => ({
        gym_id: event.gym_id,
        title: event.title,
        type: event.type,
        date: event.date,
        start_date: event.start_date,
        end_date: event.end_date,
        time: event.time,
        price: event.price,
        age_min: event.age_min,
        age_max: event.age_max,
        description: event.description,
        event_url: event.event_url
      }))
    };
    
    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, 'events-export.json', 'application/json');
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const [superAdminMode, setSuperAdminMode] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const SUPER_ADMIN_PIN = '1426';

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
              maxLength={4}
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
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-3xl font-bold text-purple-800 flex items-center gap-3">
            🪄 Magic Control Center
              {superAdminMode ? (
                <span className="text-lg bg-red-100 text-red-700 px-3 py-1 rounded-full">🔐 Super Admin</span>
              ) : (
                <span className="text-lg bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Admin Mode</span>
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
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-2 border-red-300 shadow-sm flex-shrink-0">
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

        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r border-gray-200 pr-4">
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg bg-purple-100 text-purple-800 font-semibold">
                📥 Import & Data
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-400 cursor-not-allowed">
                🎨 Magic Manager
                <div className="text-xs">Coming Soon</div>
              </button>
            </div>
          </div>

          <div className="flex-1 pl-6 overflow-y-auto">
            <div className="h-full">
              <h3 className="text-xl font-bold text-gray-800 mb-4">📥 Import & Data</h3>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">➕ Quick Add Event</h4>
                <p className="text-sm text-blue-600 mb-3">Add a single event manually</p>
                <button
                  onClick={onOpenAddEvent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add New Event
                </button>
              </div>

              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">🚀 JSON Import (F12 Method)</h4>
                <p className="text-sm text-green-600 mb-3">Import multiple events from F12 Copy Response</p>
                <button
                  onClick={onOpenBulkImport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Open JSON Import
                </button>
              </div>

              <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-2">⚡ Automated Sync</h4>
                <p className="text-sm text-purple-600 mb-3">Automatically collect events from iClassPro portals</p>
                <button
                  onClick={onOpenSyncModal}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Open Automated Sync
                </button>
              </div>

              <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-800 mb-2">📤 Export Data</h4>
                <p className="text-sm text-amber-600 mb-3">Download all {events?.length || 0} events</p>
                <div className="flex gap-2">
                  <button
                    onClick={exportToCSV}
                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                  >
                    📊 CSV (Excel)
                  </button>
                  <button
                    onClick={exportToJSON}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                  >
                    📋 JSON
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-2">🔮 Coming Soon</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 📊 Import Analytics</li>
                  <li>• 🧹 Data Cleanup Tools</li>
                  <li>• 💾 Backup & Restore</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}



