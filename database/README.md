# 📁 Database Folder

**Last Updated:** May 14, 2026

This folder contains SQL scripts for the Supabase PostgreSQL database.

---

## 📋 CURRENT SCHEMA

The live view definition in Supabase is the truth: `select pg_get_viewdef('public.events_with_gym', true);`. No single file here has it — later scripts (`ADD_DAILY_SCHEDULE_COLUMN.sql`, `ADD_AI_REVIEW_COLUMNS.sql`, `ADD_CAMP_TYPE_COLUMN.sql`) each recreated the view after `FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql` (Dec 2025).

---

## 🗂️ FILE ORGANIZATION

### Core Schema Files:
| File | Purpose |
|------|---------|
| `CREATE_EVENTS_WITH_GYM_VIEW.sql` | Main view combining events + events_archive + gym info |
| `FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql` | Dec 2025 view — superseded by later ADD_* scripts (see above) |
| `performance_indexes.sql` | Database indexes for performance |

### Migration Scripts (Historical):
These document schema changes over time:

| File | What It Added |
|------|---------------|
| `ADD_ACKNOWLEDGED_ERRORS_COLUMN.sql` | Dismissible validation warnings |
| `ADD_AGE_COLUMNS.sql` | age_min, age_max fields |
| `ADD_AVAILABILITY_COLUMNS.sql` | has_openings, registration dates |
| `ADD_DATA_QUALITY_COLUMNS.sql` | has_flyer, description_status, validation_errors |
| `ADD_DELETED_AT_COLUMN.sql` | Soft delete support |
| `ADD_DESCRIPTION_COLUMN.sql` | Event descriptions |
| `ADD_HALF_DAY_CAMP_LINKS.sql` | Half-day camp URL patterns |
| `ADD_UNIQUE_CONSTRAINT_EVENT_URL.sql` | Prevent duplicate event URLs |
| `CREATE_ACKNOWLEDGED_PATTERNS.sql` | Program-wide temp overrides (gym + event_type + error_message) |
| `CREATE_RULES_TABLE.sql` | Unified validation rules system — replaced `gym_valid_values` (Feb 23, 2026) |
| `CREATE_REQUIREMENT_NOTES.sql` | Status tracking for missing monthly requirements |
| `CREATE_FUTURE_PLANS_TABLE.sql` | Admin-managed roadmap items |
| `CREATE_EVENT_PRICING_TABLE.sql` | Per-event-type pricing with `effective_date` (CLINIC, KNO, OPEN GYM) |
| `CREATE_MONTHLY_REQUIREMENTS_TABLE.sql` | Per-event-type compliance threshold (admin-editable). Adds the missing FOR ALL RLS policy that was blocking writes (May 6, 2026) |
| `ENABLE_RLS_ON_UNGUARDED_TABLES.sql` | Closes 3 RLS gaps: `sync_log` gets FOR ALL policy (anon read+write), `camp_pricing_map` and `extractors` get RLS-on-no-policy lockdown (anon denied, service-role still works). May 6, 2026 |
| `MIGRATE_GYM_VALID_VALUES_TO_RULES.sql` | One-time migration when `gym_valid_values` was retired |
| `ADD_OPENINGS_COLUMNS.sql` | `openings`, `openings_display`, `show_openings` (Apr 26, 2026) |
| `ADD_VERIFIED_ERRORS_COLUMN.sql` | `verified_errors` jsonb on events |
| `ADD_MANAGER_CONTACTS.sql` | `manager_name`, `manager_email` on `gyms` |
| `ARCHIVE_SOFT_DELETED_EVENTS.sql` + `CREATE_ARCHIVE_FUNCTION.sql` | Soft-delete + auto-archive pipeline |
| `ADD_BRAND_COLORS_TO_GYMS.sql` | `brand_colors text[]` on `gyms` (May 14, 2026). Each gym's hex palette `[primary, secondary, tertiary, light]`. Used for gym-colored UI (camp bars, gym cards) and available to any other UI. |

### Utility Queries:
| File | Purpose |
|------|---------|
| `CHECK_ALL_GYM_CAMP_LINKS.sql` | Verify gym_links table |
| `COUNT_CAMPS_BY_GYM.sql` | Count camps per gym |

---

## 🔧 HOW TO USE

### Running SQL Scripts:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the script content
4. Click "Run"

### If Recreating the View:
Start from the live definition (`pg_get_viewdef`), not `FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql` — that file predates openings, daily_schedule, ai_review and camp_type columns.

---

## ⚠️ IMPORTANT NOTES

1. **Always backup before running ALTER/DROP commands**
2. **The `events_with_gym` view must include ALL columns** from both `events` and `events_archive` tables
3. **When adding new columns**, update both tables AND recreate the view

---

## 📊 CURRENT TABLES

| Table | Purpose |
|-------|---------|
| `events` | Active/future events |
| `events_archive` | Past events (auto-archived daily) |
| `gyms` | Gym information |
| `gym_links` | Portal URLs for each gym/event type |
| `sync_log` | Tracks last sync time per gym/type |
| `event_audit_log` | Change history |
| `event_types` | Event type definitions |
| `link_types` | Link type definitions |
| `monthly_requirements` | Compliance tracking — see `CREATE_MONTHLY_REQUIREMENTS_TABLE.sql` |
| `rules` | Unified validation rules + system checks (replaces dropped `gym_valid_values`) |
| `event_pricing` | Old prices for CLINIC, KNO, OPEN GYM — nothing reads it since all pricing was removed 2026-10-02 |
| `camp_pricing` | Old CAMP prices — nothing reads it since 2026-10-02 |
| `acknowledged_patterns` | Temp overrides: "dismiss for all events of this program at this gym" |
| `requirement_notes` | Status (In Progress / Late / Excused) for missing monthly requirements |
| `future_plans` | Admin-managed roadmap |
| `archive.pricing_schedules`, `archive.camp_type_mappings` | April iClassPro pricing data (274 schedules, 243 type mappings) — moved to the `archive` schema |
| `event_type_mappings` | iClass camp-type name → calendar bucket (Admin › Buckets); no row = UNSORTED |
| `category_mappings`, `extractors`, `format_patterns`, `app_config`, `error_email_log`, `verified_events` | Also in `public` (listed 2026-10-13) |

---

## 📜 CLEANUP HISTORY

| Date | Action |
|------|--------|
| Dec 28, 2025 | Removed outdated testing folders (10.21.25, f12-import-testing) |
| Dec 28, 2025 | Removed one-time fix files (FIX_RBA_OPEN_GYM.sql, MISSING_OCTOBER_1_21_INSERT.sql) |
| Dec 28, 2025 | Updated CREATE_EVENTS_WITH_GYM_VIEW.sql with all current columns |
| Dec 28, 2025 | Moved DATA_QUALITY_IMPROVEMENTS.md to docs/OPERATIONS/ |
| May 6, 2026 | Added `CREATE_MONTHLY_REQUIREMENTS_TABLE.sql` (table existed in prod with read-only RLS — admin writes were failing). Refreshed table list to drop dropped `gym_valid_values` and add `rules`, `requirement_notes`, `future_plans`, `pricing_schedules`, `camp_type_mappings`. Repo is now the source of truth for every load-bearing Supabase object — anything required for the app to run must live in this folder. |
| May 6, 2026 | Added `ENABLE_RLS_ON_UNGUARDED_TABLES.sql` — closes the 3 critical RLS-disabled gaps the Supabase advisor flagged. Verified by inspecting actual code usage and testing each table as the anon role. |
| May 14, 2026 | Added `CREATE_BULK_LINKS_TABLES.sql` — 4 tables (`bulk_pages`, `bulk_sections`, `bulk_fields`, `bulk_field_values`) ported from the standalone Bulk Link PRO app. **(Reverted Aug 11, 2026 — see below.)** |
| Aug 11, 2026 | **Removed the Bulk Links feature.** The Bulk Link PRO port was retired (it's a separate app again, `HUB - Bulk Link PRO`). Dropped the 4 `bulk_*` tables + the `gyms_with_links` view from Calendar's Supabase, and deleted `CREATE_BULK_LINKS_TABLES.sql` + the UI files. `gyms.brand_colors` stays (used for gym-colored UI). |

