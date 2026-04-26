# 📚 Team Calendar - Documentation Index

**Live URL:** https://teamcalendar.mygymtools.com  
**Last Updated:** April 8, 2026
**Part of:** mygymtools.com suite
**Maintained by:** Jayme

---

> **⚠️ When in doubt, trust the code.** Docs can lag behind. Key logic: `src/`, `automation/`, `database/`.
>
> **AI:** Read [AI_VERIFICATION_PROTOCOL.md](OPERATIONS/AI_VERIFICATION_PROTOCOL.md) before verifying — never assume without testing.

---

## 🗂️ Documentation Structure

```
docs/
├── INDEX.md                    ← You are here
├── BUSINESS/                   ← Executive presentations, ROI
│   ├── BOSS-PRESENTATION.md
│   └── GYM_DATA_IMPROVEMENTS.md
├── OPERATIONS/                 ← How-to guides, daily use
│   ├── AUTO-SYNC-GUIDE.md      ⭐ Main workflow
│   ├── SYNC-QUICK-REFERENCE.md ⭐ Quick reference
│   ├── SECRET_ADMIN_MODE.md    ⭐ Admin access
│   └── ... (19 more guides)
└── TECHNICAL/                  ← Architecture, code details
    ├── TECHNICAL-REFERENCE.md  ⭐ Master overview
    ├── DATABASE_COMPLETE_SCHEMA.md
    ├── SCALABILITY-ROADMAP.md
    └── SYNC_SYSTEM_TECHNICAL.md
```

---

## 🏆 BUSINESS Documents

**For:** Investors, stakeholders, executives, presentations

| Document | Purpose |
|----------|---------|
| **[BOSS-PRESENTATION.md](BUSINESS/BOSS-PRESENTATION.md)** ⭐ | ROI analysis, business value, pitch deck |
| [GYM_DATA_IMPROVEMENTS.md](BUSINESS/GYM_DATA_IMPROVEMENTS.md) | Missing gym contact info, placeholder URLs |

---

## 🔧 TECHNICAL Documents

**For:** Developers, system architects, technical planning

| Document | Purpose |
|----------|---------|
| **[TECHNICAL-REFERENCE.md](TECHNICAL/TECHNICAL-REFERENCE.md)** ⭐ | Complete system overview - START HERE for technical |
| **[VALIDATION_RULES_ARCHITECTURE.md](TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md)** ⭐ | Precoded vs configurable rules - CRITICAL for selling |
| **[DESIGN_COLOR_SCHEME.md](TECHNICAL/DESIGN_COLOR_SCHEME.md)** | Event-type colors, shadows, Admin styling — use across all UI |
| [DATABASE_COMPLETE_SCHEMA.md](TECHNICAL/DATABASE_COMPLETE_SCHEMA.md) | Tables, views, design decisions, SQL commands |
| [SCALABILITY-ROADMAP.md](TECHNICAL/SCALABILITY-ROADMAP.md) | Future scaling plan |
| [SYNC_SYSTEM_TECHNICAL.md](TECHNICAL/SYNC_SYSTEM_TECHNICAL.md) | Sync system technical details |

---

## 📋 OPERATIONS Documents

**For:** Daily use, training, troubleshooting

### Core Workflow Guides

| Document | Purpose |
|----------|---------|
| **[CURRENT_SYSTEM_STATUS.md](OPERATIONS/CURRENT_SYSTEM_STATUS.md)** ⭐ | What's working NOW — read this first |
| **[AUTO-SYNC-GUIDE.md](OPERATIONS/AUTO-SYNC-GUIDE.md)** ⭐ | Main sync workflow (SYNC ALL!) |
| **[SYNC-QUICK-REFERENCE.md](OPERATIONS/SYNC-QUICK-REFERENCE.md)** ⭐ | Non-technical quick reference |
| **[SECRET_ADMIN_MODE.md](OPERATIONS/SECRET_ADMIN_MODE.md)** ⭐ | 3-tier admin access (PIN set via env var) |
| [F12-IMPORT-GUIDE.md](OPERATIONS/F12-IMPORT-GUIDE.md) | Backup manual import method |

### System Features

| Document | Purpose |
|----------|---------|
| **[EXPORT_DATA_GUIDE.md](OPERATIONS/EXPORT_DATA_GUIDE.md)** ⭐ | Export, reports, presets (CSV/JSON/HTML) |
| [AUTO_ARCHIVE_SYSTEM.md](OPERATIONS/AUTO_ARCHIVE_SYSTEM.md) | Automatic event archiving |
| [AUDIT-SYSTEM.md](OPERATIONS/AUDIT-SYSTEM.md) | Change tracking / audit history |
| [DATA_QUALITY_VALIDATION.md](OPERATIONS/DATA_QUALITY_VALIDATION.md) | Automatic data validation + per-gym rules |
| **[PRICING_SOURCE_OF_TRUTH.md](OPERATIONS/PRICING_SOURCE_OF_TRUTH.md)** | Contract: `camp_pricing` / `event_pricing` / `rules` for price checks |
| [PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md](OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md) | Roadmap: other sports + AI-assisted org setup (planned) |
| **[AUDIT_DATA_ERROR_REFERENCE.md](OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md)** ⭐ | What gets compared for each DATA error — source of truth explained |
| **[OPENINGS_CAPACITY_FEATURE.md](OPERATIONS/OPENINGS_CAPACITY_FEATURE.md)** ⭐ NEW | Spot-count tracking — iClass API discovery, card display, CSV export, layout decisions |
| [EMBEDDED_RULES_TRANSLATION.md](OPERATIONS/EMBEDDED_RULES_TRANSLATION.md) | Plain-language audit flow: iClass → title → description → cross-check; maps informal names to `type` |

### Technical Operations

| Document | Purpose |
|----------|---------|
| [ADMIN_DATA_FLOW.md](OPERATIONS/ADMIN_DATA_FLOW.md) | Admin dashboard data flow and architecture |
| [DEPLOYMENT_PLAN.md](OPERATIONS/DEPLOYMENT_PLAN.md) | Deployment architecture & checklists |
| [LOCAL_DEVELOPMENT_GUIDE.md](OPERATIONS/LOCAL_DEVELOPMENT_GUIDE.md) | Running app locally |
| [MAINTENANCE_GUIDE.md](OPERATIONS/MAINTENANCE_GUIDE.md) | Weekly/monthly maintenance tasks |
| [EVENT_COMPARISON_LOGIC.md](OPERATIONS/EVENT_COMPARISON_LOGIC.md) | How NEW/CHANGED/DELETED works |

### Reference & History

| Document | Purpose |
|----------|---------|
| [BULK-IMPORT-LEARNINGS.md](OPERATIONS/BULK-IMPORT-LEARNINGS.md) | Historical lessons learned |
| [CAMP_COMPLEXITY_MASTER_GUIDE.md](OPERATIONS/CAMP_COMPLEXITY_MASTER_GUIDE.md) | Camp data structure variations |
| [AI_VERIFICATION_PROTOCOL.md](OPERATIONS/AI_VERIFICATION_PROTOCOL.md) | Rules for AI testing |
| [HOW_TO_RUN_TESTS.md](OPERATIONS/HOW_TO_RUN_TESTS.md) | Running the test suite |
| [DOCUMENTATION_AUDIT_FEB2026.md](OPERATIONS/DOCUMENTATION_AUDIT_FEB2026.md) | Feb 2026 documentation cleanup audit |

---

## 🎯 Quick Reference: Which Doc Should I Read?

| I need to... | Read this |
|--------------|-----------|
| **Sell or present the project** | `BUSINESS/BOSS-PRESENTATION.md` |
| **Understand how it works technically** | `TECHNICAL/TECHNICAL-REFERENCE.md` |
| **Understand precoded vs configurable rules** | `TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md` |
| **See what each DATA error compares** | `OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md` |
| **Understand truth vs title/description consistency** | `OPERATIONS/EMBEDDED_RULES_TRANSLATION.md` |
| **Learn how to use automated sync** | `OPERATIONS/AUTO-SYNC-GUIDE.md` |
| **Quick sync reminder (non-technical)** | `OPERATIONS/SYNC-QUICK-REFERENCE.md` |
| **Access admin/super admin features** | `OPERATIONS/SECRET_ADMIN_MODE.md` |
| **Export data or generate reports** | `OPERATIONS/EXPORT_DATA_GUIDE.md` |
| **Manage per-gym validation rules** | `OPERATIONS/DATA_QUALITY_VALIDATION.md` |
| **Know which tables drive price validation** | `OPERATIONS/PRICING_SOURCE_OF_TRUTH.md` |
| **Roadmap: multi-sport / AI onboarding product** | `memory/MEMORY.md`, `OPERATIONS/PRODUCT_VISION_MULTI_SPORT_AI_SETUP.md` |
| **Troubleshoot deployment issues** | `OPERATIONS/DEPLOYMENT_PLAN.md` |
| **Understand the database** | `TECHNICAL/DATABASE_COMPLETE_SCHEMA.md` or `database/README.md` |

---

## 💎 The Crown Jewels (Most Valuable)

1. **🏆 BOSS-PRESENTATION.md** — Business value / ROI
2. **🚀 AUTO-SYNC-GUIDE.md** — Main sync workflow
3. **📋 SYNC-QUICK-REFERENCE.md** — Quick non-technical guide
4. **🔐 SECRET_ADMIN_MODE.md** — Hidden admin (PIN via env var)
5. **📤 EXPORT_DATA_GUIDE.md** — Reports, presets, email summaries
6. **🔧 TECHNICAL-REFERENCE.md** — Complete system guide

---

## 📊 Documentation Stats

- **Total Documents:** 34 (updated April 7, 2026)
- **BUSINESS:** 2 documents
- **TECHNICAL:** 8 documents
- **OPERATIONS:** 22 documents
- **Root docs/:** INDEX.md, TEST_COVERAGE_ANALYSIS.md
- **Root:** `CLAUDE.md` (AI quick-start guide)
- **Last Major Update:** April 7, 2026

---

## 🔄 Recent Changes

### March 17, 2026
- **ADDED** `automation/validation_engine.py` — Database-driven validation engine (replaces hardcoded checks in f12_collect_and_import.py)
- **ADDED** `ADMIN_DATA_FLOW.md` — Admin dashboard data flow documentation
- **UPDATED** Rules system — `gym_valid_values` table dropped, fully unified on `rules` table
- **UPDATED** `f12_collect_and_import.py` — `fetch_gym_valid_values()` renamed to `fetch_rules()` (alias kept), GYM_VALID_VALUES global renamed to RULES_CACHE
- **REMOVED** `gymValidValuesApi` from `api.js` — dead code cleanup
- **RESTORED** `CURRENT_SYSTEM_STATUS.md` — active again in OPERATIONS/

### February 11, 2026
- **DELETED** `SYNC_PROGRESS_TRACKER.md`, `EXPORT_BUG_ANALYSIS.md` — Outdated; trust code over docs
- **RESTORED** `CURRENT_SYSTEM_STATUS.md` — Active again in OPERATIONS/
- **UPDATED** `AUDIT_DATA_ERROR_REFERENCE.md` — Added acknowledged_patterns, temp override scopes
- **UPDATED** `database/README.md` — Added acknowledged_patterns, gym_valid_values, event_pricing, camp_pricing
- **UPDATED** `AI_RULES_READ_FIRST.md` — Added missing error types (skill_mismatch, title_desc_mismatch), completed FORMAT errors list
- **ADDED** `CLAUDE.md` — AI session quick-start guide for faster onboarding
- **FIXED** Time regex false positives in `f12_collect_and_import.py` ("$62 a day", "Ages 4-13")
- **FIXED** Day range false positives — added "to/thru/through" support

### February 5, 2026
- **MOVED** `EXPORT_FEATURE_ANALYSIS.md` → `docs/TECHNICAL/EXPORT_BUG_ANALYSIS.md`
- **DELETED** `EXPORT_TERMINOLOGY_CLARIFIED.md` (content in EXPORT_DATA_GUIDE)
- **DELETED** `HOW_TO_SEE_CHANGE_HISTORY.md` (content in AUDIT-SYSTEM)
- **DELETED** `WHAT_IS_DATA_QUALITY.md` (content in DATA_QUALITY_VALIDATION)
- **Root folder cleanup** - only AI_RULES_READ_FIRST.md and README.md remain

### December 28, 2025
- **EXPORT_DATA_GUIDE.md** - Complete 10/10 rewrite with Quick Presets
- Merged/consolidated multiple docs into single comprehensive guides

---

**This documentation is your project's most valuable asset.**

Code can be rewritten, but this knowledge is irreplaceable.

---

**Last Updated:** April 7, 2026
**Maintained by:** Jayme
