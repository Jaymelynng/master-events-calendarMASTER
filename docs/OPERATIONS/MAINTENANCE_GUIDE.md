# 🔧 Master Events Calendar - Maintenance Guide

> **Last Updated:** December 28, 2025  
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
2. Shift+Click **🪄 wand** → Admin Dashboard → **Quick Actions** → **Automated Sync**
3. Select each gym → Click **🚀 SYNC ALL PROGRAMS**
4. Wait for confirmation (green checkmarks)
5. Click **Import** if there are new/changed events

**Pro Tip:** The sync progress grid shows green = synced, red = needs sync

### 2. Quick Audit Check
**Why:** Catch content issues before they become problems

**Steps:**
1. Look at the calendar view
2. Check for events with data quality indicators:
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
1. Click **📤 Export** button (top of dashboard)
2. Set date range to the month using the date pickers
3. Check what to include:
   - ☑️ **Events** - Full event list
   - ☑️ **Analytics Summary** - Stats by gym/type
   - ☑️ **Missing Requirements** - Gyms that are behind
4. Choose **CSV** or **JSON** format
5. Click **📤 Export** to download

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
1. Go to **Supabase Dashboard** → **Table Editor** → **gym_links**
2. For each gym, click one `url` to verify it works
3. If broken, update the URL directly in Supabase

**Note:** There is no UI for managing gym links - it's done directly in Supabase. This is intentional to prevent accidental changes.

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
   ```sql
   INSERT INTO gym_links (gym_id, link_type_id, url, is_active)
   VALUES 
     ('NEW', 'kids_night_out', 'https://portal.iclasspro.com/newgym/camps/XX?sortBy=time', true),
     ('NEW', 'skill_clinics', 'https://portal.iclasspro.com/newgym/camps/YY?sortBy=time', true),
     ('NEW', 'open_gym', 'https://portal.iclasspro.com/newgym/camps/ZZ?sortBy=time', true),
     ('NEW', 'camps', 'https://portal.iclasspro.com/newgym/camps/AA?sortBy=time', true),
     ('NEW', 'special_events', 'https://portal.iclasspro.com/newgym/camps/BB?sortBy=time', true);
   ```

3. **Set monthly_requirements** (optional)

4. **Sync the new gym** via Admin → Automated Sync

### Removing a Gym

**Don't delete!** Mark as inactive instead:
```sql
UPDATE gyms SET is_active = false WHERE id = 'GYM';
```

### Updating iClassPro URLs

1. Get the new URL from iClassPro portal
2. Go to Supabase Dashboard → gym_links table
3. Find the row for that gym/link_type
4. Update the `url` field:
   ```sql
   UPDATE gym_links 
   SET url = 'https://new-url-here' 
   WHERE gym_id = 'GYM' AND link_type_id = 'kids_night_out';
   ```

**Note:** URL changes take effect within 5 minutes (cached in the sync system).

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

### 5. Verify Environment Variables

**Vercel (Frontend):**
- `REACT_APP_API_URL` - Railway API URL
- `REACT_APP_API_KEY` - API key for Railway authentication
- `REACT_APP_SUPABASE_URL` - Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anon key

**Railway (Backend):**
- `API_KEY` - Must match Vercel's `REACT_APP_API_KEY`
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

---

## 🚨 Troubleshooting Guide

### Sync Not Working

| Symptom | Solution |
|---------|----------|
| "Failed to connect to API" | Check if Railway is running at `/health` endpoint |
| "Invalid or missing API key" | Verify `REACT_APP_API_KEY` matches `API_KEY` in Railway |
| "No events found" | Verify gym links are correct in Supabase |
| Timeout errors | Try syncing one program type at a time |

**Debug steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try sync again
4. Look for red failed requests
5. Check Console tab for error messages

### Events Not Showing

| Symptom | Solution |
|---------|----------|
| Empty calendar | Check date range filter |
| Missing specific gym | Check if gym is active in `gyms` table |
| Deleted events showing | Hard refresh (Ctrl+Shift+R) |

**Check database directly:**
```sql
SELECT COUNT(*) FROM events 
WHERE gym_id = 'CCP' 
AND date >= '2025-01-01'
AND deleted_at IS NULL;
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
AND deleted_at IS NULL
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

### Check Gym Links Status
```sql
SELECT gym_id, link_type_id, is_active, 
       CASE WHEN url LIKE 'http%' THEN '✅ Valid' ELSE '❌ Invalid' END as url_status
FROM gym_links
ORDER BY gym_id, link_type_id;
```

---

## 📞 When to Escalate

Contact your developer if:
- [ ] Sync completely fails for all gyms
- [ ] Database errors appear in Supabase logs
- [ ] Vercel deployment fails
- [ ] Security concerns arise
- [ ] Major feature changes needed
- [ ] API key needs to be rotated

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

## 📜 VERSION HISTORY

| Date | Change |
|------|--------|
| Oct 2025 | Initial maintenance guide created |
| Nov 2025 | Added sync progress tracker references |
| Dec 2025 | Updated for API key authentication, clarified gym links management |

---

*For technical details, see other docs in `/docs/OPERATIONS/` and `/docs/TECHNICAL/`*
