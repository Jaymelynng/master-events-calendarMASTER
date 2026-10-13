# Team Calendar - Master Events Hub

Enterprise Event Management Platform for Multi-Location Gymnastics Operations

---

## Live URL

**https://teamcalendar.mygymtools.com**

Part of the **mygymtools.com** suite of tools.

---

## Project Overview

**Production event management system** managing every gym in the `gyms` table (live list — read it; this database still stores the old codes AAG / EAG / PLG).

### Business Impact
- **94% Time Reduction**: 5 hours to 20 minutes per month
- **Revenue Protection**: Zero missed events = $5K-10K annually
- **Accuracy**: <1% error rate (down from 10-15%)
- **Scalability**: Built to handle 50+ locations

### Current Scale
- **Every gym in the `gyms` table** actively managed (count not written here — it grows)
- **400+ Events** in system (428 active + 1,293 archived on 2026-10-13)
- **Real-time** compliance monitoring

---

## Quick Start

### Live App
Visit: **https://teamcalendar.mygymtools.com**

### Local Development
```bash
npm install
npm start
```
App opens at: `http://localhost:3000`

### Environment Setup
Create `.env.local` with:
```
REACT_APP_SUPABASE_URL=[your-supabase-url]
REACT_APP_SUPABASE_ANON_KEY=[your-anon-key]
REACT_APP_API_URL=[your-railway-url]
REACT_APP_API_KEY=[your-api-key]
REACT_APP_ADMIN_PIN=[your-admin-pin]
```

### Build & Test
```bash
npm run build         # Production build
npm test              # Run tests
npm run test:ci       # Run tests without watch mode
npm run test:coverage # Run tests with coverage report
```

---

## Documentation

| Category | Location | Description |
|----------|----------|-------------|
| **Business** | `docs/BUSINESS/` | ROI analysis, presentations |
| **Technical** | `docs/TECHNICAL/` | Architecture, database, validation rules |
| **Operations** | `docs/OPERATIONS/` | How-to guides, sync instructions |

**Start here:** `AI_RULES_READ_FIRST.md` then `docs/INDEX.md`

---

## Key Features

### For Everyone
- Real-time calendar across every gym
- Smart filters by gym and event type
- Click numbers to open registration pages
- Click sparkle to open ALL pages for a gym

### For Admins (Shift+Click magic wand)
- **🚨 Errors** - Errors Command Center: per gym / per topic / totals, dismiss or make a rule
- **🗂️ Buckets** - Map iClass camp types to calendar categories (`event_type_mappings`)
- **Gym Rules** - Rule Wizard for validation rules, synonyms, exceptions, plus system-check toggles
- **✉️ Contacts** - Manager contacts
- **Change History** - Full audit log with filters and CSV export
- **Future Plans** - Track planned features, bugs, improvements
- **Quick Actions** - Sync, import, super admin tools
- **Email Composer** - Generate emails to gym managers about missing events and data errors

### Data Quality (Database-Driven Checks — 10 active rows in `rules` on 2026-10-13)
- Date, time, age, day, year mismatch detection
- Program type cross-contamination detection
- Title vs description contradiction detection
- Ordinal typo + registration-closes-before-last-day detection
- Impossible date detection (e.g., June 31)
- No price checks — all pricing removed October 2, 2026
- Dismiss errors with permanent rules or temporary overrides
- All checks configurable per-gym via the `rules` table

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Lucide Icons |
| **Backend API** | Flask + Direct HTTP API (Python) |
| **Database** | Supabase (PostgreSQL) |
| **Frontend Hosting** | Vercel |
| **API Hosting** | Railway |
| **Domain** | teamcalendar.mygymtools.com |

---

## Deployment Architecture

| Service | Platform | Notes |
|---------|----------|-------|
| **Frontend** | Vercel | Auto-deploys from GitHub main branch |
| **API Server** | Railway | Flask server, auto-deploys from GitHub main branch |
| **Database** | Supabase | PostgreSQL with real-time subscriptions |

---

## Project Structure

```
master-events-calendar/
├── src/
│   ├── components/
│   │   ├── EventsDashboard_REFACTORED.js # Main calendar UI (EventsDashboard.js = dead code)
│   │   ├── EventsDashboard/            # Sub-components
│   │   │   ├── SyncModal.js            # Sync workflow
│   │   │   ├── ExportModal.js          # Export options
│   │   │   ├── EventDetailPanel.js     # Event details slide-out
│   │   │   ├── EventCard.js            # Calendar event cards
│   │   │   ├── CalendarGrid.js         # Month grid view
│   │   │   ├── TableView.js            # Table view
│   │   │   ├── AdminPortalModal.js     # Admin portal
│   │   │   ├── DismissRuleModal.js     # Error dismiss workflow
│   │   │   ├── MonthlyRequirementsTable.js
│   │   │   ├── BulkImportModal.js
│   │   │   ├── AddEventModal.js
│   │   │   └── constants.js            # Theme colors, helpers
│   │   └── AdminDashboard/             # Admin panel (7 tabs)
│   │       ├── AdminDashboard.js       # Tab orchestrator
│   │       ├── AdminErrorsCenter.js    # Errors tab
│   │       ├── AdminBuckets.js         # Buckets tab
│   │       ├── AdminGymRules.js        # Gym Rules tab
│   │       ├── AdminContacts.js        # Contacts tab
│   │       ├── AdminChangeHistory.js   # Change History tab
│   │       ├── AdminFuturePlans.js     # Future Plans tab
│   │       ├── AdminQuickActions.js    # Quick Actions tab
│   │       ├── AdminFormatRules.js
│   │       ├── RuleManager.js
│   │       ├── RuleWizard.js           # Rule creation wizard
│   │       └── EmailComposer.js        # Email generation
│   └── lib/
│       ├── api.js                      # Supabase API functions
│       ├── supabase.js                 # Supabase client config
│       ├── eventComparison.js          # Sync comparison logic
│       ├── validationHelpers.js        # Error categorization
│       ├── syncApi.js                  # Railway API communication
│       ├── cache.js                    # Caching layer
│       ├── useRealtimeEvents.js        # Real-time subscriptions
│       ├── gymLinksApi.js              # Gym URL management
│       └── collectAllGyms.js           # Multi-gym sync
├── automation/
│   ├── f12_collect_and_import.py       # Event collection (Direct HTTP API)
│   ├── validation_engine.py           # Database-driven validation engine
│   ├── local_api_server.py            # Flask API server
│   ├── requirements.txt
│   ├── railway.json
│   └── Procfile
├── docs/                               # 32+ documentation files
│   ├── INDEX.md
│   ├── BUSINESS/
│   ├── TECHNICAL/
│   └── OPERATIONS/
├── database/                           # SQL migration scripts
├── data/                               # Raw pricing data (unused since pricing removal 2026-10-02)
├── LOGOS/                              # Gym brand logos
├── AI_RULES_READ_FIRST.md             # AI agent instructions
└── CLAUDE.md                          # Quick-start guide
```

---

## Access Levels

| Level | How | Features |
|-------|-----|----------|
| **Everyone** | Visit URL | Calendar, event details, filters |
| **Admin** | Shift+Click magic wand | Admin Dashboard (7 tabs + Email) |
| **Super Admin** | Press * + PIN | Quick Actions, Supabase/Railway links |

---

## Validation System

All validation is **database-driven** via the `rules` table. The Python backend (`validation_engine.py`) reads active checks from the database — no hardcoded validation logic.

**System Checks (10 active on 2026-10-13):** date, year, time, age, day, program, title/description, impossible date, ordinal typo, registration closes early

**Pricing Note:** All pricing removed October 2, 2026 — the calendar sets, shows, exports and checks no price. `camp_pricing` / `event_pricing` still exist but nothing reads them.

**Rule Types:** System checks, valid times, program synonyms, program ignore, requirement exceptions, one-time exceptions.

---

## mygymtools.com Suite

| Tool | URL | Purpose |
|------|-----|---------|
| **Main Hub** | mygymtools.com | Landing page |
| **Team Calendar** | teamcalendar.mygymtools.com | Event management |
| **Bulk Link Pro** | bulklinkpro.com | Link management |
| **Bio Page** | ourbiopage.com | Bio links |

---

## Support

- **Docs:** `docs/` folder (start with `AI_RULES_READ_FIRST.md`)
- **Issues:** Check browser console (F12)
- **Database:** Supabase dashboard
- **API:** Railway dashboard

---

**Last Updated:** April 7, 2026
**Live URL:** https://teamcalendar.mygymtools.com
**Owner:** Jayme Gibson - Rise Athletics
