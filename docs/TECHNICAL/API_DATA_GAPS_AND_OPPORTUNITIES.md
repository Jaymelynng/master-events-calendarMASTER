# iClassPro API — Data Gaps & Opportunities

**Created:** March 9, 2026
**Purpose:** Document ALL data we're NOT currently capturing from iClassPro's public API, and what's currently hardcoded that could be auto-discovered.

---

## Current State

> **✅ UPDATE (March 9, 2026):** Direct HTTP API sync is now LIVE. Playwright has been replaced as the default collection method. See "DIRECT API SYNC REPLACEMENT" section below for the implemented flow.

~~The Playwright-based sync navigates to each gym's portal page, intercepts `/camps/{eventId}` detail JSON responses, and parses them.~~ The direct HTTP API sync calls iClassPro's public API endpoints via `urllib`. It:
- Takes **~5 minutes** for all 10 gyms (was ~10 min with Playwright)
- Auto-discovers categories via the bookings endpoint (no hardcoded URLs needed)
- Playwright code is kept as fallback (`USE_DIRECT_API=false` env var)

---

## DATA WE'RE NOT CAPTURING

### From `/organizations` endpoint (per gym)

| Field | What It Contains | Why It Matters |
|-------|-----------------|----------------|
| `timezone` | e.g. "America/Phoenix", "America/Chicago" | Correct time handling per gym — TX vs AZ gyms are different time zones |
| `contactEmail` | Gym's contact email | Could auto-populate manager emails instead of manually entering in `gyms` table |
| `primaryColor` / `secondaryColor` | Hex brand colors | Auto-populate gym branding instead of hardcoding in CSS |
| `logo` / `image` | Gym logo URLs | Display gym logos in dashboard |
| `defaultLocationId` | Main location ID | Needed for API calls — currently discovered by navigating pages |
| `showOpenings` | Whether availability shown publicly | Know which gyms show availability |
| `showEvaluations` | Whether gym uses skill evaluations | Future: skill chart tracker |
| `showInstructors` | Whether instructors shown publicly | Know which gyms expose instructor data |
| `showRoom` | Whether room names shown publicly | Know which gyms expose room info |
| `hasMultipleActiveLocations` | Multi-location gym flag | Handle multi-location gyms (e.g., Capital has 3) |

### From `/locations` endpoint (per gym)

| Field | What It Contains | Why It Matters |
|-------|-----------------|----------------|
| `email` | Location-specific email | Per-location contact vs general gym email |
| `phone` | Location phone number | Currently in `gyms` table but could be kept in sync |
| `address/city/state/zip` | Full address | Currently in `gyms` table but could be kept in sync |
| `logoImage` / `headerImage` | Location-specific images | Some gyms have different logos per location |
| `id` (locationId) | Location ID number | **Critical** — needed for all other API calls. Currently inferred from URLs |

### From `/camp-programs/{locationId}` (per gym)

| Field | What It Contains | Why It Matters |
|-------|-----------------|----------------|
| `id` (typeId) | Program category ID | **Currently hardcoded in `gym_links` table!** These are gym-specific and should be auto-discovered |
| `name` | Category name ("CLINICS", "KIDS NIGHT OUT", etc.) | Know what categories each gym actually has |

**This is the big one.** Right now, someone manually builds URLs like:
`https://app.iclasspro.com/portal/capgymavery/camps?sortBy=time&typeId=7`

The `typeId=7` part is hardcoded per gym. If a gym reorganizes their categories, our links break. We should auto-discover these.

### From `/camps/{eventId}` detail endpoint (per event)

| Field | Currently Captured? | What It Contains | Why It Matters |
|-------|-------------------|-----------------|----------------|
| `id` | ✅ Yes (as `event_id`) | iClassPro event ID | Used for URL building |
| `name` | ✅ Yes (as `title`) | Event title | Displayed in calendar |
| `description` | ✅ Yes | Full HTML description | Parsed for price, time, ages |
| `startDate` / `endDate` | ✅ Yes | Date range | Event dates |
| `minAge` / `maxAge` | ✅ Yes | Age range | Age validation |
| `schedule` | ✅ Yes | Time blocks | Parsed for time |
| `hasOpenings` | ✅ Yes | Availability | Shown in UI |
| `image` | ✅ Yes (as `flyer_url`) | Event flyer | Flyer detection |
| `registrationStartDate` / `registrationEndDate` | ✅ Yes | Reg window | Displayed |
| `programName` | ❌ **NO** | "CLINICS", "KIDS NIGHT OUT", etc. | Could validate event type mapping, detect category changes |
| `roomName` | ❌ **NO** | Room/area in facility | Show WHERE in the gym |
| `instructors` | ❌ **NO** | Array: `[{id, firstName, lastName}]` | Show WHO runs it — valuable for parents |
| `blocks` | ❌ **NO** | Exact timestamps per session | More precise than `schedule` — has actual dates + times |
| `programIsDeleted` | ❌ **NO** | Whether program was deleted | **Instant deletion detection** — no need to compare against previous sync |
| `campRegisterExpired` | ❌ **NO** | Registration closed | Show registration status |
| `autoApprove` | ❌ **NO** | Auto vs manual approval | Know if registration is instant or requires gym approval |
| `allowToRequestCampThatIsFull` | ❌ **NO** | Waitlist enabled | Show waitlist status |
| `allowWebRegistration` | ❌ **NO** | Online reg allowed | Know if event is online-registration enabled |

---

## HARDCODED DATA THAT SHOULD BE AUTO-DISCOVERED

### 1. Program Category TypeIds (currently in `gym_links.url`)

Each gym link URL has a hardcoded `typeId` parameter:
```
capgymavery → typeId=7 (CLINICS), typeId=13 (KNO), typeId=17 (OPEN GYM)
```

These vary per gym and could change if the gym reorganizes. Should be auto-discovered via:
```
GET /api/open/v1/{slug}/bookings/{locationId}
```

**CRITICAL DISCOVERY (March 9, 2026):** There are TWO different ID systems in iClassPro:
- `camp-programs/{locationId}` returns **programIds** (e.g., CLINICS=246) — these DO NOT work as typeIds
- `bookings/{locationId}` returns **typeIds** inside `targetParams` (e.g., CLINICS typeId=7) — these ARE what the listing URL needs

We tested: `camps?typeId=246` returns "No camps found." Only `camps?typeId=7` works.

**The `bookings/{locationId}` endpoint is the correct source for auto-discovery:**
```json
{"title":"CLINIC","target":"camps","targetParams":{"typeId":7}},
{"title":"KIDS NIGHT OUT","target":"camps","targetParams":{"typeId":13}},
{"title":"OPEN GYM","target":"camps","targetParams":{"typeId":17}},
{"title":"SCHOOL YEAR CAMP - FULL DAY","target":"camps","targetParams":{"typeId":14}},
{"title":"SUMMER CAMP - FULL DAY","target":"camps","targetParams":{"typeId":1}},
{"title":"SUMMER CAMP - HALF DAY","target":"camps","targetParams":{"typeId":21}}
```
Also reveals categories we may not have URLs for (e.g., CCP has SUMMER CAMP - HALF DAY).

### 2. Location IDs (currently inferred from URLs)

Each gym's `locationId` is embedded in portal URLs but not stored as a field. Should be auto-discovered via:
```
GET /api/open/v1/{slug}/locations
```

### 3. Portal Slugs (partially database-driven)

The `gyms.iclass_slug` column exists and the Python script uses it, but it's manually populated. Could be verified/discovered from the organizations endpoint.

### 4. Gym Contact Info (manually entered)

Manager names, emails, phones are manually entered in the `gyms` table. Could be cross-referenced with:
```
GET /api/open/v1/{slug}/organizations
GET /api/open/v1/{slug}/locations
```

---

## RECOMMENDED NEW DATABASE COLUMNS

### `events` table additions:
```sql
program_name VARCHAR,        -- iClassPro program category (e.g., "CLINICS")
room_name VARCHAR,           -- Facility room/area
instructors JSONB,           -- Array of {id, firstName, lastName}
is_deleted_upstream BOOLEAN, -- programIsDeleted from iClass
registration_expired BOOLEAN,-- campRegisterExpired from iClass
auto_approve BOOLEAN,        -- autoApprove from iClass
waitlist_enabled BOOLEAN,    -- allowToRequestCampThatIsFull from iClass
```

### `gyms` table additions:
```sql
iclass_location_id INTEGER,  -- locationId from /locations endpoint
iclass_timezone VARCHAR,     -- timezone from /organizations
iclass_primary_color VARCHAR, -- brand color from /organizations
iclass_logo_url TEXT,        -- logo from /organizations
```

### New table: `gym_program_categories`
```sql
gym_program_categories (
  id UUID PRIMARY KEY,
  gym_id VARCHAR NOT NULL,
  type_id INTEGER NOT NULL,   -- iClassPro typeId
  name VARCHAR NOT NULL,       -- "CLINICS", "KIDS NIGHT OUT", etc.
  mapped_event_type VARCHAR,   -- Our event type: "CLINIC", "KIDS NIGHT OUT", etc.
  last_discovered_at TIMESTAMPTZ,
  UNIQUE(gym_id, type_id)
)
```
This replaces the hardcoded typeId in gym_links URLs. Auto-discovered, auto-refreshed.

---

## DIRECT API SYNC REPLACEMENT

### Current Flow (Playwright — SLOW)
```
For each gym + event type:
  1. Launch headless Chromium
  2. Navigate to portal URL (hardcoded in gym_links)
  3. Intercept /camps/{id} responses via page.on("response")
  4. Click through pagination
  5. Parse intercepted JSON
  Total: ~1 min per gym × 10 gyms = ~10 min
```

### ✅ Implemented Flow (Direct HTTP — FAST) — Live Mar 9, 2026
```
For each gym:
  1. GET /{slug}/locations → get locationId (cache for days)
  2. GET /{slug}/bookings/{locId} → discover all typeIds + category names
     ⚠️ Use bookings, NOT camp-programs! (camp-programs returns programIds that don't work as typeIds)
  3. For each discovered category (where target="camps"):
     GET /{slug}/camps?locationId={locId}&typeId={typeId}&limit=50&page=1
     → paginate through all events
  4. For each event:
     GET /{slug}/camps/{eventId}
     → get full detail (description, instructors, room, etc.)
  Total: 1-2 min for ALL 10 gyms
```

**Verified March 9, 2026:** All endpoints are public. Tested by pasting URLs directly in browser — no auth, no cookies, no headers needed.

### Key Advantages:
- **30-60x faster** (no browser overhead)
- **No Playwright dependency** (no headless Chromium on Railway)
- **Auto-discovers categories** (no hardcoded typeIds)
- **Captures ALL data** (instructors, rooms, deletion status)
- **Simpler deployment** (pure Python HTTP, no browser binary)
- **More reliable** (no page load failures, pop-up blockers, timeouts)

---

## PRIORITY ORDER

1. ~~**Build direct API sync** — Replaces Playwright, captures everything~~ ✅ **DONE Mar 9, 2026**
2. ~~**Auto-discover program categories** — Eliminates hardcoded typeIds~~ ✅ **DONE Mar 9, 2026** (bookings endpoint)
3. **Store locationId and timezone** — Correct time handling (locationId is fetched each sync but not cached yet)
4. **Capture instructors + room** — Valuable parent-facing data (data is fetched but not yet stored in Supabase)
5. **Capture deletion/registration status** — Instant status detection (data is fetched but not yet stored)
6. **Brand colors/logos** — Nice to have for UI polish

---

*This document was created from a manual walkthrough of CCP (Capital Cedar Park) iClassPro API responses, examining every network call from the public portal pages.*
