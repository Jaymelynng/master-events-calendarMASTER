# Current System Status

**Last Updated:** February 17, 2026

---

## Deployment Status

| Component | Status | URL / Details |
|-----------|--------|---------------|
| **Frontend** | ✅ Live | https://teamcalendar.mygymtools.com |
| **Backend API** | ✅ Live | Railway (Flask + Playwright) |
| **Database** | ✅ Live | Supabase (PostgreSQL) |
| **Build** | ✅ Passing | ESLint warnings only, no errors |

**Tech Stack:** React 18 + Tailwind CSS (Vercel) | Flask + Playwright (Railway) | Supabase (PostgreSQL)

---

## What's Working

### Core Features
- **Calendar Display** — All 10 gyms, ~400 events, filterable by gym/type/date
- **Automated Sync** — Sync events from iClassPro portals via Playwright browser automation
- **Sync All Gyms** — One-click sync + auto-import for all 10 gyms (sequential, ~50-60 min total)
- **Event Comparison** — Detects new, changed, unchanged, and deleted events on each sync
- **Auto-Import** — Inserts new, updates changed, refreshes validation on unchanged, soft-deletes removed
- **Real-time Updates** — Supabase subscriptions push changes to all connected browsers

### Event Types Supported
`KIDS NIGHT OUT` | `CLINIC` | `OPEN GYM` | `CAMP` | `SPECIAL EVENT`

### Data Validation (11 DATA + 8 FORMAT error types)
- **DATA errors (red)** — Something is WRONG (mismatch between title, description, and portal data)
- **FORMAT errors (orange)** — Something is MISSING (required info not found in title/description)
- **Precoded rules** — Hardcoded in Python (`f12_collect_and_import.py`)
- **Configurable rules** — Per-gym in `gym_valid_values` table (program synonyms, price exceptions, time exceptions)

### Admin Dashboard Tabs
| Tab | What It Does |
|-----|-------------|
| **Audit & Review** | View validation errors by gym, filter by error type, dismiss/acknowledge errors, add rules |
| **Gym Rules** | Manage per-gym validation rules (program synonyms, valid prices, time exceptions) |
| **Pricing** | Manage camp_pricing and event_pricing tables |
| **Change History** | View all CREATE/UPDATE/DELETE audit entries with gym and action filters, pagination, CSV export |
| **Quick Actions** | Sync, super admin tools, links to other tabs |

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

---

## Database Tables

| Table | Purpose | ~Rows |
|-------|---------|-------|
| `events` | Active/future events | ~400 |
| `events_archive` | Past events (auto-archived at midnight) | Growing |
| `gyms` | 10 gymnastics facilities | 10 |
| `gym_links` | iClassPro portal URLs per gym | ~76 |
| `gym_valid_values` | Per-gym validation rules | Variable |
| `camp_pricing` | Camp price lookup | Per gym |
| `event_pricing` | Non-camp price lookup (with effective_date) | Per gym/type |
| `event_audit_log` | All CREATE/UPDATE/DELETE changes | Growing |
| `sync_log` | Sync progress tracking per gym/type | ~50 |

**Views:** `events_with_gym` (UNION ALL of events + archive), `gym_links_detailed`

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
| Wrong year in DESCRIPTION | ❌ Not fixed | Validation only checks title for wrong year, not description |
| `program_ignore` rule type | ❌ Not built | Can't ignore "open gym" when it's a station name in KNO events |
| EventsDashboard.js monolithic | ❌ Not migrated | Refactored version exists (519 lines) but `App.js` still imports old 4000+ line file |
| Flyer-only events | ⚠️ Limitation | Can't validate events that only have an image flyer, no text |
| Sync All Gyms speed | ⚠️ Slow | Takes ~50-60 min for all 10 gyms (Playwright scraping bottleneck, not app issue) |

---

## Recent Fixes & Additions (Feb 2026)

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
| Change History | `src/components/AdminDashboard/AdminChangeHistory.js` |
| Sync Modal | `src/components/EventsDashboard/SyncModal.js` |
| API functions | `src/lib/api.js` |
| Event comparison | `src/lib/eventComparison.js` |
| Validation helpers | `src/lib/validationHelpers.js` |
| Python automation | `automation/f12_collect_and_import.py` |
| Flask API server | `automation/local_api_server.py` |
| Auto-archive docs | `docs/OPERATIONS/AUTO_ARCHIVE_SYSTEM.md` |
| Full schema | `docs/TECHNICAL/DATABASE_COMPLETE_SCHEMA.md` |
