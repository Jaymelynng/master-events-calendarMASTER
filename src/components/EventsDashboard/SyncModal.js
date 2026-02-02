import React, { useState, useEffect } from 'react';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import { eventsApi, syncLogApi, auditLogApi, gymValidValuesApi } from '../../lib/api';
import { compareEvents } from '../../lib/eventComparison';
import { supabase } from '../../lib/supabase';
import DismissRuleModal from './DismissRuleModal';

export default function SyncModal({ theme, onClose, onBack, gyms }) {
  const [selectedGym, setSelectedGym] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [editableEvents, setEditableEvents] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [syncLog, setSyncLog] = useState([]);
  const [showProgress, setShowProgress] = useState(true); // Expanded by default
  const [forceUpdate, setForceUpdate] = useState(false); // Force re-import even if "same"
  const [showAuditPanel, setShowAuditPanel] = useState(false); // Show validation errors panel
  const [dismissingError, setDismissingError] = useState(null); // Track which error is being dismissed
  const [dismissModalState, setDismissModalState] = useState(null); // { event, errorMessage, errorObj, gymId }

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

  // Helper: Check if an error message is acknowledged (supports both old string format and new object format)
  const isErrorAcknowledged = (acknowledgedErrors, errorMessage) => {
    if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return false;
    return acknowledgedErrors.some(ack => 
      typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
    );
  };

  // Get events with validation issues from the sync results
  const getEventsWithValidationIssues = () => {
    if (!editableEvents || editableEvents.length === 0) return [];
    
    return editableEvents.filter(event => {
      const errors = event.validation_errors || [];
      // Filter out sold_out type (it's informational)
      const realErrors = errors.filter(err => err.type !== 'sold_out');
      return realErrors.length > 0 || 
             event.description_status === 'none' || 
             event.description_status === 'flyer_only';
    }).map(event => {
      const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
      // Separate by category
      const dataErrors = errors.filter(e => e.category === 'data_error');
      const formattingErrors = errors.filter(e => e.category === 'formatting');
      const statusErrors = errors.filter(e => e.category === 'status');
      const otherErrors = errors.filter(e => !e.category);
      
      return {
        ...event,
        dataErrors,
        formattingErrors,
        statusErrors,
        otherErrors,
        totalErrors: errors.length,
        hasDescriptionIssue: event.description_status === 'none' || event.description_status === 'flyer_only'
      };
    });
  };

  // Check if an error type supports "Add as Rule"
  const canAddAsRule = (errorType) => {
    return errorType === 'camp_price_mismatch' || errorType === 'time_mismatch' ||
           errorType === 'program_mismatch' || errorType === 'missing_program_in_title';
  };

  // Extract rule value from an error message (price, time, or program synonym)
  const extractRuleValue = (errorObj, event = null) => {
    if (errorObj.type === 'camp_price_mismatch') {
      const priceMatch = errorObj.message.match(/\$(\d+(?:\.\d{2})?)/);
      return priceMatch ? { ruleType: 'price', value: priceMatch[1] } : null;
    } else if (errorObj.type === 'time_mismatch') {
      const timeMatch = errorObj.message.match(/(?:description|title) says (\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p))/i);
      return timeMatch ? { ruleType: 'time', value: timeMatch[1].trim() } : null;
    } else if (errorObj.type === 'program_mismatch' || errorObj.type === 'missing_program_in_title') {
      // For program mismatches, the value is the event title (as the synonym keyword)
      // and the label will be the expected program type (set by user or from event.type)
      const titleValue = event?.title || '';
      return titleValue ? { ruleType: 'program_synonym', value: titleValue.toLowerCase(), suggestedLabel: event?.type || '' } : null;
    }
    return null;
  };

  // Opens the custom dismiss modal instead of using window.prompt/confirm
  const handleDismissError = (event, errorMessage, errorObj = null) => {
    const gymId = event.gym_id || selectedGym;
    const ruleEligible = errorObj ? canAddAsRule(errorObj.type) : false;
    const ruleInfo = errorObj ? extractRuleValue(errorObj, event) : null;
    setDismissModalState({ event, errorMessage, errorObj, gymId, ruleEligible, ruleInfo });
  };

  // Actually dismiss the error in the database (called by modal callbacks)
  const executeDismiss = async (event, errorMessage, note, hasRule = false) => {
    try {
      setDismissingError(`${event.event_url}-${errorMessage}`);

      const { data: existingEvent, error: fetchError } = await supabase
        .from('events')
        .select('id, acknowledged_errors')
        .eq('event_url', event.event_url)
        .single();

      if (fetchError || !existingEvent) {
        alert('This event needs to be imported first before you can dismiss warnings.');
        setDismissingError(null);
        return;
      }

      const currentAcknowledged = existingEvent.acknowledged_errors || [];

      if (!isErrorAcknowledged(currentAcknowledged, errorMessage)) {
        const acknowledgment = {
          message: errorMessage,
          note: note || null,
          dismissed_at: new Date().toISOString(),
          ...(hasRule ? { has_rule: true } : {})
        };

        const updatedAcknowledged = [...currentAcknowledged, acknowledgment];

        const { error: updateError } = await supabase
          .from('events')
          .update({ acknowledged_errors: updatedAcknowledged })
          .eq('id', existingEvent.id);

        if (updateError) throw updateError;
        console.log(`✅ Dismissed error for "${event.title}": "${errorMessage}"`);
      }

      setDismissingError(null);
    } catch (error) {
      console.error('Error dismissing validation error:', error);
      alert('Failed to dismiss error. Please try again.');
      setDismissingError(null);
    }
  };

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
        // IMPORTANT: Fetch ALL events (no date filter) to properly compare
        // The sync may include past events that are already in the database
        try {
          const existingEvents = await eventsApi.getAll(null, null, true); // No date filter, include deleted
          const gymExistingEvents = existingEvents.filter(ev => ev.gym_id === selectedGym);
          
          console.log('🔍 Comparison: incoming=', allEvents.length, 'existing=', gymExistingEvents.length);
          
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
        // IMPORTANT: Fetch ALL events (no date filter) to properly compare
        // The sync may include past events that are already in the database
        try {
          const existingEvents = await eventsApi.getAll(null, null, true); // No date filter, include deleted
          const gymExistingEvents = existingEvents.filter(
            ev => ev.gym_id === selectedGym && ev.type === eventType
          );
          
          console.log('🔍 Comparison: incoming=', data.events.length, 'existing=', gymExistingEvents.length);
          
          // Compare new vs existing
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
    if (!result || !result.success) {
      return;
    }
    
    // Check if there's actually anything to do (new, changed, or deleted)
    const hasNewEvents = editableEvents.length > 0;
    const hasChangedEvents = comparison && comparison.changed && comparison.changed.length > 0;
    const hasDeletedEvents = comparison && comparison.deleted && comparison.deleted.length > 0;
    
    // If forceUpdate is enabled, we update all events regardless of change status
    if (!forceUpdate && !hasNewEvents && !hasChangedEvents && !hasDeletedEvents) {
      return; // Nothing to sync
    }

    setImporting(true);
    setImportResult(null);

    try {
      // Remove the _index and _eventType fields before importing
      const eventsToImport = editableEvents.map(({ _index, _eventType, ...ev }) => ev);
      
      // Import new events (only if there are any)
      const imported = hasNewEvents ? await eventsApi.bulkImport(eventsToImport) : [];
      
      // Log CREATE audit for new events
      for (const newEvent of imported) {
        try {
          await auditLogApi.log(
            newEvent.id,
            newEvent.gym_id,
            'CREATE',
            'all',
            null,
            JSON.stringify({ title: newEvent.title, date: newEvent.date, price: newEvent.price }),
            newEvent.title,
            newEvent.date,
            'Sync Import'
          );
        } catch (auditErr) {
          console.error('Error logging CREATE audit:', auditErr);
        }
      }
      
      // Update changed events
      let updatedCount = 0;
      if (comparison && comparison.changed.length > 0) {
        for (const changed of comparison.changed) {
          try {
            // Find the event in database by URL (include deleted events to restore them)
            // Use null dates to search ALL events, not just future ones
            const existingEvents = await eventsApi.getAll(null, null, true); // includeDeleted = true, no date filter
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
                // Data quality validation fields
                has_flyer: changed.incoming.has_flyer || false,
                flyer_url: changed.incoming.flyer_url || null,
                description_status: changed.incoming.description_status || 'unknown',
                validation_errors: changed.incoming.validation_errors || [],
                // Availability tracking from iClassPro
                has_openings: changed.incoming.has_openings !== undefined ? changed.incoming.has_openings : true,
                registration_start_date: changed.incoming.registration_start_date || null,
                registration_end_date: changed.incoming.registration_end_date || null,
                deleted_at: null  // Ensure it's not marked as deleted
              });
              
              // Log UPDATE audit for each field that changed
              if (changed._changes && changed._changes.length > 0) {
                for (const fieldChange of changed._changes) {
                  try {
                    await auditLogApi.log(
                      existingEvent.id,
                      existingEvent.gym_id,
                      'UPDATE',
                      fieldChange.field,
                      String(fieldChange.old),
                      String(fieldChange.new),
                      changed.incoming.title,
                      changed.incoming.date,
                      'Sync Import'
                    );
                  } catch (auditErr) {
                    console.error('Error logging UPDATE audit:', auditErr);
                  }
                }
              }
              
              updatedCount++;
            }
          } catch (err) {
            console.error('Error updating event:', err);
          }
        }
      }
      
      // Force update: Also update "unchanged" events to refresh validation_errors
      let forceUpdatedCount = 0;
      if (forceUpdate && comparison && comparison.unchanged.length > 0) {
        console.log(`🔄 Force updating ${comparison.unchanged.length} unchanged events...`);
        const allExistingEvents = await eventsApi.getAll(null, null, true);
        
        for (const unchangedEvent of comparison.unchanged) {
          try {
            // Find the matching incoming event (with fresh validation_errors)
            const incomingEvent = editableEvents.find(e => e.event_url === unchangedEvent.event_url);
            if (!incomingEvent) continue;
            
            const existingEvent = allExistingEvents.find(e => e.event_url === unchangedEvent.event_url);
            if (!existingEvent) continue;
            
            // Update with fresh validation data
            await eventsApi.update(existingEvent.id, {
              // Data quality validation fields - these are what we're updating
              has_flyer: incomingEvent.has_flyer || false,
              flyer_url: incomingEvent.flyer_url || null,
              description_status: incomingEvent.description_status || 'unknown',
              validation_errors: incomingEvent.validation_errors || [],
              // Availability tracking
              has_openings: incomingEvent.has_openings !== undefined ? incomingEvent.has_openings : true,
              registration_start_date: incomingEvent.registration_start_date || null,
              registration_end_date: incomingEvent.registration_end_date || null
            });
            forceUpdatedCount++;
          } catch (err) {
            console.error('Error force-updating event:', err);
          }
        }
        console.log(`✅ Force updated ${forceUpdatedCount} events with fresh validation data`);
      }
      
      // Mark deleted events (in DB but not in portal) as deleted
      // NOTE: The compareEvents function already filters to only include events that
      // haven't started yet, so everything in comparison.deleted is safe to mark
      let deletedCount = 0;
      if (comparison && comparison.deleted.length > 0) {
        for (const deletedEvent of comparison.deleted) {
          try {
            // Double-check: only mark as deleted if it HASN'T STARTED YET
            // Use start_date (not end_date) - a camp that started shouldn't be deleted
            const rawStartDate = deletedEvent.start_date || deletedEvent.date;
            const eventStartDate = rawStartDate ? String(rawStartDate).split('T')[0] : null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];
            
            // Only delete if event hasn't started (start date is AFTER today)
            if (eventStartDate && eventStartDate > todayStr) {
              // Mark as deleted (soft delete)
              await eventsApi.markAsDeleted(deletedEvent.id);
              deletedCount++;
              console.log(`🗑️ Marked as deleted: "${deletedEvent.title}" (starts ${eventStartDate})`);
              
              // Log DELETE audit
              try {
                await auditLogApi.log(
                  deletedEvent.id,
                  deletedEvent.gym_id,
                  'DELETE',
                  'all',
                  deletedEvent.title,
                  null,
                  deletedEvent.title,
                  deletedEvent.date,
                  'Sync Import'
                );
              } catch (auditErr) {
                console.error('Error logging DELETE audit:', auditErr);
              }
            } else {
              console.log(`⏭️ Skipping delete for "${deletedEvent.title}" - already started on ${eventStartDate}`);
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
        forceUpdated: forceUpdatedCount,
        total: editableEvents.length
      });
      
      // Reset force update checkbox after successful import
      setForceUpdate(false);

      // Explicitly invalidate cache to ensure fresh data
      // Real-time subscription should also trigger, but this is a safety net
      const { cache } = await import('../../lib/cache');
      cache.invalidate('events');
      
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


  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-7xl my-4 flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                ← Back
              </button>
            )}
            <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-2">
              ⚡ Automated Sync
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

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

        {/* AUDIT ISSUES PANEL - Show validation errors from synced events */}
        {result && result.success && editableEvents.length > 0 && !importResult && (() => {
          const eventsWithIssues = getEventsWithValidationIssues();
          const totalDataErrors = eventsWithIssues.reduce((sum, e) => sum + e.dataErrors.length, 0);
          const totalFormattingErrors = eventsWithIssues.reduce((sum, e) => sum + e.formattingErrors.length, 0);
          const totalDescriptionIssues = eventsWithIssues.filter(e => e.hasDescriptionIssue).length;
          const totalIssues = totalDataErrors + totalFormattingErrors + totalDescriptionIssues;
          
          if (totalIssues === 0) return null;
          
          return (
            <div className="mb-4 border-2 border-red-300 rounded-lg overflow-hidden bg-white">
              <div 
                className="bg-red-50 px-4 py-3 border-b-2 border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => setShowAuditPanel(!showAuditPanel)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <h3 className="font-bold text-red-800 text-lg">Audit Issues Found</h3>
                      <p className="text-xs text-red-600 mt-0.5">
                        {eventsWithIssues.length} event{eventsWithIssues.length !== 1 ? 's' : ''} with validation issues
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      {totalDataErrors > 0 && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                          {totalDataErrors} DATA
                        </span>
                      )}
                      {totalFormattingErrors > 0 && (
                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">
                          {totalFormattingErrors} FORMAT
                        </span>
                      )}
                      {totalDescriptionIssues > 0 && (
                        <span className="px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded">
                          {totalDescriptionIssues} DESC
                        </span>
                      )}
                    </div>
                    <span className="text-red-600 text-lg">{showAuditPanel ? '▼' : '▶'}</span>
                  </div>
                </div>
              </div>
              
              {showAuditPanel && (
                <div className="max-h-96 overflow-y-auto">
                  {eventsWithIssues.map((event, eventIdx) => (
                    <div key={eventIdx} className="border-b border-red-100 last:border-b-0">
                      <div className="px-4 py-3 bg-red-50/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-sm truncate" title={event.title}>
                              {event.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {event.date} • {event.type || 'Unknown Type'}
                            </div>
                          </div>
                          {event.event_url && (
                            <a 
                              href={event.event_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex-shrink-0 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                            >
                              🔗 iClass
                            </a>
                          )}
                        </div>
                        
                        {/* Description Issues */}
                        {event.hasDescriptionIssue && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                            {event.description_status === 'none' ? (
                              <span className="text-red-600">❌ <strong>No description</strong> - Event has no description text</span>
                            ) : (
                              <span className="text-yellow-700">⚠️ <strong>Flyer only</strong> - Has image but no text description</span>
                            )}
                          </div>
                        )}
                        
                        {/* Data Errors (High Priority) */}
                        {event.dataErrors.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                              <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px]">HIGH</span>
                              Data Errors:
                            </div>
                            <div className="space-y-1">
                              {event.dataErrors.map((error, errIdx) => (
                                <div key={errIdx} className="flex items-center justify-between gap-2 p-1.5 bg-red-100 rounded border-l-4 border-red-500 text-xs">
                                  <span className="flex-1 text-red-800">
                                    🚨 {error.message}
                                  </span>
                                  <button
                                    onClick={() => handleDismissError(event, error.message, error)}
                                    disabled={dismissingError === `${event.event_url}-${error.message}`}
                                    className="flex-shrink-0 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors font-medium disabled:opacity-50"
                                    title="Dismiss with optional note"
                                  >
                                    {dismissingError === `${event.event_url}-${error.message}` ? '...' : '✓ OK'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Formatting Errors (Lower Priority) */}
                        {event.formattingErrors.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
                              <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">FORMAT</span>
                              Missing Info:
                            </div>
                            <div className="space-y-1">
                              {event.formattingErrors.map((error, errIdx) => (
                                <div key={errIdx} className="flex items-center justify-between gap-2 p-1.5 bg-orange-50 rounded border-l-4 border-orange-400 text-xs">
                                  <span className="flex-1 text-orange-800">
                                    ⚠️ {error.message}
                                  </span>
                                  <button
                                    onClick={() => handleDismissError(event, error.message)}
                                    disabled={dismissingError === `${event.event_url}-${error.message}`}
                                    className="flex-shrink-0 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors font-medium disabled:opacity-50"
                                    title="Dismiss with optional note"
                                  >
                                    {dismissingError === `${event.event_url}-${error.message}` ? '...' : '✓ OK'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Status/Other Errors */}
                        {(event.statusErrors.length > 0 || event.otherErrors.length > 0) && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-blue-700 mb-1">Other:</div>
                            <div className="space-y-1">
                              {[...event.statusErrors, ...event.otherErrors].map((error, errIdx) => (
                                <div key={errIdx} className="flex items-center justify-between gap-2 p-1.5 bg-blue-50 rounded border-l-4 border-blue-400 text-xs">
                                  <span className="flex-1 text-blue-800">
                                    ℹ️ {error.message}
                                  </span>
                                  <button
                                    onClick={() => handleDismissError(event, error.message)}
                                    disabled={dismissingError === `${event.event_url}-${error.message}`}
                                    className="flex-shrink-0 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors font-medium disabled:opacity-50"
                                    title="Dismiss with optional note"
                                  >
                                    {dismissingError === `${event.event_url}-${error.message}` ? '...' : '✓ OK'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-2 bg-red-100 text-xs text-red-700 flex items-center justify-between">
                <span>💡 "✓ OK" = dismiss once | "+ Rule" = teach the system for this gym</span>
                <span className="text-red-600 font-medium">
                  {showAuditPanel ? 'Click header to collapse' : 'Click header to expand'}
                </span>
              </div>
            </div>
          );
        })()}

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
                  {/* Sort events: NEW first, then CHANGED, then UNCHANGED */}
                  {[...editableEvents]
                    .map((event, idx) => {
                      // Determine status from comparison
                      let status = 'new';
                      let changeInfo = null;
                      
                      if (comparison) {
                        const isNew = comparison.new.some(e => e.event_url === event.event_url);
                        const isChanged = comparison.changed.find(c => c.incoming.event_url === event.event_url);
                        const isUnchanged = comparison.unchanged.some(e => e.event_url === event.event_url);
                        
                        if (isChanged) {
                          status = 'changed';
                          changeInfo = isChanged._changes;
                        } else if (isNew) {
                          status = 'new';
                        } else if (isUnchanged) {
                          status = 'unchanged';
                        }
                      }
                      
                      return { ...event, _status: status, _changeInfo: changeInfo, _originalIdx: idx };
                    })
                    .sort((a, b) => {
                      const order = { new: 0, changed: 1, unchanged: 2 };
                      return order[a._status] - order[b._status];
                    })
                    .map((event) => {
                      const status = event._status;
                      const changeInfo = event._changeInfo;
                      const idx = event._originalIdx;
                      
                      // Row colors based on status
                      const rowColor = status === 'new' 
                        ? 'bg-green-50 border-l-4 border-l-green-500' 
                        : status === 'changed' 
                          ? 'bg-yellow-50 border-l-4 border-l-yellow-500' 
                          : 'bg-white border-l-4 border-l-gray-200';
                      
                      // Status badge colors
                      const statusColor = status === 'new'
                        ? 'bg-green-500 text-white font-bold'
                        : status === 'changed'
                          ? 'bg-yellow-500 text-white font-bold'
                          : 'bg-gray-200 text-gray-600';
                      
                      // Status text
                      const statusText = status === 'new' 
                        ? '🆕 NEW' 
                        : status === 'changed' 
                          ? '🔄 CHANGED' 
                          : '✓ Same';
                    
                    return (
                      <tr key={event._index || idx} className={`border-b border-gray-100 ${rowColor}`}>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded ${statusColor}`} title={changeInfo ? `Changed: ${changeInfo.map(c => c.field).join(', ')}` : ''}>
                              {statusText}
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

        {/* Deleted Events Preview - Show which events will be removed */}
        {result && result.success && comparison && comparison.deleted && comparison.deleted.length > 0 && !importResult && (
          <div className="mb-4 border-2 border-orange-300 rounded-lg overflow-hidden bg-white">
            <div className="bg-orange-50 px-4 py-3 border-b-2 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-orange-800 text-lg">🗑️ Events to be Removed</h3>
                  <p className="text-xs text-orange-600 mt-1">
                    These events are in your database but no longer on iClassPro
                  </p>
                </div>
                <div className="text-xs text-orange-600 font-bold">
                  {comparison.deleted.length} event{comparison.deleted.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">Event</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-orange-800">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.deleted.map((event, idx) => (
                    <tr key={idx} className="border-b border-orange-100 bg-orange-50">
                      <td className="px-3 py-2 text-orange-900 font-medium">
                        {event.title}
                      </td>
                      <td className="px-3 py-2 text-orange-700">
                        {event.date}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 text-xs rounded bg-orange-200 text-orange-800">
                          {event.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-orange-100 text-xs text-orange-700">
              ℹ️ These will be soft-deleted (marked as removed, not permanently deleted)
            </div>
          </div>
        )}

        {/* Import Button (only show if sync was successful and there's something to import) */}
        {result && result.success && editableEvents.length > 0 && !importResult && (
          (() => {
            const newCount = comparison?.new?.length || 0;
            const changedCount = comparison?.changed?.length || 0;
            const hasChanges = newCount > 0 || changedCount > 0;
            
            if (!hasChanges) {
              // All events are unchanged - show informational message with navigation buttons
              return (
                <div className="mb-4">
                  <div className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg border-2 border-green-300 text-center mb-3">
                    ✅ All {editableEvents.length} events are already up-to-date in the database
                  </div>
                  
                  {/* Force Re-import option - useful for updating validation errors */}
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceUpdate}
                        onChange={(e) => setForceUpdate(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded"
                      />
                      <span className="text-sm text-amber-800">
                        <strong>Force Re-import All</strong> - Update validation & audit data even if events look the same
                      </span>
                    </label>
                    {forceUpdate && (
                      <button
                        onClick={handleImport}
                        disabled={importing}
                        className="w-full mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2"
                      >
                        {importing ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Re-importing...
                          </>
                        ) : (
                          <>🔄 Force Re-import {editableEvents.length} Events</>
                        )}
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setResult(null);
                        setSelectedEventType('');
                        setEditableEvents([]);
                        setComparison(null);
                        setForceUpdate(false);
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
                        setEditableEvents([]);
                        setComparison(null);
                        setForceUpdate(false);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors shadow-md"
                    >
                      🏢 Sync Another Gym
                    </button>
                  </div>
                </div>
              );
            }
            
            const unchangedCount = comparison?.unchanged?.length || 0;
            
            return (
              <div className="mb-4">
                {/* Main Import Button */}
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                >
                  {importing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      🚀 Import {newCount > 0 ? `${newCount} new` : ''}{newCount > 0 && changedCount > 0 ? ' + ' : ''}{changedCount > 0 ? `${changedCount} changed` : ''}{(comparison?.deleted?.length > 0) ? ` (+ ${comparison.deleted.length} removed)` : ''} Events
                    </>
                  )}
                </button>
                
                {/* Force Re-import option for unchanged events */}
                {unchangedCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceUpdate}
                        onChange={(e) => setForceUpdate(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded"
                      />
                      <span className="text-sm text-amber-800">
                        <strong>Also re-validate {unchangedCount} unchanged events</strong> - Apply new validation rules
                      </span>
                    </label>
                    {forceUpdate && (
                      <p className="text-xs text-amber-600 mt-1 ml-6">
                        ✓ Will import {newCount + changedCount} + force re-validate {unchangedCount} = {newCount + changedCount + unchangedCount} total events
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()
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
                    {importResult.forceUpdated > 0 && (
                      <span> • 🔄 Force-refreshed <strong>{importResult.forceUpdated}</strong> validation data</span>
                    )}
                    {importResult.deleted > 0 && (
                      <span> • 🗑️ Marked <strong>{importResult.deleted}</strong> events as deleted</span>
                    )}
                    {importResult.total > importResult.imported + (importResult.updated || 0) + (importResult.forceUpdated || 0) && (
                      <span> • ⏭️ {importResult.total - importResult.imported - (importResult.updated || 0) - (importResult.forceUpdated || 0)} unchanged</span>
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
      {/* Dismiss/Rule Modal for validation errors */}
      {dismissModalState && (
        <DismissRuleModal
          errorMessage={dismissModalState.errorMessage}
          gymId={dismissModalState.gymId}
          ruleEligible={dismissModalState.ruleEligible}
          ruleInfo={dismissModalState.ruleInfo}
          onCancel={() => setDismissModalState(null)}
          onDismiss={async (note) => {
            await executeDismiss(dismissModalState.event, dismissModalState.errorMessage, note);
            setDismissModalState(null);
          }}
          onDismissAndRule={async (note, label) => {
            await executeDismiss(dismissModalState.event, dismissModalState.errorMessage, note, true);
            const { ruleInfo, gymId } = dismissModalState;
            if (ruleInfo && gymId) {
              try {
                const isProgramSynonym = ruleInfo.ruleType === 'program_synonym';
                await gymValidValuesApi.create({
                  gym_id: gymId,
                  rule_type: ruleInfo.ruleType,
                  value: isProgramSynonym ? ruleInfo.value.toLowerCase() : ruleInfo.value,
                  label: label,
                  event_type: isProgramSynonym ? label.toUpperCase() : 'CAMP'
                });
                const displayValue = ruleInfo.ruleType === 'price' ? `$${ruleInfo.value}` : ruleInfo.value;
                alert(`Rule saved! "${displayValue}" is now valid for ${gymId} (${label}).`);
              } catch (ruleErr) {
                console.error('Error adding rule:', ruleErr);
                alert('Dismissed OK, but failed to add rule. Add it manually in Admin → Gym Rules.');
              }
            }
            setDismissModalState(null);
          }}
        />
      )}
    </div>
  );
}

