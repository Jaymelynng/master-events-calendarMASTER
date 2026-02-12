# 🔍 AUDIT DATA ERROR REFERENCE — Complete Technical Specification

**Last Updated:** February 11, 2026  
**Purpose:** Complete reference for every validation check — source of truth, triggers, rules, and all combinations  
**Audience:** Developers, administrators, and anyone needing exact behavior documentation

---

## 📌 HOW THE AUDIT SYSTEM WORKS (TOP TO BOTTOM)

### Execution Flow

1. **Sync triggers** (SyncModal) → calls backend/automation to collect events from iClass portal
2. **Python script** (`automation/f12_collect_and_import.py`) → `convert_event_dicts_to_flat()` runs ALL validation
3. **Validation runs during sync only** — Python produces `validation_errors` array per event
4. **Results stored** in `events.validation_errors` (JSONB) in Supabase
5. **Frontend displays** errors, filtering by `acknowledged_errors` (temp overrides) — Python NEVER sees acknowledged_errors

### Critical: Where Rules Apply

| Rule Type | Where Applied | Effect |
|-----------|---------------|--------|
| **Embedded (hardcoded)** | Python code | Prevents or triggers error DURING validation — no way to change without code edit |
| **Permanent (gym_valid_values)** | Python code via `get_rules_for_gym()` | Prevents error from being ADDED during next sync — error never enters validation_errors. Scoped by event_type (CAMP, CLINIC, etc.) |
| **Temporary (acknowledged_errors)** | Frontend everywhere | Per-event: Error in validation_errors but UI hides it. Stored on event row. |
| **Temporary (acknowledged_patterns)** | Frontend everywhere | Program-wide: Same error hidden for ALL events of that program type at that gym. Table: gym_id + event_type + error_message |

### gym_valid_values Merge Logic

- `get_rules_for_gym(gym_id)` merges: (1) global rules where `gym_id='ALL'`, (2) gym-specific rules for that gym_id
- Rules with same `rule_type` are concatenated; duplicate `value`s are deduped
- **Code uses `'ALL'`** (not `'*'`) for global rules — `all_values.get('ALL', {})`

### When Validation Runs vs. Skips

| description_status | Has description text? | Completeness (title) | Completeness (description) | Accuracy (DATA) checks |
|--------------------|------------------------|----------------------|----------------------------|-------------------------|
| `none` | No | ✅ Runs | ❌ Skipped | ❌ Skipped |
| `flyer_only` | No | ✅ Runs | ❌ Skipped | ❌ Skipped |
| `full` | Yes | ✅ Runs | ✅ Runs | ✅ Runs |

**Registration status checks** (`registration_closed`, `registration_not_open`) run regardless of description.

---

# PART 1: EVERY DATA ERROR (category: data_error)

DATA errors = something is WRONG (two sources don't match). Severity typically "error" or "warning".

---

## 1. year_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `year_mismatch` |
| **Source of truth** | iClass API `startDate` — year extracted (e.g., 2026) |
| **Compares against** | Year(s) found in TITLE via regex `\b(20\d{2})\b` |
| **Triggers error** | Any 4-digit year in title (e.g., 2025, 2026) does NOT equal `event_year` from startDate |
| **Triggers pass** | No year in title, OR title year matches event_year exactly |
| **Multiple values** | Extracts ALL years from title via `re.findall()`; loops each; breaks after first mismatch (flags once) |
| **gym_valid_values** | Does NOT check — no exceptions |
| **Runs when** | `if description:` block (line 869) — requires description to exist |

### Rules & Overrides

| Rule Type | Exists? | Effect |
|-----------|---------|--------|
| **Embedded** | Yes: regex `\b(20\d{2})\b` for extraction; exact equality check | Cannot change without code edit |
| **Temp override** | Yes: Add to acknowledged_errors → UI hides error |
| **Permanent** | No | No gym_valid_values support |

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule at all | Error added if title year ≠ event year |
| Only embedded rule | Same — embedded is always present |
| Temp override only | Error still in validation_errors; UI hides it |
| Permanent rule only | N/A — no permanent rule type for year_mismatch |
| Both temp + permanent | N/A |

---

## 2. date_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `date_mismatch` |
| **Source of truth** | iClass API `startDate` and `endDate` |
| **Compares against** | Month names found in DESCRIPTION (first 200 chars) |
| **Triggers error** | (A) End date before start date, OR (B) Description mentions a month that is NOT in `valid_months` |
| **Triggers pass** | (A) End ≥ start, AND (B) Description months all in valid_months, OR month in registration/promo context (skipped) |
| **Multiple values** | `valid_months` = all months from startDate through endDate (inclusive). Multi-month events: June 28–Aug 1 → June, July, August all valid |
| **gym_valid_values** | Does NOT check |
| **Runs when** | `if description:` |

### Embedded Rules (Hardcoded)

- **End date before start date** → always error
- **valid_months** = start month + end month + every month BETWEEN (via calendar)
- **Skip patterns** (registration/promo): `(register|registration|sign up|enroll|deadline|closes?|opens?|book by|by)\s+\w*\s*{month}`, `(also|check out|see our|upcoming|next|other|more)\s+\w*\s*{month}`
- **Month matching** — full names and abbreviations (Jan, Feb, etc.) with `\b` word boundary for short names
- **Scan limit** — first 200 chars for prominence; first 300 for skip patterns

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if month mismatch or end<start |
| Embedded only | Same (always present) |
| Temp override | Error in DB; UI hides |
| Permanent | N/A |
| Both | N/A |

---

## 3. day_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `day_mismatch` |
| **Source of truth** | Day calculated from iClass `startDate` (e.g., "Saturday") |
| **Compares against** | Day names in DESCRIPTION (first 200 chars) |
| **Triggers error** | Description mentions a day (Mon–Sun or abbrevs) that ≠ event day |
| **Triggers pass** | No day in desc, OR mentioned day = event day, OR event type is CAMP (skipped entirely) |
| **Multiple values** | Single event day; scans for any wrong day |
| **gym_valid_values** | Does NOT check |
| **Runs when** | `if description:` AND `event_type != 'CAMP'` |

### Embedded Rules

- **CAMP** — day validation SKIPPED (camps span multiple days)
- **Day range cleaning** — removes "Monday-Friday", "Mon-Fri", "Monday through Friday", "(Monday-Friday)" before check — these are schedule context, not event day
- **all_days** = monday through sunday; **day_abbrevs** = mon, tue, wed, thu, fri, sat, sun

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if wrong day in description (non-CAMP) |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent | N/A |
| Both | N/A |

---

## 4. time_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `time_mismatch` |
| **Source of truth** | iClass API `schedule.startTime` / `endTime` (e.g., "6:30 PM - 9:30 PM") |
| **Compares against** | Times parsed from TITLE and DESCRIPTION |
| **Triggers error** | Title or description has a time (e.g., "10am") that does NOT match any event time AND is NOT in gym `time` rules |
| **Triggers pass** | No time in text, OR time matches event times, OR time is in `gym_valid_values` rule_type `time` |
| **Multiple values** | Extracts ALL hours from structured time; checks each found time in text against event_hours OR extra_time_values |
| **gym_valid_values** | YES — `rule_type='time'` adds valid extra times (e.g., "8:00am" = Early Dropoff) |
| **Runs when** | `if description:` AND `time_str` exists |

### Embedded Rules

- **Pre-clean** before matching: remove `$XX a day/week`, age ranges like "Ages 4-13", "4-13 years"
- **Time regex** — `(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)(?:\b|(?=\s|-))`
- **Exact hour match** — 24hr conversion; must match one of event_hours or extra_time_values
- **extra_time_values** = `[t['value'].lower().strip() for t in get_rules_for_gym(gym_id).get('time', [])]`

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if time in title/desc ≠ iClass time |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent rule (time) | If time matches rule value → NO error added (Python never adds it) |
| Both temp + permanent | Permanent prevents error on next sync; temp hides if error already in DB from before rule |

---

## 5. age_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `age_mismatch` |
| **Source of truth** | iClass API `minAge` (maxAge not validated) |
| **Compares against** | Min age extracted from TITLE and DESCRIPTION |
| **Triggers error** | (1) iClass minAge ≠ title age, (2) iClass minAge ≠ desc age, or (3) title age ≠ desc age |
| **Triggers pass** | Ages match, or any source missing (no comparison) |
| **Multiple values** | Extracts first min age per text; three separate checks (iClass vs title, iClass vs desc, title vs desc) |
| **gym_valid_values** | Does NOT check |
| **Runs when** | `if description:` |

### Embedded Rules

- **extract_min_age()** — patterns: `ages?\s*(\d{1,2})\s*[-–to+]`, `ages?\s*(\d{1,2})\b`, `(\d{1,2})\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)`
- **char_limit** — title 200, description 300

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error on any mismatch |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent | N/A |
| Both | N/A |

---

## 6. program_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `program_mismatch` |
| **Source of truth** | iClass `link_type_id` → event_type (KNO, CLINIC, OPEN GYM, CAMP) |
| **Compares against** | Keywords in TITLE and DESCRIPTION |
| **Triggers error** | Multiple branches — iClass says X but title/description says Y (conflicting program) |
| **Triggers pass** | Keywords align with event_type; program_synonym rules can add valid keywords |
| **Multiple values** | Multiple keyword lists per program; synonym rules extend lists |
| **gym_valid_values** | YES — `rule_type='program_synonym'` adds keywords (value→label maps to program type) |
| **Runs when** | `if description:` |

### All Branches (Every if/else)

**iClass vs TITLE:**
- KNO + title has "clinic" and NOT kno → error
- KNO + title has "open gym" and NOT kno → error
- CLINIC + title has kno → error
- CLINIC + title has "open gym" and NOT clinic → error
- OPEN GYM + title has kno → error
- OPEN GYM + title has "clinic" and NOT open gym → error
- CAMP + title has kno → error
- CAMP + title has clinic → error

**iClass vs DESCRIPTION (per event type):**
- **KNO**: missing "kids night out"/"kno" → warning; has "clinic" in first 100 chars → error
- **CLINIC**: missing "clinic" → warning; has kno in first 100 → error; starts with "open gym" → error
- **OPEN GYM**: missing "open gym" or synonyms → warning; has "clinic" → error; has kno → error
- **CAMP**: starts with "clinic" → error; starts with kno → error

### Embedded Keywords (Extended by program_synonym)

- **KNO**: kids night out, kid night out, kno, night out, parents night out, ninja night out + synonyms
- **CLINIC**: clinic + synonyms
- **OPEN GYM**: open gym, play and explore the gym, open to all + synonyms

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error per branch logic |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent (program_synonym) | Adds keyword; if text contains it → may PASS instead of error |
| Both | Permanent can prevent error on next sync; temp hides existing |

---

## 7. skill_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `skill_mismatch` |
| **Source of truth** | First skill found in TITLE |
| **Compares against** | First skill found in DESCRIPTION (first 150 chars) |
| **Triggers error** | CLINIC only; BOTH title and description have a skill AND they differ (after normalizing spaces) |
| **Triggers pass** | No skill in one or both; or skills match; or not CLINIC |
| **Multiple values** | Uses first match per text; compares single pair |
| **gym_valid_values** | Does NOT check |
| **Runs when** | `if description:` AND `event_type == 'CLINIC'` |

### Embedded Rules

- **skills list**: cartwheel, back handspring, backhandspring, handstand, tumbling, bars, pullover, pullovers, front flip, roundoff, backbend, ninja, cheer, beam, vault, floor, trampoline, tumbl, bridge, kickover, walkover, flip flop, flip-flop, back walkover, front walkover
- **"back handspring" vs "backhandspring"** — normalized by removing spaces before compare

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if title skill ≠ desc skill (CLINIC) |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent | N/A |
| Both | N/A |

---

## 8. price_mismatch (title vs description)

| Field | Value |
|------|-------|
| **Error type name** | `price_mismatch` |
| **Source of truth** | Title price (first `$XX` or `$XX.XX`) |
| **Compares against** | All prices in description |
| **Triggers error** | Title has price AND description has price(s) BUT title price not within $1 of ANY description price |
| **Triggers pass** | No price in title; or no price in description (different error); or title price within $1 of some desc price |
| **Multiple values** | `desc_price_floats = [float(p) for p in desc_prices]`; `title_price_found = any(abs(title_price - dp) <= 1 for dp in desc_price_floats)` |
| **gym_valid_values** | Does NOT check (this is title↔desc only) |
| **Runs when** | `if description:` AND in block after missing_price check |

### Embedded Rules

- **Price regex** — `\$(\d+(?:\.\d{2})?)`
- **Tolerance** — $1
- **Order** — runs only if `desc_prices` (would have failed missing_price_in_description otherwise)

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if title price not in desc (within $1) |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent | N/A |
| Both | N/A |

---

## 9. camp_price_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `camp_price_mismatch` |
| **Source of truth** | `camp_pricing` table (full_day_daily, full_day_weekly, half_day_daily, half_day_weekly) + `gym_valid_values` price rules |
| **Compares against** | All prices in TITLE and DESCRIPTION |
| **Triggers error** | CAMP event; price in title/desc does NOT match any valid price (within $2) |
| **Triggers pass** | Price matches any valid price; or no prices in text; or gym not in camp_pricing; or no valid_prices |
| **Multiple values** | `all_camp_prices = list(set(title_prices + desc_prices))`; each checked; `is_valid = any(abs(camp_price - vp) <= 2 for vp in valid_prices)`; breaks after first invalid |
| **gym_valid_values** | YES — `rule_type='price'` adds extra valid prices (e.g., 20 = Before Care) |
| **Runs when** | `if description:` AND `event_type == 'CAMP'` AND `all_camp_prices` |

### Embedded Rules

- **Tolerance** — $2
- **valid_prices** = camp_pricing (non-null) + gym_valid_values price rules
- **Only CAMP** events

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if price not in camp_pricing |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent (price) | Adds to valid_prices → if price matches, NO error added |
| Both | Permanent prevents on next sync; temp hides if already in DB |

---

## 10. event_price_mismatch (Clinic, KNO, Open Gym)

| Field | Value |
|------|-------|
| **Error type name** | `event_price_mismatch` |
| **Source of truth** | `event_pricing` table (per gym, event_type, effective date) + `gym_valid_values` price rules |
| **Compares against** | All prices in TITLE and DESCRIPTION |
| **Triggers error** | CLINIC/KNO/OPEN GYM; NO valid price appears in title+description (within $1) |
| **Triggers pass** | At least one valid price found in text (within $1 of any found price) |
| **Multiple values** | `all_event_prices = list(set(title_prices + desc_prices))`; `expected_price_found = any(any(abs(found - vp) <= 1 for found in all_found_prices) for vp in valid_prices)` |
| **gym_valid_values** | YES — `rule_type='price'` adds extra valid prices |
| **Runs when** | `if description:` AND `event_type in ['CLINIC','KIDS NIGHT OUT','OPEN GYM']` AND `desc_prices` |

### Embedded Rules

- **Tolerance** — $1
- **event_pricing** filtered by effective_date and end_date

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if no valid price in text |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent (price) | Adds to valid_prices → if price in text matches, NO error |
| Both | Same as camp_price_mismatch |

---

## 11. title_desc_mismatch

| Field | Value |
|------|-------|
| **Error type name** | `title_desc_mismatch` |
| **Source of truth** | Neither — cross-check between Title and Description |
| **Compares against** | Program keywords in each |
| **Triggers error** | Title says X, Description says Y (conflict): Clinic↔KNO, Clinic↔Open Gym, KNO↔Open Gym (all 6 combos) |
| **Triggers pass** | Keywords align or no conflict |
| **Multiple values** | Six explicit branches |
| **gym_valid_values** | YES — `program_synonym` extends title_has_open_gym when checking |
| **Runs when** | `if description:` |

### All Branches

1. title_has_clinic + desc_has_kno → error
2. title_has_kno + desc_has_clinic → error
3. title_has_open_gym + desc_has_kno → error
4. title_has_kno + desc_has_open_gym → error
5. title_has_clinic + desc_has_open_gym → error
6. title_has_open_gym + desc_has_clinic → error

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error per conflict |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent (program_synonym for OPEN GYM) | Can add keyword so title_has_open_gym becomes true → may change which branch fires |
| Both | Same as program_mismatch |

---

# PART 2: EVERY FORMAT ERROR (category: formatting)

FORMAT errors = something is MISSING. Severity typically "warning" or "info".

---

## 12. missing_age_in_title

| Field | Value |
|------|-------|
| **Error type name** | `missing_age_in_title` |
| **Source of truth** | N/A — completeness check |
| **Compares against** | Regex for age patterns in title |
| **Triggers error** | No age pattern in title |
| **Triggers pass** | `has_age_in_text(title)` → ages?\s*\d{1,2}, students?\s*\d{1,2}, \d{1,2}\s*[-–+], \d{1,2}\s*to\s*\d{1,2} |
| **Multiple values** | Single check |
| **gym_valid_values** | Does NOT check |
| **Runs when** | Always (completeness block) |

### Embedded Rules

- **has_age_in_text()** — patterns as above

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if no age in title |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent | N/A (no rule type) |
| canAddAsRule | No — but `missing_program_in_title` is eligible |

---

## 13. missing_date_in_title

| Field | Value |
|------|-------|
| **Error type name** | `missing_date_in_title` |
| **Source of truth** | N/A |
| **Compares against** | Months (jan–dec) or date formats (\d{1,2}/\d{1,2}, \d{1,2}(st|nd|rd|th)) |
| **Triggers error** | No date pattern in title |
| **Triggers pass** | `has_date_in_text(title)` |
| **Multiple values** | Single check |
| **gym_valid_values** | Does NOT check |
| **Runs when** | Always |

### Every Combination

Same pattern as missing_age_in_title.

---

## 14. missing_program_in_title

| Field | Value |
|------|-------|
| **Error type name** | `missing_program_in_title` |
| **Source of truth** | event_type from iClass |
| **Compares against** | Program keywords in title; checks gym program_synonym FIRST |
| **Triggers error** | Title does not contain keyword for event_type |
| **Triggers pass** | Keyword found (embedded or synonym) |
| **Multiple values** | synonym_rules checked first; then embedded keywords |
| **gym_valid_values** | YES — `program_synonym` where target_type == event_type |
| **Runs when** | Always |

### Embedded Rules

- KNO, CLINIC, OPEN GYM, CAMP keywords; apostrophe stripping

### Every Combination

| Scenario | Result |
|----------|--------|
| No rule | Error if no embedded keyword |
| Embedded only | Same |
| Temp override | UI hides |
| Permanent (program_synonym) | If keyword in title and rule target matches event_type → PASS |
| Both | Permanent can prevent error |
| **canAddAsRule** | YES — "Make Permanent Rule" available |

---

## 15. missing_age_in_description

| Field | Value |
|------|-------|
| **Error type name** | `missing_age_in_description` |
| **Runs when** | `if description:` |
| **Triggers** | No age pattern in description |
| **gym_valid_values** | No |

---

## 16. missing_datetime_in_description

| Field | Value |
|------|-------|
| **Error type name** | `missing_datetime_in_description` |
| **Runs when** | `if description:` |
| **Triggers** | No date AND no time in description |
| **gym_valid_values** | No |

---

## 17. missing_time_in_description

| Field | Value |
|------|-------|
| **Error type name** | `missing_time_in_description` |
| **Runs when** | `if description:` |
| **Triggers** | No time pattern AND not CAMP with "full day" or "half day" |
| **gym_valid_values** | No |

### Embedded Exception

- **CAMP** with "full day" or "half day" in description → PASS (no error)

---

## 18. missing_program_in_description

| Field | Value |
|------|-------|
| **Error type name** | `missing_program_in_description` |
| **Runs when** | `if description:` |
| **Triggers** | Description lacks program keyword (same logic as title, with synonym support) |
| **gym_valid_values** | YES — program_synonym |

---

## 19. clinic_missing_skill

| Field | Value |
|------|-------|
| **Error type name** | `clinic_missing_skill` |
| **Runs when** | `event_type == 'CLINIC'` AND `description` |
| **Triggers** | No skill keyword in title or description (uses same skills list as skill_mismatch) |
| **gym_valid_values** | No |
| **Severity** | info |

---

## 20. missing_price_in_description

| Field | Value |
|------|-------|
| **Error type name** | `missing_price_in_description` |
| **Runs when** | `if description:` (in pricing block) |
| **Triggers** | `not desc_prices` — no $XX in description |
| **gym_valid_values** | No |

---

## 21. description_status: none / flyer_only

| Field | Value |
|------|-------|
| **Not an error type** | Stored as `description_status` on event |
| **none** | No description and no flyer |
| **flyer_only** | Has flyer image but no text description |
| **Effect** | Frontend treats as "description issue"; Python SKIPS all accuracy checks when no description |
| **gym_valid_values** | No |

---

# PART 3: STATUS ERRORS (category: status)

---

## 22. registration_closed

| Field | Value |
|------|-------|
| **Error type name** | `registration_closed` |
| **Source** | iClass `registrationEndDate` vs today vs event start_date |
| **Triggers** | registration_end_date < today AND event start_date >= today |
| **gym_valid_values** | No |

---

## 23. registration_not_open

| Field | Value |
|------|-------|
| **Error type name** | `registration_not_open` |
| **Source** | iClass `registrationStartDate` |
| **Triggers** | registration_start_date > today |
| **gym_valid_values** | No |

---

# PART 4: RULE ELIGIBILITY & canAddAsRule

From `validationHelpers.js`:

```javascript
canAddAsRule = (errorType) =>
  errorType === 'camp_price_mismatch' || errorType === 'event_price_mismatch' ||
  errorType === 'time_mismatch' ||
  errorType === 'program_mismatch' || errorType === 'missing_program_in_title';
```

| Error Type | canAddAsRule | Rule Type Created | extractRuleValue source |
|------------|--------------|-------------------|-------------------------|
| camp_price_mismatch | Yes | price | First `$XX` from error message |
| event_price_mismatch | Yes | price | First `$XX` from error message |
| time_mismatch | Yes | time | "description says X" or "title says X" from message |
| program_mismatch | Yes | program_synonym | **Full event.title** (lowercased) |
| missing_program_in_title | Yes | program_synonym | **Full event.title** (lowercased) |
| All others | No | — | — |

**Note:** For program_synonym, the value is the entire title, so the rule matches that exact phrase. suggestedLabel comes from event.type.

---

# PART 4b: Error Category (inferErrorCategory)

Used for filtering and display. From `validationHelpers.js`:

| Category | Error Types |
|----------|-------------|
| **data_error** | year_mismatch, date_mismatch, time_mismatch, age_mismatch, day_mismatch, program_mismatch, skill_mismatch, price_mismatch, title_desc_mismatch, camp_price_mismatch, event_price_mismatch |
| **status** | registration_closed, registration_not_open, sold_out |
| **formatting** | All others (missing_*, clinic_missing_skill, etc.) |

---

# PART 5: gym_valid_values RULE TYPES

| rule_type | Used By | Purpose |
|-----------|---------|---------|
| `price` | camp_price_mismatch, event_price_mismatch | Add valid price (e.g., $20 Before Care) |
| `time` | time_mismatch | Add valid time (e.g., 8:00am Early Dropoff) |
| `program_synonym` | has_program_type_in_text, program validation, OPEN GYM checks, title_desc cross-check | Map keyword → program type (e.g., ninja night → KIDS NIGHT OUT) |

**Schema:** gym_id, rule_type, value, label, event_type (optional)

---

# PART 6: SUMMARY — WHAT YOU CAN CONTROL

| Control | Where | Effect |
|---------|-------|--------|
| **Embedded rules** | Python code | Change requires deploy |
| **Temp override** | Admin/Event panel → "Accept Exception" | Adds to acknowledged_errors; hides in UI; error still in DB |
| **Permanent rule** | Admin → "Make Permanent Rule" or Gym Rules tab | Inserts gym_valid_values; next sync may NOT add that error |
| **event_pricing table** | Supabase | Source of truth for Clinic/KNO/Open Gym prices |
| **camp_pricing table** | Supabase | Source of truth for Camp prices |

---

# PART 7: WHERE CCP, HGA, RBA, RBK APPEAR IN THE APP

**If you see CCP/HGA and think "only RBA/RBK have rules" — both are correct.**

| Location | What you see | Why |
|----------|--------------|-----|
| **Gym Rules → All Gym Rules** | Only gyms that have rows in `gym_valid_values` (e.g. RBA, RBK) | This list is built from the rules table. CCP/HGA do not appear here unless you add rules for them. |
| **Gym Rules → Add New Rule dropdown** | ALL gyms: CCP, HGA, RBA, RBK, CPF, CRR, etc. | You pick *which gym* to add a rule for. Showing all gyms lets you add rules for CCP or HGA when needed. |
| **Audit & Review → Gym filter** | ALL gyms as checkboxes | You choose *which gyms' events* to review. CCP/HGA are options so you can review their validation issues. |
| **Audit & Review → Event groups** | Section headers per gym that has events with issues | If you select CCP + HGA + RBA, and each has events with errors, you see three sections. CCP/HGA appear because you chose them in the filter, not because they have rules. |

**Summary:**
- **Permanent rules** (gym_valid_values): Currently only RBA and RBK have rows — verify with `python automation/list_gym_rules.py`.
- **CCP/HGA in dropdowns/filters**: Expected. They are in the `gyms` table; the UI shows all gyms so you can add rules or review events for any gym.

---

**This document was generated by reading the actual code in `automation/f12_collect_and_import.py`, `src/lib/validationHelpers.js`, and related components. Every branch and combination documented as implemented.**
