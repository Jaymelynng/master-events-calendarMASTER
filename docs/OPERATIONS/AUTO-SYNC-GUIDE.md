# ⚡ AUTOMATED SYNC GUIDE
## One-Click Event Collection from iClassPro

**Last Updated:** December 28, 2025  
**Status:** ✅ FULLY WORKING - Verified against live data  
**New Feature:** 🚀 SYNC ALL PROGRAMS - One click syncs everything!

---

## 🎯 WHAT IS AUTOMATED SYNC?

Automated Sync is the **main feature** of the Master Events Calendar. It lets you:

1. **Click a button** to collect events from iClassPro
2. **See what's new/changed/deleted** before importing
3. **Import with one click** - done!

**Time saved:** 5 hours/month → 10 minutes/month (even faster with SYNC ALL!)

---

## 🚀 HOW TO USE AUTOMATED SYNC

### Step 1: Open the Admin Portal

1. Go to your calendar
2. Look for the **"🪄 Admin"** button at the top of the dashboard
3. Click it to open Admin Control Center

### Step 2: Open Automated Sync

1. In the Admin Control Center, you'll see the **"⚡ Automated Sync"** section
2. Click **"Open Automated Sync"**
3. The Sync Modal opens

### Step 3: Select a Gym

You'll see all 10 gyms as radio buttons:
- Capital Gymnastics Cedar Park (CCP)
- Capital Gymnastics Pflugerville (CPF)
- Capital Gymnastics Round Rock (CRR)
- Estrella Gymnastics (EST)
- Houston Gymnastics Academy (HGA)
- Oasis Gymnastics (OAS)
- Rowland Ballard Atascocita (RBA)
- Rowland Ballard Kingwood (RBK)
- Scottsdale Gymnastics (SGT)
- TIGAR Gymnastics (TIG)

**Click the gym you want to sync.**

### Step 4: Choose Sync Method

After selecting a gym, you have TWO options:

---

#### 🚀 OPTION A: SYNC ALL PROGRAMS (Recommended!)

One button syncs EVERYTHING for that gym:

1. Click the big purple **"🚀 SYNC ALL PROGRAMS"** button
2. Wait 30-60 seconds (it's syncing 5 program types!)
3. See results broken down by type
4. Import all at once

**What it syncs:**
- ✅ Kids Night Out (KNO)
- ✅ Clinic
- ✅ Open Gym
- ✅ Camp (ALL types: School Year Full/Half, Summer Full/Half)
- ✅ Special Events

**Best for:** Monthly full sync, getting everything at once

---

#### ⚡ OPTION B: Individual Program Sync

Click individual buttons to sync one type at a time:
- 🎉 **Kids Night Out** (KNO)
- 🎯 **Clinic**
- 🏃 **Open Gym**
- 🏕️ **Camp**
- ⭐ **Special Events**

**Best for:** Quick updates when you know only one thing changed

---

### Step 5: Wait for Collection

The system will:
1. Connect to Railway API server (with API key authentication)
2. Open iClassPro portal (via Playwright)
3. Capture event data from JSON responses
4. Return results to you

**Timing:**
- Single program: 10-30 seconds
- SYNC ALL: 30-60 seconds (syncing multiple pages)

You'll see a loading indicator.

### Step 6: Review Results

After collection, you'll see:

| Category | What It Means |
|----------|---------------|
| **🆕 NEW** | Events not in your database - will be added |
| **🔄 CHANGED** | Events that exist but data is different - will be updated |
| **🗑️ DELETED** | Future events in database but not on portal - will be soft-deleted |
| **✓ UNCHANGED** | Events that match exactly - will be skipped |

**Review the list to make sure it looks right.**

**Note about DELETED:** Only future events that haven't started yet can be marked as deleted. Events that have already started are silently ignored (they're not "deleted", just running/completed).

### Step 7: Import

If everything looks good:
1. Click **"Import X Events to Database"**
2. Wait for success message
3. Done! Calendar will refresh automatically.

### Step 8: Sync Another

After import, you'll see two buttons:
- **"Sync Another Program"** - Keeps gym selected, choose new event type
- **"Sync Another Gym"** - Deselects gym, start fresh

**Use these to continue syncing without closing the modal.**

---

## 📊 SYNC PROGRESS TRACKER

At the top of the sync modal, you'll see a **progress grid** showing:
- All 10 gyms (rows)
- All 5 event types (columns)
- Color-coded status for each cell

### Color Meanings:

| Color | Meaning |
|-------|---------|
| 🟢 **Green** | Synced and events were found |
| 🟡 **Yellow** | Synced but no events scheduled |
| 🔴 **Red/Pink** | Never synced / needs sync |

### Time Display:

| Display | Meaning |
|---------|---------|
| `Just now` | Less than 1 minute ago |
| `5m ago` | 5 minutes ago |
| `2h ago` | 2 hours ago |
| `1d ago` | 1 day ago |
| `X Need` | Never synced |

**Use this to track where you left off!**

---

## 🚀 SYNC ALL PROGRAMS - DETAILED

### What Happens When You Click "SYNC ALL"

1. **System checks `gym_links` table** for all URLs configured for that gym
2. **Opens each iClassPro page** (KNO page, Clinic page, Camp pages, etc.)
3. **Collects events from each page**
4. **Combines and deduplicates** all events
5. **Returns summary** showing count by type

### Camp Syncing (Special!)

When syncing CAMP, the system automatically syncs ALL camp types:

| Camp Type | What It Includes |
|-----------|------------------|
| **School Year Full Day** | Holiday camps, no-school day camps |
| **School Year Half Day** | Morning-only camps (where offered) |
| **Summer Full Day** | Full week summer camps |
| **Summer Half Day** | Morning-only summer camps (where offered) |

**All camp types are stored as type "CAMP"** in the database, but each has its own unique registration URL.

### What Shows in Progress Tracker

After SYNC ALL completes:
- **All program types that were checked** get their timestamp updated
- Even if a type has 0 events, the timestamp updates (so you know you checked it)
- Types without URLs configured (gym doesn't offer that program) won't update

### Example Results

```
✅ Sync Successful!
🏢 Tigar Gymnastics • ⚡ ALL

Successfully collected 40 events across 3 program types
Found 40 events from source

CAMP: 36    KIDS NIGHT OUT: 2    OPEN GYM: 2
```

This means Tigar has:
- 36 camp events (summer + school year combined)
- 2 KNO events
- 2 Open Gym events
- No Clinic or Special Events (gym doesn't offer those)

---

## 📋 WHAT GETS COLLECTED

For each event, the system collects:

| Field | Source | Example |
|-------|--------|---------|
| **Title** | Event name | "Ninja Night Out \| Dec 5th" |
| **Date** | Event date | 2025-12-05 |
| **Time** | Start-End | "6:30 PM - 9:30 PM" |
| **Price** | iClass settings or title | "35" |
| **Age Min** | iClass settings | 4 |
| **Age Max** | iClass settings | 12 |
| **Description** | Event description | Full text (truncated at ~1500 chars) |
| **Event URL** | Registration link | Direct link to event |
| **Has Openings** | Availability status | true/false |

---

## 🔍 EVENT COMPARISON LOGIC

The system compares events by **event_url** (unique identifier).

### How It Decides:

| Scenario | Logic | Action |
|----------|-------|--------|
| **NEW** | URL not in database | Insert new event |
| **CHANGED** | URL exists, but data is different | Update existing event |
| **DELETED** | URL in database, not on portal, AND hasn't started yet | Soft-delete (set deleted_at timestamp) |
| **UNCHANGED** | URL exists, all fields match | Skip (no action) |

### Fields Checked for Changes:
- title
- date (and start_date, end_date)
- time
- price
- type
- age_min
- age_max
- description

**If ANY of these change, the event shows as "CHANGED."**

**NOT checked (to prevent false positives):**
- has_openings, registration dates, flyer fields, validation_errors

---

## 📭 NO EVENTS FOUND

If a gym doesn't have any events of that type scheduled:
- You'll see a **yellow notice** (not a red error)
- Message: "📭 This gym doesn't have any [type] events scheduled right now."
- This is normal! Not every gym has every event type every month.

**You'll still see "Sync Another Program" and "Sync Another Gym" buttons.**

---

## 🔄 RECOMMENDED WORKFLOW

### Monthly Full Sync (Recommended - Using SYNC ALL)

1. Open Admin Portal (click 🪄 Admin button)
2. Click "Open Automated Sync"
3. Look at progress tracker - see what needs syncing
4. Select first gym
5. Click **"🚀 SYNC ALL PROGRAMS"**
6. Wait 30-60 seconds
7. Review results and click **"Import"**
8. Click **"Sync Another Gym"**
9. Repeat for each gym
10. Done for the month!

**Time:** ~10-15 minutes for all 10 gyms (vs 30+ minutes the old way!)

### Quick Update (Daily/Weekly)

1. Open Admin Portal
2. Click "Open Automated Sync"
3. Look at progress tracker
4. Select gym that needs update
5. Either:
   - **SYNC ALL** if you want everything refreshed
   - **Individual button** if you know only one thing changed
6. Import and done!

**Time:** ~2-5 minutes

---

## ⚠️ TROUBLESHOOTING

### "API not responding"

1. Check if Railway is running: Visit `https://master-events-calendarmaster-production.up.railway.app/health`
2. If not healthy, check Railway dashboard
3. Wait a minute and try again

### "Invalid or missing API key"

1. Check that `REACT_APP_API_KEY` is set in Vercel environment variables
2. Check that `API_KEY` is set in Railway environment variables
3. Both values must match exactly

### "Sync takes forever"

- Normal sync takes 10-30 seconds
- If over 60 seconds, the portal might be slow
- Try again later

### "Events not showing after import"

1. Hard refresh (Ctrl+Shift+R)
2. Check Supabase to verify data saved
3. Make sure you're looking at the right month

### "Shows 'changed' but nothing looks different"

- The system checks ALL fields, including description
- A small change in description text counts as "changed"
- This is correct behavior

### "Sync shows events but import fails"

1. Check browser console (F12) for errors
2. Verify Railway is running
3. Check Supabase service key in Railway

### "No events collected but portal shows events"

1. Check `gym_links` table in Supabase
2. Verify the URL is configured and `is_active = true`
3. Make sure the URL is a valid iClassPro portal URL

---

## 🎯 TIPS FOR SUCCESS

1. **Use the progress tracker** - It's there to help you not lose track
2. **Sync regularly** - Weekly keeps things fresh
3. **Review before importing** - Make sure the NEW/CHANGED list looks right
4. **Don't worry about "no events"** - Yellow is fine, it just means nothing scheduled
5. **Use "Sync Another" buttons** - Faster than closing and reopening
6. **Allow pop-ups** - The bulk action buttons open multiple tabs

---

## 🏆 WHAT YOU ACCOMPLISHED

By using Automated Sync, you're:
- ✅ Saving 5 hours per month
- ✅ Getting 100% accurate data
- ✅ Pulling descriptions automatically
- ✅ Pulling ages from iClass settings
- ✅ Never missing new events
- ✅ Automatically detecting changes
- ✅ Keeping your calendar always up-to-date

**This is the main feature that makes the whole system valuable!**

---

## 📞 IF ALL ELSE FAILS

1. Check Railway dashboard - is service running?
2. Check Vercel - is REACT_APP_API_URL and REACT_APP_API_KEY correct?
3. Check Supabase - is data there?
4. Try the F12 method as backup (see F12-IMPORT-GUIDE.md)
5. Ask AI for help - share error messages and screenshots

---

**Happy Syncing!** ⚡

---

## 📜 VERSION HISTORY & LESSONS LEARNED

This section documents the evolution of the sync system - what was tried, what changed, and why. Useful for understanding decisions and potentially restoring features.

### Phase 1: Hidden Admin Access (Early Development)

**What it was:**
- A small 🪄 wand button in Calendar View
- Required **Shift + Click** to open Admin Portal
- Intentionally hidden so regular users wouldn't accidentally find it

**Why it existed:**
- Wanted admin features hidden from casual users
- Added a layer of "secrecy" to admin tools

**Status:** Still exists in code (lines ~2793-2803 in EventsDashboard.js) but rarely used

**Code snippet (for restoration):**
```javascript
<button
  onClick={(e) => {
    if (e.shiftKey) {
      setShowAdminPortal(true);
    }
  }}
  title="🔐 Jayme's Command Center"
>
  <span>🪄</span>
</button>
```

### Phase 2: Visible Admin Button (Current)

**What changed:**
- Added a visible **"🪄 Admin"** button at top of dashboard
- No shift-click required - just click it

**Why it changed:**
- Once automation was working reliably, hiding it felt unnecessary
- Faster access for daily use
- Still requires clicking into Admin Portal, then Automated Sync (2 steps = some protection)

**Status:** ✅ Current primary method

### Phase 3: Super Admin PIN (Added Later)

**What it is:**
- Press `*` key or click 🔐 icon in Admin Portal
- Enter PIN (1426) to unlock Super Admin mode
- Reveals dangerous tools (direct Supabase/Railway links, Audit History)

**Why it exists:**
- Separates "safe" admin tasks from "dangerous" ones
- Regular admin can sync events, but can't accidentally mess with database
- PIN protects destructive operations

**Status:** ✅ Active - provides security layer

### Lessons Learned

| Lesson | Context |
|--------|---------|
| **Hidden UI is annoying** | Shift+click was clever but slowed down daily use |
| **Two-layer access works** | Visible button → Admin Portal → Sync Modal is good balance |
| **PIN protection is worth it** | Super Admin features should stay behind PIN |
| **Document everything** | This section exists so future-you remembers why things changed |

### Features That Could Be Restored

If you ever want to bring back hidden access:
1. The shift+click wand code still exists in Calendar View
2. Could add keyboard shortcut (e.g., Ctrl+Shift+A for admin)
3. Could add URL parameter access (e.g., `?admin=true`)

### Features That Were Removed (Don't Bring Back)

| Feature | Why Removed |
|---------|-------------|
| *None documented yet* | Add here if you remove something for good reason |

---

**End of Document**
