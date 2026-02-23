# 🔍 Event Comparison Logic - New vs Changed vs Deleted

**Last Updated:** December 28, 2025  
**File:** `src/lib/eventComparison.js`  
**Purpose:** How the system identifies new, changed, and deleted events using event_url as source of truth

---

## 🎯 The Source of Truth

**Event ID → Event URL**

Every event has a unique ID from iClassPro (e.g., `2106`). This ID is used to build the event URL:
```
https://portal.iclasspro.com/{slug}/camp-details/{id}
```

**The event_url is the source of truth** - it uniquely identifies each event.

---

## 🔄 How Comparison Works

### **Step 1: Get Data**
- **New Events:** From sync (Playwright script)
- **Existing Events:** From database (Supabase)

### **Step 2: Compare by event_url**

For each event_url:

#### **🆕 NEW Event**
- `event_url` exists in new sync
- `event_url` does NOT exist in database
- **Action:** Insert into database

#### **🔄 CHANGED Event**
- `event_url` exists in BOTH new sync AND database
- But data fields are different (title, date, time, price, etc.)
- **Action:** Update existing record in database

#### **🗑️ DELETED Event**
- `event_url` exists in database
- `event_url` does NOT exist in new sync
- **⚠️ IMPORTANT:** Only **FUTURE events** (start_date > today) are marked as deleted
- **⚠️ IMPORTANT (Feb 23 fix):** Existing events are now filtered by `checkedTypes` before comparison, so a Sync All that syncs CLINIC events won't falsely mark KNO events as deleted (and vice versa). This prevents cross-type false deletions.
- **Action:** Soft-delete (set `deleted_at` timestamp)

**Why only future events?**
- iClassPro only shows upcoming events
- Past events naturally disappear from the portal after they occur
- Once an event starts, it's expected to be removed from iClassPro
- We should NOT mark past events as deleted just because they're not in the sync

#### **✓ UNCHANGED Event**
- `event_url` exists in BOTH
- All data fields are the same
- **Action:** Skip (no changes needed)

---

## 📊 Fields Compared

When checking if an event changed, we compare **only core content fields**:

### Fields That TRIGGER "Changed" Status
| Field | Description | Example Change |
|-------|-------------|----------------|
| `title` | Event name | "Back Handspring Clinic" → "Cartwheel Clinic" |
| `date` | Event date | 2025-12-15 → 2025-12-16 |
| `start_date` | Multi-day start | 2025-06-01 → 2025-06-02 |
| `end_date` | Multi-day end | 2025-06-05 → 2025-06-06 |
| `time` | Time range | "6:30 PM - 9:30 PM" → "7:00 PM - 10:00 PM" |
| `price` | Cost | $25 → $30 |
| `type` | Event category | CLINIC → OPEN GYM |
| `age_min` | Minimum age | 5 → 7 |
| `age_max` | Maximum age | 12 → 15 |
| `description` | Event description | Any text change |

### Fields That DON'T Trigger "Changed" (Volatile Fields)
These fields are **saved to the database** but are excluded from comparison to prevent false "CHANGED" alerts:

| Field | Why Excluded |
|-------|--------------|
| `has_openings` | Updates in real-time as people register |
| `registration_start_date` | Can change, but not core content |
| `registration_end_date` | Can change, but not core content |
| `has_flyer` | Can change but usually not critical |
| `flyer_url` | Can change but usually not critical |
| `description_status` | Derived from description/flyer |
| `validation_errors` | Recalculated every sync |
| `acknowledged_errors` | User-managed dismissals |

**Why exclude these?** These fields were causing 39+ events to show as "CHANGED" every sync when nothing actually changed. The data still saves, it just doesn't trigger false alerts.

### Fields Never Compared (Identifiers)
- `event_url` - Used to MATCH events, not compare them
- `gym_id` - Identifier, not content
- `id` - Database primary key

**See Also:** [DATA_QUALITY_VALIDATION.md](./DATA_QUALITY_VALIDATION.md) for full validation documentation

---

## 🔧 Value Normalization

The `normalizeValue()` function ensures consistent comparison by handling edge cases:

| Field Type | Normalization |
|------------|---------------|
| `price` | Convert to float; treat 0 as null |
| `age_min`, `age_max` | Convert to integer; treat 0 as null |
| `date`, `start_date`, `end_date` | Extract YYYY-MM-DD (strip time component) |
| `time` | Trim and normalize whitespace |
| `description` | Trim; treat empty/whitespace as null |
| All fields | null, undefined, '' all treated as equivalent |

This prevents false "CHANGED" alerts from formatting differences.

---

## 💻 Code Implementation

### **File:** `src/lib/eventComparison.js`

**Main Function:**
```javascript
compareEvents(newEvents, existingEvents)
```

**Returns:**
```javascript
{
  new: [...],        // Events to insert
  changed: [...],    // Events to update
  deleted: [...],    // Events removed from source
  unchanged: [...]   // Events with no changes
}
```

**Changed Event Structure:**
```javascript
{
  existing: {...},      // Current database record
  incoming: {...},      // New data from sync
  _status: 'changed',
  _wasDeleted: false,   // True if restoring a soft-deleted event
  _changes: [           // List of what changed
    { field: 'title', old: 'Old Title', new: 'New Title' },
    { field: 'price', old: 25, new: 30 }
  ]
}
```

**Note:** If `_wasDeleted: true`, the event was previously soft-deleted and is being restored because it reappeared in the sync.

---

## 🎨 UI Display

### **Status Icons:**
- 🆕 **New** - Green badge (will be inserted)
- 🔄 **Changed** - Yellow badge (will be updated)
- ✓ **Unchanged** - Gray badge (no action)
- 🗑️ **Deleted** - Orange badge (in DB but not in source)

### **Summary Display:**
```
🆕 3 new events
🔄 2 changed events
⏭️ 5 unchanged
🗑️ 1 deleted (future event no longer in source)
```

**Note:** Past events that disappear from iClassPro are silently ignored (not counted as deleted).

---

## 🔧 How It's Used

### **In SyncModal:**
1. User syncs events
2. System fetches existing events from database
3. Compares new vs existing by `event_url`
4. Shows status for each event
5. On import:
   - Inserts new events
   - Updates changed events
   - Shows deleted events (for reference)

---

## 📝 Example Scenario

### **Database has:**
- Event A: `event_url: "portal.../2106"`, title: "KNO Nov 14", price: 35
- Event B: `event_url: "portal.../2107"`, title: "KNO Nov 15", price: 35

### **New sync has:**
- Event A: `event_url: "portal.../2106"`, title: "KNO Nov 14", price: **40** (changed!)
- Event C: `event_url: "portal.../2108"`, title: "KNO Nov 16", price: 35 (new!)

### **Result:**
- 🆕 **Event C** - New (insert)
- 🔄 **Event A** - Changed (price: 35 → 40, update)
- 🗑️ **Event B** - Deleted (not in new sync)

---

## 🎯 Key Benefits

✅ **Accurate Updates** - Only updates events that actually changed  
✅ **No Duplicates** - Uses URL as unique identifier  
✅ **Change Tracking** - Shows exactly what changed  
✅ **Deleted Detection** - Knows when events are removed from source  
✅ **Efficient** - Only processes what needs to change  

---

**Status:** ✅ Implemented and working

---

## 📜 VERSION HISTORY

| Date | Change |
|------|--------|
| Nov 2025 | Initial implementation |
| Dec 2025 | Added volatile field exclusion to prevent false "CHANGED" alerts |
| Dec 2025 | Added "future events only" logic for deleted detection |
| Dec 2025 | Added `_wasDeleted` flag for restored events |
| Feb 23, 2026 | Fixed cross-type false deletions during Sync All — comparison now filters existing events by checkedTypes |














