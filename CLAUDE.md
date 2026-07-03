# CLAUDE.md - AI Session Quick-Start Guide

**Purpose:** Get any AI agent up to speed in under 2 minutes, every session.

---

## 🚨 MANDATORY FIRST STEPS (Do these BEFORE any work)

1. **Read `AI_RULES_READ_FIRST.md`** — Critical rules, system architecture, validation logic
2. **Read `docs/OPERATIONS/CURRENT_SYSTEM_STATUS.md`** — What's working NOW
3. **Read `docs/OPERATIONS/AI_VERIFICATION_PROTOCOL.md`** — NEVER say "it should work"

---

## 📋 PROJECT SUMMARY (30-second version)

**What:** Team Calendar app for 10 gymnastics gyms — syncs events from iClassPro portals, validates data quality, displays on calendar.

**Tech Stack:**
- **Frontend:** React 18 + Tailwind CSS → deployed on Vercel
- **Backend:** Flask + Direct HTTP API (Python) → deployed on Railway (Playwright kept as fallback)
- **Database:** Supabase (PostgreSQL)
- **Live URL:** https://teamcalendar.mygymtools.com

**User:** Jayme is a NON-TECHNICAL vibe coder. He communicates through documentation. Read ALL docs before making changes.

### Product vision (multi-sport + AI setup) — read when scoping features

- **Plan:** Platform is intended to generalize beyond gymnastics; **same embedded validation code for every gym**, with differences in **data** (`rules`, pricing, links). Jayme is researching an **AI-assisted onboarding / startup** to help new organizations configure setup (explain checks, guide Pricing & Rules — **not** ad-hoc replacement of core validation without design).
- **In-repo memory:** [`memory/MEMORY.md`](memory/MEMORY.md)
- **Full write-up:** [`docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md`](docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md)

---

## 📁 KEY FILES (Where to look first)

| What | File |
|------|------|
| **Core UI** | |
| Active main entry | `src/components/EventsDashboard_REFACTORED.js` ← THIS is the live one |
| Legacy main UI | `src/components/EventsDashboard.js` (4151 lines, dead code, scheduled for cleanup) |
| Calendar grid | `src/components/EventsDashboard/CalendarGrid.js` (gym rows, splits camps → CampBand) |
| Camp variant bars | `src/components/EventsDashboard/CampBand.js` (NEW May 2026 — multi-day camps as long-narrow bars) |
| Sync workflow | `src/components/EventsDashboard/SyncModal.js` (2000+ lines) |
| Export options | `src/components/EventsDashboard/ExportModal.js` (1500+ lines) |
| Event details (side panel) | `src/components/EventsDashboard/EventDetailPanel.js` (Registration Options at TOP, May 2026) |
| Event cards | `src/components/EventsDashboard/EventCard.js` (reads color from event_types.color) |
| Theme/colors | `src/components/EventsDashboard/constants.js` (getEventTypeColor + hexToPastelHex helper) |
| Bulk Portal Opener | `src/components/EventsDashboard/BulkPortalOpener.js` (3-card grouped layout) |
| Monthly Requirements table | `src/components/EventsDashboard/MonthlyRequirementsTable.js` |
| **Admin Dashboard** | |
| Tab orchestrator + MonthlyRequirementsBar | `src/components/AdminDashboard/AdminDashboard.js` (live category add/edit/remove + hex paste color picker, May 2026) |
| Errors tab (command center) | `src/components/AdminDashboard/AdminErrorsCenter.js` (NEW July 2026 — per gym / per topic / totals, three panels) |
| Gym Rules tab | `src/components/AdminDashboard/AdminGymRules.js` (1000+ lines) |
| Pricing tab | `src/components/AdminDashboard/AdminPricing.js` |
| Change History tab | `src/components/AdminDashboard/AdminChangeHistory.js` |
| Future Plans tab | `src/components/AdminDashboard/AdminFuturePlans.js` |
| Quick Actions tab | `src/components/AdminDashboard/AdminQuickActions.js` |
| Rule Wizard | `src/components/AdminDashboard/RuleWizard.js` |
| Email Composer | `src/components/AdminDashboard/EmailComposer.js` |
| **Libraries** | |
| API functions | `src/lib/api.js` |
| Event comparison | `src/lib/eventComparison.js` |
| Validation helpers | `src/lib/validationHelpers.js` |
| Railway API comms | `src/lib/syncApi.js` |
| Real-time updates | `src/lib/useRealtimeEvents.js` |
| Supabase config | `src/lib/supabase.js` |
| **Python Backend** | |
| Event collection | `automation/f12_collect_and_import.py` (Direct API — calls validation_engine, no hardcoded validation) |
| Validation engine | `automation/validation_engine.py` (database-driven — all checks from `rules` table) |
| Flask API server | `automation/local_api_server.py` |
| **Vision / roadmap** | `memory/MEMORY.md`, `docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md` |

---

## 🔑 KEY CONCEPTS

### Validation System
- **DATA errors** (red) = something is WRONG (mismatch between sources)
- **All validation is database-driven** — 8 check rules in the `rules` table, executed by `validation_engine.py` (was 11 — the 3 pricing checks were removed July 1, 2026, see below)
- **Python has zero hardcoded validation** — `f12_collect_and_import.py` calls the engine, which reads active checks from the database
- **User rules** (valid_price, valid_time, exception, etc.) also live in the `rules` table
- **Format errors were never implemented** — the old SHOW_FORMAT_ERRORS toggle was hiding nothing (dead code, now removed)
- **What gets compared:** See `docs/OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md` for the complete comparison table

### Pricing
- **⚠️ PRICE VALIDATION REMOVED July 1, 2026 (Jayme's decision)** — the 3 pricing checks (`check_camp_price`, `check_event_price`, `check_price_mismatch`) are deleted from the `rules` table and stored pricing errors were stripped. Too many weird situations; Jayme is exploring an authenticated-backend connection before rebuilding. Do NOT re-add pricing validation without her explicit go. Restore path: `database/REMOVED_PRICING_VALIDATION_2026_07_01.sql`. Full context: `docs/OPERATIONS/PRICING_SOURCE_OF_TRUTH.md`.
- iClass API does NOT provide prices
- **Camp prices:** `camp_pricing` table — still used by sync to SET the displayed price on events (display only, no validation)
- **Other prices:** `event_pricing` table with `effective_date` support — same, display only
- **Pricing admin tab REMOVED July 2, 2026 (Jayme's ask)** — `AdminPricing.js` deleted (recoverable from git). Edit prices directly in Supabase if a base price changes.
- **April backend-discovery data** (`pricing_schedules`, `camp_type_mappings`) lives in the `archive` schema, out of `public`
- **Raw pricing data:** `data/gym-pricing-raw/` has iClassPro enterprise pricing for EST + CCP (all 10 gyms collected)

### Rules System (Unified March 2026)
- **ONE table: `rules`** — Python backend + frontend + Rule Wizard + dismiss flows all use this table
- **`gym_valid_values` table is DROPPED** — fully removed from database, all code references cleaned up
- **Rule Wizard** in Gym Rules tab — two flows: Requirement Exception (3 steps) or Validation Rule (5 steps)
- **Rule types:** check_* (11 system validation checks), valid_price, sibling_price, valid_time, program_synonym, requirement_exception, exception
- **Scoping:** all_events, keyword-based, or single_event — rules only affect what they're scoped to
- **Temporary vs permanent:** Temporary rules auto-expire. Python filters out expired rules during sync
- **Requirement status notes** — click missing status on dashboard to track (In Progress / Late / Excused)

### Email System (NEW Feb 23, 2026)
- **Email Composer** in Admin Dashboard — generate emails for missing events and/or data errors
- **Open in Outlook** — pre-fills To, CC, Subject, Body in Outlook web compose
- **Manager contacts** stored in `gyms` table (manager_name, manager_email)
- Auto-send via Resend or Power Automate planned but not yet configured

### Openings / Spot Count (NEW April 26, 2026)
- **Live spot count on every event card** — `🟢 23` / `⚠️ 2` (almost full) / `🔴 FULL`
- **Source:** iClassPro `/api/open/v1/{slug}/camps/{id}` returns `openings` (int), `openingsDisplay` (string), `showOpenings` (bool) — was always there, just wasn't being captured
- **All 10 gyms send the integer** — verified via live API probe; no iClass settings to change
- **Database columns:** `openings`, `openings_display`, `show_openings` on `events` + `events_archive` (and exposed in `events_with_gym` view)
- **CSV export:** new `Spots Left` and `Openings Display` columns
- **Time removed from cards** — accessible via hover tooltip, Table View, side panel
- **Capacity total NOT available** — iClass `maxStudents` is always null; can't show "23/40" fraction format without manual entry
- **Full doc:** `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md`

### Daily Schedule (NEW July 2, 2026)
- **Per-weekday camp hours captured.** Sync used to keep only the first day's time in `events.time`; now the whole schedule is stored in `events.daily_schedule` (jsonb array of `{day, start_time, end_time, duration}`).
- **Why:** a camp can have a mis-set single day (real case: SGT "Half Day" camp with Monday = 1hr while Tue–Fri = 3hr) that was invisible when only day 1 was kept.
- **Where it shows:** side panel "📅 Daily Schedule" section (flags the odd day red), CSV export "Daily Schedule" column, and the AI review "one day doesn't match its siblings" check.
- **Additive only** — `time` unchanged. Captured in f12 step 4b, allowlisted in local_api_server, persisted through SyncModal's 4 write spots, view-exposed. SQL record: `database/ADD_DAILY_SCHEDULE_COLUMN.sql`.
- **Per-day signup:** `allow_choose_days` (true = per-day, false = full-week-only) — the "✓ Per-Day Signup / 📦 Full Week Only" tag. Combined with pricing-schedule per-block rates (archive schema) it's how iClass decides single-day enrollment. Public API gives the net result only, not the admin toggle names.

### Admin Access
- Level 1: Everyone sees calendar
- Level 2: Shift+Click magic wand → Admin Dashboard
- Level 3: Press `*` + PIN (set via `REACT_APP_ADMIN_PIN` env var) → Super Admin (Quick Actions)

### AI Event Review (NEW July 1, 2026)
- **What:** Claude reviews every new/changed upcoming event like a gymnastics-literate human — title vs description vs iClass settings. Catches what regexes can't: wrong skills on clinics (knows BHS = back handspring), same-month wrong day-numbers, leftover copy from other events.
- **Where flags live:** `events.ai_review_flags` (jsonb) + `events.ai_reviewed_at` — its own lane. NEVER writes to `validation_errors` (sync owns that and overwrites it every run).
- **UI:** 🤖 AI Review topic in the Errors tab. Flags are labeled SUGGESTION with a plain-English reason; dismiss uses the standard acknowledged_errors flow and sticks across runs.
- **Runs:** daily scheduled Claude Code task + on demand ("run the AI event review" in any session).
- **Procedure (the contract any session must follow):** `docs/OPERATIONS/AI_EVENT_REVIEW.md` — read it before touching this system. Hard rules: write only to the two ai_* columns, confident-only, no price flags, respect dismissals.

### Admin Dashboard Tabs (5 tabs + Email button)
- **🚨 Errors** (NEW July 1, 2026) — Errors Command Center: every caught error per gym / per topic / totals + the 🤖 AI Review lane. Summary cards → horizontal topic tabs (Time / Dates / Age / Program / Title-Desc / AI Review / No Description) → three panels: gyms with counts | event cards | detail with iClass link + Dismiss / Make Rule. File: `AdminErrorsCenter.js`. Replaces the old Audit & Review tab deleted in June 2026.
- **Gym Rules** — Rule Wizard, permanent/temporary rules, synonyms, exceptions, plus the system checks with toggles (the old Audit Rules tab was merged into here)
- **Change History** — Audit log with filters and CSV export
- **Future Plans** — Track planned features, improvements, ideas (add/edit/delete from UI)
- **Quick Actions** — Sync, import, super admin tools

**Gotcha (learned July 1, 2026):** the app renders `EventsDashboard_REFACTORED.js` (see `App.js`), NOT the 4000-line `EventsDashboard.js`. AdminDashboard props must be wired in the REFACTORED file — a missing `events` prop there was why Email Composer (and the new Errors tab) received no event data.

---

## ⚠️ KNOWN BUGS & GAPS (as of March 2026)

| Issue | Status | Details |
|-------|--------|---------|
| Export bug (analytics ignoring filters) | ✅ FIXED | `ExportModal.js` now uses `filteredEvents` consistently |
| Time regex false positives | ✅ FIXED | Pre-cleaning for "$62 a day", "Ages 4-13" patterns |
| Day range false positives | ✅ FIXED | "Monday-Friday", "Monday through Friday" now handled |
| Export showed single Date column | ✅ FIXED | CSV export now includes Start Date and End Date columns for multi-day events |
| Sync All cross-type false deletions | ✅ FIXED | Comparison now filters existing events by checkedTypes to prevent cross-type false deletions |
| Wrong year in DESCRIPTION | ✅ FIXED | Now checks both title AND description for wrong year (first 300 chars) |
| Holiday-week camp start date wrong (5/25 vs 5/26 etc) | ✅ FIXED | Sync now reads `blocks[0].sqlDate` (real first meeting day) instead of bookend `startDate`. Affected ~18 camps across 8 gyms for Memorial Day 2026 alone. Same fix applies to Labor Day, Thanksgiving, holiday weeks. Fallback to bookend if blocks missing. (May 4, 2026) |
| Two rules tables (`gym_valid_values` + `rules`) | ✅ FIXED | Unified on `rules` table. `gym_valid_values` fully dropped from database |
| Hardcoded validation in Python | ✅ FIXED | Replaced with database-driven engine (`validation_engine.py`). 367/367 event test confirmed identical results |
| Format errors (dead code) | ✅ FIXED | Format errors were never generated by Python. Dead code and SHOW_FORMAT_ERRORS toggle removed |
| `program_ignore` rule type | ❌ Not built | Can't ignore "open gym" when it's a station name in KNO |
| Special Events | ✅ Skipped | All validation skipped for SPECIAL EVENT type |
| Deleted events auto-archive | ✅ FIXED | `archive_single_event()` function moves to archive on detection |
| includeDeleted flag broken | ✅ FIXED | Now queries events table directly instead of view |
| Audit card counts mismatch | ✅ FIXED | Cards now only count active errors matching current filters |
| Validation errors silently wiped | ⚠️ Risk | If sync event arrives without `validation_errors` field, stored errors get set to NULL |
| No-description events skip validation | ⚠️ Risk | Events without descriptions skip ALL 11 checks entirely |
| Check crashes swallowed silently | ⚠️ Risk | If a check function throws an exception, it logs and continues — broken check looks like "no errors" |
| Dismissed errors exact-match only | ⚠️ Risk | If error message wording changes slightly, dismissed errors reappear |
| Validation changes not shown in sync | ⚠️ Gap | `validation_errors` excluded from event comparison — new errors show as "unchanged" |

---

## 🛠️ BUILD & TEST

```bash
npm install          # Install dependencies
npm run build        # Build (CI=false set in package.json)
npm start            # Local dev server on port 3000
npm test             # Run tests
```

**Build currently:** ✅ Succeeds with only ESLint warnings (no errors)

---

## 📚 DOCUMENTATION MAP

```
AI_RULES_READ_FIRST.md          ← START HERE (rules + architecture)
docs/
├── INDEX.md                    ← Documentation index
├── BUSINESS/                   ← ROI, presentations
├── OPERATIONS/                 ← How-to guides (21 docs)
│   ├── CURRENT_SYSTEM_STATUS.md ← What's working NOW
│   ├── AI_VERIFICATION_PROTOCOL.md ← Testing rules
│   ├── AUTO-SYNC-GUIDE.md      ← Main sync workflow
│   └── DATA_QUALITY_VALIDATION.md ← Validation details
└── TECHNICAL/                  ← Architecture, schema
    ├── TECHNICAL-REFERENCE.md  ← System overview
    ├── VALIDATION_RULES_ARCHITECTURE.md ← Validation rules
    ├── DATABASE_COMPLETE_SCHEMA.md ← All tables
    └── EXPORT_BUG_ANALYSIS.md  ← Known export issues (FIXED)
```

---

## 🚫 COMMON MISTAKES (Don't repeat these)

1. **Don't say "it should work"** — Test it, then say "I tested it and it works"
2. **Don't skip reading docs** — Jayme spent hours writing them. Read them.
3. **Don't hardcode validation** — All checks come from the `rules` table via `validation_engine.py`. The `gym_valid_values` table no longer exists.
4. **Don't assume price comes from iClass** — It doesn't. Check pricing tables.
5. **Don't make changes without understanding the full system** — Read docs first
6. **Don't simulate with fake data** — Use actual Supabase data
7. **Don't modify `EventsDashboard.js` without understanding its 4000+ line structure** — It's complex

---

## 📝 PREVIOUS SESSION LESSONS (from `PREVIOUS CHATS/` folder)

| Chat | Key Lesson |
|------|------------|
| Export feature | Analytics was using `activeEvents` instead of `filteredEvents` — now fixed |
| Export deploy | JSX syntax error in 4000-line file crashed build — be careful with large files |
| Time parsing | Regex `\d{1,2}\s*(a|p)\b` matches "$62 a" and "Ages 4-13" — now pre-cleaned |
| Day parsing | "Monday-Friday" ranges were flagged as day mismatches — now pre-cleaned |
| Copilot rules | ALWAYS search + inspect code before answering. Never assume. |
| Direct API swap | Playwright → Direct HTTP API (Mar 9, 2026). USE_DIRECT_API env var defaults true, set false to revert. Same data format, zero downstream changes needed. |
| Validation engine | All hardcoded validation replaced with database-driven engine (Mar 17, 2026). `validation_engine.py` reads check rules from `rules` table. f12 reduced from 2417 to 1562 lines. |
| Full audit (Apr 7) | Pipeline audit found 5 risks: silent error wipe, no-description skip, check crash swallowing, exact-match dismiss fragility, validation changes hidden in sync. README/CLAUDE.md/AI_RULES updated. |
| Openings count (Apr 26) | Captured `openings`, `openings_display`, `show_openings` from iClass detail endpoint — already in API, just wasn't being captured. New DB columns + Sync Modal patches (4 spots) + card display + CSV columns. Full doc: `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md`. **Critical:** `pricing_supabase.py` was untracked locally; added to git mid-session after Railway sync error. |
| April 7 pricing crisis (resolved Apr 26) | The MEMORY.md "DO NOT DEPLOY" warning about `find_matching_schedule()` is OUTDATED — that broken function does not exist in the codebase. Current pricing flow uses `programName` directly from API + `pricing_supabase.py` for date-aware lookups. Test fixture explicitly asserts the broken function stays gone. |

---

## 🔄 SESSION WORKFLOW (Follow this every time)

1. **Read this file** (you're doing it now ✅)
2. **Read `AI_RULES_READ_FIRST.md`** for detailed rules
3. **Ask Jayme what she wants to work on**
4. **Read relevant docs** before touching code
5. **Make small changes** — test after each one
6. **Update docs** if you change behavior
7. **Never say "it works" without testing**

---

**Last Updated:** April 26, 2026
