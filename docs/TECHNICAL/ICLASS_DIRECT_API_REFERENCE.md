# iClassPro Direct API Reference

**Created:** February 23, 2026
**Purpose:** Map of all publicly accessible iClassPro portal API endpoints. These can be called directly via HTTP without a browser -- no Playwright needed.

**Base URL:** `https://app.iclasspro.com/api/open/v1/{portal_slug}`

---

## Endpoints

### 1. Organization Info
**URL:** `/{slug}/organizations`
**Returns:** Gym name, address, phone, email, timezone, logo, brand colors, portal settings
**Key fields:**
- `code` — portal slug (e.g., "scottsdalegymnastics")
- `timezone` — e.g., "America/Phoenix"
- `contactEmail` — gym contact email
- `defaultLocationId` — needed for other API calls
- `primaryColor`, `secondaryColor` — gym brand colors
- `logo`, `image` — gym logo URLs
- `hasMultipleActiveLocations` — whether gym has multiple locations
- `showOpenings` — whether availability is shown publicly

### 2. Locations
**URL:** `/{slug}/locations`
**Returns:** Physical location details (address, phone, email, logo)
**Key fields:**
- `id` — location ID (needed for program/event calls)
- `name`, `email`, `phone`, `address`, `city`, `state`, `zip`
- `logoImage`, `headerImage`

### 3. Program Categories (Camp Types)
**URL:** `/{slug}/camp-programs/{locationId}`
**Returns:** List of program categories and their type IDs
**Example response:**
```json
[
  {"id": 572, "name": "KIDS NIGHT OUT"},
  {"id": 601, "name": "OPEN GYMS"},
  {"id": 583, "name": "SCHOOL YEAR CAMPS"},
  {"id": 571, "name": "SUMMER CAMP"},
  {"id": 574, "name": "EVENTS"}
]
```
**Note:** Program names and IDs are DIFFERENT per gym. Must discover per gym.

### 4. Event Listing (per program type)
**URL:** `/{slug}/camps?locationId={locId}&typeId={typeId}&limit=50&page=1&sortBy=time`
**Returns:** All events for a program type with structured data
**Key fields per event:**
- `id` — event ID (used to build detail URL and event_url)
- `name` — full title (e.g., "Kids Night Out | Pot of Gold | Ages 5-12 | 03/13")
- `startDate`, `endDate` — date range
- `minAge`, `maxAge` — age range
- `schedule` — array of time blocks with `startTime`, `endTime`, `dayInt`
- `hasOpenings` — availability
- `registrationStartDate`, `registrationEndDate`
- `image` — flyer/event image
- `programId` — links back to program category

**Pagination:** `totalRecords` field tells you total count. Use `page` param to paginate.

### 5. Event Detail (individual event)
**URL:** `/{slug}/camps/{eventId}`
**Returns:** Full event detail INCLUDING description
**Key fields (in addition to listing fields):**
- `description` — FULL HTML description text (contains price, times, ages, details)
- `blocks` — detailed date/time blocks with exact timestamps
- `programName` — program category name (e.g., "KIDS NIGHT OUT")
- `roomName` — room/area in the facility
- `instructors` — coach/teacher list
- `allowToRequestCampThatIsFull` — waitlist enabled
- `campRegisterExpired` — registration closed
- `programIsDeleted` — event was removed (instant deletion detection!)
- `autoApprove` — auto-approval vs manual

### 6. Booking Menu (⚠️ THIS is the typeId source)
**URL:** `/{slug}/bookings/{locationId}`
**Returns:** Top-level menu with CORRECT typeIds for the camps listing URL
**Example response (CCP, locationId=1):**
```json
[
  {"title":"Find a Class","target":"classes"},
  {"title":"Book a Party","target":"parties"},
  {"title":"CLINIC","target":"camps","targetParams":{"typeId":7}},
  {"title":"KIDS NIGHT OUT","target":"camps","targetParams":{"typeId":13}},
  {"title":"OPEN GYM","target":"camps","targetParams":{"typeId":17}},
  {"title":"SCHOOL YEAR CAMP - FULL DAY","target":"camps","targetParams":{"typeId":14}},
  {"title":"SUMMER CAMP - FULL DAY","target":"camps","targetParams":{"typeId":1}},
  {"title":"SUMMER CAMP - HALF DAY","target":"camps","targetParams":{"typeId":21}}
]
```

**⚠️ CRITICAL:** Do NOT use `camp-programs/{locationId}` for typeIds! That endpoint returns programIds (e.g., CLINICS=246) which DO NOT work as typeIds in the camps listing URL. Tested March 9, 2026: `camps?typeId=246` returns "No camps found."

---

## Complete Sync Flow (Direct API - No Browser)

```
For each gym:
  1. GET /{slug}/locations              → get locationId
  2. GET /{slug}/bookings/{locationId}  → discover typeIds + category names
     ⚠️ Use bookings, NOT camp-programs!
  3. For each category (where target="camps"):
     GET /{slug}/camps?locationId={loc}&typeId={typeId}&limit=50&page=1
     → get all events (paginate if totalRecords > 50)
  4. For each event:
     GET /{slug}/camps/{eventId}
     → get description + full detail
```

**Estimated speed:** ~5 minutes for all 10 gyms (vs ~10 minutes with Playwright) — ✅ Implemented Mar 9, 2026

---

## Data Available But Not Currently Captured

| Field | Endpoint | Potential Use |
|-------|----------|--------------|
| `timezone` | organizations | Correct time zone handling per gym |
| `contactEmail` | organizations/locations | Manager email feature |
| `logo` / `primaryColor` | organizations | Gym branding in app/emails |
| `roomName` | event detail | Show WHERE in the facility |
| `instructors` | event detail | Show WHO is running it |
| `blocks` | event detail | Exact date/time per session |
| `programIsDeleted` | event detail | Instant deletion detection |
| `campRegisterExpired` | event detail | Registration status |
| `allowToRequestCampThatIsFull` | event detail | Waitlist status |

---

## Portal Slugs (from gym_links table)

Each gym has a unique portal slug used in the base URL. These are stored in
the `gym_links` table and also discoverable from the `organizations.code` field.

Example slugs:
- `scottsdalegimnastics` → Scottsdale Gymnastics
- `capitalgym` → Capital Gymnastics (Cedar Park, Pflugerville, Round Rock)
- etc.

---

## Important Notes

- All endpoints are PUBLIC (no auth required) — they power the public portal
- Program type IDs vary per gym — must be discovered per gym via camp-programs
- Images use relative paths — prepend `https://app.iclasspro.com/media/` for full URL
- Descriptions are HTML formatted — strip tags for plain text validation
- Some gyms have multiple locations under one account (`hasMultipleActiveLocations`)
