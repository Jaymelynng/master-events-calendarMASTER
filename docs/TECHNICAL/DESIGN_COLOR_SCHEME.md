# Design & Color Scheme — Master Events Calendar

**Last updated:** May 7, 2026
**Purpose:** Source of truth for UI colors, shadows, and event-type styling.

---

## ⚠️ Event-type colors are now DATABASE-DRIVEN (May 7, 2026)

**Don't hardcode event-type colors anywhere.** They live in `event_types.color` in Supabase. Change them in Admin → Monthly Requirements bar (click the color circle on a pill, paste a hex). One write, propagates everywhere: admin pill, calendar summary card, per-gym table, calendar event cards, side panel header, table view.

### Current values in DB
| Event Type | Saturated Hex (in DB) | What you see (after pastel-mix) |
|------------|----------------------|---------------------------------|
| **CLINIC** | `#b99396` | Soft rose card background |
| **KIDS NIGHT OUT** | `#d5a36d` | Soft tan/peach card background |
| **OPEN GYM** | `#6e936f` | Soft sage card background |
| **CAMP** | (uses static fallback `#fde685`) | Warm yellow — no `event_types` row yet |
| **SPECIAL EVENT** | (static fallback `#E3F2FD`) | Light blue — no `event_types` row yet |

### How the conversion works
The DB stores SATURATED hex values (e.g. `#b99396`). The frontend's `hexToPastelHex` helper in `src/components/EventsDashboard/constants.js` mixes 18% color + 82% white to produce the soft tint used as background. Borders use `rgba(hex, 0.55)` — same hex, medium opacity.

### Static fallback list
If a type isn't in `event_types`, the calendar falls back to `eventTypeColors` in `constants.js`:
- `'CLINIC': '#F3E8FF'`
- `'KIDS NIGHT OUT': '#FFCCCB'`
- `'OPEN GYM': '#C8E6C9'`
- `'CAMP': '#fde685'`
- `'SPECIAL EVENT': '#E3F2FD'`
- `'BOOKING': '#F5F5F5'`

These only apply when an `event_types` row is missing or doesn't pass `eventTypes` through. The DB row wins when both exist.

### Camp variant bars (CampBand)
Camp variant bars use HARDCODED yellow / peach by program type (Gymnastics = yellow `#fff5d4`, Ninja = peach `#ffe5cc`) — INDEPENDENT of `event_types.color`. This is intentional: camp variants are not event types in their own right; they're a sub-classification within the CAMP type. If we ever want them DB-driven, add `program_type_colors` table or extend `event_types`.

---

## Admin Month Filter (Audit & Review)

The Month filter shows **3 months back, 6 months forward** from today's date. The range shifts automatically as time passes.

**When you open Admin from the calendar:** The filter defaults to the month you were viewing on the calendar (e.g. if you were on February 2026, "February 2026" is pre-selected).

### Active/Border Accents (when selected or hover)

| Event Type | Border/Shadow |
|------------|---------------|
| CLINIC | `border-purple-400` / `shadow-md` |
| KNO | `border-pink-400` / `shadow-md` |
| OPEN GYM | `border-green-400` / `shadow-md` |
| CAMP | `border-yellow-400` / `shadow-md` |

---

## Validation & Status Colors

| Purpose | Color | Tailwind |
|---------|-------|----------|
| Data error (real issue) | Red | `bg-red-500`, `text-red-600`, `bg-red-50` |
| Formatting issue | Orange | `bg-orange-500`, `text-orange-600`, `bg-orange-50` |
| Verified accurate | Green | `bg-green-500`, `text-green-600` |
| Bug (needs code fix) | Red | `text-red-600`, `bg-red-100` |
| Dismissed / OK | Green | `bg-green-100`, `text-green-700` |

---

## Cards & Shadows (3D effect)

Use these for consistency with the main calendar:

- **Cards:** `rounded-xl shadow-md` or `shadow-lg`
- **Buttons:** `shadow-sm` (default), `shadow-md` (hover/active)
- **Event blocks:** `shadow-sm` with colored borders

```css
/* Example card */
box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
/* Tailwind: shadow-md */
```

---

## Admin Dashboard Sections

| Section | Header background | Border |
|---------|-------------------|--------|
| Audit & Review | `bg-purple-50` | `border-purple-200` |
| Gym Rules | `bg-blue-50` / `bg-green-50` | `border-blue-200` / `border-green-200` |
| Event Pricing (Clinic, KNO, Open Gym) | `bg-amber-50` | `border-amber-200` — use event-type colors per row |
| Camp Pricing | `bg-emerald-50` | `border-emerald-200` |

---

## Reference in Code

- **Main calendar event colors:** `src/components/EventsDashboard.js` — `getEventTypeColor()`
- **Event type filter buttons:** `EventsDashboard.js` lines ~2869–2907
- **Validation badges:** `AdminAuditErrorCard.js`, `AdminAuditReview.js`

---

## Apply Everywhere

When building or updating UI:

1. Use event-type hex/Tailwind from this doc for filters, badges, and cards.
2. Add `shadow-md` or `shadow-lg` to cards and primary buttons.
3. Use `border-{color}-400` for selected/hover states on event-type buttons.
4. Keep Admin sections consistent with the main calendar’s visual language.
