# Gym Pricing Raw Data

This folder stores the raw pricing schedule JSON from each gym's iClassPro enterprise backend.

## How to collect data for a gym

### Manual method (F12)

1. Log into https://enterprise.iclasspro.com/accounts
2. Click into the gym's account
3. Go to Settings > Setup (or the camp pricing/schedules area)
4. Open F12 > Network > Fetch/XHR
5. Look for the response that contains pricing schedules (tableCells, studentEnum, etc.)
6. Copy the response JSON
7. Save as `{GYM_ID}_pricing_schedules.json` in this folder
8. Also grab the camp types response and save as `{GYM_ID}_camp_types.json`

### Automated method (Playwright script)

```bash
# Requires: pip install playwright && python -m playwright install chromium
python3 collect_enterprise_data.py --email YOUR_EMAIL --password YOUR_PASSWORD

# Collect specific gyms only:
python3 collect_enterprise_data.py --email YOUR_EMAIL --password YOUR_PASSWORD --gyms CPF CRR

# Just discover account IDs (no login needed):
python3 collect_enterprise_data.py --discover-only
```

## Files per gym

Each gym needs TWO files:
- `{GYM_ID}_camp_types.json` -- list of all program types (KNO, CLINIC, CAMP, etc.)
- `{GYM_ID}_pricing_schedules.json` -- all pricing schedules with per-kid tiers

## Gyms collected

- [x] EST (Estrella Gymnastics) -- February 23, 2026
- [x] CCP (Capital Gymnastics Cedar Park) -- February 23, 2026
- [ ] CPF (Capital Gymnastics Pflugerville) -- needs enterprise login
- [ ] CRR (Capital Gymnastics Round Rock) -- needs enterprise login
- [ ] HGA (Houston Gymnastics Academy) -- needs enterprise login
- [ ] OAS (Oasis Gymnastics) -- needs enterprise login
- [ ] RBA (Rowland Ballard Atascocita) -- needs enterprise login
- [ ] RBK (Rowland Ballard Kingwood) -- needs enterprise login
- [ ] SGT (Scottsdale Gymnastics) -- needs enterprise login
- [ ] TIG (Tigar Gymnastics) -- needs enterprise login

## iClassPro Account IDs (discovered from public API)

| Gym ID | Name | Portal Slug | Account ID |
|--------|------|-------------|------------|
| CCP | Capital Gymnastics Cedar Park | capgymavery | 2321 |
| CPF | Capital Gymnastics Pflugerville | capgymhp | 2291 |
| CRR | Capital Gymnastics Round Rock | capgymroundrock | 33111 |
| EST | Estrella Gymnastics | estrellagymnastics | 29633 |
| HGA | Houston Gymnastics Academy | houstongymnastics | 39960 |
| OAS | Oasis Gymnastics | oasisgymnastics | 36693 |
| RBA | Rowland Ballard Atascocita | rbatascocita | 33849 |
| RBK | Rowland Ballard Kingwood | rbkingwood | (unknown) |
| SGT | Scottsdale Gymnastics | scottsdalegymnastics | 129 |
| TIG | Tigar Gymnastics | tigar | 40643 |

## JSON structure

### Camp Types
```json
{
  "data": [
    {"id": 3, "name": "KIDS NIGHT OUT", ...},
    {"id": 12, "name": "OPEN GYM", ...}
  ]
}
```

### Pricing Schedules
```json
{
  "data": [
    {
      "name": "Kids Night Out",
      "tableCells": [[
        {"studentEnum": 1, "amount": "40.0000", "blockEnum": 1},
        {"studentEnum": 2, "amount": "35.0000", "blockEnum": 1},
        {"studentEnum": 3, "amount": "35.0000", "blockEnum": 1}
      ]],
      "earlybirdDiscount": "0.0000",
      "earlybirdDiscountIsPercent": false,
      "memberDiscount": "0.0000",
      "memberDiscountIsPercent": false
    }
  ]
}
```

### Key fields
- `studentEnum` 1 = first kid, 2 = second kid, 3 = third kid
- `blockEnum` = number of days (1 = 1 day, 2 = 2 days, etc.)
- `amount` = price for that kid/day combination
- `earlybirdDiscount` / `memberDiscount` = additional discount settings
- `countStudentsByTotal` = how siblings are counted
