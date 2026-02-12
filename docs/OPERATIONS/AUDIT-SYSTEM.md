# 🔍 Audit History System
## Complete Change Tracking for Events

**Last Updated:** February 2, 2026
**Status:** ✅ Working
**Location:** Admin Dashboard → Quick Actions (Super Admin PIN required) + Audit & Review tab for validation errors

---

## 🎯 OVERVIEW

The audit system automatically tracks ALL changes to events in the database:
- When events are created
- When events are updated
- When events are deleted

This provides complete accountability and the ability to see what changed and when.

---

## 🔓 HOW TO ACCESS

### **Method 1: Admin Dashboard → Quick Actions (Primary)**
1. **Shift+Click** the 🪄 wand icon in the stats table header
2. Click the **Quick Actions** tab
3. Click the **🔐 lock icon** (or press `*` key) and enter PIN: **1426**
4. Click **"🔍 Audit History"** button

### **Method 2: Audit & Review Tab (Validation Errors)**
For reviewing validation errors across gyms (not the change audit log):
1. **Shift+Click** the 🪄 wand icon
2. The **Audit & Review** tab (default) shows all validation errors
3. Select gyms via checkboxes, apply filters, dismiss or create rules

### **Method 3: Ctrl+Click (Legacy/Hidden)**
1. Find the date/time text below "✨ Master Events Calendar ✨" header
2. **Ctrl+Click** (or Cmd+Click on Mac) on it
3. The audit history modal will open directly

---

## 📝 WHAT IT TRACKS

### **📝 CREATES (New Events)**
- When new events are imported
- Shows event title and date
- Tracks who made the change (e.g., "Bulk Import")

### **🔄 UPDATES (Changed Events)**
- Price changes
- Time changes
- Date changes
- Title changes
- Description changes
- Age range changes
- Shows: **old value → new value** for each changed field

### **🗑️ DELETES (Removed Events)**
- When events are soft-deleted
- Preserves the event title and date for reference
- Shows "Event was deleted from the system"

---

## 📊 WHAT YOU SEE

### **Audit Log Display:**

The modal shows a scrollable list of changes, limited to the **100 most recent entries**.

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Event Change History                                 [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ December 28, 2025 10:45 AM                         [UPDATE] │
│ Clinic | Backhandspring Saturday, December 13th             │
│ EST • 2025-12-13                                            │
│ price: $20 → $25                                            │
│ Changed by: Bulk Import                                     │
│                                                             │
│ December 28, 2025 10:30 AM                         [CREATE] │
│ Kids Night Out | Ages 4-13 | December 5, 2025               │
│ CCP • 2025-12-05                                            │
│ Changed by: Bulk Import                                     │
│                                                             │
│ December 28, 2025 10:15 AM                         [DELETE] │
│ Open Gym | November 20th                                    │
│ OAS • 2025-11-20                                            │
│ Event was deleted from the system                           │
│ Changed by: Bulk Import                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Color Coding:**
- 🟢 **CREATE** - Green badge
- 🔵 **UPDATE** - Blue badge
- 🔴 **DELETE** - Red badge

---

## 🗄️ DATABASE STRUCTURE

### **Table: event_audit_log**
```sql
event_audit_log (
  id UUID PRIMARY KEY,
  event_id UUID,              -- Which event changed
  gym_id TEXT,                -- Which gym (e.g., "EST", "CCP")
  action TEXT,                -- CREATE, UPDATE, DELETE
  field_changed TEXT,         -- Which field changed (e.g., "price", "time", "all")
  old_value TEXT,             -- Previous value
  new_value TEXT,             -- New value
  changed_by TEXT,            -- Who made the change (e.g., "Bulk Import")
  event_title TEXT,           -- Title of the event (for display)
  event_date TEXT,            -- Date of the event (for display)
  changed_at TIMESTAMP        -- When it happened (auto-set)
)
```

---

## 🔄 AUTOMATIC DETECTION

### **During Import:**
The system automatically:
1. Detects which events are **new** (not in database)
2. Identifies events that have **changed** (data different)
3. Finds events that were **deleted** (no longer on portal)
4. Logs all changes to the audit table

### **Import Summary Display:**
```
IMPORT SUMMARY:
✅ New events to add: 5
🔄 Events to update: 3
🗑️ Events to soft-delete: 1
⏭️ Unchanged events skipped: 12
```

---

## 🔍 USE CASES

### **1. Verify Import Results**
"Did the import actually work?"
→ Check audit log to see exactly what was added/changed

### **2. Track Price Changes**
"When did this event's price change?"
→ Look for UPDATE entries with field_changed = "price"

### **3. Investigate Issues**
"Why is this event missing?"
→ Check if it was deleted and when

### **4. Accountability**
"Who added these events?"
→ Audit log shows source of each change

---

## 📋 ADMIN DASHBOARD: AUDIT & REVIEW TAB (NEW - Feb 2026)

The Admin Dashboard now includes an **Audit & Review** tab that provides a comprehensive view of all validation errors across gyms. This is separate from the Audit History (change log) described above.

### What It Does
- Shows all events with validation errors for selected gyms
- Multi-select gym checkboxes (grid layout) to review multiple gyms at once
- Error category filter: **ALL** / **DATA** (red, high severity) / **FORMAT** (orange, missing info)
- Status filter: **Active Only** / **All (Active + Resolved)** / **Resolved Only**
- Month and Program Type filters
- Each event shows its errors grouped by category with dismiss buttons
- **✓ OK** offers two choices: "This event only" (per-event) or "All [program] at [gym]" (program-wide pattern)
- **+ Rule** button creates a permanent rule in `gym_valid_values` (scoped by event type)
- Description issues (no description, flyer only) appear under FORMAT category

### Error Categories
| Category | Badge | Color | Examples |
|----------|-------|-------|----------|
| DATA | HIGH | Red | Date mismatch, skill mismatch, program type mismatch |
| FORMAT | FORMAT | Orange | Missing price, missing age, flyer only, no description |

### Files
- `src/components/AdminDashboard/AdminAuditReview.js` — Main tab component
- `src/components/AdminDashboard/AdminAuditFilters.js` — Filter bar
- `src/components/AdminDashboard/AdminAuditErrorCard.js` — Per-event error card

---

## 📋 CURRENT LIMITATIONS

The current audit modal is a **simple viewer** with these constraints:

| Feature | Status |
|---------|--------|
| View recent changes | ✅ Works (last 100 entries) |
| Filter by action type | ❌ Not implemented |
| Filter by gym | ❌ Not implemented |
| Filter by date range | ❌ Not implemented |
| Export audit log | ❌ Not implemented |
| Search by event title | ❌ Not implemented |

**Workaround:** For advanced filtering, use Supabase dashboard to query the `event_audit_log` table directly.

---

## 🛡️ DATA RETENTION

- **How long is data kept?** Indefinitely (until manually cleared)
- **How many records displayed?** 100 most recent (database may have more)
- **Storage impact:** Minimal (~1KB per entry)

---

## 🔧 TECHNICAL DETAILS

### **How It Works:**

The `logEventChange` function inserts audit records:

```javascript
const logEventChange = async (eventId, gymId, action, fieldChanged, oldValue, newValue, eventTitle, eventDate) => {
  await supabase
    .from('event_audit_log')
    .insert([{
      event_id: eventId,
      gym_id: gymId,
      action: action,           // 'CREATE', 'UPDATE', 'DELETE'
      field_changed: fieldChanged,
      old_value: oldValue,
      new_value: newValue,
      changed_by: 'Bulk Import',
      event_title: eventTitle,
      event_date: eventDate
    }]);
};
```

### **Loading Audit History:**

```javascript
const loadAuditHistory = async () => {
  const { data } = await supabase
    .from('event_audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(100);  // Only last 100 entries
  
  setAuditHistory(data || []);
};
```

---

## ❓ FAQ

### **Q: Can I undo a change?**
A: Not automatically, but you can see the old values in the audit log and manually restore them via Supabase.

### **Q: Does this slow down imports?**
A: No, audit logging is very fast (~1ms per entry).

### **Q: Can I clear the audit log?**
A: Yes, via Supabase dashboard, but this is not recommended - you lose history.

### **Q: Who can see the audit log?**
A: Only Super Admin (PIN 1426 required).

### **Q: Why only 100 entries?**
A: Performance - the full log could have thousands of entries. Use Supabase for full history.

---

## 📜 VERSION HISTORY & LESSONS LEARNED

### Phase 1: Ctrl+Click Access (Early Development)

**What it was:**
- Hidden feature - Ctrl+Click on date/time to open audit modal
- No filtering, just a list of changes

**Why it existed:**
- Quick debugging tool during development
- Didn't want it easily discoverable by casual users

**Status:** Still works as a hidden shortcut

### Phase 2: Super Admin Access (Current)

**What changed:**
- Added proper access through Admin Portal → Super Admin → Audit History button
- More discoverable for authorized users
- Still requires PIN for security

**Status:** ✅ Primary access method

### Potential Future Improvements

| Feature | Priority | Notes |
|---------|----------|-------|
| Filter by gym | Medium | Would help focus on specific gym issues |
| Filter by date range | Medium | "Show me last week's changes" |
| Filter by action type | Low | Show only DELETEs for troubleshooting |
| Export to CSV | Low | For compliance/reporting |
| Pagination | Low | For viewing more than 100 entries |

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Feb 2, 2026 | **NEW** Audit & Review tab in Admin Dashboard for validation error review |
| Feb 2, 2026 | Audit History moved to Admin Dashboard → Quick Actions (Super Admin) |
| Oct 2025 | Initial audit system created |
| Nov 2025 | Moved to Super Admin access |
| Nov 2025 | Added source tracking |
| Nov 2025 | Added soft delete logging |
| Dec 2025 | Updated documentation to match actual code |

---

**Complete visibility into what's happening with your events!** 🎯
