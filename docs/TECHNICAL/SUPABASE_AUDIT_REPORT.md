# 🔍 SUPABASE DATABASE AUDIT REPORT
## Master Events Calendar - Complete Analysis

**Last Updated:** December 28, 2025  
**Database:** `xftiwouxpefchwoxxgpf.supabase.co`  
**Status:** ✅ PRODUCTION READY - FULLY DEPLOYED & VERIFIED

---

## 📊 DATABASE OVERVIEW

### **Overall Health: EXCELLENT** ⭐⭐⭐⭐⭐

**Connection Status:** ✅ Connected and responsive  
**Tables:** 9 core tables + 2 views  
**Total Events:** 555 (401 active + 154 archived)  
**Gym Links:** 76 active links  
**Data Integrity:** ✅ All relationships working  
**Last Verified:** December 28, 2025

---

## 📋 TABLE INVENTORY

| Table | Rows | Status | Purpose |
|-------|------|--------|---------|
| **gyms** | 10 | ✅ | Gym master data |
| **events** | 401 | ✅ | Active/future events |
| **events_archive** | 154 | ✅ | Past events (auto-archived) |
| **event_types** | 5 | ✅ | Event categories |
| **gym_links** | 76 | ✅ | Portal URLs |
| **link_types** | 8 | ✅ | Link categories |
| **monthly_requirements** | 3 | ✅ | Business rules |
| **event_audit_log** | 300+ | ✅ | Change tracking |
| **sync_log** | 50+ | ✅ | Sync progress tracking |

### **Database Views:**
- ✅ **events_with_gym** - UNION ALL of events + events_archive with gym names
- ✅ **gym_links_detailed** - Joins links + types

---

## 🏢 GYMS TABLE

### **Structure:**
```sql
gyms (
  id TEXT PRIMARY KEY,           -- Short codes: CCP, CPF, EST, etc.
  name TEXT,                     -- Full gym name
  location TEXT,                 -- State: TX, AZ, CA
  manager TEXT,                  -- Manager name (optional)
  phone TEXT,                    -- Contact phone
  email TEXT,                    -- Contact email
  address TEXT,                  -- Physical address
  website_url TEXT,              -- Website
  google_maps_url TEXT,          -- Maps link
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### **Current Data: 10 Gyms**

| ID | Name | Location | Portal Slug |
|----|------|----------|-------------|
| CCP | Capital Gymnastics Cedar Park | TX | capgymavery |
| CPF | Capital Gymnastics Pflugerville | TX | capgymhp |
| CRR | Capital Gymnastics Round Rock | TX | capgymroundrock |
| EST | Estrella Gymnastics | AZ | estrellagymnastics |
| HGA | Houston Gymnastics Academy | TX | houstongymnastics |
| OAS | Oasis Gymnastics | AZ | oasisgymnastics |
| RBA | Rowland Ballard Atascocita | TX | rbatascocita |
| RBK | Rowland Ballard Kingwood | TX | rbkingwood |
| SGT | Scottsdale Gymnastics | AZ | scottsdalegymnastics |
| TIG | TIGAR Gymnastics | CA | tigar |

---

## 📅 EVENTS TABLE

### **Structure (UPDATED December 2025):**
```sql
events (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id VARCHAR NOT NULL,                    -- FK to gyms.id
  event_type_id UUID,                         -- FK to event_types.id (nullable)
  title VARCHAR NOT NULL,                     -- Event name
  date DATE NOT NULL,                         -- Event date
  start_date DATE,                            -- Multi-day start
  end_date DATE,                              -- Multi-day end
  time VARCHAR,                               -- Time range "6:30 PM - 9:30 PM"
  price VARCHAR,                              -- Cost (nullable, parsed from title/description)
  day_of_week VARCHAR,                        -- Computed field
  type VARCHAR NOT NULL,                      -- Event category (CLINIC, CAMP, etc.)
  event_url TEXT,                             -- Registration link (UNIQUE identifier!)
  
  -- Content fields
  description TEXT,                           -- Full event description from iClassPro
  age_min INTEGER,                            -- Minimum age from iClass settings
  age_max INTEGER,                            -- Maximum age from iClass settings
  
  -- Data quality fields (December 2025)
  has_flyer BOOLEAN DEFAULT FALSE,            -- Whether event has a flyer/image
  flyer_url TEXT,                             -- URL to the flyer image
  description_status TEXT DEFAULT 'unknown',  -- none, flyer_only, full, unknown
  validation_errors JSONB DEFAULT '[]',       -- Array of validation issues found
  acknowledged_errors JSONB DEFAULT '[]',     -- Array of dismissed validation errors
  
  -- Availability tracking (December 2025)
  has_openings BOOLEAN DEFAULT TRUE,          -- From iClassPro hasOpenings
  registration_start_date DATE,               -- When registration opens
  registration_end_date DATE,                 -- When registration closes
  availability_status TEXT DEFAULT 'available',
  
  -- Legacy/internal fields
  event_type VARCHAR,                         -- Legacy field
  gym_code VARCHAR,                           -- Legacy field  
  event_id BIGINT,                            -- iClassPro event ID
  
  -- Timestamps
  deleted_at TIMESTAMPTZ,                     -- Soft delete timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### **Column Count: 30 columns**

### **Current Data: 401 Active Events**

**Sample Event:**
```json
{
  "id": "f8334a68-6db8-4c17-a756-13c8537e0be5",
  "gym_id": "EST",
  "title": "Clinic | Backhandspring Saturday, December 13th",
  "date": "2025-12-13",
  "time": "2:00 PM - 3:00 PM",
  "price": "25",
  "type": "CLINIC",
  "event_url": "https://portal.iclasspro.com/estrellagymnastics/camp-details/574",
  "age_min": 7,
  "age_max": 15,
  "description": "Join us for our exciting Back Handspring Skills Clinic...",
  "has_flyer": true,
  "has_openings": true,
  "validation_errors": [],
  "acknowledged_errors": []
}
```

---

## 📦 EVENTS_ARCHIVE TABLE

### **Structure:**
```sql
events_archive (
  -- Same structure as events table
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
  availability_status TEXT,
  has_flyer BOOLEAN DEFAULT FALSE,
  flyer_url TEXT,
  description_status TEXT DEFAULT 'unknown',
  validation_errors JSONB DEFAULT '[]',
  acknowledged_errors JSONB DEFAULT '[]'
)
```

### **Current Data: 154 Archived Events**

### **Purpose:**
- Stores past events that have been automatically archived
- Keeps the main `events` table clean for sync comparisons
- Calendar/stats still display archived events via the view

---

## 📊 SYNC_LOG TABLE

### **Structure:**
```sql
sync_log (
  id UUID PRIMARY KEY,
  gym_id TEXT NOT NULL,          -- Which gym
  event_type TEXT NOT NULL,      -- Which event type
  last_synced TIMESTAMPTZ,       -- When last synced
  events_found INTEGER,          -- How many collected
  events_imported INTEGER,       -- How many imported
  UNIQUE(gym_id, event_type)     -- One row per gym+type combo
)
```

### **Purpose:**
Tracks sync progress for the Sync Progress Tracker grid.

**Color Coding:**
- 🟢 Green = Synced with events found
- 🟡 Yellow = Synced but no events
- 🔴 Red = Never synced

---

## 🏷️ EVENT_TYPES TABLE

### **Current Data: 5 Event Types**

| Name | Display | Color | Tracked |
|------|---------|-------|---------|
| KIDS NIGHT OUT | KNO | #8B5CF6 (Purple) | ✅ |
| CLINIC | CLINIC | #3B82F6 (Blue) | ✅ |
| OPEN GYM | OPEN GYM | #10B981 (Green) | ✅ |
| CAMP | CAMP | #F59E0B (Orange) | ✅ |
| SPECIAL EVENTS | SE | #EC4899 (Pink) | ✅ |

---

## 🔗 GYM_LINKS TABLE

### **Structure:**
```sql
gym_links (
  id SERIAL PRIMARY KEY,
  gym_id TEXT,                   -- FK to gyms.id
  link_type_id TEXT,             -- FK to link_types.id
  url TEXT,                      -- Portal URL
  portal_slug TEXT,              -- For automation
  title TEXT,
  description TEXT,
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### **Current Data: 76 Active Links**

**Link Types:**
- `skill_clinics` - Clinic pages
- `kids_night_out` - KNO pages
- `open_gym` - Open Gym pages
- `booking` - Main booking pages
- `camps` - School year full day camps
- `camps_half` - School year half day camps
- `summer_camps` - Summer full day camps
- `summer_camps_half` - Summer half day camps

---

## 👁️ EVENTS_WITH_GYM VIEW

### **CRITICAL:** This view uses UNION ALL to combine events + events_archive!

### **Current Structure:**
```sql
CREATE OR REPLACE VIEW events_with_gym AS
-- Active events from main table
SELECT 
  e.id, e.gym_id, e.event_type_id, e.title, e.date, e.time,
  e.price, e.day_of_week, e.type, e.event_url, e.created_at,
  e.updated_at, e.event_type, e.gym_code, e.event_id, e.start_date,
  e.end_date, e.availability_status, e.age_min, e.age_max,
  e.description, e.deleted_at, e.has_flyer, e.flyer_url,
  e.description_status, e.validation_errors, e.acknowledged_errors,
  g.name AS gym_name
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id
WHERE e.deleted_at IS NULL

UNION ALL

-- Archived events from archive table
SELECT 
  a.id, a.gym_id, a.event_type_id, a.title, a.date, a.time,
  a.price, a.day_of_week, a.type, a.event_url, a.created_at,
  a.updated_at, a.event_type, a.gym_code, a.event_id, a.start_date,
  a.end_date, a.availability_status, a.age_min, a.age_max,
  a.description, a.deleted_at, a.has_flyer, a.flyer_url,
  a.description_status, a.validation_errors, a.acknowledged_errors,
  g.name AS gym_name
FROM events_archive a
LEFT JOIN gyms g ON a.gym_id = g.id;
```

**Why UNION ALL?**
- Archived events still appear on the calendar
- Stats/analytics include historical data
- No visual changes to the app when events are archived

---

## 🔐 SECURITY & PERMISSIONS

### **Connection Method:**
- ✅ Frontend uses ANON key (read access)
- ✅ Railway backend uses SERVICE key (write access)
- ✅ Environment variables properly configured

### **Row Level Security:**
- Events table: Public read, restricted write
- Sync log: Public read/write for app

---

## 🚀 PERFORMANCE

### **Indexes (Recommended):**
```sql
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_gym_date ON events(gym_id, date);
CREATE INDEX idx_events_url ON events(event_url);
CREATE INDEX idx_sync_log_gym_type ON sync_log(gym_id, event_type);
CREATE INDEX idx_events_description_status ON events(description_status);
CREATE INDEX idx_events_has_validation_errors ON events((validation_errors != '[]'::jsonb));
```

### **Caching:**
- Frontend caches event data
- 5-minute TTL for events
- Real-time subscriptions for updates

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

## 🎯 KEY FINDINGS (December 2025)

### **✅ STRENGTHS:**

1. **Professional Architecture**
   - Normalized database design
   - Proper foreign keys
   - Smart use of views
   - Complete audit trail
   - Auto-archive system

2. **All Columns Working**
   - description ✅
   - age_min ✅
   - age_max ✅
   - deleted_at ✅
   - has_flyer ✅
   - flyer_url ✅
   - description_status ✅
   - validation_errors ✅
   - acknowledged_errors ✅
   - has_openings ✅
   - registration_start_date ✅
   - registration_end_date ✅

3. **Sync Log Working**
   - Tracks all sync progress
   - Powers the visual grid
   - Persists across sessions

4. **Auto-Archive Working**
   - pg_cron runs at midnight
   - Past events move to events_archive
   - Calendar still displays archived events

5. **100% Data Accuracy**
   - Verified against live iClassPro
   - All 10 gyms syncing correctly
   - All 5 event types working

### **⚠️ NOTES:**

1. **Price is parsed from title/description** - Not pulled from iClassPro's pricing API. This means price appears in format like `($25)` in event titles.

2. **Price as TEXT** - Price is stored as TEXT not DECIMAL. This is fine for display purposes.

3. **Event comparison excludes volatile fields** - Fields like `has_openings`, `registration_start_date`, etc. are saved but don't trigger "CHANGED" alerts (prevents false positives).

---

## 📝 SQL SCRIPTS FOR REFERENCE

### **Add Data Quality Columns:**
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_flyer BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description_status TEXT DEFAULT 'unknown';
ALTER TABLE events ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS acknowledged_errors JSONB DEFAULT '[]'::jsonb;
```

### **Add Availability Columns:**
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_openings BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_end_date DATE;
```

### **Create Archive Table:**
```sql
CREATE TABLE events_archive (
  -- Same columns as events table
  archived_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Auto-Archive Function:**
```sql
CREATE OR REPLACE FUNCTION auto_archive_old_events()
RETURNS void AS $$
BEGIN
  INSERT INTO events_archive (...)
  SELECT ... FROM events 
  WHERE date < CURRENT_DATE
  AND id NOT IN (SELECT id FROM events_archive);
  
  DELETE FROM events WHERE date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎉 FINAL VERDICT

### **Database Grade: A+**

**Your Supabase setup is EXCELLENT and PRODUCTION READY!**

**What Works:**
- ✅ All 10 gyms
- ✅ All 5 event types
- ✅ 555 total events (401 active, 154 archived)
- ✅ 76 gym links
- ✅ Descriptions pulling correctly
- ✅ Ages pulling correctly
- ✅ Sync progress tracking
- ✅ Soft delete working
- ✅ Auto-archive working
- ✅ Data quality tracking
- ✅ 100% accuracy verified

---

## 📝 Change Log

| Date | Change |
|------|--------|
| Nov 2025 | Original audit completed |
| Dec 2025 | Added events_archive table |
| Dec 2025 | Added data quality columns |
| Dec 2025 | Added availability columns |
| Dec 2025 | Set up auto-archive pg_cron job |
| Dec 28, 2025 | Full schema audit with all 30 columns |

---

**Audit Completed:** December 28, 2025  
**Database:** xftiwouxpefchwoxxgpf.supabase.co  
**Status:** ✅ PRODUCTION READY - FULLY VERIFIED

