# Openings / Spots-Remaining Capacity Feature

**Built:** April 26, 2026
**Status:** ✅ Live in production
**Affected:** All 10 gyms, all event types (KNO, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT)

---

## What This Does

Every event card on the calendar now shows the **exact number of spots remaining** with color-coded urgency:

| Display | Meaning | Color |
|---------|---------|-------|
| 🟢 23 | 4+ spots open — plenty of room | Green |
| ⚠️ 2 | 1-3 spots left — almost full | Orange |
| 🔴 FULL (top-left badge) | 0 spots — sold out | Red |

The data also flows through to the side panel and CSV/JSON export.

---

## Why This Matters

Previously, cards only knew **true / false** (sold out vs not). Now they know the actual count. This unlocks:

- **At-a-glance promotion priority** — sort/filter by which events are filling up
- **Proactive marketing** — push registration on events with high openings
- **Accurate planning** — see capacity utilization across all 10 gyms
- **Operational visibility** — know which events need attention without clicking each one

---

## The Discovery

iClassPro's public detail endpoint **has been returning these fields all along** — we were just throwing them away.

### Endpoint
```
GET https://app.iclasspro.com/api/open/v1/{slug}/camps/{event_id}
```

Same endpoint our backend already calls for every synced event. Public API, no auth required.

### Response Fields
```json
{
  "data": {
    "openings": 23,                              ← exact integer (NEW)
    "openingsDisplay": "23 Openings Available",  ← formatted string (NEW)
    "showOpenings": true,                        ← gym setting (NEW)
    "hasOpenings": true,                         ← boolean (already captured)
    "maxStudents": null,                         ← capacity NOT available
    ...
  }
}
```

### Important Limits

- **`maxStudents` is always `null`** in the public API — we cannot show "23 / 40" fraction format. Only spots-open count is available.
- **All 10 gyms have `showOpenings: true`** — verified by hitting the live API for one camp per gym during build. No iClass settings need to be changed.
- **Endpoint serves all event types** — same `/camps/{id}` URL works for KNO, Clinic, Open Gym, Camp, Special Event (iClass stores them all as "camps" with different `typeId`).

---

## What Was Built

### 1. Database (Supabase)
**Migration:** `database/ADD_OPENINGS_COLUMNS.sql`

Three new columns added to both `events` and `events_archive`:
- `openings INTEGER` — spots remaining (e.g. 23)
- `openings_display TEXT` — iClass formatted string (e.g. "23 Openings Available")
- `show_openings BOOLEAN DEFAULT true` — gym setting

`events_with_gym` view refreshed via `database/CREATE_EVENTS_WITH_GYM_VIEW.sql` to expose the new columns.

### 2. Python Backend
**File:** `automation/f12_collect_and_import.py` (lines ~1346-1352, ~1546-1549)

Extracts `openings`, `openingsDisplay`, `showOpenings` from every event detail response and writes them to the dict that gets imported. Logs spot count to console during sync.

**File:** `automation/local_api_server.py` (line ~133)

`ALLOWED_EVENT_FIELDS` allowlist updated to accept the 3 new fields for upsert.

**Note:** `pricing_supabase.py` was added to git in this session — it had been an untracked dependency that broke Railway sync the first time we pushed. Now committed.

### 3. Frontend
**File:** `src/components/EventsDashboard/SyncModal.js` (4 update paths)

When syncing, openings fields are written to events at all 4 spots where `eventsApi.update()` is called:
- Sync All Gyms → changed events
- Sync All Gyms → unchanged events refresh
- Single-gym sync → changed events
- Single-gym sync → unchanged events refresh ("Refresh Validation" button)

Note: openings is **NOT** in `COMPARISON_FIELDS` — adding it would flag every event as "changed" every time someone signs up. Validation comparison ignores it.

**File:** `src/components/EventsDashboard/EventCard.js`

Card layout (after time was dropped per UX decision):
- Line 1: Event type (CAMP / CLINIC / etc.)
- Line 2: "X opts" (only shown for grouped events with multiple variants)
- Line 3: 🟢 / ⚠️ / nothing — openings count or low-warning
- Top-left: 🔴 FULL badge if has_openings === false

Hover tooltip shows full info: title, time, spots, options, status.

**File:** `src/components/EventsDashboard/EventDetailPanel.js`

`AvailabilityStatus` component displays color-coded box with the count: "🟢 23 spots remaining" / "⚠️ 2 spots remaining" / "🔴 SOLD OUT". Notes when gym hides count publicly (`show_openings === false`, hasn't happened yet across our 10).

**File:** `src/components/EventsDashboard/ExportModal.js`

CSV export now includes 2 new columns: `Spots Left` (integer) and `Openings Display` (formatted string). JSON export auto-includes the new fields via the existing spread (`...e`).

---

## How To Use

### Daily View
Just look at the calendar. Color-coded spot counts on every card.

### Sort by Capacity
Use the **Table View** toggle (in calendar controls). Sort by openings to find events about to fill up.

### Export for Reporting
Hit Export → CSV. Open in Excel. Sort by `Spots Left` ascending → priority list of events about to sell out.

### Promotion Workflow
1. Filter by ⚠️ orange (almost full)
2. Push social/email on those
3. Filter by 🟢 with low numbers
4. Add second-wave marketing for those

---

## Layout Decisions (April 26 Session)

**Time was removed from cards** because:
- Camps are always 9a-3p (Full) or 9a-12p (Half) — redundant
- KNO is consistently 6-7pm — predictable
- Time wasn't actionable info; spots open is
- Time still accessible via hover tooltip + Table View + side panel

**Color thresholds:**
- 0 spots = red (FULL badge in top-left, no inline count)
- 1-3 spots = orange ⚠️ (almost full warning)
- 4+ spots = green 🟢 (plenty of room)

**X/Y format ("23/40 spots") was rejected** because iClass doesn't provide max capacity. Could be enabled later if max capacity is manually entered per camp in Supabase (similar to current pricing approach).

---

## Future Enhancements (Deferred)

- **Time-grid view** (Google Calendar day view style) — discussed but deferred. Table View covers this need for now.
- **X/Y fraction display** — requires manual capacity entry in Supabase per event
- **Per-card error indicator** (more visible than current corner dot) — separate work, scoped under upcoming error UI redesign
- **Filter chips for status** ("Show only sold out" / "Show only almost full") — high-value, not built yet
- **Heatmap view** — color-code calendar cells by capacity utilization

---

## Verification

- ✅ Database columns confirmed live: `SELECT column_name FROM information_schema.columns WHERE table_name = 'events_with_gym'` shows all 4 (has_openings, openings, openings_display, show_openings)
- ✅ Live API confirmed for all 10 gyms: every gym returns `openings` integer + `showOpenings: true`
- ✅ Sync All Gyms run completed April 26 — populated openings on ~400 events
- ✅ CSV export verified: real spot counts (0, 4, 23, 34, 50, 115, etc.) populated in `Spots Left` column

---

## Commit History

- `009d4ed` — Capture iClassPro openings count (database + Python + initial UI)
- `68c0e42` — Persist openings fields when updating existing events (4 SyncModal paths)
- `f4b19ef` — Add missing pricing_supabase.py module that f12 imports (unblock Railway)
- `1a71f49` — Show actual spot count, not iClass display string
- `d7c07e3` — Show spots-remaining count on calendar event cards
- `93d40ca` — Stack openings badge below time on event cards
- `13b0f91` — Drop time from cards; full info available on hover
