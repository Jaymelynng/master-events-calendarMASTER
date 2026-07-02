# 🤖 AI Event Review — procedure

**Created:** July 1, 2026
**What it is:** Claude reads every new/changed upcoming event like a gymnastics-literate marketing reviewer — title vs description vs iClass settings — and writes suggestion flags. It catches what word-lists and regexes structurally can't: wrong skills on clinics (knows BHS = back handspring, kip ≠ pullover), copied descriptions with same-month wrong day-numbers, text that contradicts settings, anything that doesn't make sense.

**How it runs:** a scheduled Claude Code task runs this daily (after the nightly sync). Jayme can also run it on demand by telling any Claude Code session: **"run the AI event review"** — the session follows this doc.

---

## Hard rules (mistake-proofing — do not violate)

1. **Write ONLY to `events.ai_review_flags` + `events.ai_reviewed_at`.** NEVER touch `validation_errors` (sync owns it and overwrites it), `acknowledged_errors`, `verified_errors`, or any other column. Never delete or edit events.
2. **Confident-only.** Flag only what a knowledgeable human would call a real mistake worth a manager's time. When unsure — stay silent. Zero speculative flags.
3. **Don't duplicate the mechanical checks.** Each event's existing `validation_errors` are provided; if the engine already flagged it, skip it.
4. **Respect dismissals.** If a flag's message matches an entry in the event's `acknowledged_errors` (or an `acknowledged_patterns` row for that gym + type), do not re-flag it.
5. **Suggestions, not verdicts.** Flags render in the Errors tab under 🤖 AI Review, clearly separated. Jayme verifies or dismisses; the AI never acts on its own flags.

## Jayme's rules are LAW (load them first)

Before reviewing, load Jayme's active rules and obey them like the engine does:

```sql
SELECT rule_type, gym_ids, program, scope, keyword, event_id, value, label
FROM rules
WHERE is_active = true AND rule_type NOT LIKE 'check_%'
  AND (is_permanent = true OR end_date >= CURRENT_DATE);
```

How to apply them (a rule applies when its gym_ids contains the event's gym or 'ALL', and its program matches the event type or 'ALL'):
- `program_synonym` — value (a keyword/title text) MEANS the program in label. e.g. value "gym fun friday" + label "OPEN GYM" → that title IS an open gym; never flag it as a program conflict.
- `program_ignore` — the keyword in value is NOT a program signal for that event type (e.g. "open gym" as a station name inside KNO events). Never flag it.
- `valid_time` — the time in value is an accepted extra time for that gym/program; don't flag text mentioning it.
- `exception` / `requirement_exception` — Jayme has explicitly excused this; respect the scope (all_events / keyword / single event_id).
- Any other user rule type: read its label/value and honor the obvious intent. When a rule seems to cover the situation, DON'T flag.

## Scope query (which events get reviewed)

```sql
SELECT id, gym_id, type, title, description, start_date, end_date, "time",
       day_of_week, age_min, age_max, program_name,
       registration_start_date, registration_end_date,
       openings, show_openings, allow_choose_days,
       validation_errors, acknowledged_errors
FROM events
WHERE deleted_at IS NULL
  AND end_date >= CURRENT_DATE
  AND type IS DISTINCT FROM 'SPECIAL EVENT'
  AND (ai_reviewed_at IS NULL OR updated_at > ai_reviewed_at)
ORDER BY gym_id, start_date;
```

Past events are never reviewed (nothing to fix). SPECIAL EVENT is exempt (same as engine).

## What to check per event (the rubric)

**Jayme's core doctrine (July 2, 2026): there is NO "truth" side.** An event is three pieces — settings, title text, description text. A disagreement between ANY two of them, in any combination, is an error, regardless of which side is "right." Never assume the settings are correct and the text is wrong (or vice versa) — just report that they don't line up. Check every pair: settings↔title, settings↔description, title↔description.

Compare all three sources — **iClass settings** (dates, time, day, ages, program type), **title**, **description**:

1. **Dates incl. day numbers:** description/title dates that don't fall inside start–end (the engine only compares month names — the AI catches "event July 8, text says July 15"). Ignore registration/deadline/other-event mentions.
   **Title-month rule (Jayme, July 2 — data-verified):** a month name in the TITLE that isn't one of the event's actual months → **ALWAYS flag, no theme exception.** We checked all ~900 month-mentioning titles in her full history: zero theme-style innocents ("4th of July Party" on a June event has never happened); the only 2 mismatches ever were both real copied-title mistakes. If a theme event ever appears, one dismissal handles it.
   **Lesson from a real miss (July 2):** a reviewer read "Kids Night Out | June 24th" on a July 24 event and didn't flag it. Month-vs-month on the title is MECHANICAL, not judgment — explicitly compare every month name in every title against the event's months, every event, no skimming.
2. **Day of week:** title AND description (engine checks description only).
3. **Ages incl. max:** title/description ages vs `age_min`–`age_max`, handling months-units ("18 months") correctly.
4. **Program:** does the text describe a different program than the iClass type? Use judgment, incl. camp-in-title on non-camps (engine only knows KNO/Clinic/Open Gym keywords).
5. **Skills (clinics):** does the title's skill match what the description teaches? Use real gymnastics knowledge — BHS = back handspring = flip-flop; kip ≠ pullover; recognize skills no list contains. Multi-skill clinics are fine if the description covers them.
6. **Common sense:** leftover text from a different event/gym/season, contradictions, nonsense. NOT grammar/typos/style — data errors only.
7. **Registration window (settings):** `registration_end_date` before `registration_start_date`; registration closing suspiciously long before the event or after it ends; text like "register by July 5" contradicting the actual registration dates; registration not open for an imminent event.
8. **Signup mode (settings):** `allow_choose_days` vs the text — description says "choose your days" or "$70/day" while the setting is full-week-only (false), or "must register for the entire week" while per-day signup is on (true). Flag only clear contradictions.
9. **Openings sanity (settings):** text claims "sold out" while `openings` > 0; text claims specific spots left ("only 5 spots!") wildly off from `openings`; `openings` = 0 while text urges immediate signup without a waitlist mention. Note: iClass gives NO total capacity (maxStudents is always null) — `openings` = spots remaining is all we have; never invent a capacity number.
10. **Program name (settings):** `program_name` (the iClass backend program) vs `type` vs what the text sells — e.g. program_name says half-day but everything else says full-day.
11. **Scheduling plausibility (wrong-year settings catch):** an event whose iClass date sits implausibly far in the future for its type is almost certainly a wrong-year settings mistake — e.g. a KNO / Clinic / Open Gym scheduled 10+ months out (these are scheduled weeks-to-months ahead, never a year), or a "Summer Camp" dated in the wrong season's year. Camps for next season CAN legitimately be listed ~6-9 months ahead — use judgment, flag only clear outliers. Also read 2-digit years in text ("7/15/25" on a 2026 event) — the mechanical year check only sees 4-digit years.
12. **Never flag prices.** Pricing validation was removed July 1, 2026 (Jayme's decision). Exception: a price APPEARING in a signup-mode contradiction (rule 8's "$70/day") is about the signup mode, not the amount — never judge whether a dollar amount is correct.

## Flag format (written to `ai_review_flags` as a jsonb array)

```json
{
  "type": "ai_review",
  "severity": "warning",
  "category": "ai_review",
  "message": "Clinic title says 'Back Handspring' but description teaches cartwheels",
  "reason": "One-sentence plain-English why, quoting the exact conflicting text",
  "flagged_at": "2026-07-02"
}
```

`message` must be short + specific (it's the dismiss key). Events reviewed clean get `ai_review_flags = []`. Every reviewed event gets `ai_reviewed_at = now()`.

## Execution pattern

1. Run the scope query. If 0 rows — report "nothing new to review" and stop.
1b. **Mechanical title-month sweep (safety net — a deterministic query catches what a reader skims past).** Run this against the scoped events and treat every hit as a mandatory flag unless already flagged/dismissed:
```sql
WITH months(name, num) AS (VALUES ('january',1),('february',2),('march',3),('april',4),('may',5),('june',6),
  ('july',7),('august',8),('september',9),('october',10),('november',11),('december',12))
SELECT e.id, e.gym_id, e.title, e.start_date, e.end_date, m.name AS bad_month
FROM events e JOIN months m ON e.title ~* ('\m' || m.name || '\M')
WHERE e.deleted_at IS NULL AND e.end_date >= CURRENT_DATE
  AND m.num <> EXTRACT(MONTH FROM e.start_date::date)
  AND m.num <> EXTRACT(MONTH FROM COALESCE(e.end_date, e.start_date)::date);
```
2. For large batches (>30 events), fan out subagents (one per ~40 events, each returns flags as JSON; the main session sanity-checks before writing).
3. Write per event: `UPDATE events SET ai_review_flags = <flags>, ai_reviewed_at = now() WHERE id = <id>;`
4. Report to Jayme: how many reviewed, how many flagged, the flags in plain English.

## Where flags show up

Admin Dashboard → 🚨 Errors tab → **🤖 AI Review** topic. Dismissing an AI flag uses the same flow as every other error (writes to `acknowledged_errors` keyed by message — rule 4 keeps it dismissed on future runs).
