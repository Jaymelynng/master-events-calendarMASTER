import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ExportModal({ onClose, events, gyms, monthlyRequirements, currentMonth, currentYear }) {
  const [selectedGyms, setSelectedGyms] = useState(gyms.map(g => g.id)); // All selected by default
  const [selectedTypes, setSelectedTypes] = useState(['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'CAMP', 'SPECIAL EVENT']);
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(false);
  const [includeMissing, setIncludeMissing] = useState(false);
  
  // Date range - default to current month
  const [startDate, setStartDate] = useState(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]);
  
  // Events fetched from database based on date range
  const [fetchedEvents, setFetchedEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const eventTypes = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM', 'CAMP', 'SPECIAL EVENT'];

  // Fetch events when date range changes
  useEffect(() => {
    fetchEventsForDateRange();
  }, [startDate, endDate]);

  const fetchEventsForDateRange = async () => {
    setLoadingEvents(true);
    try {
      // Use events_with_gym view to include both active AND archived events
      const { data, error } = await supabase
        .from('events_with_gym')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (error) throw error;
      setFetchedEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setFetchedEvents([]);
    }
    setLoadingEvents(false);
  };

  // Always use fetched events based on date picker values
  const activeEvents = fetchedEvents;

  const toggleGym = (gymId) => {
    setSelectedGyms(prev => 
      prev.includes(gymId) 
        ? prev.filter(id => id !== gymId)
        : [...prev, gymId]
    );
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const selectAllGyms = () => setSelectedGyms(gyms.map(g => g.id));
  const selectNoGyms = () => setSelectedGyms([]);
  const selectAllTypes = () => setSelectedTypes([...eventTypes]);
  const selectNoTypes = () => setSelectedTypes([]);

  // Filter events based on selections
  const filteredEvents = activeEvents.filter(e => 
    selectedGyms.includes(e.gym_id) && selectedTypes.includes(e.type)
  );

  // Calculate analytics for selected gyms
  const getAnalytics = () => {
    const analytics = [];
    selectedGyms.forEach(gymId => {
      const gym = gyms.find(g => g.id === gymId);
      const gymEvents = activeEvents.filter(e => e.gym_id === gymId);
      
      const stats = {
        gym_id: gymId,
        gym_name: gym?.name || gymId,
        clinic_count: gymEvents.filter(e => e.type === 'CLINIC').length,
        kno_count: gymEvents.filter(e => e.type === 'KIDS NIGHT OUT').length,
        open_gym_count: gymEvents.filter(e => e.type === 'OPEN GYM').length,
        camp_count: gymEvents.filter(e => e.type === 'CAMP').length,
        special_event_count: gymEvents.filter(e => e.type === 'SPECIAL EVENT').length,
        total_events: gymEvents.length,
        clinic_required: monthlyRequirements?.['CLINIC'] || 1,
        kno_required: monthlyRequirements?.['KIDS NIGHT OUT'] || 2,
        open_gym_required: monthlyRequirements?.['OPEN GYM'] || 1,
        meets_requirements: true,
        missing: []
      };

      // Check requirements
      if (stats.clinic_count < stats.clinic_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.clinic_required - stats.clinic_count} CLINIC`);
      }
      if (stats.kno_count < stats.kno_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.kno_required - stats.kno_count} KNO`);
      }
      if (stats.open_gym_count < stats.open_gym_required) {
        stats.meets_requirements = false;
        stats.missing.push(`${stats.open_gym_required - stats.open_gym_count} OPEN GYM`);
      }

      analytics.push(stats);
    });
    return analytics;
  };

  // Get only gyms with missing requirements
  const getMissingGyms = () => {
    return getAnalytics().filter(a => !a.meets_requirements);
  };

  const handleExport = () => {
    const dateRangeLabel = `${startDate} to ${endDate}`;
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (exportFormat === 'csv') {
      exportCSV(dateRangeLabel, timestamp);
    } else {
      exportJSON(dateRangeLabel, timestamp);
    }
    onClose();
  };

  const exportCSV = (monthName, timestamp) => {
    let csvContent = '';
    
    // Events section
    if (includeEvents && filteredEvents.length > 0) {
      csvContent += `EVENTS - ${monthName}\n`;
      csvContent += 'Gym,Title,Type,Date,Time,Price,Ages,URL\n';
      filteredEvents.forEach(event => {
        const gym = gyms.find(g => g.id === event.gym_id);
        csvContent += [
          gym?.name || event.gym_id,
          `"${(event.title || '').replace(/"/g, '""')}"`,
          event.type || '',
          event.date || '',
          event.time || '',
          event.price || '',
          event.age_min && event.age_max ? `${event.age_min}-${event.age_max}` : (event.age_min ? `${event.age_min}+` : ''),
          event.event_url || ''
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Analytics section
    if (includeAnalytics) {
      const analytics = getAnalytics();
      csvContent += `ANALYTICS - ${monthName}\n`;
      csvContent += 'Gym,Clinics,KNO,Open Gym,Camps,Special Events,Total,Meets Requirements,Missing\n';
      analytics.forEach(stat => {
        csvContent += [
          stat.gym_name,
          stat.clinic_count,
          stat.kno_count,
          stat.open_gym_count,
          stat.camp_count,
          stat.special_event_count,
          stat.total_events,
          stat.meets_requirements ? 'YES' : 'NO',
          `"${stat.missing.join(', ')}"`
        ].join(',') + '\n';
      });
      csvContent += '\n';
    }

    // Missing section
    if (includeMissing) {
      const missing = getMissingGyms();
      csvContent += `GYMS WITH MISSING REQUIREMENTS - ${monthName}\n`;
      csvContent += 'Gym,Missing Events\n';
      missing.forEach(stat => {
        csvContent += `${stat.gym_name},"${stat.missing.join(', ')}"\n`;
      });
    }

    downloadFile(csvContent, `export-${timestamp}.csv`, 'text/csv');
  };

  const exportJSON = (monthName, timestamp) => {
    const exportData = {
      exportDate: new Date().toISOString(),
      month: monthName,
      filters: {
        gyms: selectedGyms,
        eventTypes: selectedTypes
      }
    };

    if (includeEvents) {
      exportData.events = filteredEvents;
      exportData.eventCount = filteredEvents.length;
    }

    if (includeAnalytics) {
      exportData.analytics = getAnalytics();
    }

    if (includeMissing) {
      exportData.missingRequirements = getMissingGyms();
    }

    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, `export-${timestamp}.json`, 'application/json');
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

  const canExport = (includeEvents || includeAnalytics || includeMissing) && 
                   (selectedGyms.length > 0 || includeMissing);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📤 Export Data
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

        {/* Date Range Selection - Simple date pickers */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">📅 Date Range:</h3>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">From:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            {loadingEvents && (
              <div className="text-sm text-blue-600 flex items-center gap-2 self-end pb-2">
                <span className="animate-spin">⏳</span> Loading...
              </div>
            )}
          </div>
          {!loadingEvents && (
            <div className="mt-2 text-sm text-gray-600">
              Found <span className="font-semibold text-blue-600">{activeEvents.length}</span> events in selected range
            </div>
          )}
        </div>

        {/* What to Export */}
        <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="font-semibold text-amber-800 mb-3">What to export:</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={includeEvents} 
                onChange={(e) => setIncludeEvents(e.target.checked)}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">
                📋 Event Details 
                {loadingEvents ? ' (loading...)' : ` (${filteredEvents.length} events)`}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={includeAnalytics} 
                onChange={(e) => setIncludeAnalytics(e.target.checked)}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">📊 Analytics Dashboard (counts per gym)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={includeMissing} 
                onChange={(e) => setIncludeMissing(e.target.checked)}
                className="w-4 h-4 text-amber-600"
              />
              <span className="text-gray-700">
                ⚠️ Missing Requirements 
                {loadingEvents ? ' (loading...)' : ''}
              </span>
            </label>
            {/* Show which gyms are missing */}
            {includeMissing && !loadingEvents && (
              <div className="ml-6 mt-2 p-2 bg-red-50 rounded border border-red-200 text-xs">
                {getMissingGyms().length > 0 ? (
                  <>
                    <div className="font-semibold text-red-700 mb-1">
                      {getMissingGyms().length} gym{getMissingGyms().length !== 1 ? 's' : ''} missing requirements for selected dates:
                    </div>
                    {getMissingGyms().map(gym => (
                      <div key={gym.gym_id} className="text-red-600">
                        • {gym.gym_id}: needs {gym.missing.join(', ')}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-green-700 font-semibold">
                    ✅ All gyms meet requirements for selected dates!
                  </div>
                )}
                <div className="mt-2 text-gray-500 italic border-t border-red-200 pt-1">
                  Checks: 1 CLINIC, 2 KNO, 1 OPEN GYM per gym
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gyms Selection */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-blue-800">Select Gyms:</h3>
            <div className="flex gap-2">
              <button onClick={selectAllGyms} className="text-xs px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded">All</button>
              <button onClick={selectNoGyms} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gyms.map(gym => (
              <label key={gym.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={selectedGyms.includes(gym.id)} 
                  onChange={() => toggleGym(gym.id)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-700">{gym.id} - {gym.name?.split(' ')[0]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Event Types Selection */}
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-purple-800">Select Event Types:</h3>
            <div className="flex gap-2">
              <button onClick={selectAllTypes} className="text-xs px-2 py-1 bg-purple-200 hover:bg-purple-300 rounded">All</button>
              <button onClick={selectNoTypes} className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {eventTypes.map(type => {
              const isRequired = ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'].includes(type);
              return (
                <label key={type} className={`flex items-center gap-2 cursor-pointer text-sm ${!isRequired ? 'opacity-60' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.includes(type)} 
                    onChange={() => toggleType(type)}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-gray-700">
                    {type}
                    {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <span className="text-red-500">*</span> = Required for monthly compliance
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3">Export Format:</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="format" 
                value="csv" 
                checked={exportFormat === 'csv'} 
                onChange={() => setExportFormat('csv')}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-700">📊 CSV (Excel, Google Sheets)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="format" 
                value="json" 
                checked={exportFormat === 'json'} 
                onChange={() => setExportFormat('json')}
                className="w-4 h-4 text-green-600"
              />
              <span className="text-gray-700">📋 JSON (backup/developers)</span>
            </label>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              canExport 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            📤 Export
          </button>
        </div>
      </div>
    </div>
  );
}

