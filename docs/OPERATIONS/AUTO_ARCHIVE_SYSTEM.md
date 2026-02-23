# 🗄️ AUTO-ARCHIVE SYSTEM
## Automatic Event Archiving for Master Events Calendar

**Last Updated:** February 23, 2026  
**Status:** ✅ Active & Running  
**Location:** Supabase pg_cron (runs automatically at midnight)

---

## 📋 OVERVIEW

The auto-archive system automatically moves past events from the `events` table to the `events_archive` table at midnight every day. This keeps the main table clean while preserving all historical data.

### **Key Points:**
- ✅ **Calendar display is NOT affected** - archived events still show
- ✅ **Stats/analytics still work** - includes all archived events
- ✅ **Runs automatically** - no manual intervention needed
- ✅ **Safe operation** - events are copied before deleted

---

## 🗑️ EVENT DELETION LIFECYCLE

When a manager removes an event from iClassPro, here's exactly what happens:

| Step | What Happens | Where |
|------|-------------|-------|
| 1. Manager deletes event | Event disappears from iClassPro portal | iClassPro |
| 2. Next sync runs | Sync detects event is gone from portal but still in database | Your app |
| 3. Soft-delete | System sets `deleted_at` timestamp on the row. Event stays in `events` table. | `events` table |
| 4. UI hides it | The `events_with_gym` view filters `WHERE deleted_at IS NULL`, so it disappears from your calendar | Calendar UI |
| 5. Manual cleanup | Run the cleanup SQL to move soft-deleted events to `events_archive` | SQL Editor |

### ⚠️ CURRENT GAP
The midnight pg_cron job only archives events where `date < today` (past events). It does **NOT** automatically archive soft-deleted future events. This means deleted future events stay in the `events` table (hidden from UI but still there) until either:
- Their date passes and the midnight job picks them up
- You manually run the cleanup SQL in `database/ARCHIVE_SOFT_DELETED_EVENTS.sql`

### Cleanup SQL (run periodically in Supabase SQL Editor)
```sql
INSERT INTO events_archive (
  id, gym_id, title, date, time, price, type, event_url, day_of_week,
  start_date, end_date, description, age_min, age_max,
  deleted_at, created_at, updated_at,
  availability_status, has_flyer, flyer_url,
  description_status, validation_errors, acknowledged_errors,
  verified_errors, has_openings, registration_start_date, registration_end_date
)
SELECT
  id, gym_id, title, date::date, time, price, type, event_url, day_of_week,
  start_date, end_date, description, age_min, age_max,
  deleted_at, created_at, updated_at,
  availability_status, has_flyer, flyer_url,
  description_status, validation_errors, acknowledged_errors,
  verified_errors, has_openings, registration_start_date, registration_end_date
FROM events
WHERE deleted_at IS NOT NULL;

DELETE FROM events WHERE deleted_at IS NOT NULL;
```

### Check for lingering soft-deleted events
```sql
SELECT count(*) FROM events WHERE deleted_at IS NOT NULL;
-- Should return 0 after cleanup
```

---

## 🔧 HOW IT WORKS

### **1. Database Components**

| Component | Purpose |
|-----------|---------|
| `events` table | Active/future events only |
| `events_archive` table | Past events (archived) |
| `events_with_gym` view | UNION ALL of both tables |
| `auto_archive_old_events()` | Function that does the archiving |
| pg_cron job | Scheduler that runs at midnight |

### **2. The Archive Function**

```sql
CREATE OR REPLACE FUNCTION auto_archive_old_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Step 1: Copy past events to archive (skip duplicates)
  INSERT INTO events_archive (
    id, gym_id, title, date, start_date, end_date,
    time, price, day_of_week, type, event_url,
    age_min, age_max, description, deleted_at,
    created_at, updated_at,
    -- Data quality columns
    has_flyer, flyer_url, description_status,
    validation_errors, acknowledged_errors,
    -- Availability columns  
    has_openings, registration_start_date, registration_end_date
  )
  SELECT 
    id, gym_id, title, date, start_date, end_date,
    time, price, day_of_week, type, event_url,
    age_min, age_max, description, deleted_at,
    created_at, updated_at,
    has_flyer, flyer_url, description_status,
    validation_errors, acknowledged_errors,
    has_openings, registration_start_date, registration_end_date
  FROM events 
  WHERE date < CURRENT_DATE
  AND id NOT IN (SELECT id FROM events_archive);
  
  -- Step 2: Delete from main table
  DELETE FROM events 
  WHERE date < CURRENT_DATE;
END;
$$;
```

**Note:** The actual function in Supabase should include ALL columns. If new columns are added to `events`, the function may need to be updated.

### **3. The Cron Job**

```sql
-- Check the scheduled job
SELECT * FROM cron.job;

-- Result:
-- jobid: 1
-- schedule: "0 0 * * *"  (midnight every day)
-- command: "SELECT auto_archive_old_events();"
-- active: true
-- jobname: "daily-archive-old-events"
```

---

## 🎯 WHY THIS DOESN'T BREAK THE UI

The frontend queries the `events_with_gym` VIEW, not the `events` table directly.

This view uses **UNION ALL** to combine both tables:

```sql
CREATE VIEW events_with_gym AS
SELECT 
  e.id, e.gym_id, e.title, e.date, e.time, e.price, e.type, e.event_url,
  e.start_date, e.end_date, e.description, e.age_min, e.age_max,
  e.has_flyer, e.flyer_url, e.description_status, e.validation_errors,
  e.acknowledged_errors, e.deleted_at, e.created_at, e.updated_at,
  g.name AS gym_name, g.id AS gym_code
FROM events e
LEFT JOIN gyms g ON e.gym_id = g.id
WHERE e.deleted_at IS NULL

UNION ALL

SELECT 
  a.id, a.gym_id, a.title, a.date, -- ... same columns ...
  g.name AS gym_name, g.id AS gym_code
FROM events_archive a
LEFT JOIN gyms g ON a.gym_id = g.id;
```

**Result:** Whether an event is in `events` or `events_archive`, it appears in the view and displays on the calendar!

**Important:** The view filters out soft-deleted events (`WHERE e.deleted_at IS NULL`) from the active table.

---

## 🛠️ MANUAL OPERATIONS

### **Run Archive Manually (immediate cleanup):**
```sql
SELECT auto_archive_old_events();
```

### **Check Job Run History:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = 1 
ORDER BY start_time DESC 
LIMIT 10;
```

### **Check What Will Be Archived:**
```sql
SELECT gym_id, type, title, date 
FROM events 
WHERE date < CURRENT_DATE
ORDER BY date;
```

### **Check Archive Contents:**
```sql
SELECT gym_id, type, COUNT(*) as count
FROM events_archive
GROUP BY gym_id, type
ORDER BY gym_id, type;
```

### **Verify View Still Works:**
```sql
-- Should return events from BOTH tables
SELECT 
  CASE 
    WHEN id IN (SELECT id FROM events) THEN 'events'
    ELSE 'events_archive'
  END as source_table,
  COUNT(*)
FROM events_with_gym
GROUP BY 1;
```

---

## ⚙️ CONFIGURATION

### **Change Archive Timing:**

To archive events after a different delay (e.g., 7 days after):

```sql
CREATE OR REPLACE FUNCTION auto_archive_old_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO events_archive (...)
  SELECT ... FROM events 
  WHERE date < CURRENT_DATE - INTERVAL '7 days'  -- Change this
  AND id NOT IN (SELECT id FROM events_archive);
  
  DELETE FROM events 
  WHERE date < CURRENT_DATE - INTERVAL '7 days';  -- Match this
END;
$$;
```

### **Change Schedule:**

```sql
-- Delete existing job
SELECT cron.unschedule('daily-archive-old-events');

-- Create new job (e.g., run at 2 AM instead)
SELECT cron.schedule(
  'daily-archive-old-events',
  '0 2 * * *',  -- 2 AM every day
  'SELECT auto_archive_old_events();'
);
```

### **Disable Auto-Archive:**
```sql
UPDATE cron.job SET active = false WHERE jobname = 'daily-archive-old-events';
```

### **Re-enable Auto-Archive:**
```sql
UPDATE cron.job SET active = true WHERE jobname = 'daily-archive-old-events';
```

---

## 🔍 TROUBLESHOOTING

### **Events Not Being Archived?**

1. **Check if job is active:**
   ```sql
   SELECT active FROM cron.job WHERE jobname = 'daily-archive-old-events';
   ```

2. **Check job run history for errors:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = 1 
   ORDER BY start_time DESC 
   LIMIT 5;
   ```

3. **Check the archive timing in function:**
   ```sql
   SELECT prosrc FROM pg_proc WHERE proname = 'auto_archive_old_events';
   ```

### **Archived Events Not Showing on Calendar?**

1. **Verify view includes both tables:**
   ```sql
   SELECT definition FROM pg_views WHERE viewname = 'events_with_gym';
   -- Should contain UNION ALL
   ```

2. **Check if app queries the view:**
   - The `eventsApi.getAll()` function in `src/lib/api.js` should use `events_with_gym`

### **Want to Restore an Archived Event?**

```sql
-- Step 1: Move event back to main table
INSERT INTO events (
  id, gym_id, title, date, start_date, end_date,
  time, price, day_of_week, type, event_url,
  age_min, age_max, description, deleted_at,
  created_at, updated_at,
  has_flyer, flyer_url, description_status,
  validation_errors, acknowledged_errors,
  has_openings, registration_start_date, registration_end_date
)
SELECT 
  id, gym_id, title, date, start_date, end_date,
  time, price, day_of_week, type, event_url,
  age_min, age_max, description, deleted_at,
  created_at, updated_at,
  has_flyer, flyer_url, description_status,
  validation_errors, acknowledged_errors,
  has_openings, registration_start_date, registration_end_date
FROM events_archive 
WHERE id = 'your-event-id-here';

-- Step 2: Delete from archive
DELETE FROM events_archive WHERE id = 'your-event-id-here';
```

**Tip:** You can find the event ID by querying `events_archive` by title or date.

---

## 📊 MONITORING

### **Daily Health Check Query:**
```sql
SELECT 
  (SELECT COUNT(*) FROM events) as active_events,
  (SELECT COUNT(*) FROM events_archive) as archived_events,
  (SELECT COUNT(*) FROM events WHERE date < CURRENT_DATE) as pending_archive,
  (SELECT active FROM cron.job WHERE jobname = 'daily-archive-old-events') as job_active;
```

### **Expected Results:**
- `active_events`: Future/current events only
- `archived_events`: Growing over time
- `pending_archive`: Should be 0 after midnight
- `job_active`: Should be `true`

---

## 📝 CHANGELOG

| Date | Change |
|------|--------|
| Dec 28, 2025 | Documentation update - added data quality columns to examples |
| Dec 18, 2025 | Added acknowledged_errors column to archive table |
| Dec 9, 2025 | Created events_archive table |
| Dec 9, 2025 | Created auto_archive_old_events() function |
| Dec 9, 2025 | Set up pg_cron job for midnight execution |
| Dec 9, 2025 | Updated events_with_gym view to UNION ALL both tables |
| Dec 9, 2025 | Changed from 7-day delay to immediate (date < CURRENT_DATE) |

---

**System is fully automated and requires no manual intervention!** 🎉

