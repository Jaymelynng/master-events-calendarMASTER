# Future Plans — IP Snapshot

**Status:** Reference / IP preservation
**Saved:** April 26, 2026
**Source:** Originally lived in the "Future Plans" admin tab + `future_plans` Supabase table — preserved here as markdown so the catalog survives any future UI rewrite.

---

## Why this doc exists

Same reason as [VALIDATION_RULES_REFERENCE.md](VALIDATION_RULES_REFERENCE.md) — preserve Jayme's planning IP outside of any specific UI. The Future Plans admin tab is good but the entries below represent months of identifying real product gaps. If we ever rebuild the admin or migrate to a new system, this catalog shouldn't get lost.

The live source of truth remains the `future_plans` table in Supabase. This doc is the **point-in-time snapshot** as of April 26, 2026.

---

## 🚀 Ready to Build

### 1. Move hardcoded keywords to database
- **Type:** Improvement · **Priority:** High · **Area:** Validation
- **Why:** KNO, CLINIC, OPEN GYM title/description keywords are hardcoded in Python. Move to a database table (`gym_valid_values` with `gym_id=ALL`) so they can be managed from the Admin Dashboard.
- **Note (Apr 26):** The `gym_valid_values` table was DROPPED in March — replaced by the `rules` table. So this becomes "move keywords into the `rules` table as program_synonym entries with gym_ids=['ALL']" instead.
- **Added by AI:** 3/5/2026

### 2. Fix year-in-description validation
- **Type:** Bug Fix · **Priority:** High · **Area:** Validation
- **Why:** Year mismatch only checks title, not description. A gym could copy a 2025 event to 2026, change the title year, but leave the description saying 2025.
- **Note (Apr 26):** ✅ ALREADY FIXED per CLAUDE.md / AI_RULES_READ_FIRST.md (Mar 5, 2026 update). Now checks both title AND description (first 300 chars). Mark this entry as resolved.
- **Added by AI:** 3/5/2026

---

## 📋 Planning

### 3. Build `program_ignore` rule type
- **Type:** New Feature · **Priority:** Medium · **Area:** Validation
- **Why:** Cannot ignore "open gym" when it appears as a station/activity name inside a KNO event description. Need a rule type that suppresses specific program_mismatch errors.
- **Note (Apr 26):** Still relevant. Could be implemented as a new entry in the `rules` table — `rule_type='program_ignore'`, value=keyword to ignore, scope=event_type or gym.
- **Added by AI:** 3/5/2026

### 4. Move skills list to database
- **Type:** Improvement · **Priority:** Medium · **Area:** Validation
- **Why:** Clinic skill keywords (cartwheel, back handspring, etc.) are hardcoded twice in Python. Should be a database-driven list so new skills can be added from admin.
- **Note (Apr 26):** Still relevant. Could be a new table `clinic_skills` or rows in `rules` with rule_type='valid_skill'.
- **Added by AI:** 3/5/2026

### 5. Restrict CORS to Vercel domain
- **Type:** Bug Fix · **Priority:** Medium · **Area:** Backend
- **Why:** Flask API currently allows all origins (`CORS(app)` with no restriction). Should restrict to teamcalendar.mygymtools.com for security.
- **Note (Apr 26):** Still relevant. Was attempted in Feb 2026 but reverted because `RAILWAY_ENVIRONMENT` env var doesn't exist on Railway. Need to determine the correct env var name (likely `RAILWAY_ENVIRONMENT_NAME` or similar) before re-attempting.
- **Added by AI:** 3/5/2026

### 6. Make event types database-driven
- **Type:** Expansion · **Priority:** Low · **Area:** Database
- **Why:** Currently 5 hardcoded types (CAMP, CLINIC, KNO, OPEN GYM, SPECIAL EVENT). For expansion to non-gymnastics businesses (multi-sport SaaS direction), these should come from a database table with configurable validation rules per type.
- **Note (Apr 26):** Aligns directly with the multi-sport SaaS vision in `PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md`. Should be elevated to high priority when SaaS direction is committed to.
- **Added by AI:** 3/5/2026

### 7. Add max age validation
- **Type:** New Feature · **Priority:** Low · **Area:** Validation
- **Why:** Only minimum age is validated currently. Should also check maximum age in title/description matches iClass data.
- **Note (Apr 26):** Still relevant. Already noted as a "known gap" in `VALIDATION_RULES_REFERENCE.md`.
- **Added by AI:** 3/5/2026

---

## ⏸️ On Hold

### 8. Migrate EventsDashboard.js to refactored version
- **Type:** Improvement · **Priority:** Medium · **Area:** Frontend
- **Why:** Refactored version exists at `EventsDashboard_REFACTORED.js` (519 lines vs 4000+) but App.js still imports the monolithic file. Needs testing before switch.
- **Note (Apr 26):** ✅ ALREADY DONE — verified in this session. App.js imports the REFACTORED version. The 4150-line `EventsDashboard.js` is dead code, imported nowhere. This entry can be marked complete; remaining task is to DELETE the dead file.
- **Added by AI:** 3/5/2026

---

## Items resolved between March and April 2026 (no longer in the live tab but worth noting)

These were either resolved or made obsolete by other work:
- Replace Playwright with Direct HTTP API → ✅ Done (Mar 9, 2026)
- Database-driven validation engine → ✅ Done (Mar 17, 2026)
- Drop `gym_valid_values` table → ✅ Done (Mar 17, 2026)
- Capture iClass openings count → ✅ Done (Apr 26, 2026)
- Holiday-week camp dates wrong (bookend vs schedule blocks) → ✅ Done (May 4, 2026). Sync now derives `start_date` / `end_date` from `blocks[0]` / `blocks[-1]` for camps with a schedule, falling back to `startDate` / `endDate`. Discovered when boss rejected an email referencing 5/25 for a camp that actually started 5/26 (Memorial Day Tuesday). Affected ~18 camps across 8 gyms in production at time of fix.

---

## New gap surfaced May 4, 2026 (open)

### 9. Day-number mismatch check (title day vs `start_date` day)
- **Type:** New Feature · **Priority:** Medium · **Area:** Validation
- **Why:** Engine compares months and years between title/description and `start_date`, but does NOT compare the day-of-month number. So a manager typing "May 25th" in the title for a camp whose `start_date` is May 26 would not be flagged. Discovered while diagnosing the holiday-week bookend bug — the case where the manager IS the source of error (not iClass) currently slips through.
- **Note:** Could be a new check function `check_day_number_mismatch` registered in CHECK_REGISTRY. Skipped for camps would be sensible (camps span multiple days).
- **Added by AI:** 5/4/2026

---

## What's NOT in this catalog (gaps in planning)

Vision pivots from this session that aren't yet captured in the Future Plans tab:

1. **Structured Event Editor** (Build 1 from `NEW_ERRORS_COMMAND_CENTER_VISION.md`) — the foundational pivot from "audit errors after the fact" to "make errors impossible at write time." This is a 1-2 month build and the highest-leverage thing in the entire roadmap.
2. **iClassPro admin push API integration** — needed to enable the structured editor. Need to probe whether iClass has this endpoint.
3. **Templates per gym per event type** — substrate for the structured editor.
4. **Sync mode change** from "detect mismatches" to "reconcile external edits."
5. **Action Surface / Alerts Strip** at top of calendar (replaces the Audit & Review tab as a filter form).

These should be added as Future Plans entries if you want them tracked alongside the existing 8.
