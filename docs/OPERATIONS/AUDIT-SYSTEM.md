# 🔍 Audit History System
## Complete Change Tracking for Events

**Last Updated:** November 26, 2025  
**Status:** ✅ Working  
**Location:** Super Admin (Level 3) access

---

## 🎯 OVERVIEW

The audit system automatically tracks ALL changes to events in the database:
- When events are created
- When events are updated
- When events are deleted

This provides complete accountability and the ability to see what changed and when.

---

## 🔓 HOW TO ACCESS

### **Method 1: Super Admin Portal**
1. **Shift + Click** the 🪄 Magic Wand button
2. Click the 🔒 **lock icon**
3. Enter PIN: **1426** (or press `*`)
4. Click **"📜 Audit History"**

### **Method 2: Ctrl+Click (Legacy)**
1. **Ctrl+Click** (or Cmd+Click on Mac) on the date/time below the main title
2. The audit history modal will open

---

## 📝 WHAT IT TRACKS

### **📝 CREATES (New Events)**
- When new events are imported
- Shows event title and date
- Tracks source (Bulk Import, Automated Sync, Manual Add)

### **🔄 UPDATES (Changed Events)**
- Price changes
- Time changes
- Date changes
- Title changes
- Description changes
- Age range changes
- Shows: **old value → new value** for each change

### **🗑️ DELETES (Removed Events)**
- When events are soft-deleted
- Preserves the event title and date for reference
- Records why (manual delete, sync detected removal, etc.)

---

## 📊 WHAT YOU SEE

### **Audit Log Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📜 Audit History                                        [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Nov 26, 2025 10:45 AM                                       │
│ 🔄 UPDATE - Estrella Gymnastics                             │
│ Event: Clinic | Backhandspring Saturday, December 13th      │
│ Changed: price "20" → "25"                                  │
│                                                             │
│ Nov 26, 2025 10:30 AM                                       │
│ 📝 CREATE - Capital Cedar Park                              │
│ Event: Kids Night Out | Ages 4-13 | December 5, 2025        │
│ Source: Automated Sync                                      │
│                                                             │
│ Nov 26, 2025 10:15 AM                                       │
│ 🗑️ DELETE - Oasis Gymnastics                               │
│ Event: Open Gym | November 20th (event passed)              │
│ Reason: Soft delete - event no longer on portal             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE STRUCTURE

### **Table: event_audit_log**
```sql
event_audit_log (
  id UUID PRIMARY KEY,
  event_id UUID,              -- Which event changed
  action TEXT,                -- CREATE, UPDATE, DELETE
  old_values JSONB,           -- Previous data (for updates)
  new_values JSONB,           -- New data
  changed_by TEXT,            -- Who made the change
  changed_at TIMESTAMP,       -- When it happened
  source TEXT                 -- Bulk Import, Automated Sync, Manual
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
→ Filter audit log by event, see price history

### **3. Investigate Issues**
"Why is this event missing?"
→ Check if it was deleted and when

### **4. Accountability**
"Who added these events?"
→ Audit log shows source of each change

---

## 📋 VIEWING OPTIONS

### **Filter by Action:**
- Show only CREATEs
- Show only UPDATEs
- Show only DELETEs

### **Filter by Gym:**
- Show changes for specific gym only

### **Filter by Date:**
- Show changes from last 24 hours
- Show changes from last week
- Show all history

### **Sort Order:**
- Most recent first (default)
- Oldest first

---

## 🛡️ DATA RETENTION

- **How long is data kept?** Indefinitely (until manually cleared)
- **How many records?** Currently 1,198+ audit entries
- **Storage impact:** Minimal (~1KB per entry)

---

## 🔧 TECHNICAL DETAILS

### **How It Works:**

1. **On Event Create:**
```javascript
await supabase.from('event_audit_log').insert({
  event_id: newEvent.id,
  action: 'CREATE',
  new_values: newEvent,
  changed_by: 'Automated Sync',
  source: 'sync'
});
```

2. **On Event Update:**
```javascript
await supabase.from('event_audit_log').insert({
  event_id: existingEvent.id,
  action: 'UPDATE',
  old_values: existingEvent,
  new_values: updatedEvent,
  changed_by: 'Automated Sync',
  source: 'sync'
});
```

3. **On Event Delete:**
```javascript
await supabase.from('event_audit_log').insert({
  event_id: deletedEvent.id,
  action: 'DELETE',
  old_values: deletedEvent,
  changed_by: 'Automated Sync',
  source: 'sync'
});
```

---

## ❓ FAQ

### **Q: Can I undo a change?**
A: Not automatically, but you can see the old values in the audit log and manually restore them.

### **Q: Does this slow down imports?**
A: No, audit logging is very fast (~1ms per entry).

### **Q: Can I clear the audit log?**
A: Yes, via Supabase dashboard, but this is not recommended.

### **Q: Who can see the audit log?**
A: Only Super Admin (Level 3) access.

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Oct 2025 | Initial audit system created |
| Nov 2025 | Moved to Super Admin access |
| Nov 2025 | Added source tracking |
| Nov 2025 | Added soft delete logging |

---

**Complete visibility into what's happening with your events!** 🎯

