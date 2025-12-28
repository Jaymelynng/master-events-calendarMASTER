# 🏕️ CAMP COMPLEXITY MASTER GUIDE
## Understanding How Different Gyms Structure Camp Data

**Created:** October 17, 2025  
**Purpose:** Permanent reference for camp data structure variations across all 10 gyms  
**Critical:** Read this BEFORE making ANY changes to camp import or display logic

---

## 🎯 EXECUTIVE SUMMARY (READ THIS FIRST)

### **The Core Problem:**
**6 out of 10 gyms** create separate iClassPro event listings for each camp option (Gymnastics vs Ninja, Full Day vs Half Day), resulting in 2-4 calendar events appearing for the SAME camp on the SAME dates.

### **Worst Case Example - Estrella Gymnastics:**
"Spring Break Camp" appears as **FOUR separate events**:
1. Girls Gymnastics Camp Full Day (9AM-3PM)
2. Girls Gymnastics Camp Half Day (9AM-12PM)  
3. Ninja Warrior Camp Full Day (9AM-3PM)
4. Ninja Warrior Camp Half Day (9AM-12PM)

**Same dates, same camp theme, but 4x the vertical space on calendar.**

### **The Affected Gyms:**
- **EST** (Estrella): 4 events per camp (2 activities × 2 durations)
- **CPF** (Pflugerville): 2 events per camp (Full + Half Day)
- **HGA** (Houston): 2 events per camp (Gym + Ninja)
- **OAS** (Oasis): 2 events per camp (Gym + Ninja)
- **SGT** (Scottsdale): 2 events per camp (Gym + Ninja)
- **TIG** (Tigar): 2 events per camp (Gym + Ninja)

### **What We Built:** ✅ IMPLEMENTED December 2025
Display-only consolidation that:
1. ✅ Groups ALL camps on same date + same gym into ONE calendar card
2. ✅ Preserves ALL unique registration URLs
3. ✅ Shows options in details panel (with "📝 Register for THIS Camp:" section)
4. ✅ Reduces visual clutter - shows "X options available" on calendar card
5. ✅ Detects activity (🤸 Gymnastics, 🥷 Ninja) and duration from actual titles

### **What We Can't Change:**
- Database structure (each option needs its own record)
- F12 import process (imports exactly what iClassPro provides)
- Registration URLs (each is unique and required)

### **⚠️ CRITICAL: THIS DATA CAN CHANGE AT ANY TIME**
**This document reflects camp structures as of October 17, 2025, but gyms can change their offerings at any time:**
- A gym offering only Full Day camps today might add Half Day tomorrow
- A gym with Gym+Ninja options might drop Ninja next season
- New gyms might be added with completely different structures
- Camp pricing, titles, and patterns can change month-to-month

**Any consolidation solution MUST be flexible enough to handle:**
- Gyms changing from 1 option to 4 options (or vice versa)
- New activity types appearing (Tumbling, Cheer, Dance camps)
- New duration types (Afternoon camps, Extended day, etc.)
- Completely new gyms with unknown patterns

**Don't hard-code anything based on this snapshot. Build detection logic that adapts to whatever the data contains.**

---

## 🚨 WHY THIS DOCUMENT EXISTS

**The Problem:** Camps are displayed and structured completely differently across gyms, creating massive complexity in how we import, store, and display them.

**Jayme's Frustration:** This has been explained multiple times, but without documentation, every new conversation starts from zero. This document ensures ANYONE (AI or human) can understand the full complexity without repeated explanations.

---

## 📊 THE CORE COMPLEXITY: TWO DIFFERENT DATA STRUCTURES

### **Method 1: Single Event ID for Entire Camp Week (MAJORITY)**
**Used By:** Most gyms (HGA, RBA, RBK, EST, OAS, SGT, TIG, CRR, CPF)

**How It Works:**
- iClassPro shows ONE event with ONE event ID for the entire camp week
- Example: "Fall Break Camp | Oct 13-17" = event ID 1234
- Timeline view shows a continuous block spanning multiple days
- **Single F12 import = 1 database record = displays across all camp days**

**Database Structure:**
```json
{
  "id": 1234,
  "title": "Fall Break Camp | Gymnastics | Oct 13-17",
  "date": "2025-10-13",
  "start_date": "2025-10-13",
  "end_date": "2025-10-17",
  "event_url": "https://portal.iclasspro.com/gymslug/camp-details/1234"
}
```

**Display Result:** ONE event card spans Monday-Friday on calendar

---

### **Method 2: Individual Event ID Per Day (CAPITAL CEDAR PARK)**
**Used By:** Capital Gymnastics Cedar Park (CCP) - possibly others

**How It Works:**
- iClassPro shows SEPARATE events for EACH DAY of the camp
- Example: "Fall Break Camp | Oct 13-17" has 5 DIFFERENT event IDs:
  - Monday Oct 13 = event ID 5001
  - Tuesday Oct 14 = event ID 5002
  - Wednesday Oct 15 = event ID 5003
  - Thursday Oct 16 = event ID 5004
  - Friday Oct 17 = event ID 5005
- **Single F12 import = 5 database records = 5 separate event cards**

**Database Structure:**
```json
[
  {
    "id": 5001,
    "title": "Fall Break Camp | Gymnastics | Oct 13-17",
    "date": "2025-10-13",
    "event_url": ".../camp-details/5001"
  },
  {
    "id": 5002,
    "title": "Fall Break Camp | Gymnastics | Oct 13-17",
    "date": "2025-10-14",
    "event_url": ".../camp-details/5002"
  },
  // ... 3 more records
]
```

**Display Result:** 5 SEPARATE event cards, one per day

---

## 🎯 CAMP DURATION VARIATIONS

### **Single Day Camps**
- Duration: 1 day only
- Examples: "Kids Night Out", some special event camps
- Event IDs: 1 (Method 1) or 1 (Method 2 - same result)

### **3-Day Camps**
- Duration: 3 consecutive days
- Examples: Holiday weekend camps
- Event IDs: 1 (Method 1) or 3 (Method 2)

### **5-Day School Year Camps**
- Duration: Full week (Monday-Friday)
- Examples: Fall Break, Spring Break camps
- Event IDs: 1 (Method 1) or 5 (Method 2)

### **Holiday/Break Camps**
- Duration: Varies (3-10+ days)
- Examples: Winter Break, Summer camps
- Event IDs: 1 (Method 1) or 1-per-day (Method 2)

---

## 🔀 OPTION VARIATIONS: THE MULTIPLICATION FACTOR

### **Option Type 1: Activity Type (Gymnastics vs Ninja)**
**Gyms That Offer:** Multiple (CCP, CPF, CRR, others)

**What This Means:**
- SAME camp, SAME dates, DIFFERENT activity focus
- Creates SEPARATE event IDs in iClassPro
- Example:
  - "Fall Break Camp | Gymnastics | Oct 13-17" = ID 1234
  - "Fall Break Camp | Ninja | Oct 13-17" = ID 1235

**Multiplication Factor:**
- Method 1 gym: 1 week = 2 events (Gymnastics + Ninja)
- Method 2 gym (CCP): 1 week = 10 events (5 days × 2 activities)

---

### **Option Type 2: Duration (Full Day vs Half Day)**
**Gyms That Offer:** Estrella (EST), Pflugerville (CPF), others

**What This Means:**
- SAME camp, SAME dates, DIFFERENT time duration
- Creates SEPARATE event IDs in iClassPro
- Example:
  - "Fall Break Camp | Full Day | Oct 13-17" = ID 1234
  - "Fall Break Camp | Half Day | Oct 13-17" = ID 1236

**Time Differences:**
- Full Day: 9:00 AM - 3:00 PM
- Half Day: 9:00 AM - 12:00 PM OR 12:00 PM - 3:00 PM

**Multiplication Factor:**
- Method 1 gym: 1 week = 2 events (Full + Half)
- Method 2 gym (CCP): 1 week = 10 events (5 days × 2 durations)

---

### **Option Type 3: COMBINED (Activity + Duration)**
**Gyms That Offer:** Multiple gyms

**The Worst Case Scenario:**
- Gymnastics Full Day
- Gymnastics Half Day
- Ninja Full Day
- Ninja Half Day

**Event Count:**
- Method 1 gym: 1 week = 4 events
- Method 2 gym (CCP): 1 week = 20 events (5 days × 4 options)

---

## 📋 ACTUAL DATA EXAMPLES FROM SUPABASE

### **Example 1: Simple Camp (1 option, Method 1)**
```
Title: "Fall Break Camp | Oct 13-17"
Dates: Oct 13-17
Event IDs: 1
Calendar Display: 1 event card spanning 5 days
```

### **Example 2: Gymnastics + Ninja (Method 1)**
```
Title Option 1: "Fall Break Camp | Gymnastics | Oct 13-17"
Title Option 2: "Fall Break Camp | Ninja | Oct 13-17"
Dates: Oct 13-17
Event IDs: 2 (one per activity)
Calendar Display: 2 event cards, each spanning 5 days
PROBLEM: Takes 2x vertical space on every day
```

### **Example 3: Full Day + Half Day (Method 1)**
```
Title Option 1: "Fall Break Camp | Full Day | Oct 13-17"
Title Option 2: "Fall Break Camp | Half Day | Oct 13-17"
Dates: Oct 13-17
Event IDs: 2 (one per duration)
Calendar Display: 2 event cards, each spanning 5 days
PROBLEM: Takes 2x vertical space on every day
```

### **Example 4: ALL COMBINATIONS (Method 1)**
```
1. "Fall Break Camp | Gymnastics Full Day | Oct 13-17"
2. "Fall Break Camp | Gymnastics Half Day | Oct 13-17"
3. "Fall Break Camp | Ninja Full Day | Oct 13-17"
4. "Fall Break Camp | Ninja Half Day | Oct 13-17"
Dates: Oct 13-17
Event IDs: 4
Calendar Display: 4 event cards, each spanning 5 days
PROBLEM: Takes 4x vertical space on EVERY DAY
```

### **Example 5: Cedar Park Method (Method 2 + Options)**
```
Fall Break Camp with Gymnastics + Ninja options at CCP:
- 5 days × 2 activities = 10 separate event IDs
- Each day shows 2 event cards (Gymnastics + Ninja)
- Each card has unique registration URL
Calendar Display: 10 total event cards across 5 days
PROBLEM: Visual clutter, confusing for managers
```

---

## 📊 CRITICAL SUMMARY: THE ACTUAL COMPLEXITY

Based on REAL data from iClassPro (pasted October 17, 2025), here's what we're actually dealing with:

### **Gyms That Need Consolidation (Display Problem):**
1. **EST** (Estrella) - 2 activities × 2 durations = 4 events per camp ⚠️⚠️⚠️ WORST
2. **CPF** (Pflugerville) - Full Day + Half Day = 2 events per camp ⚠️⚠️
3. **HGA** (Houston) - Gymnastics + Ninja = 2 events per camp ⚠️⚠️
4. **OAS** (Oasis) - Girls Gym + Co-ed Ninja = 2 events per camp ⚠️⚠️
5. **SGT** (Scottsdale) - Girls Gym + Parkour/Ninja = 2 events per camp ⚠️⚠️
6. **TIG** (Tigar) - Girls Gym + COED Ninja = 2 events per camp ⚠️⚠️

### **Gyms That DON'T Need Consolidation (No Problem):**
1. **CRR** (Round Rock) - Single event per camp ✅
2. **RBA** (Atascocita) - Combines Gym/Ninja in one registration ✅

### **Special Case:**
- **CCP** (Cedar Park) - Uses per-day event IDs (Method 2) but NO Gym/Ninja split, so consolidation would group by camp name across days

### **The Real Problem:**
**6 out of 10 gyms** show EVERY camp as MULTIPLE events:
- **Estrella:** Spring Break = 4 calendar events (Gym Full, Gym Half, Ninja Full, Ninja Half)
- **Pflugerville:** Spring Break = 2 calendar events (Full Day, Half Day)
- **Houston, Oasis, Scottsdale, Tigar:** Spring Break = 2 calendar events each (Gymnastics, Ninja)
- **Result:** Takes up 2-4x vertical space on EVERY camp day

### **The Solution Needed:**
Group events by:
- Same gym
- Same camp name/theme (before "Gymnastics" or "Ninja" keyword)
- Same date range
- Show as ONE card with hover revealing both registration options

---

## 🗂️ GYM-BY-GYM BREAKDOWN

### **Capital Gymnastics Cedar Park (CCP)** ✅ VERIFIED
- **Method:** Individual IDs per day (Method 2) 
- **Real Example:** "Winter Wonderland Camp" shows 7 SEPARATE listings:
  - Dec 22nd (individual event)
  - Dec 23rd (individual event)
  - Dec 26th (individual event)
  - Dec 29th (individual event)
  - Dec 30th (individual event)
  - Jan 2nd (individual event)
  - Jan 5th (individual event)
- **Options:** NO Gymnastics/Ninja split - Single activity type
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ⚠️⚠️ HIGH (due to per-day event IDs)
- **Title Pattern:** `[Theme] | School Year Camp | Ages 4-13 | [Single Date] | 9 am-3 pm | $67/day`
- **Example Titles:**
  - "Pumpkin Palooza | School Year Camp | Ages 4-13 | Friday, October 17, 2025 | 9 am-3 pm | $67/day"
  - "Winter Wonderland Camp | School Year Camp | Ages 4-13 | December 22, 2025 | 9 am-3 pm |$67/day"
- **Display Challenge:** Multi-day camps show as separate events each day

### **Capital Gymnastics Pflugerville (CPF)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** For EVERY camp, TWO separate events:
  - "Winter Camp | December 22nd-December 23rd, December 29th-December 30th & January 2nd | Full Day (9-3) | $60/day"
  - "Winter Camp | December 22nd-December 23rd, December 29th-December 30th & January 2nd | Half Day (9-12) | $45/day"
- **Options:** NO Gymnastics/Ninja split - Single activity type
- **Duration Options:** Full Day (9-3) $60 + Half Day (9-12) $45 ✅ BOTH OFFERED
- **Complexity Level:** ⚠️⚠️ HIGH (2x events per camp - Full + Half Day)
- **Title Pattern:** `[Theme] | [Date Range] | Full Day/Half Day (time) | $[Price]`
- **Example Titles:**
  - "No School Day Camp | October 17th | Full Day (9-3) | $60"
  - "No School Day Camp | October 17th | Half Day (9-12) | $45"
  - "Spring Break | March 16th-March 20th | Full Day (9-3) | $60/day"
  - "Spring Break Camp | March 16th-March 20th | Half Day (9-12) | $45/day"
- **Display Challenge:** EVERY camp = 2 events (Full Day + Half Day versions)

### **Capital Gymnastics Round Rock (CRR)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** "Winterbreak Camp | FULL DAY | Ages 4+ |Dec 19th - Jan5th" = ONE event spanning 8 dates
- **Options:** NO Gymnastics/Ninja split - Single activity type
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ✅ LOW
- **Title Pattern:** `[Theme] | FULL DAY | Ages 4+ |[Date Range]`
- **Example Titles:**
  - "Schools Out Camp RRISD | FULL DAY | Ages 4+ |Oct 20th"
  - "Thanksgiving Camp | FULL DAY | Ages 4+ |Nov 24th - 28th"
  - "Springbreak Camp | FULL DAY | Ages 4+ |March 16 - 20"
- **Display Challenge:** Minimal - clean single event per camp

### **Houston Gymnastics Academy (HGA)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** TWO separate events for same camp:
  - "Thanksgiving Break Camp | Gymnastics | Ages 4-12 | Nov. 24, 25, 26 & 28"
  - "Thanksgiving Break Camp | Ninja | Ages 4-12 | Nov. 24, 25, 26 & 28"
- **Options:** Gymnastics + Ninja ✅ BOTH OFFERED
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ⚠️⚠️ HIGH (2x events for multi-option camps)
- **Title Pattern:** `[Theme] | Gymnastics/Ninja | Ages 4-12 | [Dates]`
- **Example Titles:**
  - "Winter Break Camp Week 1 | Gymnastics | Ages 4-12 | Dec. 22, 23 & 26"
  - "Winter Break Camp Week 1 | Ninja | Ages 4-12 | Dec. 22, 23 & 26"
  - "Fall Holiday Day Camp | Ages 4-12 | Nov. 7th" (single option camps)
- **Display Challenge:** 2 events per camp when both Gym + Ninja offered

### **Rowland Ballard Atascocita (RBA)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** "School's Out - Fall Break Camp - Gymnastics/Ninja| Ages 4+ | October 13th - October 17th" = ONE event with BOTH activities COMBINED
- **Options:** Gymnastics + Ninja COMBINED in single registration
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ✅ LOW (simplest - no splits)
- **Title Pattern:** `School's Out - [Theme]| Ages 4+ | [Date Range]`
- **Example Titles:**
  - "School's Out - Fall Break Camp - Gymnastics/Ninja| Ages 4+ | October 13th - October 17th"
  - "School's Out - Thanksgiving Break Camp| Ages 4+ | November 24th - November 26th"
  - "School's Out - Spring Break Camp| Ages 4+ |March 16th-20th"
- **Display Challenge:** NONE - perfect structure, no consolidation needed
- **Note:** Some special camps like "Unicorn Creative Dance Camp" are separate programs

### **Rowland Ballard Kingwood (RBK)** ⚠️ DATA PATTERNS UNVERIFIED
- **Method:** Unknown (likely same as RBA - Method 1)
- **Options:** Unknown (likely Gymnastics/Ninja combined like RBA)
- **Duration Options:** Unknown
- **Complexity Level:** ❓ ASSUMED LOW (based on RBA similarity)
- **Status:** Gym is active in codebase, syncing works
- **Need:** Real iClassPro data to verify title patterns and options

### **Estrella Gymnastics (EST)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** FOUR separate events for same camp:
  - "Thanksgiving Break | Ninja Warrior Camp 2025 - Full Day 9AM - 3PM"
  - "Thanksgiving Break | Girls Gymnastics Camp 2025 - Full Day 9AM - 3PM"
  - "Thanksgiving Break | Ninja Warrior Camp 2025 - Half Day 9AM - 12PM"
  - "Thanksgiving Break | Girls Gymnastics Camp 2025 - Half Day 9AM - 12PM"
- **Options:** Girls Gymnastics + Ninja Warrior ✅ BOTH OFFERED
- **Duration Options:** Full Day (9AM-3PM) + Half Day (9AM-12PM) ✅ BOTH OFFERED
- **Complexity Level:** ⚠️⚠️⚠️ HIGHEST (4x events per camp - 2 activities × 2 durations)
- **Title Pattern:** `[Theme] | Ninja Warrior Camp/Girls Gymnastics Camp [Year] - Full/Half Day [Time]`
- **Example Titles:**
  - "Week 1: Winter Break | Ninja Warrior Camp Full Day | Ages 5-12 | December 22nd, 23rd and 26th"
  - "Week 1: Winter Break | Girls Gymnastics Camp Half Day | Ages 5-12 | December 22nd, 23rd and 26th"
  - "Spring Break | Ninja Warrior Camp Half Day | Ages 5-12 | March 9th -13th"
- **Display Challenge:** EVERY camp = 4 events (Gymnastics Full + Gymnastics Half + Ninja Full + Ninja Half)

### **Oasis Gymnastics (OAS)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** TWO separate events for same camp:
  - "Thanksgiving Break | Girls Gymnastics Camp Full Day | Ages 5-13 | November 24th-26th"
  - "Thanksgiving Break | Co-ed Ninja Warrior Camp Full Day | Ages 5-13 | November 24th-26th"
- **Options:** Girls Gymnastics + Co-ed Ninja Warrior ✅ BOTH OFFERED
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ⚠️⚠️ HIGH (2x events for all camps)
- **Title Pattern:** `[Theme] | Girls Gymnastics Camp/Co-ed Ninja Warrior Camp Full Day | Ages 5-13 | [Dates]`
- **Example Titles:**
  - "Veteran's Day | Girls Gymnastics Camp Full Day | Ages 5-13 | November 11th"
  - "Veteran's Day | Co-ed Ninja Warrior Camp Full Day | Ages 5-13 | November 11th"
  - "Spring Break | Girls Gymnastics Camp Full Day | Ages 5-13 | March 16th-20th"
- **Display Challenge:** EVERY camp = 2 events (Gymnastics + Ninja)

### **Scottsdale Gymnastics (SGT)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** TWO separate events for same camp:
  - "Girls Gymnastics Fall Break Camp 2025 | Ages 5+ | October 13th-17th"
  - "Parkour & Ninja Fall Break Camp 2025 | Ages 5+ | October 13th-17th"
- **Options:** Girls Gymnastics + Parkour & Ninja ✅ BOTH OFFERED
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ⚠️⚠️ HIGH (2x events for all camps)
- **Title Pattern:** `Girls Gymnastics/Parkour & Ninja [Theme] [Year] | Ages 5+ | [Dates]`
- **Example Titles:**
  - "Girls Gymnastics Veteran's Day Camp 2025 | Ages 5+ | November 11th"
  - "Parkour & Ninja Veteran's Day Camp 2025 | Ages 5+ | November 11th"
  - "Girls Gymnastics Spring Break Camp 2026 | Ages 5+ | March 16th-20th"
- **Display Challenge:** EVERY camp = 2 events (Gymnastics + Parkour/Ninja)

### **Tigar Gymnastics (TIG)** ✅ VERIFIED
- **Method:** Single ID per camp (Method 1)
- **Real Example:** TWO separate events for same camp:
  - "Girls Gymnastics Thanksgiving Break Camp - 3 Day Camp | 11/24 - 11/26 | 9:00a - 3:00p"
  - "COED Ninja Thanksgiving Break Camp - 3 Day Camp | 11/24 - 11/26 | 9:00a - 3:00p"
- **Options:** Girls Gymnastics + COED Ninja ✅ BOTH OFFERED
- **Duration Options:** Full Day ONLY
- **Complexity Level:** ⚠️⚠️ HIGH (2x events for all camps)
- **Title Pattern:** `Girls Gymnastics/COED Ninja [Theme] - [X] Day Camp | [Dates] | 9:00a - 3:00p`
- **Example Titles:**
  - "Girls Gymnastics Winter Break Camp - 3 Day Camp | 12/22, 12/23, 12/26 | 9:00a - 3:00p (Week #1)"
  - "COED Ninja Winter Break Camp - 3 Day Camp | 12/22, 12/23, 12/26 | 9:00a - 3:00p (Week #1)"
  - "Girls Gymnastics Spring Break Camp | 3/23 - 3/27 | 9:00a - 3:00p"
- **Display Challenge:** EVERY camp = 2 events (Gymnastics + Ninja)

---

## 🎯 THE DISPLAY PROBLEM

### **Current Behavior:**
Every event = 1 calendar card showing on its date(s)

**Problem Scenarios:**

#### **Scenario A: 4-Option Camp (Method 1)**
```
Calendar View - Monday Oct 13:
┌─────────────────────────────┐
│ Fall Break | Gym Full Day   │ ← Event 1
├─────────────────────────────┤
│ Fall Break | Gym Half Day   │ ← Event 2
├─────────────────────────────┤
│ Fall Break | Ninja Full Day │ ← Event 3
├─────────────────────────────┤
│ Fall Break | Ninja Half Day │ ← Event 4
└─────────────────────────────┘
× Repeat on Tuesday, Wednesday, Thursday, Friday
= Takes up 4x vertical space EVERY DAY
```

#### **Scenario B: Cedar Park (Method 2 + 2 Activities)**
```
Calendar View - Monday Oct 13:
┌─────────────────────────────┐
│ Fall Break | Gymnastics     │ ← Event ID 5001
├─────────────────────────────┤
│ Fall Break | Ninja          │ ← Event ID 5002
└─────────────────────────────┘

Calendar View - Tuesday Oct 14:
┌─────────────────────────────┐
│ Fall Break | Gymnastics     │ ← Event ID 5003
├─────────────────────────────┤
│ Fall Break | Ninja          │ ← Event ID 5004
└─────────────────────────────┘
× Repeat for all 5 days = 10 total cards
```

### **What Jayme Wants:**
```
Calendar View - Monday Oct 13:
┌─────────────────────────────┐
│ Fall Break Camp             │ ← ONE consolidated card
│ (4 options available)       │
└─────────────────────────────┘

On Hover:
┌─────────────────────────────────────────┐
│ Fall Break Camp                          │
│ October 13-17, 2025                      │
│                                          │
│ 📝 Register:                             │
│ • Gymnastics Full Day [View Details] ←─┐│
│ • Gymnastics Half Day [View Details] ←─┤│ All 4 links
│ • Ninja Full Day [View Details]      ←─┤│ available
│ • Ninja Half Day [View Details]      ←─┘│
│                                          │
│ 🏫 Capital Gymnastics Cedar Park        │
└─────────────────────────────────────────┘
```

**Benefits:**
- ✅ Saves 75% vertical space
- ✅ All registration links preserved
- ✅ Cleaner, more professional appearance
- ✅ Parents see "1 camp, 4 ways to register"

---

## 🔍 HOW TO IDENTIFY CAMP OPTIONS

### **Pattern Analysis from F12 Data:**

#### **Activity Options (Gymnastics vs Ninja):**
Look for titles with:
- `| Gymnastics |` or `| Gym |` or `| Gymnastics`
- `| Ninja |` or `| Ninja`

#### **Duration Options (Full vs Half Day):**
Look for titles with:
- `| Full Day |` or `Full Day` or `9:00 AM - 3:00 PM`
- `| Half Day |` or `Half Day` or `9:00 AM - 12:00 PM`

#### **Combined Options:**
- `| Gymnastics Full Day |`
- `| Gymnastics Half Day |`
- `| Ninja Full Day |`
- `| Ninja Half Day |`

### **Grouping Logic:**
Events should group if they share:
1. ✅ Same gym_id
2. ✅ Same base camp name (before first `|` or before "Gymnastics"/"Ninja")
3. ✅ Same date range (start_date to end_date)
4. ✅ Type = "CAMP"

**Base Camp Name Extraction Examples:**
```
"Fall Break Camp | Gymnastics | Oct 13-17" → "Fall Break Camp"
"Parkour & Ninja Fall Break Camp 2025 | Gymnastics Full Day" → "Parkour & Ninja Fall Break Camp 2025"
"Winter Wonderland Camp | Half Day" → "Winter Wonderland Camp"
```

---

## 📁 WHERE THE DATA COMES FROM

### **F12 Import Process:**

**📖 For complete F12 import documentation, see:** [F12-IMPORT-GUIDE.md](./F12-IMPORT-GUIDE.md)

**Quick Overview:**
1. User opens gym's camp page (e.g., `portal.iclasspro.com/capgymavery/camps/14`)
2. Press F12 → Network tab → Refresh page
3. Find API call to iClassPro (usually `/camps/[type_id]`)
4. Right-click → Copy Response
5. Paste into Master Events app

**⚠️ IMPORTANT:** The F12 import process is working CORRECTLY. Each event from iClassPro (Gym Full, Gym Half, Ninja Full, Ninja Half) has a unique event ID and registration URL, so they MUST be imported as separate database records. The "problem" this document addresses is purely about how we DISPLAY these events on the calendar, not how we import them.

### **Raw JSON Structure:**
```json
{
  "totalRecords": 4,
  "campTypeName": "SCHOOL YEAR CAMP - FULL DAY",
  "data": [
    {
      "id": 1234,
      "name": "Fall Break Camp | Gymnastics Full Day | Ages 5+ | October 13th-17th",
      "startDate": "2025-10-13",
      "endDate": "2025-10-17",
      "schedule": [
        {
          "startTime": "9:00 AM",
          "endTime": "3:00 PM"
        }
      ],
      "minAge": 5,
      "maxAge": 99,
      "hasOpenings": true
    },
    {
      "id": 1235,
      "name": "Fall Break Camp | Ninja Full Day | Ages 5+ | October 13th-17th",
      "startDate": "2025-10-13",
      "endDate": "2025-10-17",
      "schedule": [
        {
          "startTime": "9:00 AM",
          "endTime": "3:00 PM"
        }
      ],
      "minAge": 5,
      "maxAge": 99,
      "hasOpenings": true
    }
  ]
}
```

### **After Import to Database:**
Each item in `data` array becomes a separate database record:
```sql
INSERT INTO events (gym_id, title, date, start_date, end_date, time, type, event_url)
VALUES 
('CCP', 'Fall Break Camp | Gymnastics Full Day | Ages 5+ | October 13th-17th', '2025-10-13', '2025-10-13', '2025-10-17', '9:00 AM - 3:00 PM', 'CAMP', 'https://portal.iclasspro.com/capgymavery/camp-details/1234'),
('CCP', 'Fall Break Camp | Ninja Full Day | Ages 5+ | October 13th-17th', '2025-10-13', '2025-10-13', '2025-10-17', '9:00 AM - 3:00 PM', 'CAMP', 'https://portal.iclasspro.com/capgymavery/camp-details/1235');
```

**Each has DIFFERENT `event_url` pointing to DIFFERENT iClassPro registration pages.**

---

## ⚠️ CRITICAL REQUIREMENTS FOR ANY SOLUTION

### **MUST PRESERVE:**
1. ✅ **All registration URLs** - Every event_url must remain accessible
2. ✅ **Database integrity** - No changes to how we import or store data
3. ✅ **Unique event IDs** - Each iClassPro event ID is unique and must be preserved
4. ✅ **Individual event details** - Price, time, age ranges per option

### **MUST AVOID:**
1. ❌ **Losing registration links** - Parents need direct access to each option
2. ❌ **Breaking F12 import** - Current import process works and is fast
3. ❌ **Data consolidation in database** - Would break referential integrity
4. ❌ **Assuming patterns** - Every gym structures data differently

### **ACCEPTABLE CHANGES:**
1. ✅ **Display-only grouping** - Combine at UI render time, not in database
2. ✅ **Smart hover popups** - Show multiple registration links when hovering
3. ✅ **Visual consolidation** - One card on calendar with "X options" badge
4. ✅ **Expandable details** - Click/hover to see all available options

---

## 📝 QUESTIONS TO ASK BEFORE MAKING CHANGES

If you're an AI or developer about to work on camp display logic, ASK THESE FIRST:

### **1. Data Source Questions:**
- [ ] Have you reviewed actual F12 data from at least 3 different gyms?
- [ ] Do you understand the difference between Method 1 and Method 2 gyms?
- [ ] Have you checked the current database to see real camp data structure?

### **2. Grouping Logic Questions:**
- [ ] How will you identify which events belong to the same camp?
- [ ] What happens if a camp has NO pipe delimiter (`|`) in the title?
- [ ] What if two completely different camps happen the same week?
- [ ] How will you handle Cedar Park's per-day event IDs?

### **3. Display Questions:**
- [ ] How will you show 4+ options in a hover popup without it being overwhelming?
- [ ] What happens on mobile where hover doesn't work?
- [ ] How will users know there are multiple options before hovering?
- [ ] Will consolidated cards be visually distinct from regular camps?

### **4. URL Preservation Questions:**
- [ ] Can you guarantee EVERY event_url remains clickable?
- [ ] What if someone bookmarks or shares a specific option's URL?
- [ ] How will the "View Details" button know which URL to use?
- [ ] Will social sharing work correctly?

### **5. Edge Case Questions:**
- [ ] What if one option is full but others have openings?
- [ ] What if options have different prices?
- [ ] What if options have different age ranges?
- [ ] What about camps that span different months?

---

## 🚨 BEFORE YOU CODE ANYTHING

**MANDATORY CHECKLIST:**

- [ ] I have read this ENTIRE document
- [ ] I understand Method 1 vs Method 2 gym structures
- [ ] I know which gyms use which method
- [ ] I have seen real F12 data examples
- [ ] I have checked the actual database structure
- [ ] I have asked Jayme clarifying questions about unknowns
- [ ] I have a clear plan that preserves ALL event URLs
- [ ] I will NOT modify database structure or import logic
- [ ] I will ONLY change display/UI rendering logic
- [ ] I have documented my approach for Jayme's review

**DO NOT PROCEED without checking every box above.**

---

## 📞 WHEN IN DOUBT

**ASK JAYME:**
- Specific gym behavior questions
- Data structure clarifications
- Business logic decisions
- Visual design preferences

**DO NOT ASSUME:**
- All gyms work the same way
- Patterns will be consistent
- You can consolidate data in the database
- Simple solutions will handle all edge cases

---

## 🎯 SUCCESS CRITERIA FOR A SOLUTION

A proper camp consolidation solution MUST:

1. ✅ **Reduce visual clutter** by showing 1 card instead of 4+ cards
2. ✅ **Preserve all functionality** - Every registration link accessible
3. ✅ **Handle all gym variations** - Method 1, Method 2, all option types
4. ✅ **Work on mobile** - Touch-friendly, no hover-only interactions
5. ✅ **Be obvious to users** - Clear indication of multiple options
6. ✅ **Maintain data integrity** - No database schema changes
7. ✅ **Scale to edge cases** - 6+ options, cross-month camps, etc.

---

## 📚 RELATED DOCUMENTATION

- **F12 Import Process:** `docs/OPERATIONS/F12-IMPORT-GUIDE.md`
- **Database Structure:** `docs/TECHNICAL/SUPABASE-ARCHITECTURE.md`
- **Bulk Import Logic:** `docs/OPERATIONS/BULK-IMPORT-LEARNINGS.md`

---

**Last Updated:** December 28, 2025  
**Maintained By:** Jayme  
**Status:** ✅ CONSOLIDATION IMPLEMENTED - Calendar now shows "X options available" with all registration links in details panel

---

## 🔄 UPDATE HISTORY & VERSION TRACKING

### **Version 1.0 - October 17, 2025**
- Initial creation with complete gym-by-gym analysis
- Based on real iClassPro data pasted from live portals
- Verified: CCP, CPF, CRR, EST, HGA, OAS, RBA, SGT, TIG
- Not verified: RBK (needs data)

### **Version 2.0 - December 2025**
- ✅ **CONSOLIDATION IMPLEMENTED** - Calendar now shows camps as single card with "X options available"
- ✅ Details panel shows all registration links with icons (🤸 Gymnastics, 🥷 Ninja)
- ✅ Summer camps added to sync system (`camps_summer_full`, `camps_summer_half`)
- ✅ All 10 gyms configured in codebase (RBK data patterns still unverified)
- ✅ Grouping logic: Groups ALL camps by `gym_id + date` (not by parsing camp names)

### **When to Update This Document:**

✅ **Update when:**
- A gym adds/removes camp options (Full/Half Day, Gym/Ninja)
- A gym changes their event structure (Method 1 ↔ Method 2)
- New gyms are added to the system
- Event title patterns change significantly
- New activity types appear (Tumbling, Cheer, etc.)

📸 **How to Update:**
1. Go to gym's iClassPro camp page
2. Copy-paste the actual listing text (like Jayme did Oct 17, 2025)
3. Update the gym's section with new patterns
4. Add version note with date and what changed
5. Update "Gyms That Need Consolidation" summary if needed

⚠️ **Don't Update for:**
- Minor title wording changes
- Price changes
- Specific camp theme names
- Date ranges (these change every season)

### **Future Versions:**
- **v2.1** - Add RBK verification when data available
- **v2.2** - If any gym's structure changes significantly
- **v3.0** - If consolidation enhancements needed (filtering, mobile touch improvements)

---

## 🔧 HOW THE CONSOLIDATION WORKS (Technical)

### Calendar Card Grouping Logic

Located in `EventsDashboard.js` around line 3051:

```javascript
const groupCampEventsForDisplay = (events) => {
  const campGroups = new Map();
  const regularEvents = [];
  
  events.forEach(event => {
    if (event.type === 'CAMP') {
      // Group ALL camps by gym + date only
      const groupKey = `${event.gym_id}-CAMP-${event.date}`;
      
      if (!campGroups.has(groupKey)) {
        campGroups.set(groupKey, []);
      }
      campGroups.get(groupKey).push(event);
    } else {
      regularEvents.push(event);
    }
  });
  
  // Single option = show as-is
  // Multiple options = consolidated with isGrouped: true
  // ...
};
```

**Key Points:**
- Grouping happens at **display time only** - database unchanged
- Groups by `gym_id + date`, NOT by parsing camp names
- Consolidated events get `isGrouped: true` and `groupedEvents` array

### Details Panel Registration Links

When user clicks a grouped camp card:

```javascript
{selectedEventForPanel.isGrouped && selectedEventForPanel.groupedEvents ? (
  <div className="space-y-3">
    <p className="font-semibold">📝 Register for THIS Camp:</p>
    {selectedEventForPanel.groupedEvents.map((option) => {
      // Parse title to detect activity and duration
      // 🤸 for Gymnastics, 🥷 for Ninja
      // Adds "Full Day" or "Half Day" suffix if detected
      return (
        <button onClick={() => window.open(option.event_url, '_blank')}>
          {icon} {label} • {time} • ${price}
        </button>
      );
    })}
  </div>
) : (
  // Single option - regular button
)}
```

### What Gets Detected from Titles

| Title Contains | Icon | Label |
|---------------|------|-------|
| "Girls Gymnastics" | 🤸 | Girls Gymnastics |
| "Gymnastics" | 🤸 | Gymnastics |
| "Co-ed Ninja" | 🥷 | Co-ed Ninja |
| "Ninja Warrior" | 🥷 | Ninja Warrior |
| "Parkour" | 🥷 | Parkour & Ninja |
| "COED Ninja" | 🥷 | COED Ninja |
| "Full Day" | - | adds "- Full Day" |
| "Half Day" | - | adds "- Half Day" |

---

**END OF DOCUMENT**

*This document exists because camp data is genuinely complex, not because anyone is being difficult. If you're reading this, you now have everything needed to understand the full scope of the problem. Use it wisely.* 🏕️

---

**📞 Questions about this document?** Ask Jayme - she has the real-world context and can provide current iClassPro data samples.

**🔧 Working on camp consolidation?** Read the ENTIRE document first, then complete the mandatory checklist before writing code.

**🆕 New AI agent reading this?** Everything you need to know is here. Don't make assumptions. When in doubt, ask for current data samples.

