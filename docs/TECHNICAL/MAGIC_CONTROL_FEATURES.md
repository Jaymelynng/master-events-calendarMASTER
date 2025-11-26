# 🪄 Magic Control Features Documentation
## Admin Power User Tools

**Last Updated:** November 26, 2025  
**Access:** Shift+Click the 🪄 Magic Control button  
**Status:** ✅ Production Ready - FULLY DEPLOYED

---

## 🎯 Overview

Magic Control is your **hidden admin portal** with power-user tools for managing events across all 10 gyms. It's accessed via a keyboard shortcut to keep the main UI clean for regular users.

**IMPORTANT:** This has been upgraded to a **3-tier access system** as of November 2025!

---

## 🔐 THREE-TIER ACCESS SYSTEM (NEW!)

| Level | Who | Access | Features |
|-------|-----|--------|----------|
| **Level 1** | Everyone | Visit URL | Calendar, event details, stats |
| **Level 2** | Admin (Jayme) | Shift + Click 🪄 | Quick Add, JSON Import, Automated Sync |
| **Level 3** | Super Admin (Jayme) | Inside Level 2, click 🔒 + PIN `1426` | Supabase link, Railway link, Audit History |

**Full documentation:** See `docs/OPERATIONS/SECRET_ADMIN_MODE.md`

---

## ✨ ICON LEGEND

| Icon | Name | Access Level | What It Does | How to Use |
|------|------|--------------|--------------|------------|
| 🪄 | **Magic Control** | **ADMIN ONLY** | Opens Magic Control Center (admin portal) | **Shift+Click** the small 🪄 button at top of dashboard |
| ✨ | **Quick Access** | **EVERYONE** | Opens all event pages for a specific gym | **Click** the ✨ sparkle next to gym names in the table |

### **Why Two Different Icons?**

- **🪄 Wand** = Secret admin feature (requires Shift+Click)
- **✨ Sparkles** = Public quick-access tool (regular click)
- **This prevents confusion** - different icons = different functions!

---

## 🔓 How to Access Magic Control (Level 2)

**Keyboard Shortcut:**
```
Shift + Click on "🪄" button
```

**Location:** Top of the Events Dashboard

**Why Hidden?**
- Keeps main UI clean and simple
- Prevents accidental admin actions
- Professional presentation for demos
- Power users can access instantly

---

## 🎨 Level 2 Features (Admin)

### **1. ➕ Quick Add Event**

**What it does:**
- Opens the Add Event modal
- Single event creation
- Full form validation
- Instant database insert

**Use when:**
- Adding one-off events
- Manual event entry
- Quick corrections

---

### **2. 🚀 JSON Import (F12 Method)**

**What it does:**
- Opens bulk import wizard
- F12 JSON paste interface
- 20-50 events in seconds
- Smart duplicate prevention

**Process:**
1. Paste JSON from F12 network tab
2. Select gym
3. Convert to import format
4. Review validation
5. Import new events

**Documentation:** See `F12-IMPORT-GUIDE.md`

---

### **3. ⚡ Automated Sync** ⭐ MAIN FEATURE!

**What it does:**
- One-click event collection from iClassPro portals
- Uses Playwright browser automation on Railway
- Collects: title, date, time, price, age, description
- Compares with database: NEW | CHANGED | DELETED | UNCHANGED
- Import with one click

**This is the crown jewel feature!**

**Documentation:** See `AUTO-SYNC-GUIDE.md`

---

### **4. 🔮 Coming Soon**

Planned features:
- 🗄️ Export Data
- 📊 Import Analytics
- 🧹 Data Cleanup Tools
- 💾 Backup & Restore

---

## 🔒 Level 3 Features (Super Admin)

**How to access:** Inside Level 2, click the 🔒 lock icon, then enter PIN `1426` or press `*`

### **1. 🗄️ Supabase Dashboard Link**

**What it does:**
- One-click access to Supabase dashboard
- Opens directly to your database
- Full database management

**URL:** `https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf`

---

### **2. 🚂 Railway Dashboard Link**

**What it does:**
- One-click access to Railway dashboard
- Manage your API server
- View logs, restart service

---

### **3. 📜 Audit History**

**What it does:**
- Shows database changes
- Tracks CREATE, UPDATE, DELETE
- Shows old value → new value

---

## 🎨 Design Specifications

### **Modal Layout (Level 2):**
```
┌─────────────────────────────────────────┐
│ 🪄 Magic Control Center              ×  │
├─────────────────────────────────────────┤
│                                          │
│  📥 Import & Data                       │
│                                          │
│  ➕ Quick Add Event                     │
│  Add a single event manually            │
│  [Add New Event]                        │
│                                          │
│  🚀 JSON Import (F12 Method)            │
│  Import multiple events from F12        │
│  [Open JSON Import]                     │
│                                          │
│  ⚡ Automated Sync                      │
│  Automatically collect from iClassPro   │
│  [Open Automated Sync]                  │
│                                          │
│  🔮 Coming Soon                         │
│  • Export Data                          │
│  • Import Analytics                     │
│                                          │
│  🔒 [Click for Super Admin access]      │
└─────────────────────────────────────────┘
```

### **Super Admin Unlocked:**
```
┌─────────────────────────────────────────┐
│ 🔓 Super Admin Tools                    │
│                                          │
│  🗄️ Supabase Dashboard                 │
│  🚂 Railway Dashboard                   │
│  📜 Audit History                       │
└─────────────────────────────────────────┘
```

---

## 🔐 Security Notes

### **Access Control:**
- **Level 1:** No authentication needed (public calendar)
- **Level 2:** Shift+Click required (obscurity)
- **Level 3:** PIN required (1426) or * key

### **Data Protection:**
- All changes logged in audit_log
- Can track who made changes
- Rollback possible via audit trail
- Database backup via Supabase

### **PIN Storage:**
- PIN is hardcoded in `AdminPortalModal.js`
- Change it by editing the code
- Not stored in database (yet)

---

## 📁 Code Location

**Main Component:** `src/components/EventsDashboard/AdminPortalModal.js`

**Key Code:**
```javascript
const SUPER_ADMIN_PIN = '1426';

// Unlock with PIN
if (pinInput === SUPER_ADMIN_PIN) {
  setSuperAdminUnlocked(true);
}

// Or unlock with * key
if (e.key === '*') {
  setSuperAdminUnlocked(true);
}
```

---

## 📚 Related Documentation

- **SECRET_ADMIN_MODE.md** - Complete 3-tier access guide
- **AUTO-SYNC-GUIDE.md** - Automated sync workflow
- **SYNC_PROGRESS_TRACKER.md** - Tracking sync status
- **F12-IMPORT-GUIDE.md** - Manual import method
- **TECHNICAL-REFERENCE.md** - Overall system architecture

---

## 📝 Change Log

| Date | Change |
|------|--------|
| Jan 2025 | Original Magic Control created |
| Nov 26, 2025 | Added 3-tier access system |
| Nov 26, 2025 | Added Automated Sync feature |
| Nov 26, 2025 | Added Super Admin with PIN 1426 |
| Nov 26, 2025 | Added Railway + Supabase links |

---

**This is your command center for managing all 10 gyms!** 🚀

