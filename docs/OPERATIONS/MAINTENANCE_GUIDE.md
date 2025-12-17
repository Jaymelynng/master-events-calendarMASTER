# 🔧 Master Events Calendar - Maintenance Guide

> **Last Updated:** December 2024  
> **Purpose:** Keep your events calendar running smoothly with minimal effort

---

## 📋 Quick Reference

| Frequency | Time | Priority Tasks |
|-----------|------|----------------|
| Weekly | 5 mins | Sync all gyms |
| Monthly | 10 mins | Check requirements, export report |
| Quarterly | 15 mins | Review gym links, update goals |
| As Needed | Varies | Troubleshoot issues |

---

## 🔄 Weekly Maintenance (5 minutes)

### 1. Sync All Gyms
**Why:** Keeps events current with iClassPro

**Steps:**
1. Open the dashboard
2. Click **Admin** → **Sync Events**
3. Select each gym → Click **🚀 SYNC ALL PROGRAMS**
4. Wait for confirmation (green checkmarks)

**Pro Tip:** The sync progress grid shows green = synced, red = needs sync

### 2. Quick Audit Check
**Why:** Catch content issues before they become problems

**Steps:**
1. Look at the **Audit** indicators in the dashboard header
2. Check for:
   - 🔴 **Wrong** - Description doesn't match event details
   - 🟡 **Flyer only** - Has image but no text description
   - ❌ **Missing desc** - No description at all

---

## 📅 Monthly Maintenance (10 minutes)

### 1. Check Requirements Status
**Why:** Ensure gyms meet their event quotas

**Steps:**
1. Look at the **Status** column in the gym grid
2. ✅ **Complete** = Meeting all requirements
3. 🟠 **+1 CLINIC** etc. = Missing events

**Action:** Contact gyms that are consistently behind

### 2. Export Monthly Report
**Why:** Keep records and share with stakeholders

**Steps:**
1. Click **Export** button
2. Set date range to the month
3. Check: ☑️ Events, ☑️ Analytics, ☑️ Missing Requirements
4. Choose CSV or JSON
5. Download and archive

### 3. Review Soft-Deleted Events
**Why:** Sometimes events are temporarily removed from iClassPro

**Steps:**
1. Go to Supabase Dashboard
2. Query: `SELECT * FROM events WHERE deleted_at IS NOT NULL AND date > NOW()`
3. Review if any should be restored

---

## 🗓️ Quarterly Maintenance (15 minutes)

### 1. Verify Gym Links
**Why:** iClassPro URLs occasionally change

**Steps:**
1. Go to **Admin** → **Manage Gym Links**
2. For each gym, click one link to verify it works
3. If broken, update with the new URL from iClassPro

### 2. Review Monthly Requirements
**Why:** Business needs evolve

**Questions to ask:**
- Are the CLINIC/KNO/OPEN GYM targets still appropriate?
- Any new event types to track?
- Any gyms to add or remove?

### 3. Clean Up Old Data (Optional)
**Why:** Keep database performant

```sql
-- See how many old events exist
SELECT COUNT(*) FROM events WHERE date < NOW() - INTERVAL '1 year';

-- Archive if needed (exports data before deleting)
-- Contact your admin for archival procedures
```

---

## 🛠️ As-Needed Maintenance

### Adding a New Gym

1. **Add to gyms table:**
   ```sql
   INSERT INTO gyms (id, name, is_active)
   VALUES ('NEW', 'New Gym Name', true);
   ```

2. **Add gym_links for each program type:**
   - kids_night_out
   - skill_clinics
   - open_gym
   - camps (and camp subtypes)
   - special_events

3. **Set monthly_requirements** (optional)

4. **Sync the new gym**

### Removing a Gym

**Don't delete!** Mark as inactive instead:
```sql
UPDATE gyms SET is_active = false WHERE id = 'GYM';
```

### Updating iClassPro URLs

1. Get the new URL from iClassPro portal
2. Update in **Admin** → **Manage Gym Links**
3. Or directly in Supabase:
   ```sql
   UPDATE gym_links 
   SET url = 'https://new-url-here' 
   WHERE gym_id = 'GYM' AND link_type_id = 'kids_night_out';
   ```

---

## 🔧 Technical Maintenance (Every 6 Months)

### 1. Check Dependencies
```bash
cd "C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar"
npm outdated
```

**If updates available:**
```bash
npm update
```

### 2. Review Supabase Usage

Go to [supabase.com/dashboard](https://supabase.com/dashboard):
- **Settings → Usage** - Check limits
- **Database → Tables** - Review table sizes
- **Logs → Postgres** - Check for errors

### 3. Backup Database

1. Supabase Dashboard → **Settings** → **Database**
2. Click **Create backup**
3. Download and store securely

### 4. Check Vercel Deployment

Go to [vercel.com/dashboard](https://vercel.com/dashboard):
- Verify builds are passing
- Check for any warning notifications
- Review domain settings

---

## 🚨 Troubleshooting Guide

### Sync Not Working

| Symptom | Solution |
|---------|----------|
| "Failed to connect to API" | Check if Railway/local server is running |
| "No events found" | Verify gym links are correct |
| Timeout errors | Try syncing one program type at a time |

**Debug steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try sync again
4. Look for red failed requests

### Events Not Showing

| Symptom | Solution |
|---------|----------|
| Empty calendar | Check date range filter |
| Missing specific gym | Check if gym is active |
| Deleted events showing | Refresh the page |

**Check database directly:**
```sql
SELECT COUNT(*) FROM events 
WHERE gym_id = 'CCP' 
AND date >= '2025-01-01';
```

### Duplicate Events

**Prevention:** The system has a unique constraint on `event_url`

**If duplicates appear:**
```sql
-- Find duplicates
SELECT event_url, COUNT(*) 
FROM events 
GROUP BY event_url 
HAVING COUNT(*) > 1;

-- Delete duplicates (keeps first entry)
DELETE FROM events a USING events b
WHERE a.id > b.id AND a.event_url = b.event_url;
```

### Data Looks Wrong

1. **Re-sync the gym** - Fresh data from source
2. **Check iClassPro** - Verify source data is correct
3. **Check validation_errors** - Might be a known mismatch

---

## 📊 Health Check Queries

Run these in Supabase SQL Editor for a quick health check:

### Event Count by Gym
```sql
SELECT gym_id, COUNT(*) as event_count
FROM events
WHERE deleted_at IS NULL AND date >= CURRENT_DATE
GROUP BY gym_id
ORDER BY event_count DESC;
```

### Events Missing Descriptions
```sql
SELECT gym_id, title, date, event_url
FROM events
WHERE description_status IN ('none', 'flyer_only')
AND date >= CURRENT_DATE
ORDER BY date;
```

### Recent Sync Activity
```sql
SELECT gym_id, event_type, last_synced, events_found
FROM sync_log
ORDER BY last_synced DESC
LIMIT 20;
```

### Database Size
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

---

## 📞 When to Escalate

Contact your developer if:
- [ ] Sync completely fails for all gyms
- [ ] Database errors appear in Supabase logs
- [ ] Vercel deployment fails
- [ ] Security concerns arise
- [ ] Major feature changes needed

---

## 📝 Maintenance Log Template

Keep a simple log of maintenance activities:

```
Date: ___________
Performed by: ___________

Tasks completed:
[ ] Synced all gyms
[ ] Checked audit flags
[ ] Exported report
[ ] Other: _____________

Issues found:
_______________________

Actions taken:
_______________________
```

---

## ✅ Monthly Checklist

Copy this for each month:

```
Month: __________ Year: __________

WEEKLY SYNCS:
[ ] Week 1 - All gyms synced
[ ] Week 2 - All gyms synced
[ ] Week 3 - All gyms synced
[ ] Week 4 - All gyms synced

MONTHLY TASKS:
[ ] Requirements check complete
[ ] Report exported and saved
[ ] Deleted events reviewed

NOTES:
_______________________
```

---

*For technical details, see other docs in `/docs/OPERATIONS/` and `/docs/TECHNICAL/`*


