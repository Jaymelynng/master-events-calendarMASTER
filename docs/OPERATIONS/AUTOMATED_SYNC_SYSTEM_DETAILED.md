# 🚀 Automated Sync System - Complete Technical Breakdown

**Date Created:** January 2025  
**Status:** ✅ Fully Operational & Deployed  
**Last Updated:** November 2025 (Deployed to Railway + Vercel, live production system)

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
9. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

The Automated Sync System allows users to automatically collect events from iClassPro portal pages and import them into the Supabase database through a React UI. The system bridges three different environments:

1. **React Frontend** (Browser/JavaScript) - User interface (Deployed on Vercel)
2. **Flask API Server** (Python) - Bridge between browser and Python (Deployed on Railway)
3. **Playwright Script** (Python) - Browser automation for event collection (Runs on Railway)

### Key Features

- ✅ One-click event collection from iClassPro portals
- ✅ Automatic event comparison (new, changed, unchanged, deleted)
- ✅ Price editing before import
- ✅ Real-time preview of what will be imported
- ✅ Supports all 10 gyms and 5 event types
- ✅ Uses `event_url` as unique identifier for deduplication
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
│  │  - Comparison Summary                                    │  │
│  │  - Editable Price Table                                  │  │
│  │  - Import Button                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           │ HTTP POST                            │
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
│          PLAYWRIGHT SCRIPT (Python/Local)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  f12_collect_and_import.py                               │  │
│  │  - Launches headless browser                              │  │
│  │  - Opens iClassPro portal page                            │  │
│  │  - Intercepts JSON API responses                          │  │
│  │  - Extracts event data                                   │  │
│  │  - Converts to flat format                               │  │
│  │  - Returns event list                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Returns: [events]
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
3. User sees:
   - **Gym Selection:** Radio buttons in 2-column grid (10 gyms)
   - **Event Type Buttons:** 5 action buttons (appear after gym selection)
   - Uses Railway API (production) or local API server (development)

**UI Design:**
- **Step 1:** Select Gym - Radio buttons (like F12 modal)
- **Step 2:** Select Program & Sync - Action buttons that trigger sync immediately
- No separate "Sync" button needed - clicking event type button syncs right away

**Code:**
```javascript
// User selects gym (radio button)
const [selectedGym, setSelectedGym] = useState('');
// Event type is set when button is clicked, sync starts immediately
const [selectedEventType, setSelectedEventType] = useState('');
```

---

### Step 2: Preview Existing Events (Before Sync)

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 28-53)

**What Happens:**
1. When both gym and event type are selected, `useEffect` triggers
2. Fetches existing events from database for that gym/event type
3. Displays count: "X events already in database"

**Code Flow:**
```javascript
useEffect(() => {
  if (!selectedGym || !selectedEventType) return;
  
  // Fetch existing events
  const allEvents = await eventsApi.getAll('2024-01-01', '2026-12-31');
  const filtered = allEvents.filter(
    ev => ev.gym_id === selectedGym && ev.type === selectedEventType
  );
  setExistingEvents(filtered);
}, [selectedGym, selectedEventType]);
```

**Purpose:** Shows user what's already in database before syncing

---

### Step 3: User Clicks "Sync" Button

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 29-97)

**What Happens:**
1. `handleSyncForType()` function is called with event type
2. React sends HTTP POST request to Railway API (production) or local API server (dev)
3. Request body: `{ "gymId": "RBA", "eventType": "KIDS NIGHT OUT" }`
4. Shows loading spinner on the clicked button

**Code:**
```javascript
const handleSyncForType = async (eventType) => {
  setSelectedEventType(eventType);
  setSyncing(true);
  
  // Uses environment variable (Railway in production, localhost in dev)
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const response = await fetch(`${API_URL}/sync-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gymId: selectedGym,
      eventType: eventType
    })
  });
};
```

---

### Step 4: Flask API Server Receives Request

**Location:** `automation/local_api_server.py` (lines 28-105)

**What Happens:**
1. Flask receives POST request at `/sync-events`
2. Validates `gymId` and `eventType` are provided
3. Checks if gym exists in `GYMS` dictionary
4. Imports functions from `f12_collect_and_import.py`
5. Calls `collect_events_via_f12(gym_id, camp_type)`

**Code:**
```python
@app.route('/sync-events', methods=['POST'])
def sync_events():
    data = request.get_json()
    gym_id = data.get('gymId')
    event_type = data.get('eventType')
    
    # Import Playwright functions
    from f12_collect_and_import import (
        collect_events_via_f12,
        convert_event_dicts_to_flat,
        GYMS
    )
    
    # Collect events
    events_raw = collect_events_via_f12(gym_id=gym_id, camp_type=event_type)
```

---

### Step 5: Playwright Script Collects Events

**Location:** `automation/f12_collect_and_import.py` (lines 230-304)

**What Happens:**

#### 5.1: Build Portal URL
```python
# Gets URL from EVENT_TYPE_URLS dictionary
# Example: "https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time"
url = EVENT_TYPE_URLS[camp_key][gym_id]
```

#### 5.2: Launch Headless Browser
```python
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
```

#### 5.3: Set Up Response Interceptor
```python
def handle_response(response):
    # Only process JSON responses
    if "application/json" not in content_type:
        return
    
    # Only process detail calls like /camps/2106 (not listing pages)
    if "/camps/" in response_url and "?" not in response_url:
        body = response.json()
        event_id = body.get("data", {}).get("id")
        
        # Deduplicate by event ID
        if event_id not in seen_ids:
            seen_ids.add(event_id)
            captured_events.append(body["data"])
```

#### 5.4: Open Portal Page
```python
page.on("response", handle_response)  # Listen for API calls
page.goto(url, wait_until="domcontentloaded", timeout=30000)
page.reload(wait_until="networkidle", timeout=30000)
page.wait_for_timeout(1500)  # Wait for all API calls to complete
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
    "description": "..."
  }
}
```

#### 5.5: Return Raw Events
```python
return captured_events  # List of event dictionaries
```

---

### Step 6: Convert Events to Flat Format

**Location:** `automation/f12_collect_and_import.py` (lines 87-224)

**What Happens:**
1. Receives raw event dictionaries from Playwright
2. Processes each event:
   - Deduplicates by event ID
   - Filters to future events only (`startDate >= today`)
   - Builds `event_url` from event ID
   - Extracts date/time information
   - Extracts price from title or description
   - Extracts age_min and age_max

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
        
        # Extract time
        start_time = ev.get("startTime", "")
        end_time = ev.get("endTime", "")
        time_str = format_time_range(start_time, end_time)
        
        # Extract price (from title first, then description)
        price = extract_price_from_title(ev.get("name", ""))
        if price is None:
            price = extract_price_from_description(ev.get("description", ""))
        
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
  "maxAge": 13
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
  "description": "Join us for a fun-filled evening! Ages 4-13 welcome..."
}
```

---

### Step 7: API Server Returns Events to React

**Location:** `automation/local_api_server.py` (lines 72-90)

**What Happens:**
1. API server receives flat events from conversion function
2. Returns JSON response to React

**Response Format:**
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
    },
    // ... more events
  ],
  "message": "Successfully collected 3 events"
}
```

---

### Step 8: React Receives Events and Compares

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 80-97)

**What Happens:**
1. React receives events from API
2. Makes events editable (adds `_index` for React keys)
3. Fetches existing events from database
4. Calls `compareEvents()` function

**Code:**
```javascript
if (data.success && data.events && data.events.length > 0) {
  // Make events editable
  const eventsWithIndex = data.events.map((ev, idx) => ({ ...ev, _index: idx }));
  setEditableEvents(eventsWithIndex);
  
  // Compare with existing events - ONLY FUTURE EVENTS (not past events)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const allEvents = await eventsApi.getAll(today, '2026-12-31');
  const gymExistingEvents = allEvents.filter(
    ev => ev.gym_id === selectedGym && ev.type === eventType
  );
  
  // Compare new vs existing (only future events, same event type)
  const comparisonResult = compareEvents(data.events, gymExistingEvents);
  setComparison(comparisonResult);
}
```

---

### Step 9: Event Comparison Logic

**Location:** `src/lib/eventComparison.js`

**What Happens:**

#### 9.1: Create URL Maps
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

#### 9.2: Categorize Events
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
    comparison.deleted.push(existing);
  } 
  else if (existing && incoming) {
    // Check if data changed
    if (hasEventChanged(existing, incoming)) {
      comparison.changed.push({ existing, incoming, _changes: [...] });
    } else {
      comparison.unchanged.push(existing);
    }
  }
});
```

#### 9.3: Detect Changes
```javascript
function hasEventChanged(existing, incoming) {
  const fieldsToCompare = [
    'title', 'date', 'start_date', 'end_date', 
    'time', 'price', 'type', 'age_min', 'age_max'
  ];
  
  for (const field of fieldsToCompare) {
    const existingValue = normalizeValue(existing[field]);
    const incomingValue = normalizeValue(incoming[field]);
    
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
    { gym_id: "RBA", title: "...", event_url: "..." },  // New events
  ],
  changed: [
    {
      existing: { id: "uuid", title: "Old Title", ... },
      incoming: { title: "New Title", ... },
      _changes: [
        { field: "title", old: "Old Title", new: "New Title" }
      ]
    }
  ],
  unchanged: [
    { id: "uuid", title: "...", ... }  // Unchanged events
  ],
  deleted: [
    { id: "uuid", title: "...", ... }  // In DB but not in sync
  ]
}
```

---

### Step 10: Display Comparison Summary

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 304-348)

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
- Deleted count only includes future events, not past events
- Deleted events are soft deleted (hidden from calendar, preserved in database)
- If a deleted event comes back to portal, it will be automatically restored

---

### Step 11: User Edits Prices (Optional)

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 124-135)

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
      price: newPrice === '' ? null : parseFloat(newPrice)
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

### Step 12: User Clicks "Import" Button

**Location:** `src/components/EventsDashboard/SyncModal.js` (lines 137-180)

**What Happens:**
1. User clicks "Import X Events to Database"
2. React calls `handleImport()` function
3. Removes `_index` field from events
4. Calls `eventsApi.bulkImport()` for new events
5. Calls `eventsApi.update()` for changed events

**Code:**
```javascript
const handleImport = async () => {
  // Remove _index field
  const eventsToImport = editableEvents.map(({ _index, ...ev }) => ev);
  
  // Import new events
  const imported = await eventsApi.bulkImport(eventsToImport);
  
  // Update changed events
  if (comparison && comparison.changed.length > 0) {
    for (const changed of comparison.changed) {
      const existingEvents = await eventsApi.getAll('2024-01-01', '2026-12-31');
      const existingEvent = existingEvents.find(
        e => e.event_url === changed.incoming.event_url
      );
      
      if (existingEvent) {
        await eventsApi.update(existingEvent.id, {
          title: changed.incoming.title,
          date: changed.incoming.date,
          // ... other fields
        });
      }
    }
  }
};
```

---

### Step 13: Database Import

**Location:** `src/lib/api.js` (eventsApi.bulkImport) and `src/components/EventsDashboard/SyncModal.js` (handleImport)

**What Happens:**
1. **Import New Events:**
   - `bulkImport()` receives events array
   - For each event:
     - Calculates `day_of_week` if not provided (timezone-safe)
     - Checks if `event_url` already exists (duplicate check)
     - If exists: Updates existing record (restores if previously deleted)
     - If not exists: Inserts new record
   - Uses Supabase `upsert` operation

2. **Update Changed Events:**
   - Finds existing events by `event_url`
   - Updates all fields with new data
   - Sets `deleted_at = null` (restores if previously deleted)

3. **Soft Delete Removed Events:**
   - For events in database but not in portal:
     - Only marks future events as deleted (past events left alone)
     - Sets `deleted_at` timestamp
     - Event stays in database but hidden from calendar

**Day of Week Calculation (JavaScript):**
```javascript
// Calculate day_of_week if not provided (fix timezone issues)
if (!event.day_of_week) {
  const [year, month, day] = event.date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // Local date, no UTC
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  event.day_of_week = days[dateObj.getDay()];
}
```

**Database Operations:**
```javascript
// For each event
const { data, error } = await supabase
  .from('events')
  .upsert(event, {
    onConflict: 'event_url',  // Use event_url as unique key
    ignoreDuplicates: false
  });
```

**Result:**
- New events → Inserted into `events` table
- Changed events → Updated in `events` table (same database ID)
- Unchanged events → Skipped (no database write)
- Deleted events → Left in database (not automatically removed)

---

## 🔍 Component Breakdown

### 1. React Frontend Components

#### `SyncModal.js`
- **Purpose:** Main UI component for automated sync
- **Location:** `src/components/EventsDashboard/SyncModal.js`
- **UI Design:**
  - **Step 1:** Radio buttons for gym selection (2-column grid)
  - **Step 2:** Action buttons for event types (immediate sync on click)
  - **Comparison Summary:** Large, color-coded cards showing new/changed/deleted
  - **Price Editing Table:** Editable price fields with status indicators
- **Key Functions:**
  - `handleSyncForType()` - Triggers sync immediately when event type button clicked
  - `handlePriceChange()` - Updates price in state
  - `handleImport()` - Imports events to database
- **State Management:**
  - `selectedGym` - Selected gym ID (from radio button)
  - `selectedEventType` - Selected event type (set when button clicked)
  - `editableEvents` - Events with editable prices
  - `comparison` - Comparison results (new, changed, unchanged, deleted)

#### `AdminPortalModal.js`
- **Purpose:** Admin portal with sync button
- **Location:** `src/components/EventsDashboard/AdminPortalModal.js`
- **Function:** Opens `SyncModal` when "⚡ Open Sync Modal" clicked

### 2. Flask API Server

#### `local_api_server.py`
- **Purpose:** Bridge between React and Python script
- **Location:** `automation/local_api_server.py`
- **Endpoints:**
  - `GET /health` - Health check
  - `POST /sync-events` - Sync events for gym/event type
  - `GET /gyms` - Get list of gyms
  - `GET /event-types` - Get event types for gym
- **Key Features:**
  - CORS enabled for browser access
  - Error handling to prevent crashes
  - Returns JSON responses

### 3. Playwright Script

#### `f12_collect_and_import.py`
- **Purpose:** Collect events from iClassPro portals
- **Location:** `automation/f12_collect_and_import.py`
- **Key Functions:**
  - `collect_events_via_f12()` - Main collection function
  - `convert_event_dicts_to_flat()` - Converts to database format
- **Configuration:**
  - `GYMS` - Dictionary of all 10 gyms
  - `EVENT_TYPE_URLS` - URLs for each gym/event type combination

### 4. Event Comparison Logic

#### `eventComparison.js`
- **Purpose:** Compare new events with existing events
- **Location:** `src/lib/eventComparison.js`
- **Key Functions:**
  - `compareEvents()` - Main comparison function
  - `hasEventChanged()` - Check if event data changed
  - `getChangedFields()` - Get list of changed fields
  - `normalizeValue()` - Normalize values for comparison

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
   def handle_response(response):
       if "/camps/" in response.url and "?" not in response.url:
           body = response.json()
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

### Important: Only Future Events + Include Deleted

**Comparison Scope:**
- Only compares against **future events** (today and forward)
- Includes **deleted events** in comparison (to detect restorations)
- Does NOT compare against past events (prevents false "deleted" counts)
- Filters by event type (only compares same event type)

**Why Include Deleted Events?**
- If an event was previously deleted but comes back to the portal, we need to restore it
- Comparison detects deleted events that should be restored
- During import, restored events get `deleted_at = null`

**Why Only Future Events?**
- Past events are not relevant for sync comparison
- Prevents showing 30+ "deleted" events that are just old events
- More accurate comparison results

**Code:**
```javascript
// Get existing events - ONLY FUTURE EVENTS, INCLUDING DELETED ONES
const today = new Date().toISOString().split('T')[0];
const existingEvents = await eventsApi.getAll(today, '2026-12-31', true); // includeDeleted = true
const gymExistingEvents = existingEvents.filter(
  ev => ev.gym_id === selectedGym && ev.type === eventType
);
```

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
   - If URL in existing but not new → **DELETED** (will be soft deleted if future event)
   - If URL in both → Check if event was deleted or data changed
     - If was deleted OR data changed → **CHANGED** (will restore if deleted)
     - If same and not deleted → **UNCHANGED**

3. **Change Detection:**
   - Compares 9 fields: title, date, start_date, end_date, time, price, type, age_min, age_max
   - Normalizes values (handles null, empty strings, whitespace)
   - Returns list of changed fields

### Comparison Result Structure

```javascript
{
  new: [
    {
      gym_id: "RBA",
      title: "New Event",
      event_url: "https://...",
      // ... other fields
      _status: 'new',
      _reason: 'Event not found in database'
    }
  ],
  changed: [
    {
      existing: { id: "uuid", title: "Old Title", price: 30 },
      incoming: { title: "New Title", price: 35 },
      _status: 'changed',
      _changes: [
        { field: 'title', old: 'Old Title', new: 'New Title' },
        { field: 'price', old: 30, new: 35 }
      ]
    }
  ],
  unchanged: [
    { id: "uuid", title: "...", ... }
  ],
  deleted: [
    { id: "uuid", title: "...", ... }
  ]
}
```

---

## 💾 Import Process (Detailed)

### Import Flow

1. **User Clicks Import**
   ```javascript
   handleImport() → eventsApi.bulkImport(events)
   ```

2. **Bulk Import Function**
   ```javascript
   // For each event
   const { data, error } = await supabase
     .from('events')
     .upsert(event, {
       onConflict: 'event_url',
       ignoreDuplicates: false
     });
   ```

3. **Supabase Upsert Logic**
   - Checks if `event_url` exists
   - If exists: Updates record
   - If not exists: Inserts new record

4. **Update Changed Events**
   ```javascript
   // For each changed event
   await eventsApi.update(existingEvent.id, {
     title: changed.incoming.title,
     date: changed.incoming.date,
     // ... other fields
     deleted_at: null  // Restore if previously deleted
   });
   ```

5. **Soft Delete Removed Events**
   ```javascript
   // For events in DB but not in portal
   if (eventDate >= today) {  // Only future events
     await eventsApi.markAsDeleted(deletedEvent.id);
     // Sets deleted_at = current timestamp
   }
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
  deleted_at TIMESTAMP,   -- Soft delete: timestamp when event was removed from portal
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Key Constraints:**
- `event_url` is UNIQUE - prevents duplicates
- Upsert uses `event_url` as conflict resolution key
- `deleted_at IS NULL` filter applied to calendar queries (only active events shown)

---

## 🔧 Technical Details

### Dependencies

**Python:**
- `playwright>=1.40.0` - Browser automation
- `flask>=2.3.0` - API server
- `flask-cors>=4.0.0` - CORS support

**JavaScript:**
- `react` - UI framework
- `lucide-react` - Icons
- `@supabase/supabase-js` - Database client

### Ports

- **React App:** `http://localhost:3000` (or configured port)
- **API Server (Production):** `https://master-events-calendarmaster-production.up.railway.app`
- **API Server (Local Dev):** `http://localhost:5000`
- **Environment Variable:** `REACT_APP_API_URL` (set in Vercel for production)

### Configuration

**Gym Configuration:**
```python
GYMS = {
    "RBA": {"name": "Rowland Ballard Atascocita", "slug": "rbatascocita"},
    "CCP": {"name": "Capital Gymnastics Cedar Park", "slug": "capgymavery"},
    # ... 8 more gyms
}
```

**Event Type URLs:**
```python
EVENT_TYPE_URLS = {
    "KIDS NIGHT OUT": {
        "RBA": "https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time",
        "CCP": "https://portal.iclasspro.com/capgymavery/camps/13?sortBy=time",
        # ... 8 more gyms
    },
    "CLINIC": {
        # ... all gyms
    },
    # ... 3 more event types
}
```

### Data Transformations

**Raw Event → Flat Event:**
```
Raw: { 
  id: 2106, 
  name: "Kids Night Out $35", 
  startDate: "2025-12-12",
  description: "<p>Sign up for only $35!</p>",
  minAge: 4,
  maxAge: 13
}
  ↓
Flat: { 
  gym_id: "RBA", 
  title: "Kids Night Out $35", 
  date: "2025-12-12", 
  event_url: "https://portal.iclasspro.com/rbatascocita/camp-details/2106",
  price: 35.0,              // Extracted from title or description
  day_of_week: "Friday",    // Calculated from date
  description: "Sign up for only $35!",  // HTML stripped
  age_min: 4,
  age_max: 13
}
```

**Time Formatting:**
```
Input: startTime: "18:30:00", endTime: "21:30:00"
  ↓
Output: "6:30 PM - 9:30 PM"
```

**Price Extraction:**
```
1. Try title: "Kids Night Out $35" → 35.0
2. If not found, try description HTML: "<p>Price $35</p>" → 35.0
3. If not found → null
```

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

#### 2. "No events collected"
**Problem:** Gym/event type combination not configured  
**Solution:** Check `EVENT_TYPE_URLS` in `f12_collect_and_import.py`

#### 3. "Server stopped unexpectedly"
**Problem:** Playwright error or unhandled exception  
**Solution:** Check server logs, restart server

#### 4. "Comparison shows wrong results"
**Problem:** `event_url` mismatch  
**Solution:** Verify `event_url` format matches between sync and database

#### 5. "Description not showing"
**Problem:** Description column not added to database  
**Solution:** Run `database/ADD_DESCRIPTION_COLUMN.sql` in Supabase

#### 6. "Deleted events still showing on calendar"
**Problem:** `deleted_at` column not added to database  
**Solution:** Run `database/ADD_DELETED_AT_COLUMN.sql` in Supabase

#### 7. "Events marked as deleted but they're back in portal"
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

**Check API Server Logs:**
- Terminal running `local_api_server.py`
- Shows all sync requests and errors

---

## 📝 Key Files Reference

### Python Files
- `automation/f12_collect_and_import.py` - Playwright event collection
- `automation/local_api_server.py` - Flask API server
- `automation/fetch_gym_urls.py` - Generate URLs from database

### JavaScript Files
- `src/components/EventsDashboard/SyncModal.js` - Main sync UI (radio buttons + event type buttons)
- `src/components/EventsDashboard/AdminPortalModal.js` - Admin portal
- `src/components/EventsDashboard.js` - Event details sidebar (shows description)
- `src/lib/eventComparison.js` - Comparison logic
- `src/lib/api.js` - Database API functions

### Database Migrations
- `database/ADD_AGE_COLUMNS.sql` - Adds age_min and age_max columns
- `database/ADD_DESCRIPTION_COLUMN.sql` - Adds description column
- `database/ADD_DELETED_AT_COLUMN.sql` - Adds deleted_at column for soft delete

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
- ✅ Automatic comparison (new, changed, unchanged, deleted)
- ✅ Price editing before import
- ✅ Supports all 10 gyms and 5 event types
- ✅ Uses `event_url` as unique identifier
- ✅ Soft delete for removed events (hidden from calendar, preserved in database)
- ✅ Automatic restoration of previously deleted events

**Workflow:**
```
User → React UI (Vercel) → Flask API (Railway) → Playwright → iClassPro Portal
  ↓
Events Collected → Comparison (future only, includes deleted) → Price Edit → Database Import
  ↓
Import Actions:
  - New events → Insert
  - Changed events → Update (restore if deleted)
  - Deleted events → Soft delete (set deleted_at)
  ↓
Calendar displays only active events (deleted_at IS NULL)
```

**Deployment Architecture:**
- **Frontend:** Vercel (React app)
- **Backend API:** Railway (Flask + Playwright) - `https://master-events-calendarmaster-production.up.railway.app`
- **Database:** Supabase
- **Environment:** Production (live) + Local development supported

---

**Last Updated:** November 2025 (Deployed to Railway + Vercel, live production system)  
**Status:** ✅ Fully Operational & Deployed  
**Maintained By:** Jayme + AI Assistant

**Deployment URLs:**
- **Frontend:** Vercel (your calendar app)
- **API Server:** `https://master-events-calendarmaster-production.up.railway.app`
- **Health Check:** `https://master-events-calendarmaster-production.up.railway.app/health`

