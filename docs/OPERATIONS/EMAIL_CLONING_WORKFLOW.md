# 📧 Email Cloning Workflow — Multi-Gym Camp Emails

**Last Updated:** May 18, 2026
**Status:** Production-tested for Summer Camp 2026 send across all 10 gyms.

This is the verified workflow for producing one camp-promotion email per gym (CCP / CPF / CRR / EST / HGA / OAS / RBA / RBK / SGT / TIG) using **live data from Calendar's Supabase** with **no manual copy-paste of openings numbers**.

---

## 🎯 The 1-Sentence Summary

For each gym, the email cloner reads camp `openings` from `events` + footer info from `gyms_with_links` view, then renders a self-contained HTML file to `C:\Users\Jayme\Downloads\camp-email-clone\output\{GYM}.html`.

---

## ✅ The "OK to Send" Verification Rules

Before sending ANY camp email, every one of these must be true (was verified across all 10 gyms on May 18, 2026):

1. **Sync ran today.** Query `sync_log` for that gym + CAMP, confirm `last_synced` is < 24h ago. If not, hit SYNC in Calendar first.
2. **Every `camp-details/XXX` link in the email exists** in `events` for that gym (`gym_id = '...' AND type = 'CAMP'`).
3. **Slug in URL matches `gyms.iclass_slug`** for that gym (e.g. CCP = `capgymavery`, TIG = `tigar`, RBA = `rbatascocita`).
4. **Footer matches `gyms_with_links`** — phone, email, address, Google Maps URL, website.
5. **Days countdown matches** — `(week_1_start_date - today)` in whole days. Re-render if off.
6. **Urgency labels match openings under the ≤5 rule** (see below).

---

## 🚦 The ≤5 Urgency Rule (locked in May 18, 2026)

| Condition | Email shows |
|---|---|
| `openings = 0` | 🔴 **GYM SOLD OUT / NINJA SOLD OUT** button (red, no link, plus strikethrough on week title + grayscale image) |
| `1 ≤ openings ≤ 5` | 🔴 **ONLY N LEFT** red pill above the regular button (button still clickable) |
| `openings > 5` | Normal button, no pill |

The pill says the exact number from the DB (e.g. `ONLY 3 LEFT`, not a rounded bucket).

---

## 🗄 Where the Data Comes From

| Field in email | Source table | Source column |
|---|---|---|
| Camp ID (`camp-details/XXX`) | `events` | `event_url` (parse digits at end) |
| Openings count | `events` | `openings` (integer, live from iClassPro sync) |
| Sold-out check | `events` | `openings = 0` |
| Theme name | `events` | parsed from `title` |
| Date range | `events` | `start_date` + `end_date` |
| Ages | `events` | `age_min` + `age_max` |
| iClass slug | `gyms` | `iclass_slug` |
| Phone | `gyms_with_links` | `phone` (falls back to `bulk_field_values` Phone field) |
| Email | `gyms_with_links` | `email` |
| Address | `gyms_with_links` | `address` |
| Google Maps URL | `gyms_with_links` | `google_maps_url` |
| Website | `gyms_with_links` | `website_url` |
| Brand colors | `gyms` | `brand_colors[]` (array of hex) |
| Logo | `gyms` | `logo_url` |

---

## ⚠️ Gotchas (mistakes we already made — don't repeat)

### 1. `events.updated_at` is NOT a "data freshness" timestamp

Calendar's sync code intentionally **skips writes when the new value equals the old value**. So `events.updated_at` only changes when an actual number changed since the previous sync. If a camp's openings count hasn't changed for 5 months, `updated_at` will still say December even though the sync ran 2 hours ago.

**To check "did sync actually run today" use `sync_log.last_synced`, NOT `events.updated_at`.**

### 2. `bulklinkpro` Supabase project (`wunjenvrovcrntjakawi`) is NOT the calendar source

Some legacy tools point at BLP's Supabase. For email cloning, use Calendar's project `xftiwouxpefchwoxxgpf`. Gym info now lives in `gyms_with_links` (a view) which pulls live from `bulk_field_values` — no copy-paste sync between projects needed.

### 3. `events.openings` is the integer; `openings_display` is the iClass string

`openings_display` is the text iClass shows publicly (e.g. "No Openings Available"). Use the integer `openings` for logic, only use the display string if you want to mirror iClass's exact wording.

---

## 🔁 Cloning Sequence (per gym)

1. Pull all CAMP rows for the gym from `events` (filter `gym_id = '...' AND type = 'CAMP'`, sorted by `start_date`).
2. Pull gym footer info from `gyms_with_links` for that gym ID.
3. For each week, look up `openings` and assign one of: NORMAL / ONLY-N-LEFT / SOLD-OUT.
4. Write HTML to `output/{GYM}.html` using the gym's `brand_colors[0]` as primary, `brand_colors[1]` as secondary.
5. Verify the 6 rules at the top of this doc before sending.

---

## 📊 Today's Final State (May 18, 2026)

All 10 emails verified. Camp counts per gym (CAMP rows synced today):

| Gym | Weeks | Camps | Slug |
|---|---|---|---|
| CCP | 10 | 20 (Full + Half Day) | `capgymavery` |
| CPF | 11 | 22 (Full + Half Day) | `capgymhp` |
| CRR | 10 | 22 (Full + Half Day) | `capgymroundrock` |
| EST | 10 | 20 (Gym + Ninja) | `estrellagymnastics` |
| HGA | 12 | 24 (Full + Half Day) | `houstongymnastics` |
| OAS | 10 | 20 (Gym + Ninja) | `oasisgymnastics` |
| RBA | 10 | 10 (single button) | `rbatascocita` |
| RBK | 10 | 10 (single button) | `rbkingwood` |
| SGT | 10 | 20 (Gym + Ninja) | `scottsdalegymnastics` |
| TIG | 12 | 24 (Gym + Ninja) | `tigar` |

---

## 🛣 Future improvements (not in scope today)

- Wrap this into a click-to-generate button inside Calendar's Admin Dashboard (currently runs as a separate Node script reading from Supabase).
- Auto-trigger a `SYNC` before generating, so freshness is guaranteed.
- Add per-week thumbnail image lookup (currently hardcoded image URLs in the cloner).
