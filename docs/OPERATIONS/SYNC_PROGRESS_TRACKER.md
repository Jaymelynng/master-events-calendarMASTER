# 📊 SYNC PROGRESS TRACKER - Complete Guide
## Never Lose Track of What You've Synced

**Last Updated:** December 28, 2025  
**Status:** ✅ Fully Implemented  
**Location:** `docs/OPERATIONS/SYNC_PROGRESS_TRACKER.md`

---

## 🎯 WHAT IS THE SYNC PROGRESS TRACKER?

The Sync Progress Tracker is a **visual grid** that shows you:
- Which gyms you've synced
- Which event types you've synced
- When you last synced each combination
- Whether events were found or not

**It solves this problem:** "Wait, did I already sync Oasis Kids Night Out? Where did I leave off?"

---

## 🖼️ WHAT IT LOOKS LIKE

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Sync Progress (40 logged)                        [Collapse] │
├──────────────┬─────────┬─────────┬─────────┬─────────┬─────────┤
│ Gym          │   KNO   │ CLINIC  │   OG    │  CAMP   │   SE    │
├──────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Cap Cedar Pk │ ✓ 41m   │ ✓ 38m   │ ✓ 41m   │ X Need  │ ✓ 40m   │
│ Cap Pfluger  │ ✓ 37m   │ ✓ 36m   │ ✓ 37m   │ X Need  │ ✓ 36m   │
│ Cap Round Rk │ ✓ 36m   │ ✓ 35m   │ ✓ 35m   │ X Need  │ ✓ 34m   │
│ Estrella     │ ✓ 1m    │ ✓ 1m    │ ✓ Just  │ X Need  │ ✓ 2m    │
│ Houston Acad │ ✓ 34m   │ ✓ 28m   │ ✓ 28m   │ X Need  │ ✓ 28m   │
│ Oasis        │ ✓ 27m   │ ✓ 27m   │ ✓ 27m   │ X Need  │ ✓ 2m    │
│ RB Atascocit │ ✓ 22m   │ ✓ 21m   │ ✓ 20m   │ X Need  │ ✓ 19m   │
│ RB Kingwood  │ ✓ 19m   │ ✓ 14m   │ ✓ 4m    │ X Need  │ ✓ 3m    │
│ Scottsdale   │ ✓ 3m    │ ✓ 3m    │ ✓ 3m    │ X Need  │ ✓ 3m    │
│ Tigar        │ ✓ Just  │ ✓ 2m    │ ✓ 2m    │ X Need  │ ✓ 2m    │
├──────────────┴─────────┴─────────┴─────────┴─────────┴─────────┤
│ 🟢 Synced (has events)  🟡 Synced (no events)  🔴 Needs sync   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 COLOR CODING

| Color | Meaning | What to Do |
|-------|---------|------------|
| 🟢 **Green** | Synced and events were found | Nothing - you're good! |
| 🟡 **Yellow** | Synced but no events scheduled | Nothing - gym just doesn't have that event type right now |
| 🔴 **Red/Pink** | Never synced OR needs re-sync | Click to sync this gym/program |

---

## ⏰ TIME DISPLAY

The tracker shows how long ago you synced:

| Display | Meaning |
|---------|---------|
| `Just now` | Less than 1 minute ago |
| `1m ago` | 1 minute ago |
| `5m ago` | 5 minutes ago |
| `2h ago` | 2 hours ago |
| `1d ago` | 1 day ago |
| `X Need` | Never synced |

---

## 📍 WHERE TO FIND IT

1. Click the **🪄 Admin** button (top of calendar, next to Export)
2. Click **"Open Automated Sync"**
3. The progress tracker is at the **TOP of the sync modal**
4. Click **[Collapse]** to hide it, **[Expand]** to show it

---

## 🔄 HOW IT WORKS

### When You Sync:
1. You click a gym and event type
2. System collects events from iClassPro
3. **Sync log is updated** with:
   - Gym ID
   - Event type
   - Timestamp
   - Number of events found
4. Progress tracker refreshes to show new status

### When You Import:
1. After successful import
2. **Sync log is updated** with:
   - Number of events imported
3. Grid reflects the completed sync

---

## 🗄️ DATABASE STRUCTURE

The sync progress is stored in a Supabase table called `sync_log`.

### Table: `sync_log`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Unique identifier |
| `gym_id` | TEXT | Which gym (CCP, EST, etc.) |
| `event_type` | TEXT | Which type (KIDS NIGHT OUT, CLINIC, etc.) |
| `last_synced` | TIMESTAMP | When the sync happened |
| `events_found` | INTEGER | How many events were collected |
| `events_imported` | INTEGER | How many were actually imported |

### Unique Constraint
Each gym + event_type combination can only have ONE row. When you sync again, it **updates** the existing row instead of creating a new one.

```sql
UNIQUE(gym_id, event_type)
```

---

## 🛠️ HOW TO CREATE THE TABLE

If the `sync_log` table doesn't exist, run this SQL in Supabase:

```sql
CREATE TABLE sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  events_found INTEGER DEFAULT 0,
  events_imported INTEGER DEFAULT 0,
  UNIQUE(gym_id, event_type)
);

-- Allow the app to read/write
GRANT ALL ON sync_log TO anon, authenticated;
```

---

## 🔧 TECHNICAL DETAILS (For AI/Developers)

### Frontend Code Location
**File:** `src/components/EventsDashboard/SyncModal.js`

### API Functions
**File:** `src/lib/api.js`

```javascript
export const syncLogApi = {
  // Get all sync records (ordered by most recent)
  async getAll() {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('last_synced', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  
  // Update or create sync record (upsert)
  async log(gymId, eventType, eventsFound, eventsImported = 0) {
    const { data, error } = await supabase
      .from('sync_log')
      .upsert({
        gym_id: gymId,
        event_type: eventType,
        last_synced: new Date().toISOString(),
        events_found: eventsFound,
        events_imported: eventsImported
      }, {
        onConflict: 'gym_id,event_type'
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // Get sync log for specific gym
  async getByGym(gymId) {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .eq('gym_id', gymId);
    if (error) throw new Error(error.message);
    return data || [];
  }
};
```

### When Sync Log Updates

1. **After collecting events** (even if 0 found):
```javascript
await syncLogApi.log(selectedGym, eventType, eventsFound, 0);
const updatedLog = await syncLogApi.getAll();
setSyncLog(updatedLog);
```

2. **After importing events**:
```javascript
await syncLogApi.log(gymId, eventType, eventsFound, eventsImported);
```

### Time Display Helper (in SyncModal.js)
```javascript
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
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

---

## 📋 WORKFLOW EXAMPLE

### Scenario: Monthly Sync of All Gyms

**Step 1:** Open Automated Sync modal
**Step 2:** Look at progress tracker - see what needs syncing (red cells)
**Step 3:** Start with first gym that needs sync
**Step 4:** Sync each event type for that gym
**Step 5:** Progress tracker updates in real-time as you go
**Step 6:** Move to next gym
**Step 7:** When all cells are green/yellow, you're done!

### If You Get Interrupted:
- Come back later
- Open the progress tracker
- See exactly where you left off (green = done, red = still need)
- Continue from there

---

## ❓ FAQ

### **Q: Why do some cells show yellow instead of green?**
A: Yellow means the gym doesn't have any events of that type scheduled right now. This is normal - not every gym has every event type every month.

### **Q: How often should I sync?**
A: Weekly is good. Daily if you want to catch changes quickly. The tracker helps you see what's stale.

### **Q: Can I see historical sync data?**
A: Currently, the table only stores the LAST sync for each gym/type. Historical tracking could be added in the future.

### **Q: What if I sync the same thing twice?**
A: No problem! The system compares events and only imports what's actually new or changed. The sync log just updates the timestamp.

### **Q: Does the tracker persist if I close the modal?**
A: Yes! The data is stored in Supabase. When you reopen the modal, it fetches the latest sync log.

---

## 🚀 FUTURE IMPROVEMENTS

Possible enhancements for the future:

1. **Stale indicator** - Turn yellow/red if sync is older than X days
2. ~~**One-click "Sync All"**~~ - ✅ **IMPLEMENTED** as "🚀 SYNC ALL PROGRAMS" button
3. **Email notifications** - Alert when sync hasn't happened in a while
4. **Historical tracking** - Keep history of all syncs, not just the latest

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Nov 26, 2025 | Created sync_log table |
| Nov 26, 2025 | Added progress tracker grid to SyncModal |
| Nov 26, 2025 | Color coding: green/yellow/red |
| Nov 26, 2025 | Time display: "Just now", "5m ago", etc. |
| Dec 2025 | Added "🚀 SYNC ALL PROGRAMS" one-click feature |
| Dec 28, 2025 | Documentation updated with correct API function names |

---

**Never lose track of your sync progress again!** 📊



