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
- **Backend:** Flask + Playwright (Python) → deployed on Railway
- **Database:** Supabase (PostgreSQL)
- **Live URL:** https://teamcalendar.mygymtools.com

**User:** Jayme is a NON-TECHNICAL vibe coder. She communicates through documentation. Read ALL docs before making changes.

---

## 📁 KEY FILES (Where to look first)

| What | File |
|------|------|
| Main UI | `src/components/EventsDashboard.js` (4000+ lines, monolithic) |
| Refactored UI | `src/components/EventsDashboard_REFACTORED.js` (519 lines, modular - NOT yet active) |
| Sub-components | `src/components/EventsDashboard/` folder |
| Admin Dashboard | `src/components/AdminDashboard/AdminDashboard.js` |
| API functions | `src/lib/api.js` |
| Event comparison | `src/lib/eventComparison.js` |
| Validation helpers | `src/lib/validationHelpers.js` |
| Python automation | `automation/f12_collect_and_import.py` (event collection + validation) |
| Flask API server | `automation/local_api_server.py` |
| Supabase config | `src/lib/supabase.js` |

---

## 🔑 KEY CONCEPTS

### Validation System
- **DATA errors** (red) = something is WRONG (mismatch between sources)
- **FORMAT errors** (orange) = something is MISSING (required info not found)
- **Precoded rules** = hardcoded in Python (`f12_collect_and_import.py`)
- **Configurable rules** = per-gym in `gym_valid_values` table in Supabase

### Pricing
- iClass API does NOT provide prices
- **Camp prices:** `camp_pricing` table (we built this)
- **Other prices:** `event_pricing` table with `effective_date` support (we built this Feb 2026)

### Admin Access
- Level 1: Everyone sees calendar
- Level 2: Shift+Click magic wand → Admin Dashboard
- Level 3: Press `*` + PIN `1426` → Super Admin (Quick Actions)

---

## ⚠️ KNOWN BUGS & GAPS (as of Feb 2026)

| Issue | Status | Details |
|-------|--------|---------|
| Export bug (analytics ignoring filters) | ✅ FIXED | `ExportModal.js` now uses `filteredEvents` consistently |
| Time regex false positives | ✅ FIXED | Pre-cleaning for "$62 a day", "Ages 4-13" patterns |
| Day range false positives | ✅ FIXED | "Monday-Friday", "Monday through Friday" now handled |
| Wrong year in DESCRIPTION | ❌ Not fixed | Only checks title for wrong year, not description |
| `program_ignore` rule type | ❌ Not built | Can't ignore "open gym" when it's a station name in KNO |
| `EventsDashboard.js` monolithic | ❌ Not migrated | Refactored version exists but `App.js` still imports the monolithic file |

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
├── OPERATIONS/                 ← How-to guides (16 docs)
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
3. **Don't hardcode values** — Use `gym_valid_values` table for per-gym rules
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

**Last Updated:** February 11, 2026
