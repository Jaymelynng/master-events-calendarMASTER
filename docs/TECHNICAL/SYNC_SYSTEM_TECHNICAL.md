# 🚀 Automated Sync System - Complete Technical Breakdown

**Date Created:** October 2025  
**Status:** ✅ Fully Operational & Deployed  
**Last Updated:** December 28, 2025

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Complete Data Flow](#complete-data-flow)
4. [Component Breakdown](#component-breakdown)
5. [Event Collection Process](#event-collection-process)
6. [Event Comparison Logic](#event-comparison-logic)
7. [Import Process](#import-process)
8. [Technical Details](#technical-details)
9. [API Key Authentication](#api-key-authentication)
10. [Sync ALL Programs](#sync-all-programs)
11. [Sync Progress Tracker](#sync-progress-tracker)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

The Automated Sync System allows users to automatically collect events from iClassPro portal pages and import them into the Supabase database through a React UI. The system bridges three different environments:

1. **React Frontend** (Browser/JavaScript) - User interface (Deployed on Vercel)
2. **Flask API Server** (Python) - Bridge between browser and Python (Deployed on Railway)
3. **Playwright Script** (Python) - Browser automation for event collection (Runs on Railway)

### Key Features

- ✅ One-click event collection from iClassPro portals
- ✅ **Sync ALL Programs** - Sync all event types for a gym with one click
- ✅ Automatic event comparison (new, changed, unchanged, deleted)
- ✅ Price editing before import
- ✅ Real-time preview of what will be imported
- ✅ Supports all 10 gyms and 5 event types
- ✅ Uses `event_url` as unique identifier for deduplication
- ✅ **Dynamic URL Fetching** - URLs loaded from `gym_links` table (not hardcoded)
- ✅ **Sync Progress Tracker** - Visual grid showing when each gym/type was last synced
- ✅ **API Key Authentication** - Secure Railway API access
- ✅ **Description field** - Full event descriptions from portal displayed in calendar
- ✅ **Price extraction** - Automatically extracts prices from title or description HTML
- ✅ **Day of week calculation** - Accurate day calculation (timezone-safe)
- ✅ **Streamlined UI** - Radio buttons for gyms, action buttons for event types
- ✅ **Soft delete** - Events removed from portal are marked as deleted (hidden from calendar, preserved in database)
- ✅ **Live Deployment** - Fully deployed on Railway (API) + Vercel (Frontend), accessible from anywhere

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Browser)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SyncModal.js                                             │  │
│  │  - Gym Selection (Radio Buttons)                          │  │
│  │  - Event Type Buttons (Immediate Sync)                    │  │
│  │  - "Sync ALL" Button (All programs at once)               │  │
│  │  - Sync Progress Tracker (last sync times)                │  │
│  │  - Comparison Summary                                    │  │
│  │  - Editable Price Table                                  │  │
│  │  - Import Button                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ HTTP POST + X-API-Key header         │
│                           │ { gymId, eventType }                 │
│                           ▼                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ https://master-events-calendarmaster-production.up.railway.app/sync-events
                              │ (or http://localhost:5000 for local dev)
                              │
┌─────────────────────────────────────────────────────────────────┐
│              FLASK API SERVER (Python/Railway)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  local_api_server.py                                      │  │
│  │  - Receives HTTP request                                  │  │
│  │  - Validates API key (X-API-Key header)                  │  │
│  │  - Validates gym/event type                               │  │
│  │  - Calls Playwright script                                │  │
│  │  - Returns JSON response                                 │  │
│  │  - Deployed on Railway (production)                        │  │
│  │  - Runs on localhost:5000 (local development)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ Function Call                        │
│                           │ collect_events_via_f12()            │
│                           ▼                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│          PLAYWRIGHT SCRIPT (Python)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  f12_collect_and_import.py                               │  │
│  │  - Fetches URLs from gym_links table (dynamic)           │  │
│  │  - Launches headless browser                              │  │
│  │  - Opens iClassPro portal page                            │  │
│  │  - Intercepts JSON API responses                          │  │
│  │  - Extracts event data                                   │  │
│  │  - Converts to flat format                               │  │
│  │  - Returns event list                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Returns: [events] or { eventsByType: {...} }
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (Browser)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SyncModal.js                                             │  │
│  │  - Receives events                                        │  │
│  │  - Compares with database                                │  │
│  │  - Shows comparison summary                              │  │
│  │  - User edits prices                                     │  │
│  │  - Calls eventsApi.bulkImport()                          │  │
│  │  - Logs sync to sync_log table                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ Supabase API                        │
│                           │ eventsApi.bulkImport()              │
│                           ▼                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  events table                                             │  │
│  │  - Stores all event data                                  │  │
│  │  - Uses event_url as unique key                          │  │
│  │                                                           │  │
│  │  gym_links table                                          │  │
│  │  - Stores portal URLs for each gym/program type          │  │
│  │  - Dynamic URL configuration (no hardcoding)             │  │
│  │                                                           │  │
│  │  sync_log table                                           │  │
│  │  - Tracks when each gym/type was last synced             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Data Flow

### Step 1: User Opens Sync Modal

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. User clicks "⚡ Open Sync Modal" button in Admin Portal
2. `SyncModal` component renders
3. Sync log is loaded from database to show last sync times
4. User sees:
   - **Gym Selection:** Radio buttons in 2-column grid (10 gyms)
   - **Event Type Buttons:** 6 action buttons (appear after gym selection)
   - **Sync Progress Tracker:** Grid showing when each type was last synced
   - Uses Railway API (production) or local API server (development)

**UI Design:**
- **Step 1:** Select Gym - Radio buttons (like F12 modal)
- **Step 2:** Select Program & Sync - Action buttons that trigger sync immediately
- **"Sync ALL"** button - Syncs all program types at once
- No separate "Sync" button needed - clicking event type button syncs right away

**Code:**
```javascript
// User selects gym (radio button)
const [selectedGym, setSelectedGym] = useState('');
// Event type is set when button is clicked, sync starts immediately
const [selectedEventType, setSelectedEventType] = useState('');
// Sync log tracks when each gym/type was last synced
const [syncLog, setSyncLog] = useState([]);

// Load sync log on mount
useEffect(() => {
  const loadSyncLog = async () => {
    const log = await syncLogApi.getAll();
    setSyncLog(log);
  };
  loadSyncLog();
}, []);
```

---

### Step 2: User Clicks Event Type Button (Sync Starts)

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. `handleSyncForType()` function is called with event type
2. React sends HTTP POST request to Railway API (production) or local API server (dev)
3. Request includes API key in header for authentication
4. Request body: `{ "gymId": "RBA", "eventType": "KIDS NIGHT OUT" }`
5. Shows loading spinner on the clicked button

**Code:**
```javascript
const handleSyncForType = async (eventType) => {
  setSelectedEventType(eventType);
  setSyncing(true);
  
  // Uses environment variable (Railway in production, localhost in dev)
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const API_KEY = process.env.REACT_APP_API_KEY || '';
  
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
};
```

---

### Step 3: Flask API Server Receives Request

**Location:** `automation/local_api_server.py`

**What Happens:**
1. Flask receives POST request at `/sync-events`
2. Validates API key from `X-API-Key` header (in production)
3. Validates `gymId` and `eventType` are provided
4. Checks if gym exists in `GYMS` dictionary
5. Imports functions from `f12_collect_and_import.py`
6. Calls `collect_events_via_f12(gym_id, camp_type)`

**Code:**
```python
@app.route('/sync-events', methods=['POST'])
def sync_events():
    # Check API key
    if not check_api_key():
        return jsonify({
            "success": False,
            "error": "Invalid or missing API key"
        }), 401
    
    data = request.get_json()
    gym_id = data.get('gymId')
    event_type = data.get('eventType')
    
    # Import Playwright functions
    from f12_collect_and_import import (
        collect_events_via_f12,
        convert_event_dicts_to_flat,
        GYMS
    )
    
    # Special handling for "ALL" - sync all program types
    if event_type == "ALL":
        result_data = asyncio.run(collect_events_via_f12(gym_id=gym_id, camp_type="ALL"))
        # Returns { 'events': {...}, 'checked_types': [...] }
        ...
    
    # Standard single event type handling
    events_raw = asyncio.run(collect_events_via_f12(gym_id=gym_id, camp_type=event_type))
```

---

### Step 4: Playwright Script Collects Events

**Location:** `automation/f12_collect_and_import.py`

**What Happens:**

#### 4.1: Fetch Portal URL from Database
```python
# URLs are fetched from gym_links table (not hardcoded!)
def get_event_type_urls():
    """Get EVENT_TYPE_URLS (cached for 5 minutes, then refreshes from database)"""
    # Fetches from Supabase gym_links table
    url = f"{SUPABASE_URL}/rest/v1/gym_links?is_active=eq.true&select=*"
    # ... builds EVENT_TYPE_URLS dictionary dynamically
    return event_type_urls

# Example result: "https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time"
event_type_urls = get_event_type_urls()
url = event_type_urls[camp_type][gym_id]
```

#### 4.2: Launch Headless Browser
```python
async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    page = await browser.new_page()
```

#### 4.3: Set Up Response Interceptor
```python
async def handle_response(response):
    # Only process JSON responses
    if "application/json" not in content_type:
        return
    
    # Only process detail calls like /camps/2106 (not listing pages)
    if "/camps/" in response_url and "?" not in response_url:
        body = await response.json()
        event_id = body.get("data", {}).get("id")
        
        # Deduplicate by event ID
        if event_id not in seen_ids:
            seen_ids.add(event_id)
            captured_events.append(body["data"])
```

#### 4.4: Open Portal Page
```python
page.on("response", handle_response)  # Listen for API calls
await page.goto(url, wait_until="domcontentloaded", timeout=30000)
await page.reload(wait_until="networkidle", timeout=30000)
await page.wait_for_timeout(5000)  # Wait for all API calls to complete
```

**What Happens on the Page:**
1. Portal page loads in headless browser
2. Page automatically makes API calls to fetch event details
3. Each event triggers a call like: `GET /camps/2106`
4. Playwright intercepts these responses
5. Extracts event JSON from each response
6. Stores in `captured_events` list

**Example API Call Intercepted:**
```
Request: GET https://portal.iclasspro.com/rbatascocita/camps/2106
Response: {
  "data": {
    "id": 2106,
    "name": "Kids Night Out | Ages 4-13 | December 12, 2025",
    "startDate": "2025-12-12",
    "endDate": "2025-12-12",
    "startTime": "18:30:00",
    "endTime": "21:30:00",
    "minAge": 4,
    "maxAge": 13,
    "description": "...",
    "hasOpenings": true
  }
}
```

#### 4.5: Return Raw Events
```python
return captured_events  # List of event dictionaries
```

---

### Step 5: Convert Events to Flat Format

**Location:** `automation/f12_collect_and_import.py`

**What Happens:**
1. Receives raw event dictionaries from Playwright
2. Processes each event:
   - Deduplicates by event ID
   - Filters to future events only (`startDate >= today`)
   - Builds `event_url` from event ID
   - Extracts date/time information
   - Extracts price from title or description
   - Extracts age_min and age_max
   - Extracts availability info (has_openings, registration dates)
   - Extracts and cleans description HTML

**Code Flow:**
```python
def convert_event_dicts_to_flat(events, gym_id, portal_slug, camp_type_label):
    processed = []
    seen_ids = set()
    today_str = date.today().isoformat()
    
    for ev in events:
        # Skip duplicates
        event_id = ev.get("id")
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        
        # Filter future events only
        start_date = ev.get("startDate")
        if start_date < today_str:
            continue
        
        # Build event URL
        event_url = f"https://portal.iclasspro.com/{portal_slug}/camp-details/{event_id}"
        
        # Extract availability info from iClassPro
        has_openings = ev.get("hasOpenings", True)
        registration_start_date = ev.get("registrationStartDate")
        registration_end_date = ev.get("registrationEndDate")
        
        # Build flat event record
        processed.append({
            "gym_id": gym_id,
            "title": ev.get("name", "Untitled Event"),
            "date": start_date,
            "start_date": start_date,
            "end_date": ev.get("endDate") or start_date,
            "time": time_str,
            "price": price,
            "type": camp_type_label,
            "event_url": event_url,
            "age_min": ev.get("minAge"),
            "age_max": ev.get("maxAge"),
            "day_of_week": day_of_week,
            "description": description,
            "has_openings": has_openings,
            "registration_start_date": registration_start_date,
            "registration_end_date": registration_end_date,
        })
    
    return processed
```

**Example Transformation:**

**Input (Raw):**
```json
{
  "id": 2106,
  "name": "Kids Night Out | Ages 4-13 | December 12, 2025 | 6:30-9:30 pm",
  "startDate": "2025-12-12",
  "startTime": "18:30:00",
  "endTime": "21:30:00",
  "minAge": 4,
  "maxAge": 13,
  "hasOpenings": true
}
```

**Output (Flat):**
```json
{
  "gym_id": "RBA",
  "title": "Kids Night Out | Ages 4-13 | December 12, 2025 | 6:30-9:30 pm",
  "date": "2025-12-12",
  "start_date": "2025-12-12",
  "end_date": "2025-12-12",
  "time": "6:30 PM - 9:30 PM",
  "price": 35.0,
  "type": "KIDS NIGHT OUT",
  "event_url": "https://portal.iclasspro.com/rbatascocita/camp-details/2106",
  "age_min": 4,
  "age_max": 13,
  "day_of_week": "Friday",
  "description": "Join us for a fun-filled evening! Ages 4-13 welcome...",
  "has_openings": true
}
```

---

### Step 6: API Server Returns Events to React

**Location:** `automation/local_api_server.py`

**What Happens:**
1. API server receives flat events from conversion function
2. Returns JSON response to React

**Response Format (Single Event Type):**
```json
{
  "success": true,
  "gymId": "RBA",
  "eventType": "KIDS NIGHT OUT",
  "eventsFound": 3,
  "events": [
    {
      "gym_id": "RBA",
      "title": "Kids Night Out...",
      "date": "2025-12-12",
      "time": "6:30 PM - 9:30 PM",
      "price": 35.0,
      "event_url": "https://portal.iclasspro.com/rbatascocita/camp-details/2106",
      "age_min": 4,
      "age_max": 13
    }
  ],
  "message": "Successfully collected 3 events"
}
```

**Response Format (ALL Programs):**
```json
{
  "success": true,
  "gymId": "RBA",
  "eventType": "ALL",
  "eventsFound": 15,
  "eventsByType": {
    "KIDS NIGHT OUT": [...],
    "CLINIC": [...],
    "CAMP": [...]
  },
  "checkedTypes": ["KIDS NIGHT OUT", "CLINIC", "OPEN GYM", "CAMP", "SPECIAL EVENT"],
  "message": "Successfully collected 15 events across 3 program types"
}
```

---

### Step 7: React Receives Events and Compares

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. React receives events from API
2. Makes events editable (adds `_index` for React keys)
3. Fetches existing events from database (ALL events, including deleted)
4. Calls `compareEvents()` function
5. Logs sync to `sync_log` table

**Code:**
```javascript
if (data.success && data.events && data.events.length > 0) {
  // Make events editable
  const eventsWithIndex = data.events.map((ev, idx) => ({ ...ev, _index: idx }));
  setEditableEvents(eventsWithIndex);
  
  // Compare with existing events - ALL events (no date filter), include deleted
  const existingEvents = await eventsApi.getAll(null, null, true); // includeDeleted = true
  const gymExistingEvents = existingEvents.filter(
    ev => ev.gym_id === selectedGym && ev.type === eventType
  );
  
  // Compare new vs existing
  const comparisonResult = compareEvents(data.events, gymExistingEvents);
  setComparison(comparisonResult);
  
  // Log the sync to track progress
  await syncLogApi.log(selectedGym, eventType, data.eventsFound, 0);
  const updatedLog = await syncLogApi.getAll();
  setSyncLog(updatedLog);
}
```

---

### Step 8: Event Comparison Logic

**Location:** `src/lib/eventComparison.js`

**What Happens:**

#### 8.1: Create URL Maps
```javascript
// Map existing events by event_url
const existingByUrl = new Map();
existingEvents.forEach(ev => {
  existingByUrl.set(ev.event_url, ev);
});

// Map new events by event_url
const newByUrl = new Map();
newEvents.forEach(ev => {
  newByUrl.set(ev.event_url, ev);
});
```

**Why `event_url`?**
- `event_url` is built from event ID: `https://portal.iclasspro.com/{slug}/camp-details/{id}`
- Event ID is unique and never changes
- Same event = same URL = same event in database

#### 8.2: Categorize Events
```javascript
allUrls.forEach(url => {
  const existing = existingByUrl.get(url);
  const incoming = newByUrl.get(url);
  
  if (!existing && incoming) {
    // NEW: event_url doesn't exist in database
    comparison.new.push(incoming);
  } 
  else if (existing && !incoming) {
    // DELETED: Was in database, but not in new sync
    // Only mark as deleted if the event HASN'T STARTED YET
    const hasNotStartedYet = eventStartDate > todayStr;
    if (hasNotStartedYet) {
      comparison.deleted.push(existing);
    }
  } 
  else if (existing && incoming) {
    // Check if event was previously deleted (should be restored)
    const wasDeleted = existing.deleted_at !== null;
    
    // Check if data changed
    if (wasDeleted || hasEventChanged(existing, incoming)) {
      comparison.changed.push({ existing, incoming, _changes: [...], _wasDeleted: wasDeleted });
    } else {
      comparison.unchanged.push(existing);
    }
  }
});
```

#### 8.3: Detect Changes
```javascript
function hasEventChanged(existing, incoming) {
  // Fields to compare - ONLY core event content
  // Volatile fields EXCLUDED to prevent false "CHANGED" alerts:
  // - has_openings, registration dates, validation_errors, etc.
  const fieldsToCompare = [
    'title',
    'date',
    'start_date',
    'end_date',
    'time',
    'price',
    'type',
    'age_min',
    'age_max',
    'description'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = normalizeValue(existing[field], field);
    const incomingValue = normalizeValue(incoming[field], field);
    
    if (existingValue !== incomingValue) {
      return true; // Found a change
    }
  }
  
  return false; // No changes
}
```

**Comparison Result Structure:**
```javascript
{
  new: [
    { gym_id: "RBA", title: "...", event_url: "...", _status: 'new' }
  ],
  changed: [
    {
      existing: { id: "uuid", title: "Old Title", ... },
      incoming: { title: "New Title", ... },
      _status: 'changed',
      _wasDeleted: false,
      _changes: [
        { field: "title", old: "Old Title", new: "New Title" }
      ]
    }
  ],
  unchanged: [
    { id: "uuid", title: "...", _status: 'unchanged' }
  ],
  deleted: [
    { id: "uuid", title: "...", _status: 'deleted' }
  ]
}
```

---

### Step 9: Display Comparison Summary

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. Comparison summary box appears immediately after sync
2. Shows large, color-coded cards in 2x2 grid:
   - 🆕 **New Events** (green) - Will be added
   - 🔄 **Changed Events** (yellow) - Will be updated
   - ✓ **Unchanged** (gray) - No changes needed
   - 🗑️ **Deleted Events** (orange) - In DB but not in source (only future events, will be soft deleted)

**UI Display:**
```
📊 Comparison Summary
┌─────────────┬─────────────┐
│ New Events  │ Changed     │
│      3      │      1      │
│ Will be     │ Will be     │
│ added       │ updated     │
├─────────────┼─────────────┤
│ Unchanged   │ Deleted     │
│      0      │      1      │
│ No changes  │ Will be     │
│ needed      │ soft deleted│
└─────────────┴─────────────┘
```

**Note:** 
- Deleted count only includes future events that haven't started yet
- Events that have already started are silently ignored (they're not "deleted", just running/expired)
- Deleted events are soft deleted (hidden from calendar, preserved in database)
- If a deleted event comes back to portal, it will be automatically restored

---

### Step 10: User Edits Prices (Optional)

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. User sees preview table with all events
2. Each event has editable price field
3. User can modify prices before import
4. Changes stored in `editableEvents` state

**Code:**
```javascript
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
```

**UI:**
```
┌────────┬──────────────────────────┬──────────┬──────┬───────┐
│ Status │ Title                    │ Date     │ Age  │ Price │
├────────┼──────────────────────────┼──────────┼──────┼───────┤
│ 🆕     │ Kids Night Out...        │ 2025-12-12│ 4-13 │ [35] │ ← Editable
│ 🔄     │ Clinic...                │ 2025-12-15│ 5-12 │ [25] │ ← Editable
└────────┴──────────────────────────┴──────────┴──────┴───────┘
```

---

### Step 11: User Clicks "Import" Button

**Location:** `src/components/EventsDashboard/SyncModal.js`

**What Happens:**
1. User clicks "Import X Events to Database"
2. React calls `handleImport()` function
3. Removes `_index` and `_eventType` fields from events
4. Calls `eventsApi.bulkImport()` for new events
5. Calls `eventsApi.update()` for changed events
6. Handles soft delete for removed events

**Code:**
```javascript
const handleImport = async () => {
  // Remove internal fields before importing
  const eventsToImport = editableEvents.map(({ _index, _eventType, ...ev }) => ev);
  
  // Import new events (only if there are any)
  const imported = hasNewEvents ? await eventsApi.bulkImport(eventsToImport) : [];
  
  // Update changed events
  if (comparison && comparison.changed.length > 0) {
    for (const changed of comparison.changed) {
      const existingEvents = await eventsApi.getAll(null, null, true); // include deleted
      const existingEvent = existingEvents.find(e => e.event_url === changed.incoming.event_url);
      
      if (existingEvent) {
        await eventsApi.update(existingEvent.id, {
          title: changed.incoming.title,
          date: changed.incoming.date,
          // ... other fields
          deleted_at: null  // Restore if previously deleted
        });
      }
    }
  }
  
  // Soft delete removed events
  if (comparison && comparison.deleted.length > 0) {
    for (const deleted of comparison.deleted) {
      await eventsApi.markAsDeleted(deleted.id);
    }
  }
};
```

---

### Step 12: Database Import

**Location:** `src/lib/api.js` (eventsApi.bulkImport) and `src/components/EventsDashboard/SyncModal.js` (handleImport)

**What Happens:**
1. **Import New Events:**
   - `bulkImport()` receives events array
   - Checks if `event_url` already exists (duplicate check)
   - Only inserts events that don't already exist
   - Uses Supabase `insert` operation (not upsert)

2. **Update Changed Events:**
   - Finds existing events by `event_url`
   - Updates all fields with new data
   - Sets `deleted_at = null` (restores if previously deleted)

3. **Soft Delete Removed Events:**
   - For events in database but not in portal:
     - Only marks future events as deleted (past/started events left alone)
     - Sets `deleted_at` timestamp
     - Event stays in database but hidden from calendar

**Database Operations:**
```javascript
// Check for existing events first
const { data: existingEvents } = await supabase
  .from('events')
  .select('event_url')
  .in('event_url', eventUrls);

// Filter out duplicates
const newEvents = events.filter(e => !existingUrls.has(e.event_url));

// Insert only new events
const { data, error } = await supabase
  .from('events')
  .insert(newEvents)
  .select();
```

**Result:**
- New events → Inserted into `events` table
- Changed events → Updated in `events` table (same database ID)
- Unchanged events → Skipped (no database write)
- Deleted events → Soft deleted (set `deleted_at` timestamp)

---

## 🔍 Component Breakdown

### 1. React Frontend Components

#### `SyncModal.js`
- **Purpose:** Main UI component for automated sync
- **Location:** `src/components/EventsDashboard/SyncModal.js`
- **UI Design:**
  - **Step 1:** Radio buttons for gym selection (2-column grid)
  - **Step 2:** Action buttons for event types (immediate sync on click)
  - **"Sync ALL" button:** Syncs all program types at once
  - **Sync Progress Tracker:** Shows when each type was last synced
  - **Comparison Summary:** Large, color-coded cards showing new/changed/deleted
  - **Price Editing Table:** Editable price fields with status indicators
- **Key Functions:**
  - `handleSyncForType()` - Triggers sync immediately when event type button clicked
  - `handlePriceChange()` - Updates price in state
  - `handleImport()` - Imports events to database
  - `getSyncStatus()` - Gets last sync time for gym/type combo
  - `timeAgo()` - Formats timestamps as "2h ago", "3d ago", etc.
- **State Management:**
  - `selectedGym` - Selected gym ID (from radio button)
  - `selectedEventType` - Selected event type (set when button clicked)
  - `editableEvents` - Events with editable prices
  - `comparison` - Comparison results (new, changed, unchanged, deleted)
  - `syncLog` - Array of sync log entries for progress tracker

#### `AdminDashboard.js` (replaced AdminPortalModal)
- **Purpose:** Full-page admin dashboard with tabs
- **Location:** `src/components/AdminDashboard/AdminDashboard.js`
- **Function:** 3 tabs — Audit & Review, Gym Rules, Quick Actions. Opens `SyncModal` from Quick Actions tab.

### 2. Flask API Server

#### `local_api_server.py`
- **Purpose:** Bridge between React and Python script
- **Location:** `automation/local_api_server.py`
- **Endpoints:**
  - `GET /` - Root endpoint with server info
  - `GET /health` - Health check (no auth required)
  - `POST /sync-events` - Sync events for gym/event type (requires API key)
  - `POST /import-events` - Import events to Supabase (requires API key)
  - `GET /gyms` - Get list of gyms
  - `GET /event-types` - Get event types for gym
- **Key Features:**
  - CORS enabled for browser access
  - API key authentication for Railway
  - Error handling to prevent crashes
  - Returns JSON responses

### 3. Playwright Script

#### `f12_collect_and_import.py`
- **Purpose:** Collect events from iClassPro portals
- **Location:** `automation/f12_collect_and_import.py`
- **Key Functions:**
  - `collect_events_via_f12()` - Main collection function
  - `collect_all_programs_for_gym()` - Syncs ALL program types at once
  - `collect_all_camps_for_gym()` - Collects all camp types (full day, half day, summer, etc.)
  - `convert_event_dicts_to_flat()` - Converts to database format
  - `get_event_type_urls()` - Fetches URLs from gym_links table (cached 5 min)
  - `fetch_all_program_urls_for_gym()` - Gets all URLs for a gym
- **Configuration:**
  - `GYMS` - Dictionary of all 10 gyms
  - URLs fetched dynamically from `gym_links` table (not hardcoded)

### 4. Event Comparison Logic

#### `eventComparison.js`
- **Purpose:** Compare new events with existing events
- **Location:** `src/lib/eventComparison.js`
- **Key Functions:**
  - `compareEvents()` - Main comparison function
  - `hasEventChanged()` - Check if event data changed (excludes volatile fields)
  - `getChangedFields()` - Get list of changed fields
  - `normalizeValue()` - Normalize values for comparison
  - `getComparisonSummary()` - Get summary statistics

---

## 📊 Event Collection Process (Detailed)

### How Playwright Intercepts API Calls

1. **Browser Opens Portal Page**
   ```
   URL: https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time
   ```

2. **Page Loads and Renders**
   - Portal page loads in headless browser
   - JavaScript on page makes API calls to fetch event details
   - Each event card triggers: `GET /camps/{event_id}`

3. **Playwright Intercepts Responses**
   ```python
   async def handle_response(response):
       if "/camps/" in response.url and "?" not in response.url:
           body = await response.json()
           event_id = body.get("data", {}).get("id")
           captured_events.append(body["data"])
   ```

4. **Events Collected**
   - All event detail API calls are captured
   - Deduplicated by event ID
   - Stored in `captured_events` list

### Why This Approach Works

- ✅ **Mimics Real User:** Opens actual portal page, just like F12 process
- ✅ **Reliable:** Uses same API calls the portal uses
- ✅ **Complete:** Captures all events on the page
- ✅ **Future-Proof:** Works even if portal UI changes (as long as API stays same)

---

## 🔄 Event Comparison Logic (Detailed)

### Important: Comparison Scope

**What Gets Compared:**
- ALL events from database (no date filter applied during fetch)
- Includes deleted events (to detect restorations)
- Filters by gym and event type

**Deleted Detection:**
- Only events that **haven't started yet** can be marked as "deleted"
- Events that have already started are silently ignored
- iClassPro removes events once they START (not when they end)
- This prevents false "deleted" counts for multi-day camps in progress

**Why Include Deleted Events?**
- If an event was previously deleted but comes back to the portal, we need to restore it
- Comparison detects deleted events that should be restored
- During import, restored events get `deleted_at = null`

### Unique Identifier: `event_url`

**Why `event_url`?**
- Built from event ID: `https://portal.iclasspro.com/{slug}/camp-details/{id}`
- Event ID is unique and permanent
- Same event = same ID = same URL = same database record

**Example:**
```
Event ID: 2106
Gym Slug: rbatascocita
Event URL: https://portal.iclasspro.com/rbatascocita/camp-details/2106
```

### Comparison Algorithm

1. **Create URL Maps**
   ```javascript
   existingByUrl.set(event.event_url, event)  // Map existing events (including deleted)
   newByUrl.set(event.event_url, event)       // Map new events
   ```

2. **For Each URL:**
   - If URL in new but not existing → **NEW**
   - If URL in existing but not new → Check if started yet
     - If hasn't started → **DELETED** (will be soft deleted)
     - If already started → Silently ignored
   - If URL in both → Check if event was deleted or data changed
     - If was deleted OR data changed → **CHANGED** (will restore if deleted)
     - If same and not deleted → **UNCHANGED**

3. **Change Detection:**
   - Compares 10 core fields: title, date, start_date, end_date, time, price, type, age_min, age_max, description
   - Excludes volatile fields: has_openings, registration_dates, validation_errors (these change frequently without representing real changes)
   - Normalizes values (handles null, empty strings, whitespace, date formats)
   - Returns list of changed fields

---

## 💾 Import Process (Detailed)

### Import Flow

1. **User Clicks Import**
   ```javascript
   handleImport() → eventsApi.bulkImport(events)
   ```

2. **Bulk Import Function**
   ```javascript
   // Check for existing events first
   const { data: existingEvents } = await supabase
     .from('events')
     .select('event_url')
     .in('event_url', eventUrls);
   
   // Filter out duplicates and insert only new
   const { data, error } = await supabase
     .from('events')
     .insert(newEvents)
     .select();
   ```

3. **Update Changed Events**
   ```javascript
   // For each changed event
   await eventsApi.update(existingEvent.id, {
     title: changed.incoming.title,
     date: changed.incoming.date,
     // ... other fields
     deleted_at: null  // Restore if previously deleted
   });
   ```

4. **Soft Delete Removed Events**
   ```javascript
   // For events in DB but not in portal (and haven't started)
   await eventsApi.markAsDeleted(deletedEvent.id);
   // Sets deleted_at = current timestamp
   ```

### Database Schema

**events table:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  gym_id TEXT,
  title TEXT,
  date DATE,
  start_date DATE,
  end_date DATE,
  time TEXT,
  price DECIMAL,
  type TEXT,
  event_url TEXT UNIQUE,  -- Used for deduplication
  age_min INTEGER,
  age_max INTEGER,
  day_of_week TEXT,       -- Calculated from date (timezone-safe)
  description TEXT,       -- Full event description from portal
  has_openings BOOLEAN,   -- Availability from iClassPro
  registration_start_date DATE,
  registration_end_date DATE,
  deleted_at TIMESTAMP,   -- Soft delete: timestamp when event was removed from portal
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Key Constraints:**
- `event_url` is UNIQUE - prevents duplicates
- `deleted_at IS NULL` filter applied to calendar queries (only active events shown)

---

## 🔧 Technical Details

### Dependencies

**Python:**
- `playwright>=1.40.0` - Browser automation
- `flask>=2.3.0` - API server
- `flask-cors>=4.0.0` - CORS support
- `supabase` - Database client (optional, for `/import-events`)

**JavaScript:**
- `react` - UI framework
- `lucide-react` - Icons
- `@supabase/supabase-js` - Database client

### Ports

- **React App:** `http://localhost:3000` (or configured port)
- **API Server (Production):** `https://master-events-calendarmaster-production.up.railway.app`
- **API Server (Local Dev):** `http://localhost:5000`
- **Environment Variables:** 
  - `REACT_APP_API_URL` - API server URL (set in Vercel)
  - `REACT_APP_API_KEY` - API key for Railway authentication (set in Vercel)

### Configuration

**Gym Configuration:**
```python
GYMS = {
    "CCP": {"name": "Capital Gymnastics Cedar Park", "slug": "capgymavery"},
    "CPF": {"name": "Capital Gymnastics Pflugerville", "slug": "capgymhp"},
    "CRR": {"name": "Capital Gymnastics Round Rock", "slug": "capgymroundrock"},
    "HGA": {"name": "Houston Gymnastics Academy", "slug": "houstongymnastics"},
    "RBA": {"name": "Rowland Ballard Atascocita", "slug": "rbatascocita"},
    "RBK": {"name": "Rowland Ballard Kingwood", "slug": "rbkingwood"},
    "EST": {"name": "Estrella Gymnastics", "slug": "estrellagymnastics"},
    "OAS": {"name": "Oasis Gymnastics", "slug": "oasisgymnastics"},
    "SGT": {"name": "Scottsdale Gymnastics", "slug": "scottsdalegymnastics"},
    "TIG": {"name": "Tigar Gymnastics", "slug": "tigar"}
}
```

**Event Type URLs (Dynamic from Database):**

URLs are fetched from the `gym_links` table in Supabase, NOT hardcoded. The script queries:
```python
url = f"{SUPABASE_URL}/rest/v1/gym_links?is_active=eq.true&select=*"
```

This allows updating URLs in the database without code changes. The URLs are cached for 5 minutes to reduce database calls.

**Link Type Mapping:**
```python
LINK_TYPE_TO_EVENT_TYPE = {
    "kids_night_out": "KIDS NIGHT OUT",
    "skill_clinics": "CLINIC",
    "open_gym": "OPEN GYM",
    "camps": "CAMP",
    "camps_half": "CAMP",
    "camps_holiday": "CAMP",
    "camps_summer_full": "CAMP",
    "camps_summer_half": "CAMP",
    "special_events": "SPECIAL EVENT"
}
```

---

## 🔐 API Key Authentication

### How It Works

Railway API requires authentication in production to prevent unauthorized access.

**Frontend (SyncModal.js):**
```javascript
const API_KEY = process.env.REACT_APP_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
};

if (API_KEY) {
  headers['X-API-Key'] = API_KEY;
}
```

**Backend (local_api_server.py):**
```python
API_KEY = os.environ.get('API_KEY', '')

def check_api_key():
    if not API_KEY:
        return True  # No API key set = allow all (for local dev)
    
    provided_key = request.headers.get('X-API-Key') or request.args.get('api_key')
    return provided_key == API_KEY
```

### Configuration

1. **Set API key in Railway:** Environment variable `API_KEY`
2. **Set API key in Vercel:** Environment variable `REACT_APP_API_KEY`
3. Both must match for authentication to work

### Local Development

For local development, if no `API_KEY` is set on the server, all requests are allowed. This makes it easy to test without configuring authentication.

---

## 🔄 Sync ALL Programs

### Overview

The "Sync ALL" feature allows syncing all program types for a gym with a single click, instead of syncing each type individually.

### How It Works

1. **User clicks "Sync ALL" button**
2. Request sent with `eventType: "ALL"`
3. Server fetches ALL program URLs for the gym from database
4. Collects events from each URL (KNO, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT)
5. Returns combined results grouped by event type

### API Response

```json
{
  "success": true,
  "gymId": "RBA",
  "eventType": "ALL",
  "eventsFound": 15,
  "eventsByType": {
    "KIDS NIGHT OUT": [/* events */],
    "CLINIC": [/* events */],
    "CAMP": [/* events */]
  },
  "checkedTypes": ["KIDS NIGHT OUT", "CLINIC", "OPEN GYM", "CAMP", "SPECIAL EVENT"],
  "message": "Successfully collected 15 events across 3 program types"
}
```

### Key Points

- `checkedTypes` shows ALL types that were checked (even if 0 events)
- Sync log is updated for ALL checked types, not just types with events
- Comparison runs against ALL existing events for the gym

---

## 📊 Sync Progress Tracker

### Overview

The Sync Progress Tracker shows when each gym/event type combination was last synced, making it easy to see which programs need attention.

### How It Works

1. **Sync Log Table:** `sync_log` stores entries with `gym_id`, `event_type`, `synced_at`, `events_found`
2. **Load on Mount:** SyncModal loads sync log when opened
3. **Visual Grid:** Shows color-coded status for each gym/type combo
4. **Auto-Update:** Log refreshes after each sync

### Helper Functions

```javascript
// Get sync status for a gym/type combo
const getSyncStatus = (gymId, eventType) => {
  const entry = syncLog.find(s => s.gym_id === gymId && s.event_type === eventType);
  if (!entry) return null;
  return entry;
};

// Format time ago
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Never';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};
```

### Visual Status

- **Green:** Synced recently (< 24 hours)
- **Yellow:** Synced recently but may need refresh (1-7 days)
- **Red/Gray:** Never synced or stale (> 7 days)

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Failed to connect to API server"
**Problem:** API server not accessible  
**Solution (Production):** 
- Check Railway deployment status
- Verify `REACT_APP_API_URL` is set in Vercel environment variables
- Test Railway API: `https://master-events-calendarmaster-production.up.railway.app/health`

**Solution (Local Dev):** 
```bash
cd automation
python local_api_server.py
```

#### 2. "Invalid or missing API key"
**Problem:** API key authentication failed  
**Solution:**
- Verify `API_KEY` is set in Railway environment
- Verify `REACT_APP_API_KEY` is set in Vercel environment
- Both keys must match exactly

#### 3. "No events collected"
**Problem:** Gym/event type combination not configured  
**Solution:** 
- Check `gym_links` table in Supabase for missing/inactive URLs
- Verify the gym has a URL configured for that event type
- Check if URL is a valid iClassPro portal URL

#### 4. "Server stopped unexpectedly"
**Problem:** Playwright error or unhandled exception  
**Solution:** Check server logs, restart server

#### 5. "Comparison shows wrong results"
**Problem:** `event_url` mismatch  
**Solution:** Verify `event_url` format matches between sync and database

#### 6. "Description not showing"
**Problem:** Description column not added to database  
**Solution:** Run `database/ADD_DESCRIPTION_COLUMN.sql` in Supabase

#### 7. "Deleted events still showing on calendar"
**Problem:** `deleted_at` column not added to database  
**Solution:** Run `database/ADD_DELETED_AT_COLUMN.sql` in Supabase

#### 8. "Events marked as deleted but they're back in portal"
**Problem:** Event was soft deleted, now it's back  
**Solution:** This is automatic! Next sync will detect it and restore it (set `deleted_at = null`)

### Debugging

**Enable Debug Logging:**
```python
# In local_api_server.py
app.run(host='127.0.0.1', port=5000, debug=True)
```

**Check Browser Console:**
- Open React app in browser
- Open Developer Tools (F12)
- Check Console tab for errors
- Look for `🔍 compareEvents called:` debug logs

**Check API Server Logs:**
- Terminal running `local_api_server.py`
- Shows all sync requests and errors
- Look for `[INFO]` and `[DEBUG]` messages

---

## 📝 Key Files Reference

### Python Files
- `automation/f12_collect_and_import.py` - Playwright event collection
- `automation/local_api_server.py` - Flask API server
- `automation/fetch_gym_urls.py` - Generate URLs from database

### JavaScript Files
- `src/components/EventsDashboard/SyncModal.js` - Main sync UI (radio buttons + event type buttons)
- `src/components/AdminDashboard/AdminDashboard.js` - Full-page admin dashboard
- `src/components/EventsDashboard.js` - Event details sidebar (shows description)
- `src/lib/eventComparison.js` - Comparison logic
- `src/lib/api.js` - Database API functions (eventsApi, syncLogApi)

### Database Tables
- `events` - Event data
- `gym_links` - Portal URLs for each gym/program type
- `sync_log` - Tracks when each gym/type was last synced

### Database Migrations
- `database/ADD_AGE_COLUMNS.sql` - Adds age_min and age_max columns
- `database/ADD_DESCRIPTION_COLUMN.sql` - Adds description column
- `database/ADD_DELETED_AT_COLUMN.sql` - Adds deleted_at column for soft delete
- `database/ADD_AVAILABILITY_COLUMNS.sql` - Adds has_openings and registration date columns

### Configuration
- `automation/requirements.txt` - Python dependencies

---

## 🎯 Summary

The Automated Sync System is a three-layer architecture that:

1. **Collects** events from iClassPro portals using Playwright
2. **Compares** new events with existing database events
3. **Imports** events to Supabase database with deduplication

**Key Features:**
- ✅ One-click sync from UI
- ✅ "Sync ALL" - Sync all program types at once
- ✅ Automatic comparison (new, changed, unchanged, deleted)
- ✅ Price editing before import
- ✅ Supports all 10 gyms and 5 event types
- ✅ Uses `event_url` as unique identifier
- ✅ Dynamic URL fetching from `gym_links` table
- ✅ Sync Progress Tracker - See when each type was last synced
- ✅ API key authentication for Railway
- ✅ Soft delete for removed events (hidden from calendar, preserved in database)
- ✅ Automatic restoration of previously deleted events

**Workflow:**
```
User → React UI (Vercel) → Flask API (Railway) → Playwright → iClassPro Portal
  ↓
Events Collected → Comparison → Price Edit → Database Import
  ↓
Import Actions:
  - New events → Insert
  - Changed events → Update (restore if deleted)
  - Deleted events → Soft delete (set deleted_at)
  ↓
Sync Log Updated → Calendar displays only active events (deleted_at IS NULL)
```

**Deployment Architecture:**
- **Frontend:** Vercel (React app)
- **Backend API:** Railway (Flask + Playwright) - `https://master-events-calendarmaster-production.up.railway.app`
- **Database:** Supabase
- **Environment:** Production (live) + Local development supported

---

**Last Updated:** December 28, 2025  
**Status:** ✅ Fully Operational & Deployed  
**Maintained By:** Jayme + AI Assistant

**Deployment URLs:**
- **Frontend:** Vercel (your calendar app)
- **API Server:** `https://master-events-calendarmaster-production.up.railway.app`
- **Health Check:** `https://master-events-calendarmaster-production.up.railway.app/health`
