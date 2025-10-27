import React from 'react';

export default function BulkImportModal({
  theme,
  gymsList,
  gymLinks,
  rawEventListings,
  setRawEventListings,
  selectedGymId,
  setSelectedGymId,
  validationResults,
  importTiming,
  bulkImportData,
  setBulkImportData,
  onConvert,
  onClose,
  onReset,
  onImport,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-hidden">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto flex flex-col relative">
        {/* Close X button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-800"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold mb-4 pr-8" style={{ color: theme.colors.textPrimary }}>
          🚀 Direct JSON Import - Copy Response from F12
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Cross-Check Data:</span>
            <a
              href="https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf/editor"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors font-medium"
            >
              🗄️ Open Supabase Dashboard
            </a>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Click to open your Supabase database and verify existing data before importing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-semibold mb-2 text-purple-800">📋 Step 1: Paste JSON from F12</h3>
            <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2 text-xs">
              <div>1. Go to gym's event page</div>
              <div>2. Press F12 → Network tab</div>
              <div>3. Find API call (usually ends with /camps)</div>
              <div>4. Right-click → Copy → Copy Response</div>
              <div>5. Paste here:</div>
            </div>
            <textarea
              value={rawEventListings}
              onChange={(e) => setRawEventListings(e.target.value)}
              placeholder='{"totalRecords":2,"campTypeName":"KIDS NIGHT OUT","data":[...]}'
              className="w-full h-32 p-2 border rounded-lg text-xs font-mono"
              style={{ borderColor: theme.colors.accent }}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-green-800">🏢 Step 2: Select Gym</h3>
            
            <div className="grid grid-cols-2 gap-2 border rounded-lg p-3" style={{ borderColor: theme.colors.accent }}>
              {gymsList.map((gym) => (
                <label key={gym.id} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="radio"
                    name="selectedGym"
                    value={gym.id}
                    checked={selectedGymId === gym.id}
                    onChange={(e) => setSelectedGymId(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">{gym.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <button
            onClick={onConvert}
            disabled={!rawEventListings.trim() || !selectedGymId}
            className="px-6 py-3 rounded-lg transition-colors disabled:opacity-50 text-white font-bold"
            style={{ backgroundColor: theme.colors.warning }}
          >
            ⚡ Convert JSON to Import Format ⚡
          </button>
        </div>

        {validationResults && (
          <div className="bg-gray-50 border rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2 text-gray-800">🔍 Validation Results:</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: theme.colors.primary }}>
                  {validationResults.eventsFound}
                </div>
                <div className="text-gray-600">Events Found</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: theme.colors.primary }}>
                  {validationResults.urlsFound}
                </div>
                <div className="text-gray-600">URLs Found</div>
              </div>
              <div className="text-center">
                <div className={`font-bold text-lg ${validationResults.duplicateUrls > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {validationResults.duplicateUrls}
                </div>
                <div className="text-gray-600">Already in DB</div>
              </div>
              <div className="text-center">
                <div className={`font-bold text-lg ${validationResults.gymId ? 'text-green-600' : 'text-red-600'}`}>
                  {validationResults.gymDetected}
                </div>
                <div className="text-gray-600">Gym Detected</div>
                {validationResults.gymId && (
                  <div className="text-xs text-gray-500">UUID: {validationResults.gymId.slice(0, 8)}...</div>
                )}
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-purple-600">
                  {validationResults.eventTypeMode === 'AUTO_DETECT' ? '🤖' : validationResults.eventTypeMode}
                </div>
                <div className="text-gray-600">Event Type</div>
                <div className="text-xs text-gray-500">
                  {validationResults.eventTypeMode === 'AUTO_DETECT' ? 'Auto-Detect' : 'Manual'}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="p-2 rounded border bg-white">
                <div className="text-gray-600">Convert time</div>
                <div className="font-semibold" style={{ color: theme.colors.primary }}>
                  {importTiming.convertMs != null ? `${importTiming.convertMs} ms` : '—'}
                </div>
              </div>
              <div className="p-2 rounded border bg-white">
                <div className="text-gray-600">Import time</div>
                <div className="font-semibold" style={{ color: theme.colors.primary }}>
                  {importTiming.importMs != null ? `${importTiming.importMs} ms` : '—'}
                </div>
              </div>
              <div className="p-2 rounded border bg-white">
                <div className="text-gray-600">Total time</div>
                <div className="font-semibold" style={{ color: theme.colors.primary }}>
                  {importTiming.totalMs != null ? `${importTiming.totalMs} ms` : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-blue-800">📝 Step 3: Import Format (Review & Import)</h3>
          <textarea
            value={bulkImportData}
            onChange={(e) => setBulkImportData(e.target.value)}
            placeholder="Converted import format will appear here..."
            className="w-full h-32 p-2 border rounded-lg font-mono text-xs"
            style={{ borderColor: theme.colors.primary }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              onClose();
              onReset();
            }}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={!bulkImportData.trim()}
            className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 text-white font-bold"
            style={{ backgroundColor: theme.colors.primary }}
            title="Only new events will be imported. All duplicates are automatically skipped."
          >
            🚀 Import New Events Only
          </button>
        </div>
      </div>
    </div>
  );
}
