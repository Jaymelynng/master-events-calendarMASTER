# Eliminate Errors — Don't Surface Them (v2 Draft)

**Status:** DRAFT — for Jayme to react to
**Created:** April 26, 2026
**Updated:** April 26, 2026 — pivoted to "errors-can't-happen" paradigm

---

## The Foundational Principle (Jayme, verbatim)

> *"If it's built right we won't need the audit because it will be built not able to make a mistake."*

This doc is built around that. The audit tab exists today because the system ALLOWS mistakes — wrong dates in titles, prices that don't match the pricing table, descriptions that contradict the iClass data, etc. We currently catch these AFTER they happen and surface them in an audit list.

**The right system makes those mistakes structurally impossible** — not by adding a better dashboard to find them, but by re-shaping the data flow so the conditions that produce them no longer exist.

---

## Why the current audit tab even exists (root cause analysis)

Every error type our 11 system checks catch traces back to the same root: **two parallel sources of truth for the same data, with manual entry on at least one of them.**

| Error type | What it actually is |
|-----------|--------------------|
| year_mismatch | Title says "2025" but iClass startDate is 2026 — title typed by hand |
| date_mismatch | Description says "March 5" but iClass dates are March 12-14 — description typed by hand |
| time_mismatch | Title says "6:30pm" but iClass schedule says 7:00pm — title typed by hand |
| age_mismatch | "Ages 5-12" in description vs iClass minAge=4, maxAge=10 — description typed by hand |
| price_mismatch | Title and description show different prices — both typed by hand |
| camp_price_mismatch | Description price doesn't match `camp_pricing` table — description typed by hand |
| program_mismatch | "Open gym" mentioned in a KNO event description — description typed by hand |
| title_desc_mismatch | Title and description disagree about program — both typed by hand |

**Pattern:** The structured iClass fields (startDate, schedule, minAge, etc.) ARE the truth. The title and description are MARKETING COPY that gym staff write by hand and that DRIFT from the truth.

The audit tab is an after-the-fact diff between the two sources. **The fix is to eliminate the divergence at creation time, not catch it later.**

---

## Three structural fixes that make audit obsolete

### Fix 1: Display copy is GENERATED from structured fields, not entered separately
Instead of a gym admin typing "Lego Week | Summer Camp 2026 Week 1 | Ages 4-13 | Mon-Fri, June 1st-5th | Full Day - 9am-3pm | $345" by hand, the system generates that title/description from:
- iClass programName ("Summer Camp")
- iClass startDate / endDate (June 1-5, 2026)
- iClass minAge / maxAge (4 / 13)
- Pricing table lookup ($345 full day weekly)
- A campaign-specific theme tag ("Lego Week")

If startDate changes, the title regenerates automatically. **There is no opportunity for "year_mismatch" because the year is never typed.**

### Fix 2: Validation runs at WRITE time, not READ time
Today: gym staff edits title in iClass → next sync detects mismatch → audit tab shows error → Jayme sees it later → emails manager → manager fixes it (maybe).

Tomorrow: gym staff opens "Edit Event" form in HER app → form is structured fields + auto-generated copy → form REFUSES to save until structured data is internally consistent → form pushes to iClass via API. **Mismatches can't reach iClass in the first place.**

### Fix 3: Single source of truth + computed display
- Structured fields = TRUTH (date, time, age, program, price)
- Display copy = COMPUTED from truth, not stored separately
- Marketing tweaks (theme names, hooks) are tagged separately and INSERTED into the template, never overriding truth

---

## What this means concretely for the build

**The "audit tab redesign" is the wrong framing.** What we actually need to build:

### Build 1: Structured Event Editor (HER app, replaces editing in iClass directly)
A form in this dashboard for creating/editing events. Gym staff use THIS, not iClass admin.
- Structured fields up top: program, dates, times, ages, capacity
- Pricing pulls from `camp_pricing` / `event_pricing` automatically — staff don't type prices
- Title + description preview at bottom, GENERATED from the structured fields + template
- Theme/marketing slots can be edited, but program-truth-fields cannot drift
- "Push to iClass" button → uses iClass admin API to update the event there

### Build 2: Sync becomes "import-only" or "reconcile, not detect"
Once events are created in OUR system and pushed to iClass, the sync becomes simpler:
- Detects if iClass was edited externally (someone in the gym opened iClass admin and changed it)
- Auto-reconciles: pulls iClass change back into our truth, OR pushes our truth back over iClass
- No more "validation errors" — just "external changes detected"

### Build 3: Templates per event type per gym
Each gym has templates for their KNO / Clinic / Camp / Open Gym titles and descriptions. Once defined, every event of that type uses the template. No drift possible.

### Build 4: Calendar shows attention items that AREN'T errors
What replaces the audit tab in the calendar UI is NOT an error list. It's an **opportunity / action surface**:
- "🔴 4 events sold out — promote alternates?"
- "⚠️ 8 events almost full — push registration"
- "📋 RBA hasn't added their April KNO yet"
- "🎨 SGT has 3 events with no flyer image — generate?"

These aren't errors. They're things to DO. The system can't have caused these — they're just states of the world that warrant action.

---

## The Mental Model

Errors should behave like notifications, not filing cabinet entries. They should:
1. **Find you** — not require you to find them
2. **Appear where you'd act** — on the calendar, on the card, in the side panel
3. **Be one click from resolution** — fix / dismiss / email about it
4. **Roll up into a single command-center view** — for the "what's everything that needs me right now" moments

---

## Three Surfaces (where errors live in the new world)

### Surface 1 — Inline on the calendar (always visible)

Each event card already has a tiny indicator dot for errors. Strengthen it:
- Cards with errors get a more visible accent (red border-left strip, like the gym brand colors)
- Hover the card → tooltip lists what's wrong
- Click → side panel shows error details + one-click fix actions

**No tab to open. Errors appear at the data they describe.**

### Surface 2 — Top-of-calendar Alerts Strip (the "command center")

A persistent strip at the top of the calendar (above the bulk portal opener) showing:
```
┌────────────────────────────────────────────────────────────────┐
│ 🚨 3 data errors  •  ⚠️ 8 almost full  •  🔴 4 sold out      │
│ 📋 2 missing requirements  •  📝 5 events with no description │
└────────────────────────────────────────────────────────────────┘
```
- Each chip is clickable → instantly filters the calendar to show only those events
- Always visible at the top — no menu diving
- Updates in real-time as sync runs / errors get dismissed
- This IS the command center she's been asking for

### Surface 3 — Drill-down panel (replaces the current Audit & Review tab)

A real list view, but built to ACT on errors, not filter through them:
- **Default state: shows everything that needs attention** (no filters applied — opposite of current behavior)
- Sorted by urgency: data errors first, then missing reqs, then status warnings
- Each row: gym logo + error type + message + 3 action buttons (Verify / Dismiss / Make Rule)
- Filtering is OPTIONAL refinement, not required entry
- Can be reached from any alert chip in Surface 2

---

## Error Categories & Actions

### Category 1: Data Errors (red — wrong info)
The 11 system checks: date_mismatch, year_mismatch, time_mismatch, age_mismatch, program_mismatch, title_desc_mismatch, impossible_date, price_mismatch, day_mismatch, camp_price, event_price, plus skill_mismatch.

**Per-error actions:**
- **Verified Accurate** → marks correct, no further action
- **Invalid/Bug** → flag for investigation, hide from surface
- **Make Rule** → opens Rule Wizard pre-filled (for valid_price, valid_time, program_synonym, exception)
- **Email Manager** → opens email composer pre-filled with the gym, error, and event link

### Category 2: Status / Informational (blue — registration state)
Sold out, almost full, registration closed, etc.

**Per-status actions:**
- **Promote** → opens link to share / generate marketing copy (future)
- **Dismiss** → acknowledge

### Category 3: Missing Requirements (orange — gym hasn't met monthly goal)
Currently: 2 KNO + 1 OG + 1 Clinic per gym per month.

**Per-gap actions:**
- **Mark In Progress / Late / Excused** (already exists)
- **Email Manager** → request the missing event(s)
- **Add Event** → open Add Event modal pre-filled

### Category 4: Description Quality (gray — soft warnings)
No description, flyer-only, etc.

**Actions:**
- **Excuse this event** (mark as expected to be flyer-only)
- **Excuse this gym** (some gyms don't have descriptions; rule)

---

## Layout: Where each surface lives

```
┌─ MASTER EVENTS CALENDAR ──────────────────── × ┐
│                                                 │
│  📊 Stats: 70 events  ·  10 active gyms        │  ← Existing top
│                                                 │
│ ┌─ 🚨 NEEDS ATTENTION ────────────────────────┐│  ← NEW: Alerts Strip
│ │ 🔴 4 sold out  ⚠️ 8 almost full             ││     (Surface 2)
│ │ 🚨 3 data errors  📋 2 missing reqs         ││
│ │ Click any chip to focus the calendar        ││
│ └──────────────────────────────────────────────┘│
│                                                 │
│  [SYNC] [EXPORT] [✨]                           │  ← Existing buttons
│                                                 │
│  📅 Calendar grid (all 10 gyms × dates)        │  ← Existing calendar
│  Cards with errors get red accent (Surface 1)   │
│                                                 │
└─────────────────────────────────────────────────┘

When user clicks an alert chip → Calendar filters to show only matching
events + their error indicator highlights, OR the drill-down panel opens
in the side panel (jury's out — pick one).
```

The "Audit & Review" tab in admin gets **deleted entirely.** The drill-down panel is where it goes.

---

## Multi-tenant / SaaS implications

- All thresholds (when does "almost full" trigger? when does "missing req" alert? what error types matter?) become **tenant-configurable** via the rules table
- The alerts strip is the same code for every tenant — only the data differs
- A new tenant onboarding flow (future) walks them through configuring: which checks they want, what their compliance thresholds are, when alerts should fire
- The dashboard's value prop for a new tenant: "See everything that needs your attention in one screen — no setup required."

---

## What gets DELETED in this redesign

| Thing | Why it goes |
|-------|-------------|
| Admin Dashboard "Audit & Review" tab | Replaced by the drill-down panel + alerts strip |
| The 5-layer filter form at top of audit page | Replaced by "show everything by default, filter optional" |
| The "ALL / DATA" toggle | Categories surface naturally in the alerts strip |
| The "Show all categories / Show all statuses" empty-state buttons | Won't be needed — page won't start filtered |
| AdminAuditRulesReference's hardcoded list | Already stale, replaced by live read of `rules` table |

---

## What gets BUILT

| Thing | Approx scope |
|-------|--------------|
| **Alerts Strip component** at top of calendar | 1 day — pulls counts from existing data, click → filter |
| **Inline calendar error indicators** (stronger than current red dot) | 0.5 day — extend EventCard.js |
| **Drill-down errors panel** (replaces audit tab) | 1.5 days — list view + 3 actions per row |
| **One-click action handlers** (Verify, Dismiss, Make Rule, Email) | Mostly already exist — needs wiring |
| **Real-time updates** | Already supported via Supabase subscriptions, just needs hook in alerts strip |

**Total: ~4 days of work**, roughly. Could ship in stages — alerts strip first (highest visibility), then inline indicators, then drill-down panel, retire audit tab last.

---

## Open questions for Jayme

1. **Where should the alerts strip live exactly?** Above the calendar, below the stats cards, or as a floating sidebar?
2. **When you click an alert chip — should it filter the calendar in place, OR open the drill-down panel?** (or both?)
3. **Should the alerts strip be COLLAPSIBLE** (some days you don't want to see it)?
4. **Per-gym alerts strip** (in addition to the global one)? E.g., when filtered to one gym, alerts narrow to just that gym's issues?
5. **For SaaS later — should each tenant be able to design their OWN alerts strip** (pick which categories show)?

---

## Build order recommendation

1. **Spike: build the alerts strip first** as a static read-only component on the calendar. Just shows counts. Clickable. No drill-down yet.
2. **Validate it feels right** before committing to deleting the audit tab.
3. **Add inline calendar error indicators** (EventCard.js extension).
4. **Build the drill-down panel** with the 3 action buttons.
5. **Wire alerts strip → drill-down** transitions.
6. **Delete the old audit tab.**

Each stage is independently shippable. If we get to stage 1 and it doesn't feel right, we revise the vision before building more.

---

## NOT in this v1 vision (deferred)

- **Stats Page** as a separate destination (could be folded into the alerts strip + calendar later)
- **AI-powered "what should I prioritize today"** suggestions (later, after data shapes prove out)
- **Cross-gym trend analysis** ("HGA has had 3 sold-out camps in a row — should they raise capacity?")
- **Slack/email push notifications** when new errors appear (later)
- **Custom alert rules per tenant** (admin can configure which categories alert and at what threshold)

---

## The order to build this

1. **Structured Event Editor** (the most foundational change). Without this, everything else is patching symptoms. Gym staff start using it. Errors at the edit point disappear immediately for new events.
2. **Templates per gym per event type.** Reduces typing, locks in consistency.
3. **iClass push API integration.** "Save in our system → it appears in iClass" — closes the loop so gym staff never need to touch iClass directly.
4. **Sync becomes reconcile-mode.** External edits in iClass either get pulled back or overridden, no more "errors."
5. **Replace audit tab with action surface.** By this point, the audit tab's data source is dry — there are no real errors anymore, just opportunities (sold out, almost full, missing requirements). Build the new surface.
6. **Delete the audit tab.**

**Total scope:** This is significantly bigger than the audit-redesign I originally proposed. It's essentially a product pivot — from "calendar viewer + error catcher" to "event creation system + calendar viewer." But it's the only path that actually achieves the principle.

For SaaS — this becomes the killer feature. No competitor's gym tool does this. Most don't even know iClass has an admin push API.

---

## What still needs Jayme's input before building

1. **Does iClass have a public API for editing camps?** I need to verify (just like we verified the openings count). The PUBLIC API only READS. Admin push would need an authenticated endpoint — possibly the same JWT-capture flow as the pricing-schedules discovery.
2. **For gym staff who currently work directly in iClass admin — what's the change-management story?** Do you mandate they use the new editor, or is it opt-in?
3. **Where does this rank vs. other priorities** (multi-sport SaaS, monetization, stats page)? This is a 1-2 month build, not a one-week sprint.

---

## Critical findings discovered April 26, 2026 (the night this doc was drafted)

### The rules table is EMPTY in production
A live SQL query against the rules table returned **0 rows**. The CLAUDE.md and AI_RULES_READ_FIRST.md docs claim there should be 17 rules (11 system check rules + 6 user rules). They are not there.

The validation engine fetches active checks from the rules table on every sync. Empty table = zero checks run = zero validation errors generated. This has been the case for an unknown amount of time.

**Implication:** The audit page being confusing/empty is not a UX issue — it's because validation isn't actually running. The "1 issue" still showing on one event is leftover from a previous run when the table had data.

**This is the strongest possible argument for the vision pivot in this doc.** Validation has been off in production. Nothing has broken. Customers register, calendars work, gym staff operate. The audit was less load-bearing than the system thought. The right move is NOT to repopulate the rules table — it's to remove the need for those checks entirely via the structured editor.

### The Audit Rules Reference UI shows 48 fictional rules
The AdminAuditRulesReference.js admin tab displays a hardcoded list of 48 validation checks with Python line number references (~1164-2189). The Python file was rewritten in March 2026 — those line numbers reference code that doesn't exist anymore. The actual Python validation_engine.py has 12 check functions in CHECK_REGISTRY.

The displayed reference is essentially a museum of dead checks. **Delete this tab in v1.**

### Jayme's preference on existing UI
Direct quote from this conversation: *"i hate the ui but i like the gym rules work flow."*

**Keep:**
- Rule Wizard (the 5-step / 2-step flows)
- Per-gym scoping (gym_ids array on rules)
- Permanent vs temporary rules
- Keyword / single_event / all_events scope

**Pare down:**
- The Gym Rules page itself ("a ton of stuff visually") — strip the 5-stat summary bar, multi-filter chips, detail panel chrome. Keep the gym sidebar + rule list + wizard launcher. Less chrome, more breathing room.

**Delete:**
- Admin "Audit & Review" tab (5-layer filter form)
- Admin "Audit Rules Reference" tab (fictional 48-rule list)
- AdminAuditErrorCard + dismiss-with-pattern complexity

The Wizard becomes the universal rule-creation interface for whatever per-tenant exceptions remain after the structured editor handles the rest.

---

## Tonight's actual next concrete step (proposed)

**Probe the iClassPro admin API to see if it has an event-edit endpoint.** This is the gating question for the entire vision. If iClass exposes a way to push event updates programmatically:
- The Structured Event Editor is buildable
- The whole "errors can't happen" paradigm becomes real
- We move ahead with confidence

If it doesn't exist:
- We'd need a different approach (e.g., generate copy-paste templates that gym staff use as content briefs before manually entering in iClass)
- The vision still works but with manual hand-off instead of auto-push
- Worth knowing now vs. designing for the wrong premise

The probe takes ~10 minutes (similar approach to how we verified `openings`). Result either confirms or reshapes this whole doc.
