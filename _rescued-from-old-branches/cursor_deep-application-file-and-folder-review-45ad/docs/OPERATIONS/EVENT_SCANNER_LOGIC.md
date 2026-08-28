# 🔍 Event Scanner Logic - Complete Documentation

**Created:** November 5, 2025  
**Purpose:** Define exact rules for detecting NEW vs CHANGED events  
**Status:** Active specification for scanner development

---

## 🎯 **CORE PURPOSE**

The Event Scanner is a **prescreening tool** that reduces F12 import time from 40 operations (10 gyms × 4 categories) to only the gyms with actual changes.

**Time Savings:** 
- Without scanner: 20 minutes (all gyms, all categories)
- With scanner: 5-10 minutes (only gyms with changes)
- **50% faster!**

---

## 📊 **HOW THE SCANNER WORKS**

### **Input:**
User pastes text copied from gym event pages (Ctrl+A, Ctrl+C)

### **Process:**
1. Load ALL events from Supabase database
2. **Filter to FUTURE events only** (ignore past events)
3. Parse pasted text to extract: Title, Date, Time
4. Compare text events to database events
5. Classify as: NEW, CHANGED, or MATCHING

### **Output:**
```
✅ NEW EVENTS: 5 events (need F12 import)
   → CRR: 2 events
   → EST: 3 events

⚠️ CHANGED EVENTS: 2 events (need manual update)
   → TIG: 1 event
   → HGA: 1 event
   
✅ ALL OTHER GYMS: No changes
```

---

## 🆕 **NEW EVENT RULES**

### **Definition:**
An event that **does not exist anywhere** in the database.

### **Detection Logic:**
```
Check 1: Is there an event with this EXACT date + time?
  → NO

Check 2: Is there an event with SIMILAR title (80%+ match)?
  → NO
  
RESULT: NEW EVENT
```

### **Examples:**

#### **Example 1: Completely New Clinic**
```
PASTED TEXT:
  "Roundoff/ Backbend Clinic | Clinic | Ages 5+ | December 12th"
  Date: 2025-12-12
  Time: 6:30 PM - 7:30 PM

DATABASE:
  No event on Dec 12 at 6:30 PM ❌
  No "Roundoff" clinic found anywhere ❌

RESULT: NEW EVENT
ACTION: Do F12 import for CRR
```

#### **Example 2: New KNO Event**
```
PASTED TEXT:
  "Kids Night Out | Ages 4+ | December 5th"
  Date: 2025-12-05
  Time: 6:30 PM - 9:30 PM

DATABASE:
  No event on Dec 5 at 6:30 PM ❌
  
RESULT: NEW EVENT
ACTION: Do F12 import for CRR
```

### **Why This is "NEW":**
- Database has NO event on that date + time
- Cannot be a "change" because there's nothing to change FROM
- Must be imported via F12

---

## 📝 **CHANGED EVENT RULES**

### **Definition:**
An event that **exists in database** but has **different details** on the website.

### **Detection Logic:**
```
Check 1: Find event(s) with SIMILAR title (80%+ match)
  → YES (found match)

Check 2: Compare ALL THREE fields:
  - Title
  - Date
  - Time
  
Check 3: If ANY field is different → CHANGED EVENT
```

### **Matching Strategy:**
To find the "same event" even if details changed, match by:
1. **Primary:** Title similarity (fuzzy match, 80%+)
2. **Secondary:** Date + Time (if title changed completely)

---

## 📝 **CHANGED EVENT SCENARIOS**

### **Scenario 1: Date Changed (Title + Time Same)**
```
WEBSITE TEXT:
  "Pullover Clinic | Ages 6+ | Friday, November 14, 2025 | 6:15pm-7:15pm"
  Title: "Pullover Clinic | Ages 6+ | Friday, November 14, 2025 | 6:15pm-7:15pm"
  Date: 2025-11-14
  Time: 6:15 PM - 7:15 PM

YOUR DATABASE:
  Title: "Pullover Clinic | Ages 6+ | Friday, November 21, 2025 | 6:15pm-7:15pm"
  Date: 2025-11-21  ← DIFFERENT!
  Time: 6:15 PM - 7:15 PM

MATCH: Title starts with "Pullover Clinic" (80%+ match)
DIFFERENCE: Date (Nov 14 vs Nov 21)

RESULT: CHANGED EVENT - Date moved from Nov 21 → Nov 14
ACTION: Manually edit event in calendar to change date
```

---

### **Scenario 2: Time Changed (Title + Date Same)**
```
WEBSITE TEXT:
  "Kids Night Out | Ages 4-13 | November 7, 2025 | 6:00-9:00 pm"
  Title: "Kids Night Out | Ages 4-13 | November 7, 2025 | 6:00-9:00 pm"
  Date: 2025-11-07
  Time: 6:00 PM - 9:00 PM

YOUR DATABASE:
  Title: "Kids Night Out | Ages 4-13 | November 7, 2025 | 6:30-9:30 pm"
  Date: 2025-11-07
  Time: 6:30 PM - 9:30 PM  ← DIFFERENT!

MATCH: Title + Date match
DIFFERENCE: Time (6:00-9:00 vs 6:30-9:30)

RESULT: CHANGED EVENT - Time changed
ACTION: Manually edit event in calendar to change time
```

---

### **Scenario 3: Title Changed (Date + Time Same)**
```
WEBSITE TEXT:
  "K-POP KARAOKE | Kids Night Out | Ages 4-13 | November 14th"
  Title: "K-POP KARAOKE | Kids Night Out | Ages 4-13 | November 14th"
  Date: 2025-11-14
  Time: 7:00 PM - 9:30 PM

YOUR DATABASE:
  Title: "Slime Night | Kids Night Out | Ages 4-13 | November 14th"  ← DIFFERENT!
  Date: 2025-11-14
  Time: 7:00 PM - 9:30 PM

MATCH: Same gym + date + time
DIFFERENCE: Title changed completely

RESULT: CHANGED EVENT - Title updated
ACTION: Manually edit event to update title
```

---

### **Scenario 4: Multiple Changes (Date + Time Changed)**
```
WEBSITE TEXT:
  "Advanced Tumbling Clinic | Thursday, November 20th | 6:30p - 7:30p"
  Title: "Advanced Tumbling Clinic | Thursday, November 20th | 6:30p - 7:30p"
  Date: 2025-11-20
  Time: 6:30 PM - 7:30 PM

YOUR DATABASE:
  Title: "Advanced Tumbling Clinic | Friday, November 21st | 6:30p - 7:30p"
  Date: 2025-11-21  ← DIFFERENT!
  Time: 6:30 PM - 7:30 PM (same in this case)

MATCH: Title contains "Advanced Tumbling Clinic"
DIFFERENCE: Date (Nov 20 vs Nov 21)

NOTE: Title includes the date, so title also appears different!

RESULT: CHANGED EVENT - Event rescheduled
ACTION: Manually edit to change date
```

---

## 🔍 **MATCHING STRATEGY**

### **How Scanner Finds "The Same Event":**

#### **Method 1: Title Similarity (Primary)**
```
1. Extract first 20-30 characters of title (core name)
2. Compare with database titles
3. If 80%+ match → Found the same event!

Example:
  Text: "Pullover Clinic | Ages 6+ | Friday, November 14..."
  DB:   "Pullover Clinic | Ages 6+ | Friday, November 21..."
  
  Compare: "Pullover Clinic | Ages 6+" 
  → 95% match! ✅
```

#### **Method 2: Gym + Date + Time (Secondary)**
```
If title changed completely, fall back to:
  Same gym_id + same date + same time = same event

Example:
  Text: "K-POP Night | Nov 14 | 7:00 PM"
  DB:   "Slime Night | Nov 14 | 7:00 PM"
  
  Same gym (RBA) + same date + same time
  → Same event slot, different theme! ✅
```

---

## ⚠️ **EDGE CASES**

### **Edge Case 1: Gym Duplicates Same Event**
```
Database has:
  - "Kids Night Out | Nov 7 | 6:30 PM" (event_url: .../1194)
  - "Kids Night Out | Nov 7 | 6:30 PM" (event_url: .../1195) [duplicate!]

Scanner behavior:
  → Show as potential issue
  → "Multiple events match - check for duplicates"
```

### **Edge Case 2: Title Contains Date**
```
Many events have dates IN the title:
  "Pullover Clinic | Friday, November 14, 2025 | 6:15pm"

When date changes:
  Title also changes (Nov 14 → Nov 21 in title)
  
Scanner must:
  → Extract CORE title ("Pullover Clinic")
  → Match on core, ignore date within title
```

### **Edge Case 3: Time Format Variations**
```
Text might say: "6:30pm-9:30pm"
Database says: "6:30 PM - 9:30 PM"

Scanner must:
  → Normalize both (uppercase, add spaces)
  → Compare normalized versions
  → "6:30 PM - 9:30 PM" = "6:30 PM - 9:30 PM" ✅
```

### **Edge Case 4: Multi-Day Camps**
```
Text: "Thanksgiving Camp | Nov 24-26"
Database: 3 separate events (Nov 24, Nov 25, Nov 26)

Scanner behavior:
  → Match against FIRST day of camp
  → If first day matches, assume camp exists
  → Don't flag as "new" multiple times
```

---

## 🚫 **IGNORING PAST EVENTS**

### **Critical Rule: Only Compare FUTURE Events**

```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const futureEvents = allEvents.filter(event => {
  const eventDate = new Date(event.date);
  eventDate.setHours(0, 0, 0, 0);
  return eventDate >= today;
});
```

### **Why This Matters:**
```
Today: November 5, 2025

Events to compare:
  ✅ Nov 5 and later (future)
  ❌ Nov 4 and earlier (past - ignore!)

Example:
  "Boo Bash KNO | Nov 1" in database
  Not in pasted text (gym removed it)
  → Do NOT flag as "deleted" (it's past!)
```

**Past events are not "deleted" - they already happened!**

---

## 📤 **SCANNER OUTPUT SPECIFICATION**

### **Format 1: NEW EVENTS**
```
✅ NEW EVENTS (3 total) - Need F12 Import

Capital Round Rock (CRR):
  ✨ Roundoff/ Backbend Clinic | Dec 12 | 6:30-7:30 PM
  ✨ Kids Night Out | Dec 5 | 6:30-9:30 PM

Estrella Gymnastics (EST):
  ✨ Winter Blast Clinic | Dec 20 | 2:00-3:00 PM

ACTION: Do F12 import for CRR and EST only!
```

### **Format 2: CHANGED EVENTS**
```
⚠️ CHANGED EVENTS (2 total) - Need Manual Update

Tigar Gymnastics (TIG):
  📝 Advanced Tumbling Clinic
     DATABASE: Nov 21, 2025 | 6:30-7:30 PM
     WEBSITE:  Nov 20, 2025 | 6:30-7:30 PM
     CHANGE: Date moved (Nov 21 → Nov 20)

Houston Gymnastics (HGA):
  📝 Kids Night Out
     DATABASE: Nov 7 | 6:30-9:30 PM
     WEBSITE:  Nov 7 | 6:00-9:00 PM
     CHANGE: Time changed (6:30 start → 6:00 start)

ACTION: Click these events in calendar and manually update!
```

### **Format 3: All Clear**
```
✅ EVERYTHING MATCHES!

Scanned: 45 future events
Differences: 0
Status: Your database is 100% accurate!

No action needed - all gyms are current! 🎉
```

---

## 🎬 **USER WORKFLOW**

### **Step 1: Open Scanner**
```
Shift+Click 🪄 Magic Control → Click "🔍 Difference Detector"
```

### **Step 2: Copy Gym Text**
```
Open gym event pages (use bulk buttons)
For each page: Ctrl+A → Ctrl+C
Paste ALL text into scanner (all gyms, all categories together is fine!)
```

### **Step 3: Scan**
```
Click "🔍 Scan for Differences"
Wait 2-3 seconds
```

### **Step 4: Review Results**
```
Read the output:
  - NEW events? → Note which gyms
  - CHANGED events? → Note which specific events
  - All clear? → Done!
```

### **Step 5: Take Action**
```
For NEW events:
  → Do F12 import ONLY for those gyms
  
For CHANGED events:
  → Click event in calendar → Edit → Update details
```

---

## 🧪 **TESTING SCENARIOS**

### **Test 1: NEW Event Detection**
```
Action:
  1. Go to Supabase and DELETE "CRR - Roundoff Clinic | Dec 12"
  2. Copy CRR clinic text (includes Roundoff clinic)
  3. Paste into scanner and scan

Expected Result:
  ✅ 1 NEW EVENT FOUND
  CRR: Roundoff/ Backbend Clinic | Dec 12 | 6:30-7:30 PM
  
If this works → NEW detection is correct! ✅
```

### **Test 2: CHANGED Event Detection (Date)**
```
Action:
  1. Go to Supabase
  2. Edit TIG clinic date from Nov 20 → Nov 21
  3. Copy TIG clinic text (shows Nov 20)
  4. Paste into scanner and scan

Expected Result:
  ⚠️ 1 CHANGED EVENT FOUND
  TIG: Advanced Tumbling Clinic
  DATABASE: Nov 21
  WEBSITE: Nov 20
  CHANGE: Date moved
  
If this works → Date change detection is correct! ✅
```

### **Test 3: CHANGED Event Detection (Time)**
```
Action:
  1. Go to Supabase
  2. Edit HGA KNO time from 6:00-9:30 → 6:30-9:30
  3. Copy HGA KNO text (shows 6:00-9:30)
  4. Paste into scanner and scan

Expected Result:
  ⚠️ 1 CHANGED EVENT FOUND
  HGA: Turkey Tumble KNO
  DATABASE: 6:30 PM - 9:30 PM
  WEBSITE: 6:00 PM - 9:30 PM
  CHANGE: Time changed
  
If this works → Time change detection is correct! ✅
```

### **Test 4: Past Events Ignored**
```
Action:
  1. Paste text that includes past events (Nov 1-4)
  2. Scan

Expected Result:
  ✅ No warnings about Nov 1-4 events
  Past events completely ignored
  
If this works → Past event filtering is correct! ✅
```

---

## 🚨 **CRITICAL IMPLEMENTATION NOTES**

### **1. Always Filter to Future Events First**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0); // Set to midnight

const futureEvents = allEvents.filter(event => {
  const eventDate = new Date(event.date);
  eventDate.setHours(0, 0, 0, 0);
  return eventDate >= today;
});
```

**WHY:** Past events showing as "different" causes confusion!

---

### **2. Normalize EVERYTHING Before Comparing**
```javascript
const normalize = (str) => {
  if (!str) return '';
  return str.trim().toUpperCase().replace(/\s+/g, ' ');
};

// Compare:
normalize(dbTime) === normalize(textTime)
// "6:30 PM - 7:30 PM" = "6:30PM-7:30PM" ✅
```

**WHY:** Gyms format times inconsistently (spaces, capitalization)

---

### **3. Extract Core Title for Matching**
```javascript
// Extract core title (ignore date/age details)
const getCoreTitle = (title) => {
  // Get first part before dates/ages
  return title.split('|')[0].trim();
};

// Example:
getCoreTitle("Pullover Clinic | Ages 6+ | Friday, November 14, 2025")
// Returns: "Pullover Clinic"
```

**WHY:** Titles contain dates that change when event is rescheduled

---

### **4. Handle Missing Data Gracefully**
```javascript
// If time can't be parsed from text
if (!textTime) {
  // Match by title + date only
  // Don't fail the comparison
}
```

**WHY:** Some gym text formats might not have clear time data

---

## 🎯 **SUCCESS CRITERIA**

Scanner is working correctly if:

✅ **Detects NEW events** when gym adds something not in database
✅ **Detects CHANGED dates** when gym reschedules
✅ **Detects CHANGED times** when gym adjusts schedule
✅ **Detects CHANGED titles** when gym renames event
✅ **Ignores past events** (no false alarms about old events)
✅ **Shows zero differences** when everything matches
✅ **Completes scan in under 5 seconds**

---

## ❌ **WHAT SCANNER DOES NOT DO**

### **Does NOT Detect Deletions**
```
Why: Text only shows CURRENT events
If gym deleted an event, it's just not in the text
But could also mean: user didn't paste that category

Solution: Use F12 import to verify completeness
```

### **Does NOT Auto-Fix Changes**
```
Why: Changes need manual verification
Could be legitimate reschedule OR data error

Solution: Shows what changed, user decides action
```

### **Does NOT Handle Classes/Regular Programs**
```
Why: Scanner only compares camps/clinics/KNO/open gym
Regular classes are separate system

Solution: Scanner filters to event types only
```

---

## 💡 **FUTURE ENHANCEMENTS**

### **Phase 2 Improvements:**
1. **Confidence scoring** - Show % match confidence
2. **Gym isolation** - Scan one gym at a time
3. **Category filtering** - Only scan CLINIC or KNO
4. **Export results** - Download scan report as CSV
5. **Historical tracking** - Track how many changes per gym over time

---

## 📚 **RELATED DOCUMENTATION**

- **F12 Import Guide:** `docs/OPERATIONS/F12-IMPORT-GUIDE.md`
- **AI Verification Protocol:** `docs/OPERATIONS/AI_VERIFICATION_PROTOCOL.md`
- **Audit System:** `docs/OPERATIONS/AUDIT-SYSTEM.md`

---

**This scanner solves the REAL problem:**
- Quick prescreening (5 min vs 20 min)
- Catches gym changes (date/time moves)
- 100% data accuracy confidence
- Only work on gyms that actually changed!

---

**Last Updated:** November 5, 2025  
**Version:** 1.0 (Initial specification)  
**Status:** Ready for development
