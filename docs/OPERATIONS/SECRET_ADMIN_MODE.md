# 🔐 ADMIN MODE - Complete Guide
## Three-Tier Access System + Full-Page Admin Dashboard

**Last Updated:** February 2, 2026
**Status:** ✅ Fully Implemented
**Files:** `src/components/AdminDashboard/AdminDashboard.js` + sub-components

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
**How to access:** **Shift+Click** the 🪄 wand icon in the stats table header
**What you see:**

A **full-page Admin Dashboard** replaces the calendar with **3 tabs**:

- ✅ **Audit & Review** (default tab) - See ALL validation errors across selected gyms, filter by category (DATA/FORMAT), month, program type, status (Active/Resolved). Dismiss errors or create permanent rules.
- ✅ **Gym Rules** - View, add, delete per-gym validation rules (price, time, program_synonym). Rules grouped by gym.
- ✅ **Quick Actions** - Automated Sync and JSON Import buttons. Super Admin tools require PIN.
- ✅ **"Back to Calendar"** button returns to normal view

**Where is the wand?**
- In the stats table header row, there's a small 🪄 icon
- **Shift+Click** it to open the Admin Dashboard
- Regular click does nothing — protects against accidental access

---

### 🔒 **Level 3: Super Admin (Jayme Only)**

**Who:** Only you
**How to access:** Inside the Admin Dashboard:
1. Click the 🔐 lock icon (top right of header), OR press the `*` key
2. Enter PIN: `1426`
3. Click "Unlock"

**What you see:**

Everything from Level 2, PLUS (in the Quick Actions tab):
- ✅ **Supabase Dashboard Link** - Direct access to database editor
- ✅ **Railway Dashboard Link** - Direct access to API server
- ✅ **Audit History** - See all changes made to events
- ✅ **Automated Sync** button - Opens the SyncModal
- ✅ **JSON Import** button - Opens the BulkImportModal

**Why is this hidden?**
- These links give FULL access to your infrastructure
- If someone got these links, they could modify or delete everything
- Only YOU should ever access these

---

## 🎮 HOW TO USE EACH LEVEL

### Accessing Level 2 (Admin Dashboard)

```
Step 1: Go to your calendar
Step 2: Find the 🪄 wand icon in the stats table header
Step 3: Hold Shift and click the wand
Step 4: Full-page Admin Dashboard opens (replaces calendar)
Step 5: Use tabs: Audit & Review | Gym Rules | Quick Actions
Step 6: Click "Back to Calendar" when done
```

---

### Accessing Level 3 (Super Admin)

```
Step 1: Open Admin Dashboard (Shift+Click 🪄 wand)
Step 2: Look for the 🔐 lock icon (top right of the dashboard header)
Step 3: Either:
   - Click the 🔐 lock icon, OR
   - Press: * (asterisk key)
Step 4: Enter PIN: 1426 in the popup
Step 5: Click "Unlock"
Step 6: Super Admin badge appears, Quick Actions tab unlocks all tools
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

### Level 2 (Admin Dashboard - Full Page)
```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Calendar │ 🪄 Admin Dashboard [Admin] 🔐    │
│  [Audit & Review] [Gym Rules] [Quick Actions]           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AUDIT & REVIEW TAB (default):                          │
│  ┌─ Gyms ──────────────────────────────────────────┐    │
│  │ [✓] All Gyms  [✓] CCP  [ ] CPF  [✓] EST  ...  │    │
│  └─────────────────────────────────────────────────┘    │
│  Month: [All▾]  Program: [All▾]  Status: [Active▾]     │
│  [ALL] [DATA (8)] [FORMAT (13)]                         │
│                                                         │
│  ── EST (3 events) ────────────────────────────         │
│  ┌ Camp | Spring Break | 2026-03-16 ──────────┐        │
│  │ 🚨 HIGH: Data Errors                       │        │
│  │   Camp Price Mismatch: $20 not in...  [✓OK] │        │
│  │ ⚠️ FORMAT: Missing/Incomplete Info          │        │
│  │   Flyer Only (no text)                      │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  GYM RULES TAB:                                         │
│  📋 All Gym Rules (12 rules)                            │
│  RBA | price | $20 = "Before Care"              [✕]     │
│  ALL | synonym | gym fun friday = "OPEN GYM"    [✕]     │
│  ➕ Add New Rule: [Gym▾] [Type▾] [Value] [Label] [+]   │
│                                                         │
│  QUICK ACTIONS TAB (Super Admin):                       │
│  [⚡ Automated Sync]  [🚀 JSON Import]                  │
│  [🗄️ Supabase] [🚂 Railway] [🔍 Audit History]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 TECHNICAL DETAILS (For AI/Developers)

### Code Location
**Main file:** `src/components/AdminDashboard/AdminDashboard.js`
**Sub-components:**
- `AdminAuditReview.js` — Audit & Review tab
- `AdminAuditFilters.js` — Filter bar (gym checkboxes, month, program, status, category)
- `AdminAuditErrorCard.js` — Single event error card
- `AdminGymRules.js` — Gym Rules tab
- `AdminQuickActions.js` — Quick Actions tab

### How Level 2 Access Works
```javascript
// In EventsDashboard.js — state-based view swap (no router)
if (showAdminPortal) {
  return <AdminDashboard gyms={gyms} onClose={() => setShowAdminPortal(false)} ... />;
}
// Normal calendar renders below...
```

The trigger is a Shift+Click on the 🪄 wand icon in the stats table header. This sets `showAdminPortal = true`, causing the full-page dashboard to render instead of the calendar.

### How Level 3 Access Works
```javascript
// In AdminDashboard.js
const [superAdminMode, setSuperAdminMode] = useState(false);
const SUPER_ADMIN_PIN = process.env.REACT_APP_ADMIN_PIN || '1426';

// * key shows PIN modal (or toggles off if already in super admin)
// Ignores keypresses in INPUT/TEXTAREA/SELECT elements
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '*') {
      if (superAdminMode) setSuperAdminMode(false);
      else { setShowPinModal(true); setPinInput(''); }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [superAdminMode]);
```

### State Management
- `superAdminMode` resets to `false` when dashboard closes
- User must re-enter PIN each time they open the admin dashboard
- Press `*` again to exit Super Admin mode
- This is intentional for security

### Admin Dashboard Tabs
| Tab | Component | When Visible |
|-----|-----------|-------------|
| Audit & Review | `AdminAuditReview` | Always (default tab) |
| Gym Rules | `AdminGymRules` | Always |
| Quick Actions | `AdminQuickActions` | Always (Super Admin tools hidden behind PIN) |

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
| AdminPortalModal (popup) | Feb 2, 2026 | Replaced with full-page AdminDashboard with tabs |
| Visible Admin button | Feb 2, 2026 | Replaced with Shift+Click wand (cleaner for public view) |
| Skill Clinic Link Editor | Dec 28, 2025 | Confusing placement; links already configured in Supabase `gym_links` table |
| Quick Add Event | Dec 18, 2025 | Automated Sync is the preferred method |
| Export Data (in Admin) | Dec 18, 2025 | Moved to main UI (visible to everyone) |

---

## ❓ FAQ

### **Q: Can I change the PIN?**
A: Yes! Set `REACT_APP_ADMIN_PIN` in your Vercel environment variables, or edit `AdminDashboard.js` directly. Default is `1426`.

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

## 📜 ACCESS METHOD

### Shift+Click Wand (Primary Method)
The 🪄 wand icon in the stats table header opens the full-page Admin Dashboard when **Shift+Clicked**.

**Location:** Stats table, in the header row
**How it works:** Shift+Click the small wand icon
**What happens:** Calendar view is replaced with full-page Admin Dashboard
**Return:** Click "Back to Calendar" button in the dashboard header

---

## 📚 RELATED DOCUMENTATION

| Document | Purpose |
|----------|---------|
| `AUTO-SYNC-GUIDE.md` | Automated sync workflow (Level 2 feature) |
| `F12-IMPORT-GUIDE.md` | Manual JSON import method (Level 2 feature) |
| `SYNC_PROGRESS_TRACKER.md` | Tracking sync status |
| `AUDIT-SYSTEM.md` | Audit History feature (Level 3 feature) |
| `DATA_QUALITY_VALIDATION.md` | Validation rules and dismiss flow (uses Gym Rules) |

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Feb 2, 2026 | **MAJOR** Replaced AdminPortalModal with full-page AdminDashboard (3 tabs) |
| Feb 2, 2026 | **NEW** Audit & Review tab — see all validation errors across gyms with filters |
| Feb 2, 2026 | **NEW** Gym Rules tab — view/add/delete per-gym validation rules |
| Feb 2, 2026 | **NEW** Quick Actions tab — Sync, Import, Super Admin tools |
| Feb 2, 2026 | **NEW** Multi-select gym checkboxes in Audit & Review (grid layout) |
| Feb 2, 2026 | **NEW** Status filter (Active Only / All / Resolved Only) |
| Feb 2, 2026 | **NEW** Category filter buttons (ALL / DATA / FORMAT) |
| Feb 2, 2026 | Added program synonym rule type + ALL (global) gym option |
| Feb 2, 2026 | Reverted to Shift+Click wand access (cleaner public view) |
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



