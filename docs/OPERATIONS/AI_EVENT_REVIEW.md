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

## Scope query (which events get reviewed)

```sql
SELECT id, gym_id, type, title, description, start_date, end_date, "time",
       day_of_week, age_min, age_max, program_name, validation_errors,
       acknowledged_errors
FROM events
WHERE deleted_at IS NULL
  AND end_date >= CURRENT_DATE
  AND type IS DISTINCT FROM 'SPECIAL EVENT'
  AND (ai_reviewed_at IS NULL OR updated_at > ai_reviewed_at)
ORDER BY gym_id, start_date;
```

Past events are never reviewed (nothing to fix). SPECIAL EVENT is exempt (same as engine).

## What to check per event (the rubric)

Compare all three sources — **iClass settings** (dates, time, day, ages, program type), **title**, **description**:

1. **Dates incl. day numbers:** description/title dates that don't fall inside start–end (the engine only compares month names — the AI catches "event July 8, text says July 15"). Ignore registration/deadline/other-event mentions.
2. **Day of week:** title AND description (engine checks description only).
3. **Ages incl. max:** title/description ages vs `age_min`–`age_max`, handling months-units ("18 months") correctly.
4. **Program:** does the text describe a different program than the iClass type? Use judgment, incl. camp-in-title on non-camps (engine only knows KNO/Clinic/Open Gym keywords).
5. **Skills (clinics):** does the title's skill match what the description teaches? Use real gymnastics knowledge — BHS = back handspring = flip-flop; kip ≠ pullover; recognize skills no list contains. Multi-skill clinics are fine if the description covers them.
6. **Common sense:** leftover text from a different event/gym/season, contradictions, nonsense. NOT grammar/typos/style — data errors only.
7. **Never flag prices.** Pricing validation was removed July 1, 2026 (Jayme's decision).

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
2. For large batches (>30 events), fan out subagents (one per ~40 events, each returns flags as JSON; the main session sanity-checks before writing).
3. Write per event: `UPDATE events SET ai_review_flags = <flags>, ai_reviewed_at = now() WHERE id = <id>;`
4. Report to Jayme: how many reviewed, how many flagged, the flags in plain English.

## Where flags show up

Admin Dashboard → 🚨 Errors tab → **🤖 AI Review** topic. Dismissing an AI flag uses the same flow as every other error (writes to `acknowledged_errors` keyed by message — rule 4 keeps it dismissed on future runs).
