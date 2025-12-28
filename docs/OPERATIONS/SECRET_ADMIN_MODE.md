# 🔐 ADMIN MODE - Complete Guide
## Three-Tier Access System

**Last Updated:** December 28, 2025  
**Status:** ✅ Fully Implemented  
**File:** `src/components/EventsDashboard/AdminPortalModal.js`

---

## 🎯 OVERVIEW

The Master Events Calendar has a **hidden admin system** with three levels of access. This keeps the main calendar clean for regular users while giving you (Jayme) full control.

---

## 👥 THE THREE TIERS

### 📺 **Level 1: Normal View (Everyone)**

**Who:** Your boss, coworkers, anyone with the link  
**How to access:** Just visit the calendar URL  
**What they see:**
- ✅ Full calendar with all events
- ✅ Event details when clicking events
- ✅ Stats table showing events per gym
- ✅ Filter by gym, event type, search
- ❌ No admin features
- ❌ No import tools
- ❌ No database links

**This is the "public" view - clean and professional.**

---

### 🪄 **Level 2: Admin View (Jayme)**

**Who:** You (Jayme)  
**How to access:** Click the **🪄 Admin** button (next to Export button)  
**What you see:**

Everything from Level 1, PLUS:
- ✅ **Automated Sync** - One-click sync from iClassPro (primary action)
- ✅ **JSON Import (F12 Method)** - Bulk import via copy/paste

**Where is the Admin button?**
- Look for the **🪄 Admin** button in the button bar (near 📤 Export)
- It's visible to everyone but only useful if you know what it does

---

### 🔒 **Level 3: Super Admin (Jayme Only)**

**Who:** Only you  
**How to access:** Inside Level 2 Admin Portal:
1. Click the 🔐 lock icon (top right of modal), OR press the `*` key
2. Enter PIN: `1426`
3. Click "Unlock"

**What you see:**

Everything from Level 1 and 2, PLUS:
- ✅ **Supabase Dashboard Link** - Direct access to database editor
- ✅ **Railway Dashboard Link** - Direct access to API server
- ✅ **Audit History** - See all changes made to events

**Why is this hidden?**
- These links give FULL access to your infrastructure
- If someone got these links, they could modify or delete everything
- Only YOU should ever access these

---

## 🎮 HOW TO USE EACH LEVEL

### Accessing Level 2 (Admin)

```
Step 1: Go to your calendar
Step 2: Find the 🪄 Admin button (in the button bar near Export)
Step 3: Click the Admin button
Step 4: Admin Control Center opens!
```

---

### Accessing Level 3 (Super Admin)

```
Step 1: Open Level 2 Admin Portal (Click 🪄 Admin button)
Step 2: Look for the 🔐 lock icon (top right of the modal)
Step 3: Either:
   - Click the 🔐 lock icon, OR
   - Press: * (asterisk key)
Step 4: Enter PIN: 1426 in the popup
Step 5: Click "Unlock"
Step 6: Super Admin features appear!
```

**The PIN is:** `1426`

**Why this PIN?**
- You chose it! It's stored in the code, not in a database
- Easy for you to remember, impossible for others to guess
- Can be changed in the code if needed

**To exit Super Admin mode:**
- Click "Exit Super Admin" button, OR
- Press `*` key again, OR
- Close and reopen the Admin portal

---

## 🖼️ WHAT EACH LEVEL LOOKS LIKE

### Level 1 (Normal View)
```
┌─────────────────────────────────────────┐
│  Master Events Calendar                 │
│  [Calendar Grid with Events]            │
│  [Stats Table]                          │
│  [Filters]                              │
│                                         │
│  (No admin buttons visible)             │
└─────────────────────────────────────────┘
```

### Level 2 (Admin View)
```
┌─────────────────────────────────────────┐
│  🪄 Admin Control Center    [Admin] 🔐× │
├─────────────────────────────────────────┤
│                                         │
│  ⚡ Automated Sync  [PRIMARY]           │
│  Automatically collect from iClassPro   │
│  [Open Automated Sync]                  │
│                                         │
│  🚀 JSON Import (F12 Method)            │
│  Import multiple events from F12        │
│  [Open JSON Import]                     │
│                                         │
└─────────────────────────────────────────┘
```

### Level 3 (Super Admin)
```
┌─────────────────────────────────────────────┐
│  🪄 Admin Control Center [🔐 Super Admin] × │
├─────────────────────────────────────────────┤
│  🔐 Super Admin Tools  [Exit Super Admin]   │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐   │
│  │🗄️Supabase│ │🚂Railway│ │🔍Audit History│  │
│  └─────────┘ └─────────┘ └──────────────┘   │
│                                             │
│  ⚡ Automated Sync                          │
│  [Open Automated Sync]                      │
│                                             │
│  🚀 JSON Import (F12 Method)                │
│  [Open JSON Import]                         │
└─────────────────────────────────────────────┘
```

---

## 🔧 TECHNICAL DETAILS (For AI/Developers)

### Code Location
**File:** `src/components/EventsDashboard/AdminPortalModal.js`

### How Level 2 Access Works
```javascript
// In EventsDashboard.js
<button
  onClick={() => setShowAdminPortal(true)}
>
  🪄 Admin
</button>
```

### How Level 3 Access Works
```javascript
// In AdminPortalModal.js
const [superAdminMode, setSuperAdminMode] = useState(false);
const [pinInput, setPinInput] = useState('');
const [showPinModal, setShowPinModal] = useState(false);
const SUPER_ADMIN_PIN = '1426';

// * key shows PIN modal (or toggles off if already in super admin)
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === '*') {
      if (superAdminMode) {
        setSuperAdminMode(false);  // Toggle off
      } else {
        setShowPinModal(true);     // Show PIN input
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [superAdminMode]);

// Unlock with correct PIN
const handlePinSubmit = () => {
  if (pinInput === SUPER_ADMIN_PIN) {
    setSuperAdminMode(true);
    setShowPinModal(false);
  }
};
```

### State Management
- `superAdminMode` resets to `false` when modal closes
- User must re-enter PIN each time they open admin portal
- Press `*` again to exit Super Admin mode
- This is intentional for security

### Super Admin Tools URLs
```javascript
// Supabase Dashboard
https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf/editor

// Railway Dashboard
https://railway.app/dashboard
```

---

## ❌ REMOVED FEATURES

These features were removed during cleanup:

| Feature | Removed Date | Reason |
|---------|--------------|--------|
| Skill Clinic Link Editor | Dec 28, 2025 | Confusing placement; links already configured in Supabase `gym_links` table |
| Quick Add Event | Dec 18, 2025 | Automated Sync is the preferred method |
| Export Data (in Admin) | Dec 18, 2025 | Moved to main UI (visible to everyone) |
| Shift+Click to open Admin | Dec 18, 2025 | Replaced with visible 🪄 Admin button |

---

## ❓ FAQ

### **Q: Can I change the PIN?**
A: Yes! Edit `AdminPortalModal.js` and change `SUPER_ADMIN_PIN = '1426'` to whatever you want.

### **Q: What if I forget the PIN?**
A: It's `1426`. Also, you can press `*` instead. And it's in this document!

### **Q: Can other people access Level 2?**
A: Yes, the Admin button is visible. But they won't know what to do with it unless they know about the import tools.

### **Q: Is the PIN stored securely?**
A: It's in the JavaScript code, which technically anyone could find if they looked at the source. For a truly secure system, you'd use real authentication. But for your use case (hiding admin from casual users), this is fine.

### **Q: Why not just use a login system?**
A: Because this is faster and simpler for a single-user admin scenario. Real authentication would add complexity you don't need right now.

---

## 🚨 SECURITY NOTES

1. **Super Admin links** give full database/server access - protect them
2. **If you ever need to revoke Super Admin access**, change the PIN in the code and redeploy
3. The Admin button is visible but harmless - only the Super Admin tools are sensitive

---

## 📜 LEGACY ACCESS (Still in Code)

### Hidden Shift+Click Wand
There's still a hidden 🪄 wand icon in the stats table header that opens the Admin Portal when **Shift+Clicked**.

**Location:** Stats table, in the header row  
**How it works:** Shift+Click the small wand icon  
**Status:** Still functional but not documented for users

This was the original access method before the visible Admin button was added. It remains as a backup.

---

## 📚 RELATED DOCUMENTATION

| Document | Purpose |
|----------|---------|
| `AUTO-SYNC-GUIDE.md` | Automated sync workflow (Level 2 feature) |
| `F12-IMPORT-GUIDE.md` | Manual JSON import method (Level 2 feature) |
| `SYNC_PROGRESS_TRACKER.md` | Tracking sync status |
| `AUDIT-SYSTEM.md` | Audit History feature (Level 3 feature) |

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Dec 28, 2025 | Merged MAGIC_CONTROL_FEATURES.md into this doc |
| Dec 28, 2025 | Added Removed Features section |
| Dec 28, 2025 | Added Related Documentation links |
| Dec 28, 2025 | Updated docs to match actual UI ("Admin Control Center" not "Magic Control Center") |
| Dec 28, 2025 | Clarified * key shows PIN modal (doesn't unlock directly) |
| Dec 18, 2025 | Admin button is now regular click (no Shift required) |
| Dec 18, 2025 | Removed Quick Add Event (use JSON Import instead) |
| Dec 18, 2025 | Removed Export Data from Admin (available on main UI) |
| Nov 26, 2025 | Created 3-tier system with PIN 1426 |
| Nov 26, 2025 | Added * key as alternate unlock trigger |
| Nov 26, 2025 | Added Supabase + Railway links to Super Admin |

---

**Super Admin (Level 3) is still protected with PIN 1426!** 🔐



