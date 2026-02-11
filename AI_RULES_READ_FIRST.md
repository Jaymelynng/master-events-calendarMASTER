# 🚨 AI AGENT - READ THIS ENTIRE FILE FIRST - MANDATORY

**Last Updated**: February 11, 2026  
**Purpose**: This file contains EVERYTHING an AI needs to know about this system. Read it completely before doing ANYTHING.

> **Quick Start:** Also see `CLAUDE.md` in the root for a condensed 2-minute onboarding guide with session workflow.

---

# PART 1: CRITICAL RULES - NO EXCEPTIONS

### **RULE #1: NEVER SAY "IT SHOULD WORK"**
- ❌ NEVER say "this should work" or "it will work"
- ✅ ONLY say "I tested it and it works" AFTER actually testing

### **RULE #2: TEST WITH JAYME'S ACTUAL DATA**
- ❌ NEVER simulate with fake/sample data
- ✅ ALWAYS use the EXACT data from Supabase
- ✅ Write test scripts using ACTUAL database values

### **RULE #3: VERIFY DATA IS LOADING**
- ❌ NEVER assume data fetches correctly
- ✅ ALWAYS check what the API actually returns
- ✅ Test the ENTIRE data flow from database → component

### **RULE #4: USE BROWSER CONSOLE**
- When something doesn't work, ask Jayme to:
  1. Open F12 console
  2. Copy/paste console output
  3. Share what she sees

### **RULE #5: READ ALL DOCUMENTATION FIRST**
- `docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md` - THE source of truth for validation
- `docs/OPERATIONS/DATA_QUALITY_VALIDATION.md` - Error categories
- `docs/OPERATIONS/CAMP_COMPLEXITY_MASTER_GUIDE.md` - Camp handling
- `docs/OPERATIONS/AUTO-SYNC-GUIDE.md` - How sync works

### **RULE #6: NO HARDCODING**
- Build detection logic that adapts to whatever the data contains
- Never assume columns exist - check the actual schema

### **RULE #7: THINK AHEAD**
- Jayme is a NON-TECHNICAL user
- YOU should catch gaps and problems BEFORE she asks
- Proactively audit for edge cases, missing features, documentation gaps

---

# PART 2: SYSTEM ARCHITECTURE

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Lucide Icons |
| Backend | Flask (Python API), Playwright (browser automation) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (frontend), Railway (API) |
| Local Dev | `npm start` on port 3000 |

## Key Files
| File | Purpose |
|------|---------|
| `src/components/EventsDashboard.js` | Main dashboard UI, modals, buttons |
| `src/components/AdminDashboard/AdminDashboard.js` | Admin panel (Shift+Click magic wand) |
| `automation/f12_collect_and_import.py` | Core Python script - collects events, runs validation |
| `src/lib/supabase.js` | Supabase client config |
| `src/lib/api.js` | API functions for database |
| `src/lib/validationHelpers.js` | Error category logic |

## Database Tables (Supabase)
| Table | Purpose |
|-------|---------|
| `events` | All events (KNO, Clinic, Open Gym, Camp, Special Event) |
| `gyms` | 10 gymnastics facilities |
| `gym_links` | URLs for each gym's iClassPro pages |
| `gym_valid_values` | Per-gym validation rules (synonyms, exceptions) |
| `camp_pricing` | Source of truth for CAMP prices |
| `event_pricing` | Source of truth for Clinic, KNO, Open Gym prices (with effective dates) |
| `event_audit_log` | History of all changes |
| `sync_log` | Sync progress tracking |

---

# PART 3: SOURCE OF TRUTH - CRITICAL

## What iClass API Provides vs What We Built

| Data Field | Source of Truth | Notes |
|------------|-----------------|-------|
| **Date** | iClass API (`startDate`) | We compare this to title/description |
| **Time** | iClass API (`schedule.startTime`) | We compare this to title/description |
| **Age Range** | iClass API (`minAge`, `maxAge`) | We compare this to title/description |
| **Program Type** | iClass API (`link_type_id`) | Maps to KNO, CLINIC, CAMP, etc. |
| **CAMP Price** | Supabase `camp_pricing` table | WE BUILT THIS - iClass has no price field |
| **Clinic/KNO/Open Gym Price** | Supabase `event_pricing` table | WE BUILT THIS Feb 2026 - supports effective dates for price changes |

### The Price Solution
iClass does NOT provide price in their API. We built our own pricing tables:
- **`camp_pricing`** - Camp prices (full day daily/weekly, half day daily/weekly)
- **`event_pricing`** - Clinic, KNO, Open Gym prices with `effective_date` support
  - Prices automatically change based on date (e.g., price increase on Monday)
  - Each gym can have different prices
  - System validates description price against the correct price for that date

---

# PART 4: EVENT TYPES

| Type | Code | Description |
|------|------|-------------|
| Kids Night Out | `KNO` | Drop-off events, usually Friday nights |
| Clinic | `CLINIC` | Skill-focused classes |
| Open Gym | `OPEN GYM` | Open practice time |
| Camp | `CAMP` | Day camps (full day, half day, summer, school year) |
| Special Event | `SPECIAL EVENT` | Birthday parties, special occasions |

### Camp Subtypes
- `camps` - School Year Full Day
- `camps_half` - School Year Half Day  
- `camps_summer_full` - Summer Full Day
- `camps_summer_half` - Summer Half Day

---

# PART 5: VALIDATION SYSTEM

## Error Categories

### DATA Errors (Red - High Priority)
Something is **WRONG** - mismatch between sources that could confuse customers.

| Error Type | What's Compared | Source of Truth |
|------------|-----------------|-----------------|
| `year_mismatch` | Title year vs actual event year | iClass `startDate` |
| `date_mismatch` | Description month vs actual month | iClass `startDate`/`endDate` |
| `time_mismatch` | Title/description time vs actual | iClass `schedule.startTime` |
| `age_mismatch` | Title/description age vs actual | iClass `minAge`/`maxAge` |
| `price_mismatch` | Title price vs description price | None (comparing text only) |
| `camp_price_mismatch` | Description price vs `camp_pricing` | Supabase `camp_pricing` |
| `event_price_mismatch` | Description price vs `event_pricing` | Supabase `event_pricing` (Clinic/KNO/Open Gym) |
| `program_mismatch` | Title keywords vs program type | iClass `link_type_id` |
| `day_mismatch` | Description day vs actual day | Calculated from `startDate` |

### FORMAT Errors (Orange - Warning)
Something is **MISSING** - required info not found.

| Error Type | What's Missing |
|------------|----------------|
| `missing_age_in_title` | No age range in title |
| `missing_date_in_title` | No date in title |
| `missing_price_in_description` | No price ($XX) in description |
| `missing_time_in_description` | No time in description |
| `description_status: none` | No description at all |
| `description_status: flyer_only` | Only flyer image, no text to validate |

## Precoded Rules (Hardcoded in Python)
These work automatically - no configuration needed:

| Rule | How It Works |
|------|--------------|
| Case insensitivity | "KIDS NIGHT OUT" = "kids night out" |
| Apostrophe handling | "Kid's" = "Kids" |
| Month recognition | Full names AND abbreviations (January, Jan) |
| Day recognition | Full names AND abbreviations (Friday, Fri) |
| Multi-day events | Checks BOTH start and end month for camps spanning months |
| Time formats | Handles 5pm, 5:00pm, 5:00 PM, 5 p.m., etc. |
| Price patterns | Finds $XX, $XX.XX in text |
| Program keywords | KNO, CLINIC, OPEN GYM, CAMP auto-detected |

## Configurable Rules (Database - `gym_valid_values` table)
Per-gym customization:

| rule_type | Purpose | Example |
|-----------|---------|---------|
| `program_synonym` | Alternative names for programs | "ninja night" → KIDS NIGHT OUT |
| `price` | Price exceptions | "Before Care" can have different price |
| `time` | Time exceptions | "Early Dropoff" can have different time |

## NOT YET IMPLEMENTED (Planned)
| rule_type | Purpose | Status |
|-----------|---------|--------|
| `program_ignore` | Ignore words that cause false positives | PLANNED - not built yet |

---

# PART 6: KNOWN GAPS & LIMITATIONS

## Current Gaps (As of Feb 2026)

| Gap | Description | Priority | Status |
|-----|-------------|----------|--------|
| Wrong year in DESCRIPTION | Only checks title for wrong year, not description | Should fix | ❌ Open |
| `program_ignore` not built | Can't ignore "open gym" when it's a station in KNO | Medium | ❌ Open |
| Date ranges not validated | "Jan 15-17" not checked against actual dates | Low | ❌ Open |
| Flyer-only events | Can't validate anything if only image, no text | Known limitation | ❌ Open |

## Fixed Issues
| Issue | Fix Date | Details |
|-------|----------|---------|
| Export bug (analytics ignoring filters) | Feb 2026 | `ExportModal.js` now uses `filteredEvents` consistently |
| No pricing for non-camps | Feb 2026 | `event_pricing` table with `effective_date` support |
| Time regex false positives ("$62 a day", "Ages 4-13") | Feb 2026 | Pre-cleaning in `has_time_in_text()` and `check_times_in_text()` |
| Day range false positives ("Monday-Friday") | Feb 2026 | Improved day range regex with "to/thru/through" support |

---

# PART 7: UI LAYOUT

## Main Dashboard (`EventsDashboard.js`)
- **SYNC button** → Opens `SyncModal` for automated sync
- **EXPORT button** → Opens export options
- **Magic Wand** (centered below SYNC/EXPORT) → Shift+Click opens Admin Dashboard (SECRET - no tooltip)

## Admin Dashboard (`AdminDashboard.js`)
- Accessed via Shift+Click on magic wand
- Contains: Audit Review, Gym Rules, Quick Actions
- Quick Actions has: Automated Sync, JSON Import (F12 Method)

## Audit Review System
- Filter by: Gym, Category (Data Error, Format Error), Status
- 5 Status Filters: All, Pending Review, Verified Accurate, Invalid/Bug, Has Override
- Actions: "Verified Accurate", "Invalid/Bug", "Temporary Override", "Permanent Rule"

---

# PART 8: COMMON MISTAKES TO AVOID

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Assuming price comes from iClass | iClass has NO price field | Check `camp_pricing` for camps, title vs description for others |
| Not checking both start AND end date | Multi-day camps span months | Always check `endDate` too |
| Hardcoding validation rules | Gyms have different needs | Use `gym_valid_values` table |
| Saying "it should work" | Jayme has been burned by this | Test it, then say "it works" |
| Not reading documentation | Docs explain complex logic | Read `docs/` folder first |
| Waiting for Jayme to find bugs | She's non-technical | Proactively audit and catch issues |

---

# PART 9: TESTING CHECKLIST

Before saying ANYTHING works:
- [ ] Tested with actual Supabase data
- [ ] Verified data loads correctly (not empty/null)
- [ ] Tested the ENTIRE code path
- [ ] Checked for column name mismatches
- [ ] Verified against database schema
- [ ] Cross-checked documentation against actual code
- [ ] Asked Jayme to test on live app
- [ ] Got confirmation it works

**If you can't check ALL boxes, DON'T say it works!**

---

# PART 10: DOCUMENT HISTORY

| Date | Update |
|------|--------|
| Oct 2025 | Original rules created after verification failures |
| Dec 28, 2025 | Updated with system status, documentation audit lesson |
| Feb 5, 2026 | MAJOR REWRITE - Added complete system knowledge, source of truth, validation rules, gaps, architecture |
| Feb 11, 2026 | Updated known gaps (marked fixed items), added CLAUDE.md quick-start reference |

---

# PART 11: QUICK REFERENCE

## When Jayme asks about validation:
→ Read `docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md`

## When Jayme asks about prices:
→ CAMP prices: `camp_pricing` table in Supabase
→ Other prices: NO source of truth, only title vs description comparison

## When Jayme asks about errors:
→ DATA error = something is WRONG (mismatch)
→ FORMAT error = something is MISSING

## When Jayme asks about rules:
→ Precoded = hardcoded in `f12_collect_and_import.py`
→ Configurable = `gym_valid_values` table in Supabase

## When something doesn't work:
→ Ask for F12 console output
→ Check actual API response
→ Don't guess - investigate

---

**Core Principle**: No assumptions, only verified facts.  
**Your Job**: Think AHEAD of Jayme. Catch problems before she asks.
