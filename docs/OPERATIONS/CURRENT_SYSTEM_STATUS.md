# Current System Status

**Last Updated:** May 7, 2026

---

## Deployment Status

| Component | Status | URL / Details |
|-----------|--------|---------------|
| **Frontend** | ✅ Live | https://teamcalendar.mygymtools.com |
| **Backend API** | ✅ Live | Railway (Flask + Direct API, Playwright fallback) |
| **Database** | ✅ Live | Supabase (PostgreSQL) |
| **Build** | ✅ Passing | ESLint warnings only, no errors |

**Tech Stack:** React 18 + Tailwind CSS (Vercel) | Flask + Direct API (Railway) | Supabase (PostgreSQL)

---

## What's Working

### Core Features
- **Calendar Display** — All 10 gyms, ~400 events, filterable by gym/type/date
- **Automated Sync** — Sync events from iClassPro via direct HTTP API calls (replaced Playwright Mar 2026)
- **Sync All Gyms** — One-click sync + auto-import for all 10 gyms (sequential, ~5 min total)
- **Event Comparison** — Detects new, changed, unchanged, and deleted events on each sync
- **Auto-Import** — Inserts new, updates changed, refreshes validation on unchanged, soft-deletes removed
- **Real-time Updates** — Supabase subscriptions push changes to all connected browsers

### Event Types Supported
`KIDS NIGHT OUT` | `CLINIC` | `OPEN GYM` | `CAMP` | `SPECIAL EVENT`

### Data Validation (11 check rules, all database-driven)
- **DATA errors (red)** — Something is WRONG (mismatch between title, description, and portal data)
- **All checks come from `rules` table** — executed by `validation_engine.py`, zero hardcoded validation in Python
- **User rules** (valid_price, valid_time, exception, etc.) also in the `rules` table
- **Format errors were never implemented** — the old toggle was dead code, now removed

### Admin Dashboard Tabs (7 tabs) + Email Button
| Tab | What It Does |
|-----|-------------|
| **Audit & Review** | View validation errors by gym, filter by error type/month/program, dismiss/acknowledge errors, verify accuracy, update prices |
| **Pricing** | Manage event_pricing (Clinic/KNO/Open Gym with effective dates) and view camp_pricing |
| **Gym Rules** | Unified rules system: permanent/temporary rules, keyword pricing, sibling pricing, program synonyms, requirement exceptions. 5-step Rule Wizard. |
| **Change History** | View all CREATE/UPDATE/DELETE audit entries with gym and action filters, pagination, CSV export |
| **Audit Rules** | Reference table of all validation checks (all database-driven via rules table). Filterable by section and source type. |
| **Future Plans** | Track planned features, improvements, bugs, and ideas. Add/edit/delete with category, priority, status, and target area. Both Jayme and AI sessions can add entries. |
| **Quick Actions** | Automated Sync, JSON Import, super admin links to Supabase/Railway dashboards |
| **Email Managers** (button) | Generate emails for managers about missing events and/or data errors. Preview per gym, open directly in Outlook. |

### Main Dashboard Features
- **Requirement status tracking** — Click any red "Missing" badge to add a status note (In Progress / Late / Excused) with manager response
- **Requirement exceptions** — Excused gyms show blue "Excused" status instead of red "Missing"
- **Status notes** — Yellow badges indicate acknowledged missing items with notes visible on hover

### Export System
- CSV and JSON export from calendar view
- Respects all active filters (gym, type, date range)
- Accessible from admin dashboard

### Auto-Archive System
- **pg_cron job** runs at midnight every night
- Moves events where `date < today` from `events` to `events_archive`
- Calendar still shows past events via `events_with_gym` UNION ALL view
- Archive kept indefinitely (no retention limit)
- Documented in `docs/OPERATIONS/AUTO_ARCHIVE_SYSTEM.md`

### Pricing System
- **iClassPro does NOT provide prices** via their portal
- **Camp prices:** `camp_pricing` table (full_day_daily, full_day_weekly, half_day_daily, half_day_weekly)
- **Other prices:** `event_pricing` table with `effective_date` support (added Feb 2026)
- Prices are parsed from event title/description and compared against these tables

### Openings / Capacity (April 26, 2026)
- **Spot count on every event card** — `🟢 23` (green = 4+ open), `⚠️ 2` (orange = 1-3 left), `🔴 FULL` badge top-left when 0
- **Source:** iClassPro `/api/open/v1/{slug}/camps/{id}` — `openings`, `openingsDisplay`, `showOpenings` fields
- **All 10 gyms send the integer** — verified live; no iClass settings to change
- **Total capacity NOT available** — iClass `maxStudents` is always null. No "23/40" fraction format possible without manual entry.
- **CSV export:** new `Spots Left` and `Openings Display` columns
- **Time was removed from cards** in the same update — accessible via hover tooltip, Table View, side panel
- **Full doc:** `docs/OPERATIONS/OPENINGS_CAPACITY_FEATURE.md`

### Calendar Visual Overhaul (NEW May 7, 2026 — PR #16)
- **Multi-day camps as long-narrow variant bars** — `src/components/EventsDashboard/CampBand.js` renders one bar per camp variant (Gym Full / Gym Half / Ninja Full / Ninja Half) spanning the actual camp days, instead of repeating the same boxy CAMP card on every day. Capacity status shown per variant.
- **Brand-tinted gym row identity** — GymCell uses `theme.colors.secondary` (rose pink, same as the calendar header) + soft right shadow + 2px dusty-rose row divider so each gym row is visually distinct.
- **Side panel re-order** — Registration Options (View / Copy / Edit buttons) moved to the top, right after the event title — no more scrolling past description and flyer to register.
- **Admin Monthly Requirements bar (top of admin dashboard)** — live add / edit / remove of compliance categories with hex paste color picker; writes directly to `monthly_requirements` and `event_types.color`. Auto-propagates colors to admin pill, summary card, per-gym table, calendar event cards, side panel, table view.
- **BulkPortalOpener** — grouped 3-card layout (General / School Year / Summer); Monthly Requirements summary card placed beside it to save vertical space.
- **Database fixes** — `monthly_requirements` table got the missing FOR ALL RLS policy (writes were failing silently). 3 RLS gaps closed on `sync_log`, `camp_pricing_map`, `extractors`. SQL files committed for both — `database/CREATE_MONTHLY_REQUIREMENTS_TABLE.sql` + `database/ENABLE_RLS_ON_UNGUARDED_TABLES.sql`.

### Color Source of Truth (May 7, 2026)
- All event-type colors now flow from one place: **`event_types.color` column in Supabase**
- Change a color in Admin → Monthly Requirements bar → it propagates to: admin pill, calendar summary card, per-gym table count cells, calendar event cards, event detail side panel header, table view
- `hexToPastelHex` helper in `src/components/EventsDashboard/constants.js` mixes 18% saturated color + 82% white so the bright hex saved in the DB renders as a soft pastel tint suitable for cell backgrounds
- The hex paste popover (replacing Chrome's native RGB picker) lives in `AdminDashboard.js` — paste a hex, hit Enter, done
- Current values in DB: CLINIC `#b99396` (rose), KIDS NIGHT OUT `#d5a36d` (tan), OPEN GYM `#6e936f` (sage)

---

## Database Tables

| Table | Purpose | ~Rows |
|-------|---------|-------|
| `events` | Active/future events | ~400 |
| `events_archive` | Past events (auto-archived at midnight) | Growing |
| `gyms` | 10 gymnastics facilities | 10 |
| `gym_links` | iClassPro portal URLs per gym | ~76 |
| ~~`gym_valid_values`~~ | DROPPED — migrated to `rules` table | N/A |
| `camp_pricing` | Camp price lookup | Per gym |
| `event_pricing` | Non-camp price lookup (with effective_date) | Per gym/type |
| `event_audit_log` | All CREATE/UPDATE/DELETE changes | Growing |
| `sync_log` | Sync progress tracking per gym/type | ~50 |
| `rules` | All validation rules — 11 system checks + user rules (valid_price, valid_time, exception, etc.) | 17 |
| `requirement_notes` | Status tracking for missing requirements | Variable |
| `future_plans` | Planned features, improvements, ideas (Admin Dashboard) | Variable |

**Views:** `events_with_gym` (UNION ALL of events + archive), `gym_links_detailed`

**Functions:** `archive_single_event(UUID)` — auto-archives deleted events on detection

---

## Admin Access Tiers

| Level | How to Access | What You See |
|-------|--------------|-------------|
| **Level 1** | Visit the URL | Calendar only |
| **Level 2** | Shift+Click magic wand | Full Admin Dashboard |
| **Level 3** | Press `*` then enter PIN `1426` | Super Admin (Quick Actions) |

---

## Known Issues & Gaps

| Issue | Status | Details |
|-------|--------|---------|
| Wrong year in DESCRIPTION | ✅ Fixed Mar 5 | Now checks both title AND description for wrong year (first 300 chars, handles multi-year spanning events) |
| `program_ignore` rule type | ❌ Not built | Can't ignore "open gym" when it's a station name in KNO events |
| EventsDashboard.js monolithic | ✅ Fixed | Refactored version now active in `App.js` |
| Flyer-only events | ⚠️ Limitation | Can't validate events that only have an image flyer, no text |
| Sync All Gyms speed | ✅ Fixed Mar 9 | Replaced Playwright with Direct HTTP API — now ~5 min for all 10 gyms (was ~10 min) |
| Database view conflicts | ⚠️ Fixed Feb 23 | 4 different SQL files had conflicting view definitions. `CREATE_EVENTS_WITH_GYM_VIEW.sql` is now the canonical source of truth with ALL columns. |
| Schema doc incomplete | ⚠️ Outdated | `DATABASE_COMPLETE_SCHEMA.md` missing 3 tables: `event_pricing`, `camp_pricing`, `acknowledged_patterns` |
| Day abbreviations not checked | ❌ Not fixed | Validation checks full day names but `day_abbrevs` variable is defined and never used in Python |
| CORS wide open on backend | ⚠️ Risk | `CORS(app)` allows all origins. Should restrict to Vercel domain. |

---

## Recent Fixes & Additions (Feb–Mar 2026)

| What | Status |
|------|--------|
| Export bug (analytics ignoring filters) | ✅ Fixed |
| Time regex false positives ("$62 a day", "Ages 4-13") | ✅ Fixed |
| Day range false positives ("Monday-Friday") | ✅ Fixed |
| Event pricing table with effective_date | ✅ Added |
| Price validation for non-camp events (CCP, CPF) | ✅ Fixed |
| GYMS dict made database-driven (sellability) | ✅ Done |
| Change History tab in Admin Dashboard | ✅ Added |
| Sync All Gyms button | ✅ Added |
| **Export CSV now shows Start Date + End Date** | ✅ Fixed Feb 23 |
| **Sync All: cross-type false deletion bug** | ✅ Fixed Feb 23 |
| **Sync All: failed types no longer count as "checked"** | ✅ Fixed Feb 23 |
| **Admin pricing/rules: stale closure state bugs** | ✅ Fixed Feb 23 |
| **Admin audit: missing props in single-gym view** | ✅ Fixed Feb 23 |
| **Change History: pagination out-of-bounds** | ✅ Fixed Feb 23 |
| **Canonical DB view file updated with ALL columns** | ✅ Fixed Feb 23 |
| **Special Events skip all validation** | ✅ Added Feb 23 |
| **Deleted events auto-archive on detection** | ✅ Added Feb 23 |
| **Unified rules system (replaces gym_valid_values)** | ✅ Added Feb 23 |
| **Rule Wizard (permanent/temp, per-gym, keyword, sibling pricing)** | ✅ Added Feb 23 |
| **Requirement exceptions (excused from monthly requirements)** | ✅ Added Feb 23 |
| **Requirement status notes (In Progress/Late/Excused)** | ✅ Added Feb 23 |
| **Email composer (generate + Open in Outlook)** | ✅ Added Feb 23 |
| **Manager contacts stored in gyms table** | ✅ Added Feb 23 |
| **iClassPro direct API fully mapped** | ✅ Documented Feb 23 |
| **Wrong year in DESCRIPTION now validated** | ✅ Fixed Mar 5 |
| **Audit Rules Reference tab in Admin Dashboard** | ✅ Added Mar 5 |
| **Future Plans tab in Admin Dashboard** | ✅ Added Mar 5 |
| **future_plans Supabase table + API** | ✅ Added Mar 5 |
| **Gym pricing data collection started (EST, CCP)** | ✅ Started Feb 23 |
| **Direct HTTP API replaces Playwright for event collection** | ✅ Swapped Mar 9 |
| **Sync All Gyms: ~5 min (was ~10 min with Playwright)** | ✅ Fixed Mar 9 |
| **Playwright kept as fallback (USE_DIRECT_API=false)** | ✅ Added Mar 9 |
| **Database-driven validation engine (validation_engine.py)** | ✅ Added Mar 17 |
| **f12_collect_and_import.py reduced from 2417 to 1562 lines** | ✅ Cleaned Mar 17 |
| **Format error dead code removed (never generated by Python)** | ✅ Fixed Mar 17 |
| **Dead gymValidValuesApi removed from api.js** | ✅ Fixed Mar 17 |
| **Broken formatting_error_count in CSV export fixed** | ✅ Fixed Mar 17 |
| **gym_valid_values table fully dropped from database** | ✅ Done Mar 17 |
| **Legacy naming cleanup (GYM_VALID_VALUES → RULES_CACHE)** | ✅ Done Mar 17 |
| **AdminAuditRulesReference: "Year in description" gap → Fixed** | ✅ Updated Mar 17 |
| **Openings/spots-remaining count captured + displayed** | ✅ Apr 26 |
| **CSV export: Spots Left + Openings Display columns** | ✅ Apr 26 |
| **Time removed from event cards (compact layout)** | ✅ Apr 26 |
| **`pricing_supabase.py` added to git (was untracked, broke Railway)** | ✅ Apr 26 |

---

## Verification System

Events have two verification-related columns that **survive re-syncs**:
- `verified_errors` — Manual accuracy markings (OK / Bug / Accurate)
- `acknowledged_errors` — Dismissed validation errors with optional notes

These columns are **never touched by sync/import code**, so markings persist even after re-syncing.

---

## Key Files Quick Reference

| What | File |
|------|------|
| Main UI | `src/components/EventsDashboard.js` (4000+ lines) |
| Admin Dashboard | `src/components/AdminDashboard/AdminDashboard.js` |
| Audit & Review | `src/components/AdminDashboard/AdminAuditReview.js` |
| Gym Rules (unified) | `src/components/AdminDashboard/AdminGymRules.js` |
| Rule Wizard | `src/components/AdminDashboard/RuleWizard.js` |
| Email Composer | `src/components/AdminDashboard/EmailComposer.js` |
| Change History | `src/components/AdminDashboard/AdminChangeHistory.js` |
| Sync Modal | `src/components/EventsDashboard/SyncModal.js` |
| Export Modal | `src/components/EventsDashboard/ExportModal.js` |
| API functions | `src/lib/api.js` |
| Event comparison | `src/lib/eventComparison.js` |
| Validation helpers | `src/lib/validationHelpers.js` |
| Validation engine | `automation/validation_engine.py` (database-driven — all checks from rules table) |
| Python automation | `automation/f12_collect_and_import.py` (Direct API + Playwright fallback, calls validation_engine) |
| Flask API server | `automation/local_api_server.py` |
| Direct API test script | `automation/test_direct_api.py` (read-only, safe to run anytime) |
| API vs Supabase comparison | `automation/test_compare_supabase.py` (read-only dry-run comparison) |
| Auto-archive docs | `docs/OPERATIONS/AUTO_ARCHIVE_SYSTEM.md` |
| iClassPro API map | `docs/TECHNICAL/ICLASS_DIRECT_API_REFERENCE.md` |
| Pricing raw data | `data/gym-pricing-raw/` |
| Full schema | `docs/TECHNICAL/DATABASE_COMPLETE_SCHEMA.md` |

## Rules System

The unified `rules` table is the single source of truth for ALL validation. The old `gym_valid_values` table has been dropped. System check rules (check_*) drive the validation engine; user rules are managed through the Rule Wizard in the Gym Rules tab.

**Rule Types:**
| Type | What it does |
|------|-------------|
| `valid_price` | This price is valid for this program at this gym |
| `sibling_price` | Per-kid pricing (kid 1, kid 2, kid 3) |
| `valid_time` | This time is valid (e.g., before care at 8:30 AM) |
| `program_synonym` | This name means a specific program (e.g., "Gym Fun Friday" = KNO) |
| `requirement_exception` | Gym is excused from a monthly requirement |
| `exception` | One-time exception for a specific event |

**Rule Wizard asks 2 questions for requirement exceptions:**
1. Which gym + which requirement?
2. What month + why?

**Rule Wizard asks 5 questions for validation rules:**
1. Permanent or temporary?
2. Which gym(s)?
3. Which program?
4. All events or keyword match?
5. What's the rule?
