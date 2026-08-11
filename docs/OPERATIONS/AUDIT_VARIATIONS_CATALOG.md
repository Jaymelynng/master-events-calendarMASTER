# Audit Variations Catalog — Every Check/Rule To Date

**Purpose:** the complete inventory of every audit/validation/check/rule/format concept this app has ever had — built, removed, proposed, or idea-only — assembled to inform the rebuild. It answers one question: *how flexible and interactive does the new foundation have to be to hold everything this really needs to do?*

**Built:** Aug 3, 2026, from four sources — the project memory, the repo docs, the old chat/research archives, and the as-built code + live Supabase data. Where they disagree, **live code/data wins** and the discrepancy is noted.

---

## 0. The headline — documented vs. built vs. actually running

There are **three very different numbers**, and the gap between them is the most important fact for the rebuild:

| Layer | Count | Reality |
|-------|-------|---------|
| **Documented concepts** (all time) | ~87 | The docs describe a rich history — checks, removed checks, proposed ideas, per-gym rule candidates. Treat the docs as the *spec*, not the live state. |
| **Check functions in code** (`validation_engine.py` CHECK_REGISTRY) | 13 | Actual Python that can run. |
| **Active rule rows** (live `rules` table) | 10 checks + 4 `valid_time` | Pricing's 3 checks deleted Jul 1; `check_skill_mismatch` is orphaned (function exists, no row → never runs). |
| **Actually catching anything right now** | ~7 types | See below — one check does 81% of the work. |

**What's actually being caught in the live database (127 stored errors):**

| Error type | Count | Share |
|------------|-------|-------|
| age_mismatch | 103 | 81% |
| year_mismatch | 13 | 10% |
| time_mismatch | 7 | |
| date_mismatch | 2 | |
| price_mismatch | 1 | |
| title_desc_mismatch | 1 | |
| program_mismatch | 1 | |

Two checks (`impossible_date`, `ordinal_typo`) are active but catching **nothing** — and `impossible_date` is mis-labeled in code as `date_mismatch`, so it can never show under its own topic.

**The real catch engine is the AI Review lane** (`events.ai_review_flags`) — it finds the semantic contradictions no regex can (wrong movie in a description, leftover "(COPY)", a Fall Break camp that says "all summer long," a day-number that doesn't match, a half-day camp with full-day hours). That's qualitatively richer than the regex layer and is doing the heavy lifting on real errors.

**Three tables are seeded but not wired into the engine at all:** `extractors` (1 date-extractor row), `format_patterns` (85 recognizer rows), `category_mappings` (15 rows). The last one is a **live no-hardcoding-law violation** — the sync still reads the hardcoded `BOOKING_TITLE_TO_EVENT_TYPE` dict instead of the table.

---

## 1. Master list — every check/rule, by dimension

Status legend: **ACTIVE** (running live) · **BUILT** (code exists, may not be seeded) · **REMOVED** (existed, deleted) · **AI** (lives in the AI Review lane) · **PROPOSED** (planned/idea, never built).

### 📅 DATE / DAY
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| year_mismatch | 4-digit year in title/desc ≠ event year | **ACTIVE** | desc added Mar 2026 |
| date_mismatch (month) | month named in desc not in event's month span | **ACTIVE** | multi-month span aware |
| date_mismatch (end<start) | end date before start | **ACTIVE** | structural |
| impossible_date | June 31, Feb 30 | **BUILT** (catches nothing; mis-typed as date_mismatch) | |
| day_mismatch | weekday in desc ≠ real weekday | **ACTIVE** | **skipped for CAMP** |
| ordinal_typo | "July 29nd", "22th" | **BUILT** (catching nothing live) | |
| AI date/day-number | text date outside start–end (same-month: "July 15" on a July 8 event) | **AI** | regex only does month names |
| AI title-month sweep | ANY month in the title not in the event's months → always flag | **AI** | data-verified: no innocent theme cases in ~900 titles |
| AI day-of-week (title+desc) | wrong weekday in title too | **AI** | engine checks desc only |
| AI wrong-year plausibility | event dated implausibly far out → likely wrong-year setting; reads 2-digit years | **AI** | |
| day-of-month in title vs start | "May 25th" on a May 26 camp | **PROPOSED gap** | partly covered by AI |
| day-abbreviation (Mon/Tues) | `day_abbrevs` var defined but never used | **PROPOSED / known bug** | |
| consecutive-day / camp sequence | verify camps run Mon–Fri | **PROPOSED** (not planned) | |

### 🕐 TIME
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| time_mismatch (title + desc) | time in text ≠ iClass schedule (hour-level, format-tolerant) | **ACTIVE** | honors per-gym `valid_time` |
| AI duration sanity | "Half Day" but full-day hours; "1 hour" vs clock | **AI** | |
| AI daily-schedule outlier (camps) | one weekday's hours differ from siblings | **AI** | the SGT half-day-Monday-1hr case; **now also caught structurally after the Aug 3 daily_schedule fix** |
| duration_mismatch / duplicate_conflict | two conflicting times in one event | **PROPOSED** (idea-only) | |

### 👶 AGE
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| age_mismatch | MIN age across 3 pairs: iClass↔title, iClass↔desc, title↔desc | **ACTIVE** | **81% of all live catches**; max age ignored |
| AI age incl. max + "18 months" | max-age drift, unit handling | **AI** | |
| age_logic_error | "all ages" vs a set min | **PROPOSED** (idea-only) | |

### 🏷️ PROGRAM / TYPE
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| program_mismatch (~18 branches) | iClass type contradicted by KNO/Clinic/Open Gym/Camp keywords | **ACTIVE** | honors `program_synonym` + `program_ignore` |
| title_desc_mismatch | title program-word vs desc program-word (6 combos) | **ACTIVE** | |
| AI program judgment | text sells a different program; camp-in-title on a non-camp | **AI** | |
| **Camp Type ≠ Program** | iClass Camp Type (School Year) vs Program (Summer) disagree | **PROPOSED (Aug 3 initiative)** | new; SGT Fall Break case |
| **Unmapped Camp Type** | gym invents a category (CRR "Thanksgiving", "Winter Break") → silently dropped | **PROPOSED (Aug 3)** | |
| **Name contradicts Type** | "Summer Camp 2026" on a School Year camp | **PROPOSED (Aug 3)** | |
| AI program_name check | backend program_name vs type vs what text sells | **AI** | |

### 🎯 SKILL (clinics)
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| skill_mismatch | clinic title skill ≠ desc skill (42-word list incl. BHS, kickover) | **BUILT — orphaned** (in registry, no rule row → never runs) | |
| AI skill knowledge | real reasoning: BHS = back handspring = flip-flop; kip ≠ pullover | **AI** | the original core ask; only the AI layer can do it |

### 📋 TITLE ↔ DESCRIPTION / COMMON SENSE
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| AI leftover/wrong copy | copied text from another event/gym/season; "(COPY)"; nonsense | **AI** | not grammar/typos |

### 💰 PRICE — **ALL REMOVED Jul 1, 2026** (Jayme's decision; do not re-add without her go)
| Concept | Detects | Status |
|---------|---------|--------|
| price_mismatch | title $ vs desc $ (±$1) | **ACTIVE again** (title↔desc only, internal consistency) |
| camp_price_mismatch | camp $ vs `camp_pricing` table | **REMOVED** |
| event_price_mismatch | clinic/KNO/OG $ vs `event_pricing` table | **REMOVED** |
| valid_price / sibling_price (rules) | whitelist a valid gym price | **REMOVED** |
| Restore path | | `database/REMOVED_PRICING_VALIDATION_2026_07_01.sql` |

### 🪑 OPENINGS / CAPACITY
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| sold_out / FULL | iClass `hasOpenings=false` | **ACTIVE** | |
| openings count | exact spots left, color tiers 🟢/⚠️/🔴 | **ACTIVE** | no total capacity — `maxStudents` always null |
| AI openings sanity | "sold out" while openings>0; "only 5 spots" wildly off | **AI** | |

### 📄 DESCRIPTION / COMPLETENESS
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| description_status | none / flyer_only / full — gates whether other checks run | **ACTIVE** | events with no description skip ALL checks |
| flyer detection | `<img>` in description HTML | **ACTIVE** | |
| **9 × `missing_*` completeness checks** | "no age in title", "no time in desc", `clinic_missing_skill`, etc. | **REMOVED Mar 2026** | were never actually generated — dead code; still linger in the archive with no UI labels |

### 🗓️ REQUIREMENTS (monthly compliance — a separate audit axis)
| Concept | Detects | Status | Notes |
|---------|---------|--------|-------|
| monthly requirements | each gym needs N per type/month (now **2 KNO + 1 Open Gym + 1 Clinic**) | **ACTIVE** | `monthly_requirements` table |
| requirement status notes | In Progress / Late / Excused | **ACTIVE** | |
| requirement_exception | excuse a gym/month | **ACTIVE** (rule type) | |

### 🔒 STATUS / INFO (not "errors")
registration_closed · registration_not_open — both **ACTIVE**, informational.

### 📝 CHANGE-LOG AUDIT (different meaning of "audit")
event_audit_log (CRUD history per field) · event comparison engine (new/changed/deleted/unchanged by URL) — both **ACTIVE**.

---

## 2. The scoping & flexibility model (how a rule is aimed)

Everything lives in **ONE `rules` table**, with three independent scoping axes plus a time axis:

1. **Gym scope** — `gym_ids` array: `{ALL}` (global) or `{CCP,CPF}` (specific). Global + gym-specific rows merge.
2. **Program scope** — `program`: `ALL`, `CAMP`, `CLINIC`, `KNO`, `OPEN GYM`…
3. **Event scope** — `scope`: `all_events` / `keyword` (+`keyword`) / `single_event` (+`event_id`).
4. **Time scope** — `is_permanent` + `end_date`: permanent (until deleted) or temporary (auto-expires; sync filters expired temps out).

**Three layers, one table:**
- **Layer 1 — System checks** (universal): the `check_*` rows, toggleable, scopeable to gyms/programs.
- **Layer 2 — Per-gym rules:** `program_synonym`, `valid_time`, (`valid_price`/`sibling_price` — parked), `program_ignore` (planned).
- **Layer 3 — Exceptions:** `exception` (dismiss one), `requirement_exception`, plus the dismissal tiers below.

**Dismissal strength (weakest → strongest):** `acknowledged_errors` (per-event, may re-flag) → `acknowledged_patterns` (per-gym-program bulk) → permanent `rules` row (never re-flags). `verified_errors` persists manual OK/Bug marks across syncs.

---

## 3. Why it has to be flexible — the real-world messiness

These are the actual patterns (mined from live + 834 archived events) that make a rigid system impossible. **This is the answer to "how flexible does it need to be."**

**Gyms rename everything — a fixed keyword list can't win:**
- **HGA / RBA Kids Night Out are pure theme names, never say "Kids Night Out":** Boo Bash, Neon Night, Pajama Jam, Turkey Tumble, Karaoke Night, Slime Night, Mad Scientist, K-POP Karaoke… **every one flags as a program mismatch** unless a synonym exists (~37 events).
- **Open Gym renames:** Gym Fun Friday, Preschool Fun Gym, Early Release/Homeschool Open Gym (OAS, 34), Open Tumble, Open Workout, Bonus Tumbling.
- **Clinic = "Workshop"** (CPF).
- **Camp tracks:** Ninja Warrior, Parkour & Ninja, COED Ninja, Girls Gymnastics, plus school-district camps (RRISD, HISD, NCISD, SUSD, "Chavez Huerta Day Camp").

**Normal-but-looks-wrong times (would false-flag):** OAS Open Gym 1:15–3:15; EST Open Gym 7:30–9:30 PM *and* 1:00–2:00; HGA KNO starts 6:00 PM; RBA/RBK KNO 7:00 PM; daytime clinics 12–1 / 2–3.

**Normal-but-looks-wrong ages:** preschool Open Gym mins drop to 0–1; AZ gyms' camps are 5–13 while TX is 4–12/4–13; RBA/RBK skew 5–18 / 6–18.

**Real errors that ARE mistakes (fix, don't whitelist):** CRR Open Gym "10 PM–11:30 PM" (meant AM); CPF "Gym Fun Friday 11:30 pm" (21 live); OAS "July 29nd" / "BRING-A-FREIND"; CPF clinic "(COPY)"; SGT "Half Day" 1-hour Monday; and — new this session — CRR camps with **Friday set to 9 PM–11:59 PM** and a CCP camp with **Wed & Fri at 6 AM**.

**Two structural blind spots:**
- **SPECIAL EVENT is skipped by ALL validation** — ~30 archived showcases got zero checks.
- **No-description events skip every check**, and a check that throws is silently swallowed (a broken check looks like "no errors").

**Red herring to ignore:** there is **no** "Xcel/compulsory/bronze/silver/platinum/tryout" language anywhere in the data — the recurring team term is "IGT."

**Regex traps that forced pre-cleaning:** `$62 a day` → read as "7 am"; `Ages 4-13` → read as a time; `Monday-Friday` → read as a day mismatch; `open gym` inside a KNO description → false program mismatch (the `program_ignore` gap). Format gaps that still slip through: 2-digit years (`5/20/26`), ambiguous `9-9` times, and "flag only the first mismatch, not all."

---

## 4. The two doctrines (this is the design fork for the rebuild)

**Old doctrine (Dec 2025 – Mar 2026):** iClass settings ARE the truth; title/description are marketing copy that drift; validation is an after-the-fact diff against settings.

**Current doctrine (Jayme, Jul 2, 2026 — supersedes the above):**
> *"There is NO 'truth' side. An event is three pieces — settings, title text, description text. A disagreement between ANY two of them, in any combination, is an error, regardless of which side is 'right.'"*

So every check is really a **pairwise comparison** across settings↔title, settings↔description, title↔description — never "which one is correct," just "do they line up."

**The endgame vision (`NEW_ERRORS_COMMAND_CENTER_VISION.md`):**
> *"If it's built right we won't need the audit because it will be built not able to make a mistake."*

A structured editor that generates the title/description from structured fields makes most format/completeness errors **structurally impossible** — leaving only a handful of real checks. That would drop "~48 documented rules" to "~3–4 active check categories."

---

## 5. What this means for the rebuild — the requirements read straight off the variations

1. **Everything Jayme controls must be a DB row editable from a screen** (the #1 law). Category maps, synonyms, keyword lists, thresholds, valid values, CC emails — none hardcoded. *Current live violations: `category_mappings`, `extractors`, `format_patterns` are seeded but the code ignores them; f12 uses a hardcoded dict.*
2. **Three scoping axes + time** are non-negotiable: gym × program × event-scope × permanent/temporary. The messiness in §3 needs all four.
3. **Universal / per-gym / exception** as first-class layers — because the same check is right for 9 gyms and wrong for the 10th.
4. **Pairwise, no "truth side"** — the engine compares settings/title/description against each other, never assumes one is correct.
5. **The AI layer is not optional** — it's where the real catches happen (skills, copied text, day-numbers, signup logic). The rebuild should treat AI review as a peer to the regex checks, not a bolt-on.
6. **It has to absorb what gyms actually do** — a "Detect & map" step so a new category/name/time/age a gym invents surfaces for Jayme to slot once, and never silently drops or false-flags.
7. **Don't silently skip or swallow** — Special Events, no-description events, and crashing checks currently vanish. The rebuild must surface "not checked" as a visible state, not a blank.
8. **One label map, one topic map** — today `constants.js` and `validationHelpers.js` disagree, and legacy error types have no labels. Consolidate.

---

## Appendix — source docs (spec, richer than live state)
`AUDIT_DATA_ERROR_REFERENCE.md` · `VALIDATION_RULES_REFERENCE.md` (the 48-rule catalog) · `VALIDATION_RULES_ARCHITECTURE.md` · `DATA_QUALITY_VALIDATION.md` · `EMBEDDED_RULES_TRANSLATION.md` · `PRICING_SOURCE_OF_TRUTH.md` · `AI_EVENT_REVIEW.md` · `CUSTOM_RULES_CANDIDATES.md` · `NEW_ERRORS_COMMAND_CENTER_VISION.md` · `AUDIT-SYSTEM.md` · code: `automation/validation_engine.py`, `automation/f12_collect_and_import.py`.

> Reconcile against live code before trusting any single row — the docs describe the full intended history; the live `rules` table runs a fraction of it.
