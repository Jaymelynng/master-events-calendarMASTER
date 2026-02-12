# COMPLETE VALIDATION LOGIC REFERENCE
**File:** `automation/f12_collect_and_import.py`  
**Lines:** 920-1997  
**Last Updated:** February 12, 2026  
**Purpose:** Complete documentation of every single validation check

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Helper Functions](#helper-functions)
3. [FORMAT Errors (Completeness Checks)](#format-errors-completeness-checks)
4. [DATA Errors (Accuracy Checks)](#data-errors-accuracy-checks)
5. [STATUS Errors](#status-errors)
6. [Summary Tables](#summary-tables)

---

## OVERVIEW

This document covers **EVERY** validation check in `f12_collect_and_import.py` from top to bottom. Each check documents:
1. **Error Type Name** - The `type` field in validation_errors
2. **Source of Truth** - What is considered correct
3. **What it Compares Against** - What is being checked
4. **Triggers Error** - Conditions that create an error
5. **Triggers Pass** - Conditions that pass validation
6. **Multiple Values** - How it handles multiple prices, times, etc.
7. **gym_valid_values Check** - Whether it checks per-gym exceptions

**Event Types Validated:** ALL types (KIDS NIGHT OUT, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT)

**Categories:**
- **FORMAT errors (category: "formatting")** - Something is MISSING (required info not found)
- **DATA errors (category: "data_error")** - Something is WRONG (mismatch between sources)
- **STATUS errors (category: "status")** - Registration status information

---

## HELPER FUNCTIONS

### has_age_in_text(text)
**Location:** Lines 943-948  
**Purpose:** Check if age range exists in text  
**Patterns:** `Ages 5`, `Age 5`, `5+`, `5-12`, `Students 5+`, `5 to 12`  
**Returns:** Boolean

### has_date_in_text(text)
**Location:** Lines 951-958  
**Purpose:** Check if date exists in text  
**Patterns:** Month names (Jan/January), date formats (`1/9`, `01/09`, `9th`)  
**Returns:** Boolean

### has_time_in_text(text)
**Location:** Lines 961-986  
**Purpose:** Check if time exists in text  
**Pre-cleaning:** Removes patterns that cause false positives:
- `$62 a day` (removes so "62 a" isn't matched as time)
- `Ages 4-13` (removes so "13 a" isn't matched)
- `$50 a` (but NOT `$50 am`)
**Patterns:** `6:30pm`, `6:30 pm`, `6pm`, `6 pm`, `6:30p`, `6:30 p.m.`, `9:00 - 3:00`  
**Returns:** Boolean

### has_program_type_in_text(text, etype)
**Location:** Lines 1011-1033  
**Purpose:** Check if program type keyword exists in text  
**gym_valid_values Check:** YES - checks `program_synonym` rules first  
**If Exception Exists:** Returns True (passes check)  
**If No Exception:** Checks hardcoded keywords  
**Keywords by Type:**
- KIDS NIGHT OUT: `kids night out`, `kid night out`, `kno`, `night out`, `parents night out`, `ninja night out`
- CLINIC: `clinic`
- OPEN GYM: `open gym`
- CAMP: `camp`

### extract_min_age(text, char_limit)
**Location:** Lines 1321-1331  
**Purpose:** Extract minimum age from text  
**Patterns:** `Ages 5-12`, `Ages 5+`, `Age 5`, `5-12 years`  
**Returns:** Integer or None

### check_times_in_text(text, text_name, char_limit)
**Location:** Lines 1240-1281  
**Purpose:** Check if times in text match event times (format-tolerant)  
**Pre-cleaning:** Same as `has_time_in_text()` - removes false positive patterns  
**Returns:** Mismatched time string or None

---

## FORMAT ERRORS (COMPLETENESS CHECKS)

These check if REQUIRED fields EXIST (not just if they're accurate).  
**Applies to:** ALL event types (KIDS NIGHT OUT, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT)

---

### 1. missing_age_in_title
**Lines:** 989-996  
**Error Type:** `missing_age_in_title`  
**Source of Truth:** N/A (checking existence, not accuracy)  
**Compares Against:** Title text  
**Triggers Error:** Title does NOT contain age pattern  
**Triggers Pass:** Title contains: `Ages 5`, `Age 5`, `5+`, `5-12`, `Students 5+`  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "Title missing age (e.g., 'Ages 5+')"

---

### 2. missing_date_in_title
**Lines:** 999-1006  
**Error Type:** `missing_date_in_title`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Title text  
**Triggers Error:** Title does NOT contain date pattern  
**Triggers Pass:** Title contains: month name (Jan/January), `1/9`, `01/09`, `9th`  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "Title missing date (e.g., 'January 9th')"

---

### 3. missing_program_in_title
**Lines:** 1035-1042  
**Error Type:** `missing_program_in_title`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Title text  
**Triggers Error:** Title does NOT contain program type keyword for this event type  
**Triggers Pass:** 
- Title contains program keyword (KNO, clinic, open gym, camp)
- OR title matches `program_synonym` rule from gym_valid_values
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules FIRST (lines 1016-1021)  
**If Exception Exists:** Passes check if synonym keyword found  
**If No Exception:** Checks hardcoded keywords  
**Severity:** warning  
**Category:** formatting  
**Message:** "Title missing program type (should include '{event_type.title()}' or similar)"

---

### 4. missing_age_in_description
**Lines:** 1048-1055  
**Condition:** Only if description exists  
**Error Type:** `missing_age_in_description`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description text  
**Triggers Error:** Description does NOT contain age pattern  
**Triggers Pass:** Description contains age pattern  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "Description missing age"

---

### 5. missing_datetime_in_description
**Lines:** 1058-1065  
**Condition:** Only if description exists  
**Error Type:** `missing_datetime_in_description`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description text  
**Triggers Error:** Description does NOT contain date AND does NOT contain time  
**Triggers Pass:** Description contains date OR time (or both)  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "Description missing date/time"

---

### 6. missing_time_in_description
**Lines:** 1070-1077  
**Condition:** Only if description exists  
**Error Type:** `missing_time_in_description`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description text  
**Triggers Error:** Description does NOT contain time pattern AND not a camp with "Full Day"/"Half Day"  
**Triggers Pass:** 
- Description contains time pattern
- OR (event is CAMP AND description contains "full day" or "half day")
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**EXCEPTION for CAMP:** Camps can use "Full Day" or "Half Day" instead of specific times (line 1069)  
**Severity:** warning  
**Category:** formatting  
**Message:** "Description missing specific time (e.g., '6:30pm')"

---

### 7. missing_program_in_description
**Lines:** 1080-1087  
**Condition:** Only if description exists  
**Error Type:** `missing_program_in_description`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description text  
**Triggers Error:** Description does NOT contain program type keyword  
**Triggers Pass:** 
- Description contains program keyword
- OR description matches `program_synonym` rule
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules via `has_program_type_in_text()`  
**If Exception Exists:** Passes if synonym found  
**If No Exception:** Checks hardcoded keywords  
**Severity:** warning  
**Category:** formatting  
**Message:** "Description missing program type (should mention '{event_type.title()}' or similar)"

---

### 8. clinic_missing_skill
**Lines:** 1092-1109  
**Condition:** Only if event_type == 'CLINIC' AND description exists  
**Error Type:** `clinic_missing_skill`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description OR title  
**Skills List:** cartwheel, back handspring, backhandspring, handstand, tumbling, bars, pullover, pullovers, front flip, roundoff, backbend, ninja, cheer, beam, vault, floor, trampoline, tumbl, bridge, kickover, walkover, flip flop, flip-flop, back walkover, front walkover  
**Triggers Error:** Neither description NOR title contains any skill keyword  
**Triggers Pass:** Description OR title contains skill keyword (skill in title is sufficient)  
**Multiple Values:** Checks if ANY skill in list is found  
**gym_valid_values Check:** NO  
**Severity:** info  
**Category:** formatting  
**Message:** "Clinic description doesn't mention specific skill"

---

### 9. missing_price_in_description
**Lines:** 1772-1779  
**Condition:** Only if description exists  
**Error Type:** `missing_price_in_description`  
**Source of Truth:** N/A (checking existence)  
**Compares Against:** Description text  
**Triggers Error:** No price pattern (`$XX` or `$XX.XX`) found in description  
**Triggers Pass:** At least one price found in description  
**Multiple Values:** Only checks if ANY price exists  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** formatting  
**Message:** "Price not found in description"

---

### 10. description_status: none
**Lines:** 923-924, 1937-1938  
**Error Type:** Not added to validation_errors array, stored in `description_status` field  
**Source of Truth:** Description and has_flyer fields from iClass API  
**Compares Against:** N/A  
**Triggers:** `not description and not has_flyer` (line 923)  
**Meaning:** Event has NO description text AND NO flyer image  
**Handled in UI:** Displays as missing description warning  

---

### 11. description_status: flyer_only
**Lines:** 925-926, 1939-1940  
**Error Type:** Not added to validation_errors array, stored in `description_status` field  
**Source of Truth:** Description and has_flyer fields from iClass API  
**Compares Against:** N/A  
**Triggers:** `has_flyer and not description` (line 925)  
**Meaning:** Event has flyer image but NO text description  
**Handled in UI:** Can't validate text since only image exists  
**Note:** System cannot validate flyer-only events since validation requires text

---

## DATA ERRORS (ACCURACY CHECKS)

These check if values MATCH when they exist in multiple places.  
**Applies to:** ALL event types (KIDS NIGHT OUT, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT)  
**Condition:** Only runs if description exists (line 1115)


### 12. date_mismatch (End before start)
**Lines:** 1134-1141  
**Error Type:** `date_mismatch`  
**Source of Truth:** iClass API `startDate` field  
**Compares Against:** iClass API `endDate` field  
**Triggers Error:** `endDate < startDate` (end date is earlier than start date)  
**Triggers Pass:** `endDate >= startDate`  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO (built-in rule, universal)  
**Severity:** error  
**Category:** data_error  
**Message:** "End date ({end_date_str}) is before start date ({start_date})"  
**Note:** This is a manager error in iClass system

---

### 13. date_mismatch (Wrong month in description)
**Lines:** 1143-1203  
**Error Type:** `date_mismatch`  
**Source of Truth:** iClass API `startDate` and `endDate` fields  
**Compares Against:** Month names found in description (first 200 chars)  
**Valid Months Calculation:**
- Includes start month and end month (full names AND abbreviations)
- For multi-day events: Includes ALL months between start and end (lines 1152-1158)
- Example: June 28 - August 1 camp won't flag July
**Triggers Error:** Description mentions a month (in first 200 chars) that is NOT in valid months  
**Triggers Pass:** 
- Description month matches start or end month
- Month is between start and end month
- Month appears in registration/promo context (ignored)
**Skip Patterns (lines 1181-1186):** Ignores month mentions in these contexts:
- `register`, `registration`, `sign up`, `enroll`, `deadline`, `closes`, `opens`, `book by`, `by`
- `also`, `check out`, `see our`, `upcoming`, `next`, `other`, `more`
**Multiple Values:** Checks every month name found in description first 200 chars  
**gym_valid_values Check:** NO (built-in rule with registration/promo context skip)  
**Severity:** error  
**Category:** data_error  
**Message:** "Event is {event_month} {event_day} but description says '{month_name}'"  
**Note:** Only flags if month is prominent (first 200 chars)

---

### 14. year_mismatch
**Lines:** 1206-1219  
**Error Type:** `year_mismatch`  
**Source of Truth:** iClass API `startDate` year  
**Compares Against:** 4-digit year in title (`20XX`)  
**Triggers Error:** Title contains year (e.g., 2025) that does NOT match event year  
**Triggers Pass:** Title year matches event year OR no year in title  
**Multiple Values:** Checks ALL years found, flags on FIRST mismatch  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says {title_year} but event is in {event_year}"  
**Known Gap:** Only checks TITLE for wrong year, not description

---

### 15. time_mismatch (in title)
**Lines:** 1221-1298  
**Error Type:** `time_mismatch`  
**Source of Truth:** iClass API `schedule.startTime` field (stored as `time_str`)  
**Compares Against:** Times found in title (first 200 chars)  
**Event Time Extraction (lines 1225-1236):** 
- Extracts ALL hours from structured time (e.g., "6:30 PM - 9:30 PM")
- Converts to 24-hour format ([18, 21])
**Pre-cleaning (lines 1246-1251):** Removes false positive patterns before matching:
- `$62 a day`, `$XX a week` patterns
- `Ages 4-13` age range patterns
- `$XX a` (but not `$XX am`)
**Time Matching (lines 1256-1280):**
- Extracts times from title: `6:30pm`, `6pm`, `9a - 3p` etc.
- Converts to 24-hour for comparison
- Checks if found time matches ANY event time (EXACT HOUR match)
**Triggers Error:** Title contains time that does NOT match ANY event time AND time is NOT in extra time rules  
**Triggers Pass:** 
- Title time matches event time (exact hour)
- OR title time is in gym_valid_values `time` exceptions for this gym (lines 1289-1300)
**Multiple Values:** Checks ALL times in title against ALL event times  
**gym_valid_values Check:** YES - checks `time` rules (lines 1284-1300)  
**If Exception Exists:** Prints "[OK] Time {time} is a valid extra time for {gym_id}" and does NOT flag error  
**If No Exception:** Flags as time_mismatch  
**Severity:** warning  
**Category:** data_error  
**Message:** "iClass time is {time_str} but title says {title_time_mismatch}"

---

### 16. time_mismatch (in description)
**Lines:** 1302-1315  
**Error Type:** `time_mismatch`  
**Source of Truth:** iClass API `schedule.startTime` field  
**Compares Against:** Times found in description (first 300 chars)  
**Logic:** Same as title time_mismatch (uses same `check_times_in_text()` function)  
**Pre-cleaning:** Same as title - removes `$62 a day`, `Ages 4-13` patterns  
**Triggers Error:** Description contains time that does NOT match event time AND NOT in extra time rules  
**Triggers Pass:** Description time matches event time OR is in gym_valid_values `time` exceptions  
**Multiple Values:** Checks ALL times in description (first 300 chars)  
**gym_valid_values Check:** YES - checks `time` rules (lines 1304-1315)  
**If Exception Exists:** Does not flag error  
**If No Exception:** Flags as time_mismatch  
**Severity:** warning  
**Category:** data_error  
**Message:** "iClass time is {time_str} but description says {desc_time_mismatch}"

---

### 17. age_mismatch (iClass vs Title)
**Lines:** 1317-1346  
**Error Type:** `age_mismatch`  
**Source of Truth:** iClass API `minAge` field (stored as `age_min`)  
**Compares Against:** Minimum age extracted from title (first 200 chars)  
**Triggers Error:** Both ages exist AND they do NOT match  
**Triggers Pass:** 
- Ages match
- OR either age is None/missing
**Multiple Values:** Only checks MINIMUM age (managers often use "Ages 5+" without max)  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** data_error  
**Message:** "iClass min age is {age_min} but title says {title_age}"  
**Note:** Max age validation not checked (line 1370)

---

### 18. age_mismatch (iClass vs Description)
**Lines:** 1348-1357  
**Error Type:** `age_mismatch`  
**Source of Truth:** iClass API `minAge` field  
**Compares Against:** Minimum age extracted from description (first 300 chars)  
**Triggers Error:** Both ages exist AND they do NOT match  
**Triggers Pass:** Ages match OR either is None  
**Multiple Values:** Only checks minimum age  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** data_error  
**Message:** "iClass min age is {age_min} but description says {desc_age}"

---

### 19. age_mismatch (Title vs Description)
**Lines:** 1359-1368  
**Error Type:** `age_mismatch`  
**Source of Truth:** Title age  
**Compares Against:** Description age  
**Triggers Error:** Both ages exist AND they do NOT match (even if iClass age_min is missing)  
**Triggers Pass:** Ages match OR either is None  
**Multiple Values:** Only checks minimum age  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** data_error  
**Message:** "Title says age {title_age} but description says {desc_age}"  
**Note:** This catches copy/paste errors even when iClass has no age data

---

### 20. day_mismatch
**Lines:** 1372-1401  
**Condition:** Only if day_of_week exists AND event_type != 'CAMP' (camps span multiple days)  
**Error Type:** `day_mismatch`  
**Source of Truth:** Calculated day of week from iClass `startDate`  
**Compares Against:** Day names found in description (first 200 chars)  
**Pre-cleaning (lines 1385-1389):** Removes day range patterns before checking:
- `Monday-Friday`, `Mon-Fri`, `Monday through Friday` patterns
- Parenthetical day ranges like `(Monday-Friday)`
**Triggers Error:** Description mentions a day that is NOT the event's day of week  
**Triggers Pass:** 
- Description mentions event's day
- OR description mentions no days
- OR mentioned day is in a range pattern (removed by pre-cleaning)
**Multiple Values:** Checks ALL days in all_days list  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** data_error  
**Message:** "Event is on {day_of_week} but description says '{check_day}'"  
**Note:** Skipped for CAMPs since they span multiple days

---

### 21. program_mismatch (iClass KNO vs Title Clinic)
**Lines:** 1429-1436  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'KIDS NIGHT OUT'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'KIDS NIGHT OUT' AND title contains 'clinic' AND title does NOT contain any KNO keywords  
**Triggers Pass:** 
- Title contains KNO keywords (kids night out, kno, ninja night out)
- OR title does not contain 'clinic'
**Multiple Values:** Checks if ANY KNO keyword exists  
**gym_valid_values Check:** YES - checks `program_synonym` rules (lines 1411-1422)  
**If Exception Exists:** Adds synonym keyword to kno_title_keywords list, passes if found  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says KNO but title says 'Clinic'"

---

### 22. program_mismatch (iClass KNO vs Title Open Gym)
**Lines:** 1438-1445  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'KIDS NIGHT OUT'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'KIDS NIGHT OUT' AND title contains 'open gym' AND title does NOT contain any KNO keywords  
**Triggers Pass:** 
- Title contains KNO keywords
- OR title does not contain 'open gym'
**Multiple Values:** Checks if ANY KNO keyword exists  
**gym_valid_values Check:** YES - checks `program_synonym` rules for dynamic keywords  
**If Exception Exists:** Adds synonym to keyword list, passes if found  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says KNO but title says 'Open Gym'"

---

### 23. program_mismatch (iClass CLINIC vs Title KNO)
**Lines:** 1447-1454  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CLINIC'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'CLINIC' AND title contains any KNO keyword  
**Triggers Pass:** Title does not contain KNO keywords  
**Multiple Values:** Checks if ANY KNO keyword exists  
**gym_valid_values Check:** YES - checks `program_synonym` rules for KNO keywords  
**If Exception Exists:** Adds synonym to KNO keyword list for checking  
**If No Exception:** Checks hardcoded KNO keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says CLINIC but title says 'Kids Night Out'"

---

### 24. program_mismatch (iClass CLINIC vs Title Open Gym)
**Lines:** 1456-1463  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CLINIC'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'CLINIC' AND title contains 'open gym' AND title does NOT contain 'clinic'  
**Triggers Pass:** 
- Title contains 'clinic'
- OR title does not contain 'open gym'
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules for dynamic keywords  
**If Exception Exists:** Adds synonym to open_gym_title_keywords list  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says CLINIC but title says 'Open Gym'"

---

### 25. program_mismatch (iClass OPEN GYM vs Title KNO)
**Lines:** 1465-1472  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'OPEN GYM'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'OPEN GYM' AND title contains any KNO keyword  
**Triggers Pass:** Title does not contain KNO keywords  
**Multiple Values:** Checks if ANY KNO keyword exists  
**gym_valid_values Check:** YES - checks `program_synonym` rules for KNO keywords  
**If Exception Exists:** Adds synonym to KNO keyword list  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says OPEN GYM but title says 'Kids Night Out'"

---

### 26. program_mismatch (iClass OPEN GYM vs Title Clinic)
**Lines:** 1474-1481  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'OPEN GYM'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'OPEN GYM' AND title contains 'clinic' AND title does NOT contain 'open gym'  
**Triggers Pass:** 
- Title contains 'open gym'
- OR title does not contain 'clinic'
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules for dynamic keywords  
**If Exception Exists:** Adds synonym to open_gym_title_keywords list  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says OPEN GYM but title says 'Clinic'"

---

### 27. program_mismatch (KNO description missing KNO)
**Lines:** 1493-1500  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'KIDS NIGHT OUT'  
**Compares Against:** Description text (searches for KNO keywords)  
**Triggers Error:** event_type == 'KIDS NIGHT OUT' AND description does NOT contain 'kids night out' (any apostrophe style) OR 'kno'  
**Triggers Pass:** Description contains 'kids night out', "kid's night out", "kids' night out", "kid night out", or 'kno'  
**Multiple Values:** Checks multiple KNO variations (strips apostrophes to handle different styles)  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "KNO event but description doesn't mention 'Kids Night Out' or 'KNO'"

---

### 28. program_mismatch (KNO description says Clinic)
**Lines:** 1502-1509  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'KIDS NIGHT OUT'  
**Compares Against:** First 100 chars of description  
**Triggers Error:** event_type == 'KIDS NIGHT OUT' AND description contains 'clinic' in first 100 chars  
**Triggers Pass:** Description does not contain 'clinic' in first 100 chars  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "KNO event but description says 'Clinic'"

---

### 29. program_mismatch (CLINIC description missing Clinic)
**Lines:** 1521-1528  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CLINIC'  
**Compares Against:** Description text  
**Triggers Error:** event_type == 'CLINIC' AND description does NOT contain 'clinic'  
**Triggers Pass:** Description contains 'clinic'  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** formatting  
**Message:** "CLINIC event but description doesn't mention 'Clinic'"

---

### 30. program_mismatch (CLINIC description says KNO)
**Lines:** 1530-1537  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CLINIC'  
**Compares Against:** First 100 chars of description  
**Triggers Error:** event_type == 'CLINIC' AND description contains 'kids night out' or 'kid night out' OR starts with 'kno' (first 50 chars)  
**Triggers Pass:** Description does not contain KNO keywords in first 100 chars  
**Multiple Values:** Checks multiple KNO variations (strips apostrophes)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "CLINIC event but description says 'Kids Night Out'"

---

### 31. program_mismatch (CLINIC description says Open Gym)
**Lines:** 1539-1546  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CLINIC'  
**Compares Against:** First 100 chars of description  
**Triggers Error:** event_type == 'CLINIC' AND description starts with 'open gym' (first 100 chars)  
**Triggers Pass:** Description does not start with 'open gym'  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "CLINIC event but description starts with 'Open Gym'"

---

### 32. program_mismatch (OPEN GYM description missing Open Gym)
**Lines:** 1605-1612  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'OPEN GYM'  
**Compares Against:** Description text  
**Triggers Error:** event_type == 'OPEN GYM' AND description does NOT contain 'open gym' OR hardcoded phrases ('play and explore the gym', 'open to all') OR program_synonym rules  
**Triggers Pass:** 
- Description contains 'open gym'
- OR description contains 'play and explore the gym' or 'open to all'
- OR description contains keyword from `program_synonym` rule for OPEN GYM
**Multiple Values:** Checks multiple phrases and synonym rules  
**gym_valid_values Check:** YES - checks `program_synonym` rules (lines 1593-1598)  
**If Exception Exists:** Passes if synonym keyword found in description  
**If No Exception:** Checks hardcoded phrases only  
**Severity:** warning  
**Category:** formatting  
**Message:** "OPEN GYM event but description doesn't mention 'Open Gym' or similar"

---

### 33. program_mismatch (OPEN GYM description says Clinic)
**Lines:** 1614-1621  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'OPEN GYM'  
**Compares Against:** First 100 chars of description  
**Triggers Error:** event_type == 'OPEN GYM' AND (description starts with 'clinic' OR 'clinic' in first 50 chars)  
**Triggers Pass:** Description does not start with 'clinic' and 'clinic' not in first 50 chars  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "OPEN GYM event but description says 'Clinic'"

---

### 34. program_mismatch (OPEN GYM description says KNO)
**Lines:** 1623-1630  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'OPEN GYM'  
**Compares Against:** First 100 chars of description  
**Triggers Error:** event_type == 'OPEN GYM' AND description contains 'kids night out' or 'kid night out' (first 100 chars)  
**Triggers Pass:** Description does not contain KNO keywords in first 100 chars  
**Multiple Values:** Checks multiple KNO variations (strips apostrophes)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "OPEN GYM event but description says 'Kids Night Out'"

---

### 35. program_mismatch (CAMP description starts with Clinic)
**Lines:** 1642-1649  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CAMP'  
**Compares Against:** First 50 chars of description  
**Triggers Error:** event_type == 'CAMP' AND description starts with 'clinic' (first 50 chars)  
**Triggers Pass:** Description does not start with 'clinic'  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "CAMP event but description starts with 'Clinic'"  
**Note:** Camps might mention "open gym" or "ninja" as activities - those are OK

---

### 36. program_mismatch (CAMP description starts with KNO)
**Lines:** 1651-1658  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CAMP'  
**Compares Against:** First 50-100 chars of description  
**Triggers Error:** event_type == 'CAMP' AND description starts with 'kids night out' or 'kid night out' or 'kno ' (first 50 chars)  
**Triggers Pass:** Description does not start with KNO keywords  
**Multiple Values:** Checks multiple KNO variations (strips apostrophes)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "CAMP event but description starts with 'Kids Night Out'"

---

### 37. program_mismatch (iClass CAMP vs Title KNO)
**Lines:** 1661-1668  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CAMP'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'CAMP' AND title contains any KNO keyword  
**Triggers Pass:** Title does not contain KNO keywords  
**Multiple Values:** Checks if ANY KNO keyword exists  
**gym_valid_values Check:** YES - checks `program_synonym` rules for dynamic keywords (lines 1411-1422)  
**If Exception Exists:** Adds synonym to KNO keyword list for checking  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says CAMP but title says 'Kids Night Out'"

---

### 38. program_mismatch (iClass CAMP vs Title Clinic)
**Lines:** 1670-1677  
**Error Type:** `program_mismatch`  
**Source of Truth:** iClass API `event_type` field = 'CAMP'  
**Compares Against:** Keywords in title  
**Triggers Error:** event_type == 'CAMP' AND title contains 'clinic'  
**Triggers Pass:** Title does not contain 'clinic'  
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules for dynamic keywords (lines 1411-1422)  
**If Exception Exists:** Adds synonym to clinic_title_keywords list  
**If No Exception:** Checks hardcoded keywords only  
**Severity:** error  
**Category:** data_error  
**Message:** "iClass says CAMP but title says 'Clinic'"

---

### 39. skill_mismatch
**Lines:** 1548-1582  
**Condition:** Only if event_type == 'CLINIC'  
**Error Type:** `skill_mismatch`  
**Source of Truth:** Skill found in title  
**Compares Against:** Skill found in description (first 150 chars)  
**Skills List:** cartwheel, back handspring, backhandspring, handstand, tumbling, bars, pullover, pullovers, front flip, roundoff, backbend, ninja, cheer, beam, vault, floor, trampoline, tumbl, bridge, kickover, walkover, flip flop, flip-flop, back walkover, front walkover  
**Triggers Error:** BOTH title AND description contain a skill AND skills are DIFFERENT (after normalizing spaces)  
**Triggers Pass:** 
- Only one location has skill
- OR both have same skill
- OR neither has skill
**Multiple Values:** Finds FIRST skill in title, FIRST skill in description (first 150 chars), compares those two  
**Normalization:** Removes spaces before comparing (e.g., "back handspring" vs "backhandspring" pass)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says '{title_skill}' but description says '{desc_skill}'"

---

### 40. price_mismatch
**Lines:** 1782-1794  
**Condition:** Only if title AND description both contain prices  
**Error Type:** `price_mismatch`  
**Source of Truth:** Description prices (all prices found)  
**Compares Against:** First price in title  
**Triggers Error:** Title price (first one) does NOT match ANY price in description (with $1 tolerance)  
**Triggers Pass:** Title price matches at least one description price (within $1)  
**Multiple Values:** 
- Title: Uses FIRST price only
- Description: Checks against ALL prices found
**Tolerance:** $1 difference allowed (e.g., $45 matches $44 or $46)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says ${title_price:.0f} but description prices are {desc_prices}"

---

### 41. title_desc_mismatch (Title Clinic vs Description KNO)
**Lines:** 1707-1714  
**Condition:** Applies to ALL event types (catches copy/paste errors regardless of iClass page)  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains 'clinic' AND description contains 'kids night out' or 'kid night out' or starts with 'kno ' (first 150 chars)  
**Triggers Pass:** 
- Title does not contain 'clinic'
- OR description does not contain KNO keywords
**Multiple Values:** Checks multiple KNO variations (strips apostrophes)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Clinic' but description says 'Kids Night Out'"

---

### 42. title_desc_mismatch (Title KNO vs Description Clinic)
**Lines:** 1716-1724  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains 'kids night out' or 'kid night out' or starts with 'kno ' AND description contains 'clinic' (first 150 chars)  
**Triggers Pass:** 
- Title does not contain KNO keywords
- OR description does not contain 'clinic'
**Multiple Values:** Checks multiple KNO variations (strips apostrophes)  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Kids Night Out' but description says 'Clinic'"

---

### 43. title_desc_mismatch (Title Open Gym vs Description KNO)
**Lines:** 1726-1734  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains 'open gym' (or `program_synonym` rule) AND description contains KNO keywords (first 150 chars)  
**Triggers Pass:** 
- Title does not contain 'open gym'
- OR description does not contain KNO keywords
**Multiple Values:** Checks multiple KNO variations  
**gym_valid_values Check:** YES - checks `program_synonym` rules for 'open gym' in title (lines 1690-1695)  
**If Exception Exists:** Adds synonym to title_has_open_gym check  
**If No Exception:** Checks 'open gym' keyword only  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Open Gym' but description says 'Kids Night Out'"

---

### 44. title_desc_mismatch (Title KNO vs Description Open Gym)
**Lines:** 1736-1744  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains KNO keywords AND description starts with 'open gym' (first 150 chars)  
**Triggers Pass:** 
- Title does not contain KNO keywords
- OR description does not start with 'open gym'
**Multiple Values:** Checks multiple KNO variations  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Kids Night Out' but description starts with 'Open Gym'"

---

### 45. title_desc_mismatch (Title Clinic vs Description Open Gym)
**Lines:** 1746-1754  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains 'clinic' AND description starts with 'open gym' (first 150 chars)  
**Triggers Pass:** 
- Title does not contain 'clinic'
- OR description does not start with 'open gym'
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Clinic' but description starts with 'Open Gym'"

---

### 46. title_desc_mismatch (Title Open Gym vs Description Clinic)
**Lines:** 1756-1764  
**Error Type:** `title_desc_mismatch`  
**Source of Truth:** Title keywords  
**Compares Against:** Description keywords (first 150 chars)  
**Triggers Error:** Title contains 'open gym' (or `program_synonym` rule) AND description contains 'clinic' (first 150 chars)  
**Triggers Pass:** 
- Title does not contain 'open gym'
- OR description does not contain 'clinic'
**Multiple Values:** N/A  
**gym_valid_values Check:** YES - checks `program_synonym` rules for 'open gym' in title (lines 1690-1695)  
**If Exception Exists:** Adds synonym to title_has_open_gym check  
**If No Exception:** Checks 'open gym' keyword only  
**Severity:** error  
**Category:** data_error  
**Message:** "Title says 'Open Gym' but description says 'Clinic'"

---

### 47. camp_price_mismatch
**Lines:** 1802-1852  
**Condition:** Only if event_type == 'CAMP' AND prices found in title or description  
**Error Type:** `camp_price_mismatch`  
**Source of Truth:** `camp_pricing` table in Supabase (full_day_daily, full_day_weekly, half_day_daily, half_day_weekly) + `gym_valid_values` price rules  
**Compares Against:** ALL prices found in title OR description (combined and deduplicated)  
**Triggers Error:** ANY found price does NOT match ANY valid camp price (with $2 tolerance)  
**Triggers Pass:** 
- All found prices match valid camp prices (within $2)
- OR gym has no camp_pricing data
- OR no prices found in text
**Multiple Values:** 
- Combines ALL prices from title and description
- Checks EACH found price against ALL valid prices
- Flags on FIRST invalid price only
**Valid Prices Include:**
- Non-NULL values from camp_pricing table (full day daily, full day weekly, half day daily, half day weekly)
- Extra prices from `gym_valid_values` table with rule_type='price' (e.g., Before Care $20, After Care $20)
**Tolerance:** $2 difference allowed (for rounding)  
**gym_valid_values Check:** YES - checks `price` rules (lines 1826-1834)  
**If Exception Exists:** Adds extra price to valid_prices list (e.g., Before Care $20 for gym123)  
**If No Exception:** Only uses camp_pricing table values  
**Severity:** warning  
**Category:** data_error  
**Message:** "Camp price ${camp_price:.0f} doesn't match any valid price for {gym_id}. Valid: {price_labels}"

---

### 48. event_price_mismatch
**Lines:** 1860-1893  
**Condition:** Only if event_type in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'] AND prices found in description  
**Error Type:** `event_price_mismatch`  
**Source of Truth:** `event_pricing` table in Supabase (uses effective_date for automatic price increases) + `gym_valid_values` price rules  
**Compares Against:** ALL prices found in title AND description (combined)  
**Triggers Error:** NONE of the valid prices appear in ANY of the found prices (with $1 tolerance)  
**Triggers Pass:** 
- At least one valid price matches at least one found price (within $1)
- OR gym has no event_pricing data
- OR no prices found in text
**Multiple Values:** 
- Combines ALL prices from title and description
- Checks if ANY valid price matches ANY found price
- Uses effective_date to automatically select correct price (handles price increases)
**Valid Prices Include:**
- All valid prices for this gym and event type from event_pricing table
- Extra prices from `gym_valid_values` table with rule_type='price'
**Tolerance:** $1 difference allowed  
**gym_valid_values Check:** YES - checks `price` rules (lines 1866-1873)  
**If Exception Exists:** Adds extra price to valid_prices list  
**If No Exception:** Only uses event_pricing table values  
**Severity:** error  
**Category:** data_error  
**Message:** "{event_type} expected price ({valid_str}) not found in description for {gym_id}. Found: {found_str}"  
**Note:** Handles multiple valid prices (e.g., $45 for 1 child, $40 for siblings) by checking if ANY valid price appears

---

## STATUS ERRORS

These provide informational status about event availability and registration timing.  
**Category:** status

---

### 49. registration_closed
**Lines:** 1901-1915  
**Condition:** Only if registration_end_date AND start_date exist  
**Error Type:** `registration_closed`  
**Source of Truth:** iClass API `registrationEndDate` field  
**Compares Against:** Current date (today) and event start date  
**Triggers Error:** Registration end date < today AND event start date >= today (registration closed but event hasn't happened yet)  
**Triggers Pass:** 
- Registration end date >= today (still open)
- OR event start date < today (event already happened)
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** warning  
**Category:** status  
**Message:** "Registration closed on {registration_end_date} but event is {start_date}"  
**Note:** This is informational - tells managers they can't remove the event yet even though registration closed

---

### 50. registration_not_open
**Lines:** 1920-1932  
**Condition:** Only if registration_start_date AND start_date exist  
**Error Type:** `registration_not_open`  
**Source of Truth:** iClass API `registrationStartDate` field  
**Compares Against:** Current date (today)  
**Triggers Error:** Registration start date > today (registration hasn't opened yet)  
**Triggers Pass:** Registration start date <= today (already open)  
**Multiple Values:** N/A  
**gym_valid_values Check:** NO  
**Severity:** info  
**Category:** status  
**Message:** "Registration opens {registration_start_date}"  
**Note:** This is informational - event is not yet available for registration

---

## SUMMARY TABLES

### All Error Types by Number

| # | Error Type | Severity | Category | Lines |
|---|------------|----------|----------|-------|
| 1 | missing_age_in_title | warning | formatting | 989-996 |
| 2 | missing_date_in_title | warning | formatting | 999-1006 |
| 3 | missing_program_in_title | warning | formatting | 1035-1042 |
| 4 | missing_age_in_description | warning | formatting | 1048-1055 |
| 5 | missing_datetime_in_description | warning | formatting | 1058-1065 |
| 6 | missing_time_in_description | warning | formatting | 1070-1077 |
| 7 | missing_program_in_description | warning | formatting | 1080-1087 |
| 8 | clinic_missing_skill | info | formatting | 1092-1109 |
| 9 | missing_price_in_description | error | formatting | 1772-1779 |
| 10 | description_status: none | N/A | N/A | 923-924, 1937-1938 |
| 11 | description_status: flyer_only | N/A | N/A | 925-926, 1939-1940 |
| 12 | date_mismatch (end before start) | error | data_error | 1134-1141 |
| 13 | date_mismatch (wrong month) | error | data_error | 1143-1203 |
| 14 | year_mismatch | error | data_error | 1206-1219 |
| 15 | time_mismatch (title) | warning | data_error | 1221-1298 |
| 16 | time_mismatch (description) | warning | data_error | 1302-1315 |
| 17 | age_mismatch (iClass vs title) | warning | data_error | 1317-1346 |
| 18 | age_mismatch (iClass vs description) | warning | data_error | 1348-1357 |
| 19 | age_mismatch (title vs description) | warning | data_error | 1359-1368 |
| 20 | day_mismatch | warning | data_error | 1372-1401 |
| 21 | program_mismatch (iClass KNO vs title Clinic) | error | data_error | 1429-1436 |
| 22 | program_mismatch (iClass KNO vs title Open Gym) | error | data_error | 1438-1445 |
| 23 | program_mismatch (iClass CLINIC vs title KNO) | error | data_error | 1447-1454 |
| 24 | program_mismatch (iClass CLINIC vs title Open Gym) | error | data_error | 1456-1463 |
| 25 | program_mismatch (iClass OPEN GYM vs title KNO) | error | data_error | 1465-1472 |
| 26 | program_mismatch (iClass OPEN GYM vs title Clinic) | error | data_error | 1474-1481 |
| 27 | program_mismatch (KNO description missing KNO) | warning | formatting | 1493-1500 |
| 28 | program_mismatch (KNO description says Clinic) | error | data_error | 1502-1509 |
| 29 | program_mismatch (CLINIC description missing Clinic) | warning | formatting | 1521-1528 |
| 30 | program_mismatch (CLINIC description says KNO) | error | data_error | 1530-1537 |
| 31 | program_mismatch (CLINIC description says Open Gym) | error | data_error | 1539-1546 |
| 32 | program_mismatch (OPEN GYM description missing Open Gym) | warning | formatting | 1605-1612 |
| 33 | program_mismatch (OPEN GYM description says Clinic) | error | data_error | 1614-1621 |
| 34 | program_mismatch (OPEN GYM description says KNO) | error | data_error | 1623-1630 |
| 35 | program_mismatch (CAMP description starts with Clinic) | error | data_error | 1642-1649 |
| 36 | program_mismatch (CAMP description starts with KNO) | error | data_error | 1651-1658 |
| 37 | program_mismatch (iClass CAMP vs title KNO) | error | data_error | 1661-1668 |
| 38 | program_mismatch (iClass CAMP vs title Clinic) | error | data_error | 1670-1677 |
| 39 | skill_mismatch | error | data_error | 1548-1582 |
| 40 | price_mismatch | error | data_error | 1782-1794 |
| 41 | title_desc_mismatch (title Clinic vs desc KNO) | error | data_error | 1707-1714 |
| 42 | title_desc_mismatch (title KNO vs desc Clinic) | error | data_error | 1716-1724 |
| 43 | title_desc_mismatch (title Open Gym vs desc KNO) | error | data_error | 1726-1734 |
| 44 | title_desc_mismatch (title KNO vs desc Open Gym) | error | data_error | 1736-1744 |
| 45 | title_desc_mismatch (title Clinic vs desc Open Gym) | error | data_error | 1746-1754 |
| 46 | title_desc_mismatch (title Open Gym vs desc Clinic) | error | data_error | 1756-1764 |
| 47 | camp_price_mismatch | warning | data_error | 1802-1852 |
| 48 | event_price_mismatch | error | data_error | 1860-1893 |
| 49 | registration_closed | warning | status | 1901-1915 |
| 50 | registration_not_open | info | status | 1920-1932 |

---

### gym_valid_values Usage Summary

| Rule Type | Used By | Purpose | If Exception Exists | If No Exception |
|-----------|---------|---------|---------------------|-----------------|
| `program_synonym` | #3, #7, #21-26, #32, #37-38, #43, #46 | Custom keywords for program types | Adds keyword to check list, passes if found | Uses hardcoded keywords only |
| `time` | #15, #16 | Extra valid times for this gym | Does NOT flag error if time found in rules | Flags time_mismatch error |
| `price` | #47, #48 | Extra valid prices (Before/After Care, etc.) | Adds price to valid_prices list | Uses pricing tables only |

**Total Checks Using gym_valid_values:** 12 checks

---

### Event Type Coverage

| Event Type | Validated? | Special Rules |
|------------|-----------|---------------|
| KIDS NIGHT OUT | ✅ Yes | All checks apply |
| CLINIC | ✅ Yes | All checks + skill_mismatch (#39) |
| OPEN GYM | ✅ Yes | All checks apply |
| CAMP | ✅ Yes | All checks, EXCEPT: #6 allows "Full Day"/"Half Day" instead of times, #20 day_mismatch skipped (multi-day), #47 camp_price_mismatch instead of #48 |
| SPECIAL EVENT | ✅ Yes | All checks apply |

---

### Known Gaps & Limitations

| Issue | Affects | Details | Priority |
|-------|---------|---------|----------|
| Year only checked in title | #14 year_mismatch | Description not checked for wrong year (e.g., "Summer 2025" when event is 2026) | Medium |
| Max age not validated | #17-19 age_mismatch | Only minimum age checked (managers often use "Ages 5+" without max) | Low |
| Flyer-only events not validated | #11 description_status | System cannot validate text when only image exists | Cannot fix |
| Time regex false positives | #15-16 time_mismatch | Pre-cleaning added (lines 1246-1251) to remove `$62 a day`, `Ages 4-13` patterns | ✅ FIXED |
| Day range false positives | #20 day_mismatch | Pre-cleaning added (lines 1385-1389) to remove "Monday-Friday" patterns | ✅ FIXED |
| `program_ignore` rule type | N/A | Cannot ignore "open gym" when it's a station name (e.g., KNO events at gym "open gym station") | Medium |
| Price tolerance varies | #40, #47, #48 | price_mismatch uses $1, camp_price_mismatch uses $2, event_price_mismatch uses $1 | By design |

---

**END OF COMPLETE VALIDATION LOGIC REFERENCE**

