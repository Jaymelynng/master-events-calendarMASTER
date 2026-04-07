# Team Calendar - Master Events Hub

Enterprise Event Management Platform for Multi-Location Gymnastics Operations

---

## Live URL

**https://teamcalendar.mygymtools.com**

Part of the **mygymtools.com** suite of tools.

---

## Project Overview

**Production event management system** managing 10 gymnastics facilities across Texas and Arizona.

### Business Impact
- **94% Time Reduction**: 5 hours to 20 minutes per month
- **Revenue Protection**: Zero missed events = $5K-10K annually
- **Accuracy**: <1% error rate (down from 10-15%)
- **Scalability**: Built to handle 50+ locations

### Current Scale
- **10 Facilities** actively managed (6 Texas, 4 Arizona)
- **400+ Events** in system
- **2 States** (TX, AZ)
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
npm test              # Run tests (97 tests)
npm run test:ci       # Run tests without watch mode
npm run test:coverage # Run tests with coverage report
```

---

## Documentation

| Category | Location | Description |
|----------|----------|-------------|
| **Business** | `docs/BUSINESS/` | ROI analysis, presentations |
| **Technical** | `docs/TECHNICAL/` | Architecture, database, validation rules |
| **Operations** | `docs/OPERATIONS/` | How-to guides, sync instructions (21 docs) |

**Start here:** `AI_RULES_READ_FIRST.md` then `docs/INDEX.md`

---

## Key Features

### For Everyone
- Real-time calendar across all 10 gyms
- Smart filters by gym and event type
- Click numbers to open registration pages
- Click sparkle to open ALL pages for a gym

### For Admins (Shift+Click magic wand)
- **Audit & Review** - View/filter/dismiss validation errors
- **Pricing** - Manage camp and event pricing tables
- **Gym Rules** - Rule Wizard for validation rules, synonyms, exceptions
- **Change History** - Full audit log with filters and CSV export
- **Audit Rules** - Reference table of all 11 validation checks
- **Future Plans** - Track planned features, bugs, improvements
- **Quick Actions** - Sync, import, super admin tools
- **Email Composer** - Generate emails to gym managers about missing events and data errors

### Data Quality (11 Database-Driven Checks)
- Date, time, age, day, year mismatch detection
- Program type cross-contamination detection
- Title vs description contradiction detection
- Camp price validation against pricing table
- Event price validation against pricing table (with effective dates)
- Impossible date detection (e.g., June 31)
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
│   │   ├── EventsDashboard.js          # Main calendar UI
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
│   │       ├── AdminAuditReview.js     # Audit & Review tab
│   │       ├── AdminGymRules.js        # Gym Rules tab
│   │       ├── AdminPricing.js         # Pricing tab
│   │       ├── AdminChangeHistory.js   # Change History tab
│   │       ├── AdminAuditRulesReference.js
│   │       ├── AdminFuturePlans.js     # Future Plans tab
│   │       ├── AdminQuickActions.js    # Quick Actions tab
│   │       ├── RuleWizard.js           # Rule creation wizard
│   │       ├── EmailComposer.js        # Email generation
│   │       ├── AdminAuditFilters.js
│   │       └── AdminAuditErrorCard.js
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
├── data/                               # Raw pricing data
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

**11 System Checks:** date, year, time, age, day, program, title/description, impossible date, price, camp price, event price

**Pricing Note:** iClassPro does NOT provide prices via their API. We built custom pricing tables (`camp_pricing` and `event_pricing` with effective date support).

**Rule Types:** System checks, valid prices, sibling prices, valid times, program synonyms, requirement exceptions, one-time exceptions.

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
