> 🔄 **KEEP THIS CURRENT — every chat, every time.** If you touch this file or the work it describes: **update it the same session** · **delete what's stale or superseded** · **merge duplicates into ONE canonical copy** · **never spawn a second doc when this one already exists** · **record where things live**. A reference doc is either current or deleted — never left to rot. _(Banner intentionally on every doc — do not remove.)_

# Master Events Calendar — what the top of the screen shows and does

**As built 2026-08-28.** Everything below is live behavior, not a proposal. Numbers shown are the real August 2026 values so the shapes are concrete.

---

## The job this screen has

One person manages **14 gymnastics gyms**. Every month each gym is supposed to run a set number of marketable events. The screen has to answer, without scrolling or clicking:

1. Which gyms haven't done what they owe this month?
2. Is any of the event data wrong before customers see it?
3. What do I do about it right now?

Everything else on the page is the calendar itself.

---

## The data behind it

| Thing | Where it comes from |
|---|---|
| Events | Supabase `events_with_gym` — a view that is `events` UNION `events_archive`, so a month shows what already happened plus what's still coming |
| Gyms | Supabase `gyms` — 14 rows, each with an iClass slug and account id |
| Buckets | Supabase `event_types` — CLINIC, KIDS NIGHT OUT, OPEN GYM (scored) + CAMP, CAMP CARE, SPECIALTY, UNSORTED (not scored) |
| Goals | Supabase `monthly_requirements` — global, currently 1 Clinic, 2 KNO, 1 Open Gym per gym per month |
| Portal links | Supabase `gym_links` — one saved URL per gym per category |
| Category sorting | Supabase `event_type_mappings` — iClass's own camp-type name → which bucket it lands in |

Events sync from iClassPro's public API. **No live iClass calls happen in the browser** — that API sends no CORS header, so every count on screen is computed from data already loaded.

---

## BAND 1 — the header strip

One row, dark rose.

```
‹ August 2026 ›   20 CLINIC goal 1/gym   22 KNO goal 2/gym   26 OPEN GYM goal 1/gym
                              5 gyms short →      104 events · 10 of 14 gyms active
```

| Element | Shows | Does when clicked |
|---|---|---|
| `‹ August 2026 ›` | The month being viewed | Steps the whole page a month |
| Count chips | How many of that type exist this month, **and** the per-gym goal on the same chip | Filters the calendar to that type |
| `5 gyms short →` | How many gyms haven't met their goals. Red when short, green when all clear. Hovering names them | Switches to the gym table |
| Stat line | Total events, how many gyms have any | Ctrl+click opens audit history |

**Why the goal sits on the chip:** the same word used to appear in three places with three numbers — `20 Clinics`, `10 Clinics`, `1 Clinic` — with nothing saying they were three different questions. Now the count and its goal are on one chip and the other two places are gone.

**The chips are not hardcoded.** They render one per row in `event_types` where `is_tracked = true`. Add a tracked bucket in admin and its chip appears by itself.

---

## BAND 2 — sync / export

Three buttons: `SYNC`, `EXPORT`, and a wand. Shift+click or long-press the wand opens the Admin Dashboard.

---

## BAND 3 — portal opener

```
🌐 OPEN ALL BOOKING PAGES (14)  |  🏕️ Camps 8   🌙 KNO 10   🎯 Open Gym 9   ⭐ Clinics 10
```

| Element | Shows | Does |
|---|---|---|
| Booking (primary) | 14 — every gym has one | Opens all 14 booking pages, one tab each |
| Category chips | How many gyms have that category **on the calendar this month** | Opens that category's page for each of those gyms |

**Why booking is the primary:** it's the only link all 14 gyms have, the only URL with no typeId baked in — so the only one that can't go stale — and it is each gym's own live index of everything it offers.

**Why the counts matter:** the old version had eight equal-looking buttons with no counts. Measured live, "Summer Full" had 11 stored links and exactly **one** gym with a camp behind it. Four of eight buttons opened pages saying "no camps found." A chip with nothing behind it now doesn't render at all, so Summer disappears in September and returns in May on its own.

Full and Half merged into one **Camps** chip — a duration is a property of a camp, not a separate thing to check.

---

## BAND 4 — the digest (the part still being worked on)

Four numbers, then who's short, then what to do.

### The four numbers — each one clicks through

| Number | Means | Click goes to |
|---|---|---|
| **5** gyms short | Gyms that haven't met all three goals. Names on hover | The gym table |
| **104** events | Everything on the calendar this month | Unfiltered calendar |
| **8** data issues | Events with wrong dates/times/ages, or missing descriptions | Error view |
| **4** gyms with no events | Nothing synced at all — these are the 4 newly onboarded gyms | Sync panel |

### Who's short

Only gyms with a gap. Each shows exactly what it owes:

```
All Around   need 1 CLINIC   need 2 KNO   need 1 OPEN GYM
Eagle        need 1 CLINIC   need 2 KNO   need 1 OPEN GYM
Metro        need 1 CLINIC   need 2 KNO   need 1 OPEN GYM
Planet       need 1 CLINIC   need 2 KNO   need 1 OPEN GYM
Tigar                                     need 1 OPEN GYM
```

### What to do — wired buttons, not labels

| Action | What it opens |
|---|---|
| Email 5 gyms about what they owe | EmailComposer, preloaded with those gyms. Was Shift+click wand → Admin → Email Managers → select → compose |
| Fix 8 data issues | Flips the calendar into error view |
| Sync 4 gyms with no events | Opens the sync panel |

---

## What's unresolved

**Seeing all 14 gyms at once.** The current build hides the 9 that are complete behind an expander. That is wrong — hiding nine gyms means not being able to see the operation. The next version puts every gym on screen as a tile, short ones loud, complete ones quiet but readable.

**Contrast.** White cards on cream is unreadable. Needs to sit on the dark frame with near-white text.

**Detail without navigating.** Clicking a gym should slide a drawer over the page with that gym's whole month — what it owes, every event, its issues, its portal links — with the grid still underneath so closing returns you exactly where you were.

---

## Hard constraints

- **No vertical scrolling to see state.** Everything above answers its question on the first screen.
- **Nothing hardcoded per gym or per category.** Buckets, goals, links and category sorting are all Supabase tables edited from admin.
- **No live iClass calls from the browser.** CORS blocks them; verified.
- **Never grey text on dark.** White or near-white only.
- **A number you can't act on doesn't belong on screen.** "Requirements Met 9/14" became "5 gyms short →" for that reason.

---

## Files

| File | Role |
|---|---|
| `src/components/EventsDashboard_REFACTORED.js` | The live dashboard. **Note:** `EventsDashboard.js` (4,158 lines) is imported by nothing |
| `src/components/EventsDashboard/DashboardHeader.js` | Band 1 |
| `src/components/EventsDashboard/BulkPortalOpener.js` | Band 3 |
| `src/components/EventsDashboard/MonthlyDigest.js` | Band 4 |
| `src/components/EventsDashboard/CalendarControls.js` | Filter chips, driven by `event_types` |
| `automation/f12_collect_and_import.py` | The sync. Reads `event_type_mappings` for categorisation |
