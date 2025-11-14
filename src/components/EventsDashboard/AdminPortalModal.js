import React from 'react';

export default function AdminPortalModal({
  theme,
  onClose,
  onOpenAddEvent,
  onOpenBulkImport,
  onOpenSyncModal,
  onOpenAuditHistory,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-hidden">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-3xl font-bold text-purple-800 flex items-center gap-3">
            🪄 Magic Control Center
            <span className="text-lg bg-purple-100 text-purple-700 px-3 py-1 rounded-full">Power User Mode</span>
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

        {/* Supabase Quick Access Button */}
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🗄️</span>
              <div>
                <h3 className="font-bold text-green-800 text-lg">Supabase Database</h3>
                <p className="text-sm text-green-600">View and manage your event data directly</p>
              </div>
            </div>
            <a
              href="https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf/editor"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
            >
              Open Supabase
              <span className="text-lg">→</span>
            </a>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r border-gray-200 pr-4">
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-lg bg-purple-100 text-purple-800 font-semibold">
                📥 Import & Data
              </button>
              <button
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-600"
                onClick={onOpenAuditHistory}
              >
                🔍 Audit History
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

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-2">🔮 Coming Soon</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 🗄️ Export Data</li>
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
  );
}



