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
        // Fetch wide date range to get everything
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
      // Handles formats like "Nov 14th, 2025"
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

  // Parse time from text - handles multiple formats
  const parseTime = (timeText) => {
    // Handle formats like: "6:15pm-7:15pm" or "6:15 PM - 7:15 PM" or "Fri| 6:15 PM - 7:15 PM"
    const match = timeText.match(/(\d{1,2}:\d{2})\s*([ap]m)?\s*-\s*(\d{1,2}:\d{2})\s*([ap]m)?/i);
    if (match) {
      const start = match[1];
      const startPeriod = match[2] || match[4]; // Get AM/PM from either position
      const end = match[3];
      const endPeriod = match[4];
      
      // Normalize to "HH:MM AM - HH:MM PM" format
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
    if (upperText.includes('CAMP')) return 'CAMP';
    return 'UNKNOWN';
  };

  const scanEvents = async () => {
    setScanning(true);
    
    try {
      // Split text by gym sections
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
          console.log('🏢 Detected gym:', gym.name);
          continue;
        }

        // Detect event type from section headers
        if (line.includes('CLINIC') || line.includes('KIDS NIGHT OUT') || line.includes('OPEN GYM') || line.includes('SCHOOL YEAR CAMP')) {
          currentEventType = parseEventType(line);
          console.log('📂 Detected category:', currentEventType);
          continue;
        }

        // Parse event TITLE line (contains pipes and year)
        if (line.includes('|') && (line.includes('2025') || line.includes('2026'))) {
          // This is the title line - get FULL title
          const fullTitle = line;
          
          // Get date from next line that looks like: "Nov 14th, 2025 - Nov 14th, 2025"
          let date = null;
          let time = null;
          
          // Look ahead for structured date line
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            date = parseDate(nextLine);
          }
          
          // Look ahead for time line (format: "Fri| 6:15 PM - 7:15 PM")
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
            
            console.log('✅ Parsed event:', {
              gym: currentGym.abbr,
              title: fullTitle.substring(0, 50),
              date,
              time
            });
          }
        }
      }

      console.log('📋 Total events found in pasted text:', eventsFoundInText.length);

      // Compare with existing events in Supabase
      const results = {
        byCategory: {},
        totalNew: 0,
        totalRemoved: 0,
        debugInfo: []
      };

      // Helper to normalize time for comparison
      const normalizeTime = (time) => {
        if (!time) return '';
        return time.replace(/\s+/g, ' ').trim().toUpperCase();
      };

      // Only process selected categories
      const categoriesToProcess = Object.keys(selectedCategories).filter(cat => selectedCategories[cat]);
      
      categoriesToProcess.forEach(category => {
        const textEvents = eventsFoundInText.filter(e => e.type === category);
        const dbEvents = allEvents.filter(e => e.type === category && new Date(e.date) >= new Date());

        console.log(`🔍 Scanning ${category}:`, {
          textEvents: textEvents.length,
          dbEvents: dbEvents.length
        });

        // Find NEW events (in text but not in DB)
        const newEvents = textEvents.filter(textEvent => {
          const found = dbEvents.some(dbEvent => {
            const gymMatch = dbEvent.gym_id === textEvent.gym;
            const dateMatch = dbEvent.date === textEvent.date;
            
            // Match by time if available, otherwise just gym + date
            let timeMatch = true;
            if (textEvent.time && dbEvent.time) {
              const normalizedTextTime = normalizeTime(textEvent.time);
              const normalizedDbTime = normalizeTime(dbEvent.time);
              timeMatch = normalizedTextTime === normalizedDbTime;
              
              if (!timeMatch) {
                console.log('⏰ Time mismatch:', {
                  text: textEvent.title?.substring(0, 40),
                  textTime: textEvent.time,
                  dbTime: dbEvent.time,
                  normalizedText: normalizedTextTime,
                  normalizedDb: normalizedDbTime
                });
              }
            }
            
            const isMatch = gymMatch && dateMatch && timeMatch;
            
            return isMatch;
          });
          
          if (!found) {
            console.log('🆕 NEW EVENT DETECTED:', {
              gym: textEvent.gym,
              title: textEvent.title?.substring(0, 50),
              date: textEvent.date,
              time: textEvent.time
            });
          }
          
          return !found;
        });

        // Find REMOVED events (in DB but not in text) - only if text has events for this category
        let removedEvents = [];
        if (textEvents.length > 0) {
          removedEvents = dbEvents.filter(dbEvent => {
            return !textEvents.some(textEvent =>
              textEvent.gym === dbEvent.gym_id &&
              textEvent.date === dbEvent.date
            );
          });
        }

        if (textEvents.length > 0 || dbEvents.length > 0) {
          results.byCategory[category] = {
            totalInText: textEvents.length,
            totalInDB: dbEvents.length,
            newEvents: newEvents,
            removedEvents: removedEvents,
            gymsWithNew: [...new Set(newEvents.map(e => e.gymName))],
            gymsWithRemoved: [...new Set(removedEvents.map(e => e.gym_name))],
            scanned: textEvents.length > 0
          };
          results.totalNew += newEvents.length;
          results.totalRemoved += removedEvents.length;
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
            <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">Fast Detection</span>
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
            <li>3. On each gym page, select ALL text (Ctrl+A) and copy (Ctrl+C)</li>
            <li>4. Paste everything here (all gyms together is fine!)</li>
            <li>5. Click "🔍 Scan for Changes"</li>
            <li>6. Only do F12 import for gyms with new events! ⚡</li>
          </ol>
        </div>

        {/* Category Selector */}
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-3">📂 What are you scanning? (Check the categories you pasted)</h3>
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
            💡 Tip: Uncheck categories you didn't paste to avoid "missing event" warnings
          </p>
        </div>

        {/* Text Input */}
        <div className="mb-4">
          <label className="block font-semibold mb-2 text-gray-800">
            Paste Gym Page Text (All Gyms, All Categories):
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Copy and paste text from gym event pages here...&#10;&#10;Example:&#10;Capital Gymnastics - Cedar Park&#10;CLINIC&#10;3 CLINIC found&#10;Pullover Clinic | Ages 6+ | Friday, November 14, 2025 | 6:15pm-7:15pm&#10;..."
            className="w-full h-64 p-3 border rounded-lg font-mono text-xs"
            style={{ borderColor: theme.colors.accent }}
          />
          <p className="text-xs text-gray-500 mt-1">
            {pastedText.length} characters • Paste from multiple gyms and categories at once!
          </p>
        </div>

        {/* Scan Button */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={scanEvents}
            disabled={!pastedText.trim() || scanning}
            className="flex-1 px-6 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h3 className="font-bold text-xl text-purple-800 mb-2">📊 Scan Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{scanResults.totalNew}</div>
                  <div className="text-sm text-gray-600">New Events Found</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{scanResults.totalRemoved}</div>
                  <div className="text-sm text-gray-600">Events May Be Cancelled</div>
                </div>
              </div>
            </div>

            {/* Results by Category */}
            {Object.entries(scanResults.byCategory).map(([category, data]) => (
              <div key={category} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-lg mb-3" style={{ color: theme.colors.primary }}>
                  {category === 'KIDS NIGHT OUT' ? '🌙 KIDS NIGHT OUT' : 
                   category === 'CLINIC' ? '🎯 CLINIC' :
                   category === 'OPEN GYM' ? '🏃 OPEN GYM' :
                   '🏕️ CAMP'}
                </h4>

                {/* New Events */}
                {data.newEvents.length > 0 && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="font-semibold text-green-800 mb-2">
                      ✅ {data.newEvents.length} New Event{data.newEvents.length > 1 ? 's' : ''} Found
                    </div>
                    <div className="text-sm text-green-700 mb-2">
                      <strong>Action Needed:</strong> Do F12 import for: {data.gymsWithNew.join(', ')}
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {data.newEvents.map((event, idx) => (
                        <div key={idx} className="text-xs bg-white p-2 rounded">
                          <span className="font-semibold">{event.gymName}</span> • {event.title} • {event.date}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Events */}
                {data.removedEvents.length > 0 && data.scanned && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <div className="font-semibold text-orange-800 mb-2">
                      ⚠️ {data.removedEvents.length} Event{data.removedEvents.length > 1 ? 's' : ''} Not Found on Website
                    </div>
                    <div className="text-sm text-orange-700 mb-2">
                      These events are in your database but weren't in the pasted text. They may have been cancelled or moved.
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {data.removedEvents.slice(0, 10).map((event, idx) => (
                        <div key={idx} className="text-xs bg-white p-2 rounded flex justify-between items-center">
                          <span>
                            <span className="font-semibold">{event.gym_name}</span> • {event.title} • {event.date}
                          </span>
                        </div>
                      ))}
                      {data.removedEvents.length > 10 && (
                        <div className="text-xs text-orange-600 italic">
                          ... and {data.removedEvents.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No Changes */}
                {data.scanned && data.newEvents.length === 0 && data.removedEvents.length === 0 && (
                  <div className="p-3 bg-green-100 rounded text-center text-green-700 font-medium">
                    ✅ All events match - No changes detected for this category
                  </div>
                )}
                
                {/* Not Scanned */}
                {!data.scanned && (
                  <div className="p-3 bg-gray-100 rounded text-center text-gray-500 italic">
                    ⚪ Not scanned - No text found for this category
                  </div>
                )}
              </div>
            ))}

            {/* Action Plan */}
            {scanResults.totalNew > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
                <h3 className="font-bold text-lg text-blue-800 mb-2">🎯 Next Steps:</h3>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Focus on gyms with NEW events listed above</li>
                  <li>2. Use F12 JSON Import for only those gyms</li>
                  <li>3. Skip gyms with 0 new events (saves time!)</li>
                  <li>4. Come back here to re-scan after importing</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
