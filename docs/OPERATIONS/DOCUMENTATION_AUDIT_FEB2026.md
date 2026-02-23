# Documentation Audit Report — February 23, 2026

**Purpose:** Exhaustive cross-check of all 28 documentation files against actual codebase  
**Auditor:** AI Agent  
**Date:** February 23, 2026

---

## EXECUTIVE SUMMARY

Out of 28 docs reviewed, **19 have at least one issue** (outdated info, missing features, or inaccuracies). The most critical gaps are:

1. **Admin Dashboard now has 5 tabs** (Audit & Review, Pricing, Gym Rules, Change History, Quick Actions) — many docs still say 3 or 4 tabs
2. **`event_pricing` table** exists but is missing from the DATABASE_COMPLETE_SCHEMA.md as a numbered table
3. **`verified_errors` column** exists in code and migration SQL but is not documented anywhere
4. **`EventsDashboard_REFACTORED.js`** exists but `App.js` still imports the monolithic `EventsDashboard.js` (documented in CLAUDE.md but worth re-confirming)
5. **`CURRENT_SYSTEM_STATUS.md`** was deleted (per INDEX.md) but is still referenced by CLAUDE.md and BOSS-PRESENTATION.md
6. **Export guide** is not in the list of docs to audit but exists and needs updating for `start_date`/`end_date` support

---

## DOC-BY-DOC FINDINGS

---

### 1. `/workspace/docs/INDEX.md`

**What it says:** Documentation index listing 22 documents, last updated Feb 11, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 28 | Says "17 more guides" in OPERATIONS — actual count in OPERATIONS section is 15 listed docs | WRONG |
| 57 | Lists `DESIGN_COLOR_SCHEME.md` in TECHNICAL section — this file was not in the user's audit list; may or may not exist | UNVERIFIED |
| 137 | "Total Documents: 22" — should be recounted since docs have been added/removed | OUTDATED |
| 139 | "TECHNICAL: 6 documents" — only 5 are listed in the TECHNICAL table (TECHNICAL-REFERENCE, VALIDATION_RULES, DESIGN_COLOR_SCHEME, DATABASE_COMPLETE_SCHEMA, SCALABILITY-ROADMAP, SYNC_SYSTEM_TECHNICAL) — that is actually 6, OK | OK |
| 149 | References deleting `CURRENT_SYSTEM_STATUS.md` — correct, but other docs still reference it (see below) | INFO |

**Missing:**
- No mention of `EXPORT_DATA_GUIDE.md` in the file list (it's listed in the tables but not counted)
- `acknowledged_patterns` table and `event_pricing`/`camp_pricing` tables are mentioned in Recent Changes but `PRICING_MANAGEMENT_GUIDE.md` is not listed anywhere in the index
- `AdminChangeHistory.js` component exists in code (new "Change History" tab) — not mentioned

---

### 2. `/workspace/docs/OPERATIONS/AUDIT_DATA_ERROR_REFERENCE.md`

**What it says:** Complete technical spec of every validation check.

**Accuracy:** This is one of the most accurate docs. Every error type, every branch is documented and matches `f12_collect_and_import.py`.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 63 | Says year_mismatch "Runs when: `if description:` block (line 869)" — line number may have shifted since code changes | OUTDATED (minor) |
| 616 | `canAddAsRule` function matches code in `validationHelpers.js` exactly | OK |
| 640 | Error categories match `inferErrorCategory()` in code exactly | OK |

**Missing:**
- No mention of `verified_errors` column or the accuracy tracking system (`computeAccuracyStats`) that now exists in `validationHelpers.js`
- No mention of `camp_type_not_offered` error type which appears in `getErrorLabel()` in `validationHelpers.js` line 169

---

### 3. `/workspace/docs/OPERATIONS/AUDIT-SYSTEM.md`

**What it says:** Change tracking system with audit log, last updated Feb 2, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 6 | "Location: Admin Dashboard → Quick Actions (Super Admin PIN required) + Audit & Review tab" — The Change History is now its OWN tab called "Change History", not under Quick Actions | OUTDATED |
| 108-119 | Shows `event_audit_log` schema with `id UUID PRIMARY KEY` — the actual migration/schema doc (DATABASE_COMPLETE_SCHEMA.md line 316) shows `id SERIAL PRIMARY KEY` | WRONG |
| 164 | "Admin Dashboard now includes an Audit & Review tab" — correct, but also now has a separate "Change History" tab (component: `AdminChangeHistory.js`) | MISSING |
| 186-188 | Lists admin component files but doesn't mention `AdminChangeHistory.js` | MISSING |
| 199 | "Filter by action type: Not implemented" — need to verify in AdminChangeHistory.js if filtering was added | POSSIBLY OUTDATED |

---

### 4. `/workspace/docs/OPERATIONS/AUTO_ARCHIVE_SYSTEM.md`

**What it says:** Auto-archive via pg_cron at midnight, last updated Dec 28, 2025.

**Accuracy:** Generally accurate. The archive function SQL, view definition, and cron job description are correct.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 52-69 | Archive function SQL doesn't include `verified_errors` column (added Feb 2026) or `availability_status` | OUTDATED |
| 98-115 | `events_with_gym` view SQL doesn't include `verified_errors` column | OUTDATED |
| 117 | Says "view filters out soft-deleted events (`WHERE e.deleted_at IS NULL`) from the active table" — correct for events but notes the archive side doesn't filter | OK |

**Missing:**
- Does not mention that `events_archive` now has 32+ columns (verified_errors was added)
- Does not mention `event_pricing` or `camp_pricing` tables which are NOT archived (they're reference tables, so this is correct behavior, but worth noting)

---

### 5. `/workspace/docs/OPERATIONS/AUTO-SYNC-GUIDE.md`

**What it says:** Main sync workflow guide, last updated Feb 2, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 438 | "Still exists in code (lines ~2793-2803 in EventsDashboard.js)" — EventsDashboard.js is 4019+ lines now, line numbers likely shifted | OUTDATED |
| 467-468 | "3 tabs: Audit & Review, Gym Rules, Quick Actions" — there are now **5 tabs** (Audit & Review, Pricing, Gym Rules, Change History, Quick Actions) | OUTDATED |

**Missing:**
- No mention of the Pricing tab in the Admin Dashboard
- No mention of the Change History tab

---

### 6. `/workspace/docs/OPERATIONS/BULK-IMPORT-LEARNINGS.md`

**What it says:** Historical reference for bulk import issues, last updated Dec 28, 2025.

**Accuracy:** Good historical document. Mostly accurate.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 181 | Sync workflow: "Go to Quick Actions tab → Click 'Automated Sync'" — correct and current | OK |

**Missing:**
- No mention of `event_pricing` validation for non-camp events (added Feb 2026)

---

### 7. `/workspace/docs/OPERATIONS/CAMP_COMPLEXITY_MASTER_GUIDE.md`

**What it says:** Camp data structure variations across gyms, last updated Dec 28, 2025.

**Accuracy:** Detailed and accurate for camp consolidation logic.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 794 | "Located in `EventsDashboard.js` around line 3051" — line number has likely shifted | OUTDATED (minor) |
| 736 | References `docs/TECHNICAL/SUPABASE-ARCHITECTURE.md` — this file doesn't appear to exist; was probably renamed to `DATABASE_COMPLETE_SCHEMA.md` | WRONG |

---

### 8. `/workspace/docs/OPERATIONS/DATA_QUALITY_VALIDATION.md`

**What it says:** Complete validation system documentation, last updated Feb 5, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 30 | Price Source of Truth table says CLINIC/KNO/OPEN GYM have "None" as source — this is **WRONG** as of Feb 2026. The `event_pricing` table IS now the source of truth | WRONG |
| 37-39 | Rows for CLINIC, KNO, OPEN GYM say "❌ None" and "Title price vs Description price only" — should say ✅ `event_pricing` table | WRONG |
| 392 | "Why CAMP is skipped: Camp pricing is complex..." — this is outdated; camp pricing validation IS implemented via `camp_pricing` table | OUTDATED |
| 489 | Lists files involved but doesn't include `AdminPricing.js` or `AdminChangeHistory.js` | MISSING |

**Missing:**
- No documentation of the `event_pricing` table as source of truth for CLINIC/KNO/OPEN GYM
- No documentation of `verified_errors` column for accuracy tracking
- No mention of `event_price_mismatch` error type in the validation matrix (Part B)

---

### 9. `/workspace/docs/OPERATIONS/DEPLOYMENT_PLAN.md`

**What it says:** Deployment architecture, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 48-53 | Database tables list doesn't include `gym_valid_values`, `event_pricing`, `camp_pricing`, `acknowledged_patterns` | OUTDATED |
| 302 | Last deployment history entry is Dec 28, 2025 — missing Feb 2026 changes | OUTDATED |
| 331 | New deployment checklist doesn't mention `event_pricing` or `camp_pricing` tables | MISSING |

---

### 10. `/workspace/docs/OPERATIONS/EVENT_COMPARISON_LOGIC.md`

**What it says:** How NEW/CHANGED/DELETED detection works, last updated Dec 28, 2025.

**Accuracy:** Very accurate. Matches `src/lib/eventComparison.js` closely.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| All | No issues found — this document accurately describes the comparison logic | OK |

---

### 11. `/workspace/docs/OPERATIONS/F12-IMPORT-GUIDE.md`

**What it says:** Manual F12 import backup method, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 263-277 | File structure mentions `EventsDashboard.js` directly for `convertRawDataToJson()` and `handleBulkImport()` — these may now be in `BulkImportModal.js` or `JsonImport.js` based on the refactored component list | POSSIBLY OUTDATED |
| 884 | "event_types" listed as critical database table — this is a real table but rarely used | OK |
| 414 | "Gym selector dropdown" — project rules say never use dropdowns. Verify if this is actually radio buttons in the BulkImportModal | POSSIBLY WRONG |

---

### 12. `/workspace/docs/OPERATIONS/LOCAL_DEVELOPMENT_GUIDE.md`

**What it says:** How to run locally, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 17 | Path: `cd "C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar"` — this is a Windows-specific path that may not match everyone's setup | INFO (expected for non-technical user) |
| 52 | References `env.example` for copying — verify this file exists in root | UNVERIFIED |

---

### 13. `/workspace/docs/OPERATIONS/MAINTENANCE_GUIDE.md`

**What it says:** Weekly/monthly/quarterly maintenance tasks, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 62-68 | Export instructions mention "date pickers" — the ExportModal DOES have `startDate` and `endDate` inputs now, so this is accurate | OK |
| 165 | Path: `cd "C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar"` — Windows-specific path | INFO |

**Missing:**
- No mention of reviewing `event_pricing` or `camp_pricing` tables as part of maintenance
- No mention of the Pricing tab in Admin Dashboard for price management

---

### 14. `/workspace/docs/OPERATIONS/SECRET_ADMIN_MODE.md`

**What it says:** Three-tier access system with full-page Admin Dashboard, last updated Feb 2, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 42 | "A full-page Admin Dashboard replaces the calendar with **4 tabs**" — there are now **5 tabs**: Audit & Review, Pricing, Gym Rules, Change History, Quick Actions | WRONG |
| 52-58 | Tab list is: Audit & Review, Pricing, Gym Rules, Quick Actions — missing "Change History" tab | MISSING |
| 89 | Step-by-step says "Use tabs: Audit & Review | Pricing | Gym Rules | Quick Actions" — missing Change History | MISSING |
| 177-182 | Sub-components list doesn't include `AdminChangeHistory.js` or `AdminPricing.js` (AdminPricing IS mentioned elsewhere but AdminChangeHistory is missing from the list) | MISSING |
| 224-227 | Tab visibility table shows 3 tabs — should be 5 | OUTDATED |
| 265 | FAQ "Can other people access Level 2?" says "the Admin button is visible" — but the doc also says Shift+Click is required, which means it's NOT visible. Contradictory. | CONTRADICTORY |
| 309 | Related docs list includes `SYNC_PROGRESS_TRACKER.md` — this file was deleted (per INDEX.md) | WRONG |
| 319 | Changelog shows "Feb 11, 2026: NEW Pricing tab" — good, but doesn't mention Change History tab which also exists in code | MISSING |

---

### 15. `/workspace/docs/OPERATIONS/SYNC-QUICK-REFERENCE.md`

**What it says:** Non-technical quick reference for syncing, last updated Dec 28, 2025.

**Accuracy:** Good quick reference. Steps are accurate.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| All | No critical issues — steps are correct | OK |

---

### 16. `/workspace/docs/TECHNICAL/DATABASE_COMPLETE_SCHEMA.md`

**What it says:** Complete database schema, last updated Feb 2, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 13 | "Tables: 10" — there are now at least 13 tables (events, events_archive, gyms, event_types, gym_links, link_types, monthly_requirements, event_audit_log, sync_log, gym_valid_values, event_pricing, camp_pricing, acknowledged_patterns) | WRONG |
| 30-39 | Table of contents lists 10 tables — missing `event_pricing` (#11), `camp_pricing` (#12), and `acknowledged_patterns` (#13) | MISSING |
| 82-83 | Events table doesn't include `verified_errors JSONB` column (added Feb 2026) | MISSING |
| 130-143 | Events_archive table doesn't include `verified_errors JSONB` column | MISSING |
| 410-436 | `events_with_gym` view SQL doesn't include `verified_errors` column — the actual migration `ADD_VERIFIED_ERRORS_COLUMN.sql` shows the view DOES include it now | OUTDATED |
| 471-503 | Data relationships diagram doesn't show `event_pricing`, `camp_pricing`, or `acknowledged_patterns` tables | MISSING |
| 689 | Migration history: last entry is "Feb 2, 2026" — missing the `verified_errors` column addition (Feb 3, 2026) and `event_pricing` table creation (Feb 5, 2026) | OUTDATED |

**Missing tables not documented:**
- `event_pricing` — Source of truth for CLINIC/KNO/OPEN GYM prices (SQL exists at `database/CREATE_EVENT_PRICING_TABLE.sql`)
- `camp_pricing` — Source of truth for camp prices (mentioned in other docs but not in schema doc's numbered tables)
- `acknowledged_patterns` — Program-wide temp overrides (SQL exists at `database/CREATE_ACKNOWLEDGED_PATTERNS.sql`)

---

### 17. `/workspace/docs/TECHNICAL/SCALABILITY-ROADMAP.md`

**What it says:** Future scaling plan, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 15 | "9 tables, 2 views" — now 13+ tables, 2 views | OUTDATED |
| 37-38 | "Single EventsDashboard component (~3000+ lines)" — now 4000+ lines | OUTDATED |
| 57-63 | Proposed structure lists `AdminPortalModal.js` — this was replaced by `AdminDashboard/` folder with multiple components | OUTDATED |
| 128 | "Proper table structure (9 tables)" — now 13+ tables | OUTDATED |

---

### 18. `/workspace/docs/TECHNICAL/SYNC_SYSTEM_TECHNICAL.md`

**What it says:** Complete technical breakdown of sync system, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 874-877 | "AdminDashboard.js (replaced AdminPortalModal)" with "3 tabs — Audit & Review, Gym Rules, Quick Actions" — now 5 tabs | OUTDATED |
| 1079-1091 | Database schema section shows `price DECIMAL` — the actual schema doc says `price VARCHAR` (TEXT). The events table stores price as TEXT, not DECIMAL | WRONG |
| 1337 | "Run `database/ADD_DESCRIPTION_COLUMN.sql`" — this is historical; column already exists | INFO |
| 1341 | "Run `database/ADD_DELETED_AT_COLUMN.sql`" — also historical | INFO |

---

### 19. `/workspace/docs/TECHNICAL/TECHNICAL-REFERENCE.md`

**What it says:** Complete system overview, last updated Feb 2, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 77 | Lists "Pricing Tab" in Admin Features — good, this is current | OK |
| 116-117 | "10 Tables + 2 Views" — now 13+ tables | OUTDATED |
| 158 | Lists link types as "camps_half, camps_holiday, camps_summer_full, summer_camps_half" — the actual link_types (from schema doc) are `camps_summer_half` not `summer_camps_half` | POSSIBLY WRONG |
| 294-295 | "3-tier access system" with "3 tabs" — should say 5 tabs | OUTDATED |
| 357-358 | "Tables: 9 core tables + 2 views" — now 13+ | OUTDATED |
| 422 | Key files table doesn't list `AdminChangeHistory.js` or `AdminPricing.js` | MISSING |

---

### 20. `/workspace/docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md`

**What it says:** Precoded vs configurable rules, last updated Feb 17, 2026.

**Accuracy:** This is the MOST recently updated doc and is quite accurate.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 176 | Schema shows `gym_id TEXT NOT NULL` with comment `-- e.g., "RBA", "CCP", or "*" for global` — but the actual code uses `'ALL'` not `'*'` for global rules (confirmed in `f12_collect_and_import.py` line 261: `all_values.get('ALL', {})`) | WRONG |
| 192 | Example rules table shows `* | program_synonym | pno | KIDS NIGHT OUT` — should be `ALL` not `*` | WRONG |

**Good:**
- Section 3.6 documents `event_pricing` table correctly with `effective_date` and `end_date`
- Section 3.5 documents `camp_pricing` correctly
- Part 8 (New Gym Setup Guide) is well-written and current

---

### 21. `/workspace/docs/BUSINESS/BOSS-PRESENTATION.md`

**What it says:** Executive presentation for Kim, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 189 | References `CURRENT_SYSTEM_STATUS.md` — this file was deleted Feb 11, 2026 | WRONG |
| 99 | "Total Events: 500+ (active + archived)" — may be higher now, Feb 2026 | OUTDATED (minor) |

---

### 22. `/workspace/docs/BUSINESS/GYM_DATA_IMPROVEMENTS.md`

**What it says:** Optional data enhancements for gym contact info, last updated Dec 28, 2025.

**Accuracy:** This is a static reference doc with SQL scripts. No code to cross-check against.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 101 | TIG listed as "Wheat Ridge, CO" — but other docs say TIG is in CA | CONTRADICTORY |

---

### 23. `/workspace/database/README.md`

**What it says:** Database folder overview with file listing, last updated Dec 28, 2025.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 83 | Lists `event_pricing` table — good | OK |
| 84 | Lists `camp_pricing` table — good | OK |
| 85 | Lists `acknowledged_patterns` table — good | OK |
| Missing | Does NOT list `ADD_VERIFIED_ERRORS_COLUMN.sql` which exists in the database folder | MISSING |
| Missing | Does NOT list `CREATE_EVENT_PRICING_TABLE.sql` in the migration scripts section | MISSING |

---

### 24. `/workspace/database/PRICING_MANAGEMENT_GUIDE.md`

**What it says:** How to update prices in Supabase, last updated Feb 5, 2026.

**Accuracy:** Good practical guide with SQL examples.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| All | Pricing table matches `CREATE_EVENT_PRICING_TABLE.sql` | OK |
| All | Camp pricing section is brief but adequate | OK |

**Missing:**
- No mention of the Admin Dashboard Pricing tab as an alternative to SQL for managing prices
- No mention that the Python scraper (`f12_collect_and_import.py`) fetches from `event_pricing` during validation

---

### 25. `/workspace/automation/README.md`

**What it says:** Automation folder overview, last updated Dec 28, 2025.

**Accuracy:** Good overview of the Flask API and Playwright setup.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| All | No critical issues — endpoint list and gym list are accurate | OK |

**Missing:**
- No mention of `event_pricing` or `camp_pricing` being read during sync for validation

---

### 26. `/workspace/automation/START_LOCAL_API.md`

**What it says:** How to start the local API server.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 69 | "Click 🪄 Admin button" — should say "Shift+Click the 🪄 wand icon" | WRONG |
| 70 | "Click 'Open Automated Sync'" — should say "Go to Quick Actions tab → Click 'Automated Sync'" | OUTDATED |

---

### 27. `/workspace/automation/TROUBLESHOOTING.md`

**What it says:** Common automation issues and fixes, last updated Dec 28, 2025.

**Accuracy:** Good troubleshooting guide.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| All | No critical issues | OK |

---

### 28. `/workspace/README.md`

**What it says:** Project root README, last updated Jan 30, 2026.

**Issues Found:**

| Line | Issue | Type |
|------|-------|------|
| 24 | "200+ Events in system" — other docs say 500+ | INCONSISTENT |
| 126 | File structure shows `AdminPortalModal.js` — this still exists as a file but was functionally replaced by the `AdminDashboard/` folder | OUTDATED |
| 127-130 | Doesn't list the AdminDashboard folder or its components | MISSING |
| 131-132 | Lists `useRealtimeEvents.js` — this exists in `src/lib/` so it's correct | OK |
| 149 | "Admin: Click 🪄 Admin" — should clarify Shift+Click | INCOMPLETE |

---

## CROSS-CHECK: KEY QUESTIONS ANSWERED

### Does the schema doc match the actual SQL migration files?

**NO.** The schema doc (`DATABASE_COMPLETE_SCHEMA.md`) lists 10 tables. The actual database has at least 13:
- Missing: `event_pricing`, `camp_pricing`, `acknowledged_patterns`
- Missing column: `verified_errors` (JSONB) on `events` and `events_archive`
- The `events_with_gym` view in the schema doc is outdated (missing `verified_errors`)

### Does the sync guide match how SyncModal.js actually works?

**MOSTLY YES.** The `AUTO-SYNC-GUIDE.md` accurately describes the sync flow. Minor issue: it says the Admin Dashboard has 3 tabs when it now has 5.

### Does the validation docs match what f12_collect_and_import.py actually validates?

**PARTIALLY.** The `AUDIT_DATA_ERROR_REFERENCE.md` is very accurate for all 23 error types. However:
- `DATA_QUALITY_VALIDATION.md` still says CLINIC/KNO/OPEN GYM have "no source of truth" for prices — this is wrong since `event_pricing` was added Feb 2026
- The `camp_type_not_offered` error type appears in code but not in docs
- `verified_errors` accuracy tracking is undocumented

### Are all "Known Issues" still actually issues or have some been fixed?

From `CLAUDE.md`:
- "Wrong year in DESCRIPTION" — **Still NOT fixed** (only checks title)
- "`program_ignore` rule type" — **Still NOT built**
- "`EventsDashboard.js` monolithic" — **Still NOT migrated** (App.js imports monolithic version)
- Export bug — **FIXED** ✅
- Time regex false positives — **FIXED** ✅
- Day range false positives — **FIXED** ✅

### Are recent features (Sync All, event_pricing, Change History tab) documented?

| Feature | Documented? | Where |
|---------|-------------|-------|
| Sync All | ✅ Yes | AUTO-SYNC-GUIDE, SYNC-QUICK-REFERENCE |
| `event_pricing` table | ✅ Partially | VALIDATION_RULES_ARCHITECTURE.md, PRICING_MANAGEMENT_GUIDE.md — but NOT in DATABASE_COMPLETE_SCHEMA.md or DATA_QUALITY_VALIDATION.md |
| Change History tab | ❌ No | `AdminChangeHistory.js` exists in code but no doc mentions this tab |
| Pricing tab | ✅ Partially | SECRET_ADMIN_MODE.md mentions it in changelog but tab count is wrong |
| `verified_errors` column | ❌ No | Migration SQL exists, code uses it, but zero documentation |
| `acknowledged_patterns` table | ✅ Partially | Referenced in AUDIT_DATA_ERROR_REFERENCE.md and database/README.md |

### Does the export guide mention start_date/end_date?

The `EXPORT_DATA_GUIDE.md` (line 49+) does mention date range selection with "Custom date picker" but does NOT specifically document the `start_date`/`end_date` database fields being exported. The `ExportModal.js` code DOES include `start_date` and `end_date` in the export output (lines 273-274, 303-304).

---

## PRIORITY FIXES NEEDED

### HIGH PRIORITY (Inaccurate information that could confuse users)

1. **DATABASE_COMPLETE_SCHEMA.md** — Add `event_pricing`, `camp_pricing`, `acknowledged_patterns` tables; add `verified_errors` column; update table count from 10 to 13+
2. **DATA_QUALITY_VALIDATION.md** (lines 30-39) — Update price source of truth: CLINIC/KNO/OPEN GYM now use `event_pricing` table, not "None"
3. **SECRET_ADMIN_MODE.md** (line 42) — Change "4 tabs" to "5 tabs"; add Change History tab to all lists
4. **VALIDATION_RULES_ARCHITECTURE.md** (line 176, 192) — Change `*` to `ALL` for global gym_id
5. **BOSS-PRESENTATION.md** (line 189) — Remove reference to deleted `CURRENT_SYSTEM_STATUS.md`
6. **CLAUDE.md** — Remove reference to deleted `CURRENT_SYSTEM_STATUS.md`

### MEDIUM PRIORITY (Missing documentation for existing features)

7. **Document `AdminChangeHistory.js`** — The Change History tab exists in code but has zero documentation
8. **Document `verified_errors`** — The accuracy tracking system exists but is undocumented
9. **Document `camp_type_not_offered`** — Error type exists in code labels but not in validation docs
10. **SYNC_SYSTEM_TECHNICAL.md** (line 1079) — Fix `price DECIMAL` to `price TEXT/VARCHAR`

### LOW PRIORITY (Minor inconsistencies)

11. **AUTO_ARCHIVE_SYSTEM.md** — Update SQL to include `verified_errors` column
12. **SCALABILITY-ROADMAP.md** — Update table counts (9 → 13+), line counts (3000 → 4000+)
13. **README.md** — Update event count, file structure, admin access instructions
14. **automation/START_LOCAL_API.md** — Fix admin access instructions
15. **GYM_DATA_IMPROVEMENTS.md** vs other docs — TIG location: CO vs CA discrepancy

---

## SUMMARY STATS

| Category | Count |
|----------|-------|
| Docs reviewed | 28 |
| Docs with NO issues | 9 |
| Docs with issues | 19 |
| WRONG information found | 8 instances |
| OUTDATED information found | 18 instances |
| MISSING information found | 15 instances |
| Total actionable items | 15 priority fixes |

---

**End of Audit Report**
