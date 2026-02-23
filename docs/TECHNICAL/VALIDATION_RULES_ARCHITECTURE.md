# Validation Rules Architecture

**Last Updated:** February 17, 2026  
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

### 1.7 Multi-Day & Multi-Month Event Handling

**Events spanning multiple months are handled correctly.**

For an event **June 28 - August 1**:
- `June`, `July`, AND `August` are ALL valid months
- Every month BETWEEN start and end is included — not just start and end
- No false "date mismatch" error

For a camp **June 30 - July 5**:
- Both `June` and `July` are valid months
- Description mentioning either month is fine

**Code:** Builds a set of ALL months from startDate through endDate.

### 1.8 End Date Before Start Date Detection

**If the end date is before the start date, it's always flagged as a manager error.**

Example: Start date `2026-07-10`, End date `2026-06-28` → ERROR
This is a universal rule — no gym needs to configure this.

### 1.9 Registration/Promo Date Context Skipping

**Months mentioned near registration or promotional language are NOT flagged.**

These patterns are automatically skipped:
- `"Register by September 1"` — registration context
- `"Sign up before March"` — signup context
- `"Also see our December camp"` — promotional context
- `"Check out upcoming January events"` — promotional context

This prevents false positives when descriptions reference other dates that aren't the event date.

### 1.10 Camp Time Format Exception

**Camps can use "Full Day" or "Half Day" instead of specific times.**

- A clinic MUST have a specific time like `6:30 PM`
- A camp can say `Full Day` or `Half Day` — that counts as valid time info

### 1.11 Price Pattern Recognition

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
  gym_id TEXT NOT NULL,        -- e.g., "RBA", "CCP", or "ALL" for global
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
| ALL | program_synonym | pno | KIDS NIGHT OUT |

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
- But their public portal API does NOT expose pricing schedule data
- Managers pick the wrong pricing schedule, enter wrong prices, or don't update after price increases
- We cannot rely on managers having anything accurate

**Our Solution:**
- **For CAMPS:** `camp_pricing` table in Supabase with correct prices per gym (full day/half day, daily/weekly)
- **For CLINIC, KNO, OPEN GYM:** `event_pricing` table in Supabase with correct prices per gym per event type
- Both tables support **date-based pricing** with `effective_date` and `end_date` columns so price increases are handled automatically
- The scraper uses these tables as the **source of truth** and flags when the portal price doesn't match

**How Price Validation Works:**
1. Scraper pulls event from public portal (which shows the price the manager entered)
2. Scraper looks up the CORRECT price from our pricing tables
3. If they don't match → `event_price_mismatch` or `camp_price_mismatch` error
4. Additional `gym_valid_values` rules can add extra valid prices per gym (sibling discounts, etc.)

### 3.3 Complete Source of Truth Table

| Data Field | Source of Truth | Where It Comes From | Can We Validate? |
|------------|-----------------|---------------------|------------------|
| **Date** | ✅ iClass API | `startDate` field | YES - compare to title/description |
| **Year** | ✅ iClass API | Extracted from `startDate` | YES - compare to title |
| **Day of Week** | ✅ Calculated | From `startDate` (e.g., "Saturday") | YES - compare to description |
| **Time** | ✅ iClass API | `schedule.startTime` / `endTime` | YES - compare to title/description |
| **Age** | ✅ iClass API | `minAge` / `maxAge` fields | YES - compare to title/description |
| **Program Type** | ✅ iClass API | `link_type_id` field | YES - compare to title/description keywords |
| **Price (CAMP)** | ✅ OUR Supabase table | `camp_pricing` + `gym_valid_values` | YES - compare description price to our table (±$2 tolerance) |
| **Price (CLINIC, KNO, OPEN GYM)** | ✅ OUR Supabase table | `event_pricing` + `gym_valid_values` | YES - compare description price to our table (±$1 tolerance) |

### 3.4 Why This Matters

**For fields WITH a source of truth (Date, Time, Age, Program):**
- We can catch REAL errors: "iClass says 9:00 AM but description says 10:00 AM"
- High confidence these are actual mistakes

**For CAMP prices:**
- We built our own source of truth (`camp_pricing` table)
- We can catch: "Description says $150 but this gym's camps are $125 or $175"
- Requires YOU to maintain the pricing table

**For other event prices (Clinic, KNO, Open Gym):**
- We built our own source of truth (`event_pricing` table, added Feb 2026)
- We can catch: "Description says $25 but this gym's Clinic price is $30"
- Requires YOU to maintain the pricing table
- Checks title AND description prices (fixed Feb 17, 2026 — previously only checked description)

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

This table is the SOURCE OF TRUTH for camp prices. When validating camp events, description prices are compared against this table. Tolerance: ±$2 to handle rounding.

### 3.6 Event Pricing Table

```sql
CREATE TABLE event_pricing (
  id UUID PRIMARY KEY,
  gym_id VARCHAR NOT NULL,       -- e.g., "CCP", "HGA"
  event_type VARCHAR NOT NULL,   -- "KIDS NIGHT OUT", "CLINIC", "OPEN GYM"
  price NUMERIC NOT NULL,        -- e.g., 40.00
  duration_hours NUMERIC,        -- optional: 1.0, 1.5 (for future use)
  effective_date DATE NOT NULL,  -- when this price takes effect
  end_date DATE,                 -- NULL = still active, or date when price expired
  notes TEXT                     -- e.g., "Price increase Feb 10, 2026"
);
```

This table is the SOURCE OF TRUTH for CLINIC, KNO, and OPEN GYM prices.

**How date-based pricing works:**
- The scraper queries for prices where `effective_date <= today` AND (`end_date IS NULL` OR `end_date >= today`)
- When prices increase, add new rows with the new `effective_date` and set `end_date` on the old rows
- This means price history is preserved and the correct price is always used automatically

**Current confirmed prices (as of Feb 10, 2026):**

| Gym | Clinic | KNO | Open Gym |
|-----|--------|-----|----------|
| CCP | $35 | $40 | $10 |
| CPF | $30 | $40 | $10 |
| CRR | $30 | $40 | $10 |
| EST | $30 | $40 | $35 |
| HGA | $30 | $45 | $20 |
| OAS | $30 | $45 | $20 |
| RBA | $30 | $40 | $20 |
| RBK | $30 | $40 | $15 |
| SGT | $30 | $45 | $30 |
| TIG | $30 | $40 | $20 |

Tolerance: ±$1 (exact match).

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
| `price_mismatch` | Title price vs description price | Title vs Desc | Title: "$50", Desc: "$45" |
| `camp_price_mismatch` | Description price vs `camp_pricing` table | ✅ YOUR Supabase table | Desc: "$150", Valid: $125 or $175 |
| `event_price_mismatch` | Description price vs `event_pricing` table | ✅ YOUR Supabase table | Desc: "$30", Valid: $40 for this gym |

**Key insight:** Most DATA errors compare against iClass API (the truth). Price validation compares against YOUR pricing tables in Supabase — these are YOUR source of truth that you maintain.

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

### What's Automatic (No Setup Needed) — UNIVERSAL RULES

These work for ALL gyms out of the box. No configuration needed. If you sell the app, every customer gets these for free.

- ✅ Case-insensitive matching (all comparisons)
- ✅ Apostrophe handling (Kid's, Kids', Kids all match)
- ✅ Month abbreviations (Jan, Feb, etc.) with word-boundary matching
- ✅ Common program keywords (KNO, clinic, open gym, camp)
- ✅ Time format variations (6:30 PM, 6:30pm, 6:30 p.m., 6p)
- ✅ Age format variations (Ages 5+, 5-12, Age 5, Students 5+)
- ✅ Multi-month event handling (June-August camp includes July as valid)
- ✅ End date before start date detection
- ✅ Registration/promo context skipping ("Register by Sept" doesn't trigger date error)
- ✅ Camp "Full Day"/"Half Day" counts as valid time info
- ✅ Day-of-week validation skipped for CAMP events (camps span multiple days)
- ✅ Day-range cleaning ("Monday-Friday" in description doesn't trigger day mismatch)
- ✅ Price pattern cleaning (removes "$62 a day" and "Ages 4-13" before time matching to avoid false positives)
- ✅ Date-based pricing (effective_date/end_date handles price increases automatically)

### What Needs Configuration (Per Gym)

- ⚙️ Custom program synonyms (e.g., "Ninja Night" = KNO) — via Admin Dashboard > Gym Rules
- ⚙️ Price exceptions (e.g., Before Care $20) — via Admin Dashboard > Gym Rules
- ⚙️ Time exceptions (e.g., Early Dropoff 8:00am) — via Admin Dashboard > Gym Rules
- ⚙️ Camp pricing (full day/half day, daily/weekly) — via `camp_pricing` table
- ⚙️ Event pricing (CLINIC, KNO, OPEN GYM per gym) — via `event_pricing` table

---

## PART 8: NEW GYM SETUP GUIDE (For Selling)

This section documents what a NEW gym customer needs to do to get their events validated. Use this as a setup checklist.

### 8.1 Architecture Overview (Why It's SaaS-Ready)

The validation system is designed with two layers:

| Layer | What | Who Maintains | How Many Rules |
|-------|------|---------------|----------------|
| **Universal** | Built into the code | Us (developers) | 15+ patterns that work for ALL gyms |
| **Per-Gym** | Stored in Supabase tables | The gym owner (via Admin UI) | 3-8 config entries per gym |

A new gym gets ALL universal rules for free. They only need to add their specific config.

### 8.2 Required Setup (Must Do)

These are the minimum steps to get a new gym validated:

| Step | What | Where | Why |
|------|------|-------|-----|
| 1 | Add gym to `gyms` table | Supabase | Creates the gym identity (ID, name, location) |
| 2 | Set `iclass_slug` on the gym | Supabase `gyms.iclass_slug` | Maps to their iClassPro portal URL |
| 3 | Add portal URLs | Supabase `gym_links` table | Tells the scraper which pages to visit for each event type |
| 4 | Set event prices | Admin > Pricing tab | Source of truth for CLINIC, KNO, OPEN GYM prices |
| 5 | Set camp prices (if applicable) | Admin > Pricing tab | Source of truth for camp prices (FD/HD, daily/weekly) |

**After these 5 steps, the gym is fully operational.** Universal rules handle everything else.

### 8.3 Optional Setup (As Needed)

These only need to be added when the gym has non-standard names or pricing:

| What | When Needed | Where to Add |
|------|-------------|--------------|
| Program synonyms | Gym calls KNO "Ninja Night" or "Parent's Night Out" | Admin > Gym Rules → program_synonym |
| Price exceptions | Gym has add-on prices like "Before Care $20" or "Sibling $35" | Admin > Gym Rules → price |
| Time exceptions | Gym has non-standard times like "Early Dropoff 8:00am" | Admin > Gym Rules → time |

**Pro tip:** You often discover these AFTER the first sync. The audit page will show errors, and you can click "+ Rule" to add a permanent rule right from the error card.

### 8.4 How to Find the iClass Slug

The `iclass_slug` is the part of the URL after `portal.iclasspro.com/`. For example:
- `https://portal.iclasspro.com/capgymavery/camps/123` → slug is `capgymavery`
- `https://portal.iclasspro.com/houstongymnastics/camps/456` → slug is `houstongymnastics`

Have the gym owner share any link from their iClassPro portal and extract the slug.

### 8.5 Current Gym Slugs (Reference)

| Gym ID | Name | iClass Slug |
|--------|------|-------------|
| CCP | Capital Gymnastics Cedar Park | capgymavery |
| CPF | Capital Gymnastics Pflugerville | capgymhp |
| CRR | Capital Gymnastics Round Rock | capgymroundrock |
| EST | Estrella Gymnastics | estrellagymnastics |
| HGA | Houston Gymnastics Academy | houstongymnastics |
| OAS | Oasis Gymnastics | oasisgymnastics |
| RBA | Rowland Ballard Atascocita | rbatascocita |
| RBK | Rowland Ballard Kingwood | rbkingwood |
| SGT | Scottsdale Gymnastics | scottsdalegymnastics |
| TIG | Tigar Gymnastics | tigar |

### 8.6 Future: Setup Wizard (Planned)

A 4-step guided form in the Admin Dashboard that writes to all the tables above:
1. **Basic Info** → `gyms` table (name, ID, slug)
2. **Portal Links** → `gym_links` table (URLs per event type)
3. **Pricing** → `event_pricing` + `camp_pricing` tables
4. **Custom Rules** (optional) → `gym_valid_values` table

All 4 steps just write to existing tables. No new backend code needed.

---

## Document History

| Date | Change |
|------|--------|
| Feb 5, 2026 | Initial creation - documented precoded vs configurable rules |
| Feb 5, 2026 | Added month abbreviation support |
| Feb 5, 2026 | Fixed multi-day event date validation |
| Feb 10, 2026 | Added `event_pricing` table as source of truth for CLINIC/KNO/OPEN GYM prices |
| Feb 10, 2026 | Added multi-month camp support (all months between start and end are valid) |
| Feb 10, 2026 | Added end-date-before-start-date detection |
| Feb 10, 2026 | Added registration/promo context skipping for date validation |
| Feb 10, 2026 | Expanded universal rules documentation for sellability |
| Feb 10, 2026 | Updated confirmed pricing table for all 10 gyms |
| Feb 17, 2026 | Fixed price validation bug — now checks title+description (not just description) |
| Feb 17, 2026 | Made GYMS dict database-driven (loads from Supabase with fallback) |
| Feb 17, 2026 | Added Part 8: New Gym Setup Guide for sellability |
| Feb 17, 2026 | Updated Part 3.4 — event_pricing IS now source of truth (was outdated) |
