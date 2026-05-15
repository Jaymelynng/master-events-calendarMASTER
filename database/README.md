# 📁 Database Folder

**Last Updated:** May 14, 2026

This folder contains SQL scripts for the Supabase PostgreSQL database.

---

## 📋 CURRENT SCHEMA

The complete, up-to-date view definition is in:
- **`FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql`** - Full `events_with_gym` view with all columns

---

## 🗂️ FILE ORGANIZATION

### Core Schema Files:
| File | Purpose |
|------|---------|
| `CREATE_EVENTS_WITH_GYM_VIEW.sql` | Main view combining events + events_archive + gym info |
| `FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql` | Complete view with ALL columns (most current) |
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
| `CREATE_BULK_LINKS_TABLES.sql` | 4 tables (`bulk_pages`, `bulk_sections`, `bulk_fields`, `bulk_field_values`) — port of Bulk Link PRO into Calendar's Supabase. See [`docs/TECHNICAL/BULK_LINKS_FEATURE.md`](../docs/TECHNICAL/BULK_LINKS_FEATURE.md). (May 14, 2026) |
| `ADD_BRAND_COLORS_TO_GYMS.sql` | `brand_colors text[]` on `gyms` (May 14, 2026). Each gym's hex palette `[primary, secondary, tertiary, light]`. Used by Bulk Links gym card headers and available to any other UI. Migrated from BLP's `locations.brand_colors`. |

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
Use `FIX_ACKNOWLEDGED_ERRORS_COMPLETE.sql` - it has the complete, current view definition.

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
| `event_pricing` | Base prices for CLINIC, KNO, OPEN GYM (with `effective_date`) |
| `camp_pricing` | Base prices for CAMP |
| `acknowledged_patterns` | Temp overrides: "dismiss for all events of this program at this gym" |
| `requirement_notes` | Status (In Progress / Late / Excused) for missing monthly requirements |
| `future_plans` | Admin-managed roadmap |
| `pricing_schedules`, `camp_type_mappings` | iClassPro pricing data (274 schedules, 243 type mappings) |
| `bulk_pages`, `bulk_sections`, `bulk_fields`, `bulk_field_values` | Bulk Links tab data — ported from Bulk Link PRO May 14, 2026. See [`docs/TECHNICAL/BULK_LINKS_FEATURE.md`](../docs/TECHNICAL/BULK_LINKS_FEATURE.md). |

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
| May 14, 2026 | Added `CREATE_BULK_LINKS_TABLES.sql` — 4 new tables (`bulk_pages`, `bulk_sections`, `bulk_fields`, `bulk_field_values`) ported from the standalone Bulk Link PRO app into Calendar's Supabase. Schema applied via Supabase MCP migration `create_bulk_links_tables`. First-pass data migrated directly (4 pages, 24 sections, 104 fields, 116 values for the `programs` tab). Remaining 1,044 field_values migrated via `scripts/migrate-blp-to-calendar.mjs`. Full reference: [`docs/TECHNICAL/BULK_LINKS_FEATURE.md`](../docs/TECHNICAL/BULK_LINKS_FEATURE.md). |

