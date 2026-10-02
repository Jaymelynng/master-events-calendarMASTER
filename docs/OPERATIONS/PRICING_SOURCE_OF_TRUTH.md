# Pricing source of truth — input contract (SSoT)

**Last updated:** October 2, 2026  
**Purpose:** Single contract for how camp/event pricing works so docs, Python, and Admin UI stay aligned.

---

## ⛔ ALL PRICING REMOVED — October 2, 2026 (Jayme's decision)

**This section overrides everything below it.** The calendar no longer sets, shows, exports, or checks a price anywhere.

- **Why:** the prices are not verified as correct, and there is no system yet to pull the real price from iClass or compare against it. Until that exists, no price may appear in the app.
- **Database:** `events.price` is NULL on every event; the stored `price_mismatch` errors were stripped; the last price check (`check_price_mismatch`) was deleted from `rules`.
- **Sync:** `f12_collect_and_import.py` no longer sets a price. It used to fill one from `camp_pricing` / `event_pricing`, and if that found nothing, from the first dollar amount in the title or description. All of that is gone.
- **Engine:** `validation_engine.py` has no price checks.
- **App:** price is gone from the event side panel, Table View, CSV export, sync preview, add-event form, Rule Wizard, and the Gym Rules filters.
- **Still there, unused:** the `camp_pricing` and `event_pricing` tables keep their rows. Nothing reads them.
- **Record + backup:** `database/REMOVED_PRICING_2026_10_02.sql` and `database/backups/REMOVED_PRICING_2026_10_02_backup.json`.
- **Do NOT re-add any of it without Jayme's explicit go.**

Everything below describes how pricing worked BEFORE this date and is kept as history only.

---

## ⚠️ PRICE VALIDATION REMOVED — July 1, 2026 (Jayme's decision)

All three pricing checks (`check_camp_price`, `check_event_price`, `check_price_mismatch`) were **deleted from the `rules` table** and stored pricing errors were stripped from `events.validation_errors`. Jayme: too many weird situations; the front-end price verification approach doesn't work; she is exploring a better authenticated-backend connection before rebuilding pricing validation. Focus is now on general content checks (program vs text, age vs settings, title vs description).

**What still exists and why:**
- `camp_pricing` + `event_pricing` tables + Admin Pricing tab — **still used by sync to SET the displayed price on every event** (iClass's public camps API sends no price). They no longer feed any validation.
- The check functions in `validation_engine.py` — dead code while no rules row references them; left in place for a future rebuild.
- `archive.pricing_schedules` + `archive.camp_type_mappings` — the April backend-discovery data, moved out of `public` (original export JSONs no longer on disk). `camp_pricing_map` (empty) was dropped.

**Restore path:** `database/REMOVED_PRICING_VALIDATION_2026_07_01.sql`

Everything below this line describes the system as it worked BEFORE July 1, 2026, kept for the future rebuild.

---

## Authoritative data for validation (sync-time)

| Event type | Table | Managed via |
|------------|--------|-------------|
| **CAMP** | `camp_pricing` | Admin Dashboard → Pricing tab (and Supabase) |
| **CLINIC, KIDS NIGHT OUT, OPEN GYM** | `event_pricing` | Admin Dashboard → Pricing tab (and Supabase) |
| **Extra allowed amounts (any type)** | `rules` with `rule_type` = `valid_price` or `sibling_price` | Gym Rules / Rule Wizard |

**Python** loads pricing during sync as follows:

- `camp_pricing` — REST in `f12_collect_and_import.fetch_camp_pricing_from_db()` / `get_camp_pricing()`
- `event_pricing` — REST + date filtering in `automation/pricing_supabase.py` (`get_active_event_prices_for_validation`, `build_event_pricing_for_today`) so `validation_engine` does not import the full f12 module
- **`rules`** — `fetch_rules()` / `get_rules_for_gym()` in `f12_collect_and_import.py`

### `event_pricing` date logic

Rows include `effective_date` and optional `end_date`. For each event, prices used for validation and for the displayed `price` field are those rows where:

- `effective_date` ≤ event `start_date`, and  
- `end_date` IS NULL OR `end_date` ≥ event `start_date`.

If no row matches, that gym/type has no table-based expected prices for that event date (checks may skip or only use `rules`).

### `camp_pricing` logic

Per gym: `full_day_daily`, `full_day_weekly`, `half_day_daily`, `half_day_weekly`. Interpretation (half vs full, daily vs weekly) uses **iClass API** fields on the event (`programName`, `startDate` / `endDate`) — same as before.

---

## Warm / script-produced data (optional)

Exports from authenticated iClass (pricing schedules, JSON dumps, etc.) are **engineering reference** for:

- One-time seeds or audits  
- Understanding tier structures  

They are **not** joined to public portal events for automatic “which schedule” resolution, because the **public camp API does not expose `pricingScheduleId`**. Any future use of script data in-product must go through **explicit tables or Admin UI** you define in a doc update — not name-matching on `programName`.

---

## Explicit non-goals

1. **No** inferring `pricing_schedules` row from public portal text or `programName` alone for strict validation.  
2. **No** operator workflow that requires DevTools JWT capture or download/upload scripts for day-to-day use.  
3. **`pricing_schedules`** may exist in Supabase for analytics or future features; it is **not** the sync validation source of truth unless this doc is revised with a signed product decision (e.g. UI-maintained `camp_id` → schedule map).

---

## Related docs

- [DATA_QUALITY_VALIDATION.md](./DATA_QUALITY_VALIDATION.md) — narrative for operators  
- [AUDIT_DATA_ERROR_REFERENCE.md](./AUDIT_DATA_ERROR_REFERENCE.md) — per-check matrix (must match `validation_engine.py`)  
- [ADMIN_DATA_FLOW.md](./ADMIN_DATA_FLOW.md) — where Admin writes pricing and rules  
