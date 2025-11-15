# 🚀 Automation Documentation - F12 Event Collection

**Date Created:** November 14, 2025  
**Status:** Working Script + API Integration in Progress

---

## ✅ The Working Script

### **File:** `automation/f12_collect_and_import.py`

**CONFIRMED WORKING SCRIPT** - Successfully tested on November 13, 2025.

### **What It Does:**
- Uses **Playwright** (browser automation) to open iClassPro portal pages
- **Intercepts network responses** for JSON detail API calls (like `/camps/2106`, `/camps/2085`)
- **NOT search calls** - specifically intercepts `/camps/{id}` detail calls (where `{id}` is the event ID)
- Captures event data from those API responses
- Converts events to our database format
- Filters to future events only
- Deduplicates by event ID

### **How It Works (Step-by-Step):**

1. **Opens portal URL** in Playwright browser:
   ```
   https://portal.iclasspro.com/{slug}/camps/{typeId}?sortBy=time
   ```
   Example: `https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time`

2. **Page loads** and automatically makes detail API calls:
   - The portal page JavaScript makes individual API calls for each event
   - These are calls like: `/camps/2106`, `/camps/2085`, etc.
   - Each call returns ONE event's full data

3. **Playwright intercepts** those network responses:
   - Listens for responses with `/camps/` in the URL
   - **Filters for detail calls**: URL must contain `/camps/` but NOT contain `?` (query string)
   - This distinguishes detail calls (`/camps/2106`) from search calls (`/camps?programId=...`)

4. **Extracts event JSON** from responses:
   - Each response has structure: `{"data": {"id": 2106, "name": "...", ...}}`
   - Extracts the `data` object (the event itself)
   - Each event has: `id`, `name`, `startDate`, `schedule`, `description`, `minAge`, `maxAge`, etc.

5. **Converts to our format**:
   - Builds event URL: `https://portal.iclasspro.com/{slug}/camp-details/{id}`
   - Extracts time from `schedule[0].startTime` and `endTime`
   - Extracts price from title or description using regex
   - Calculates `day_of_week` from `startDate`
   - Filters out past events (only future events)

### **Key Technical Details:**

**Response Interception Logic:**
```python
# Only intercept JSON responses
if "application/json" not in content_type:
    return

# We want detail calls like /camps/2106, NOT the ? query
# So require "/camps/" and NO "?" in the URL
if "/camps/" in response_url and "?" not in response_url:
    body = response.json()
    data = body.get("data")  # Event data is in body.data
    event_id = data.get("id")
```

**Why This Approach Works:**
- The portal page makes these detail calls automatically when it loads
- Each call returns complete event data (not just a summary)
- We don't need to know program IDs or make search calls
- We just intercept what the page already requests

### **Confirmed Working:**
- ✅ Successfully collected RBA KIDS NIGHT OUT events (November 13, 2025)
- ✅ Successfully collected RBA CLINIC events (November 13, 2025)
- ✅ Raw JSON files saved in `automation/raw_f12/` folder
- ✅ Event IDs captured correctly (e.g., 2106, 2085, etc.)
- ✅ Event URLs generated correctly: `https://portal.iclasspro.com/rbatascocita/camp-details/{id}`
- ✅ Each raw JSON file contains ONE event: `{"data": {"id": 2085, ...}}`

### **Raw JSON File Structure:**
Example from `raw_f12_RBA_KIDS_NIGHT_OUT_20251113_134941.json`:
```json
{
  "data": {
    "id": 2085,
    "name": "Tie Dye Night |Kids Night Out | Ages 4-13 | December 5th",
    "description": "<p>...</p>",
    "startDate": "2025-12-05",
    "endDate": "2025-12-05",
    "schedule": [{"startTime": "7:00 PM", "endTime": "9:30 PM"}],
    "minAge": 4,
    "maxAge": 12,
    ...
  }
}
```

### **Key Functions:**
- `collect_events_via_f12(gym_id, camp_type)` - Main collection function using Playwright
  - Opens portal page
  - Intercepts `/camps/{id}` detail calls
  - Returns list of event dictionaries
- `convert_event_dicts_to_flat(events, gym_id, portal_slug, camp_type_label)` - Converts to database format
  - Deduplicates by event ID
  - Filters to future events only
  - Builds event URLs
  - Extracts time, price, description, etc.

### **Important Notes:**
- **Uses async Playwright** (`async_playwright`) for Railway compatibility
- **Fetches URLs dynamically** from Supabase `gym_links` table (not hardcoded)
- **Works for all gyms** - URLs are configured in database, not in code

---

## 🔴 The Problem: Browser Can't Run Python

### **The Challenge:**

We want to add a button in the React app that triggers the Python script automatically. However:

1. **React App (Frontend):**
   - Runs in the browser (JavaScript)
   - Lives at: `http://localhost:3000` (or your React dev server)
   - Can only execute JavaScript
   - Cannot directly access your computer's file system
   - Cannot directly run Python scripts

2. **Python Script (Backend):**
   - Runs on your computer (Python)
   - Needs Playwright (browser automation)
   - Needs access to network requests
   - Cannot be executed from browser JavaScript

3. **The Gap:**
   - Browser (JavaScript) ↔️ **CANNOT** ↔️ Python Script
   - Different languages, different environments, security restrictions

### **Why Browsers Can't Run Python:**
- **Security:** Browsers are sandboxed - they can't execute arbitrary code on your computer
- **Language:** Browsers only understand JavaScript (and WebAssembly, but not Python)
- **Environment:** Python needs an interpreter, libraries, file system access
- **Architecture:** Browser code runs in a virtual machine, Python runs on the OS

---

## 💡 The Solution: API Server Bridge

### **What We're Building:**

An API server that acts as a bridge between the browser and Python script.

### **Architecture:**

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   React App     │  HTTP   │  API Server  │  Calls  │  Python Script   │
│  (Browser/JS)   │ ──────> │  (Flask)     │ ──────> │  (Playwright)    │
│                 │         │              │         │                  │
│  [Button Click] │         │  localhost   │         │  f12_collect_... │
│                 │         │  :5000       │         │  .py             │
└─────────────────┘         └──────────────┘         └─────────────────┘
     JavaScript                    Python                    Python
```

### **How It Works:**

1. **User clicks button** in React app
2. **React makes HTTP request** to `http://localhost:5000/sync-events`
3. **API server receives request** (Flask/Python)
4. **API server calls** `f12_collect_and_import.py` functions
5. **Python script runs** (Playwright collects events)
6. **Results returned** to API server
7. **API server sends JSON** back to React app
8. **React app displays results** and imports to database

### **Files Created:**

1. **`automation/local_api_server.py`** - Flask API server
   - Endpoint: `POST /sync-events`
   - Accepts: `{ "gymId": "RBA", "eventType": "KIDS NIGHT OUT" }`
   - Calls: `collect_events_via_f12()` and `convert_event_dicts_to_flat()`
   - Returns: JSON with events ready to import

2. **`src/components/EventsDashboard/SyncModal.js`** - React component
   - UI for selecting gym and event type
   - Calls API server
   - Shows results
   - Imports to database using existing `eventsApi.bulkImport()`

### **Why This Approach:**

✅ **Keeps working script unchanged** - We're not modifying `f12_collect_and_import.py`  
✅ **Makes it accessible from UI** - Browser can call it via HTTP  
✅ **Uses existing import logic** - Same `bulkImport()` function as manual F12  
✅ **Runs locally** - No cloud deployment needed (yet)  
✅ **One gym + one event type** - Simple, controlled workflow  

---

## 📋 Current Status

### **✅ Completed:**
- Working Playwright script saved (`automation/f12_collect_and_import.py`)
- API server created (`automation/local_api_server.py`)
- React UI component created (`src/components/EventsDashboard/SyncModal.js`)
- Button added to Admin Portal
- Integration with existing bulk import function

### **🔄 In Progress:**
- Getting API server to start and stay running
- Testing end-to-end flow
- Adding more gym/event type combinations to `EVENT_TYPE_URLS`

### **📝 Next Steps:**
1. Start API server: `python automation/local_api_server.py`
2. Test sync button in React app
3. Verify events are collected correctly
4. Verify import to database works
5. Add more gyms to `EVENT_TYPE_URLS` in `f12_collect_and_import.py`

---

## 🔧 Technical Details

### **Dependencies:**
- `playwright` - Browser automation
- `flask` - API server framework
- `flask-cors` - Allow browser to call API (CORS)

### **Ports:**
- React app: `http://localhost:3000` (or your dev server port)
- API server: `http://localhost:5000`

### **API Endpoints:**
- `GET /health` - Check if server is running
- `POST /sync-events` - Sync events for gym/event type
- `GET /gyms` - Get list of available gyms
- `GET /event-types?gymId=RBA` - Get event types for a gym

### **Data Flow:**
1. User selects: Gym (RBA) + Event Type (KIDS NIGHT OUT)
2. React sends: `POST /sync-events` with `{ "gymId": "RBA", "eventType": "KIDS NIGHT OUT" }`
3. API server:
   - Calls `collect_events_via_f12("RBA", "KIDS NIGHT OUT")`
   - Gets raw event data from Playwright
   - Calls `convert_event_dicts_to_flat(...)`
   - Returns formatted events
4. React receives events, shows preview
5. User clicks "Import", React calls `eventsApi.bulkImport(events)`
6. Events saved to Supabase database

---

## 📚 Related Files

- `automation/f12_collect_and_import.py` - The working script
- `automation/local_api_server.py` - API server wrapper
- `automation/raw_f12/` - Saved raw JSON from successful runs
- `src/components/EventsDashboard/SyncModal.js` - React UI component
- `src/components/EventsDashboard/AdminPortalModal.js` - Where button is added
- `src/lib/api.js` - Existing `eventsApi.bulkImport()` function

---

## 🎯 Key Insight

**The Python script doesn't change.** We're just making it accessible from the browser by wrapping it in an API server. The same functions that worked yesterday are being called - just through HTTP instead of command line.

---

---

## 🚨 Important: What Script Actually Works

**CONFIRMED:** The working script uses **Playwright** to intercept `/camps/{id}` detail calls.

**NOT WORKING:** Scripts that use `aiohttp` with direct API calls to `/camps/search?programId=...` do NOT work reliably.

**Evidence:**
- Raw JSON files in `automation/raw_f12/` show single event detail responses
- Documentation confirms Playwright approach
- Tested and working on November 13, 2025

---

**Last Updated:** November 14, 2025  
**Author:** AI Assistant + Jayme  
**Status:** Documentation updated with confirmed working script details

