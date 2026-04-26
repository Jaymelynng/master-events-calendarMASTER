# Validation Rules Reference — Catalog of What to Check

**Status:** Reference / IP preservation
**Saved:** April 26, 2026
**Source:** Originally lived in `src/components/AdminDashboard/AdminAuditRulesReference.js` as a hardcoded list — preserved here as a markdown reference so it survives any future UI rewrite.

---

## Why This Doc Exists

This is the catalog of every error type Jayme has identified as worth catching across her 10-gym calendar over months of use. It represents real operational pain points — the actual things that go wrong when gym staff manually edit events in iClassPro.

The current Python implementation of these checks has been partially rewritten (March 2026 — moved from hardcoded to database-driven) and the `rules` table is currently empty in production, so most checks are NOT actively running. **This doc preserves the full catalog so that when the system is rebuilt, the institutional knowledge isn't lost.**

See [NEW_ERRORS_COMMAND_CENTER_VISION.md](NEW_ERRORS_COMMAND_CENTER_VISION.md) for the bigger-picture pivot — many of these checks become obsolete in a structured-editor world (errors can't happen by construction). This doc is the **specification of what mismatches matter**, regardless of how they get prevented or detected.

---

## Status legend

- **🟢 Code exists** — Function exists in [validation_engine.py](../../automation/validation_engine.py) CHECK_REGISTRY (12 functions total). Just needs a row in the `rules` table to activate.
- **🔴 Code removed** — Function was in the old hardcoded Python (~lines 874-2189 of f12_collect_and_import.py) but was deleted in March 2026 rewrite. Would need to be reimplemented if wanted.
- **🟡 Status/Info** — Not really a "validation error" but useful state info.

---

## Section 1: Completeness Checks (does the field have data at all)
**All 🔴 — code removed in March 2026 rewrite. Only relevant if NOT moving to structured-editor architecture.**

| # | Error Type | Severity | What It Checks | Compares | Applies To |
|---|------------|----------|----------------|----------|------------|
| 1 | missing_age_in_title | warning | Title does not contain an age (e.g., "Ages 5+") | Title text vs Age pattern regex | ALL except SPECIAL EVENT |
| 2 | missing_date_in_title | warning | Title does not contain a date (e.g., "March 15") | Title text vs Date pattern regex | ALL except SPECIAL EVENT |
| 3 | missing_program_in_title | warning | Title does not mention its program type | Title text vs Program keywords | ALL except SPECIAL EVENT |
| 4 | missing_age_in_description | warning | Description does not contain an age reference | Description vs Age pattern regex | ALL except SPECIAL EVENT |
| 5 | missing_datetime_in_description | warning | Description does not contain any date OR time | Description vs Date/time regex | ALL except SPECIAL EVENT |
| 6 | missing_time_in_description | warning | Description does not mention a time | Description vs Time pattern regex | ALL except SPECIAL EVENT |
| 7 | missing_program_in_description | warning | Description does not mention its program type | Description vs Program keywords | ALL except SPECIAL EVENT |
| 8 | clinic_missing_skill | info | Clinic event has no skill mentioned (e.g., "back handspring") | Title + Description vs hardcoded skills list | CLINIC only |
| 43 | missing_price_in_description | warning | No price ($) found in description | Description vs $ symbol presence | ALL except SPECIAL EVENT |

---

## Section 2: Date & Time Mismatches
**All 🟢 — code exists, just needs rules-table activation.**

| # | Error Type | Severity | What It Checks | Compares | Applies To |
|---|------------|----------|----------------|----------|------------|
| 9 | date_mismatch (impossible) | error | Event end date is before start date (structural error) | iClass startDate vs endDate | ALL except SPECIAL EVENT |
| 10 | date_mismatch (month) | error | Month mentioned in description doesn't match event date range | iClass start/end month vs Description month names (first 200 chars) | ALL except SPECIAL EVENT |
| 11 | year_mismatch | error | Year in title or description doesn't match event year | iClass startDate year vs years in title/description (first 300 chars) | ALL except SPECIAL EVENT |
| 12 | time_mismatch (title) | warning | Time in title doesn't match scheduled time | iClass schedule time vs Title times (first 200 chars) | ALL except SPECIAL EVENT |
| 13 | time_mismatch (description) | warning | Time in description doesn't match scheduled time | iClass schedule time vs Description times (first 300 chars) | ALL except SPECIAL EVENT |

---

## Section 3: Age Mismatches
**All 🟢 — code exists.**

| # | Error Type | Severity | What It Checks | Compares | Applies To |
|---|------------|----------|----------------|----------|------------|
| 14 | age_mismatch (title) | warning | Min age in title doesn't match iClass age | iClass age_min vs Title age | ALL except SPECIAL EVENT |
| 15 | age_mismatch (description) | warning | Min age in description doesn't match iClass age | iClass age_min vs Description age | ALL except SPECIAL EVENT |
| 16 | age_mismatch (title vs desc) | warning | Title age doesn't match description age | Title age vs Description age | ALL except SPECIAL EVENT |

**Known gap:** Maximum age is ignored — only minimum age is checked.

---

## Section 4: Day of Week
**🟢 — code exists.**

| # | Error Type | Severity | What It Checks | Compares | Applies To |
|---|------------|----------|----------------|----------|------------|
| 17 | day_mismatch | warning | Day of week in description doesn't match event's actual day | Calculated day from iClass startDate vs Description day names (first 200 chars) | ALL except CAMP and SPECIAL EVENT |

**Known gap:** `day_abbrevs` variable is defined in code but never actually used. Day abbreviations like "Mon", "Tues" are not detected.

---

## Section 5: Program Type Mismatches
**All 🟢 — code exists. The single check function `check_program_mismatch` handles all variants by inspecting iClass event_type vs title/description keywords.**

| # | Error Type | Severity | What It Checks | Applies To |
|---|------------|----------|----------------|------------|
| 18 | program_mismatch | error | iClass=KNO but title contains "Clinic" | KIDS NIGHT OUT |
| 19 | program_mismatch | error | iClass=KNO but title contains "Open Gym" | KIDS NIGHT OUT |
| 20 | program_mismatch | error | iClass=CLINIC but title contains "KNO" | CLINIC |
| 21 | program_mismatch | error | iClass=CLINIC but title contains "Open Gym" | CLINIC |
| 22 | program_mismatch | error | iClass=OPEN GYM but title contains "KNO" | OPEN GYM |
| 23 | program_mismatch | error | iClass=OPEN GYM but title contains "Clinic" | OPEN GYM |
| 24 | program_mismatch | warning | iClass=KNO but description doesn't mention "Kids Night Out" or "KNO" | KIDS NIGHT OUT |
| 25 | program_mismatch | error | iClass=KNO but description says "Clinic" | KIDS NIGHT OUT |
| 26 | program_mismatch | warning | iClass=CLINIC but description doesn't mention "Clinic" | CLINIC |
| 27 | program_mismatch | error | iClass=CLINIC but description says "Kids Night Out" | CLINIC |
| 28 | program_mismatch | error | iClass=CLINIC but description starts with "Open Gym" | CLINIC |
| 30 | program_mismatch | warning | iClass=OPEN GYM but description doesn't mention "Open Gym" | OPEN GYM |
| 31 | program_mismatch | error | iClass=OPEN GYM but description says "Clinic" | OPEN GYM |
| 32 | program_mismatch | error | iClass=OPEN GYM but description says "Kids Night Out" | OPEN GYM |
| 33 | program_mismatch | error | iClass=CAMP but description starts with "Clinic" | CAMP |
| 34 | program_mismatch | error | iClass=CAMP but description starts with "Kids Night Out" | CAMP |
| 35 | program_mismatch | error | iClass=CAMP but title contains "Kids Night Out" | CAMP |
| 36 | program_mismatch | error | iClass=CAMP but title contains "Clinic" | CAMP |

**Known gap (`program_ignore` rule):** Can't ignore "open gym" when it's used as an activity name inside a KNO event description (e.g., "We'll have open gym time during this Kids Night Out"). Causes false positives.

---

## Section 6: Skill Mismatches (Clinics)
**🟢 — code exists.**

| # | Error Type | Severity | What It Checks | Applies To |
|---|------------|----------|----------------|------------|
| 29 | skill_mismatch | error | Skill mentioned in title differs from skill in description | CLINIC only |

E.g., title says "Back Handspring Clinic" but description teaches "Cartwheel."

---

## Section 7: Title vs Description Mismatches
**All 🟢 — handled by `check_title_desc_mismatch`.**

| # | Error Type | Severity | What It Checks | Applies To |
|---|------------|----------|----------------|------------|
| 37 | title_desc_mismatch | error | Title says "Clinic" but description says "Kids Night Out" | ALL except SPECIAL EVENT |
| 38 | title_desc_mismatch | error | Title says "Kids Night Out" but description says "Clinic" | ALL except SPECIAL EVENT |
| 39 | title_desc_mismatch | error | Title says "Open Gym" but description says "Kids Night Out" | ALL except SPECIAL EVENT |
| 40 | title_desc_mismatch | error | Title says "Kids Night Out" but description starts with "Open Gym" | ALL except SPECIAL EVENT |
| 41 | title_desc_mismatch | error | Title says "Clinic" but description starts with "Open Gym" | ALL except SPECIAL EVENT |
| 42 | title_desc_mismatch | error | Title says "Open Gym" but description says "Clinic" | ALL except SPECIAL EVENT |

---

## Section 8: Pricing
**All 🟢 — code exists.**

| # | Error Type | Severity | What It Checks | Source of Truth |
|---|------------|----------|----------------|-----------------|
| 44 | price_mismatch | error | Price in title doesn't match price in description (within $1) | Title $prices vs Description $prices |
| 45 | camp_price_mismatch | warning | Camp price in title/description doesn't match `camp_pricing` table | `camp_pricing` table (full/half day daily/weekly) |
| 46 | event_price_mismatch | error | Event price doesn't match `event_pricing` table (within $1) | `event_pricing` table (with effective_date) |

---

## Section 9: Registration Status (informational, not validation)
**All 🟡 — these are state, not errors.**

| # | Error Type | Severity | What It Checks | Applies To |
|---|------------|----------|----------------|------------|
| 47 | registration_closed | warning | Registration has closed but event hasn't started yet | ALL |
| 48 | registration_not_open | info | Registration hasn't opened yet (start date is in the future) | ALL |

These should probably surface as informational badges (like the openings count), not as "errors" to dismiss.

---

## Known Gaps (Things Not Yet Checked)

| What | Risk | Status | Notes |
|------|------|--------|-------|
| Year in description | HIGH | ✅ FIXED (Mar 5, 2026) | Now checks both title AND description (first 300 chars) |
| Month in title | Medium | Not started | Month validation only checks description, not title |
| Max age | Low | Not started | Only minimum age is compared. Maximum age ignored. |
| `program_ignore` rule | Medium | Not started | Can't ignore "open gym" when it's an activity name inside KNO |
| Spelling/grammar | Low | Not planned | No spell check or grammar check |
| Consecutive day validation | Low | Not planned | Doesn't verify camps run Mon-Fri or any specific day sequence |
| Flyer-only events | Low | Known limitation | Events with only an image/flyer and no text can't be validated |
| Day abbreviations | Low | Not started | `day_abbrevs` variable defined but never used in validation |

---

## What to Do With This Catalog When Rebuilding

### If going the "errors-can't-happen" structured editor route (recommended):

The following sections become **structurally impossible** because the title/description are generated from structured fields:
- Section 1 (Completeness) — fields are required to save, generated copy includes them
- Section 2 (Date/Time) — date/time appear in copy via template substitution from iClass data
- Section 3 (Age) — age comes from iClass settings, inserted into copy via template
- Section 4 (Day of Week) — calculated from iClass date, inserted into copy via template
- Section 5 (Program Type) — program is locked to iClass event_type, can't drift
- Section 6 (Skill) — skill is a structured field for clinics, inserted into copy
- Section 7 (Title vs Description) — both generated from same source, can't disagree

The following remain genuinely useful (because they're checks against EXTERNAL truth, not internal consistency):
- Section 8 (Pricing) — still need to check price matches the pricing table; tenant might override per gym
- Section 9 (Registration Status) — informational, surface as badges

So in the rebuild, **the rules table needs to support ~3-4 active check categories instead of 48**, plus the user-defined exception rules (valid_price, valid_time, program_synonym, etc.).

### If keeping the current detect-after-the-fact model:

Seed all 12 functions in `validation_engine.py` CHECK_REGISTRY into the `rules` table:
- check_date_mismatch
- check_year_mismatch
- check_time_mismatch
- check_age_mismatch
- check_day_mismatch
- check_program_mismatch
- check_skill_mismatch
- check_title_desc_mismatch
- check_impossible_date
- check_price_mismatch
- check_camp_price
- check_event_price

Each becomes one row with `is_active=true`, `gym_ids=['ALL']`, `program='ALL'` (or scoped per gym/program).

The 9 completeness checks (Section 1) would need to be REIMPLEMENTED in Python — they were deleted. Worth the work only if the structured editor path is NOT being pursued.

---

## Original Reference UI

The original 48-rule list lived in `src/components/AdminDashboard/AdminAuditRulesReference.js` (still present in the codebase as of April 26, 2026). It listed Python line numbers for each check (~lines 1164-2189 of f12_collect_and_import.py) — those line numbers are now stale because the file was rewritten. This markdown reference is the source of truth going forward.
