# Embedded rules translation — conceptual audit flow

**Last updated:** April 26, 2026  
**Purpose:** Plain-language model of how the audit *thinks*: source of truth → title → description → cross-check. Complements the exact matrix in [AUDIT_DATA_ERROR_REFERENCE.md](./AUDIT_DATA_ERROR_REFERENCE.md).  
**Code:** `automation/validation_engine.py`

---

## Core audit logic (mental model)

The audit flow **conceptually** is:

1. **Pull source-of-truth data from iClassPro**  
   Import factual event data from iClassPro. That structured record (dates, times, ages, program type, etc.) is the source of truth.

2. **Compare iClassPro → title**  
   Audit the manager-written **title** against imported iClassPro data. Date, day, time, age, program, and clinic-skill parsing (and false-positive prevention) apply here.

3. **Compare iClassPro → description**  
   Audit the manager-written **description** against the **same** imported iClassPro data. Use the same parsing and guardrails as for the title.

4. **Compare title ↔ description**  
   After both fields are checked against iClassPro, cross-check the two manager-written fields against **each other**. This is **consistency**, not “which one matches iClass.”

### Simple flow

- Pull source-of-truth data from iClassPro  
- Compare iClassPro → **title**  
- Compare iClassPro → **description**  
- Compare **title** ↔ **description**

---

## Why the flow matters

### Source-of-truth comparisons (most important)

These are evaluated **separately** for title and description (often inside the same check function, but the messages say which field is wrong):

- **iClassPro → title**
- **iClassPro → description**

**Example:** iClass time = `6:30 PM`, title = `6:30–7:30`, description = `7:00–8:00`  
→ Title vs iClass can pass; description vs iClass fails. You do **not** need title and description to match each other for that finding.

### Cross-check comparisons (secondary)

After truth checks, **title ↔ description** catches internal contradictions.

**Example:** title = `Cartwheel Clinic`, description = `Back Handspring Clinic`  
→ A cross-check flags that the two fields disagree (see `skill_mismatch` / `title_desc_mismatch` / `price_mismatch` in code).

### Key distinction

| Type | What it is doing | Purpose |
|------|------------------|---------|
| **iClassPro → title** | Truth check | Is the title correct vs registration? |
| **iClassPro → description** | Truth check | Is the description correct vs registration? |
| **Title ↔ description** | Consistency check | Do the two marketing fields agree? |

---

## What the engine actually does (implementation note)

- **Order of checks** is **not** fixed to steps 2 → 3 → 4. Active `check_*` rows in the `rules` table are run in query order; each function implements its own title/description logic.
- **Many checks** scan **both** title and description in one pass against iClass (e.g. `check_year_mismatch`, `check_time_mismatch`) and emit separate errors per field where relevant.
- **No description:** If there is no description text (or type is SPECIAL EVENT), **`run_validation` returns no errors** — DATA checks do not run. See [AUDIT_DATA_ERROR_REFERENCE.md](./AUDIT_DATA_ERROR_REFERENCE.md) (when validation runs vs skips).
- **Pricing:** Camp/event dollar amounts are validated against **`camp_pricing` / `event_pricing`** (and `rules`), not iClass API price fields — see [PRICING_SOURCE_OF_TRUTH.md](./PRICING_SOURCE_OF_TRUTH.md).

---

## Section 1: Facts pulled from iClassPro (source of truth)

Used as structured truth for the first pass (plus `day_of_week` derived for display/logic):

- Start date, end date, year (from dates)  
- Day of week (for non-camp day checks)  
- Start time, end time (schedule string)  
- Minimum age (and max where used)  
- Program / event type (e.g. CAMP, CLINIC, KIDS NIGHT OUT, OPEN GYM)  
- For clinics: skill wording is inferred from **title/description text** using built-in keyword lists — iClass does not send a separate “skill focus” field.

---

## Section 2: Cross-checking title and description

After comparisons to structured data, the system also compares manager-written **title** and **description** for contradictions (program words, clinic skills, prices, ages).

---

## Error concepts → stored `validation_errors` types

The table below maps **ideas** in this doc to the **`type` string** stored per error. Some rows describe **future or informal** names that are **not** separate types today — those are marked.

| Concept / name | Stored `type` (if any) | Notes |
|----------------|-------------------------|--------|
| Year in text vs event year | `year_mismatch` | Title and description both scanned; span-year handling in description vs `end_date` year. |
| Written dates vs iClass start/end | `date_mismatch` | Month-focused description scan + end-before-start uses same type. |
| End before start (structured) | `date_mismatch` | Message explains order; **not** a separate `date_order_error` type. |
| Day in text vs event weekday | `day_mismatch` | Skipped for CAMP; day-range cleaning (Mon–Fri, etc.). |
| Time in text vs iClass schedule | `time_mismatch` | Pre-cleaning for false positives; title + description. |
| Age in text vs iClass min | `age_mismatch` | Title vs iClass, description vs iClass. |
| Title age vs description age | `age_mismatch` | **Consistency** check, same `type` as truth checks — read the message. |
| Program words vs iClass type | `program_mismatch` | KNO / clinic / open gym / camp keywords + `program_synonym` rules. |
| Clinic skill in title vs description | `skill_mismatch` | CLINIC only; first matching skill each side. Not a separate `skill_program_mismatch` type. |
| Title vs description program words | `title_desc_mismatch` | e.g. clinic vs KNO vs open gym in opening description snippet. |
| Price in title vs price in description | `price_mismatch` | Dollar amounts in text vs each other. |
| Camp price vs tables + rules | `camp_price_mismatch` | Not iClass API. |
| Clinic/KNO/Open Gym price vs tables + rules | `event_price_mismatch` | Not iClass API. |
| Impossible calendar date in text | `date_mismatch` | `check_impossible_date` appends `date_mismatch` errors. |
| `range_mismatch` (written range vs true span) | — | **Not** a separate type; partly overlaps `date_mismatch` behavior. |
| `duration_mismatch` (e.g. “1 hour” vs clock) | — | **Not implemented** as its own check/type. |
| `program_context_error` | — | **Not** a separate type; overlaps `program_mismatch` / `title_desc_mismatch`. |
| `duplicate_conflict` (two conflicting times) | — | **Not implemented** as its own type. |
| `age_logic_error` (“all ages” vs min age) | — | **Not implemented** as its own type. |
| `ambiguous_text_flag` | — | **Not implemented**; mitigations are pre-clean regexes inside checks. |
| `description_missing_detail` | — | **Not** a DATA error type from `validation_engine`; completeness is separate (title/description status). |
| `missing_*` (regex “has age/date/time”) | — | **Not** emitted as `missing_*` types by this engine; see requirements / UI completeness if applicable. |

---

## Date parsing concepts

- **single_date** — One specific event date in copy.  
- **date_range** — True start-to-end date range in copy.  
- **start_date_only_for_multi_day_event** — Multi-day event described with only the start date (allowed when it matches product intent).  
- **Important:** Distinguish **date ranges** from **time ranges** (e.g. `9am–3pm`) so times are not read as dates — handled inside `check_time_mismatch` / date logic, not a separate user-facing type.

---

## Simpler error cheat sheet (language → type)

| Idea | Typical `type` |
|------|----------------|
| Wrong year in title/description | `year_mismatch` |
| Wrong month/date vs iClass span | `date_mismatch` |
| End before start | `date_mismatch` (message) |
| Wrong weekday in description | `day_mismatch` |
| Wrong time in title/description | `time_mismatch` |
| Wrong min age vs iClass | `age_mismatch` |
| Title age ≠ description age | `age_mismatch` |
| Program wording vs iClass type | `program_mismatch` |
| Clinic skill title ≠ description | `skill_mismatch` |
| Title vs description program clash | `title_desc_mismatch` |
| Title price ≠ description price | `price_mismatch` |
| Camp price vs pricing table | `camp_price_mismatch` |
| Event price vs pricing table | `event_price_mismatch` |
| Impossible date | `date_mismatch` (from impossible-date check) |

---

## Related docs

- [AUDIT_DATA_ERROR_REFERENCE.md](./AUDIT_DATA_ERROR_REFERENCE.md) — per-check triggers, limits, rules  
- [VALIDATION_RULES_ARCHITECTURE.md](../TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md) — DB-driven checks + embedded intelligence  
- [DATA_QUALITY_VALIDATION.md](./DATA_QUALITY_VALIDATION.md) — operator-facing validation narrative  
- [PRICING_SOURCE_OF_TRUTH.md](./PRICING_SOURCE_OF_TRUTH.md) — price validation inputs  
