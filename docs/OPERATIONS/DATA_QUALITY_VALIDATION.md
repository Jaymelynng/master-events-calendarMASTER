# Data Quality Validation System

**Last Updated:** December 28, 2025  
**Status:** ✅ Working  
**Files:** `automation/f12_collect_and_import.py`, `src/components/EventsDashboard.js`

---

## Overview

The Data Quality Validation system automatically detects errors and issues in event data by comparing structured API data against description text. This catches copy/paste errors, outdated descriptions, and missing content.

## How It Works

When events are synced from iClassPro, the system:
1. Extracts **structured data** (date, time, age, event type) from the API
2. Parses the **description text** for the same information
3. **Compares** them to detect mismatches
4. **Flags issues** with appropriate icons on the calendar

## Validation Icons

| Icon | Meaning | Severity |
|------|---------|----------|
| 🚨 | Mismatch error (wrong skill, wrong program type) | Error |
| ⚠️ | Warning (flyer only, minor issues) | Warning |
| ❌ | No description at all | Error |
| 🖼️ | Has flyer image (informational only) | Info |

## What Gets Validated

### Programs Validated
- ✅ **KIDS NIGHT OUT (KNO)**
- ✅ **CLINIC**
- ✅ **OPEN GYM**
- ⏸️ **CAMP** - Skipped (too complex, many false positives)

### Validation Checks

#### 1. Date Validation (All 3 Programs)
Compares structured `startDate` to month mentioned in description.

**Example Error:**
- Event date: January 24
- Description says: "December 27th"
- 🚨 Flag: "Event is January 24 but description says 'December'"

#### 2. Time Validation (All 3 Programs)
Compares structured `time` to times in description (checks both start AND end time).

**Example Error:**
- Event time: 2:30 PM - 3:30 PM
- Description says: "6:30 PM"
- ⚠️ Flag: "Event time is 2:30 PM but description mentions 6:30 PM"

#### 3. Min Age Validation (All 3 Programs)
Compares structured `age_min` to age mentioned in description.

**Example Error:**
- Event age: 5-12
- Description says: "Ages 7-17"
- ⚠️ Flag: "Event min age is 5 but description says 7"

#### 4. Program Type Validation

**KIDS NIGHT OUT:**
- ✅ Must contain: "Kids Night Out" or "KNO" in description
- 🚨 Flag if: Description says "Clinic"

**CLINIC:**
- ✅ Must contain: "Clinic" in description
- 🚨 Flag if: Description says "Kids Night Out" or starts with "Open Gym"
- 🚨 Flag if: Different skill than title (see Skill Mismatch below)

**OPEN GYM:**
- ✅ Must contain one of: "Open Gym", "Fun Gym", "Gym Fun", "Preschool Fun", "play and explore the gym", or "open to all"
- 🚨 Flag if: Description says "Clinic" or "Kids Night Out"

**Note:** Some gyms call Open Gym by different names (e.g., "Gym Fun Fridays", "Preschool Fun Gym"). The validation handles these variations.

#### 5. Skill Mismatch (CLINIC Only)
Compares skill word in title vs description.

**Example Error:**
- Title: "Back Handspring Clinic"
- Description: "Cartwheel Clinic at Rowland Ballard..."
- 🚨 Flag: "Title says 'back handspring' but description says 'cartwheel'"

**Skills Checked:**
- cartwheel, back handspring, backhandspring, handstand, tumbling
- bars, pullover, pullovers, front flip, roundoff, backbend
- ninja, cheer, beam, vault, floor

#### 6. Flyer Detection (All Programs)
Detects `<img>` tags in description HTML.

- 🖼️ `has_flyer = true` - Event has a flyer image
- `flyer_url` - URL to the image (displayed in event details panel)
- ⚠️ `description_status = 'flyer_only'` - Has image but NO text

#### 7. Availability & Registration (All Programs)
Tracks event availability from iClassPro:

- ℹ️ `sold_out` - Event has no openings (displayed as "FULL" badge)
- ⚠️ `registration_closed` - Registration ended but event hasn't happened yet
- ℹ️ `registration_not_open` - Registration hasn't started yet

## Database Fields

```sql
-- Validation columns in events table
has_flyer               BOOLEAN DEFAULT false
flyer_url               TEXT
description_status      TEXT DEFAULT 'unknown'  -- 'full', 'flyer_only', 'none', 'unknown'
validation_errors       JSONB DEFAULT '[]'::jsonb
acknowledged_errors     JSONB DEFAULT '[]'::jsonb  -- Dismissed warnings

-- Availability columns (from iClassPro)
has_openings            BOOLEAN DEFAULT true
registration_start_date TEXT
registration_end_date   TEXT
```

## Real Errors Caught

This system has caught real copy/paste errors:

| Gym | Issue | Details |
|-----|-------|---------|
| RBK | Wrong skill | "Back Handspring Clinic" with "Cartwheel Clinic" description |
| RBK | Wrong skill | "Cheer Prep Clinic" with "Cartwheel Clinic" description |
| RBA | Wrong date | "January 24" clinic with "December 27th" in description |
| RBA | Wrong program | "Open Gym" event with "Clinic" description |
| HGA | Wrong date | "January 16" event with "December 19" in description |

## How to Clear Validation Data

To reset all validation and re-sync fresh:

```sql
UPDATE events 
SET 
  validation_errors = '[]'::jsonb,
  description_status = 'unknown',
  has_flyer = false,
  flyer_url = NULL;
```

Then re-sync gyms: **🪄 Admin → Open Automated Sync**

## Why CAMP is Skipped

Camp descriptions are complex:
- Mention multiple activities ("open gym", "ninja", "gymnastics")
- Describe schedules across multiple weeks
- Use generic templates that apply to many camps

This caused too many false positives, so CAMPs only get:
- ❌ Flag if NO description at all
- ⚠️ Flag if flyer only (no text)

## Technical Implementation

### Files Involved
- `automation/f12_collect_and_import.py` - Validation logic runs during sync
- `automation/local_api_server.py` - ALLOWED_EVENT_FIELDS includes validation fields
- `src/lib/eventComparison.js` - Comparison includes validation fields
- `src/components/EventsDashboard/SyncModal.js` - Update logic saves validation fields
- `src/components/EventsDashboard.js` - Displays icons on calendar

### Validation Flow
```
iClassPro API 
    ↓
Railway (f12_collect_and_import.py)
    ↓ extracts structured data
    ↓ parses description text
    ↓ compares and generates validation_errors
    ↓
Supabase (stores validation fields)
    ↓
Frontend (displays icons)
```

## Dismissing Validation Warnings

Sometimes a validation warning is a **false positive** - the data is actually correct but the system flagged it anyway. You can dismiss these warnings.

### How to Dismiss a Warning

1. Click on the event in the calendar
2. In the Event Details panel, you'll see the warning with a **[✓ OK]** button
3. Click **[✓ OK]** to dismiss that specific warning
4. The warning won't reappear for that event

### What Happens When You Dismiss

- The error message is saved to `acknowledged_errors` in the database
- The 🚨 icon disappears from the calendar
- The stats no longer count it as an error
- **Change detection still works** - if the event is modified in iClassPro, the sync will still detect it

### If the Event is Updated Later

| Scenario | What Happens |
|----------|--------------|
| Same issue exists | Warning stays dismissed (same message) |
| Issue is fixed | No warning at all (great!) |
| New/different issue | New warning appears (different message) |

### Undoing a Dismissal

If you dismissed something by mistake:
1. Click on the event
2. Look for "✓ X warning(s) verified & dismissed"
3. Click **"Undo all"** to restore the warnings

---

## Changelog

| Date | Change |
|------|--------|
| Dec 28, 2025 | Documentation update - added availability fields, updated access paths |
| Dec 18, 2025 | Added validation warning dismiss feature (✓ OK button, Undo all) |
| Dec 9, 2025 | Initial implementation - date, time, age, program type validation |
| Dec 9, 2025 | Added skill mismatch detection for CLINIC |
| Dec 9, 2025 | Added flyer detection and display |
| Dec 9, 2025 | CAMP validation skipped to avoid false positives |
| Dec 9, 2025 | Added Open Gym variations (Gym Fun, Preschool Fun, etc.) |


