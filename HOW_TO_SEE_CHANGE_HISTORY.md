# 🔍 HOW TO SEE EVENT CHANGE HISTORY

## ✅ GOOD NEWS: You Already Have This Feature!

The system **automatically tracks** every change to events:
- ✅ When events are **created** (new events added)
- ✅ When events are **updated** (price changes, time changes, date changes, etc.)
- ✅ When events are **deleted** (removed from system)

---

## 🚀 HOW TO ACCESS IT

### **Method 1: Through Admin Portal (Recommended)**

1. Click the **"🪄 Admin"** button at the top of the dashboard
2. Click the **🔐 lock icon** (or press `*` key on keyboard)
3. Enter PIN: **1426**
4. Click the **"🔍 Audit History"** button
5. View the last 100 changes!

---

### **Method 2: Hidden Shortcut (Quick Access)**

1. Find the date/time text below "✨ Master Events Calendar ✨" header
2. **Ctrl+Click** (or Cmd+Click on Mac) on it
3. Audit history modal opens directly!

---

## 📊 WHAT YOU'LL SEE

The audit history shows:

```
🔍 Event Change History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 CREATE - January 15, 2025 at 2:30 PM
   EST - Back Handspring Clinic (Jan 24, 2025)
   Added by: Bulk Import

🔄 UPDATE - January 15, 2025 at 3:45 PM
   RBA - Kids Night Out (Feb 10, 2025)
   Price changed: $25.00 → $30.00
   Time changed: 6:00 PM - 8:00 PM → 7:00 PM - 9:00 PM

🗑️ DELETE - January 16, 2025 at 10:15 AM
   CCP - Open Gym (Jan 20, 2025)
   Event was deleted from the system
```

---

## 📝 WHAT GETS TRACKED

### **CREATE Actions**
- When new events are imported
- Shows event title and date
- Shows who/what made the change (e.g., "Bulk Import")

### **UPDATE Actions**
Shows **old value → new value** for:
- Price changes
- Time changes
- Date changes
- Title changes
- Description changes
- Age range changes
- Any other field that changed

### **DELETE Actions**
- When events are soft-deleted (removed from system)
- Preserves event title and date for reference
- Shows when it was deleted

---

## 🎯 REAL-WORLD USE CASES

### **Use Case 1: "Did the sync actually work?"**
→ Check audit log to see what was added/changed

### **Use Case 2: "When did this price change?"**
→ Look for UPDATE entries with that event's title

### **Use Case 3: "Why is this event missing?"**
→ Check if it was deleted and when

### **Use Case 4: "What changed in the last week?"**
→ Scroll through recent entries (shows last 100)

---

## ⚠️ CURRENT LIMITATIONS

The audit history modal shows:
- ✅ Last **100 changes** (most recent)
- ✅ All actions (CREATE, UPDATE, DELETE)
- ✅ Old and new values
- ✅ When it happened

**It does NOT currently:**
- ❌ Filter by gym (shows all gyms)
- ❌ Filter by date range
- ❌ Filter by action type (CREATE only, UPDATE only, etc.)
- ❌ Search by event title
- ❌ Export to CSV

**Workaround:** For advanced filtering, use Supabase dashboard to query the `event_audit_log` table directly.

---

## 💡 TIPS

1. **Most recent first** - Newest changes appear at the top
2. **100 entry limit** - Shows last 100 changes for performance
3. **Full history in database** - Database may have more entries, modal just shows recent ones
4. **Automatic tracking** - No action needed, everything is logged automatically

---

## 🔧 WHERE THE DATA IS STORED

**Database Table:** `event_audit_log`

**Fields:**
- `event_id` - Which event changed
- `gym_id` - Which gym (e.g., "EST", "CCP")
- `action` - CREATE, UPDATE, or DELETE
- `field_changed` - Which field (e.g., "price", "time")
- `old_value` - Previous value
- `new_value` - New value
- `changed_by` - Who/what made the change
- `event_title` - Event title (for display)
- `event_date` - Event date (for display)
- `changed_at` - When it happened (timestamp)

---

## 🚀 WANT TO EXPORT AUDIT HISTORY?

Currently, audit history export is not built into the Export modal, but you can:

1. **Use Supabase Dashboard:**
   - Go to Admin Portal → Super Admin → Supabase
   - Query `event_audit_log` table
   - Export results

2. **Request feature:** We could add "Audit History" to the Export modal if you want!

---

## 📚 MORE INFORMATION

For complete technical details, see: `docs/OPERATIONS/AUDIT-SYSTEM.md`

---

**Bottom Line:** Every change is tracked automatically. Just open Admin → Super Admin → Audit History to see it!

