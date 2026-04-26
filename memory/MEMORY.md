# Master Events Calendar — project memory (in-repo)

**Purpose:** Durable notes for humans and AI agents. Keep in sync with `CLAUDE.md`, `AI_RULES_READ_FIRST.md`, and `docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md`.

---

## Product vision — multi-sport + AI-assisted setup (Jayme’s plan)

**Intent:** This platform is **not** meant to stay gymnastics-only forever. The architecture should support **different sports** and, over time, **other registration / calendar sources** (not only iClassPro), with **the same validation pattern**: structured API (or import) data as source of truth vs marketing copy in titles/descriptions.

**Embedded vs configurable (strategic):**

- **Same Python for every gym today:** Universal comparison logic (dates, times, ages, program words, prices vs tables, etc.) lives in `automation/validation_engine.py`. That is intentional — one codepath, many tenants.
- **Per-gym / per-program differences** come from **data**: `rules`, `camp_pricing`, `event_pricing`, `gym_links`, synonyms, check toggles in `rules`.

**AI startup / onboarding product (planned):**

- Jayme is doing **research** toward an **AI-assisted setup** offering: help new organizations **configure** the product without being technical — explain what the embedded checks do, guide **Pricing** and **Gym Rules**, suggest `valid_price` / `program_synonym` / check toggles, validate links, **not** silently rewrite core validation code without review.
- **Value prop:** A **custom-feeling** setup that covers **small details they wouldn’t think of** — the edge cases Jayme already burned in on (copy vs system, dates/times, pricing truth, false positives) — plus **sport- or industry-specific suggestions** (terminology, program patterns, what to validate first), still with human oversight for anything high-stakes.
- Longer narrative and constraints for builders: **`docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md`**.

**Do not conflate with:**

- Letting untrusted UI edit raw regex for all tenants without a designed rules engine (high risk; separate product decision).

---

## Related docs

| Topic | File |
|--------|------|
| Validation matrix + tolerances | `docs/OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md` |
| Pricing contract | `docs/OPERATIONS/PRICING_SOURCE_OF_TRUTH.md` |
| Event new/changed/deleted | `docs/OPERATIONS/EVENT_COMPARISON_LOGIC.md` |
| **Openings / capacity feature (NEW)** | `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md` |

---

## Openings / Spot Count (April 26, 2026)

**Built and deployed in one session.** iClassPro's public detail endpoint (`/api/open/v1/{slug}/camps/{id}`) was always returning `openings` (integer), `openingsDisplay` (string), and `showOpenings` (bool) — we just weren't capturing them.

**Verified live for all 10 gyms** — every gym sends the integer count and has `showOpenings: true`.

**Cards now show:** 🟢 23 (green, plenty open) / ⚠️ 2 (orange, almost full) / 🔴 FULL (red badge top-left).

**Key constraint:** iClass `maxStudents` is always `null` — total capacity is NOT available. Cannot show "23/40" fraction format without manually entering capacity per event.

**Time was removed from cards** in the same session — accessible via hover tooltip, Table View, side panel.

**Side gotcha discovered:** `automation/pricing_supabase.py` was an untracked file that f12_collect_and_import.py imports. Pushing only the openings code without it broke Railway sync. Now committed.

**Full write-up:** `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md`

---

## ⚠️ STALE WARNING — April 7 pricing crisis is RESOLVED

The original April 7 entry below claimed "DO NOT DEPLOY" because of `find_matching_schedule()`. **That function does not exist in the codebase.** It was attempted, then backed out. Current pricing flow uses `programName` directly from API + `pricing_supabase.py` for date-aware lookups. Test fixture (`automation/test_validation_fixtures.py`) explicitly asserts the broken function stays gone. Future sessions should ignore the scary warning and trust this resolution.

---

**Last updated:** April 26, 2026
