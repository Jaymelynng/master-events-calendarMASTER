> 🔄 **KEEP THIS CURRENT — every chat, every time.** If you touch this file or the work it describes: **update it the same session** · **delete what's stale or superseded** · **merge duplicates into ONE canonical copy** · **never spawn a second doc when this one already exists** · **record where things live**. A reference doc is either current or deleted — never left to rot. _(Banner intentionally on every doc — do not remove.)_

# New Gyms — Link & ID Map (AAR · EGF · MGC · PGN)

Every public link and every public ID for the 4 newer gyms, pulled live from iClassPro on **2026-08-28**. Built as a side reference — **nothing here is wired into the master events calendar.**

## Open this

**`NEW-GYMS-LINK-MAP.html`** — double-click it. Single screen, no page loads. Pinned sidebar picks the gym (or all 4) and the category (or everything). Type in the search box to filter all 957 rows at once. Click any row for the full record + a copy-link button + everything linked to it. `Copy URLs` / `Copy as CSV` export whatever is on screen right now.

## The other files

| File | What it is |
|---|---|
| `NEW-GYMS-ALL-LINKS-AND-IDS.csv` | The same 957 rows, flat, Excel-ready |
| `raw-harvest.json` | Untouched API responses: locations, sessions, programs, levels, all classes, all camps by type |
| `raw-detail.json` | Per-class and per-camp detail pulls (this is where tuition came from) |
| `raw-supplement.json` | Services, appointments, ProShop, nav bars, booking tiles |

## The 4 gyms

| Code | iClass slug | Name | Where | locationId |
|---|---|---|---|---|
| AAR | `allaroundgym` | All Around Gymnastic Academy | Plainville, MA | 1 |
| EGF | `eaglegymnasticsfrisco` | Eagle Gymnastics Frisco | Frisco, TX | 1 |
| MGC | `metrogymnastics` | Metro Gymnastics | Tigard, OR | 1 |
| PGN | `planetgymnasticsnatick` | Planet Gymnastics | Natick, MA | **3** |

PGN's locationId is 3, not 1. Every PGN API call needs `locationId=3`.

## URL grammar — every pattern below was clicked live, not inferred

**Customer portal**
```
portal.iclasspro.com/{slug}/booking                  landing tiles
portal.iclasspro.com/{slug}/classes                  + ?programs={id}  ?levels={id}  ?ages={n}
portal.iclasspro.com/{slug}/class-details/{classId}
portal.iclasspro.com/{slug}/camps/{typeId}           typeId = camp TYPE
portal.iclasspro.com/{slug}/camp-details/{campId}
portal.iclasspro.com/{slug}/appointments/{serviceId}
portal.iclasspro.com/{slug}/party-booking-01-date
portal.iclasspro.com/{slug}/products · /gift-certificate · /news · /account · /dashboard · /cart · /login?showLogin=1
```

**Open API — no login, returns JSON, works in a browser tab**
```
app.iclasspro.com/api/open/v1/{slug}/locations · sessions · categories · services
app.iclasspro.com/api/open/v1/{slug}/class-programs/{locId} · camp-programs/{locId} · levels/active/{locId}
app.iclasspro.com/api/open/v1/{slug}/classes?locationId={locId}&limit=200&page=1
app.iclasspro.com/api/open/v1/{slug}/classes/{classId}?locationId={locId}     ← this one has TUITION
app.iclasspro.com/api/open/v1/{slug}/camps?locationId={locId}&typeId={T}&limit=100&page=1
app.iclasspro.com/api/open/v1/{slug}/camps/{campId}?locationId={locId}
app.iclasspro.com/api/open/v1/{slug}/appointments?locationId={locId} · appointment-programs/{locId} · products/{locId}
```

## The trap that will bite you

**Camp TYPE is not camp PROGRAM.** The booking tile and the `/camps/{typeId}` URL use the camp **type** id — small numbers, 3 to 8. The `programId` stamped on each camp is a different internal number (52, 62, 77, 294, 319). Both are in the map, labelled separately.

There is no endpoint that lists camp types. They were found by walking typeId 1–120 per gym and keeping the ones the API answered for. **A camp type with zero live camps right now does not appear** — so the list is complete for what is bookable, not proof that nothing else exists.

## What is in and what is not

**In:** class tuition. All 559 classes across the 4 gyms carry a real figure. AAR bills per **Session**; EGF and MGC bill **Monthly**; PGN is mixed (Monthly, Cheer/Team, and 8 "Babies in Motion" classes on **No Charge** — those are $0 on purpose, not missing data).

**Not in:** camp price. The camp detail endpoint has no price field at all — checked on an AAR camp and a PGN camp. Camp prices still need an admin-authenticated pull.

**Not in:** 6 PGN camps. PGN's camp endpoint counts 64 but hands back 58; the other 6 exist and are not publicly bookable right now (closed registration windows). No other gym has a gap.

## How the 4 setups actually differ

- **"Find a Class"** — AAR sends you through an age wizard first. EGF, MGC and PGN go straight to `/classes`.
- **ProShop** — PGN only.
- **Gift certificates** — EGF only.
- **Appointments** — PGN only (25 services, 8 live appointments). PGN's "Kids Night Out" tile is an *appointment*; Metro's "KIDS NIGHT OUT" tile is a *camp*. Same words, different object.
- **Booking tiles** — MGC 3, AAR 5, EGF 5, PGN 9.

## To refresh

The build scripts are in the session scratchpad, not here. Re-running means: `harvest.js` → `supplement.js` → `enrich.js` → `build-csv.js` → `build-html.js`. Ask and it gets rebuilt from live in about three minutes.
