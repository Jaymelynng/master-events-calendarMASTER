# Validation Rules Architecture

**Last Updated:** March 17, 2026
**Purpose:** Explains how the database-driven validation system works — system checks vs. user rules
**Audience:** Developers, administrators, and future customers

---

## Overview

The validation system is **entirely database-driven**. All validation logic is controlled by rows in the `rules` table in Supabase. There is no hardcoded validation in Python.

| Layer | What It Is | Who Controls It | How to Change |
|-------|-----------|-----------------|---------------|
| **System Checks** | Pre-loaded validation checks (11 total) | Developers seed them; admins toggle on/off | Admin Dashboard or database |
| **User Rules** | Per-gym customizations (synonyms, prices, exceptions) | Administrators/Users | Rule Wizard UI or dismiss flows |

Both layers live in the same `rules` table. System checks have `is_system: true` and `rule_type` starting with `check_`. User rules have types like `valid_price`, `valid_time`, `program_synonym`, `exception`, and `requirement_exception`.

This architecture allows the software to work "out of the box" while giving each customer flexibility to customize for their specific needs.

---

## PART 1: SYSTEM CHECKS (Database-Driven)

These are rows in the `rules` table with `rule_type` starting with `check_` and `is_system: true`. They are executed by `automation/validation_engine.py`. Each check can be toggled on/off via `is_active` and scoped to specific gyms or program types.

### 1.1 The 11 System Checks

| rule_type | What It Checks | Error Type Produced |
|-----------|---------------|---------------------|
| `check_date_mismatch` | Month in description vs actual event dates; end date before start date | `date_mismatch` |
| `check_year_mismatch` | Year in title/description vs actual event year | `year_mismatch` |
| `check_time_mismatch` | Time in title/description vs iClass time | `time_mismatch` |
| `check_age_mismatch` | Age in title/description vs iClass age_min | `age_mismatch` |
| `check_day_mismatch` | Day of week in description vs actual event day (skipped for CAMP) | `day_mismatch` |
| `check_program_mismatch` | Program type in title/description vs iClass type | `program_mismatch` |
| `check_skill_mismatch` | Skill in title vs skill in description (CLINIC only) | `skill_mismatch` |
| `check_title_desc_mismatch` | Title and description contradict each other on program type | `title_desc_mismatch` |
| `check_impossible_date` | Dates that cannot exist (e.g., June 31st, February 30th) | `date_mismatch` |
| `check_price_mismatch` | Price in title differs from price in description | `price_mismatch` |
| `check_camp_price` | Camp prices vs `camp_pricing` table | `camp_price_mismatch` |
| `check_event_price` | Clinic/KNO/Open Gym prices vs `event_pricing` table | `event_price_mismatch` |

> **Note:** That's 12 check functions registered in code, but `check_camp_price` and `check_event_price` are effectively one "price vs pricing table" concept split by event type. The `rules` table has 11 system check rows.

### 1.2 Built-In Intelligence (Inside Check Functions)

Each check function in `validation_engine.py` contains smart matching logic that works automatically:

**Case & Apostrophe Handling:**
- All text comparisons are case-insensitive (`title.lower()`)
- All apostrophe variations stripped before comparison (`'`, `'`, `` ` ``)

**Month Recognition:**
- Both full names AND abbreviations recognized (January, Jan, jan, JAN)
- Word-boundary matching prevents false matches ("marching band" does NOT match "Mar")

**Multi-Day & Multi-Month Events:**
- Events spanning multiple months include ALL months between start and end as valid
- Example: June 28 - August 1 → June, July, AND August are all valid

**Registration/Promo Context Skipping:**
- Months near registration language are NOT flagged ("Register by September 1" skipped)
- Promotional references skipped ("Also see our December camp")

**Time Format Recognition:**
- Multiple formats: `6:30 PM`, `6:30pm`, `6:30 p.m.`, `6p`, `6 PM`
- Pre-cleaning removes false positives: "$62 a day", "Ages 4-13" patterns

**Age Format Recognition:**
- Multiple formats: `Ages 5+`, `Ages 5-12`, `Age 5`, `Students 5+`, `5-12`, `5+`

**Day-of-Week Cleaning:**
- Day ranges ("Monday-Friday", "Monday through Friday") cleaned before comparison
- Day-of-week validation skipped entirely for CAMP events (camps span multiple days)

**Camp Time Exception:**
- Camps can use "Full Day" or "Half Day" instead of specific times

**Price Pattern Recognition:**
- Extracts `$XX` or `$XX.XX` from text
- Camp price tolerance: ±$2; Event price tolerance: ±$1

### 1.3 Default Program Keywords

These keywords are recognized automatically for each program type inside `check_program_mismatch`:

| Program Type | Recognized Keywords |
|--------------|---------------------|
| **KIDS NIGHT OUT** | `kids night out`, `kid's night out`, `kids' night out`, `kno`, `night out`, `parents night out`, `ninja night out` |
| **CLINIC** | `clinic` |
| **OPEN GYM** | `open gym` |
| **CAMP** | `camp` |

Additional keywords can be added via `program_synonym` user rules (see Part 2).

### 1.4 How System Checks Execute

```python
# In validation_engine.py:
def run_validation(ctx, active_checks):
    for check_rule in active_checks:
        # Skip if rule doesn't apply to this gym
        # Skip if rule doesn't apply to this program type
        # Look up check function from CHECK_REGISTRY
        # Run check, collect errors
        # Track hit counts per rule
    return all_errors, hit_counts
```

Each system check:
1. Is fetched from `rules` table where `is_active = true` and `rule_type LIKE 'check_%'`
2. Can be scoped to specific `gym_ids` or `program` types
3. Expired temporary rules are filtered out automatically
4. Hit counts (`last_hit_count`, `last_sync_at`) are updated after each sync

---

## PART 2: USER RULES (Database-Driven)

These are rows in the `rules` table created by administrators via the Rule Wizard UI or dismiss flows. They customize validation behavior per gym.

### 2.1 Rule Types

| Rule Type | Purpose | Example |
|-----------|---------|---------|
| `program_synonym` | "This word means this program type" | `ninja night` → KIDS NIGHT OUT |
| `valid_price` | "This is a valid price for this gym" | `$20` = Before Care |
| `sibling_price` | "This is a valid sibling discount price" | `$35` = Sibling |
| `valid_time` | "This is a valid extra time" | `8:00am` = Early Dropoff |
| `exception` | "Dismiss this specific error" | Dismiss age mismatch for event X |
| `requirement_exception` | "This requirement doesn't apply" | Skip price check for this gym |

### 2.2 Database Schema

```sql
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_permanent BOOLEAN DEFAULT true,
  end_date DATE,                        -- NULL = permanent, or expiry date for temporary rules
  gym_ids TEXT[],                        -- e.g., '{RBA}', '{CCP,CPF}', or '{ALL}' for global
  program TEXT,                          -- e.g., 'CAMP', 'CLINIC', 'ALL'
  scope TEXT,                            -- 'all_events', 'keyword', 'single_event'
  keyword TEXT,                          -- keyword match (when scope = 'keyword')
  event_id UUID,                         -- specific event (when scope = 'single_event')
  rule_type TEXT NOT NULL,               -- 'check_date_mismatch', 'valid_price', 'program_synonym', etc.
  value TEXT,                            -- The keyword/value to match
  label TEXT,                            -- Human-readable label or target type
  note TEXT,                             -- Admin notes
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,                       -- 'rule_wizard', 'dismiss_flow', 'system', etc.
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,       -- true for system checks, false for user rules
  last_hit_count INTEGER,                -- updated after each sync
  last_sync_at TIMESTAMPTZ,             -- when this rule last ran
  description TEXT                       -- longer description of what this rule does
);
```

### 2.3 Example Rules

**Program Synonyms:**
| gym_ids | rule_type | value | label | scope |
|---------|-----------|-------|-------|-------|
| {RBA} | program_synonym | ninja night | KIDS NIGHT OUT | all_events |
| {CCP} | program_synonym | parents night out | KIDS NIGHT OUT | all_events |
| {ALL} | program_synonym | pno | KIDS NIGHT OUT | all_events |

**Price Rules:**
| gym_ids | rule_type | value | label | scope |
|---------|-----------|-------|-------|-------|
| {RBA} | valid_price | 20 | Before Care | keyword |
| {RBA} | valid_price | 20 | After Care | keyword |
| {HGA} | sibling_price | 35 | Sibling Discount | all_events |

**Time Rules:**
| gym_ids | rule_type | value | label | scope |
|---------|-----------|-------|-------|-------|
| {CCP} | valid_time | 8:00am | Early Dropoff | all_events |
| {CCP} | valid_time | 5:30pm | Late Pickup | all_events |

### 2.4 How User Rules Are Applied

User rules are consumed by system check functions at runtime. For example:
- `check_time_mismatch` calls `ctx.get_rules_for_gym()` to get `valid_time` rules and treats those times as acceptable
- `check_program_mismatch` calls `ctx.get_rules_for_gym()` to get `program_synonym` rules and adds them to the keyword lists
- `check_camp_price` and `check_event_price` call `ctx.get_rules_for_gym()` to get `valid_price` rules and add them to the valid price list

### 2.5 Managing Rules

**Via Admin Dashboard — Rule Wizard:**
1. Shift+Click the wand to open Admin Dashboard
2. Go to "Gym Rules" tab
3. Two wizard flows:
   - **Requirement Exception** (3 steps) — skip a check for specific events
   - **Validation Rule** (5 steps) — add synonyms, prices, times

**Via Dismiss Flows:**
- Click a validation error on the Audit & Review tab
- Choose to dismiss with a permanent or temporary rule
- Rule is written directly to the `rules` table

**Via Supabase Dashboard:**
1. Go to Supabase Dashboard
2. Navigate to `rules` table
3. Insert/update/delete rows directly

---

## PART 3: SOURCE OF TRUTH (CRITICAL SECTION)

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
| **PRICE** | Not in API response | Parse from title/description text OR use our `camp_pricing` / `event_pricing` tables |

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
- The validation engine uses these tables as the **source of truth** and flags when the portal price doesn't match

**How Price Validation Works:**
1. Event data collected from iClass public portal (which shows the price the manager entered)
2. `check_camp_price` or `check_event_price` looks up the CORRECT price from our pricing tables
3. If they don't match → `camp_price_mismatch` or `event_price_mismatch` error
4. Additional `valid_price` and `sibling_price` rules in the `rules` table can add extra valid prices per gym

### 3.3 Complete Source of Truth Table

| Data Field | Source of Truth | Where It Comes From | Can We Validate? |
|------------|-----------------|---------------------|------------------|
| **Date** | iClass API | `startDate` field | YES - compare to title/description |
| **Year** | iClass API | Extracted from `startDate` | YES - compare to title |
| **Day of Week** | Calculated | From `startDate` (e.g., "Saturday") | YES - compare to description |
| **Time** | iClass API | `schedule.startTime` / `endTime` | YES - compare to title/description |
| **Age** | iClass API | `minAge` / `maxAge` fields | YES - compare to title/description |
| **Program Type** | iClass API | `link_type_id` field | YES - compare to title/description keywords |
| **Price (CAMP)** | OUR Supabase table | `camp_pricing` + `rules` (valid_price) | YES - compare description price to our table (±$2 tolerance) |
| **Price (CLINIC, KNO, OPEN GYM)** | OUR Supabase table | `event_pricing` + `rules` (valid_price) | YES - compare description price to our table (±$1 tolerance) |

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
- The validation engine queries for prices where `effective_date <= today` AND (`end_date IS NULL` OR `end_date >= today`)
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
│  • Event data from iClass API (via f12_collect_and_import.py)   │
│  • System checks from rules table (is_system=true, check_*)    │
│  • User rules from rules table (valid_price, valid_time, etc.) │
│  • Camp pricing from camp_pricing table                         │
│  • Event pricing from event_pricing table                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: BUILD VALIDATION CONTEXT                   │
│  • Create ValidationContext with all event data                 │
│  • Parse dates, times, ages, prices from title/description      │
│  • Attach database lookup functions for rules + pricing         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          STEP 3: RUN VALIDATION ENGINE                          │
│  • validation_engine.run_validation(ctx, active_checks)         │
│  • For each active system check:                                │
│    - Skip if check doesn't apply to this gym or program type    │
│    - Look up check function from CHECK_REGISTRY                 │
│    - Run check function → returns list of errors                │
│    - Check functions internally read user rules as needed        │
│  • Collect all errors + hit counts                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: STORE RESULTS                              │
│  • Errors stored on each event in Supabase                      │
│  • Hit counts updated on each system check rule                 │
│  • last_sync_at updated on each rule that ran                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Behaviors

- **SPECIAL EVENT type:** All validation is skipped entirely
- **No description:** All validation is skipped (nothing to compare against)
- **Flyer-only events:** System cannot read images, so no text-based validation runs
- **Expired temporary rules:** Automatically filtered out during fetch (`is_permanent` + `end_date` check)

---

## PART 5: ERROR CATEGORIES

### The Simple Rule:
- **DATA Error** = Something is **WRONG** (two things don't match)

> **Note:** FORMAT errors (for missing information like "no age in title" or "no price in description") were planned but never implemented. All references to FORMAT errors removed March 17, 2026.

### 5.1 DATA Errors (Red - High Priority)

Something is **WRONG** - two sources don't match. These can confuse customers!

| Error Type | What's Compared | Source of Truth | Example |
|------------|-----------------|-----------------|---------|
| `year_mismatch` | iClass year vs title/description year | iClass API | iClass: 2026, Title: "2025" |
| `date_mismatch` | iClass month vs description month; impossible dates; end before start | iClass API | iClass: February, Desc: "January" |
| `day_mismatch` | iClass day vs description day | iClass API | iClass: Saturday, Desc: "Friday" |
| `time_mismatch` | iClass time vs title/description time | iClass API | iClass: 9:00 AM, Desc: "10am" |
| `age_mismatch` | iClass age vs title/description age | iClass API | iClass: 5+, Title: "Ages 4-12" |
| `program_mismatch` | iClass program vs title/description keywords | iClass API | iClass: KNO, Title: "Clinic" |
| `skill_mismatch` | Title skill vs description skill (clinics) | Title vs Desc | Title: "Tumbling", Desc: "Bars" |
| `title_desc_mismatch` | Title program type vs description program type | Title vs Desc | Title: "Clinic", Desc: "Kids Night Out" |
| `price_mismatch` | Title price vs description price | Title vs Desc | Title: "$50", Desc: "$45" |
| `camp_price_mismatch` | Description price vs `camp_pricing` table | YOUR Supabase table | Desc: "$150", Valid: $125 or $175 |
| `event_price_mismatch` | Description price vs `event_pricing` table | YOUR Supabase table | Desc: "$30", Valid: $40 for this gym |

**Key insight:** Most DATA errors compare against iClass API (the truth). Price validation compares against YOUR pricing tables in Supabase — these are YOUR source of truth that you maintain.

---

## PART 6: KEY FILES

| File | Purpose |
|------|---------|
| `automation/validation_engine.py` | All validation check functions + `run_validation()` entry point + `fetch_active_checks()` |
| `automation/f12_collect_and_import.py` | Event collection via Direct HTTP API; calls `validation_engine.run_validation()` |
| `src/lib/validationHelpers.js` | Frontend validation display helpers |
| `src/components/AdminDashboard/AdminGymRules.js` | Rule Wizard UI — creates user rules |
| `src/components/AdminDashboard/AdminAuditReview.js` | Audit & Review tab — dismiss flows write rules |
| `src/lib/api.js` | API functions for reading/writing rules |

---

## PART 7: FUTURE ENHANCEMENTS

### 7.1 Planned Rule Types

| Rule Type | Purpose | Status |
|-----------|---------|--------|
| `program_ignore` | Ignore certain words for a program type | Planned — needed for "open gym" as station name |

### 7.2 Self-Service Configuration

For a sellable product, customers should be able to:
- [x] Add their own program synonyms (via Rule Wizard)
- [x] Set their own pricing tables (via Admin > Pricing)
- [x] Configure time exceptions (via Rule Wizard)
- [ ] Set ignore words for false positives (`program_ignore`)
- [ ] Import/export rule configurations

---

## PART 8: QUICK REFERENCE

### What's Automatic (No Setup Needed) — Built Into System Checks

These work for ALL gyms out of the box via the 11 system checks in validation_engine.py. No configuration needed. If you sell the app, every customer gets these for free.

- Case-insensitive matching (all comparisons)
- Apostrophe handling (Kid's, Kids', Kids all match)
- Month abbreviations (Jan, Feb, etc.) with word-boundary matching
- Common program keywords (KNO, clinic, open gym, camp)
- Time format variations (6:30 PM, 6:30pm, 6:30 p.m., 6p)
- Age format variations (Ages 5+, 5-12, Age 5, Students 5+)
- Multi-month event handling (June-August camp includes July as valid)
- End date before start date detection
- Impossible date detection (June 31st, February 30th)
- Registration/promo context skipping ("Register by Sept" doesn't trigger date error)
- Camp "Full Day"/"Half Day" counts as valid time info
- Day-of-week validation skipped for CAMP events (camps span multiple days)
- Day-range cleaning ("Monday-Friday" in description doesn't trigger day mismatch)
- Price pattern cleaning (removes "$62 a day" and "Ages 4-13" before time matching to avoid false positives)
- Date-based pricing (effective_date/end_date handles price increases automatically)
- Title vs description cross-checks (program type, skill, price)

### What Needs Configuration (Per Gym)

- Custom program synonyms (e.g., "Ninja Night" = KNO) — via Admin Dashboard > Gym Rules
- Price exceptions (e.g., Before Care $20) — via Admin Dashboard > Gym Rules
- Time exceptions (e.g., Early Dropoff 8:00am) — via Admin Dashboard > Gym Rules
- Camp pricing (full day/half day, daily/weekly) — via `camp_pricing` table
- Event pricing (CLINIC, KNO, OPEN GYM per gym) — via `event_pricing` table

---

## PART 9: NEW GYM SETUP GUIDE (For Selling)

This section documents what a NEW gym customer needs to do to get their events validated. Use this as a setup checklist.

### 9.1 Architecture Overview (Why It's SaaS-Ready)

The validation system is designed with two layers:

| Layer | What | Who Maintains | How Many Rules |
|-------|------|---------------|----------------|
| **System Checks** | 11 checks in the `rules` table | Us (developers seed them) | 11 pre-loaded, toggleable |
| **User Rules** | Per-gym customizations in the `rules` table | The gym owner (via Admin UI) | 3-8 config entries per gym |

A new gym gets ALL system checks for free. They only need to add their specific config.

### 9.2 Required Setup (Must Do)

These are the minimum steps to get a new gym validated:

| Step | What | Where | Why |
|------|------|-------|-----|
| 1 | Add gym to `gyms` table | Supabase | Creates the gym identity (ID, name, location) |
| 2 | Set `iclass_slug` on the gym | Supabase `gyms.iclass_slug` | Maps to their iClassPro portal URL |
| 3 | Add portal URLs | Supabase `gym_links` table | Tells the collector which pages to visit for each event type |
| 4 | Set event prices | Admin > Pricing tab | Source of truth for CLINIC, KNO, OPEN GYM prices |
| 5 | Set camp prices (if applicable) | Admin > Pricing tab | Source of truth for camp prices (FD/HD, daily/weekly) |

**After these 5 steps, the gym is fully operational.** System checks handle everything else.

### 9.3 Optional Setup (As Needed)

These only need to be added when the gym has non-standard names or pricing:

| What | When Needed | Where to Add |
|------|-------------|--------------|
| Program synonyms | Gym calls KNO "Ninja Night" or "Parent's Night Out" | Admin > Gym Rules → program_synonym |
| Price exceptions | Gym has add-on prices like "Before Care $20" or "Sibling $35" | Admin > Gym Rules → valid_price |
| Time exceptions | Gym has non-standard times like "Early Dropoff 8:00am" | Admin > Gym Rules → valid_time |

**Pro tip:** You often discover these AFTER the first sync. The audit page will show errors, and you can click "+ Rule" to add a permanent rule right from the error card.

### 9.4 How to Find the iClass Slug

The `iclass_slug` is the part of the URL after `portal.iclasspro.com/`. For example:
- `https://portal.iclasspro.com/capgymavery/camps/123` → slug is `capgymavery`
- `https://portal.iclasspro.com/houstongymnastics/camps/456` → slug is `houstongymnastics`

Have the gym owner share any link from their iClassPro portal and extract the slug.

### 9.5 Current Gym Slugs (Reference)

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

### 9.6 Future: Setup Wizard (Planned)

A 4-step guided form in the Admin Dashboard that writes to all the tables above:
1. **Basic Info** → `gyms` table (name, ID, slug)
2. **Portal Links** → `gym_links` table (URLs per event type)
3. **Pricing** → `event_pricing` + `camp_pricing` tables
4. **Custom Rules** (optional) → `rules` table (synonyms, price exceptions, time exceptions)

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
| Feb 17, 2026 | Added New Gym Setup Guide for sellability |
| Mar 9, 2026 | Unified on `rules` table — `gym_valid_values` table deprecated |
| Mar 17, 2026 | **Major rewrite:** Replaced "Precoded vs Configurable" framing with "System Checks vs User Rules" |
| Mar 17, 2026 | All validation now database-driven via `validation_engine.py` — no hardcoded validation in Python |
| Mar 17, 2026 | Removed all `gym_valid_values` references — table has been DROPPED |
| Mar 17, 2026 | Removed FORMAT error documentation — FORMAT errors were planned but never implemented |
| Mar 17, 2026 | Added `rules` table full schema, 11 system checks table, key files section |
| Mar 17, 2026 | Updated validation flow diagram to show validation_engine.py pipeline |
