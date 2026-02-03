import React from 'react';

export default function AdminQuickActions({
  superAdminMode,
  onOpenSyncModal,
  onOpenBulkImport,
  onOpenAuditHistory,
}) {
  return (
    <div className="space-y-6">
      {/* Super Admin Tools */}
      {superAdminMode && (
        <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-300 shadow-sm">
          <h3 className="font-bold text-red-800 text-sm mb-4 flex items-center gap-2">
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
              onClick={onOpenAuditHistory}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
            >
              🔍 Audit History
            </button>
          </div>
        </div>
      )}

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Automated Sync */}
        <div className="p-5 bg-purple-50 rounded-xl border-2 border-purple-300 hover:border-purple-400 transition-colors">
          <h4 className="font-bold text-purple-800 mb-2 text-lg">⚡ Automated Sync</h4>
          <p className="text-sm text-purple-600 mb-4">Automatically collect events from iClassPro portals</p>
          <button
            onClick={onOpenSyncModal}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
          >
            Open Automated Sync
          </button>
        </div>

        {/* JSON Import */}
        <div className="p-5 bg-green-50 rounded-xl border-2 border-green-300 hover:border-green-400 transition-colors">
          <h4 className="font-bold text-green-800 mb-2 text-lg">🚀 JSON Import (F12 Method)</h4>
          <p className="text-sm text-green-600 mb-4">Import multiple events from F12 Copy Response</p>
          <button
            onClick={onOpenBulkImport}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
          >
            Open JSON Import
          </button>
        </div>
      </div>
    </div>
  );
}
