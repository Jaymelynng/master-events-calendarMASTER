# 🔍 FORMAT RULES — Tool Research

**Status:** Research draft for Jayme to react to
**Created:** May 20, 2026
**Purpose:** Before building format-recognition rules into the validation engine, lay out the actual tool options for recognizing how humans write dates, times, prices, ages, program names, skills, and (optionally) typos/grammar. Each section says what's available, the tradeoffs, and whether the tool fits Jayme's "visible + editable + no surprises" rule.

---

## Why this doc exists

The validation engine catches mistakes by comparing structured iClass data against the manager-written title + description. Every check function has its OWN tiny regex for recognizing formats, hardcoded in `automation/validation_engine.py`. Those regexes:

- Aren't visible from the UI
- Aren't editable except by changing Python
- Are documented technically in `AUDIT_DATA_ERROR_REFERENCE.md` but not in plain language
- Miss things (e.g., `5/20/26` slips past the year check because the regex only catches 4-digit years)

Jayme has 3 hard requirements for any tool we use here:

1. **Visible** — he can SEE which formats are accepted
2. **No false positives** — won't misread "Room 215" as a date
3. **Editable** — he can add new formats himself, from the UI, without an AI rewriting Python

This doc evaluates real tool options against those 3 requirements, per category.

---

## The seven format categories

| # | Category | Examples humans write | Currently caught? |
|---|---|---|---|
| 1 | Dates | `5/20/26`, `May 20th 2026`, `5/20/2026`, `5.20.26` | Partial — only 4-digit years (`2026`), not 2-digit (`26`) |
| 2 | Times | `9am`, `9:00am`, `9 AM`, `9-9`, `9:00-5:00`, `noon` | Partial — requires `am`/`pm` marker; `9-9` slides past |
| 3 | Prices | `$25`, `$25.00`, `25 dollars`, `twenty five` | Only `$XX` / `$XX.XX` syntax |
| 4 | Ages | `Ages 5+`, `5-12`, `ages 5 to 12` | Simple regex covers most variations |
| 5 | Program types | `Kids Night Out`, `KNO`, `Night Out`, `Parents Night Out`, `Gym Fun Friday` | Mostly — relies on hardcoded keywords + program_synonym rules |
| 6 | Skills (clinics only) | `cartwheel`, `back handspring`, `flip-flop`, `roundoff` | Mostly — hardcoded list of ~22 skills |
| 7 | Typos / grammar / capitalization | `Sumemr Camp`, `kids night out` (no caps) | Not checked at all today |

---

# Category 1: DATES

Examples: `5/20/26`, `5/20/2026`, `May 20th 2026`, `5.20.26`, `Memorial Day weekend`

## Options

### Option A — Bigger regex catalog (what we'd build)
Define every date format you care about as a separate, named row in a database table. Each row: pattern, example, "what it means" description.

**Example catalog rows:**
| Name | Pattern | Catches | Doesn't catch |
|---|---|---|---|
| `iso_date` | `\d{4}-\d{2}-\d{2}` | `2026-05-20` | `5/20/26` |
| `slash_short_year` | `\d{1,2}/\d{1,2}/\d{2}` | `5/20/26` | `2026-05-20` |
| `slash_full_year` | `\d{1,2}/\d{1,2}/\d{4}` | `5/20/2026` | `5/20/26` |
| `month_name_day_year` | `(jan\|feb\|...)\s+\d{1,2}(st\|nd\|rd\|th)?\s*,?\s*\d{4}` | `May 20th 2026` | `5/20/26` |
| `dot_short_year` | `\d{1,2}\.\d{1,2}\.\d{2}` | `5.20.26` | — |

| Requirement | Score |
|---|---|
| **Visible** | ✅ Every format = one row you read |
| **No false positives** | ✅ You control exactly what each row matches |
| **Editable** | ✅ Add a row in the UI, done |

**Cost:** medium build. Initial catalog of ~10-15 formats. Engine code changes from "hardcoded regex" to "loop through catalog rows."

### Option B — `dateparser` library
Python library that auto-parses dates written in 200+ language locales. Handles "May 20, 2026", "5/20/26", "next Tuesday", "1 week ago" — very flexible.

| Requirement | Score |
|---|---|
| **Visible** | ❌ Black box — accepts many formats, you can't see the full list |
| **No false positives** | ⚠️ Can misread ambiguous numbers; `~8x slower than dateutil` |
| **Editable** | ❌ Not really — it's a library, you'd be adding/excluding patterns indirectly |

Per research: *"dateparser provides generic parsing of dates in over 200 language locales... is noticeably slower than dateutil when parsing a lot of datestrings."*

### Option C — `dateutil.parser`
Python library focused on English dates. Faster than dateparser. Used as backbone of pandas. Still a black box.

| Requirement | Score |
|---|---|
| **Visible** | ❌ Still a library — you can't see what it accepts |
| **No false positives** | ⚠️ Better than dateparser for English, but still inferring |
| **Editable** | ❌ — |

## Recommendation for DATES

**Option A — regex catalog.** Fits all three requirements. Tradeoff: requires you to think through which formats you care about upfront. But that's the same thinking you'd do anyway. The catalog becomes the documentation.

---

# Category 2: TIMES

Examples: `9am`, `9:00am`, `9 AM`, `9-9`, `9:00-5:00`, `9pm-5am`, `noon`

## Options

### Option A — Regex catalog
Same approach as dates. Example rows:

| Name | Pattern | Catches | Doesn't catch |
|---|---|---|---|
| `hour_ampm` | `\d{1,2}\s*(am\|pm\|a\.m\.\|p\.m\.)` | `9am`, `9 AM` | `9-9` |
| `hour_min_ampm` | `\d{1,2}:\d{2}\s*(am\|pm)` | `9:00am` | `9:00` |
| `hour_range_ampm` | `\d{1,2}\s*-\s*\d{1,2}\s*(am\|pm)` | `9-5pm` | `9-9` |
| `hour_range_no_ampm` | `\b\d{1,2}\s*-\s*\d{1,2}\b` (context-restricted) | `9-9` | `5-12 yrs` (excluded by context) |
| `time_range_colon` | `\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}` | `9:00-5:00` | `9-9` |
| `noon_midnight` | `\b(noon\|midnight)\b` | `noon` | `12pm` |

### Option B — `dateparser` library (it handles times too)
Same library as dates. Can parse `"9am"`, `"9:00 AM"`, etc.

### Option C — `dateutil.parser` (also times)
Same as dates — fast for English, still a black box.

## Recommendation for TIMES

**Option A — regex catalog.** Same logic as dates. Plus times have a tricky problem: ambiguous ranges like `9-9` could mean a time or a number range. Context matters. With a catalog, you can explicitly say "match this only when preceded by 'from' or 'starts at'" — you'd lose that control with a library.

---

# Category 3: PRICES

Examples: `$25`, `$25.00`, `$25/day`, `25 dollars`, `twenty-five dollars`

## Options

### Option A — Regex catalog
Probably 4-5 rows covers 95% of cases.

| Name | Pattern | Catches |
|---|---|---|
| `dollar_int` | `\$\d{1,4}\b` | `$25`, `$200` |
| `dollar_decimal` | `\$\d{1,4}\.\d{2}` | `$25.00`, `$199.99` |
| `dollar_per_unit` | `\$\d+(\.\d{2})?\s*\/?\s*(day\|week\|child\|kid)` | `$25/day`, `$200 / week` |
| `dollar_word` | `\d+\s*dollars` | `25 dollars` |

### Option B — `price-parser` library
Python library specifically for extracting prices from text. Handles currency symbols, commas, dot/comma as decimal separator, etc.

| Requirement | Score |
|---|---|
| **Visible** | ⚠️ Library, but limited scope (only prices) so easier to reason about |
| **No false positives** | ✅ Good at it |
| **Editable** | ❌ — |

### Option C — Plain regex (what's there today)
Currently: `\$(\d+(?:\.\d{2})?)`. Misses `$25/day` context but is otherwise functional.

## Recommendation for PRICES

**Option A — regex catalog**, same reasoning. Prices are simple enough that 4-5 patterns cover almost everything. No need to bring in a library.

---

# Category 4: AGES

Examples: `Ages 5+`, `5-12`, `Ages 5 to 12`, `5+ years`, `Kindergarten - 5th grade`

## Options

### Option A — Regex catalog
The current implementation is already close to this. ~3-4 rows cover most.

| Name | Pattern | Catches |
|---|---|---|
| `age_plus` | `ages?\s*\d{1,2}\s*\+` | `Ages 5+` |
| `age_range_dash` | `ages?\s*\d{1,2}\s*[-–]\s*\d{1,2}` | `Ages 5-12` |
| `age_range_to` | `ages?\s*\d{1,2}\s*to\s*\d{1,2}` | `Ages 5 to 12` |
| `years_only` | `\d{1,2}\s*(years?\|yrs?)\s*(old)?\s*(\+)?` | `5 years old`, `5yrs+` |

**Edge case worth flagging:** `Kindergarten - 5th grade` — no numeric ages. Would need a separate grade-level recognition system if you want to catch this.

### Option B — Library
No widely-used library specifically for age extraction. You'd build a regex catalog or use NLP entity extraction (overkill).

## Recommendation for AGES

**Option A — regex catalog.** This is already nearly what the code does. Just needs to be DATA instead of hardcoded.

---

# Category 5: PROGRAM TYPES

Examples: `Kids Night Out`, `KNO`, `Kid's Night Out`, `Parents Night Out`, `Ninja Night Out`, `Gym Fun Friday`, `Open Gym`, `Clinic`, `Camp`

## Options

### Option A — Keyword catalog (current approach, just made visible)
List every keyword variation per program type. Already exists in code AND partially in `rules` table (program_synonym rules). Just needs to be moved fully to data.

| Program | Keywords |
|---|---|
| KIDS NIGHT OUT | kids night out, kno, kid's night out, kids' night out, night out, parents night out, ninja night out |
| CLINIC | clinic |
| OPEN GYM | open gym, gym fun friday, fun gym, preschool fun, bonus tumbling |
| CAMP | camp, summer camp, holiday camp |

### Option B — Fuzzy matching with `RapidFuzz`
Python library — replaces older `fuzzywuzzy`. MIT licensed, written in C++, much faster. Would let you catch typos like `Kids Nite Out` automatically.

Per research: *"RapidFuzz is generally faster than FuzzyWuzzy, thanks to its use of Cython and other optimization techniques... The industry has largely moved toward a newer library called RapidFuzz."*

| Requirement | Score |
|---|---|
| **Visible** | ✅ You'd still maintain a list of canonical keywords |
| **No false positives** | ✅ Tunable threshold (e.g., 90% match required) |
| **Editable** | ✅ Edit canonical list, threshold |

### Option C — NLP / spaCy entity extraction
Overkill for this — programs are a fixed small set of named things, not freeform entities.

## Recommendation for PROGRAM TYPES

**Hybrid:** Option A (keyword catalog you control) PLUS RapidFuzz as an optional second pass for typo-tolerance. The catalog is the source of truth; RapidFuzz just helps when a manager writes "Kids Nite Out" instead of "Kids Night Out."

---

# Category 6: SKILLS (CLINICS ONLY)

Examples: `cartwheel`, `back handspring`, `back-handspring`, `BHS`, `flip-flop`, `roundoff`

## Options

### Option A — Skills catalog
Already exists in code as a hardcoded list of ~22 skills. Move to a database table per gym (or globally).

| Skill | Aliases |
|---|---|
| cartwheel | cartwheel |
| back handspring | back handspring, backhandspring, BHS, flip-flop, flip flop |
| handstand | handstand |
| roundoff | roundoff, round-off, round off |
| ... | ... |

### Option B — RapidFuzz for typo tolerance
Same idea as program types. Catalog of canonical skills + fuzzy matching.

## Recommendation for SKILLS

**Option A — catalog, moved to data.** Same pattern as programs. Optionally add RapidFuzz later for typo tolerance.

---

# Category 7: TYPOS / GRAMMAR / CAPITALIZATION

Not currently checked at all. New ground.

## Options

### Option A — `pyspellchecker`
Simple, multilingual spell checker. Pure Python. Flags misspelled words.

**Limitation per research:** *"may mistakenly flag person names and locations as misspelt words"* — so "Estrella" or "Tigar" would be flagged. You'd need a custom dictionary of your gym-specific words.

### Option B — `SymSpell` / `symspellpy`
Very fast (1M words/sec per research), high accuracy. Designed for typo correction.

Per research: *"Symspellpy outperformed other functions both in terms of time and accuracy."*

### Option C — `LanguageTool` (`language-tool-python`)
Comprehensive: grammar + spelling + style. Wraps the Java LanguageTool engine. Heavier dependency.

### Option D — LLM-based
Send text to Claude/GPT and ask "are there typos?" Most accurate, most expensive, slowest, least transparent.

## Recommendation for TYPOS

**Option A or B**, with a CUSTOM DICTIONARY of your gym names, coach names, skill names, and program-specific vocabulary. Otherwise it'll flag "Estrella" as a typo every single time.

| Requirement | Option A (pyspellchecker) | Option B (SymSpell) | Option C (LanguageTool) | Option D (LLM) |
|---|---|---|---|---|
| **Visible** | ⚠️ List of accepted words is in a dictionary file | ⚠️ Same | ❌ Engine has its own rules | ❌ Black box |
| **No false positives** | ⚠️ Without custom dict, flags names | ⚠️ Same | ⚠️ Better — has context | ✅ Best |
| **Editable** | ✅ Edit the custom dict | ✅ Edit the custom dict | ⚠️ Custom rules harder | ❌ — |
| **Speed** | OK | Fast | Slow | Slow |

For grammar/capitalization specifically — **defer this**. The audit catches data errors. Grammar/typos are a different problem and might not be worth the build effort vs catching pricing mismatches.

---

# Cross-cutting issue: false positives

Across ALL categories, the same problem appears: a number or word could be a date/time/price OR something else. Pre-cleaning helps but is brittle (every new false positive needs a new pre-clean rule).

**Better pattern:** require CONTEXT for a match to count.

- "5/20/26" — only count as a date when preceded by "on", "starts", "from", a day name, or appearing in a date-range pattern
- "9-9" — only count as a time when preceded by "from", "at", "between", or "open"
- "$25" — only count as the event price when preceded by "cost", "fee", "price", "tuition", or "per child"

This shifts the catalog from "what does the date look like" to "what does the date look like AND what's the context."

---

# Multi-mention handling

Today the engine flags the FIRST mismatch and stops. If a description says "October" and "March" and the event is in January, you see ONE error.

**Better pattern:** flag ALL distinct mismatches per check, deduplicated by error message, so you see "description mentions October AND March, event is January" — not just one of them.

This is a small engine change, not a tool choice.

---

# Visibility: "test this text" feature

A separate but related need: a place in the UI where you paste a sample title or description and the system tells you exactly what each rule would catch. This isn't a tool — it's a UI feature that uses whatever tools you pick.

If we build it, you'd be able to:
- Test "Wrong Year" against `5/20/26` and see it slide past
- Test "Time Mismatch" against `9-9` and see it slide past
- Catch gaps before they happen, not after

---

# Recommendation summary

| Category | Recommended approach | Why |
|---|---|---|
| Dates | Regex catalog | Visible, editable, low false positives, simple |
| Times | Regex catalog | Same |
| Prices | Regex catalog | Same — 4-5 rows covers it |
| Ages | Regex catalog | Same — already close to this in code |
| Program types | Catalog + RapidFuzz (typo tolerance) | Canonical list you control + fuzzy for human typos |
| Skills | Catalog + RapidFuzz (later) | Same |
| Typos/grammar | DEFER — `pyspellchecker` + custom dict if pursued | Different problem, maybe not worth the build |

**The pattern across the table:** every recommended approach keeps formats as DATA you can see and edit, not as hidden library magic. Where a library helps (RapidFuzz for typo tolerance), it's used as a second pass on top of a list you still control.

---

# Open questions for Jayme

1. **Is the typo/grammar category worth pursuing at all?** It's the biggest new build and the least clear value. Cleaning up `Sumemr Camp` matters less than catching `$45 should be $25`.
2. **Where do format catalogs live?** Three options:
   - Database table (visible/editable from a new admin tab — biggest build, best long-term)
   - JSON file in the repo (visible to anyone who opens the file, edits go through a commit)
   - Markdown doc (humans read, code doesn't — useful as spec, not runtime)
3. **Test-this-text feature** — yes/no/maybe-later?

---

# Sources (verified May 20, 2026)

- [dateparser · PyPI](https://pypi.org/project/dateparser/) — multi-language date parsing
- [dateparser.parse vs dateutil.parser.parse · GitHub](https://gist.github.com/jmaupetit/7b6250a06de5a322c278c3c7811ef063) — performance comparison (~8x slower)
- [parser — dateutil documentation](https://dateutil.readthedocs.io/en/stable/parser.html) — official docs
- [The Hidden Dangers of Crafting Your Own Regular Expressions for Input Validation | HackerOne](https://www.hackerone.com/blog/hidden-dangers-crafting-your-own-regular-expressions-input-validation) — regex maintainability risks
- [pyspellchecker · PyPI](https://pypi.org/project/pyspellchecker/) — spell check library
- [Comparison of existing spell checking tools](https://github.com/diffitask/spell-checkers-comparison) — pyspellchecker vs SymSpell vs Textblob benchmarks
- [Python Spelling and Grammar Checkers — Sapling](https://blog.sapling.ai/python-spelling-and-grammar-checkers/) — library comparison
- [RapidFuzz on GitHub](https://github.com/rapidfuzz/RapidFuzz) — fuzzy matching library
- [RapidFuzz versus FuzzyWuzzy](https://plainenglish.io/blog/rapidfuzz-versus-fuzzywuzzy) — migration rationale
- [fuzzywuzzy vs rapidfuzz vs thefuzz](https://piptrends.com/compare/fuzzywuzzy-vs-rapidfuzz-vs-thefuzz) — adoption trends

---

**This is research, not commitment.** Nothing in this doc has been built. Jayme reviews, edits, and decides what (if anything) to actually build. No code changes have been made.
