import React, { useState, useEffect } from 'react';

export default function EventScannerModal({
  theme,
  onClose,
  eventsApi
}) {
  const [pastedText, setPastedText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load ALL events from database
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const events = await eventsApi.getAll('2024-01-01', '2027-12-31');
        
        // Filter to ONLY FUTURE events (ignore past)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const futureEvents = events.filter(e => {
          const eventDate = new Date(e.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= today;
        });
        
        setAllEvents(futureEvents);
        console.log(`📊 Loaded ${futureEvents.length} FUTURE events from database`);
      } catch (error) {
        console.error('Error loading events:', error);
        setAllEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [eventsApi]);

  // Normalize for comparison
  const normalize = (str) => {
    if (!str) return '';
    return str.trim().toUpperCase().replace(/\s+/g, ' ');
  };

  const scanForDifferences = async () => {
    setScanning(true);
    
    try {
      const lines = pastedText.split('\n');
      const differences = [];
      
      // Parse each line that looks like an event
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Event lines have pipes and years
        if (line.includes('|') && (line.includes('2025') || line.includes('2026'))) {
          const title = line;
          
          // Get date from next line
          let date = null;
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const dateMatch = nextLine.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
            if (dateMatch) {
              const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                            jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
              const month = months[dateMatch[1].toLowerCase().substring(0,3)];
              const day = dateMatch[2].padStart(2, '0');
              date = `${dateMatch[3]}-${month}-${day}`;
            }
          }
          
          // Get time from line 3 below
          let time = null;
          if (i + 3 < lines.length) {
            const timeLine = lines[i + 3];
            const timeMatch = timeLine.match(/(\d{1,2}:\d{2})\s*([AP]M)?\s*-\s*(\d{1,2}:\d{2})\s*([AP]M)?/i);
            if (timeMatch) {
              time = `${timeMatch[1]} ${timeMatch[2] || timeMatch[4] || 'AM'} - ${timeMatch[3]} ${timeMatch[4] || 'PM'}`;
            }
          }
          
          if (date && time) {
            // Find matching event in database
            const matches = allEvents.filter(dbEvent => 
              dbEvent.date === date &&
              normalize(dbEvent.time) === normalize(time)
            );
            
            if (matches.length > 0) {
              // Found event(s) with same date/time - check if title matches
              matches.forEach(dbEvent => {
                if (normalize(dbEvent.title) !== normalize(title)) {
                  differences.push({
                    type: 'title_changed',
                    dbEvent: dbEvent,
                    websiteTitle: title,
                    date: date,
                    time: time
                  });
                }
              });
            }
          }
        }
      }
      
      setResults({
        differences: differences,
        totalScanned: allEvents.length
      });
      
    } catch (error) {
      console.error('Scan error:', error);
      alert(`Error: ${error.message}`);
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
            <div>Loading future events...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{color: theme.colors.primary}}>
            🔍 Difference Detector
            <span className="text-sm ml-2 text-gray-500">({allEvents.length} future events loaded)</span>
          </h2>
          <button onClick={onClose} className="text-2xl font-bold text-gray-500 hover:text-gray-700">×</button>
        </div>

        <div className="bg-blue-50 p-3 rounded mb-4 text-sm">
          <strong>How it works:</strong>
          <ol className="ml-4 mt-1">
            <li>1. Paste gym event text (Ctrl+A from gym pages)</li>
            <li>2. Scan compares: Title, Date, Time</li>
            <li>3. Shows ONLY differences (ignores past events)</li>
          </ol>
        </div>

        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste gym event text here..."
          className="w-full h-64 p-3 border rounded mb-4 font-mono text-sm"
        />

        <button
          onClick={scanForDifferences}
          disabled={!pastedText.trim() || scanning}
          className="w-full py-3 rounded font-bold text-white disabled:opacity-50 mb-4"
          style={{backgroundColor: theme.colors.primary}}
        >
          {scanning ? '⏳ Scanning...' : '🔍 Scan for Differences'}
        </button>

        {results && (
          <div className="border-t pt-4">
            {results.differences.length === 0 ? (
              <div className="text-center py-8 bg-green-50 rounded">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-xl font-bold text-green-800">Everything Matches!</div>
                <div className="text-sm text-green-600 mt-2">
                  No differences detected. Your data is accurate!
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-orange-50 p-4 rounded mb-4">
                  <div className="font-bold text-orange-800 mb-2">
                    ⚠️ {results.differences.length} Difference{results.differences.length > 1 ? 's' : ''} Found
                  </div>
                </div>
                
                <div className="space-y-3">
                  {results.differences.map((diff, idx) => (
                    <div key={idx} className="border border-orange-300 rounded p-3 bg-white">
                      <div className="font-semibold text-orange-800 mb-2">
                        {diff.dbEvent.gym_name} • {diff.date} • {diff.time}
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="bg-red-50 p-2 rounded">
                          <span className="font-semibold text-red-700">Your Database:</span>
                          <div className="ml-4 text-red-600">{diff.dbEvent.title}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <span className="font-semibold text-green-700">Website:</span>
                          <div className="ml-4 text-green-600">{diff.websiteTitle}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
