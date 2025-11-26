# 📋 BULK IMPORT LEARNINGS & FIXES
## Historical Record of Issues and Solutions

**Last Updated:** November 26, 2025  
**Status:** Most issues now resolved with Automated Sync system

---

## 🎯 IMPORTANT NOTE (November 2025)

**The Automated Sync system has replaced most manual F12 imports!**

- ✅ One-click sync from iClassPro portals
- ✅ Automatic gym detection
- ✅ Automatic duplicate prevention
- ✅ Descriptions and ages pulled automatically

**This document is kept for historical reference and edge case troubleshooting.**

---

## 🎯 MAJOR DISCOVERIES (Historical)

### 1. GYM ID STRUCTURE
**Learning:** The gyms table uses **short codes** as IDs, not UUIDs!
- `CCP` = Capital Gymnastics Cedar Park
- `CPF` = Capital Gymnastics Pflugerville  
- `CRR` = Capital Gymnastics Round Rock
- `EST` = Estrella Gymnastics
- `HGA` = Houston Gymnastics Academy
- `OAS` = Oasis Gymnastics
- `RBA` = Rowland Ballard Atascocita
- `RBK` = Rowland Ballard Kingwood
- `SGT` = Scottsdale Gymnastics
- `TIG` = TIGAR Gymnastics

**Impact:** This is why gym_id = 'CCP' is correct, not a UUID.

---

### 2. EVENT URL AS UNIQUE IDENTIFIER
**Learning:** Each event has a unique iClassPro URL that serves as the primary identifier.

**Format:** `https://portal.iclasspro.com/{portal_slug}/camp-details/{event_id}`

**Examples:**
- `https://portal.iclasspro.com/capgymavery/camp-details/1161`
- `https://portal.iclasspro.com/estrellagymnastics/camp-details/574`

**Impact:** Duplicate detection uses URL (ignoring query parameters).

---

### 3. PORTAL SLUGS
**Learning:** Each gym has a unique portal slug used in URLs.

| Gym Code | Portal Slug |
|----------|-------------|
| CCP | capgymavery |
| CPF | capgymhp |
| CRR | capgymroundrock |
| EST | estrellagymnastics |
| HGA | houstongymnastics |
| OAS | oasisgymnastics |
| RBA | rbatascocita |
| RBK | rbkingwood |
| SGT | scottsdalegymnastics |
| TIG | tigar |

---

### 4. DATE PARSING FIXES (September 2025)
**Problem:** Dates were all showing as "2025-09-01"

**Solution:** Enhanced date parser to:
- Look in any position (not just parts[1])
- Handle formats: "September 19, 2025" or "Sep 19, 2025"
- Add fallback patterns for common dates

**Status:** ✅ Fixed - Automated Sync now handles dates correctly

---

### 5. DUPLICATE DETECTION (October 2025)
**Problem:** Importing twice created duplicates

**Root Cause:** Duplicate detection checked client-side cache instead of fresh database query

**Solution:** 
- Now queries database before import
- Uses URL-based matching (primary)
- Uses composite key matching (backup): gym_id + date + time + type

**Status:** ✅ Fixed

---

## 🛠️ USEFUL SQL COMMANDS

### Remove Duplicate Events
```sql
DELETE FROM events
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      event_url,
      date,
      ROW_NUMBER() OVER (
        PARTITION BY event_url, date 
        ORDER BY created_at
      ) as rn
    FROM events
    WHERE gym_id = 'CCP'
  ) duplicates
  WHERE rn > 1
);
```

### Verify Event Counts by Gym
```sql
SELECT 
  gym_id,
  type,
  COUNT(*) as count
FROM events
WHERE deleted_at IS NULL
GROUP BY gym_id, type
ORDER BY gym_id, type;
```

### Find Events Missing Description
```sql
SELECT gym_id, title, date
FROM events
WHERE description IS NULL
AND deleted_at IS NULL
ORDER BY gym_id, date;
```

### Check Sync Log Status
```sql
SELECT 
  gym_id,
  event_type,
  last_synced,
  events_found,
  events_imported
FROM sync_log
ORDER BY last_synced DESC;
```

---

## ⚠️ GOTCHAS TO REMEMBER

1. **Gym IDs are codes, not UUIDs** - Use 'CCP', 'EST', etc.

2. **URL query parameters** - Database URLs may have `?typeId=2` etc. Duplicate detection ignores these.

3. **Soft delete pattern** - Events aren't deleted, they get `deleted_at` timestamp. Views filter these out.

4. **Price as TEXT** - Price is stored as TEXT not DECIMAL. Some events have no price (null).

5. **Description truncation** - Descriptions are truncated at ~500 characters from iClassPro.

6. **Age from settings** - age_min and age_max come from iClass settings, NOT from parsing the title.

---

## 📊 CURRENT WORKFLOW (November 2025)

### **Primary Method: Automated Sync**
1. Shift + Click 🪄 → Automated Sync
2. Select gym → Select event type → Click Sync
3. Review results → Click Import
4. Done!

### **Backup Method: F12 Import**
1. Open iClassPro portal
2. F12 → Network tab → Refresh page
3. Find API response → Copy Response
4. Paste in JSON Import → Convert → Import

**See:** `F12-IMPORT-GUIDE.md` for detailed F12 instructions

---

## 🚀 PERFORMANCE IMPROVEMENTS MADE

- ✅ Database indexes added for 5x speed
- ✅ Caching layer reduces API calls by 90%
- ✅ Smart duplicate detection prevents data issues
- ✅ Automatic date parsing handles multiple formats
- ✅ Automated Sync eliminates manual navigation

---

## 📝 HISTORICAL ISSUES (RESOLVED)

| Date | Issue | Resolution |
|------|-------|------------|
| Sept 2025 | Dates showing wrong | Fixed date parser |
| Sept 2025 | Gym IDs not matching | Documented short codes |
| Oct 2025 | Duplicates on re-import | Fixed duplicate detection |
| Oct 2025 | Missing prices | Now pulls from iClass settings |
| Nov 2025 | Missing descriptions | Added description column + sync |
| Nov 2025 | Missing ages | Added age_min/age_max columns + sync |

---

## 🔮 LESSONS FOR FUTURE

1. **Always test imports with ONE event first** before bulk importing

2. **Check database after import** - Don't assume it worked

3. **Use Automated Sync** when possible - More reliable than F12

4. **Document everything** - This file has saved hours of debugging

5. **Keep SQL commands handy** - For cleanup and verification

---

**This document preserves institutional knowledge about import issues and solutions.**

**Most issues are now handled automatically by the Automated Sync system!** 🎉

