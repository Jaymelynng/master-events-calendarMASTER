# ⚡ AUTOMATED SYNC GUIDE
## One-Click Event Collection from iClassPro

**Last Updated:** November 26, 2025  
**Status:** ✅ FULLY WORKING - Verified against live data

---

## 🎯 WHAT IS AUTOMATED SYNC?

Automated Sync is the **main feature** of the Master Events Calendar. It lets you:

1. **Click a button** to collect events from iClassPro
2. **See what's new/changed/deleted** before importing
3. **Import with one click** - done!

**Time saved:** 5 hours/month → 20 minutes/month

---

## 🚀 HOW TO USE AUTOMATED SYNC

### Step 1: Open the Sync Modal

1. Go to your calendar (Vercel URL)
2. Find the 🪄 **Magic Wand** button (top of dashboard)
3. Hold **Shift** and **click** the wand
4. Click **"⚡ Automated Sync"**

### Step 2: Select a Gym

You'll see all 10 gyms:
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

### Step 3: Select an Event Type

After selecting a gym, you'll see event type buttons:
- 🎉 **Kids Night Out** (KNO)
- 🎯 **Clinic**
- 🏃 **Open Gym**
- 🏕️ **Camp**
- ⭐ **Special Events**

**Click the event type you want to sync.**

### Step 4: Wait for Collection

The system will:
1. Connect to Railway API server
2. Open iClassPro portal (via Playwright)
3. Capture event data from JSON responses
4. Return results to you

**This takes 10-30 seconds.** You'll see a loading indicator.

### Step 5: Review Results

After collection, you'll see:

| Category | What It Means |
|----------|---------------|
| **🆕 NEW** | Events not in your database - will be added |
| **🔄 CHANGED** | Events that exist but data is different - will be updated |
| **🗑️ DELETED** | Events in database but not on portal - will be soft-deleted |
| **✓ UNCHANGED** | Events that match exactly - will be skipped |

**Review the list to make sure it looks right.**

### Step 6: Import

If everything looks good:
1. Click **"Import X Events to Database"**
2. Wait for success message
3. Done! Calendar will refresh automatically.

### Step 7: Sync Another

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

## 📋 WHAT GETS COLLECTED

For each event, the system collects:

| Field | Source | Example |
|-------|--------|---------|
| **Title** | Event name | "Ninja Night Out \| Dec 5th" |
| **Date** | Event date | 2025-12-05 |
| **Time** | Start-End | "6:30 PM - 9:30 PM" |
| **Price** | iClass settings | "35" |
| **Age Min** | iClass settings | 4 |
| **Age Max** | iClass settings | 12 |
| **Description** | Event description | Full text (truncated at ~500 chars) |
| **Event URL** | Registration link | Direct link to event |

---

## 🔍 EVENT COMPARISON LOGIC

The system compares events by **event_url** (unique identifier).

### How It Decides:

| Scenario | Logic | Action |
|----------|-------|--------|
| **NEW** | URL not in database | Insert new event |
| **CHANGED** | URL exists, but title/date/time/price/age/description different | Update existing event |
| **DELETED** | URL in database, not on portal | Soft-delete (set deleted_at timestamp) |
| **UNCHANGED** | URL exists, all fields match | Skip (no action) |

### Fields Checked for Changes:
- title
- date
- time
- price
- age_min
- age_max
- description

**If ANY of these change, the event shows as "CHANGED."**

---

## 📭 NO EVENTS FOUND

If a gym doesn't have any events of that type scheduled:
- You'll see a **yellow notice** (not a red error)
- Message: "📭 This gym doesn't have any [type] events scheduled right now."
- This is normal! Not every gym has every event type every month.

**You'll still see "Sync Another Program" and "Sync Another Gym" buttons.**

---

## 🔄 RECOMMENDED WORKFLOW

### Monthly Full Sync (Recommended)

1. Open Automated Sync modal
2. Look at progress tracker - see what needs syncing (red cells)
3. Start with first gym
4. Sync each event type (KNO, Clinic, Open Gym, Camp, Special Events)
5. Use "Sync Another Program" to stay on same gym
6. When done with gym, use "Sync Another Gym"
7. Repeat until all cells are green/yellow
8. Done for the month!

**Time:** ~20-30 minutes for all 10 gyms

### Quick Update (Daily/Weekly)

1. Open Automated Sync modal
2. Look at progress tracker
3. Sync any gyms that look stale or that you know changed
4. Done!

**Time:** ~5 minutes

---

## ⚠️ TROUBLESHOOTING

### "API not responding"

1. Check if Railway is running: Visit `https://master-events-calendarmaster-production.up.railway.app/health`
2. If not healthy, check Railway dashboard
3. Wait a minute and try again

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

---

## 🎯 TIPS FOR SUCCESS

1. **Use the progress tracker** - It's there to help you not lose track
2. **Sync regularly** - Weekly keeps things fresh
3. **Review before importing** - Make sure the NEW/CHANGED list looks right
4. **Don't worry about "no events"** - Yellow is fine, it just means nothing scheduled
5. **Use "Sync Another" buttons** - Faster than closing and reopening

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
2. Check Vercel - is REACT_APP_API_URL correct?
3. Check Supabase - is data there?
4. Try the F12 method as backup (see F12-IMPORT-GUIDE.md)
5. Ask AI for help - share error messages and screenshots

---

**Happy Syncing!** ⚡



