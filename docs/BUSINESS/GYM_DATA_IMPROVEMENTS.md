# 📊 GYM DATA IMPROVEMENTS
## Optional Data Enhancements for Supabase

**Last Updated:** December 28, 2025  
**Status:** Optional - Low Priority  
**Location:** `docs/OPERATIONS/GYM_DATA_IMPROVEMENTS.md`

---

## 🎯 OVERVIEW

This document contains optional data improvements that can enhance the system but are NOT required for normal operation.

**Priority:** LOW - The app works perfectly without this data.

---

## 🏢 GYM CONTACT INFORMATION

Currently **gym contact fields are NULL** in Supabase. If you need to add contact info:

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
  website_url = 'https://houstongymnastics.com'
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
  website_url = 'https://oasisgym.com'
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

## 🔗 CHECK FOR PLACEHOLDER URLs

Some gym_links may have placeholder URLs:

```sql
-- Find any placeholder URLs
SELECT gym_id, link_type_id, url 
FROM gym_links 
WHERE url LIKE '%REPLACE_WITH%' OR url LIKE '%placeholder%';
```

**To Fix:** Get real URLs from iClassPro portals and update directly in Supabase.

---

## 💰 ABOUT NULL PRICES

Many events have `price = NULL`. This is acceptable because:
- Prices may be "TBD" or vary by registration date
- iClassPro doesn't always include pricing in API responses
- Users click through to registration page for actual pricing

**Recommendation:** Leave as-is unless pricing is consistently available from the source.

---

## 📝 HOW TO APPLY

### **Via Supabase Dashboard:**
1. Open Supabase SQL Editor
2. Copy the SQL script above
3. Run it
4. Done!

---

## 📜 DOCUMENT HISTORY

| Date | Change |
|------|--------|
| 2025 | Original document created |
| Dec 28, 2025 | Moved to docs/OPERATIONS/, updated formatting |

---

**Note:** This is optional enhancement documentation. The calendar works perfectly without this data.

