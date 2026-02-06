# 💰 PRICING MANAGEMENT GUIDE
## How to Update Prices in Supabase

**Last Updated:** February 5, 2026  
**Table:** `event_pricing`  
**Location:** Supabase → SQL Editor

---

## 📋 QUICK REFERENCE: Current Prices

### As of Feb 10, 2026 (After Monday's Increase)

| Gym | KNO | Clinic | Open Gym |
|-----|-----|--------|----------|
| CCP | $40 | $35 | $10 |
| CPF | $40 | $30 | $10 |
| CRR | $40 | $30 | $10 |
| EST | $40 | $30 | $35 |
| HGA | $45 | $30 | $20 |
| OAS | $45 | $30 | $20 |
| RBA | $40 | $30 | $20 |
| RBK | $40 | $30 | $15 |
| SGT | $45 | $30 | $30 |
| TIG | $40 | $30 | $20 |

---

## 🔍 VIEW CURRENT PRICES

```sql
-- See all current prices (as of today)
SELECT gym_id, event_type, price, effective_date, notes
FROM event_pricing 
WHERE effective_date <= CURRENT_DATE 
AND (end_date IS NULL OR end_date >= CURRENT_DATE)
ORDER BY gym_id, event_type;
```

---

## ✏️ CHANGE A SINGLE GYM'S PRICE

**Example:** HGA raises KNO from $45 to $50 starting March 1

```sql
-- Step 1: End the old price (day BEFORE new price starts)
UPDATE event_pricing 
SET end_date = '2026-02-28'
WHERE gym_id = 'HGA' 
AND event_type = 'KIDS NIGHT OUT'
AND end_date IS NULL;

-- Step 2: Add the new price
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) 
VALUES ('HGA', 'KIDS NIGHT OUT', 50.00, '2026-03-01', 'Price increase March 2026');
```

---

## ✏️ CHANGE ALL GYMS AT ONCE

**Example:** All gyms raise Clinic to $35 starting April 1

```sql
-- Step 1: End old clinic prices for all gyms
UPDATE event_pricing 
SET end_date = '2026-03-31'
WHERE event_type = 'CLINIC'
AND end_date IS NULL;

-- Step 2: Add new prices for all gyms
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('CCP', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('CPF', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('CRR', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('EST', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('HGA', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('OAS', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('RBA', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('RBK', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('SGT', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase'),
('TIG', 'CLINIC', 35.00, '2026-04-01', 'April 2026 increase');
```

---

## ➕ ADD A NEW GYM

**Example:** New gym "ABC" joins with standard pricing

```sql
INSERT INTO event_pricing (gym_id, event_type, price, effective_date, notes) VALUES
('ABC', 'KIDS NIGHT OUT', 40.00, '2026-01-01', 'New gym'),
('ABC', 'CLINIC', 30.00, '2026-01-01', 'New gym'),
('ABC', 'OPEN GYM', 20.00, '2026-01-01', 'New gym');
```

---

## 🔍 VIEW PRICE HISTORY

```sql
-- See all prices (current and past) for a gym
SELECT gym_id, event_type, price, effective_date, end_date, notes
FROM event_pricing 
WHERE gym_id = 'CCP'
ORDER BY event_type, effective_date DESC;
```

---

## 🔍 VIEW UPCOMING PRICE CHANGES

```sql
-- See prices scheduled for the future
SELECT gym_id, event_type, price, effective_date, notes
FROM event_pricing 
WHERE effective_date > CURRENT_DATE
ORDER BY effective_date, gym_id;
```

---

## ⚠️ IMPORTANT NOTES

1. **Always set `end_date` on old price BEFORE adding new price**
   - Old price `end_date` = day BEFORE new price starts
   - New price `effective_date` = first day of new price

2. **Gym IDs must match exactly:**
   - CCP, CPF, CRR, EST, HGA, OAS, RBA, RBK, SGT, TIG

3. **Event types must match exactly:**
   - `KIDS NIGHT OUT` (not KNO)
   - `CLINIC`
   - `OPEN GYM`

4. **Validation happens on sync**
   - After changing prices, run a sync to see which events have wrong prices
   - Events with old prices in description will show `event_price_mismatch` error

---

## 📊 CAMP PRICING

Camp prices are in a DIFFERENT table: `camp_pricing`

```sql
-- View camp prices
SELECT * FROM camp_pricing ORDER BY gym_id;

-- Update a camp price (example: RBA full day daily)
UPDATE camp_pricing 
SET full_day_daily = 65.00
WHERE gym_id = 'RBA';
```

---

## 🆘 IF SOMETHING GOES WRONG

```sql
-- Delete a price you added by mistake
DELETE FROM event_pricing 
WHERE gym_id = 'XXX' 
AND event_type = 'KIDS NIGHT OUT'
AND effective_date = '2026-XX-XX';

-- Remove an end_date if you set it wrong
UPDATE event_pricing 
SET end_date = NULL
WHERE gym_id = 'XXX' 
AND event_type = 'KIDS NIGHT OUT'
AND end_date = '2026-XX-XX';
```

---

**That's it! Copy/paste and change the values as needed.**
