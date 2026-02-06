# Validation Rules Architecture

**Last Updated:** February 5, 2026  
**Purpose:** Explains what's built into the software vs. what's configurable by users  
**Audience:** Developers, administrators, and future customers

---

## Overview

The validation system has TWO layers:

| Layer | What It Is | Who Controls It | How to Change |
|-------|-----------|-----------------|---------------|
| **Precoded Rules** | Built into the software | Developers | Code deployment |
| **Configurable Rules** | Stored in database | Administrators/Users | Admin Dashboard |

This architecture allows the software to work "out of the box" while giving each customer flexibility to customize for their specific needs.

---

## PART 1: PRECODED RULES (Built Into Software)

These rules are hardcoded in `automation/f12_collect_and_import.py` and work automatically for all customers.

### 1.1 Case Handling

**All text comparisons are case-insensitive.**

| Input | Converted To | Matches |
|-------|-------------|---------|
| `Kids Night Out` | `kids night out` | ✅ |
| `KIDS NIGHT OUT` | `kids night out` | ✅ |
| `KiDs NiGhT oUt` | `kids night out` | ✅ |

**Code:** `title_lower = title.lower()`

### 1.2 Apostrophe Handling

**All apostrophe variations are stripped before comparison.**

| Input | After Stripping | Matches |
|-------|----------------|---------|
| `Kids Night Out` | `kids night out` | ✅ |
| `Kid's Night Out` | `kids night out` | ✅ |
| `Kids' Night Out` | `kids night out` | ✅ |
| `Kid's Night Out` (curly) | `kids night out` | ✅ |

**Code:** `txt.replace("'", "").replace("'", "").replace("'", "")`

### 1.3 Month Recognition

**Both full names AND abbreviations are recognized.**

| Input | Recognized As |
|-------|--------------|
| `January` | January |
| `january` | January |
| `Jan` | January |
| `jan` | January |
| `JAN` | January |

**Smart matching:** Abbreviations use word boundaries to avoid false matches:
- `"marching band"` → Does NOT match "Mar" (March)
- `"Jan 15th"` → DOES match "Jan" (January)

### 1.4 Default Program Keywords

These keywords are recognized automatically for each program type:

| Program Type | Recognized Keywords |
|--------------|---------------------|
| **KIDS NIGHT OUT** | `kids night out`, `kid night out`, `kno`, `night out`, `parents night out`, `ninja night out` |
| **CLINIC** | `clinic` |
| **OPEN GYM** | `open gym` |
| **CAMP** | `camp` |

### 1.5 Time Format Recognition

Multiple time formats are recognized:

| Format | Example | Recognized? |
|--------|---------|-------------|
| Standard | `6:30 PM` | ✅ |
| No space | `6:30PM` | ✅ |
| Lowercase | `6:30 pm` | ✅ |
| No minutes | `6 PM` | ✅ |
| With periods | `6:30 p.m.` | ✅ |
| Single letter | `6:30p` | ✅ |

### 1.6 Age Format Recognition

Multiple age formats are recognized:

| Format | Example | Recognized? |
|--------|---------|-------------|
| Ages X+ | `Ages 5+` | ✅ |
| Ages X-Y | `Ages 5-12` | ✅ |
| Age X | `Age 5` | ✅ |
| Students X+ | `Students 5+` | ✅ |
| Just range | `5-12` | ✅ |
| Just plus | `5+` | ✅ |

### 1.7 Multi-Day Event Handling

**Events spanning multiple months are handled correctly.**

For an event **June 30 - July 5**:
- Both `June` and `July` are valid months
- No false "date mismatch" error

**Code:** Checks both `startDate` AND `endDate` months.

### 1.8 Price Pattern Recognition

Prices are extracted using pattern: `$XX` or `$XX.XX`

| Input | Extracted Price |
|-------|----------------|
| `$35` | 35 |
| `$35.00` | 35.00 |
| `$125` | 125 |
| `Cost: $35 per child` | 35 |

---

## PART 2: CONFIGURABLE RULES (Database-Driven)

These rules are stored in the `gym_valid_values` table and can be managed via Admin Dashboard → Gym Rules.

### 2.1 Rule Types

| Rule Type | Purpose | Example |
|-----------|---------|---------|
| `program_synonym` | "This word means this program type" | `ninja night` → KIDS NIGHT OUT |
| `price` | "This is a valid price for this gym" | `$20` = Before Care |
| `time` | "This is a valid extra time" | `8:00am` = Early Dropoff |

### 2.2 Database Schema

```sql
CREATE TABLE gym_valid_values (
  id UUID PRIMARY KEY,
  gym_id TEXT NOT NULL,        -- e.g., "RBA", "CCP", or "*" for global
  rule_type TEXT NOT NULL,     -- "program_synonym", "price", "time"
  value TEXT NOT NULL,         -- The keyword/value to match
  label TEXT,                  -- Human-readable label or target type
  event_type TEXT,             -- Which program type this applies to
  created_at TIMESTAMP
);
```

### 2.3 Example Rules

**Program Synonyms:**
| gym_id | rule_type | value | label |
|--------|-----------|-------|-------|
| RBA | program_synonym | ninja night | KIDS NIGHT OUT |
| CCP | program_synonym | parents night out | KIDS NIGHT OUT |
| * | program_synonym | pno | KIDS NIGHT OUT |

**Price Exceptions:**
| gym_id | rule_type | value | label |
|--------|-----------|-------|-------|
| RBA | price | 20 | Before Care |
| RBA | price | 20 | After Care |
| HGA | price | 15 | Sibling Discount |

**Time Exceptions:**
| gym_id | rule_type | value | label |
|--------|-----------|-------|-------|
| CCP | time | 8:00am | Early Dropoff |
| CCP | time | 5:30pm | Late Pickup |

### 2.4 How Rules Are Applied

```
1. Load event from iClass API
2. Load precoded rules (built-in)
3. Load configurable rules for this gym from database
4. Merge rules (database rules ADD to precoded rules)
5. Run validation using combined ruleset
```

### 2.5 Managing Rules

**Via Admin Dashboard:**
1. Shift+Click the 🪄 wand to open Admin Dashboard
2. Go to "Gym Rules" tab
3. Select a gym
4. Add, edit, or delete rules

**Via Database (Supabase):**
1. Go to Supabase Dashboard
2. Navigate to `gym_valid_values` table
3. Insert/update/delete rows directly

---

## PART 3: SOURCE OF TRUTH ⚠️ CRITICAL SECTION ⚠️

This section explains WHERE the "correct" data comes from for each field. This is essential for understanding how validation works.

### 3.1 What iClass API Gives Us vs. What It DOESN'T

**iClass API DOES provide these fields:**

| Field | API Field Name | Example Value |
|-------|---------------|---------------|
| Event ID | `id` | `2106` |
| Title | `name` | `"Kids Night Out | Ages 5-12 | Feb 15"` |
| Start Date | `startDate` | `"2026-02-15"` |
| End Date | `endDate` | `"2026-02-15"` |
| Start Time | `schedule.startTime` | `"6:30 PM"` |
| End Time | `schedule.endTime` | `"9:30 PM"` |
| Min Age | `minAge` | `5` |
| Max Age | `maxAge` | `12` |
| Description | `description` | `"Join us for fun..."` (HTML) |
| Has Openings | `hasOpenings` | `true` / `false` |
| Program Type | `link_type_id` | `"kids_night_out"` |

**iClass API does NOT provide:**

| Field | Why Not | Our Solution |
|-------|---------|--------------|
| **PRICE** | ❌ Not in API response | Parse from title/description text OR use our `camp_pricing` table |

### 3.2 The Price Problem & Our Solution

**The Problem:**
- iClass has pricing data in their system (what customers actually pay)
- But their API does NOT expose this field
- We cannot automatically verify if the price in the description matches what customers will be charged

**Our Solution:**
- **For CAMPS:** We built our own `camp_pricing` table in Supabase with correct prices per gym
- **For Other Events:** We can only compare title price vs description price (no source of truth)

### 3.3 Complete Source of Truth Table

| Data Field | Source of Truth | Where It Comes From | Can We Validate? |
|------------|-----------------|---------------------|------------------|
| **Date** | ✅ iClass API | `startDate` field | YES - compare to title/description |
| **Year** | ✅ iClass API | Extracted from `startDate` | YES - compare to title |
| **Day of Week** | ✅ Calculated | From `startDate` (e.g., "Saturday") | YES - compare to description |
| **Time** | ✅ iClass API | `schedule.startTime` / `endTime` | YES - compare to title/description |
| **Age** | ✅ iClass API | `minAge` / `maxAge` fields | YES - compare to title/description |
| **Program Type** | ✅ iClass API | `link_type_id` field | YES - compare to title/description keywords |
| **Price (CAMP)** | ✅ OUR Supabase table | `camp_pricing` + `gym_valid_values` | YES - compare description price to our table |
| **Price (CLINIC, KNO, OPEN GYM)** | ❌ NO SOURCE | Parsed from text only | PARTIAL - can only check title vs description match |

### 3.4 Why This Matters

**For fields WITH a source of truth (Date, Time, Age, Program):**
- We can catch REAL errors: "iClass says 9:00 AM but description says 10:00 AM"
- High confidence these are actual mistakes

**For CAMP prices:**
- We built our own source of truth (`camp_pricing` table)
- We can catch: "Description says $150 but this gym's camps are $125 or $175"
- Requires YOU to maintain the pricing table

**For other event prices (Clinic, KNO, Open Gym):**
- NO source of truth exists
- We can ONLY check: "Does title price match description price?"
- We CANNOT verify if the price is actually correct in iClass

### 3.5 Camp Pricing Table

```sql
CREATE TABLE camp_pricing (
  gym_id TEXT PRIMARY KEY,
  full_day_daily DECIMAL,
  full_day_weekly DECIMAL,
  half_day_daily DECIMAL,
  half_day_weekly DECIMAL
);
```

This table is the SOURCE OF TRUTH for camp prices. When validating camp events, description prices are compared against this table.

---

## PART 4: VALIDATION FLOW

### 4.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 1: LOAD DATA                            │
│  • Event data from iClass API                                   │
│  • Precoded rules from software                                 │
│  • Configurable rules from gym_valid_values table               │
│  • Camp pricing from camp_pricing table                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 2: NORMALIZE                            │
│  • Convert all text to lowercase                                │
│  • Strip apostrophes                                            │
│  • Parse dates, times, ages, prices                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: COMPARE iClass → TITLE                     │
│  • Does title have correct program keyword?                     │
│  • Does title year match iClass year?                           │
│  • Does title age match iClass age?                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            STEP 4: COMPARE iClass → DESCRIPTION                 │
│  • Does description month match iClass month?                   │
│  • Does description time match iClass time?                     │
│  • Does description day match iClass day?                       │
│  • Does description age match iClass age?                       │
│  • Does description have required program keyword?              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             STEP 5: COMPARE TITLE ↔ DESCRIPTION                 │
│  • Does title price match description price?                    │
│  • Does title skill match description skill? (clinics)          │
│  • Do program keywords conflict?                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          STEP 6: COMPARE PRICE → PRICING TABLE (CAMP)           │
│  • Does description price match any valid camp price?           │
│  • Check camp_pricing table + gym_valid_values exceptions       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 7: GENERATE ERRORS                      │
│  • DATA errors (mismatches) → Red/High priority                 │
│  • FORMAT errors (missing info) → Orange/Warning                │
└─────────────────────────────────────────────────────────────────┘
```

---

## PART 5: ERROR CATEGORIES ⚠️ IMPORTANT ⚠️

### The Simple Rule:
- **DATA Error** = Something is **WRONG** (two things don't match)
- **FORMAT Error** = Something is **MISSING** (required info not found)

### 5.1 DATA Errors (Red - High Priority)

Something is **WRONG** - two sources don't match. These can confuse customers!

| Error Type | What's Compared | Source of Truth | Example |
|------------|-----------------|-----------------|---------|
| `year_mismatch` | iClass year vs title year | ✅ iClass API | iClass: 2026, Title: "2025" |
| `date_mismatch` | iClass month vs description month | ✅ iClass API | iClass: February, Desc: "January" |
| `day_mismatch` | iClass day vs description day | ✅ iClass API | iClass: Saturday, Desc: "Friday" |
| `time_mismatch` | iClass time vs title/description time | ✅ iClass API | iClass: 9:00 AM, Desc: "10am" |
| `age_mismatch` | iClass age vs title/description age | ✅ iClass API | iClass: 5+, Title: "Ages 4-12" |
| `program_mismatch` | iClass program vs title/description keywords | ✅ iClass API | iClass: KNO, Title: "Clinic" |
| `skill_mismatch` | Title skill vs description skill (clinics) | Title vs Desc | Title: "Tumbling", Desc: "Bars" |
| `price_mismatch` | Title price vs description price | ❌ No source | Title: "$50", Desc: "$45" |
| `camp_price_mismatch` | Description price vs camp_pricing table | ✅ YOUR Supabase table | Desc: "$150", Valid: $125 or $175 |

**Key insight:** Most DATA errors compare against iClass API (the truth). But `price_mismatch` for non-camp events only compares title vs description because we have NO source of truth for those prices.

### 5.2 FORMAT Errors (Orange - Warning)

Something is **MISSING** - required info not found. These don't confuse customers but make events incomplete.

| Error Type | What's Missing | Why It Matters |
|------------|----------------|----------------|
| `missing_age_in_title` | No age in title | Parents can't quickly see if event is for their kid |
| `missing_date_in_title` | No date in title | Hard to identify event at a glance |
| `missing_program_in_title` | No program keyword in title | Unclear what type of event it is |
| `missing_age_in_description` | No age in description | Full details should include age range |
| `missing_time_in_description` | No time in description | Parents need to know when to arrive |
| `missing_program_in_description` | No program keyword in description | Description should reinforce event type |
| `missing_price_in_description` | No price (`$XX`) in description | Parents want to know cost before clicking |
| `description_status: none` | No description at all | Event has no details for parents to read |
| `description_status: flyer_only` | Only flyer image, no text | Can't validate anything - system can't read images |

### 5.3 Why Flyer-Only Is a Problem

When an event has only a flyer image with no text:
- ❌ System CANNOT validate dates, times, ages, prices
- ❌ System CANNOT catch copy/paste errors
- ❌ Parents using screen readers can't access the info
- ⚠️ Flagged as FORMAT error, but NO other validations run

---

## PART 6: FUTURE ENHANCEMENTS

### 6.1 Planned Rule Types

| Rule Type | Purpose | Status |
|-----------|---------|--------|
| `program_ignore` | Ignore certain words for a program type | Planned |
| `global_synonym` | Synonyms that apply to ALL gyms | Planned |
| `description_template` | Required text patterns | Future |

### 6.2 Self-Service Configuration

For a sellable product, customers should be able to:
- [ ] Add their own program synonyms
- [ ] Set their own pricing tables
- [ ] Configure time exceptions
- [ ] Set ignore words for false positives
- [ ] Import/export rule configurations

---

## PART 7: QUICK REFERENCE

### What's Automatic (No Setup Needed)

- ✅ Case-insensitive matching
- ✅ Apostrophe handling
- ✅ Month abbreviations (Jan, Feb, etc.)
- ✅ Common program keywords (KNO, clinic, open gym, camp)
- ✅ Time format variations (6:30 PM, 6:30pm, 6:30 p.m.)
- ✅ Age format variations (Ages 5+, 5-12, etc.)
- ✅ Multi-day event date handling

### What Needs Configuration (Per Gym)

- ⚙️ Custom program synonyms (e.g., "Ninja Night" = KNO)
- ⚙️ Price exceptions (e.g., Before Care $20)
- ⚙️ Time exceptions (e.g., Early Dropoff 8:00am)
- ⚙️ Camp pricing (full day/half day, daily/weekly)

---

## Document History

| Date | Change |
|------|--------|
| Feb 5, 2026 | Initial creation - documented precoded vs configurable rules |
| Feb 5, 2026 | Added month abbreviation support |
| Feb 5, 2026 | Fixed multi-day event date validation |
