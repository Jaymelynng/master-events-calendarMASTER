# iClass bulk exports (local)

Copy snapshots from **Downloads** (or enterprise export) into a **dated subfolder** here, e.g.:

```text
data/iclass-exports/2026-04-08/
  pricing-full-{slug}-2026-04-08.json      # schedules / tableCells (pricing truth)
  camp-pricing-map-{slug}-2026-04-08.json  # campId → pricingScheduleId (bridge)
```

- **`pricing-full-*`**: schedule definitions; use your existing pricing → Supabase workflow.
- **`camp-pricing-map-*`**: fills **`camp_pricing_map`** in Supabase (no JWT):

```bash
python automation/populate_camp_pricing_map.py --from-json "data/iclass-exports/2026-04-08/camp-pricing-map-capgymavery-2026-04-08.json"
```

`*.json` under this tree is **gitignored** (large / org-specific). This README is tracked.
