# EventsDashboard.js Code Review - Detailed Findings

**Reviewed:** February 23, 2026  
**File:** `src/components/EventsDashboard.js` (4,019 lines)  
**Supporting files:** `src/lib/api.js`, `src/lib/useRealtimeEvents.js`, `src/lib/cache.js`

---

## 1. How the Dashboard Displays Events (Multi-day events / start_date & end_date)

### Calendar View (Lines 2850-3341)
The calendar is a grid with gyms as rows and dates as columns. For each cell, events are matched to dates via the `dateEvents` filter (lines 3064-3114).

**Multi-day display logic (lines 3092-3107):**
- Only CAMP types (`CAMP`, `CAMPS`, `SUMMER CAMP`, etc.) are treated as multi-day (line 3094)
- For multi-day camps, the event card appears on EVERY day from `start_date` through `end_date` (line 3105)
- Non-camp events (Clinic, KNO, Open Gym) are always single-day, matched by exact `event.date`
- There's a `getActualEndDate()` helper (lines 3068-3090) that parses date ranges from titles as a fallback when `end_date` is wrong in the database

**Side Panel (lines 3344-3968):**
- The side panel shows the event's `date` field only (line 3399), formatted as a full date string
- It does NOT show `start_date` or `end_date` separately — so for multi-day camps, users only see the start date in the detail panel
- **Issue:** Multi-day camps should show the full date range (e.g., "March 16-20, 2026") in the side panel, not just the single date

**Table View (lines 2759-2847):**
- Table view also only shows `event.date` (line 2795): `new Date(event.date).toLocaleDateString()`
- No `start_date` / `end_date` columns exist in the table
- **Issue:** Multi-day camp date ranges are invisible in table view

### Finding Summary for Q1:
- **Calendar view** correctly displays multi-day camps spanning across date columns
- **Side panel** and **table view** only show the `date` field, hiding the full date range for multi-day events

---

## 2. Event Deletion/Removal in the UI

### Manual Deletion (Lines 1750-1796)
- `handleDeleteEvent()` performs a **hard delete** via `eventsApi.delete(eventId)` (line 1779)
- This calls `supabase.from('events').delete().eq('id', id)` — a permanent removal
- Confirmation dialog is shown first (line 1751)
- Audit log entry is created BEFORE the actual deletion (lines 1760-1771)
- After deletion, cache is cleared and events are refetched

### Soft Delete Support in API (api.js lines 267-278)
- `eventsApi.markAsDeleted(id)` exists — sets `deleted_at` timestamp
- `eventsApi.restore(id)` exists — clears `deleted_at`
- **However:** The dashboard's `handleDeleteEvent` uses **hard delete** (`eventsApi.delete`), not soft delete

### Sync-Detected Deletions
- The sync process (handled by `SyncModal` component) likely uses the Python backend to detect removed events
- The bulk import function (lines 1357-1747) handles duplicate detection and update logic
- Soft-deleted events can be restored during bulk import (api.js lines 90-146)

### Deleted Events Filtering (api.js lines 179-208)
- `eventsApi.getAll()` filters out deleted events by default: `.is('deleted_at', null)` (line 202)
- Has an `includeDeleted` parameter that defaults to `false`

### Finding Summary for Q2:
- Manual UI deletion is a **hard delete** (permanent), not soft delete
- The API has soft-delete support (`markAsDeleted`/`restore`) but the UI doesn't use it for manual deletions
- The `getAll()` query correctly filters out soft-deleted events by default

---

## 3. Event Filtering (by gym, type, date)

### Filter Implementation (Lines 875-888)
The `filteredEvents` useMemo at line 875 handles filtering:

```javascript
const matchesGym = selectedGym === 'all' || 
  event.gym_id === selectedGym || 
  event.gym_code === selectedGym || 
  event.gym_name === selectedGym;
const matchesType = selectedEventType === 'all' || event.type === selectedEventType;
const matchesSearch = searchTerm === '' || 
  event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  event.type?.toLowerCase().includes(searchTerm.toLowerCase());
```

### Issues Found:

**Issue 3a: Category filter dropdown uses `<select>` (line 2669-2681)**
- Violates the project rule: "Never use `<select>` dropdowns"
- The gym filter also uses `<select>` (lines 2656-2667)
- Button pill filters exist for event types (lines 2703-2755) but the `<select>` dropdown ALSO exists above it — creating a redundant dual-filter

**Issue 3b: Event type filter dropdown only shows tracked types (line 868-873)**
- `eventTypesFromEvents` filters to only `is_tracked` event types
- This means CAMP and SPECIAL EVENT can't be selected from the dropdown
- However, the pill buttons below (lines 2703-2755) DO include CAMP
- The dropdown and pill buttons are not synced — both control `selectedEventType` but offer different options

**Issue 3c: Date filtering is month-based only**
- Events are fetched for the entire month (lines 343-345)
- No day-level date range filter exists
- This is by design (calendar is organized by month), so not necessarily a bug

**Issue 3d: Gym filter matching is fragile (line 877-880)**
- Matches by `gym_id`, `gym_code`, OR `gym_name` — but `selectedGym` from the dropdown is the gym `name`
- The dropdown populates with `gym.name` (line 2664) but comparison also checks against `gym_id` and `gym_code`
- This works because of the OR conditions, but it's loose matching

---

## 4. Event Loading and Real-time Subscription

### Initial Load (Lines 186-244)
- `useEvents` hook fetches events when `startDate`/`endDate` change
- Uses `cachedApi.getEvents()` which currently has cache DISABLED (cache.js line 80-88)
- So every mount and month change triggers a fresh API call — this is fine for data freshness

### Real-time Subscription (Lines 210-229)
- `useRealtimeEvents` subscribes to `postgres_changes` on the `events` table
- On ANY change (INSERT, UPDATE, DELETE), it:
  1. Invalidates the cache: `cache.invalidate('events')` (line 216)
  2. Calls `eventsApi.getAll(startDate, endDate)` to refetch ALL events for the current month (line 221)

### Issues Found:

**Issue 4a: Realtime refetch scope mismatch**
- The realtime callback at line 216 does `cache.invalidate('events')` — but cache is already disabled for events
- The refetch at line 221 uses `startDate` and `endDate` from the hook closure — these are captured at hook creation time and won't update when the user changes months unless the component re-renders

**Issue 4b: No debouncing on realtime updates**
- If a sync updates 50 events rapidly, the realtime handler fires 50 times, each triggering a full refetch
- This could cause 50 sequential API calls to Supabase
- Should debounce the realtime refetch (e.g., 500ms delay)

**Issue 4c: Excessive console logging in production**
- Lines 3117-3119: Debug logging for first gym's events on every render
- Lines 3179-3191: Debug logging for camp grouping on every render
- Lines 433: Logging all URLs for event types
- These should be removed or gated behind a debug flag

---

## 5. Deleted Events Potentially Appearing in UI

### Main Query is Safe
- `eventsApi.getAll()` (api.js line 202) filters: `.is('deleted_at', null)`
- This is the primary data source for the dashboard

### Potential Leak Points:

**Issue 5a: Realtime subscription refetch is safe**
- The realtime callback (line 221) calls `eventsApi.getAll(startDate, endDate)` which includes the `deleted_at` filter
- So soft-deleted events won't appear after a realtime update

**Issue 5b: `events_with_gym` view**
- The query targets `events_with_gym` view (api.js line 185)
- This view is a UNION ALL of `events` and `events_archive`
- Need to verify the view definition filters deleted events, but since the Supabase query adds `.is('deleted_at', null)`, the client-side filter is reliable regardless

**Issue 5c: Cache persistence could serve stale data with deleted events**
- `persistCache.load()` (cache.js line 136) restores from localStorage on startup
- If an event was cached before deletion, and the user reloads before the cache expires, they could briefly see a deleted event
- **However:** Events cache is currently DISABLED (cache.js line 80), so this is not a current risk

**Issue 5d: Side panel doesn't refresh when events update**
- `selectedEventForPanel` is React state (line 280)
- When events refetch after a realtime update, the side panel state is NOT updated unless the user clicks a different event
- If an event is deleted while the side panel is open showing that event, the panel will still show the deleted event
- Only acknowledged_errors gets manually synced (lines 485-490)

---

## 6. Other Bugs, Performance Issues, and Potential Problems

### Performance Issues:

**Issue 6a: `getEventCounts()` is called per-row without memoization (line 2438)**
- Inside the monthly requirements table render, `getEventCounts()` is called on EVERY row iteration
- This function iterates ALL events multiple times for each gym
- Should be computed once and passed to each row
- With 10 gyms × 400 events, this means ~4000 iterations per render instead of ~400

**Issue 6b: Heavy inline function definitions inside JSX**
- `getActualEndDate()` (lines 3068-3090) is defined INSIDE the `.map()` callback for every date cell
- `groupCampEventsForDisplay()` (lines 3135-3173) is defined inside the render for every date cell
- These should be extracted to module-level or memoized

**Issue 6c: 4000+ line monolithic component**
- Already noted in CLAUDE.md as a known issue
- Makes maintenance difficult and increases risk of subtle bugs

### Bugs:

**Issue 6d: Table view date uses `new Date(event.date)` which causes timezone shift (line 2795)**
- `new Date(event.date)` for a date string like `"2026-02-23"` will parse as UTC midnight
- In timezones behind UTC, this displays as the previous day
- The calendar view correctly uses `parseYmdLocal()` to avoid this, but the table view doesn't

**Issue 6e: ExportModal receives `events` (all events) not `filteredEvents` (line 1891)**
- `<ExportModal ... events={events} ...>` passes unfiltered events
- The CLAUDE.md doc says this was FIXED, but looking at line 1891, it still passes `events` not `filteredEvents`
- Need to verify if ExportModal handles its own filtering internally

**Issue 6f: Duplicate month navigation controls**
- Month navigation appears in 3+ places:
  1. Dashboard header (lines 1975-2019)
  2. Monthly requirements section (lines 2360-2396)  
  3. Calendar controls (lines 2610-2636)
  4. Bottom of calendar (lines 3304-3325)
- These all modify the same state, but having 4 sets of month nav buttons is redundant UX

**Issue 6g: `<select>` dropdowns violate project rules**
- Gym filter (line 2657-2667) and Category filter (line 2669-2681) use `<select>` elements
- Project rules state: "Never use `<select>` dropdowns"

**Issue 6h: No loading state when realtime triggers refetch**
- When a realtime event triggers `refreshEvents()` (line 219-228), it doesn't set `loading` to true
- Users see stale data until the fetch completes with no visual indicator

### Data Consistency:

**Issue 6i: Bulk import duplicate detection uses stale client events (line 1393)**
- In `handleBulkImport()`, the first duplicate check at line 1393 uses the `events` state (client-side)
- Later (line 1450), it correctly fetches fresh from DB
- The first check is misleading and could show incorrect warnings

**Issue 6j: `handleDeleteEvent` does hard delete but API supports soft delete**
- The dashboard uses `eventsApi.delete()` (hard delete) at line 1779
- But `eventsApi.markAsDeleted()` exists for soft delete
- Soft delete would be safer for data recovery and audit trail

---

## Priority Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| HIGH | 6a: getEventCounts() called per-row | Performance degradation with many gyms |
| HIGH | 4b: No debouncing on realtime updates | Can cause API rate limiting during sync |
| MEDIUM | 5d: Side panel shows stale/deleted event | UX confusion |
| MEDIUM | 6d: Table view timezone bug | Wrong dates displayed |
| MEDIUM | 6e: ExportModal may get unfiltered events | Export ignores user filters |
| MEDIUM | 6j: Hard delete instead of soft delete | No data recovery possible |
| LOW | 3a/6g: `<select>` dropdowns | Violates project rules |
| LOW | 3b: Dropdown vs pill filter mismatch | Confusing dual-filter UX |
| LOW | 6b: Inline function definitions | Minor perf impact per render |
| LOW | 4c: Excessive console.log | Production noise |
| LOW | 6f: Duplicate month navigation | UX clutter |
| INFO | 1: Side panel missing date range | Multi-day camps show incomplete info |
