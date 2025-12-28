# 🔗 GYM LINKS MANAGEMENT GUIDE
## How to Update Program Page URLs for Bulk Openers and Auto-Sync

**Last Updated:** December 23, 2025  
**Purpose:** Guide for updating program page links that are used by bulk openers and auto-sync

---

## 🎯 WHAT ARE GYM LINKS?

Gym links are the URLs stored in the `gym_links` database table that tell the system:
1. **Where to open** when you click bulk action buttons (e.g., "All Clinics")
2. **Where to sync from** when using Automated Sync

Each gym has specific program page URLs for different event types:
- **Skill Clinics** (`skill_clinics`) - Maps to "CLINIC" events
- **Kids Night Out** (`kids_night_out`) - Maps to "KIDS NIGHT OUT" events  
- **Open Gym** (`open_gym`) - Maps to "OPEN GYM" events
- **Camps** (`camps`, `camps_half`, etc.) - Maps to "CAMP" events
- **Special Events** (`special_events`) - Maps to "SPECIAL EVENT" events

---

## 📊 CURRENT SYSTEM ARCHITECTURE

### How Bulk Openers Work:
1. User clicks "All Clinics" button
2. System queries `gym_links` table for all gyms where `link_type_id = 'skill_clinics'`
3. Opens each URL in a new tab

### How Auto-Sync Works:
1. User selects a gym and event type (e.g., "CPF" and "CLINIC")
2. Railway API server calls `f12_collect_and_import.py`
3. Script queries `gym_links` table for the URL
4. Uses Playwright to open that URL and collect event data
5. Returns events to frontend for review and import

### Important Notes:
- ✅ **Both systems use the SAME URLs** from the gym_links table
- ✅ **URLs are cached for 5 minutes** - changes take effect automatically after cache refresh
- ✅ **No code changes needed** - just update the database

---

## 🔧 HOW TO UPDATE A GYM LINK

### Method 1: Direct SQL Update (Recommended for Single Changes)

1. **Open Supabase Dashboard**
   - Go to [your Supabase project](https://supabase.com)
   - Click "SQL Editor" in the left sidebar

2. **Run the Update Query**
   ```sql
   -- Example: Update CPF Skill Clinics to use program ID 63
   UPDATE gym_links
   SET 
     url = 'https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time',
     updated_at = NOW()
   WHERE 
     gym_id = 'CPF' 
     AND link_type_id = 'skill_clinics';
   ```

3. **Verify the Change**
   ```sql
   SELECT 
     gym_id,
     link_type_id,
     url,
     updated_at
   FROM gym_links 
   WHERE gym_id = 'CPF' AND link_type_id = 'skill_clinics';
   ```

4. **Wait 5 Minutes** (for cache to refresh) or restart the Railway API server

5. **Test the Change**
   - Click the "All Clinics" bulk button and verify CPF opens the correct page
   - Run an auto-sync for CPF Clinics and verify it collects from the correct URL

### Method 2: Bulk Update via SQL Script

If you have multiple links to update, create a SQL script like this:

```sql
-- Update multiple gym links at once
UPDATE gym_links
SET url = 'https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time', updated_at = NOW()
WHERE gym_id = 'CPF' AND link_type_id = 'skill_clinics';

UPDATE gym_links
SET url = 'https://portal.iclasspro.com/capgymavery/camps/8?sortBy=time', updated_at = NOW()
WHERE gym_id = 'CCP' AND link_type_id = 'skill_clinics';

-- Verify all changes
SELECT gym_id, link_type_id, url 
FROM gym_links 
WHERE link_type_id = 'skill_clinics' 
ORDER BY gym_id;
```

---

## 🔍 HOW TO FIND THE CORRECT PROGRAM ID

When a gym changes their program structure in iClassPro, you need to find the new program ID:

### Step 1: Visit the Gym's Portal
Go to the gym's iClassPro portal, for example:
- `https://portal.iclasspro.com/capgymhp/` (Capital Pflugerville)

### Step 2: Navigate to the Program Type
Click on the program type you want to find:
- Skill Clinics
- Kids Night Out
- Open Gym
- Camps

### Step 3: Check the URL
Look at the browser address bar. You'll see a URL like:
- `https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time`

The number **63** is the program ID!

### Step 4: Update the Database
Use the SQL from Method 1 above, replacing:
- `gym_id` with the gym's short code (CPF, CCP, EST, etc.)
- `link_type_id` with the event type
- The number in the URL with the program ID you found

---

## 📋 LINK TYPE ID REFERENCE

| Link Type ID | Event Type | Description |
|--------------|------------|-------------|
| `skill_clinics` | CLINIC | Skill-building clinics (backhandspring, tumbling, etc.) |
| `kids_night_out` | KIDS NIGHT OUT | Parents' night out events |
| `open_gym` | OPEN GYM | Open gym sessions |
| `camps` | CAMP | School year full day camps |
| `camps_half` | CAMP | School year half day camps |
| `camps_summer_full` | CAMP | Summer full day camps |
| `camps_summer_half` | CAMP | Summer half day camps |
| `camps_holiday` | CAMP | Holiday break camps |
| `special_events` | SPECIAL EVENT | Special events and competitions |
| `booking` | N/A | General booking/calendar page |

---

## 🚨 TROUBLESHOOTING

### Problem: Bulk opener opens wrong page for a gym

**Solution:** Check the URL in gym_links table for that gym and event type. Update it using Method 1 above.

### Problem: Auto-sync collects from wrong program page

**Solution:** Same as above - the sync uses the exact same URLs as bulk openers.

### Problem: I updated the link but it's still using the old URL

**Solution:** 
1. Wait 5 minutes for the cache to expire (URLs are cached for 5 minutes)
2. OR restart the Railway API server to clear the cache immediately
3. Check that you updated the correct `gym_id` and `link_type_id` combination

### Problem: I don't know which gym_id to use

**Solution:** Run this query to see all gym IDs and names:
```sql
SELECT id, name FROM gyms ORDER BY id;
```

Output:
- CCP = Capital Gymnastics Cedar Park
- CPF = Capital Gymnastics Pflugerville
- CRR = Capital Gymnastics Round Rock
- EST = Estrella Gymnastics
- HGA = Houston Gymnastics Academy
- OAS = Oasis Gymnastics
- RBA = Rowland Ballard Atascocita
- RBK = Rowland Ballard Kingwood
- SGT = Scottsdale Gymnastics
- TIG = TIGAR Gymnastics

### Problem: How do I know if the link is working?

**Solution:** Test it!
1. Open the bulk action button (e.g., "All Clinics") - should open the correct page
2. Run F12 on that page - you should see `/camps` network requests with JSON data
3. Run auto-sync for that gym/type - should collect events successfully

---

## 💡 BEST PRACTICES

1. **Always include ?sortBy=time** in URLs
   - Example: `https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time`
   - This ensures events are sorted chronologically

2. **Test after updating**
   - Click the bulk button to verify it opens correctly
   - Run auto-sync to verify it collects data

3. **Document program ID changes**
   - Keep a note of why you changed a program ID
   - Include it in your SQL script comments

4. **Use the verification query**
   - Always run the SELECT query after UPDATE to confirm the change

5. **Update all related gyms at once**
   - If multiple gyms have the same issue, update them all in one script

---

## 📝 EXAMPLE: Fixing Capital Pflugerville Skill Clinics

**Problem:** CPF Skill Clinics was using program ID 31, but should use program ID 63

**Solution:**
```sql
-- Update CPF Skill Clinics link
UPDATE gym_links
SET 
  url = 'https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time',
  updated_at = NOW()
WHERE 
  gym_id = 'CPF' 
  AND link_type_id = 'skill_clinics';

-- Verify
SELECT gym_id, link_type_id, url, updated_at
FROM gym_links 
WHERE gym_id = 'CPF' AND link_type_id = 'skill_clinics';
```

**Expected result:**
- Bulk "All Clinics" button now opens CPF to `/camps/63`
- Auto-sync for CPF Clinics now collects from `/camps/63`
- Both use the same data source

---

## 🎯 QUICK REFERENCE

**View all links for a gym:**
```sql
SELECT link_type_id, url FROM gym_links WHERE gym_id = 'CPF' AND is_active = true ORDER BY sort_order;
```

**View all skill_clinics links:**
```sql
SELECT gym_id, url FROM gym_links WHERE link_type_id = 'skill_clinics' AND is_active = true ORDER BY gym_id;
```

**Update a link:**
```sql
UPDATE gym_links
SET url = 'NEW_URL_HERE', updated_at = NOW()
WHERE gym_id = 'GYM_ID' AND link_type_id = 'LINK_TYPE_ID';
```

---

**Last Updated:** December 23, 2025  
**Need Help?** Check the [Auto-Sync Guide](AUTO-SYNC-GUIDE.md) or [F12 Import Guide](F12-IMPORT-GUIDE.md)
