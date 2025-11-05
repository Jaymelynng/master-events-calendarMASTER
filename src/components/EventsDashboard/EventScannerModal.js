import React, { useState, useEffect } from 'react';

export default function EventScannerModal({
  theme,
  onClose,
  gymsList,
  eventsApi
}) {
  const [pastedText, setPastedText] = useState('');
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState({
    'CLINIC': true,
    'KIDS NIGHT OUT': true,
    'OPEN GYM': true,
    'CAMP': true
  });

  // Fetch ALL events from database when modal opens
  useEffect(() => {
    const fetchAllEvents = async () => {
      try {
        console.log('🔍 Scanner fetching ALL events from database...');
        const allEventsFromDb = await eventsApi.getAll('2024-01-01', '2027-12-31');
        setAllEvents(allEventsFromDb || []);
        console.log(`📊 Scanner loaded ${allEventsFromDb?.length || 0} total events from database`);
      } catch (error) {
        console.error('Error fetching events for scanner:', error);
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllEvents();
  }, [eventsApi]);

  // Parse gym name from text
  const parseGymFromText = (text) => {
    const gymMappings = {
      'Capital Gymnastics - Cedar Park': 'CCP',
      'Capital Gymnastics - Pflugerville': 'CPF',
      'Capital Gymnastics- Round Rock': 'CRR',
      'Estrella Gymnastics': 'EST',
      'Houston Gymnastics Academy': 'HGA',
      'Oasis Gymnastics': 'OAS',
      'Rowland Ballard Atascocita': 'RBA',
      'Rowland/Ballard School - Kingwood': 'RBK',
      'Scottsdale Gymnastics': 'SGT',
      'TIGAR Gymnastics': 'TIG'
    };

    for (const [name, abbr] of Object.entries(gymMappings)) {
      if (text.includes(name)) {
        return { name, abbr };
      }
    }
    return null;
  };

  // Parse date from various formats
  const parseDate = (dateText) => {
    try {
      const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };

      const match = dateText.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
      if (match) {
        const month = monthMap[match[1].toLowerCase().substring(0, 3)];
        const day = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.error('Date parse error:', e);
    }
    return null;
  };

  // Parse time from text
  const parseTime = (timeText) => {
    const match = timeText.match(/(\d{1,2}:\d{2})\s*([ap]m)?\s*-\s*(\d{1,2}:\d{2})\s*([ap]m)?/i);
    if (match) {
      const start = match[1];
      const startPeriod = match[2] || match[4];
      const end = match[3];
      const endPeriod = match[4];
      return `${start} ${startPeriod?.toUpperCase() || 'AM'} - ${end} ${endPeriod?.toUpperCase() || 'PM'}`;
    }
    return null;
  };

  // Parse event type from text
  const parseEventType = (text) => {
    const upperText = text.toUpperCase();
    if (upperText.includes('KIDS NIGHT OUT') || upperText.includes('KNO')) return 'KIDS NIGHT OUT';
    if (upperText.includes('CLINIC')) return 'CLINIC';
    if (upperText.includes('OPEN GYM') || upperText.includes('GYM FUN')) return 'OPEN GYM';
    if (upperText.includes('CAMP') || upperText.includes('SCHOOL YEAR CAMP')) return 'CAMP';
    return 'UNKNOWN';
  };

  // Normalize for comparison
  const normalizeTime = (time) => {
    if (!time) return '';
    return time.replace(/\s+/g, ' ').trim().toUpperCase();
  };

  const scanEvents = async () => {
    setScanning(true);
    
    try {
      const lines = pastedText.split('\n');
      const eventsFoundInText = [];
      let currentGym = null;
      let currentEventType = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Detect gym name
        const gym = parseGymFromText(line);
        if (gym) {
          currentGym = gym;
          continue;
        }

        // Detect event type
        if (line.includes('CLINIC') || line.includes('KIDS NIGHT OUT') || line.includes('OPEN GYM') || line.includes('SCHOOL YEAR CAMP')) {
          currentEventType = parseEventType(line);
          continue;
        }

        // Parse event title line
        if (line.includes('|') && (line.includes('2025') || line.includes('2026'))) {
          const fullTitle = line;
          let date = null;
          let time = null;
          
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            date = parseDate(nextLine);
          }
          
          if (i + 3 < lines.length) {
            const timeLine = lines[i + 3].trim();
            time = parseTime(timeLine);
          }
          
          if (date && currentGym) {
            eventsFoundInText.push({
              gym: currentGym.abbr,
              gymName: currentGym.name,
              date: date,
              time: time,
              title: fullTitle,
              type: currentEventType || parseEventType(line)
            });
          }
        }
      }

      // De-duplicate
      const uniqueEvents = [];
      const seenKeys = new Set();
      
      eventsFoundInText.forEach(event => {
        const key = `${event.gym}-${event.date}-${event.time || 'notime'}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueEvents.push(event);
        }
      });

      console.log('📋 Unique events parsed from text:', uniqueEvents.length);

      // Compare with database
      const results = {
        newEvents: [],
        changedEvents: [],
        deletedEvents: [],
        unchanged: []
      };

      const categoriesToProcess = Object.keys(selectedCategories).filter(cat => selectedCategories[cat]);
      
      categoriesToProcess.forEach(category => {
        const textEvents = uniqueEvents.filter(e => e.type === category);
        const dbEvents = allEvents.filter(e => e.type === category && new Date(e.date) >= new Date());

        // Check each text event
        textEvents.forEach(textEvent => {
          // Try to find matching event in DB by gym + date
          const potentialMatches = dbEvents.filter(dbEvent => 
            dbEvent.gym_id === textEvent.gym &&
            Math.abs(new Date(dbEvent.date) - new Date(textEvent.date)) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
          );

          if (potentialMatches.length === 0) {
            // NEW EVENT - not in database at all
            results.newEvents.push({
              category,
              gym: textEvent.gymName,
              gymAbbr: textEvent.gym,
              event: textEvent
            });
          } else {
            // Check for CHANGES
            let exactMatch = null;
            let hasChanges = false;
            const changes = [];

            potentialMatches.forEach(dbEvent => {
              const dateMatch = dbEvent.date === textEvent.date;
              const timeMatch = normalizeTime(dbEvent.time) === normalizeTime(textEvent.time);
              
              if (dateMatch && timeMatch) {
                exactMatch = dbEvent;
                // Check title changes
                if (dbEvent.title !== textEvent.title) {
                  hasChanges = true;
                  changes.push({
                    field: 'title',
                    old: dbEvent.title,
                    new: textEvent.title
                  });
                }
              } else if (dbEvent.date === textEvent.date && !timeMatch) {
                // Same date, different time = CHANGE
                exactMatch = dbEvent;
                hasChanges = true;
                changes.push({
                  field: 'time',
                  old: dbEvent.time,
                  new: textEvent.time
                });
              } else if (timeMatch && !dateMatch) {
                // Same time, different date = CHANGE
                exactMatch = dbEvent;
                hasChanges = true;
                changes.push({
                  field: 'date',
                  old: dbEvent.date,
                  new: textEvent.date
                });
              }
            });

            if (hasChanges && exactMatch) {
              results.changedEvents.push({
                category,
                gym: textEvent.gymName,
                gymAbbr: textEvent.gym,
                dbEvent: exactMatch,
                textEvent: textEvent,
                changes: changes
              });
            } else if (exactMatch) {
              results.unchanged.push(exactMatch);
            }
          }
        });

        // Check for DELETED events (in DB but not in text)
        if (textEvents.length > 0) {
          dbEvents.forEach(dbEvent => {
            const foundInText = textEvents.some(textEvent =>
              textEvent.gym === dbEvent.gym_id &&
              textEvent.date === dbEvent.date &&
              normalizeTime(textEvent.time) === normalizeTime(dbEvent.time)
            );
            
            if (!foundInText) {
              results.deletedEvents.push({
                category,
                gym: dbEvent.gym_name,
                gymAbbr: dbEvent.gym_id,
                event: dbEvent
              });
            }
          });
        }
      });

      setScanResults(results);
    } catch (error) {
      console.error('Scan error:', error);
      alert(`Scan Error: ${error.message}`);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-3xl">🔍</div>
            <div className="text-lg">Loading all events from database...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-hidden">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            🔍 Quick Event Scanner
            <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">Change Detection</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{allEvents.length} events loaded</span>
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-800 mb-2">📋 How to Use:</h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Select which categories you're scanning below ⬇️</li>
            <li>2. Open those gym event pages (use bulk buttons on main dashboard)</li>
            <li>3. On each gym page, copy ALL text (Ctrl+A, Ctrl+C)</li>
            <li>4. Paste everything here</li>
            <li>5. Click "🔍 Scan for Changes" to detect NEW/CHANGED/DELETED events</li>
          </ol>
        </div>

        {/* Category Selector */}
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-3">📂 What are you scanning?</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 rounded-lg border hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={selectedCategories['CLINIC']}
                onChange={(e) => setSelectedCategories({...selectedCategories, 'CLINIC': e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">🎯 Clinics</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 rounded-lg border hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={selectedCategories['KIDS NIGHT OUT']}
                onChange={(e) => setSelectedCategories({...selectedCategories, 'KIDS NIGHT OUT': e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">🌙 KNO</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 rounded-lg border hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={selectedCategories['OPEN GYM']}
                onChange={(e) => setSelectedCategories({...selectedCategories, 'OPEN GYM': e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">🏃 Open Gym</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer bg-white p-3 rounded-lg border hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={selectedCategories['CAMP']}
                onChange={(e) => setSelectedCategories({...selectedCategories, 'CAMP': e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">🏕️ Camps</span>
            </label>
          </div>
          <p className="text-xs text-purple-600 mt-2">
            💡 Uncheck categories you didn't paste
          </p>
        </div>

        {/* Text Input */}
        <div className="mb-4">
          <label className="block font-semibold mb-2 text-gray-800">
            Paste Gym Page Text:
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Copy and paste text from gym event pages here..."
            className="w-full h-48 p-3 border rounded-lg font-mono text-xs"
            style={{ borderColor: theme.colors.accent }}
          />
          <p className="text-xs text-gray-500 mt-1">
            {pastedText.length} characters
          </p>
        </div>

        {/* Scan Button */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={scanEvents}
            disabled={!pastedText.trim() || scanning}
            className="flex-1 px-6 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: theme.colors.primary }}
          >
            {scanning ? '⏳ Scanning...' : '🔍 Scan for Changes'}
          </button>
          <button
            onClick={() => {
              setPastedText('');
              setScanResults(null);
            }}
            className="px-6 py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Results */}
        {scanResults && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
              <h3 className="font-bold text-xl text-purple-800 mb-3">📊 Scan Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border-2 border-green-300">
                  <div className="text-3xl font-bold text-green-600">{scanResults.newEvents.length}</div>
                  <div className="text-sm text-gray-600">New Events</div>
                  <div className="text-xs text-green-600 mt-1">Need F12 Import</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border-2 border-orange-300">
                  <div className="text-3xl font-bold text-orange-600">{scanResults.changedEvents.length}</div>
                  <div className="text-sm text-gray-600">Changed Events</div>
                  <div className="text-xs text-orange-600 mt-1">Need Manual Update</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border-2 border-red-300">
                  <div className="text-3xl font-bold text-red-600">{scanResults.deletedEvents.length}</div>
                  <div className="text-sm text-gray-600">Removed Events</div>
                  <div className="text-xs text-red-600 mt-1">Check & Archive</div>
                </div>
              </div>
            </div>

            {/* NEW EVENTS */}
            {scanResults.newEvents.length > 0 && (
              <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                <h4 className="font-bold text-lg text-green-800 mb-3">
                  ✨ NEW EVENTS ({scanResults.newEvents.length}) - Import These via F12
                </h4>
                {Object.entries(scanResults.newEvents.reduce((acc, item) => {
                  if (!acc[item.gym]) acc[item.gym] = [];
                  acc[item.gym].push(item);
                  return acc;
                }, {})).map(([gym, events]) => (
                  <div key={gym} className="mb-3 bg-white p-3 rounded border border-green-200">
                    <div className="font-semibold text-green-800 mb-2">
                      {gym} - {events.length} new event{events.length > 1 ? 's' : ''}
                    </div>
                    <div className="space-y-1">
                      {events.map((item, idx) => (
                        <div key={idx} className="text-sm pl-4 border-l-2 border-green-400">
                          <div className="font-medium">{item.event.title.substring(0, 60)}{item.event.title.length > 60 ? '...' : ''}</div>
                          <div className="text-xs text-gray-600">{item.event.date} • {item.event.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHANGED EVENTS */}
            {scanResults.changedEvents.length > 0 && (
              <div className="border-2 border-orange-300 rounded-lg p-4 bg-orange-50">
                <h4 className="font-bold text-lg text-orange-800 mb-3">
                  📝 CHANGED EVENTS ({scanResults.changedEvents.length}) - Update Manually
                </h4>
                {scanResults.changedEvents.map((item, idx) => (
                  <div key={idx} className="mb-3 bg-white p-3 rounded border border-orange-200">
                    <div className="font-semibold text-orange-800 mb-1">{item.gym}</div>
                    <div className="text-sm font-medium mb-2">{item.dbEvent.title.substring(0, 60)}</div>
                    {item.changes.map((change, cIdx) => (
                      <div key={cIdx} className="text-sm bg-orange-50 p-2 rounded mb-1">
                        <span className="font-semibold uppercase text-orange-700">{change.field} CHANGED:</span>
                        <div className="ml-4">
                          <div className="text-red-600">❌ Your DB: {change.old}</div>
                          <div className="text-green-600">✅ Website: {change.new}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* DELETED EVENTS */}
            {scanResults.deletedEvents.length > 0 && (
              <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
                <h4 className="font-bold text-lg text-red-800 mb-3">
                  🗑️ REMOVED FROM WEBSITE ({scanResults.deletedEvents.length}) - Verify & Archive
                </h4>
                <p className="text-sm text-red-700 mb-3">
                  These events are in your database but not on gym websites. They may be cancelled or past events.
                </p>
                {Object.entries(scanResults.deletedEvents.reduce((acc, item) => {
                  if (!acc[item.gym]) acc[item.gym] = [];
                  acc[item.gym].push(item);
                  return acc;
                }, {})).map(([gym, events]) => (
                  <div key={gym} className="mb-3 bg-white p-3 rounded border border-red-200">
                    <div className="font-semibold text-red-800 mb-2">
                      {gym} - {events.length} event{events.length > 1 ? 's' : ''} removed
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {events.map((item, idx) => (
                        <div key={idx} className="text-sm pl-4 border-l-2 border-red-400">
                          <div className="font-medium">{item.event.title.substring(0, 60)}</div>
                          <div className="text-xs text-gray-600">{item.event.date} • {item.event.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All Clear */}
            {scanResults.newEvents.length === 0 && 
             scanResults.changedEvents.length === 0 && 
             scanResults.deletedEvents.length === 0 && (
              <div className="border-2 border-green-300 rounded-lg p-6 bg-green-50 text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-xl font-bold text-green-800">All Events Match!</div>
                <div className="text-sm text-green-700 mt-2">
                  Your database is 100% accurate with gym websites. No action needed!
                </div>
              </div>
            )}

            {/* Action Summary */}
            {(scanResults.newEvents.length > 0 || scanResults.changedEvents.length > 0) && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <h3 className="font-bold text-lg text-blue-800 mb-2">🎯 Action Plan:</h3>
                <ol className="text-sm text-blue-700 space-y-2">
                  {scanResults.newEvents.length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Do F12 Import for gyms with NEW events (green section above)</span>
                    </li>
                  )}
                  {scanResults.changedEvents.length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">{scanResults.newEvents.length > 0 ? '2' : '1'}.</span>
                      <span>Click events in calendar to edit CHANGED details (orange section above)</span>
                    </li>
                  )}
                  {scanResults.deletedEvents.length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="font-bold">{scanResults.newEvents.length + scanResults.changedEvents.length + 1}.</span>
                      <span>Verify REMOVED events - check if actually cancelled (red section above)</span>
                    </li>
                  )}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
