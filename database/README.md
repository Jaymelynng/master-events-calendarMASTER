# 📁 Database Folder

**Last Updated:** December 28, 2025

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
| `monthly_requirements` | Compliance tracking |
| `gym_valid_values` | Permanent validation rules (price, time, program synonyms) |
| `event_pricing` | Base prices for CLINIC, KNO, OPEN GYM |
| `camp_pricing` | Base prices for CAMP |
| `acknowledged_patterns` | Temp overrides: "dismiss for all events of this program at this gym" |

---

## 📜 CLEANUP HISTORY

| Date | Action |
|------|--------|
| Dec 28, 2025 | Removed outdated testing folders (10.21.25, f12-import-testing) |
| Dec 28, 2025 | Removed one-time fix files (FIX_RBA_OPEN_GYM.sql, MISSING_OCTOBER_1_21_INSERT.sql) |
| Dec 28, 2025 | Updated CREATE_EVENTS_WITH_GYM_VIEW.sql with all current columns |
| Dec 28, 2025 | Moved DATA_QUALITY_IMPROVEMENTS.md to docs/OPERATIONS/ |

