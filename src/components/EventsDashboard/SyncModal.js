import React, { useState, useEffect } from 'react';
import { Loader, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { eventsApi, syncLogApi } from '../../lib/api';
import { compareEvents, getComparisonSummary } from '../../lib/eventComparison';

export default function SyncModal({ theme, onClose, gyms }) {
  const [selectedGym, setSelectedGym] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [editableEvents, setEditableEvents] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [devMode, setDevMode] = useState(false);
  const [syncLog, setSyncLog] = useState([]);
  const [showProgress, setShowProgress] = useState(false);

  // Load sync log on mount
  useEffect(() => {
    const loadSyncLog = async () => {
      try {
        const log = await syncLogApi.getAll();
        setSyncLog(log);
      } catch (err) {
        console.error('Failed to load sync log:', err);
      }
    };
    loadSyncLog();
  }, []);

  // Secret dev mode: Press Shift+D to toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'D') {
        setDevMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to get sync status for a gym/type combo
  const getSyncStatus = (gymId, eventType) => {
    const entry = syncLog.find(s => s.gym_id === gymId && s.event_type === eventType);
    if (!entry) return null;
    return entry;
  };

  // Helper to format time ago
  const timeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Event types from your working script
  const eventTypes = [
    'KIDS NIGHT OUT',
    'CLINIC',
    'OPEN GYM',
    'CAMP',
    'SPECIAL EVENT'
  ];

  // All sync option (includes ALL event types at once)
  const ALL_PROGRAMS = 'ALL';


  const handleSyncForType = async (eventType) => {
    if (!selectedGym || !eventType) {
      alert('Please select a gym first');
      return;
    }

    setSelectedEventType(eventType);
    setSyncing(true);
    setResult(null);
    setImportResult(null);
    setComparison(null);
    setEditableEvents([]);

    try {
      // Use environment variable for API URL, fallback to localhost for local dev
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const API_KEY = process.env.REACT_APP_API_KEY || ''; // API key for Railway (if needed)
      
      // Call API (local or Railway)
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add API key header if provided (for Railway)
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }
      
      const response = await fetch(`${API_URL}/sync-events`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          gymId: selectedGym,
          eventType: eventType
        })
      });

      const data = await response.json();

      // Handle "ALL" response (eventsByType instead of events)
      if (eventType === ALL_PROGRAMS && data.success && data.eventsByType) {
        // Combine all events from all types
        const allEvents = [];
        const eventsByTypeMap = data.eventsByType;
        
        for (const [type, events] of Object.entries(eventsByTypeMap)) {
          for (const ev of events) {
            allEvents.push({ ...ev, _eventType: type });
          }
        }
        
        const eventsWithIndex = allEvents.map((ev, idx) => ({ ...ev, _index: idx }));
        setEditableEvents(eventsWithIndex);
        
        // Compare with existing events in database for ALL types
        try {
          const today = new Date().toISOString().split('T')[0];
          const existingEvents = await eventsApi.getAll(today, '2026-12-31', true);
          const gymExistingEvents = existingEvents.filter(ev => ev.gym_id === selectedGym);
          
          // Compare all incoming events vs existing
          const comparisonResult = compareEvents(allEvents, gymExistingEvents);
          setComparison(comparisonResult);
        } catch (err) {
          console.error('Error comparing events:', err);
        }
        
        setResult({
          success: true,
          eventsFound: data.eventsFound,
          eventsByType: data.eventsByType,
          checkedTypes: data.checkedTypes || [],
          message: data.message,
          isAllPrograms: true
        });
        
        // Log sync for ALL checked types (even if 0 events)
        try {
          const checkedTypes = data.checkedTypes || Object.keys(eventsByTypeMap);
          for (const type of checkedTypes) {
            const events = eventsByTypeMap[type] || [];
            await syncLogApi.log(selectedGym, type, events.length, 0);
          }
          const updatedLog = await syncLogApi.getAll();
          setSyncLog(updatedLog);
        } catch (err) {
          console.error('Failed to log sync:', err);
        }
      } else if (data.success && data.events && data.events.length > 0) {
        // Make events editable (add index for React keys)
        const eventsWithIndex = data.events.map((ev, idx) => ({ ...ev, _index: idx }));
        setEditableEvents(eventsWithIndex);
        
        // Compare with existing events in database
        try {
          // Get existing events for this gym - ONLY FUTURE EVENTS (today and forward)
          // Include deleted events in comparison so we can detect if they should be restored
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          const existingEvents = await eventsApi.getAll(today, '2026-12-31', true); // includeDeleted = true
          const gymExistingEvents = existingEvents.filter(
            ev => ev.gym_id === selectedGym && ev.type === eventType
          );
          
          // Compare new vs existing (only future events, including deleted ones)
          const comparisonResult = compareEvents(data.events, gymExistingEvents);
          setComparison(comparisonResult);
        } catch (err) {
          console.error('Error comparing events:', err);
          // Continue without comparison
        }
        
        setResult({
          success: true,
          eventsFound: data.eventsFound,
          events: data.events,
          message: data.message
        });
        
        // Log the sync to track progress
        try {
          await syncLogApi.log(selectedGym, eventType, data.eventsFound || data.events.length, 0);
          // Refresh sync log
          const updatedLog = await syncLogApi.getAll();
          setSyncLog(updatedLog);
        } catch (err) {
          console.error('Failed to log sync:', err);
        }
      } else if (data.noEvents) {
        // No events scheduled - still counts as a successful sync check
        setResult({
          success: true,
          noEvents: true,
          eventsFound: 0,
          events: [],
          message: data.message || `No ${eventType} events scheduled`
        });
        
        // Log even when no events (so we know we checked)
        try {
          await syncLogApi.log(selectedGym, eventType, 0, 0);
          const updatedLog = await syncLogApi.getAll();
          setSyncLog(updatedLog);
        } catch (err) {
          console.error('Failed to log sync:', err);
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'No events found',
          events: []
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      setResult({
        success: false,
        message: `Failed to connect to API server at ${API_URL}\n\nError: ${error.message}\n\n${API_URL.includes('localhost') ? 'Make sure the local server is running.' : 'Check if Railway is deployed and running.'}`,
        events: []
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePriceChange = (index, newPrice) => {
    setEditableEvents(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        price: newPrice === '' || newPrice === null ? null : parseFloat(newPrice)
      };
      return updated;
    });
  };

  const handleImport = async () => {
    if (!result || !result.success || editableEvents.length === 0) {
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      // Remove the _index and _eventType fields before importing
      const eventsToImport = editableEvents.map(({ _index, _eventType, ...ev }) => ev);
      
      // Import new events
      const imported = await eventsApi.bulkImport(eventsToImport);
      
      // Update changed events
      let updatedCount = 0;
      if (comparison && comparison.changed.length > 0) {
        for (const changed of comparison.changed) {
          try {
            // Find the event in database by URL (include deleted events to restore them)
            const today = new Date().toISOString().split('T')[0];
            const existingEvents = await eventsApi.getAll(today, '2026-12-31', true); // includeDeleted = true
            const existingEvent = existingEvents.find(e => e.event_url === changed.incoming.event_url);
            
            if (existingEvent) {
              // Update with new data (but keep the database ID)
              await eventsApi.update(existingEvent.id, {
                title: changed.incoming.title,
                date: changed.incoming.date,
                start_date: changed.incoming.start_date,
                end_date: changed.incoming.end_date,
                time: changed.incoming.time,
                price: changed.incoming.price,
                age_min: changed.incoming.age_min,
                age_max: changed.incoming.age_max,
                description: changed.incoming.description,
                deleted_at: null  // Ensure it's not marked as deleted
              });
              updatedCount++;
            }
          } catch (err) {
            console.error('Error updating event:', err);
          }
        }
      }
      
      // Mark deleted events (in DB but not in portal) as deleted
      let deletedCount = 0;
      if (comparison && comparison.deleted.length > 0) {
        for (const deletedEvent of comparison.deleted) {
          try {
            // Only mark as deleted if it's a future event (past events we leave alone)
            const eventDate = new Date(deletedEvent.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (eventDate >= today) {
              // Mark as deleted (soft delete)
              await eventsApi.markAsDeleted(deletedEvent.id);
              deletedCount++;
            }
          } catch (err) {
            console.error('Error marking event as deleted:', err);
          }
        }
      }
      
      setImportResult({
        success: true,
        imported: imported.length,
        updated: updatedCount,
        deleted: deletedCount,
        total: editableEvents.length
      });

      // Don't reload - keep modal open for continued syncing
      // Events will refresh automatically via Supabase real-time subscription
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        error: error.message
      });
    } finally {
      setImporting(false);
    }
  };

  // Detect if using Railway or local
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const isRailway = API_URL.includes('railway.app') || API_URL.includes('railway');
  const isLocal = !isRailway && API_URL.includes('localhost');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-7xl my-4 flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-2">
            ⚡ Automated Sync
            {devMode && <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">🔧 Dev Mode</span>}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

        {/* Dev Mode Panel - Only visible when Shift+D is pressed */}
        {devMode && (
          <div className="mb-4 p-3 bg-purple-50 border-2 border-purple-300 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-purple-800 text-sm">🔧 Developer Links</span>
              <span className="text-xs text-purple-600">Press Shift+D to hide</span>
            </div>
            <div className="flex gap-3">
              <a 
                href="https://railway.app/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors text-center"
              >
                🚂 Railway Dashboard
              </a>
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors text-center"
              >
                🗄️ Supabase Dashboard
              </a>
            </div>
            {isRailway && (
              <p className="text-xs text-purple-600 mt-2">
                API: {API_URL}
              </p>
            )}
          </div>
        )}

        {/* Sync Progress Grid - Compact when results showing */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-purple-800">📊 Sync Progress ({syncLog.length} logged)</span>
            {!result && (
              <button
                onClick={() => setShowProgress(!showProgress)}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                {showProgress ? '[ Collapse ]' : '[ Expand ]'}
              </button>
            )}
          </div>
        </div>

        {/* Sync Progress Grid - Full when no results, compact when results */}
        {!result && showProgress ? (
          <div className="mb-4 p-4 bg-white border-2 border-purple-300 rounded-lg shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-purple-100">
                    <th className="text-left py-2 px-2 font-bold text-purple-800 border border-purple-200 sticky left-0 bg-purple-100">Gym</th>
                    {eventTypes.map(type => (
                      <th key={type} className="text-center py-2 px-2 font-bold text-purple-800 border border-purple-200" style={{ minWidth: '70px' }}>
                        {type === 'KIDS NIGHT OUT' ? 'KNO' : 
                         type === 'OPEN GYM' ? 'OG' :
                         type === 'SPECIAL EVENT' ? 'SE' :
                         type}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gyms.map((gym, idx) => (
                    <tr key={gym.id} className={`${selectedGym === gym.id ? 'bg-purple-50' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="py-2 px-2 font-semibold text-gray-800 border border-gray-200 sticky left-0 whitespace-nowrap" style={{ backgroundColor: selectedGym === gym.id ? '#faf5ff' : idx % 2 === 0 ? '#f9fafb' : 'white' }}>
                        {gym.name.replace('Capital Gymnastics ', 'Cap ').replace('Rowland Ballard ', 'RB ').replace(' Gymnastics', '')}
                      </td>
                      {eventTypes.map(type => {
                        const status = getSyncStatus(gym.id, type);
                        const isSelected = selectedGym === gym.id && selectedEventType === type;
                        return (
                          <td key={type} className="text-center py-2 px-2 border border-gray-200">
                            {status ? (
                              <div 
                                className={`inline-block px-2 py-1 rounded font-medium cursor-pointer transition-all hover:scale-105 ${
                                  isSelected ? 'ring-2 ring-purple-500' : ''
                                } ${
                                  status.events_found > 0 
                                    ? 'bg-green-200 text-green-800' 
                                    : 'bg-yellow-200 text-yellow-800'
                                }`}
                                title={`Last synced: ${new Date(status.last_synced).toLocaleString()}\nEvents: ${status.events_found}`}
                                onClick={() => { setSelectedGym(gym.id); setSelectedEventType(''); setResult(null); }}
                              >
                                ✓ {timeAgo(status.last_synced)}
                              </div>
                            ) : (
                              <div 
                                className={`inline-block px-2 py-1 rounded font-medium bg-red-100 text-red-600 cursor-pointer transition-all hover:scale-105 hover:bg-red-200 ${
                                  isSelected ? 'ring-2 ring-purple-500' : ''
                                }`}
                                onClick={() => { setSelectedGym(gym.id); setSelectedEventType(''); setResult(null); }}
                              >
                                ✗ Need
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-green-200 rounded"></span> Synced (has events)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-yellow-200 rounded"></span> Synced (no events)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-red-100 rounded"></span> Needs sync</span>
            </div>
          </div>
        ) : (
          /* Compact mini-view when collapsed */
          <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex flex-wrap gap-1">
              {gyms.map(gym => {
                const gymSyncs = eventTypes.filter(type => getSyncStatus(gym.id, type)).length;
                const total = eventTypes.length;
                const allDone = gymSyncs === total;
                const shortName = gym.name.replace('Capital Gymnastics ', '').replace('Rowland Ballard ', 'RB ').replace(' Gymnastics', '').substring(0, 8);
                return (
                  <div 
                    key={gym.id}
                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${
                      allDone ? 'bg-green-200 text-green-800' : 
                      gymSyncs > 0 ? 'bg-yellow-200 text-yellow-800' : 
                      'bg-red-100 text-red-600'
                    } ${selectedGym === gym.id ? 'ring-2 ring-purple-500' : ''}`}
                    onClick={() => { setSelectedGym(gym.id); setResult(null); }}
                    title={`${gym.name}: ${gymSyncs}/${total} synced`}
                  >
                    {shortName} {gymSyncs}/{total}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Local dev warning - only show in dev mode */}
        {devMode && isLocal && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Local API:</strong> Make sure server is running<br />
              <code className="bg-yellow-100 px-2 py-1 rounded text-xs">cd automation && python local_api_server.py</code>
            </p>
          </div>
        )}

        {/* Step 1: Gym Selection - Hide when we have results */}
        {!result && (
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800 mb-3">🏢 Step 1: Select Gym</h3>
          <div className="grid grid-cols-2 gap-2 border border-gray-300 rounded-lg p-3 bg-gray-50">
            {gyms.map((gym) => (
              <label 
                key={gym.id} 
                className={`flex items-center text-sm cursor-pointer hover:bg-white p-2 rounded transition-colors ${
                  selectedGym === gym.id ? 'bg-white ring-2 ring-purple-500' : ''
                }`}
              >
                <input
                  type="radio"
                  name="selectedGym"
                  value={gym.id}
                  checked={selectedGym === gym.id}
                  onChange={(e) => setSelectedGym(e.target.value)}
                  className="mr-2"
                  disabled={syncing}
                />
                <span className="text-sm font-medium">{gym.name}</span>
              </label>
            ))}
          </div>
        </div>
        )}

        {/* Step 2: Event Type Buttons - Only show when gym is selected */}
        {selectedGym && !result && (
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-3">⚡ Step 2: Select Program & Sync</h3>
            
            {/* SYNC ALL PROGRAMS - Featured Button */}
            <div className="mb-4">
              <button
                onClick={() => handleSyncForType(ALL_PROGRAMS)}
                disabled={syncing}
                className={`w-full px-4 py-4 rounded-lg font-bold transition-all transform hover:scale-102 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 ${
                  syncing && selectedEventType === ALL_PROGRAMS
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-lg'
                }`}
              >
                {syncing && selectedEventType === ALL_PROGRAMS ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Syncing ALL Programs... (this may take 30-60 seconds)</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🚀</span>
                    <span className="text-lg">SYNC ALL PROGRAMS</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded">KNO + CLINIC + OPEN GYM + CAMP + SPECIAL</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center">
                ⏱️ Takes ~30-60 seconds - syncs everything at once
              </p>
            </div>
            
            <div className="relative mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or sync individual programs</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {eventTypes.map((type) => {
                const isSyncing = syncing && selectedEventType === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleSyncForType(type)}
                    disabled={syncing}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${
                      isSyncing
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-2 border-purple-300'
                    }`}
                  >
                    {isSyncing ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Syncing...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">⚡</span>
                        <span className="text-sm">{type}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Click a program button to sync immediately
            </p>
          </div>
        )}


        {/* Results */}
        {result && (
          <div className={`p-4 rounded-lg border-2 mb-4 ${
            result.noEvents
              ? 'bg-yellow-50 border-yellow-300'
              : result.success 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-3">
              {result.noEvents ? (
                <span className="text-2xl">📭</span>
              ) : result.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  result.noEvents 
                    ? 'text-yellow-800' 
                    : result.success 
                      ? 'text-green-800' 
                      : 'text-red-800'
                }`}>
                  {result.noEvents 
                    ? '📅 No Events Scheduled' 
                    : result.success 
                      ? '✅ Sync Successful!' 
                      : '❌ Sync Failed'}
                </p>
                {/* Show selected gym and event type for cross-checking */}
                {selectedGym && selectedEventType && (
                  <div className={`text-sm mt-1 font-medium ${
                    result.noEvents 
                      ? 'text-yellow-700' 
                      : result.success 
                        ? 'text-green-700' 
                        : 'text-red-700'
                  }`}>
                    <span className="inline-block bg-white px-2 py-1 rounded border border-gray-300">
                      🏢 <strong>{gyms.find(g => g.id === selectedGym)?.name || selectedGym}</strong> 
                      {' • '}
                      ⚡ <strong>{selectedEventType}</strong>
                    </span>
                  </div>
                )}
                <p className={`text-sm mt-2 ${
                  result.noEvents 
                    ? 'text-yellow-700' 
                    : result.success 
                      ? 'text-green-700' 
                      : 'text-red-700'
                }`}>
                  {result.noEvents 
                    ? `This gym doesn't have any ${selectedEventType} events scheduled right now.`
                    : result.message}
                </p>
                {result.success && result.eventsFound > 0 && (
                  <div className="text-sm text-green-700 mt-2">
                    <p>Found <strong>{result.eventsFound}</strong> events from source</p>
                    {result.isAllPrograms && result.eventsByType && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(result.eventsByType).map(([type, events]) => (
                          <span key={type} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            {type}: {events.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Buttons for no events or failed sync - allow quick navigation */}
            {(result.noEvents || !result.success) && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setResult(null);
                    setSelectedEventType('');
                    // Keep selectedGym
                  }}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-md"
                >
                  🔄 Sync Another Program
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setSelectedEventType('');
                    setSelectedGym('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors shadow-md"
                >
                  🏢 Sync Another Gym
                </button>
              </div>
            )}
          </div>
        )}

        {/* Comparison Summary - PROMINENT DISPLAY */}
        {result && result.success && comparison && (
          <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              📊 Comparison Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded border border-green-200">
                <div className="text-xs text-gray-600 mb-1">New Events</div>
                <div className="text-2xl font-bold text-green-600">
                  {comparison.new.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Will be added to database</div>
              </div>
              <div className="bg-white p-3 rounded border border-yellow-200">
                <div className="text-xs text-gray-600 mb-1">Changed Events</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {comparison.changed.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Will be updated in database</div>
              </div>
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Unchanged</div>
                <div className="text-2xl font-bold text-gray-600">
                  {comparison.unchanged.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">No changes needed</div>
              </div>
              {comparison.deleted.length > 0 && (
                <div className="bg-white p-3 rounded border border-orange-200">
                  <div className="text-xs text-gray-600 mb-1">Deleted Events</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {comparison.deleted.length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">In DB but not in source</div>
                </div>
              )}
            </div>
            {comparison.deleted.length === 0 && (
              <div className="mt-3 text-xs text-gray-500 text-center">
                All events from source are accounted for
              </div>
            )}
          </div>
        )}

        {/* Events Preview Table with Editable Prices */}
        {result && result.success && editableEvents.length > 0 && !importResult && (
          <div className="mb-4 border-2 border-purple-300 rounded-lg overflow-hidden bg-white">
            <div className="bg-purple-50 px-4 py-3 border-b-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">📋 Preview & Edit Prices</h3>
                  {selectedGym && selectedEventType && (
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>{gyms.find(g => g.id === selectedGym)?.name || selectedGym}</strong> - <strong>{selectedEventType}</strong>
                    </p>
                  )}
                </div>
                {comparison && (
                  <div className="text-xs text-gray-600">
                    🆕 {comparison.new.length} new | 🔄 {comparison.changed.length} changed
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-2 font-medium">
                ✏️ Edit prices in the table below if needed, then click Import
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Age</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {editableEvents.map((event, idx) => {
                    // Determine status from comparison
                    let status = 'new';
                    let statusColor = 'bg-blue-100 text-blue-800';
                    let statusIcon = '🆕';
                    let changeInfo = null;
                    
                    if (comparison) {
                      const isNew = comparison.new.some(e => e.event_url === event.event_url);
                      const isChanged = comparison.changed.find(c => c.incoming.event_url === event.event_url);
                      const isUnchanged = comparison.unchanged.some(e => e.event_url === event.event_url);
                      
                      if (isChanged) {
                        status = 'changed';
                        statusColor = 'bg-yellow-100 text-yellow-800';
                        statusIcon = '🔄';
                        changeInfo = isChanged._changes;
                      } else if (isUnchanged) {
                        status = 'unchanged';
                        statusColor = 'bg-gray-100 text-gray-600';
                        statusIcon = '✓';
                      } else if (isNew) {
                        status = 'new';
                        statusColor = 'bg-green-100 text-green-800';
                        statusIcon = '🆕';
                      }
                    }
                    
                    return (
                      <tr key={event._index || idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded ${statusColor}`} title={changeInfo ? `Changed: ${changeInfo.map(c => c.field).join(', ')}` : ''}>
                              {statusIcon}
                            </span>
                            {changeInfo && changeInfo.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {changeInfo.slice(0, 2).map((c, i) => (
                                  <div key={i} className="truncate" title={`${c.field}: "${c.old}" → "${c.new}"`}>
                                    {c.field}
                                  </div>
                                ))}
                                {changeInfo.length > 2 && (
                                  <div className="text-xs">+{changeInfo.length - 2} more</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-800">{event.title}</td>
                        <td className="px-3 py-2 text-gray-600">{event.date}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {event.age_min && event.age_max 
                            ? `${event.age_min}-${event.age_max}`
                            : event.age_min 
                              ? `${event.age_min}+`
                              : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={event.price || ''}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            placeholder="Enter price"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Button (only show if sync was successful) */}
        {result && result.success && editableEvents.length > 0 && !importResult && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
          >
            {importing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Importing {editableEvents.length} Events...
              </>
            ) : (
              <>
                🚀 Import {editableEvents.length} Events to Database
              </>
            )}
          </button>
        )}

        {/* Import Results */}
        {importResult && (
          <div className={`p-4 rounded-lg border-2 mb-4 ${
            importResult.success 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-3">
              {importResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {importResult.success ? '✅ Import Successful!' : '❌ Import Failed'}
                </p>
                {importResult.success ? (
                  <p className="text-sm text-green-700 mt-1">
                    ✅ Imported <strong>{importResult.imported}</strong> new events
                    {importResult.updated > 0 && (
                      <span> • 🔄 Updated <strong>{importResult.updated}</strong> changed events</span>
                    )}
                    {importResult.deleted > 0 && (
                      <span> • 🗑️ Marked <strong>{importResult.deleted}</strong> events as deleted</span>
                    )}
                    {importResult.total > importResult.imported + (importResult.updated || 0) && (
                      <span> • ⏭️ {importResult.total - importResult.imported - (importResult.updated || 0)} unchanged</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-red-700 mt-1">
                    {importResult.error}
                  </p>
                )}
              </div>
            </div>
            {importResult.success && (
              <>
                {/* Mini progress for current gym */}
                <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    📊 {gyms.find(g => g.id === selectedGym)?.name || selectedGym} Progress:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {eventTypes.map(type => {
                      const status = getSyncStatus(selectedGym, type);
                      const shortType = type === 'KIDS NIGHT OUT' ? 'KNO' : 
                                       type === 'OPEN GYM' ? 'OG' :
                                       type === 'SPECIAL EVENT' ? 'SE' : type;
                      return (
                        <span 
                          key={type}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            status 
                              ? status.events_found > 0 
                                ? 'bg-green-200 text-green-800' 
                                : 'bg-yellow-200 text-yellow-800'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {shortType} {status ? '✓' : '✗'}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                      // Reset form for next sync - keep gym selected
                  setResult(null);
                  setImportResult(null);
                  setEditableEvents([]);
                  setComparison(null);
                  setSelectedEventType('');
                  // Keep selectedGym so they don't have to reselect it
                }}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm"
              >
                🔄 Sync Another Program
              </button>
                  <button
                    onClick={() => {
                      // Reset everything - pick new gym
                      setResult(null);
                      setImportResult(null);
                      setEditableEvents([]);
                      setComparison(null);
                      setSelectedEventType('');
                      setSelectedGym('');
                    }}
                    className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors text-sm"
                  >
                    🏢 Sync Another Gym
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

