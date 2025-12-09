# 🗄️ AUTO-ARCHIVE SYSTEM
## Automatic Event Archiving for Master Events Calendar

**Created:** December 9, 2025  
**Status:** ✅ ACTIVE & RUNNING

---

## 📋 OVERVIEW

The auto-archive system automatically moves past events from the `events` table to the `events_archive` table at midnight every day. This keeps the main table clean while preserving all historical data.

### **Key Points:**
- ✅ **Calendar display is NOT affected** - archived events still show
- ✅ **Stats/analytics still work** - includes all archived events
- ✅ **Runs automatically** - no manual intervention needed
- ✅ **Safe operation** - events are copied before deleted

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
    created_at, updated_at
  )
  SELECT 
    id, gym_id, title, date, start_date, end_date,
    time, price, day_of_week, type, event_url,
    age_min, age_max, description, deleted_at,
    created_at, updated_at
  FROM events 
  WHERE date < CURRENT_DATE
  AND id NOT IN (SELECT id FROM events_archive);
  
  -- Step 2: Delete from main table
  DELETE FROM events 
  WHERE date < CURRENT_DATE;
END;
$$;
```

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
SELECT ... FROM events e LEFT JOIN gyms g ...
UNION ALL
SELECT ... FROM events_archive a LEFT JOIN gyms g ...
```

**Result:** Whether an event is in `events` or `events_archive`, it appears in the view and displays on the calendar!

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
-- Move event back to main table
INSERT INTO events 
SELECT id, gym_id, event_type_id, title, date, time, price, 
       day_of_week, type, event_url, created_at, updated_at,
       event_type, gym_code, event_id, start_date, end_date,
       availability_status, age_min, age_max, description, deleted_at
FROM events_archive 
WHERE id = 'your-event-id-here';

-- Delete from archive
DELETE FROM events_archive WHERE id = 'your-event-id-here';
```

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
| Dec 9, 2025 | Created events_archive table |
| Dec 9, 2025 | Created auto_archive_old_events() function |
| Dec 9, 2025 | Set up pg_cron job for midnight execution |
| Dec 9, 2025 | Updated events_with_gym view to UNION ALL both tables |
| Dec 9, 2025 | Changed from 7-day delay to immediate (date < CURRENT_DATE) |

---

**System is fully automated and requires no manual intervention!** 🎉

