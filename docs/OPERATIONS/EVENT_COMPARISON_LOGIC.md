# 🔍 Event Comparison Logic - New vs Changed vs Deleted

**Date:** November 14, 2025  
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
- **Action:** Mark as deleted or remove (your choice)

#### **✓ UNCHANGED Event**
- `event_url` exists in BOTH
- All data fields are the same
- **Action:** Skip (no changes needed)

---

## 📊 Fields Compared

When checking if an event changed, we compare:

- `title` - Event name
- `date` - Event date
- `start_date` - Multi-day start
- `end_date` - Multi-day end
- `time` - Time range
- `price` - Cost
- `type` - Event category
- `age_min` - Minimum age
- `age_max` - Maximum age

**Note:** `event_url` and `gym_id` are NOT compared (they're identifiers, not data)

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
  existing: {...},   // Current database record
  incoming: {...},   // New data from sync
  _status: 'changed',
  _changes: [        // List of what changed
    { field: 'title', old: 'Old Title', new: 'New Title' },
    { field: 'price', old: 25, new: 30 }
  ]
}
```

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
🗑️ 1 deleted (in DB but not in source)
```

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

**Last Updated:** November 14, 2025  
**Status:** Implemented and working















