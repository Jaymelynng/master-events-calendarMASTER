# 🪄 Magic Control Features Documentation
## Admin Power User Tools

**Last Updated:** December 28, 2025  
**Access:** Click the ✏️ Admin button  
**Status:** ✅ Production Ready - FULLY DEPLOYED

---

## 🎯 Overview

Magic Control is your **admin portal** with power-user tools for managing events across all 10 gyms. It's accessed via the Admin button in the main UI.

**3-tier access system** as of November 2025!

---

## 🔐 THREE-TIER ACCESS SYSTEM

| Level | Who | Access | Features |
|-------|-----|--------|----------|
| **Level 1** | Everyone | Visit URL | Calendar, event details, stats, export, bulk actions |
| **Level 2** | Admin (Jayme) | Click ✏️ Admin button | JSON Import, Automated Sync |
| **Level 3** | Super Admin (Jayme) | Inside Level 2, click 🔒 + PIN `1426` | Supabase link, Railway link, Audit History |

**Full documentation:** See `docs/OPERATIONS/SECRET_ADMIN_MODE.md`

---

## ✨ ICON LEGEND

| Icon | Name | Access Level | What It Does | How to Use |
|------|------|--------------|--------------|------------|
| ✏️ | **Admin Button** | **EVERYONE (visible)** | Opens Magic Control Center (admin portal) | **Click** the Admin button |
| ✨ | **Quick Access** | **EVERYONE** | Opens all event pages for a specific gym | **Click** the ✨ sparkle next to gym names in the table |

---

## 🔓 How to Access Magic Control (Level 2)

**How:**
```
Click the ✏️ Admin button
```

**Location:** In the button bar, next to the Export button

---

## 🎨 Level 2 Features (Admin)

### **1. 🚀 JSON Import (F12 Method)**

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

### **2. ⚡ Automated Sync** ⭐ MAIN FEATURE!

**What it does:**
- One-click event collection from iClassPro portals
- Uses Playwright browser automation on Railway
- Collects: title, date, time, age, description
- Compares with database: NEW | CHANGED | DELETED | UNCHANGED
- Import with one click

**This is the crown jewel feature!**

**Documentation:** See `AUTO-SYNC-GUIDE.md`

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
│  🚀 JSON Import (F12 Method)            │
│  Import multiple events from F12        │
│  [Open JSON Import]                     │
│                                          │
│  ⚡ Automated Sync                      │
│  Automatically collect from iClassPro   │
│  [Open Automated Sync]                  │
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
- **Level 2:** Admin button visible to all (but harmless without knowledge)
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

## ❌ Removed Features

### **Skill Clinic Link Editor (Removed Dec 28, 2025)**
- **What it was:** A UI to manually edit a gym's Skill Clinic URL
- **Why removed:** Confusing placement in dashboard, not needed since links already configured in Supabase `gym_links` table
- **Alternative:** Edit links directly in Supabase if needed

### **Quick Add Event (Removed Dec 18, 2025)**
- **Why removed:** Automated Sync is the preferred method

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
| Dec 28, 2025 | Removed Skill Clinic Link Editor (not needed) |
| Dec 18, 2025 | Removed Shift+Click - Admin is now regular button |
| Dec 18, 2025 | Removed Quick Add Event |
| Dec 18, 2025 | Removed Coming Soon section |
| Dec 18, 2025 | Export moved to main UI (not in admin) |
| Nov 26, 2025 | Added 3-tier access system |
| Nov 26, 2025 | Added Automated Sync feature |
| Nov 26, 2025 | Added Super Admin with PIN 1426 |
| Nov 26, 2025 | Added Railway + Supabase links |
| Jan 2025 | Original Magic Control created |

---

**This is your command center for managing all 10 gyms!** 🚀

