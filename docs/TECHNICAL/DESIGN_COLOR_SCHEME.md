# Design & Color Scheme — Master Events Calendar

**Last updated:** Feb 2026  
**Purpose:** Single source of truth for UI colors, shadows, and event-type styling. Use across main calendar, Admin Dashboard, and all documentation.

---

## Admin Month Filter (Audit & Review)

The Month filter shows **3 months back, 6 months forward** from today's date. The range shifts automatically as time passes.

**When you open Admin from the calendar:** The filter defaults to the month you were viewing on the calendar (e.g. if you were on February 2026, "February 2026" is pre-selected).

---

## Event Type Colors

| Event Type | Hex | Tailwind | Use |
|------------|-----|----------|-----|
| **CLINIC** | `#F3E8FF` | lavender/purple-50 | Backgrounds, buttons, filters, cards |
| **KIDS NIGHT OUT (KNO)** | `#FFCCCB` | coral rose / pink-200 | Backgrounds, buttons, filters, cards |
| **OPEN GYM** | `#C8E6C9` | sage green / green-200 | Backgrounds, buttons, filters, cards |
| **CAMP** | `#fde685` | warm yellow / yellow-200 | Backgrounds, buttons, filters, cards |
| **SUMMER CAMP** | `#E1F5FE` | ice blue / sky-100 | Summer camp variants |
| **SUMMER CAMP - GYMNASTICS** | `#B2DFDB` | seafoam / teal-200 | |
| **SUMMER CAMP - NINJA** | `#DCEDC8` | light lime / lime-200 | |
| **BIRTHDAY PARTY** | `#fce7f3` | light pink / pink-100 | |
| **SPECIAL EVENT** | `#fef2f2` | light red / red-50 | |
| **WORKSHOP** | `#eef2ff` | light indigo / indigo-50 | |

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
