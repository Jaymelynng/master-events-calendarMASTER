# CLAUDE.md - AI Session Quick-Start Guide

**Purpose:** Get any AI agent up to speed in under 2 minutes, every session.

---

## ⛔ JAYME'S #1 LAW — NO HARDCODING (read before touching anything)

**Nothing that controls how the app behaves may be hardcoded in code.** Every category mapping, keyword list, synonym, program name, threshold, tolerance, valid value, skill list, CC email — ALL of it must live in the **database** and be **manageable by Jayme from the Admin UI**. She is non-technical: a value she can't change from a screen is a value she can't own.

- If you find hardcoded behavior, **FLAG IT as a bug** (file+line) and move it to DB + a UI screen. Never frame it as optional "future polish" — that reaction enrages her because she has said this a million times.
- **Never ADD a new hardcoded list/mapping/keyword.** Build it as a table + admin screen from the start.
- Moving code→DB is **additive/safe**: sync/engine reads the table, falls back to the old code list only if the table is empty/unreachable, so nothing breaks.
- Her model: **universal/core rules** (apply to all) + **gym rules** that are **permanent or temporary** for one-offs — all created and managed in the workflow HERE, in the app.
- Migration status + full offender list: `C:\Users\Jayme\.claude\projects\C--Users-Jayme\memory\project_no_hardcoding_law.md`.
- **Category → bucket mapping is DONE:** f12 reads the `event_type_mappings` table (`fetch_type_mappings` → `resolve_type_mapping`); Jayme edits it in the **🗂️ Buckets** admin tab (`AdminBuckets.js`). `BOOKING_TITLE_TO_EVENT_TYPE` in f12 is only the offline fallback. ⚠️ A separate `category_mappings` table also exists (15 rows) and **no code reads it** (grep of `src/` + `automation/`, 2026-10-13) — ask Jayme before building on it or removing it.

---

## 🗄️ DATABASE + GYM CODES (read before any query)

- **This area:** folder `JAYME PROJECTS\HUB -ACTIVE - master-events-calendar` · Supabase `xftiwouxpefchwoxxgpf` "MASTER EVENTS CALENDAR" · GitHub `Jaymelynng/master-events-calendarMASTER`. A separate area — its own folder, database and repo. Other areas (Command Center, ICLASS SUCKS, …) may be read for research only; never write into them from here, and never point this app at their databases. Known connections (checked 2026-10-13): the `monthly-events-email` skill and the Command Center's HubSpot email planning scripts READ this database's events/columns — so renaming a column here can break them.
- **Gym facts for this app (names, slugs, logos, brand colors, managers, contacts) = this database's own `gyms` table.** Read it live: `select id, name from gyms`.
- **This DB's codes for the merger gyms are AAG, EAG, PLG** (plus MGC), checked 2026-10-13. Other areas use other codes for the same gyms (AAR / EGF / PGN) — **querying this DB with AAR, EGF or PGN returns 0 rows.** Zero rows for one gym = wrong code, not an empty gym. Never "fix" the codes in this database without Jayme's word.
- **Never hardcode the gym count or codes** in code or docs.

---

## 🚨 MANDATORY FIRST STEPS (Do these BEFORE any work)

1. **Read `AI_RULES_READ_FIRST.md`** — Critical rules, system architecture, validation logic
2. **Read `docs/OPERATIONS/CURRENT_SYSTEM_STATUS.md`** — What's working NOW
3. **Read `docs/OPERATIONS/AI_VERIFICATION_PROTOCOL.md`** — NEVER say "it should work"

---

## 📋 PROJECT SUMMARY (30-second version)

**What:** Team Calendar app for every one of Jayme's gyms — syncs events from iClassPro portals, validates data quality, displays on calendar.

**Tech Stack:**
- **Frontend:** React 18 + Tailwind CSS → deployed on Vercel
- **Backend:** Flask + Direct HTTP API (Python) → deployed on Railway (Playwright kept as fallback)
- **Database:** Supabase `xftiwouxpefchwoxxgpf` (PostgreSQL)
- **Live URL:** https://teamcalendar.mygymtools.com

**User:** Jayme is a NON-TECHNICAL vibe coder. She communicates through documentation. Read ALL docs before making changes. Deploy only on her go.

### Product vision (multi-sport + AI setup) — read when scoping features

- **Plan:** Platform is intended to generalize beyond gymnastics; **same embedded validation code for every gym**, with differences in **data** (`rules`, links). Jayme is researching an **AI-assisted onboarding / startup** to help new organizations configure setup (explain checks, guide Rules — **not** ad-hoc replacement of core validation without design).
- **In-repo memory:** [`memory/MEMORY.md`](memory/MEMORY.md)
- **Full write-up:** [`docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md`](docs/OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md)

---

## 📁 KEY FILES (Where to look first)

| What | File |
|------|------|
| **Core UI** | |
| Active main entry | `src/components/EventsDashboard_REFACTORED.js` ← THIS is the live one (see `App.js`) |
| Legacy main UI | `src/components/EventsDashboard.js` (~4,150 lines, dead code, scheduled for cleanup) |
| Calendar grid | `src/components/EventsDashboard/CalendarGrid.js` (gym rows, splits camps → CampBand) |
| Camp variant bars | `src/components/EventsDashboard/CampBand.js` (multi-day camps as long-narrow bars) |
| Sync workflow | `src/components/EventsDashboard/SyncModal.js` (2000+ lines) |
| Export options | `src/components/EventsDashboard/ExportModal.js` (1500+ lines) |
| Event details (side panel) | `src/components/EventsDashboard/EventDetailPanel.js` |
| Event cards | `src/components/EventsDashboard/EventCard.js` (reads color from event_types.color) |
| Theme/colors | `src/components/EventsDashboard/constants.js` |
| Bulk Portal Opener | `src/components/EventsDashboard/BulkPortalOpener.js` |
| Monthly Requirements table | `src/components/EventsDashboard/MonthlyRequirementsTable.js` |
| **Admin Dashboard** | |
| Tab orchestrator | `src/components/AdminDashboard/AdminDashboard.js` |
| Errors tab | `src/components/AdminDashboard/AdminErrorsCenter.js` |
| Buckets tab | `src/components/AdminDashboard/AdminBuckets.js` (event_type_mappings + type_locked) |
| Gym Rules tab | `src/components/AdminDashboard/AdminGymRules.js`, `RuleWizard.js`, `RuleManager.js` |
| Contacts tab | `src/components/AdminDashboard/AdminContacts.js` |
| Change History / Future Plans / Quick Actions | `AdminChangeHistory.js` / `AdminFuturePlans.js` / `AdminQuickActions.js` |
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

---

## 🔑 KEY CONCEPTS

### Validation System
- **DATA errors** (red) = something is WRONG (mismatch between sources)
- **All validation is database-driven** — the active `check_*` rows in the `rules` table (10 on 2026-10-13: age, date, day, impossible_date, ordinal_typo, program, registration_closes_early, time, title_desc, year), executed by `validation_engine.py`. Re-count with `select rule_type from rules where rule_type like 'check_%'` before quoting a number.
- **Python has zero hardcoded validation** — `f12_collect_and_import.py` calls the engine, which reads active checks from the database
- **User rules** (valid_time, requirement_exception, program_synonym, program_ignore, exception) also live in the `rules` table. `program_ignore` (built 2026-05-03, commit 6d76ecf; Rule Wizard "Ignore Keyword") stops a program-mismatch flag for a keyword in one gym + event type — e.g. "open gym" as a station inside a KNO
- **Text checks skip** events with no description and Special Events; **settings checks** (`SETTINGS_CHECKS`, e.g. registration closes early) run on every event
- **What gets compared:** `docs/OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md`

### Pricing — ⛔ ALL PRICING REMOVED (October 2, 2026, Jayme's decision)
- The calendar no longer sets, shows, exports, or checks a price anywhere. Reason, in her words: it is not verified as correct and there is no system yet to compare prices. `events.price` is NULL on every event, the sync has no price code, the engine has no price checks, there is no `valid_price` / `sibling_price` rule type, and the app has no price column, field, filter, or rule type.
- **Do NOT re-add any price display, lookup, title/description price parsing, or price validation without her explicit go.** Record + backup: `database/REMOVED_PRICING_2026_10_02.sql`, `database/backups/REMOVED_PRICING_2026_10_02_backup.json`. Guard test: `automation/test_validation_fixtures.py`. Earlier July 2026 removal of the 3 price checks: `database/REMOVED_PRICING_VALIDATION_2026_07_01.sql`.
- `camp_pricing` and `event_pricing` tables still exist with their rows, but **nothing reads them**. iClass's public API gives no prices.

### Rules System
- **ONE table: `rules`** — Python backend + frontend + Rule Wizard + dismiss flows all use it (`gym_valid_values` is dropped)
- **Rule Wizard** in Gym Rules tab — Requirement Exception (3 steps) or Validation Rule (5 steps)
- **Scoping:** all_events, keyword-based, or single_event — rules only affect what they're scoped to
- **Temporary vs permanent:** temporary rules auto-expire; Python filters out expired rules during sync
- **Requirement status notes** — click missing status on dashboard to track (In Progress / Late / Excused)

### Email System
- **Email Composer** in Admin Dashboard — emails to managers for missing events and/or data errors; **Open in Outlook** pre-fills To/CC/Subject/Body
- **Manager contacts** in `gyms` table (manager_name, manager_email), edited in the Contacts tab
- Auto-send not configured

### Openings / Spot Count
- **Live spot count on every event card** — `🟢 23` / `⚠️ 2` / `🔴 FULL`, from iClass `/api/open/v1/{slug}/camps/{id}` (`openings`, `openingsDisplay`, `showOpenings`) → `events.openings`, `openings_display`, `show_openings`
- **Capacity total NOT available** — iClass `maxStudents` is always null
- **Full doc:** `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md`

### Daily Schedule
- Whole per-weekday camp schedule stored in `events.daily_schedule` (jsonb `{day, start_time, end_time, duration}`); `events.time` = first day only. Side panel flags an odd day red. SQL: `database/ADD_DAILY_SCHEDULE_COLUMN.sql`.
- **Per-day signup:** `allow_choose_days` (true = per-day, false = full-week-only).

### Admin Access
- Level 1: Everyone sees calendar
- Level 2: Shift+Click magic wand → Admin Dashboard
- Level 3: Press `*` + PIN (`REACT_APP_ADMIN_PIN`) → Super Admin (Quick Actions)

### AI Event Review
- Claude reviews every new/changed upcoming event — title vs description vs iClass settings. Flags in `events.ai_review_flags` + `events.ai_reviewed_at` only; NEVER writes `validation_errors`.
- **Procedure (the contract):** `docs/OPERATIONS/AI_EVENT_REVIEW.md` — read before touching it. Write only the two ai_* columns, confident-only, no price flags, respect dismissals.

### Admin Dashboard Tabs (read the `tabs` array in `AdminDashboard.js` for the live list)
- **🚨 Errors** — every caught error per gym / per topic / totals + the 🤖 AI Review lane
- **🗂️ Buckets** — train a category → bucket (event_type_mappings), force one event (type_locked), "Needs a home" list
- **📏 Gym Rules** — Rule Wizard, permanent/temporary rules, synonyms, exceptions, system check toggles
- **✉️ Contacts** · **📜 Change History** · **📅 Future Plans** · **⚡ Quick Actions**

**Gotcha:** AdminDashboard props must be wired in `EventsDashboard_REFACTORED.js`, not the dead 4,000-line file — a missing `events` prop there once left Email Composer and the Errors tab with no data.

---

## ⚠️ KNOWN RISKS (still open — re-check in code before relying on this)

| Issue | Details |
|-------|---------|
| Validation errors silently wiped | If a sync event arrives without `validation_errors`, stored errors get set to NULL |
| Check crashes swallowed | A check that throws logs and continues — a broken check looks like "no errors" |
| Dismissed errors exact-match only | If error wording changes slightly, dismissed errors reappear |
| Validation changes not shown in sync | `validation_errors` excluded from event comparison — new errors show as "unchanged" |

Fixed history (export filters, regex false positives, holiday-week start dates via `blocks[0].sqlDate`, rules-table unification, auto-archive): git log + `docs/OPERATIONS/CURRENT_SYSTEM_STATUS.md`.

---

## 🛠️ BUILD & TEST

```bash
npm install          # Install dependencies
npm run build        # Build (CI=false set in package.json)
npm start            # Local dev server on port 3000
npm test             # Run tests
```

---

## 📚 DOCUMENTATION MAP

```
AI_RULES_READ_FIRST.md          ← START HERE (rules + architecture)
docs/
├── INDEX.md                    ← Documentation index
├── BUSINESS/                   ← ROI, presentations
├── OPERATIONS/                 ← How-to guides (33 docs)
│   ├── CURRENT_SYSTEM_STATUS.md ← What's working NOW
│   ├── AI_VERIFICATION_PROTOCOL.md ← Testing rules
│   ├── AUTO-SYNC-GUIDE.md      ← Main sync workflow
│   └── DATA_QUALITY_VALIDATION.md ← Validation details
└── TECHNICAL/                  ← Architecture, schema
    ├── TECHNICAL-REFERENCE.md  ← System overview
    ├── VALIDATION_RULES_ARCHITECTURE.md ← Validation rules
    ├── DATABASE_COMPLETE_SCHEMA.md ← All tables
    └── ICLASS_DIRECT_API_REFERENCE.md ← iClass calls the sync makes
```

iClass behavior claims: grep `C:\Users\Jayme\JAYME PROJECTS\SOURCE-OF-TRUTH\iclass-kb\iclasspro-kb.md` and quote the line number.

---

## 🚫 COMMON MISTAKES (Don't repeat these)

1. **Don't say "it should work"** — Test it, then say "I tested it and it works"
2. **Don't skip reading docs** — Jayme spent hours writing them. Read them.
3. **Don't hardcode validation** — All checks come from the `rules` table via `validation_engine.py`.
4. **Don't add prices back** — no price display, lookup or check without her explicit go (see Pricing).
5. **Don't query with another area's codes** — this DB uses AAG / EAG / PLG; AAR / EGF / PGN return 0 rows.
6. **Don't simulate with fake data** — Use actual Supabase data
7. **Don't edit `EventsDashboard.js`** — it's dead; the live file is `EventsDashboard_REFACTORED.js`
8. **Be careful in huge files** — a JSX syntax error in a 4,000-line file once crashed the build

---

## 🔄 SESSION WORKFLOW (Follow this every time)

1. **Read this file** (you're doing it now ✅)
2. **Read `AI_RULES_READ_FIRST.md`** for detailed rules
3. **Read relevant docs + code** before touching anything (search + inspect, never assume)
4. **Make small changes** — test after each one
5. **Update the one doc that owns the behavior** if you change it
6. **Never say "it works" without testing**; deploy only on her go
