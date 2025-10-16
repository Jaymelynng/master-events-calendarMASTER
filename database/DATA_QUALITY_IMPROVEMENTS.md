# 📊 DATA QUALITY IMPROVEMENTS
## Missing Data That Should Be Added to Supabase

**Date:** January 7, 2025  
**Status:** To Be Implemented  
**Priority:** Medium (Nice-to-have, not critical)

---

## 🏢 GYM CONTACT INFORMATION

Currently **ALL gym contact fields are NULL** in Supabase, but we have this data in project memories!

### **SQL Script to Add Contact Info:**

```sql
-- Capital Gymnastics Cedar Park (CCP)
UPDATE gyms SET 
  phone = '512-259-9995',
  email = 'info@capgymcpk.com',
  address = '504 Denali Pass, Cedar Park, TX 78613',
  website_url = 'https://capgymcpk.com'
WHERE id = 'CCP';

-- Capital Gymnastics Pflugerville (CPF)
UPDATE gyms SET 
  phone = '512-251-2439',
  email = 'info@capgympfl.com',
  address = '419 Kingston Lacy Blvd, Pflugerville, TX 78660',
  website_url = 'https://capgympfl.com'
WHERE id = 'CPF';

-- Capital Gymnastics Round Rock (CRR)
UPDATE gyms SET 
  phone = '512-244-4999',
  email = 'info@capgymrnd.com',
  address = '4600 Campus Village Dr, Round Rock, TX 78665',
  website_url = 'https://capgymrnd.com'
WHERE id = 'CRR';

-- Houston Gymnastics Academy (HGA)
UPDATE gyms SET 
  phone = '713-668-6001',
  email = 'info@houstongymnastics.com',
  address = '5201 Gulfton St, Houston, TX 77081',
  website_url = 'https://houstongymnastics.com',
  manager = 'Misty'
WHERE id = 'HGA';

-- Rowland Ballard Atascocita (RBA)
UPDATE gyms SET 
  phone = '281-812-7835',
  email = 'info@rbatascocita.com',
  address = '19505 West Lake Houston Parkway, Atascocita, TX 77346',
  website_url = 'https://rbatascocita.com'
WHERE id = 'RBA';

-- Rowland Ballard Kingwood (RBK)
UPDATE gyms SET 
  phone = '281-358-4616',
  email = 'info@rbkingwood.com',
  address = '1320 Kingwood Drive, Kingwood, TX 77339',
  website_url = 'https://rbkingwood.com'
WHERE id = 'RBK';

-- Estrella Gymnastics (EST)
UPDATE gyms SET 
  phone = '623-932-1053',
  email = 'info@estrellagym.com',
  address = '14200 W Van Buren St Suite C101, AZ 85338',
  website_url = 'https://estrellagym.com'
WHERE id = 'EST';

-- Oasis Gymnastics (OAS)
UPDATE gyms SET 
  phone = '623-977-6399',
  email = 'info@oasisgym.com',
  address = '8643 W Kelton Lane #110, AZ 85382',
  website_url = 'https://oasisgym.com',
  manager = 'Jocelyn'
WHERE id = 'OAS';

-- Scottsdale Gymnastics (SGT)
UPDATE gyms SET 
  phone = '480-951-0496',
  email = 'Funhappens@scottsdalegymnastics.com',
  address = '8662 E Shea Blvd, Scottsdale, AZ 85260',
  website_url = 'https://scottsdalegymnastics.com'
WHERE id = 'SGT';

-- Tigar Gymnastics (TIG)
UPDATE gyms SET 
  phone = '(720) 898-4427',
  email = 'info@tigargym.com',
  address = '4860 Van Gordon Street Unit B, Wheat Ridge, CO',
  website_url = 'https://tigargym.com'
WHERE id = 'TIG';
```

---

## 🔗 PLACEHOLDER URLs TO FIX

Found in `gym_links` table:

```sql
-- Find all placeholder URLs
SELECT gym_id, link_type_id, url 
FROM gym_links 
WHERE url LIKE '%REPLACE_WITH%';
```

**Found Issues:**
1. Round Rock (CRR) - Holiday camps URL is placeholder
2. Atascocita (RBA) - Special events URL is placeholder

**To Fix:**
- Get real URLs from iClassPro portals
- Update using: `UPDATE gym_links SET url = 'real_url' WHERE id = [id];`

---

## 💰 MISSING PRICES

Many events have `price = NULL`

**Options:**
1. **Leave as-is** - Prices might be "TBD" or vary
2. **Populate from portal** - Scrape current pricing
3. **Add default notes** - "Contact gym for pricing"

**Recommendation:** Leave as-is unless pricing is consistently available

---

## 🎯 PRIORITY

**Low Priority** - These are nice-to-haves, not blockers:
- ✅ App works perfectly without this data
- ✅ Contact info can be added via admin panel later
- ✅ Placeholder URLs only affect 2 gyms
- ✅ NULL prices are acceptable

**When to Add:**
- During a maintenance window
- When building an admin panel for gym management
- When preparing for multi-user access
- When contact info features are needed

---

## 📝 HOW TO APPLY

### **Option 1: Manual via Supabase Dashboard**
1. Open Supabase SQL Editor
2. Copy the SQL script above
3. Run it
4. Done!

### **Option 2: Via Script**
Create `database/populate_gym_data.js`:
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

// Run SQL script
await supabase.rpc('exec_sql', { query: sqlScript });
```

### **Option 3: Build Admin Panel**
Add a "Gym Settings" page in your app to manage this data through UI

---

**Created:** January 7, 2025  
**Status:** Documentation only - implementation optional  
**Impact:** Low - app works great without this data




