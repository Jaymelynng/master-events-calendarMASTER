# 🗄️ COMPLETE DATABASE SCHEMA
## Master Events Calendar - All Tables & Views

**Last Updated:** February 2, 2026  
**Database:** `https://xftiwouxpefchwoxxgpf.supabase.co`  
**Status:** ✅ PRODUCTION READY

---

## 📊 DATABASE OVERVIEW

| Category | Count |
|----------|-------|
| **Tables** | 13 |
| **Views** | 2 |
| **Total Events** | ~500+ (active + archived) |
| **Gyms** | 10 |
| **Gym Links** | ~75+ |
| **Link Types** | 10 |
| **Event Types** | 3 (tracked) |
| **Audit Log Entries** | ~1,000+ |
| **Sync Log Entries** | ~50+ |

> **Note:** Row counts are approximate and change frequently. Query the database for current counts.

---

## 📋 TABLE OF CONTENTS

1. [events](#1-events-table) - Active/future events (30 columns)
2. [events_archive](#2-events_archive-table) - Past events (29 columns)
3. [gyms](#3-gyms-table) - Gym information (12 columns)
4. [event_types](#4-event_types-table) - Event categories (9 columns)
5. [gym_links](#5-gym_links-table) - Portal URLs (10 columns)
6. [link_types](#6-link_types-table) - Link categories (9 columns)
7. [monthly_requirements](#7-monthly_requirements-table) - Business rules (2 columns)
8. [event_audit_log](#8-event_audit_log-table) - Change tracking (11 columns)
9. [sync_log](#9-sync_log-table) - Sync progress (6 columns)
10. [gym_valid_values](#10-gym_valid_values-table) - Per-gym validation rules (7 columns)
11. [event_pricing](#11-event_pricing-table) - Non-camp event prices with effective_date support (8 columns)
12. [camp_pricing](#12-camp_pricing-table) - Camp price lookup by gym (8 columns)
13. [acknowledged_patterns](#13-acknowledged_patterns-table) - Bulk dismiss patterns per gym/event type (7 columns)
14. [Views](#views) - events_with_gym, gym_links_detailed

---

## 1. EVENTS TABLE

**Purpose:** Stores all active/future events  
**Row Count:** Varies (changes with syncs)  
**Column Count:** 30

```sql
events (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Identification
  gym_id VARCHAR NOT NULL,                    -- FK to gyms.id (CCP, EST, etc.)
  event_type_id UUID,                         -- FK to event_types.id (nullable)
  
  -- Event Details
  title VARCHAR NOT NULL,                     -- Event name
  date DATE NOT NULL,                         -- Event date
  start_date DATE,                            -- Multi-day start
  end_date DATE,                              -- Multi-day end
  time VARCHAR,                               -- "6:30 PM - 9:30 PM"
  price VARCHAR,                              -- Cost (parsed from title/description)
  day_of_week VARCHAR,                        -- Auto-calculated
  type VARCHAR NOT NULL,                      -- CLINIC, KIDS NIGHT OUT, CAMP, etc.
  event_url TEXT,                             -- Registration link (UNIQUE identifier!)
  
  -- Content Fields
  description TEXT,                           -- Full description from iClassPro
  age_min INTEGER,                            -- Minimum age from iClass settings
  age_max INTEGER,                            -- Maximum age from iClass settings
  
  -- Data Quality Fields
  has_flyer BOOLEAN DEFAULT FALSE,            -- Whether event has a flyer/image
  flyer_url TEXT,                             -- URL to the flyer image
  description_status TEXT DEFAULT 'unknown',  -- none, flyer_only, full, unknown
  validation_errors JSONB DEFAULT '[]',       -- Array of validation issues
  acknowledged_errors JSONB DEFAULT '[]',     -- Array of dismissed errors
  verified_errors JSONB DEFAULT '[]',         -- Array of admin-verified errors
  
  -- Availability Tracking
  has_openings BOOLEAN DEFAULT TRUE,          -- From iClassPro hasOpenings
  registration_start_date DATE,               -- When registration opens
  registration_end_date DATE,                 -- When registration closes
  availability_status TEXT DEFAULT 'available',
  
  -- Legacy/Internal Fields
  event_type VARCHAR,                         -- Legacy field
  gym_code VARCHAR,                           -- Legacy field  
  event_id BIGINT,                            -- iClassPro event ID
  
  -- Timestamps
  deleted_at TIMESTAMPTZ,                     -- Soft delete timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 2. EVENTS_ARCHIVE TABLE

**Purpose:** Stores past events (auto-archived at midnight)  
**Row Count:** Varies (auto-populated)  
**Column Count:** 32

```sql
events_archive (
  id UUID PRIMARY KEY,
  gym_id TEXT,
  title TEXT,
  date DATE,
  start_date DATE,
  end_date DATE,
  time TEXT,
  price TEXT,
  day_of_week TEXT,
  type TEXT,
  event_url TEXT,
  age_min INTEGER,
  age_max INTEGER,
  description TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW(),     -- When moved to archive
  event_type_id UUID,
  event_type VARCHAR,
  gym_code VARCHAR,
  event_id BIGINT,
  -- Data Quality Fields
  has_flyer BOOLEAN DEFAULT FALSE,
  flyer_url TEXT,
  description_status TEXT DEFAULT 'unknown',
  validation_errors JSONB DEFAULT '[]',
  acknowledged_errors JSONB DEFAULT '[]',
  -- Availability Tracking (must match events table for view to work)
  has_openings BOOLEAN DEFAULT TRUE,
  registration_start_date DATE,
  registration_end_date DATE,
  availability_status TEXT
)
```

**Auto-Archive:** pg_cron job runs at midnight to move past events here.

---

## 3. GYMS TABLE

**Purpose:** Gym master data  
**Row Count:** 10  
**Column Count:** 12

```sql
gyms (
  id VARCHAR PRIMARY KEY,           -- Short codes: CCP, CPF, EST, etc.
  name VARCHAR NOT NULL,            -- Full gym name
  location VARCHAR,                 -- State: TX, AZ, CA
  manager VARCHAR,                  -- Manager name
  phone VARCHAR,                    -- Contact phone
  email VARCHAR,                    -- Contact email
  address TEXT,                     -- Physical address
  website_url TEXT,                 -- Website
  google_maps_url TEXT,             -- Maps link
  logo_url TEXT,                    -- Gym logo image URL
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Current Gyms (10):

| ID | Name | Location |
|----|------|----------|
| CCP | Capital Gymnastics Cedar Park | TX |
| CPF | Capital Gymnastics Pflugerville | TX |
| CRR | Capital Gymnastics Round Rock | TX |
| EST | Estrella Gymnastics | AZ |
| HGA | Houston Gymnastics Academy | TX |
| OAS | Oasis Gymnastics | AZ |
| RBA | Rowland Ballard Atascocita | TX |
| RBK | Rowland Ballard Kingwood | TX |
| SGT | Scottsdale Gymnastics | AZ |
| TIG | Tigar Gymnastics | CA |

---

## 4. EVENT_TYPES TABLE

**Purpose:** Event categories for tracking  
**Row Count:** 3 (tracked types)  
**Column Count:** 9

```sql
event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,            -- KIDS NIGHT OUT, CLINIC, OPEN GYM
  display_name TEXT,                -- KNO, CLINIC, OPEN GYM
  description TEXT,                 -- Category description
  color VARCHAR,                    -- Hex color for UI
  is_tracked BOOLEAN DEFAULT TRUE,  -- Include in requirements
  minimum_required INTEGER DEFAULT 1, -- Monthly requirement count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Current Event Types:

| Name | Display | Color | Min Required |
|------|---------|-------|--------------|
| KIDS NIGHT OUT | KNO | #8B5CF6 (Purple) | 2 |
| CLINIC | CLINIC | #3B82F6 (Blue) | 1 |
| OPEN GYM | OPEN GYM | #10B981 (Green) | 1 |

**Note:** CAMP and SPECIAL EVENTS exist in the `type` field but are not in this table for requirement tracking.

---

## 5. GYM_LINKS TABLE

**Purpose:** Portal URLs for each gym/event type  
**Row Count:** 76  
**Column Count:** 10

```sql
gym_links (
  id SERIAL PRIMARY KEY,
  gym_id TEXT NOT NULL,             -- FK to gyms.id
  link_type_id TEXT NOT NULL,       -- FK to link_types.id
  url TEXT NOT NULL,                -- Portal URL
  title TEXT,                       -- Link title
  description TEXT,                 -- Link description
  is_active BOOLEAN DEFAULT TRUE,   -- Whether link is active
  sort_order INTEGER DEFAULT 0,     -- Display order
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Usage:** Powers Bulk Actions buttons and Automated Sync.

---

## 6. LINK_TYPES TABLE

**Purpose:** Categories for gym links  
**Row Count:** 10  
**Column Count:** 9

```sql
link_types (
  id TEXT PRIMARY KEY,              -- booking, skill_clinics, etc.
  label TEXT NOT NULL,              -- Human-readable name
  display_label TEXT NOT NULL,      -- With emoji: "📅 Booking"
  emoji TEXT DEFAULT '',            -- Just the emoji
  category TEXT DEFAULT 'Other',    -- Grouping category
  sort_order INTEGER DEFAULT 0,     -- Display order
  is_active BOOLEAN DEFAULT TRUE,   -- Whether type is active
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Current Link Types (10):

| ID | Label | Display | Emoji |
|----|-------|---------|-------|
| booking | Booking | 📅 Booking | 📅 |
| special_events | Special Events | ✨ Special Events | ✨ |
| kids_night_out | Kids Night Out | 🌙 Kids Night Out | 🌙 |
| open_gym | Open Gym | ⭐ Open Gym | ⭐ |
| skill_clinics | Skill Clinics | 🎯 Skill Clinics | 🎯 |
| camps | Camps | 🏕️ Camps | 🏕️ |
| camps_half | Camps Half Day | 🏕️ Camps (Half Day) | 🏕️ |
| camps_holiday | Camps Holiday | 🏕️ Holiday Camps | 🏕️ |
| camps_summer_full | Summer Camp Full Day | ☀️ Summer Camp (Full Day) | ☀️ |
| camps_summer_half | Summer Camp Half Day | ☀️ Summer Camp (Half Day) | ☀️ |

---

## 7. MONTHLY_REQUIREMENTS TABLE

**Purpose:** Business rules for minimum events per month  
**Row Count:** 3  
**Column Count:** 2

```sql
monthly_requirements (
  event_type TEXT PRIMARY KEY,      -- CLINIC, KIDS NIGHT OUT, OPEN GYM
  required_count INTEGER NOT NULL   -- How many per month
)
```

### Current Requirements:

| Event Type | Required Count |
|------------|----------------|
| CLINIC | 1 |
| KIDS NIGHT OUT | 2 |
| OPEN GYM | 1 |

---

## 8. EVENT_AUDIT_LOG TABLE

**Purpose:** Track all changes to events  
**Row Count:** 1,198  
**Column Count:** 11

```sql
event_audit_log (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,           -- Which event was changed
  gym_id TEXT NOT NULL,             -- Which gym
  action TEXT NOT NULL,             -- CREATE, UPDATE, DELETE
  field_changed TEXT,               -- Which field changed
  old_value TEXT,                   -- Previous value
  new_value TEXT,                   -- New value
  changed_by TEXT DEFAULT 'Bulk Import',  -- Who made the change
  changed_at TIMESTAMPTZ DEFAULT NOW(),   -- When
  event_title TEXT,                 -- Event title for reference
  event_date DATE                   -- Event date for reference
)
```

---

## 9. SYNC_LOG TABLE

**Purpose:** Track sync progress per gym/type  
**Row Count:** 51  
**Column Count:** 6

```sql
sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id TEXT NOT NULL,             -- Which gym (CCP, EST, etc.)
  event_type TEXT NOT NULL,         -- Which type (CLINIC, CAMP, etc.)
  last_synced TIMESTAMPTZ DEFAULT NOW(),  -- When last synced
  events_found INTEGER DEFAULT 0,   -- How many collected
  events_imported INTEGER DEFAULT 0 -- How many imported
  -- UNIQUE(gym_id, event_type)
)
```

**Usage:** Powers the Sync Progress Tracker grid with color coding:
- 🟢 Green = Synced with events found
- 🟡 Yellow = Synced but no events
- 🔴 Red = Never synced

---

## 10. GYM_VALID_VALUES TABLE

**Purpose:** Per-gym rules for valid prices, times, and program synonyms. Prevents false positive validation errors.
**Row Count:** Varies
**Column Count:** 7

```sql
gym_valid_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id TEXT NOT NULL,              -- FK to gyms.id (CCP, EST, etc.) or 'ALL' for global
  rule_type TEXT NOT NULL,           -- 'price', 'time', or 'program_synonym'
  value TEXT NOT NULL,               -- '20' for price, '8:30 AM' for time, 'gym fun friday' for synonym
  label TEXT NOT NULL,               -- 'Before Care', 'Early Dropoff', 'OPEN GYM'
  event_type TEXT DEFAULT 'CAMP',    -- Target event type (for synonyms: the program it maps to)
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- UNIQUE(gym_id, rule_type, value, event_type)
)
```

**Rule Types:**

| rule_type | value | label | Used For |
|-----------|-------|-------|----------|
| `price` | `20` | Before Care | Camp price exceptions |
| `time` | `8:30 am` | Early Dropoff | Time validation exceptions |
| `program_synonym` | `gym fun friday` | OPEN GYM | Program name variations |

**Special gym_id values:**
- `ALL` — rule applies to every gym (global rule)
- Gym-specific rules (e.g., `RBA`) override or extend global rules

**Example Rules:**

| gym_id | rule_type | value | label | event_type |
|--------|-----------|-------|-------|------------|
| RBA | price | 20 | Before Care | CAMP |
| RBA | price | 20 | After Care | CAMP |
| RBK | time | 8:30 am | Early Dropoff | CAMP |
| ALL | program_synonym | gym fun friday | OPEN GYM | OPEN GYM |
| ALL | program_synonym | fun gym | OPEN GYM | OPEN GYM |
| ALL | program_synonym | preschool fun | OPEN GYM | OPEN GYM |
| ALL | program_synonym | bonus tumbling | OPEN GYM | OPEN GYM |

**Usage:** During sync, the Python backend fetches these rules and skips validation errors that match. The React frontend can create rules via the dismiss flow or Admin Portal.

---

## 11. EVENT_PRICING TABLE

**Purpose:** Source of truth for non-camp event prices (CLINIC, KNO, OPEN GYM) with effective_date support  
**Row Count:** Varies  
**Column Count:** 8

```sql
event_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL,              -- FK to gyms.id (CCP, EST, etc.)
  event_type VARCHAR NOT NULL,          -- CLINIC, KIDS NIGHT OUT, OPEN GYM
  price NUMERIC NOT NULL,               -- e.g., 40.00
  effective_date DATE NOT NULL,         -- When this price takes effect
  end_date DATE,                        -- NULL = still active, or date when price expired
  notes TEXT,                           -- e.g., "Price increase Feb 10, 2026"
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Usage:** During sync, the scraper looks up the correct price for a gym/event_type where `effective_date <= today` and (`end_date IS NULL` or `end_date >= today`). If the portal price doesn't match, an `event_price_mismatch` error is generated.

---

## 12. CAMP_PRICING TABLE

**Purpose:** Source of truth for camp prices per gym (full day/half day, daily/weekly)  
**Row Count:** 10 (one per gym)  
**Column Count:** 8

```sql
camp_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL,              -- FK to gyms.id
  full_day_daily NUMERIC,               -- Full day single-day price
  full_day_weekly NUMERIC,              -- Full day weekly price
  half_day_daily NUMERIC,               -- Half day single-day price
  half_day_weekly NUMERIC,              -- Half day weekly price
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Usage:** During camp validation, description prices are compared against this table. Tolerance: ±$2.

---

## 13. ACKNOWLEDGED_PATTERNS TABLE

**Purpose:** Bulk dismiss patterns per gym/event type for recurring false positives  
**Row Count:** Varies  
**Column Count:** 7

```sql
acknowledged_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL,              -- FK to gyms.id
  event_type VARCHAR NOT NULL,          -- CLINIC, KIDS NIGHT OUT, etc.
  error_message TEXT NOT NULL,          -- The validation error message to match
  note TEXT,                            -- Optional reason for dismissing
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Additional columns may exist
)
```

**Usage:** When a validation error matches a pattern in this table (same gym_id, event_type, and error_message), it is automatically dismissed during sync.

---

## VIEWS

### events_with_gym

**Purpose:** Main view for frontend - UNION of events + events_archive with gym names

```sql
CREATE OR REPLACE VIEW events_with_gym AS
-- Active events
SELECT 
  e.id, e.gym_id, e.title, e.date, e.time, e.price, e.type,
  e.event_url, e.day_of_week, e.start_date, e.end_date,
  e.description, e.age_min, e.age_max, e.deleted_at,
  e.created_at, e.updated_at, e.availability_status,
  e.has_flyer, e.flyer_url, e.description_status,
  e.validation_errors, e.acknowledged_errors, e.verified_errors,
  g.name AS gym_name, g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id
WHERE e.deleted_at IS NULL

UNION ALL

-- Archived events
SELECT 
  a.id, a.gym_id, a.title, a.date, a.time, a.price, a.type,
  a.event_url, a.day_of_week, a.start_date, a.end_date,
  a.description, a.age_min, a.age_max, a.deleted_at,
  a.created_at, a.updated_at, a.availability_status,
  a.has_flyer, a.flyer_url, a.description_status,
  a.validation_errors, a.acknowledged_errors, a.verified_errors,
  g.name AS gym_name, g.id AS gym_code
FROM events_archive a
LEFT JOIN gyms g ON a.gym_id = g.id;
```

**Why UNION ALL?** Archived events still display on calendar.

---

### gym_links_detailed

**Purpose:** Joins gym_links with gyms and link_types for display

```sql
CREATE OR REPLACE VIEW gym_links_detailed AS
SELECT 
  gl.id,
  gl.gym_id,
  g.name AS gym_name,
  gl.link_type_id,
  lt.label AS link_type_label,
  lt.display_label AS link_type_name,
  gl.url,
  gl.is_active,
  lt.sort_order
FROM gym_links gl
JOIN gyms g ON gl.gym_id = g.id
JOIN link_types lt ON gl.link_type_id = lt.id
WHERE gl.is_active = true AND lt.is_active = true
ORDER BY g.name, lt.sort_order;
```

---

## 📊 DATA RELATIONSHIPS

```
gyms (10 rows)
  │
  ├──< events (401 rows)
  │     └── gym_id → gyms.id
  │
  ├──< events_archive (154 rows)
  │     └── gym_id → gyms.id
  │
  ├──< gym_links (76 rows)
  │     ├── gym_id → gyms.id
  │     └── link_type_id → link_types.id
  │
  ├──< sync_log (51 rows)
  │     └── gym_id → gyms.id
  │
  └──< event_audit_log (1,198 rows)
        └── gym_id → gyms.id
  │
  └──< gym_valid_values
        └── gym_id → gyms.id
  │
  ├──< event_pricing
  │     └── gym_id → gyms.id
  │
  ├──< camp_pricing
  │     └── gym_id → gyms.id
  │
  └──< acknowledged_patterns
        └── gym_id → gyms.id

link_types (10 rows)
  └──< gym_links (76 rows)

event_types (3 rows)
  └── Used for requirement tracking

monthly_requirements (3 rows)
  └── Business rules for event counts

VIEWS:
  events_with_gym = UNION ALL(events, events_archive) + gyms
  gym_links_detailed = gym_links + gyms + link_types
```

---

## 🔧 SCHEDULED JOBS

### daily-archive-old-events (pg_cron)

**Schedule:** Midnight (0 0 * * *)  
**Purpose:** Auto-moves past events to events_archive

```sql
-- Runs automatically at midnight
INSERT INTO events_archive (...) 
SELECT ... FROM events WHERE date < CURRENT_DATE;

DELETE FROM events WHERE date < CURRENT_DATE;
```

---

## 🔐 SECURITY & PERMISSIONS

### Connection Methods:
- ✅ **Frontend** uses ANON key (read access only)
- ✅ **Railway backend** uses SERVICE key (write access)
- ✅ Environment variables properly configured

### Row Level Security:
- Events table: Public read, restricted write
- Sync log: Public read/write for app

---

## 🚀 PERFORMANCE

### Recommended Indexes:
```sql
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_gym_date ON events(gym_id, date);
CREATE INDEX idx_events_url ON events(event_url);
CREATE INDEX idx_sync_log_gym_type ON sync_log(gym_id, event_type);
CREATE INDEX idx_events_description_status ON events(description_status);
```

### Caching:
- Frontend caches event data (5-minute TTL)
- Real-time subscriptions for live updates

---

## 📊 DATA FLOW

```
Automated Sync (Railway)
    ↓
Playwright collects from iClassPro
    ↓
Returns to React frontend
    ↓
Frontend compares with Supabase
    ↓
User clicks Import
    ↓
Railway writes to Supabase (service key)
    ↓
Real-time subscription updates calendar
    ↓
At midnight: pg_cron moves past events to events_archive
```

---

## 🔧 SQL SCRIPTS FOR ADDING COLUMNS

### Add Data Quality Columns:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_flyer BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description_status TEXT DEFAULT 'unknown';
ALTER TABLE events ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]'::jsonb;
```

### Add Availability Columns:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_openings BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_end_date DATE;
```

> **Remember:** When adding columns to `events`, also add them to `events_archive` and update the `events_with_gym` view!

---

## 🔑 KEY DESIGN DECISIONS

### 1. Gym IDs as Short Codes
- Using `CCP`, `EST`, `OAS` instead of UUIDs
- Makes debugging easier
- Human-readable in logs
- Matches portal slugs

### 2. event_url as Unique Identifier
- Each event has a unique iClassPro URL
- Used for comparison (NEW/CHANGED/DELETED)
- More reliable than title matching

### 3. Soft Delete Pattern
- `deleted_at` timestamp instead of hard delete
- Events removed from portal get soft-deleted
- Can be restored if they come back
- View filters out deleted events

### 4. Type as TEXT (not FK)
- Using `type TEXT` instead of `event_type_id UUID`
- Simpler for queries
- Direct string matching
- Works well for filtering

### 5. Price Extraction
- **Price is parsed from title/description**, NOT from iClassPro's pricing API
- Format like `($25)` in event titles is extracted via regex
- Stored as TEXT not DECIMAL (display purposes only)

### 6. Volatile Fields Excluded from Comparison
- Fields like `has_openings`, `registration_start_date` are saved but don't trigger "CHANGED" alerts
- Prevents false positives during sync

---

## 🛠️ USEFUL SQL COMMANDS

### Check Table Structure:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events'
ORDER BY ordinal_position;
```

### Check View Definition:
```sql
SELECT definition 
FROM pg_views 
WHERE viewname = 'events_with_gym';
```

### Check Indexes:
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public';
```

### Count Records:
```sql
SELECT 
  (SELECT COUNT(*) FROM events) as active_events,
  (SELECT COUNT(*) FROM events_archive) as archived_events,
  (SELECT COUNT(*) FROM gyms) as gyms,
  (SELECT COUNT(*) FROM gym_links WHERE is_active = true) as gym_links,
  (SELECT COUNT(*) FROM sync_log) as sync_log;
```

---

## 📜 MIGRATION HISTORY

| Date | Change |
|------|--------|
| Sept 2025 | Initial database setup |
| Sept 2025 | Removed email template tables |
| Oct 2025 | Added event_audit_log |
| Nov 2025 | Added description column |
| Nov 2025 | Added age_min, age_max columns |
| Nov 2025 | Added deleted_at column |
| Nov 2025 | Created sync_log table |
| Nov 2025 | Recreated events_with_gym view |
| Dec 2025 | Created events_archive table |
| Dec 2025 | Set up pg_cron auto-archive job |
| Dec 2025 | Updated events_with_gym to UNION both tables |
| Dec 2025 | Added data quality columns |
| Dec 2025 | Added acknowledged_errors column |
| Dec 2025 | Added availability columns |
| Feb 2, 2026 | Added program_synonym rule type and ALL (global) gym support |
| Feb 2, 2026 | Created gym_valid_values table for per-gym validation rules |
| Feb 2026 | Created event_pricing table for Clinic/KNO/Open Gym prices |
| Feb 2026 | Created acknowledged_patterns table for bulk dismiss |
| Feb 2026 | Added verified_errors column to events table |
| Dec 28, 2025 | Full schema audit - documented all 30 columns |

---

## 📝 Change Log

| Date | Change |
|------|--------|
| Feb 2, 2026 | Added gym_valid_values table documentation |
| Dec 28, 2025 | Created complete schema documentation |
| Dec 28, 2025 | Documented all 9 tables with exact column counts |
| Dec 28, 2025 | Added all current data (link_types, event_types, etc.) |
| Dec 28, 2025 | Fixed: events_archive missing has_openings, registration dates |
| Dec 28, 2025 | Changed row counts to approximate (they change frequently) |
| Dec 28, 2025 | Merged SUPABASE_AUDIT_REPORT.md content (security, performance, data flow) |

---

**This is the complete database schema for the Master Events Calendar!** 🏆


