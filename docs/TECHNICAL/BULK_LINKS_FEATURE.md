# 📦 Bulk Links Feature — Complete Reference

**Status:** Slice 1 shipped (May 14, 2026)
**Purpose:** Port of the standalone Bulk Link PRO app into Calendar as a sister-tool tab. Eliminates the two-app / two-database split — one app, one Supabase, one set of keys.

This doc is the **source of truth for rebuilding the feature from scratch** if Supabase or the codebase ever needs to be reconstructed.

---

## 🧭 What this feature is

A new tab inside Calendar (`teamcalendar.mygymtools.com`) that replaces the standalone `bulklinkpro.mygymtools.com`. It exposes Bulk Link PRO's "select gyms × select fields → bulk Open or Copy" pattern using Calendar's existing Supabase project.

### Why it lives in Calendar
- BLP and Calendar already share the same 10 gym IDs (CCP, CPF, CRR, RBA, RBK, HGA, EST, OAS, SGT, TIG).
- BLP was static data (manual links, no live sync). Calendar runs the live iClassPro sync + validation engine.
- Moving Calendar into BLP would have required porting the Python sync pipeline. Moving BLP into Calendar just needs new tables + new components.
- One Supabase project = one set of keys to rotate, one billing line, one schema to back up.

### Access
- **Master tab nav** sits at the very top of the page (`MasterNav` component inside `src/App.js`). Two tabs in Slice 1:
  - **📅 Calendar** — lives at `/` (the existing dashboard)
  - **📦 Bulk Links** — lives at `/bulk-links`
- Switching is instant; no auth gate. Same Supabase anon key.
- Adding a future tab (e.g. "📧 Email") = one new row in the `TABS` array inside `src/App.js`.

### URL routing (added with Slice 1)
The browser URL stays in sync with the active tab via the History API (no `react-router` dependency — pushState/popstate only). This means:

- `https://teamcalendar.mygymtools.com/` → Calendar tab
- `https://teamcalendar.mygymtools.com/bulk-links` → Bulk Links tab
- Browser **back / forward** buttons work
- Bookmarks work, sharing direct links works, opening a tab in a new window works
- `vercel.json` has a SPA rewrite so any unknown path serves `/index.html` (otherwise Vercel would 404 on direct visits to `/bulk-links`)

### Retiring `bulklinkpro.mygymtools.com` (when ready)
Because Bulk Links now has its own URL, the old BLP subdomain can be redirected to the new home with **no code changes in this repo**. Two ways to do it:

1. **Cloudflare (or whichever DNS provider hosts `mygymtools.com`)** → add a Page Rule / Redirect Rule:
   `bulklinkpro.mygymtools.com/* → https://teamcalendar.mygymtools.com/bulk-links` (301 permanent)
2. **In the Bulk Link PRO repo** → add a `vercel.json` at its root:
   ```json
   {
     "redirects": [
       { "source": "/(.*)", "destination": "https://teamcalendar.mygymtools.com/bulk-links", "permanent": true }
     ]
   }
   ```
   Push, Vercel redeploys, the redirect kicks in.

Either approach is reversible (delete the rule / revert the file). Recommend doing this only once Slice 3 (admin editing) ships in Calendar — until then, BLP's admin is still useful for editing data.

---

## 🗄️ Database — 4 new tables in Calendar's Supabase

All tables are namespaced with `bulk_` to never collide with Calendar's existing `gym_links` (which uses a different schema: one-row-per-gym-per-link-type).

| Table | Rows (post-migration) | Purpose |
|---|---|---|
| `bulk_pages` | 4 | Top-level tabs across the Bulk Links view (General Links / Summer Camp / Programs / Active Campaign). Add a row → new tab. |
| `bulk_sections` | 24 | Groupings inside each tab (e.g. "GYM INFO", "ICLASS — PORTAL", "PRICING"). |
| `bulk_fields` | 104 | Individual rows in each section (e.g. "Phone", "Website", "Member Login"). `field_type` ∈ link/text/email/phone. `allow_copy` and `allow_open` toggle bulk-action participation. |
| `bulk_field_values` | 1,160 | Per-gym values. Keyed by `(field_id, gym_id)`. `status='active'` is normal; `status='hidden'` archives a value. Multiple rows per gym = multi-value field (e.g. camp weeks). |

**Locations:** the feature **reuses Calendar's existing `gyms` table** for the 10 gym records — no separate locations table.

**Brand colors:** required a new column on `gyms` because BLP's `locations` table had it but Calendar's `gyms` did not. Added May 14, 2026 via [`database/ADD_BRAND_COLORS_TO_GYMS.sql`](../../database/ADD_BRAND_COLORS_TO_GYMS.sql):
- `gyms.brand_colors TEXT[]` — `[primary, secondary, tertiary, light]` hex strings.
- Pre-populated with the 10 known gym palettes (CCP / CPF blue+red, CRR hot pink, HGA red, EST navy/black, OAS teal/purple, RBA / RBK navy+red, SGT red/silver, TIG orange/navy).
- Used by `GymProfileCard`'s gradient header. Available to any other Calendar UI that wants per-gym color theming (audit cards, sync status grid, etc.).

### Foreign-key flow

```
bulk_pages.id  ←  bulk_sections.page_id
bulk_sections.id  ←  bulk_fields.section_id
bulk_fields.id  ←  bulk_field_values.field_id
bulk_field_values.gym_id  →  (joined to gyms.id at read time; not a hard FK so a stale gym_id never blocks an import)
```

### RLS posture (matches Calendar's existing pattern)
All four tables have RLS enabled with a single `FOR ALL USING (true) WITH CHECK (true)` policy granted to `anon` and `authenticated`. Same posture as Calendar's other public-facing tables. Tighten before any SaaS rollout.

### Authoritative SQL files
- [`database/CREATE_BULK_LINKS_TABLES.sql`](../../database/CREATE_BULK_LINKS_TABLES.sql) — full bulk_* schema + policies + RLS + updated-at triggers.
- [`database/ADD_BRAND_COLORS_TO_GYMS.sql`](../../database/ADD_BRAND_COLORS_TO_GYMS.sql) — adds `gyms.brand_colors` + populates 10 gym palettes.

Apply both to a fresh Supabase project to recreate the schema.

---

## 🖥️ UI — files and what they do

| File | Purpose |
|---|---|
| [`src/App.js`](../../src/App.js) | `MasterNav` component at the top renders the two master tabs (📅 Calendar / 📦 Bulk Links) and owns the `view` state. Lazy-loads `BulkLinksHub` so it doesn't ship with the calendar bundle until first click. |
| [`src/components/BulkLinks/BulkLinksHub.js`](../../src/components/BulkLinks/BulkLinksHub.js) | The page itself: top bar with `← Calendar`, tab nav (loads from `bulk_pages`), global Open/Copy action bar with live counters, body that renders one `GymProfileCard` per gym. |
| [`src/components/BulkLinks/GymProfileCard.js`](../../src/components/BulkLinks/GymProfileCard.js) | Per-gym card with brand-color gradient header, per-card Open/Copy buttons, expandable sections, rows with checkboxes + single-link copy. |
| [`src/lib/bulkLinksApi.js`](../../src/lib/bulkLinksApi.js) | Supabase data access: `bulkPagesApi`, `bulkPageDataApi.getBySlug(slug)`, `bulkValuesApi.upsert/delete/bulkFillAll`. Also exports `getCopyValue` / `getOpenUrl` helpers for the UI. |

### How the dual counter works (the BLP "magic" pattern)
- `BulkLinksHub` owns a single `selectedFieldIds: Set<string>` state.
- Each `GymProfileCard` receives `selectedFieldIds` + `onToggleField` as props.
- A `GymProfileCard` computes its own `openCount` / `copyCount` from `selectedFieldIds ∩ this gym's values`.
- The hub computes the global `globalOpenCount` / `globalCopyCount` across all gyms × selected fields.
- Both counters update on every checkbox toggle. Same source of truth, two views.

---

## 🔁 Data migration from Bulk Link PRO

The feature was bootstrapped by copying data from BLP's Supabase (`wunjenvrovcrntjakawi`) into Calendar's (`xftiwouxpefchwoxxgpf`).

### Step 1 — schema applied via Supabase MCP migration `create_bulk_links_tables` on May 14, 2026.

### Step 2 — first-pass data inserted directly via MCP execute_sql:
- 4 pages
- 24 sections
- 104 fields
- 116 field_values (the `programs` tab — fully populated to give immediate visual test)

### Step 3 — remaining 1,044 values via Node migration script:
[`scripts/migrate-blp-to-calendar.mjs`](../../scripts/migrate-blp-to-calendar.mjs)

Reads from BLP's Supabase project using its anon key, writes to Calendar's using its anon key. Idempotent (upserts on `id`). Handles the bulky remaining pages:
- `active-campaign` (140 values)
- `general-links` (414 values)
- `summer-camp` (490 values)

How to run (PowerShell):
```powershell
$env:BLP_SUPABASE_ANON_KEY = "<paste BLP anon key>"
$env:CAL_SUPABASE_ANON_KEY = "<paste Calendar anon key>"
node scripts/migrate-blp-to-calendar.mjs
```

Expected final count: `bulk_field_values total in Calendar: 1160`.

---

## 🔨 How to rebuild from scratch

If Calendar's Supabase is wiped or you need to recreate this feature in a new project:

1. **Schema:** run [`database/CREATE_BULK_LINKS_TABLES.sql`](../../database/CREATE_BULK_LINKS_TABLES.sql) AND [`database/ADD_BRAND_COLORS_TO_GYMS.sql`](../../database/ADD_BRAND_COLORS_TO_GYMS.sql) in the Supabase SQL editor.
2. **Seed data:** either restore from a Supabase backup, OR re-run the migration if BLP's project is still alive:
   ```powershell
   node scripts/migrate-blp-to-calendar.mjs
   ```
3. **Reach the UI:** open `teamcalendar.mygymtools.com` → click the **📦 Bulk Links** floating button.

If BLP's Supabase is gone too, the data is recoverable from any pg_dump backup of `wunjenvrovcrntjakawi`, with column-name remapping: `field_values.location_id` → `bulk_field_values.gym_id`.

---

## 🎯 Slice 1 scope (shipped)

✅ Tab nav across the top
✅ 10 gym cards with brand-color gradient headers
✅ Section accordion (drop-open / drop-close) inside each card
✅ Row checkboxes feeding live per-card AND global counters
✅ Per-card Open/Copy buttons
✅ Global Open/Copy buttons
✅ Single-click on link → open in new tab
✅ Hover row → single-value copy icon
✅ Toast confirmation on copy
✅ Back button to return to Calendar

---

## 🛣️ Future slices (NOT in Slice 1)

| Slice | What it adds |
|---|---|
| **2** | Top "section selector" grid (the wide bulk picker above gym cards in BLP). Search filter on the gym list. |
| **3** | Admin view: "All Gyms Overview" with dots-per-gym, intersection modal with three panels, **iframe preview** while editing. |
| **4** | Settings tab: add/edit gyms, manage pages (dynamic add-a-page-from-DB). |
| **5** | Active Campaign custom component with Session Manager (the multi-account session tracker). Until Slice 5, the Active Campaign tab renders generic cards with no special features. |

---

## ⚠️ Known limitations (Slice 1)

- **Active Campaign tab** renders generic gym cards. The killer Session Manager / Quick Presets / date-filter Reports section from BLP is NOT ported yet.
- **No admin editing** in Slice 1 — you can read and bulk-copy/open, but editing values still requires using BLP's admin (or direct Supabase edits). Once Slice 3 lands, BLP retires.
- **No iframe preview** — Slice 3.

---

## 🔗 Cross-references

- BLP source project: `wunjenvrovcrntjakawi` (kept live until Slice 4 ships, then retired)
- Calendar Supabase project: `xftiwouxpefchwoxxgpf`
- Original BLP repo: https://github.com/Jaymelynng/Bulk-Link-PRO
- Calendar repo: this one

---

**Last Updated:** May 14, 2026
**Author:** Slice 1 build session
