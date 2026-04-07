# ⚡ AUTOMATED SYNC GUIDE
## One-Click Event Collection from iClassPro

**Last Updated:** March 9, 2026
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

### Step 1: Open the Admin Dashboard

1. Go to your calendar
2. Find the 🪄 wand icon in the stats table header
3. **Shift+Click** it to open the full-page Admin Dashboard

### Step 2: Open Automated Sync

1. In the Admin Dashboard, click the **"Quick Actions"** tab
2. If prompted, enter Super Admin PIN (`1426`)
3. Click **"⚡ Automated Sync"** button
4. The Sync Modal opens

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
2. Call iClassPro public API directly (fast HTTP calls — no browser needed)
3. Collect event data from API responses
4. Return results to you

**Timing:**
- Single program: 5-15 seconds
- SYNC ALL: 20-40 seconds per gym (all program types)

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

1. **System calls iClassPro Direct API** to discover all booking categories for that gym
2. **Fetches event listings** for each category (KNO, Clinic, Camp types, etc.)
3. **Gets full details** for each event (dates, times, ages, description, openings)
4. **Combines and deduplicates** all events
5. **Returns summary** showing count by type

> **Note (Mar 2026):** The old system used Playwright (headless browser) and the `gym_links` table for URLs. The new Direct API method discovers categories automatically — no hardcoded URLs needed. Playwright is kept as a fallback (set `USE_DIRECT_API=false` on Railway to revert).

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
| **RESTORED** | URL exists but was soft-deleted, now back on portal | Restore event (clear deleted_at) and update data |
| **CHANGED** | URL exists, but data is different | Update existing event |
| **DELETED** | URL in database, not on portal, AND hasn't started yet | Soft-delete (set deleted_at timestamp) |
| **UNCHANGED** | URL exists, all fields match | Skip (no action) |

### Re-Adding Events (Restored Feature - Dec 28, 2025)

**Scenario:** A gym owner removes an event from their portal, then adds it back later.

**Old behavior (broken):** The event would show as "NEW" in the comparison, but importing did nothing because the URL already existed in the database (even though it was soft-deleted).

**New behavior (fixed):** When importing:
1. System checks if the URL exists as a soft-deleted event
2. If found, it **restores** the event (clears `deleted_at`)
3. It also **updates** the event with any new data from the portal
4. Event immediately appears on calendar and counts toward monthly requirements

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
- has_openings, registration dates, flyer fields, validation_errors, acknowledged_errors

**Per-Gym Validation Rules:**
- Some warnings are false positives (e.g., $20 Before Care pricing, 8:30am Early Dropoff)
- You can dismiss warnings as **one-time exceptions** or **permanent rules** per gym
- Permanent rules are stored in the unified `rules` table and checked during future syncs
- Validation now runs through `validation_engine.py` — system checks are database-driven
- Manage rules in: **Admin Dashboard → Gym Rules tab**
- Review all errors across gyms: **Admin Dashboard → Audit & Review tab**

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

1. Open Admin Dashboard (Shift+Click 🪄 wand)
2. Go to Quick Actions tab → Click "Automated Sync"
3. Look at progress tracker - see what needs syncing
4. Select first gym
5. Click **"🚀 SYNC ALL PROGRAMS"**
6. Wait 30-60 seconds
7. Review results and click **"Import"**
8. Click **"Sync Another Gym"**
9. Repeat for each gym
10. Done for the month!

**Time:** ~5 minutes for all 10 gyms with Direct API (was ~10 min with Playwright)

### Quick Update (Daily/Weekly)

1. Open Admin Dashboard (Shift+Click 🪄 wand)
2. Go to Quick Actions → Click "Automated Sync"
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

- Normal sync takes 5-30 seconds per gym (Direct API)
- If over 60 seconds, the iClassPro API might be slow — try again later
- If using Playwright fallback (USE_DIRECT_API=false), expect 3-5 minutes per gym

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

1. Check Railway logs for API errors (HTTP 4xx/5xx from iClassPro)
2. Verify the gym's slug is correct in `f12_collect_and_import.py` GYMS dict
3. If using Playwright fallback: Check `gym_links` table in Supabase for correct URLs
4. Try syncing a single program type to isolate which category fails

### "Special Events won't sync"

Special Events is only synced if the gym has a valid `special_events` URL configured in `gym_links`:
1. Check if the gym offers Special Events (not all do)
2. If they do, add the URL to `gym_links` table with `link_type_id = 'special_events'`
3. Only a few gyms use this category sporadically

**Note:** If a gym rarely uses Special Events, it's fine to skip syncing this category. The events can be added manually if needed.

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

### Phase 2: Visible Admin Button (Dec 2025 - Feb 2026)

**What it was:**
- A visible **"🪄 Admin"** button at top of dashboard
- Opened an AdminPortalModal popup

**Status:** Replaced by full-page Admin Dashboard

### Phase 2b: Full-Page Admin Dashboard (Current - Feb 2026)

**What changed:**
- Replaced AdminPortalModal popup with full-page AdminDashboard
- Shift+Click wand in stats header opens full-page dashboard
- 3 tabs: Audit & Review, Gym Rules, Quick Actions
- Audit & Review tab lets you see ALL validation errors across multiple gyms at once

**Why it changed:**
- Need to review validation errors across all gyms in one view
- Modal was too cramped for the audit workflow
- Full-page gives room for filters, multi-gym selection, error cards

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

### Bug Fixes Log

| Date | Bug | Fix |
|------|-----|-----|
| Dec 28, 2025 | Soft-deleted events couldn't be re-imported | Fixed `bulkImport` to detect soft-deleted events and restore them with updated data instead of skipping |
| Mar 9, 2026 | Sync took ~10 min for all 10 gyms (Playwright) | Replaced Playwright browser automation with Direct HTTP API calls to iClassPro. Same data, ~2x faster (~5 min total). No browser dependency. Playwright kept as fallback via `USE_DIRECT_API=false` env var. |

---

**End of Document**
