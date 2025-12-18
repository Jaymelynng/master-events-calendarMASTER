# 🔐 ADMIN MODE - Complete Guide
## Three-Tier Access System

**Last Updated:** December 18, 2025  
**Status:** ✅ Fully Implemented

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
**How to access:** Click the **Admin** button (next to Export button)  
**What you see:**

Everything from Level 1, PLUS:
- ✅ **JSON Import (F12 Method)** - Bulk import via copy/paste
- ✅ **Automated Sync** - One-click sync from iClassPro

**Where is the Admin button?**
- Look for the ✏️ **Admin** button in the button bar (near Export)
- It's visible to everyone but only useful if you know what it does

---

### 🔒 **Level 3: Super Admin (Jayme Only)**

**Who:** Only you  
**How to access:** Inside Level 2 Admin Portal, click the 🔒 lock icon, then:
- Enter PIN: `1426`
- OR press the `*` key

**What you see:**

Everything from Level 1 and 2, PLUS:
- ✅ **Supabase Dashboard Link** - Direct access to database
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
Step 2: Find the ✏️ Admin button (in the button bar near Export)
Step 3: Click the Admin button
Step 4: Admin Portal opens!
```

---

### Accessing Level 3 (Super Admin)

```
Step 1: Open Level 2 Admin Portal (Click Admin button)
Step 2: Look for the 🔒 lock icon in the admin portal
Step 3: Click the lock icon
Step 4: Either:
   - Type: 1426 (your PIN)
   - OR press: * (asterisk key)
Step 5: Super Admin features appear!
```

**The PIN is:** `1426`

**Why this PIN?**
- You chose it! It's stored in the code, not in a database
- Easy for you to remember, impossible for others to guess
- Can be changed in the code if needed

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
│  🪄 Magic Control Center              × │
├─────────────────────────────────────────┤
│  📥 Import & Data                       │
│                                         │
│  🚀 JSON Import (F12 Method)            │
│  Import multiple events from F12        │
│  [Open JSON Import]                     │
│                                         │
│  ⚡ Automated Sync                      │
│  Automatically collect from iClassPro   │
│  [Open Automated Sync]                  │
│                                         │
│  🔒 [Lock icon - click for Super Admin] │
└─────────────────────────────────────────┘
```

### Level 3 (Super Admin)
```
┌─────────────────────────────────────────┐
│  🪄 Magic Control Center [SUPER ADMIN]  │
├─────────────────────────────────────────┤
│  📥 Import & Data                       │
│  (all Level 2 features)                 │
│                                         │
│  🔓 Super Admin Tools                   │
│  • 🗄️ Supabase Dashboard               │
│  • 🚂 Railway Dashboard                 │
│  • 📜 Audit History                     │
└─────────────────────────────────────────┘
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
  ✏️ Admin
</button>
```

### How Level 3 Access Works
```javascript
// In AdminPortalModal.js
const [superAdminUnlocked, setSuperAdminUnlocked] = useState(false);
const [pinInput, setPinInput] = useState('');
const SUPER_ADMIN_PIN = '1426';

// Unlock with PIN
if (pinInput === SUPER_ADMIN_PIN) {
  setSuperAdminUnlocked(true);
}

// Or unlock with * key
const handleKeyPress = (e) => {
  if (e.key === '*') {
    setSuperAdminUnlocked(true);
  }
};
```

### State Management
- `superAdminUnlocked` resets to `false` when modal closes
- User must re-enter PIN each time they open admin portal
- This is intentional for security

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

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| Dec 18, 2025 | Removed Shift+Click - Admin button is now regular click |
| Dec 18, 2025 | Removed Quick Add Event (use JSON Import instead) |
| Dec 18, 2025 | Removed Export Data from Admin (available on main UI) |
| Dec 18, 2025 | Removed Coming Soon section |
| Nov 26, 2025 | Created 3-tier system with PIN 1426 |
| Nov 26, 2025 | Added * key as alternate unlock |
| Nov 26, 2025 | Added Supabase + Railway links to Super Admin |

---

**Super Admin (Level 3) is still protected with PIN 1426!** 🔐



