# Gym Pricing Raw Data

This folder stores the raw pricing schedule JSON from each gym's iClassPro enterprise backend.

## How to collect data for a gym

1. Log into https://enterprise.iclasspro.com/accounts
2. Click into the gym's account
3. Go to Settings > Setup (or the camp pricing/schedules area)
4. Open F12 > Network > Fetch/XHR
5. Look for the response that contains pricing schedules (tableCells, studentEnum, etc.)
6. Copy the response JSON
7. Save as `{GYM_ID}_pricing_schedules.json` in this folder
8. Also grab the camp types response and save as `{GYM_ID}_camp_types.json`

## Files per gym

Each gym needs TWO files:
- `{GYM_ID}_camp_types.json` -- list of all program types (KNO, CLINIC, CAMP, etc.)
- `{GYM_ID}_pricing_schedules.json` -- all pricing schedules with per-kid tiers

## Gyms collected

- [x] EST (Estrella Gymnastics) -- February 23, 2026
- [ ] CCP (Capital Gymnastics Cedar Park)
- [ ] CPF (Capital Gymnastics Pflugerville)
- [ ] CRR (Capital Gymnastics Round Rock)
- [ ] HGA (Houston Gymnastics Academy)
- [ ] OAS (Oasis Gymnastics)
- [ ] RBA (Rowland Ballard Atascocita)
- [ ] RBK (Rowland Ballard Kingwood)
- [ ] SGT (Scottsdale Gymnastics)
- [ ] TIG (Tigar Gymnastics)

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
