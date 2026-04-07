# 🚨 AI AGENT - READ THIS ENTIRE FILE FIRST - MANDATORY

**Last Updated**: April 7, 2026
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
| Backend | Flask (Python API), Direct HTTP API (replaced Playwright Mar 2026, Playwright kept as fallback) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (frontend), Railway (API) |
| Local Dev | `npm start` on port 3000 |

## Key Files
| File | Purpose |
|------|---------|
| `src/components/EventsDashboard.js` | Main dashboard UI, modals, buttons, requirement status notes |
| `src/components/AdminDashboard/AdminDashboard.js` | Admin panel (Shift+Click magic wand) |
| `src/components/AdminDashboard/RuleWizard.js` | Unified rule creation wizard (validation rules + requirement exceptions) |
| `src/components/AdminDashboard/EmailComposer.js` | Email generation for managers (missing events + data errors) |
| `automation/f12_collect_and_import.py` | Core Python script - collects events via Direct API (or Playwright fallback), runs validation |
| `automation/validation_engine.py` | Database-driven validation engine — all checks from rules table |
| `src/lib/supabase.js` | Supabase client config |
| `src/lib/api.js` | API functions for database (includes rulesApi, requirementNotesApi) |
| `src/lib/validationHelpers.js` | Error category logic |

## Database Tables (Supabase)
| Table | Purpose |
|-------|---------|
| `events` | All events (KNO, Clinic, Open Gym, Camp, Special Event) |
| `events_archive` | Archived/past events + soft-deleted events |
| `gyms` | 10 gymnastics facilities (includes manager_name, manager_email) |
| `gym_links` | URLs for each gym's iClassPro pages |
| `rules` | Unified validation rules + system checks — drives all validation via validation_engine.py (17 rows: 11 system checks + 6 user rules) |
| `camp_pricing` | Source of truth for CAMP prices |
| `event_pricing` | Source of truth for Clinic, KNO, Open Gym prices (with effective dates) |
| `event_audit_log` | History of all changes |
| `sync_log` | Sync progress tracking |
| `requirement_notes` | Status tracking for missing monthly requirements |
| `acknowledged_patterns` | Bulk dismiss patterns per gym/event type |

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

> **Full reference with examples:** `docs/OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md`

| Error Type | What's Compared | Source of Truth |
|------------|-----------------|-----------------|
| `year_mismatch` | Title year vs actual event year | iClass `startDate` |
| `date_mismatch` | Description month vs actual month | iClass `startDate`/`endDate` |
| `day_mismatch` | Description day vs actual day | Calculated from `startDate` |
| `time_mismatch` | Title/description time vs actual | iClass `schedule.startTime` |
| `age_mismatch` | Title/description age vs actual | iClass `minAge`/`maxAge` |
| `program_mismatch` | Title/description keywords vs program type | iClass `link_type_id` |
| `skill_mismatch` | Title skill word vs description skill word (clinics only) | Title vs Description |
| `price_mismatch` | Title price vs description price | Title vs Description |
| `title_desc_mismatch` | Title program keywords vs description program keywords | Title vs Description |
| `camp_price_mismatch` | Description price vs `camp_pricing` | Supabase `camp_pricing` |
| `event_price_mismatch` | Description price vs `event_pricing` | Supabase `event_pricing` (Clinic/KNO/Open Gym) |

**FORMAT Errors: Removed.** Format/completeness errors were planned but never implemented in the Python backend. All dead code references have been cleaned up (March 17, 2026).

## System Checks (Database-Driven)
All validation checks live in the `rules` table as rows with `rule_type` starting with `check_`. The Python engine (`validation_engine.py`) reads active checks from the database, runs them, and stores results. There are NO hardcoded validation rules in Python.

Current system checks (11):
- `check_date_mismatch` — Month in description vs actual event dates
- `check_year_mismatch` — Wrong year in title or description
- `check_time_mismatch` — Time in description vs iClassPro time
- `check_age_mismatch` — Age range vs iClassPro settings
- `check_program_mismatch` — Program type cross-contamination
- `check_title_desc_mismatch` — Title and description contradict
- `check_impossible_date` — Dates that can't exist (June 31st)
- `check_price_mismatch` — Price in title vs description
- `check_day_mismatch` — Day of week vs actual event day
- `check_camp_price` — Camp prices vs pricing table
- `check_event_price` — Event prices vs pricing table

## Configurable Rules (Database - `rules` table)
Per-gym customization:

| rule_type | Purpose | Example |
|-----------|---------|---------|
| `program_synonym` | Alternative names for programs | "ninja night" → KIDS NIGHT OUT |
| `valid_price` | Price exceptions | "Before Care" can have different price |
| `valid_time` | Time exceptions | "Early Dropoff" can have different time |

## NOT YET IMPLEMENTED (Planned)
| rule_type | Purpose | Status |
|-----------|---------|--------|
| `program_ignore` | Ignore words that cause false positives | PLANNED - not built yet |

---

# PART 6: KNOWN GAPS & LIMITATIONS

## Current Gaps (As of Feb 2026)

| Gap | Description | Priority | Status |
|-----|-------------|----------|--------|
| Wrong year in DESCRIPTION | Now checks both title AND description for wrong year | Fixed | ✅ Fixed |
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
| Export single Date column | Feb 23, 2026 | CSV export now includes Start Date and End Date columns for multi-day events |
| Sync All cross-type false deletions | Feb 23, 2026 | Comparison filters existing events by checkedTypes to prevent cross-type false deletions |
| includeDeleted flag missing | Feb 23, 2026 | Added includeDeleted parameter to prevent deleted events from reappearing |
| CORS restriction on Railway | Feb 23, 2026 | Attempted but reverted — CORS is still open (`CORS(app)` with no origin restriction). Known issue, not yet fixed. |

---

# PART 7: UI LAYOUT

## Main Dashboard (`EventsDashboard.js`)
- **SYNC button** → Opens `SyncModal` for automated sync
- **EXPORT button** → Opens export options
- **Magic Wand** (centered below SYNC/EXPORT) → Shift+Click opens Admin Dashboard (SECRET - no tooltip)

## Admin Dashboard (`AdminDashboard.js`)
- Accessed via Shift+Click on magic wand
- 7 tabs: Audit & Review, Pricing, Gym Rules, Change History, Audit Rules, Future Plans, Quick Actions
- Plus Email Composer button for manager notifications

## Audit Review System
- Filter by: Gym, Category (Data Error), Status
- 5 Status Filters: All, Pending Review, Verified Accurate, Invalid/Bug, Has Override
- Actions: "Verified Accurate", "Invalid/Bug", "Temporary Override", "Permanent Rule"

---

# PART 8: COMMON MISTAKES TO AVOID

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Assuming price comes from iClass | iClass has NO price field | Check `camp_pricing` for camps, title vs description for others |
| Not checking both start AND end date | Multi-day camps span months | Always check `endDate` too |
| Hardcoding validation rules | Gyms have different needs | Use `rules` table |
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
| Feb 11, 2026 | Added missing error types (skill_mismatch, title_desc_mismatch), completed FORMAT errors list, added AUDIT_DATA_ERROR_REFERENCE.md link |
| Feb 23, 2026 | Added Feb 23 fixes: export start/end date, sync all cross-type deletion, includeDeleted flag, CORS restriction. Fixed outdated event_pricing reference. |
| Mar 9, 2026 | Direct API swap, rules table unification, validation_engine.py added to key files |
| Mar 17, 2026 | Removed FORMAT errors (never implemented). Replaced precoded rules with database-driven system checks. Dropped gym_valid_values references. Updated Admin Dashboard to 7 tabs. CORS note corrected. |

---

# PART 11: QUICK REFERENCE

## When Jayme asks about validation:
→ Read `docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md`

## When Jayme asks about prices:
→ CAMP prices: `camp_pricing` table in Supabase
→ Other prices: `event_pricing` table with `effective_date` support (Clinic, KNO, Open Gym)

## When Jayme asks about errors:
→ DATA error = something is WRONG (mismatch)
→ FORMAT errors were removed (never implemented in Python backend)

## When Jayme asks about rules:
→ System checks = rows in `rules` table with `check_*` rule_type
→ Configurable = `rules` table in Supabase

## When something doesn't work:
→ Ask for F12 console output
→ Check actual API response
→ Don't guess - investigate

---

**Core Principle**: No assumptions, only verified facts.  
**Your Job**: Think AHEAD of Jayme. Catch problems before she asks.
