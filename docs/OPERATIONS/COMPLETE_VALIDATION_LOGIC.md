# COMPLETE VALIDATION LOGIC REFERENCE
## f12_collect_and_import.py - Every Validation Check Documented

**File:** `automation/f12_collect_and_import.py`  
**Lines Covered:** 900-1935 (validation section)  
**Last Updated:** February 12, 2026  
**Purpose:** Complete reference of every DATA error and FORMAT error validation check

---

## SECTION 1: DESCRIPTION STATUS CHECKS (Lines 919-928)

### Check: Description Status Classification
**Lines:** 923-928  
**Type:** Status classification (not an error)  
**What it checks:** Whether event has description text, flyer only, or neither

#### Branch 1: No description and no flyer
- **Condition:** `not description and not has_flyer`
- **Result:** `description_status = 'none'`
- **Error Generated:** None (status only)
- **What happens:** Used later for FORMAT error `missing_description`

#### Branch 2: Has flyer but no text
- **Condition:** `has_flyer and not description`
- **Result:** `description_status = 'flyer_only'`
- **Error Generated:** None (status only)
- **What happens:** Used later for FORMAT error `flyer_only_description`

#### Branch 3: Has description text
- **Condition:** `description` (any text exists)
- **Result:** `description_status = 'full'`
- **Error Generated:** None
- **What happens:** Allows validation checks to proceed

---

## SECTION 2: COMPLETENESS CHECKS (FORMAT ERRORS) - Lines 935-1109

These check if REQUIRED information EXISTS in title/description (not whether it's accurate).

### FORMAT ERROR 1: missing_age_in_title

**Error Type:** `missing_age_in_title`  
**Lines:** 989-996  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types (KNO, CLINIC, OPEN GYM, CAMP)

**Source of Truth:** Title must contain age information  
**What it compares:** Title text is scanned for age patterns  
**Triggers Error When:**
- Title does NOT match any of these patterns:
  - `ages?\s*\d{1,2}` → "Ages 5", "Age 12"
  - `students?\s*\d{1,2}` → "Students 5"
  - `\d{1,2}\s*[-–+]` → "5+", "5-12", "5–7"
  - `\d{1,2}\s*to\s*\d{1,2}` → "5 to 12"

**Passes When:**
- Title contains ANY of the age patterns above
- Examples: "Ages 5+", "5-12 years", "Students 8+"

**Multiple Values:** N/A (only checks presence, not value)

**gym_valid_values Check:** No - this is a universal rule, no exceptions

**Message:** "Title missing age (e.g., 'Ages 5+')"

---

### FORMAT ERROR 2: missing_date_in_title

**Error Type:** `missing_date_in_title`  
**Lines:** 998-1006  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types

**Source of Truth:** Title must contain date information  
**What it compares:** Title text is scanned for date patterns  
**Triggers Error When:**
- Title does NOT match any of these patterns:
  - Month names: `jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec` (full or abbreviated)
  - Date formats: `\d{1,2}/\d{1,2}` → "1/9", "01/09"
  - Ordinal dates: `\d{1,2}(st|nd|rd|th)` → "9th", "15th"

**Passes When:**
- Title contains ANY month name (full or abbreviated)
- OR title contains numeric date format
- OR title contains ordinal date
- Examples: "January 9th", "1/9", "Jan 15"

**Multiple Values:** N/A (only checks presence)

**gym_valid_values Check:** No

**Message:** "Title missing date (e.g., 'January 9th')"

---

### FORMAT ERROR 3: missing_program_in_title

**Error Type:** `missing_program_in_title`  
**Lines:** 1011-1042  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types

**Source of Truth:** Title must contain program type keyword matching the event type  
**What it compares:** Title text vs event_type (from iClassPro link_type_id)

**Triggers Error When:**
- For KIDS NIGHT OUT: Title lacks ALL of:
  - "kids night out" (any apostrophe style)
  - "kid night out" (any apostrophe style)
  - "kno"
  - "night out"
  - "parents night out"
  - "ninja night out"
  - Any `program_synonym` rules that map to KIDS NIGHT OUT
- For CLINIC: Title lacks "clinic"
- For OPEN GYM: Title lacks "open gym" (and no matching synonyms)
- For CAMP: Title lacks "camp"

**Passes When:**
- Title contains the appropriate keyword for that event type
- OR title contains a gym-specific synonym from `gym_valid_values`

**Multiple Values:** N/A

**gym_valid_values Check:** YES
- **Checks:** `program_synonym` rules for the gym
- **If exception exists:** Check passes if synonym keyword is in title and target matches event_type
- **If no exception:** Uses default hardcoded keywords
- **Example:** If gym has rule: value="ninja night out", label="KIDS NIGHT OUT", then "ninja night out" in title passes for KNO events

**Message:** "Title missing program type (should include '{EVENT_TYPE}' or similar)"

---

### FORMAT ERROR 4: missing_age_in_description

**Error Type:** `missing_age_in_description`  
**Lines:** 1047-1055  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types (only if description exists)

**Source of Truth:** Description must contain age information  
**What it compares:** Description text is scanned for same age patterns as title  
**Triggers Error When:**
- Description does NOT match age patterns (same as missing_age_in_title)

**Passes When:**
- Description contains any age pattern
- OR no description exists (check is skipped)

**Multiple Values:** N/A

**gym_valid_values Check:** No

**Message:** "Description missing age"

---

### FORMAT ERROR 5: missing_datetime_in_description

**Error Type:** `missing_datetime_in_description`  
**Lines:** 1057-1065  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types (only if description exists)

**Source of Truth:** Description must contain EITHER date OR time  
**What it compares:** Description text for date patterns OR time patterns  
**Triggers Error When:**
- Description has NO date patterns (same as missing_date_in_title)
- AND description has NO time patterns (see has_time_in_text helper)

**Passes When:**
- Description contains date pattern
- OR description contains time pattern
- OR no description exists

**Time Detection Logic (Lines 961-986):**
- **Pre-cleaning removes false positives:**
  - `$\d+...a\s+day` patterns → Removes "$62 a day" (prevents "62 a" match)
  - `ages?\s*\d{1,2}\s*[-–to]+\s*\d{1,2}` → Removes "Ages 4-13" (prevents "13 a" match)
  - `$\d+\s+a(?!\s*m)` → Removes "$50 a" but NOT "$50 am"
- **Pattern 1 (am/pm time):** `\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.|a|p)\b`
  - Matches: "6pm", "6:30pm", "6:30 PM", "6 p.m.", "6:30 p.m."
- **Pattern 2 (colon time):** `\d{1,2}:\d{2}`
  - Matches: "9:00", "9:00 - 3:00" (even without am/pm)

**Multiple Values:** N/A

**gym_valid_values Check:** No

**Message:** "Description missing date/time"

---

### FORMAT ERROR 6: missing_time_in_description

**Error Type:** `missing_time_in_description`  
**Lines:** 1067-1077  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types EXCEPT camps with "Full Day" or "Half Day"

**Source of Truth:** Description must contain specific time  
**What it compares:** Description text for time patterns  
**Triggers Error When:**
- Description has NO time patterns (same detection as missing_datetime)
- AND event is NOT a CAMP with "full day" or "half day" in description

**Passes When:**
- Description contains time pattern
- OR event_type == 'CAMP' AND description contains "full day" or "half day"
- OR no description exists

**Multiple Values:** N/A

**gym_valid_values Check:** No

**EXCEPTION:** Camps can use "Full Day" or "Half Day" instead of specific times

**Message:** "Description missing specific time (e.g., '6:30pm')"

---

### FORMAT ERROR 7: missing_program_in_description

**Error Type:** `missing_program_in_description`  
**Lines:** 1079-1087  
**Severity:** warning  
**Category:** formatting  
**Applies to:** ALL event types (only if description exists)

**Source of Truth:** Description must contain program type keyword  
**What it compares:** Same logic as missing_program_in_title  
**Triggers Error When:**
- Same keyword checks as missing_program_in_title but in description

**Passes When:**
- Description contains appropriate keyword
- OR gym has matching program_synonym rule

**Multiple Values:** N/A

**gym_valid_values Check:** YES (same as missing_program_in_title)

**Message:** "Description missing program type (should mention '{EVENT_TYPE}' or similar)"

---

### FORMAT ERROR 8: clinic_missing_skill

**Error Type:** `clinic_missing_skill`  
**Lines:** 1091-1109  
**Severity:** info  
**Category:** formatting  
**Applies to:** CLINIC events only (when description exists)

**Source of Truth:** Clinic should mention a specific skill  
**What it compares:** Title OR description for skill keywords  
**Triggers Error When:**
- Event type is CLINIC
- AND neither title nor description contains ANY of these skills:
  - 'cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling'
  - 'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend'
  - 'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'tumbl', 'bridge'
  - 'kickover', 'walkover', 'flip flop', 'flip-flop', 'back walkover', 'front walkover'

**Passes When:**
- ANY skill word appears in title OR description
- Skill in title alone is sufficient
- OR event is not a CLINIC

**Multiple Values:** Only needs ONE skill mention (checks title OR description)

**gym_valid_values Check:** No

**Message:** "Clinic description doesn't mention specific skill"

---

## SECTION 3: ACCURACY CHECKS (DATA ERRORS) - Lines 1111-1894

These check if values MATCH when they exist in multiple places.

### DATA ERROR 1: date_mismatch (end before start)

**Error Type:** `date_mismatch`  
**Lines:** 1134-1141  
**Severity:** error  
**Category:** data_error  
**Applies to:** ALL events with valid start_date and end_date

**Source of Truth:** iClassPro endDate field  
**What it compares:** endDate vs startDate  
**Triggers Error When:**
- `endDate < startDate` (end date is BEFORE start date)

**Passes When:**
- `endDate >= startDate`
- OR endDate is missing (defaults to startDate)

**Multiple Values:** N/A

**gym_valid_values Check:** No - this is a logical error

**Message:** "End date ({endDate}) is before start date ({startDate})"

---

### DATA ERROR 2: date_mismatch (wrong month in description)

**Error Type:** `date_mismatch`  
**Lines:** 1160-1202  
**Severity:** error  
**Category:** data_error  
**Applies to:** ALL events with description

**Source of Truth:** iClassPro startDate and endDate fields  
**What it compares:** Month names in description (first 200 chars) vs actual event dates  
**Triggers Error When:**
- Description mentions a month name (full or abbreviated) in first 200 characters
- AND that month is NOT in the valid months list
- AND month is not in a "skip pattern" context (registration, promo, other events)

**Valid Months List (Built-In Logic):**
1. Start month (full name and abbreviation) - e.g., "June", "Jun"
2. End month (full name and abbreviation) - e.g., "July", "Jul"
3. ALL months BETWEEN start and end - e.g., June 28 - August 1 includes July

**Skip Patterns (Lines 1181-1186):**
- Patterns that indicate NON-date context:
  - `(register|registration|sign\s*up|enroll|deadline|closes?|opens?|book\s*by|by)\s+\w*\s*{month}`
  - `(also|check out|see our|upcoming|next|other|more)\s+\w*\s*{month}`
- Examples that DON'T trigger error:
  - "Register by September 1" (registration context)
  - "Check out our October camps" (promotional context)

**Passes When:**
- All month mentions in description match valid months
- OR months are in skip pattern contexts
- OR no description exists

**Multiple Values:**
- Checks EVERY month mention in first 200 chars
- Only flags FIRST mismatch found (breaks after first error)

**gym_valid_values Check:** No

**BUILT-IN RULE:** Multi-month events (camps) automatically include all intermediate months as valid

**Message:** "Event is {actual_month} {day} but description says '{wrong_month}'"

---

### DATA ERROR 3: year_mismatch

**Error Type:** `year_mismatch`  
**Lines:** 1206-1219  
**Severity:** error  
**Category:** data_error  
**Applies to:** ALL events

**Source of Truth:** iClassPro startDate year  
**What it compares:** 4-digit year in TITLE vs actual event year  
**Triggers Error When:**
- Title contains a 4-digit year pattern `\b(20\d{2})\b`
- AND that year doesn't match the actual event year

**Passes When:**
- Title has no 4-digit year
- OR title year matches event year

**Multiple Values:**
- Checks ALL 4-digit years in title
- Only flags FIRST mismatch found (breaks after first)

**gym_valid_values Check:** No

**KNOWN GAP:** Only checks TITLE for wrong year, not description

**Message:** "Title says {title_year} but event is in {actual_year}"

---

### DATA ERROR 4: time_mismatch (title)

**Error Type:** `time_mismatch`  
**Lines:** 1221-1300  
**Severity:** warning  
**Category:** data_error  
**Applies to:** ALL events with time_str from iClassPro

**Source of Truth:** iClassPro schedule.startTime field (stored as time_str)  
**What it compares:** Time hours in title vs structured time from iClassPro

**How it Works:**
1. Extract ALL hours from structured time (Lines 1225-1236)
   - Parse patterns: `(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?`
   - Convert to 24-hour format for comparison
   - Example: "6:30 PM - 9:30 PM" → hours = {18, 21}

2. Check times in title (Lines 1240-1281, called at 1288)
   - Pre-clean text to remove false positives:
     - Price patterns: "$62 a day" removed
     - Age patterns: "Ages 4-13" removed
     - Standalone prices: "$50 a" (but not "$50 am") removed
   - Find all time patterns in first 200 chars
   - Parse hour and convert to 24-hour
   - Check if EXACT hour matches ANY iClassPro hour

**Triggers Error When:**
- Title contains a time pattern
- AND that time's hour does NOT match ANY hour in iClassPro time_str
- AND that time is NOT in gym's extra valid times (gym_valid_values)

**Passes When:**
- Title times match iClassPro times (exact hour match)
- OR title time is in gym's `time` exception rules
- OR no times found in title

**Multiple Values:**
- Checks EVERY time found in title
- Only flags FIRST mismatch (returns first mismatched time)
- iClassPro can have multiple times (start-end range) - ANY match is valid

**gym_valid_values Check:** YES
- **Rule type:** `time`
- **If exception exists:** Time that would normally error is allowed
- **Example:** Gym has rule: value="8:30 AM", label="Early Dropoff" → "8:30 AM" in title won't error even if iClass says "9:00 AM"

**Message:** "iClass time is {time_str} but title says {mismatched_time}"

---

### DATA ERROR 5: time_mismatch (description)

**Error Type:** `time_mismatch`  
**Lines:** 1302-1315  
**Severity:** warning  
**Category:** data_error  
**Applies to:** ALL events with time_str and description

**Source of Truth:** iClassPro schedule.startTime field  
**What it compares:** Time hours in description vs structured time from iClassPro  
**Logic:** IDENTICAL to time_mismatch (title) but checks description instead

**Triggers Error When:**
- Description contains a time pattern (first 300 chars)
- AND that time's hour does NOT match ANY hour in iClassPro time_str
- AND that time is NOT in gym's extra valid times

**Passes When:**
- Description times match iClassPro times
- OR description time is in gym's `time` exception rules
- OR no times found in description
- OR no description exists

**Multiple Values:** Same as title - checks all, flags first mismatch

**gym_valid_values Check:** YES (same as title)

**Message:** "iClass time is {time_str} but description says {mismatched_time}"

---

### DATA ERROR 6: age_mismatch (iClass vs title)

**Error Type:** `age_mismatch`  
**Lines:** 1320-1346  
**Severity:** warning  
**Category:** data_error  
**Applies to:** ALL events when both iClass age_min AND title age exist

**Source of Truth:** iClassPro minAge field  
**What it compares:** iClassPro age_min vs minimum age extracted from title  
**Triggers Error When:**
- iClassPro has age_min (not None)
- AND title contains age pattern (extracted via extract_min_age helper)
- AND iClassPro age_min ≠ title age (exact match required)

**Age Extraction Logic (Lines 1321-1331):**
- Searches first 200 chars of title
- Patterns: `ages?\s*(\d{1,2})\s*[-–to+]|ages?\s*(\d{1,2})\b|(\d{1,2})\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)`
- Returns FIRST number found (minimum age)
- Examples: "Ages 5-12" → 5, "Ages 5+" → 5, "Age 8" → 8

**Passes When:**
- iClassPro age_min matches title age exactly
- OR iClassPro has no age_min
- OR title has no age pattern
- OR both are missing

**Multiple Values:** Only extracts MINIMUM age (first number in range)

**gym_valid_values Check:** No

**Message:** "iClass min age is {age_min} but title says {title_age}"

---

### DATA ERROR 7: age_mismatch (iClass vs description)

**Error Type:** `age_mismatch`  
**Lines:** 1348-1357  
**Severity:** warning  
**Category:** data_error  
**Applies to:** ALL events when both iClass age_min AND description age exist

**Source of Truth:** iClassPro minAge field  
**What it compares:** iClassPro age_min vs minimum age extracted from description  
**Logic:** IDENTICAL to age_mismatch (iClass vs title) but checks description

**Triggers Error When:**
- iClassPro has age_min
- AND description contains age pattern (first 300 chars)
- AND ages don't match exactly

**Passes When:**
- Ages match exactly
- OR either source is missing
- OR no description exists

**Multiple Values:** Only extracts minimum age

**gym_valid_values Check:** No

**Message:** "iClass min age is {age_min} but description says {desc_age}"

---

### DATA ERROR 8: age_mismatch (title vs description)

**Error Type:** `age_mismatch`  
**Lines:** 1359-1368  
**Severity:** warning  
**Category:** data_error  
**Applies to:** ALL events when BOTH title AND description have age

**Source of Truth:** Title and description should agree  
**What it compares:** Age in title vs age in description  
**Triggers Error When:**
- Title has age pattern
- AND description has age pattern
- AND they don't match exactly
- **INDEPENDENT CHECK:** Runs even if iClassPro age_min is missing

**Passes When:**
- Title age matches description age
- OR either is missing

**Multiple Values:** Only compares minimum ages

**gym_valid_values Check:** No

**NOTE:** Max age is NOT validated - managers often omit max or use "+" notation

**Message:** "Title says age {title_age} but description says {desc_age}"

---

### DATA ERROR 9: day_mismatch

**Error Type:** `day_mismatch`  
**Lines:** 1372-1401  
**Severity:** warning  
**Category:** data_error  
**Applies to:** Non-CAMP events with day_of_week and description

**Source of Truth:** Calculated day_of_week from iClassPro startDate  
**What it compares:** Actual day of week vs day names in description  
**Triggers Error When:**
- Event is NOT a CAMP (camps span multiple days so day mentions are expected)
- AND description (first 200 chars) mentions a different day of week
- AND that day is NOT part of a day range pattern (see pre-cleaning)

**Pre-Cleaning Logic (Lines 1385-1389):**
Removes patterns that describe schedules, not event day:
- `(monday|...)\s*(?:[-–]|to|thru|through)\s*(monday|...)`
  - Removes: "Monday-Friday", "Mon-Fri", "Monday through Friday"
- `\([^)]*(?:monday|mon)[-–][^)]*(?:friday|fri)[^)]*\)`
  - Removes: "(Monday-Friday)", "(Mon-Fri schedule)"

**Passes When:**
- Description mentions correct day
- OR description has no day mentions
- OR all day mentions are in range patterns (removed by pre-clean)
- OR event is a CAMP
- OR no description exists

**Multiple Values:**
- Checks against ALL 7 days (full names and abbreviations)
- Flags FIRST different day found (breaks after first)

**gym_valid_values Check:** No

**Message:** "Event is on {actual_day} but description says '{wrong_day}'"

---

### DATA ERROR 10: program_mismatch (iClass KNO vs title Clinic)

**Error Type:** `program_mismatch`  
**Lines:** 1403-1436  
**Severity:** error  
**Category:** data_error  
**Applies to:** Events where iClassPro type conflicts with title keywords

**Source of Truth:** iClassPro link_type_id (mapped to event_type)  
**What it compares:** Event type from iClassPro vs program keywords in TITLE

**Keyword Detection (Lines 1407-1426):**
- **KNO keywords:** 'kids night out', "kid's night out", "kids' night out", 'kno', 'ninja night out'
  - Plus any `program_synonym` rules mapping to KIDS NIGHT OUT
- **Clinic keywords:** 'clinic'
  - Plus any `program_synonym` rules mapping to CLINIC
- **Open Gym keywords:** 'open gym'
  - Plus any `program_synonym` rules mapping to OPEN GYM

**Triggers Error When (6 specific combinations):**

1. **iClass = KNO, title says Clinic** (Lines 1429-1436)
   - Condition: `event_type == 'KIDS NIGHT OUT' and title_has_clinic and not title_has_kno`
   - Message: "iClass says KNO but title says 'Clinic'"

2. **iClass = KNO, title says Open Gym** (Lines 1438-1445)
   - Condition: `event_type == 'KIDS NIGHT OUT' and title_has_open_gym and not title_has_kno`
   - Message: "iClass says KNO but title says 'Open Gym'"

3. **iClass = CLINIC, title says KNO** (Lines 1447-1454)
   - Condition: `event_type == 'CLINIC' and title_has_kno`
   - Message: "iClass says CLINIC but title says 'Kids Night Out'"

4. **iClass = CLINIC, title says Open Gym** (Lines 1456-1463)
   - Condition: `event_type == 'CLINIC' and title_has_open_gym and not title_has_clinic`
   - Message: "iClass says CLINIC but title says 'Open Gym'"

5. **iClass = OPEN GYM, title says KNO** (Lines 1465-1472)
   - Condition: `event_type == 'OPEN GYM' and title_has_kno`
   - Message: "iClass says OPEN GYM but title says 'Kids Night Out'"

6. **iClass = OPEN GYM, title says Clinic** (Lines 1474-1481)
   - Condition: `event_type == 'OPEN GYM' and title_has_clinic and not title_has_open_gym`
   - Message: "iClass says OPEN GYM but title says 'Clinic'"

**Passes When:**
- Title keywords match iClassPro event type
- OR title has no conflicting keywords

**Multiple Values:** N/A (boolean checks)

**gym_valid_values Check:** YES
- **Rule type:** `program_synonym`
- **How it works:** Adds custom keywords to each program type's keyword list
- **Example:** If gym has "ninja night out" → KIDS NIGHT OUT, it's added to kno_title_keywords

**Message:** Varies by specific mismatch (see above)

---

### DATA ERROR 11: program_mismatch (KNO description missing keyword)

**Error Type:** `program_mismatch`  
**Lines:** 1484-1509  
**Severity:** warning (missing) or error (wrong program)  
**Category:** data_error or formatting  
**Applies to:** KIDS NIGHT OUT events with description

**Source of Truth:** iClassPro link_type_id = "kids_night_out"  
**What it compares:** Event type vs keywords in DESCRIPTION

**Keyword Detection:**
- Strip apostrophes from description: `replace("'", "").replace("'", "").replace("`", "")`
- **Has KNO:** 'kids night out' OR 'kid night out' (in stripped) OR 'kno' (in original)
- **Has Clinic:** 'clinic' in first 100 chars of description

**Triggers Error When (2 cases):**

1. **Missing KNO keyword** (Lines 1493-1500)
   - Condition: `not has_kno`
   - Severity: warning
   - Category: formatting
   - Message: "KNO event but description doesn't mention 'Kids Night Out' or 'KNO'"

2. **Description says Clinic** (Lines 1502-1509)
   - Condition: `has_clinic` (found in first 100 chars)
   - Severity: error
   - Category: data_error
   - Message: "KNO event but description says 'Clinic'"

**Passes When:**
- Description contains KNO keyword
- AND description doesn't start with 'Clinic'
- OR no description exists

**Multiple Values:** N/A

**gym_valid_values Check:** No (for KNO description check)

**Message:** See above

---

### DATA ERROR 12: program_mismatch (CLINIC description checks)

**Error Type:** `program_mismatch`  
**Lines:** 1511-1546  
**Severity:** warning (missing) or error (wrong program)  
**Category:** data_error or formatting  
**Applies to:** CLINIC events with description

**Source of Truth:** iClassPro link_type_id = "skill_clinics"  
**What it compares:** Event type vs keywords in DESCRIPTION

**Keyword Detection:**
- **Has Clinic:** 'clinic' in description
- **Has KNO:** 'kids night out' OR 'kid night out' (no apostrophes) in first 100 chars, OR description starts with 'kno'
- **Has Open Gym:** description (first 100 chars) STARTS WITH 'open gym'

**Triggers Error When (3 cases):**

1. **Missing Clinic keyword** (Lines 1521-1528)
   - Condition: `not has_clinic`
   - Severity: warning
   - Category: formatting
   - Message: "CLINIC event but description doesn't mention 'Clinic'"

2. **Description says KNO** (Lines 1530-1537)
   - Condition: `has_kno`
   - Severity: error
   - Category: data_error
   - Message: "CLINIC event but description says 'Kids Night Out'"

3. **Description starts with Open Gym** (Lines 1539-1546)
   - Condition: `has_open_gym`
   - Severity: error
   - Category: data_error
   - Message: "CLINIC event but description starts with 'Open Gym'"

**Passes When:**
- Description contains 'clinic'
- AND doesn't say KNO or start with Open Gym
- OR no description exists

**Multiple Values:** N/A

**gym_valid_values Check:** No

**Message:** See above

---

### DATA ERROR 13: skill_mismatch

**Error Type:** `skill_mismatch`  
**Lines:** 1548-1582  
**Severity:** error  
**Category:** data_error  
**Applies to:** CLINIC events only

**Source of Truth:** Title and description should mention same skill  
**What it compares:** Skill keyword in TITLE vs skill keyword in DESCRIPTION (first 150 chars)

**Skill Keywords List (Lines 1550-1553):**
- 'cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling'
- 'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend'
- 'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'tumbl', 'bridge'
- 'kickover', 'walkover', 'flip flop', 'flip-flop', 'back walkover', 'front walkover'

**How it Works:**
1. Find FIRST skill in title (breaks after first match)
2. Find FIRST skill in description first 150 chars
3. Compare if both exist and differ

**Triggers Error When:**
- Title has a skill keyword
- AND description has a DIFFERENT skill keyword
- AND normalized versions don't match (spaces removed)
  - Example: "back handspring" normalized to "backhandspring"

**Passes When:**
- Title and description have SAME skill
- OR only one has a skill (no comparison possible)
- OR neither has a skill
- OR normalized versions match

**Multiple Values:**
- Only compares FIRST skill found in each location
- Doesn't check for multiple skills

**gym_valid_values Check:** No

**Normalization:** Removes spaces for comparison ("back handspring" == "backhandspring")

**Message:** "Title says '{title_skill}' but description says '{desc_skill}'"

---

### DATA ERROR 14: program_mismatch (OPEN GYM description checks)

**Error Type:** `program_mismatch`  
**Lines:** 1584-1630  
**Severity:** warning (missing) or error (wrong program)  
**Category:** data_error or formatting  
**Applies to:** OPEN GYM events with description

**Source of Truth:** iClassPro link_type_id = "open_gym"  
**What it compares:** Event type vs keywords in DESCRIPTION

**Keyword Detection:**
- **Has Open Gym:** 
  - 'open gym' in description
  - OR 'play and explore the gym' in description
  - OR 'open to all' in description
  - OR any `program_synonym` rule mapping to OPEN GYM
- **Has Clinic:** 'clinic' in first 50 chars OR description (first 100 chars) starts with 'clinic'
- **Has KNO:** 'kids night out' OR 'kid night out' (no apostrophes) in first 100 chars

**Triggers Error When (3 cases):**

1. **Missing Open Gym keyword** (Lines 1605-1612)
   - Condition: `not has_open_gym` (after checking synonyms)
   - Severity: warning
   - Category: formatting
   - Message: "OPEN GYM event but description doesn't mention 'Open Gym' or similar"

2. **Description says Clinic** (Lines 1614-1621)
   - Condition: `has_clinic`
   - Severity: error
   - Category: data_error
   - Message: "OPEN GYM event but description says 'Clinic'"

3. **Description says KNO** (Lines 1623-1630)
   - Condition: `has_kno`
   - Severity: error
   - Category: data_error
   - Message: "OPEN GYM event but description says 'Kids Night Out'"

**Passes When:**
- Description contains Open Gym phrase or synonym
- AND doesn't say Clinic or KNO
- OR no description exists

**Multiple Values:** N/A

**gym_valid_values Check:** YES
- **Rule type:** `program_synonym`
- **How it works:** Checks for gym-specific synonyms that map to OPEN GYM
- **Example:** If gym has "gym fun friday" → OPEN GYM, then "gym fun friday" in description passes

**Message:** See above

---

### DATA ERROR 15: program_mismatch (CAMP description checks)

**Error Type:** `program_mismatch`  
**Lines:** 1632-1677  
**Severity:** error  
**Category:** data_error  
**Applies to:** CAMP events with description

**Source of Truth:** iClassPro link_type_id in CAMP_LINK_TYPES  
**What it compares:** Event type vs keywords in DESCRIPTION and TITLE

**Keyword Detection:**
- **Has Clinic Start:** description (first 50 chars) STARTS WITH 'clinic'
- **Has KNO Start:** description (first 100 chars, no apostrophes) starts with 'kids night out' OR 'kid night out' OR description (first 50 chars) starts with 'kno '

**Triggers Error When (4 cases):**

1. **Description starts with Clinic** (Lines 1642-1649)
   - Condition: `has_clinic_start`
   - Message: "CAMP event but description starts with 'Clinic'"

2. **Description starts with KNO** (Lines 1651-1658)
   - Condition: `has_kno_start`
   - Message: "CAMP event but description starts with 'Kids Night Out'"

3. **Title says KNO** (Lines 1661-1668)
   - Condition: `title_has_kno` (from earlier title keyword detection)
   - Message: "iClass says CAMP but title says 'Kids Night Out'"

4. **Title says Clinic** (Lines 1670-1677)
   - Condition: `title_has_clinic` (from earlier title keyword detection)
   - Message: "iClass says CAMP but title says 'Clinic'"

**Passes When:**
- Description doesn't start with wrong program type
- AND title doesn't contain conflicting keywords
- OR no description exists

**Multiple Values:** N/A

**gym_valid_values Check:** No (for CAMP checks)

**NOTE:** CAMPs CAN mention "open gym" or "ninja" as ACTIVITIES - that's OK. Only flags if description STARTS with wrong program type.

**Message:** See above

---

### DATA ERROR 16: title_desc_mismatch (6 cross-checks)

**Error Type:** `title_desc_mismatch`  
**Lines:** 1679-1764  
**Severity:** error  
**Category:** data_error  
**Applies to:** ALL events with description

**Source of Truth:** Title and description should agree on program type  
**What it compares:** Program keywords in TITLE vs DESCRIPTION (first 150 chars)

**This is INDEPENDENT of iClassPro type** - catches copy/paste errors regardless of which page the event is on.

**Keyword Re-Detection (Lines 1683-1704):**
- **Title keywords:**
  - `title_has_clinic`: 'clinic' in title
  - `title_has_kno`: 'kids night out' (no apostrophes) OR 'kid night out' OR title starts with 'kno ' OR ' kno ' in title
  - `title_has_open_gym`: 'open gym' in title OR gym's `program_synonym` rules mapping to OPEN GYM
- **Description keywords (first 150 chars):**
  - `desc_has_clinic`: 'clinic' in first 150 chars
  - `desc_has_kno`: 'kids night out' (no apostrophes) OR 'kid night out' OR starts with 'kno '
  - `desc_has_open_gym`: starts with 'open gym'

**Triggers Error When (6 specific combinations):**

1. **Title Clinic, Description KNO** (Lines 1707-1714)
   - Condition: `title_has_clinic and desc_has_kno`
   - Message: "Title says 'Clinic' but description says 'Kids Night Out'"

2. **Title KNO, Description Clinic** (Lines 1716-1724)
   - Condition: `title_has_kno and desc_has_clinic`
   - Message: "Title says 'Kids Night Out' but description says 'Clinic'"

3. **Title Open Gym, Description KNO** (Lines 1726-1734)
   - Condition: `title_has_open_gym and desc_has_kno`
   - Message: "Title says 'Open Gym' but description says 'Kids Night Out'"

4. **Title KNO, Description Open Gym** (Lines 1736-1744)
   - Condition: `title_has_kno and desc_has_open_gym`
   - Message: "Title says 'Kids Night Out' but description starts with 'Open Gym'"

5. **Title Clinic, Description Open Gym** (Lines 1746-1754)
   - Condition: `title_has_clinic and desc_has_open_gym`
   - Message: "Title says 'Clinic' but description starts with 'Open Gym'"

6. **Title Open Gym, Description Clinic** (Lines 1756-1764)
   - Condition: `title_has_open_gym and desc_has_clinic`
   - Message: "Title says 'Open Gym' but description says 'Clinic'"

**Passes When:**
- Title and description agree on program type
- OR no conflicting keywords found
- OR no description exists

**Multiple Values:** N/A (boolean checks)

**gym_valid_values Check:** YES (for Open Gym synonyms only)

**Purpose:** Catches copy/paste errors where manager used wrong template

**Message:** Varies by specific mismatch (see above)

---

### DATA ERROR 17: missing_price_in_description

**Error Type:** `missing_price_in_description`  
**Lines:** 1772-1779  
**Severity:** error  
**Category:** formatting  
**Applies to:** ALL events with description

**Source of Truth:** Description must contain price  
**What it compares:** Regex search for dollar amounts in description  
**Triggers Error When:**
- Description exists
- AND no dollar amounts found with pattern `\$(\d+(?:\.\d{2})?)`
  - Matches: "$25", "$25.00", "$125"

**Passes When:**
- At least one $ amount found in description
- OR no description exists

**Multiple Values:** Only checks for presence of ANY price

**gym_valid_values Check:** No

**Message:** "Price not found in description"

---

### DATA ERROR 18: price_mismatch (title vs description)

**Error Type:** `price_mismatch`  
**Lines:** 1768-1794  
**Severity:** error  
**Category:** data_error  
**Applies to:** Events with price in BOTH title AND description

**Source of Truth:** Title and description prices should match  
**What it compares:** First price in TITLE vs ALL prices in DESCRIPTION

**Price Extraction (Line 1768-1769):**
- Pattern: `\$(\d+(?:\.\d{2})?)`
- `title_prices`: List of ALL dollar amounts in title
- `desc_prices`: List of ALL dollar amounts in description

**Triggers Error When:**
- Title has at least one price
- AND description has at least one price
- AND first title price does NOT appear in ANY description price (within $1 tolerance)

**Tolerance:** `abs(title_price - desc_price) <= 1`
- $50 title matches $49, $50, or $51 in description
- Accounts for rounding differences

**Passes When:**
- Title price matches ANY description price (within $1)
- OR title has no price
- OR description has no price

**Multiple Values:**
- Uses FIRST price from title
- Compares against ALL prices in description
- Title price is valid if it matches ANY description price

**gym_valid_values Check:** No

**Message:** "Title says ${title_price} but description prices are ${desc_prices}"

---

### DATA ERROR 19: camp_price_mismatch

**Error Type:** `camp_price_mismatch`  
**Lines:** 1796-1852  
**Severity:** warning  
**Category:** data_error  
**Applies to:** CAMP events with prices

**Source of Truth:** Supabase `camp_pricing` table  
**What it compares:** Prices found in title OR description vs valid camp prices for gym

**Valid Prices (Lines 1806-1834):**
1. From `camp_pricing` table (4 types, NULL values skipped):
   - `full_day_daily`
   - `full_day_weekly`
   - `half_day_daily`
   - `half_day_weekly`
2. From `gym_valid_values` table:
   - `rule_type = 'price'` for this gym
   - Example: Before Care $20, After Care $20

**Price Extraction:**
- `all_camp_prices`: UNION of title_prices and desc_prices (deduplicated)
- Checks prices from BOTH locations

**Triggers Error When:**
- Event type is CAMP
- AND at least one price found in title or description
- AND gym has camp pricing data
- AND at least one price does NOT match any valid price (within $2 tolerance)

**Tolerance:** `abs(camp_price - valid_price) <= 2`
- Accounts for rounding differences
- $50 matches $48-$52

**Passes When:**
- All camp prices match valid prices (within $2)
- OR no prices found
- OR gym has no pricing data
- OR event is not a CAMP

**Multiple Values:**
- Checks EVERY price found in title or description
- Flags FIRST invalid price (breaks after first error)
- A price is valid if it matches ANY valid camp price for that gym

**gym_valid_values Check:** YES
- **Rule type:** `price`
- **How it works:** Adds custom valid prices to the list
- **Example:** Before Care $20 exception added to valid prices
- **If exception exists:** That price won't trigger error
- **If no exception:** Only camp_pricing table prices are valid

**Message:** "Camp price ${price} doesn't match any valid price for {gym_id}. Valid: {list}"

---

### DATA ERROR 20: event_price_mismatch

**Error Type:** `event_price_mismatch`  
**Lines:** 1854-1893  
**Severity:** error  
**Category:** data_error  
**Applies to:** CLINIC, KIDS NIGHT OUT, OPEN GYM events with prices

**Source of Truth:** Supabase `event_pricing` table (with effective_date support)  
**What it compares:** Prices in title OR description vs expected prices for gym/event type

**Valid Prices (Lines 1861-1873):**
1. From `event_pricing` table:
   - Filtered by gym_id and event_type
   - Uses effective_date to get correct price for the event date
   - Returns list of valid prices (can have multiple due to effective dates)
2. From `gym_valid_values` table:
   - `rule_type = 'price'` for this gym
   - Added to valid prices list

**Price Collection:**
- `all_event_prices`: UNION of title_prices and desc_prices (deduplicated)
- Converts to float set

**Triggers Error When:**
- Event type is CLINIC, KIDS NIGHT OUT, or OPEN GYM
- AND at least one price found in description
- AND gym has pricing data for this event type
- AND NO valid price appears in ANY found price (within $1 tolerance)

**Tolerance:** `abs(found_price - valid_price) <= 1`

**Passes When:**
- At least one valid price found in title or description
- OR no prices found in description
- OR gym has no pricing data for this event type
- OR event type is not covered (CAMP, SPECIAL EVENT)

**Multiple Values:**
- Checks if ANY valid price appears in ANY found price
- Uses nested any() logic: checks each valid price against each found price
- Success if ANY combination matches

**gym_valid_values Check:** YES
- **Rule type:** `price`
- **How it works:** Adds custom valid prices to the list
- **Example:** Sibling discount $40 added to valid prices
- **If exception exists:** That price won't trigger error
- **If no exception:** Only event_pricing table prices are valid

**Effective Date Support:**
- System automatically uses correct price based on event date
- Handles price changes (e.g., increase on Monday)
- No manual configuration needed

**Message:** "{event_type} expected price ({valid_prices}) not found in description for {gym_id}. Found: {found_prices}"

---

## SECTION 4: STATUS CHECKS (Not Errors) - Lines 1895-1934

These are INFORMATIONAL status fields, not validation errors.

### STATUS CHECK 1: registration_closed

**Error Type:** `registration_closed`  
**Lines:** 1900-1917  
**Severity:** warning  
**Category:** status  
**Applies to:** Events with registration_end_date and start_date

**Source of Truth:** iClassPro registrationEndDate field  
**What it compares:** Registration end date vs today vs event start date  
**Triggers When:**
- `registration_end_date < today`
- AND `event_start_date >= today`
- (Registration closed but event hasn't happened yet)

**Passes When:**
- Registration still open
- OR event already happened
- OR dates missing

**Multiple Values:** N/A

**gym_valid_values Check:** No

**Purpose:** Informational - shows "registration closed" status

**Message:** "Registration closed on {date} but event is {event_date}"

---

### STATUS CHECK 2: registration_not_open

**Error Type:** `registration_not_open`  
**Lines:** 1919-1934  
**Severity:** info  
**Category:** status  
**Applies to:** Events with registration_start_date

**Source of Truth:** iClassPro registrationStartDate field  
**What it compares:** Registration start date vs today  
**Triggers When:**
- `registration_start_date > today`
- (Registration hasn't opened yet)

**Passes When:**
- Registration already open
- OR date missing

**Multiple Values:** N/A

**gym_valid_values Check:** No

**Purpose:** Informational - shows "registration opens soon" status

**Message:** "Registration opens {date}"

---

## SECTION 5: VALIDATION SUMMARY

### Error Type Categories

**data_error (Red - High Priority):**
- date_mismatch (end before start)
- date_mismatch (wrong month)
- year_mismatch
- time_mismatch
- age_mismatch
- day_mismatch
- program_mismatch (severe - wrong program type)
- skill_mismatch
- title_desc_mismatch
- price_mismatch
- camp_price_mismatch
- event_price_mismatch

**formatting (Orange - Warning):**
- missing_age_in_title
- missing_date_in_title
- missing_program_in_title
- missing_age_in_description
- missing_datetime_in_description
- missing_time_in_description
- missing_program_in_description
- clinic_missing_skill
- missing_price_in_description
- program_mismatch (minor - missing keyword)

**status (Info - Informational):**
- registration_closed
- registration_not_open

---

## gym_valid_values Integration Summary

### Rule Types That Affect Validation

**1. program_synonym:**
- **Affects:** missing_program_in_title, missing_program_in_description, program_mismatch checks
- **How:** Adds custom keywords that map to program types
- **Example:** value="ninja night out", label="KIDS NIGHT OUT" → "ninja night out" passes for KNO events
- **Tables checked:** Lines 1016-1021, 1410-1422, 1594-1598, 1691-1695

**2. time:**
- **Affects:** time_mismatch (title and description)
- **How:** Adds valid time exceptions that won't trigger error
- **Example:** value="8:30 AM", label="Early Dropoff" → "8:30 AM" won't error even if iClass says "9:00 AM"
- **Tables checked:** Lines 1284-1300, 1305-1315

**3. price:**
- **Affects:** camp_price_mismatch, event_price_mismatch
- **How:** Adds valid price exceptions that won't trigger error
- **Example:** value="20", label="Before Care" → $20 won't error for camps
- **Tables checked:** Lines 1826-1834, 1866-1873

### Global Rules (gym_id = 'ALL')
- Rules with gym_id = 'ALL' apply to ALL gyms
- Gym-specific rules override or extend global rules

---

## Key Patterns and Design Decisions

### Pre-Cleaning for False Positives
1. **Time detection:** Removes "$62 a day", "Ages 4-13" patterns before checking for times
2. **Day detection:** Removes "Monday-Friday" range patterns before checking for day mismatches

### Tolerance Values
- **Time:** Exact hour match required (no tolerance)
- **Age:** Exact match required (no tolerance)
- **Price (title vs desc):** ±$1 tolerance
- **Camp price:** ±$2 tolerance
- **Event price:** ±$1 tolerance

### Character Limits for Scanning
- **Title:** 200 chars for times, 200 chars for ages
- **Description:** 300 chars for times, 300 chars for ages, 150 chars for skills, 200 chars for days, 100 chars for program types (some checks)

### Multiple Value Handling
- **Times:** Event can have multiple times (range) - found time must match ANY event time
- **Prices:** Description can have multiple prices - title price must match ANY description price
- **Months:** Event can span multiple months - all intermediate months are valid
- **Skills:** Only first skill in each location is compared

### Apostrophe Handling
- Program keyword checks often strip apostrophes: "Kids Night Out" = "Kid's Night Out" = "Kids' Night Out"

---

## NOT YET IMPLEMENTED

### Known Gaps
1. **Wrong year in DESCRIPTION** - Only checks title for wrong year (Lines 1206-1219)
2. **program_ignore rule type** - Planned but not built (for ignoring "open gym" when it's a station name)
3. **Date ranges not validated** - "Jan 15-17" not checked against actual dates
4. **Flyer-only events** - Can't validate text if only image exists

---

**End of Complete Validation Logic Reference**

**Total Checks:** 20 data/format errors + 2 status checks = 22 validation checks  
**Lines of Code:** ~1035 lines of validation logic (Lines 900-1935)
