# Admin Dashboard — How Everything Connects

**Last updated:** Feb 2026  
**Purpose:** Map how Admin tabs, APIs, and Supabase tables connect. Nothing was broken by the Pricing split.

---

## The Three Tables (Supabase)

| Table | What it holds | Who writes | Who reads |
|-------|---------------|------------|-----------|
| **event_pricing** | Base expected prices: Clinic, KNO, Open Gym (per gym) | **Pricing tab** (AdminPricing.js) | Python validation during sync |
| **camp_pricing** | Base expected prices: Camp FD/HD daily & weekly (per gym) | Supabase (or future UI) | Python validation during sync |
| **gym_valid_values** | Rules that *add* valid values: $20=Before Care, 8:30am=Early Drop, synonyms | **Gym Rules tab**, **Audit tab** (+ Rule), **SyncModal** (+ Rule) | Python validation during sync |

---

## Data Flow (Validation)

```
During sync (f12_collect_and_import.py):
  1. Python fetches event_pricing from Supabase → event_price_mismatch checks
  2. Python fetches camp_pricing from Supabase → camp_price_mismatch checks
  3. Python fetches gym_valid_values from Supabase → adds extra valid prices/times/synonyms
  4. Writes validation_errors to events
```

**Important:** Python reads directly from Supabase. The React Admin UI is just a different way to manage the same tables. Moving Event/Camp pricing to a different tab does **not** change how validation works.

---

## Admin UI → API → Supabase

### Pricing tab (AdminPricing.js)
- **eventPricingApi** → `event_pricing` table (getAll, create, delete)
- **campPricingApi** → `camp_pricing` table (getAll — edit in Supabase for now)
- Same APIs AdminGymRules used before. Same tables. Same behavior.

### Gym Rules tab (AdminGymRules.js)
- **gymValidValuesApi** → `gym_valid_values` table (getAll, create, delete)
- Manages validation exceptions only (price rules, time rules, program synonyms)

### Audit & Review tab (AdminAuditReview.js)
- Loads events with validation_errors from `events`
- **+ Rule** button → gymValidValuesApi.create() → `gym_valid_values`
- **acknowledgedPatternsApi** for temp overrides → `acknowledged_patterns`

### Sync Modal (SyncModal.js) and EventsDashboard (EventsDashboard.js)
- **+ Rule** during sync → gymValidValuesApi.create() → `gym_valid_values`
- Loads gym rules for badge display → gymValidValuesApi.getAll()

---

## What Changed vs What Stayed the Same

| Before | After | Connection |
|--------|-------|------------|
| Event + Camp pricing lived in Gym Rules tab | Event + Camp pricing live in **Pricing** tab | Same eventPricingApi, campPricingApi; same Supabase tables |
| Gym Rules tab had rules + pricing | Gym Rules tab has **rules only** | gym_valid_values unchanged |
| Audit + Rule → gym_valid_values | Same | AdminAuditReview still uses gymValidValuesApi.create() |
| Python reads event_pricing, camp_pricing, gym_valid_values | Same | No change to automation |
| SyncModal + Rule → gym_valid_values | Same | No change |

---

## Summary

- **event_pricing** and **camp_pricing** = source of truth for expected prices. Managed in **Pricing** tab.
- **gym_valid_values** = extra valid values (exceptions). Managed in **Gym Rules** tab and added via **Audit** / Sync **+ Rule**.
- All three tables are still used by Python validation exactly as before.
- The split only moves UI; it does not change data flow or validation logic.
