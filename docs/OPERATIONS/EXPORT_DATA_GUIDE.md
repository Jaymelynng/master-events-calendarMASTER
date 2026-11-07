# 📤 Export & Copy

**Last Updated:** November 7, 2026 (rebuilt)
**Files:** `src/components/EventsDashboard/ExportModal.js` (the window) · `src/lib/exportData.js` (every section + every way out) · `src/lib/eventRow.js` (the event columns, shared with the dashboard's "Copy what's shown")

Rebuilt 2026-11-07. Jayme: *"the export needs to be totally redone to include everything we have just done and also i want the option that whatever is chosen to download can also be bulk copied"*. The guide that was here (Dec 2025) described the old window - presets, a Price column, a SPECIAL EVENT bucket - none of which exist now.

---

## How to use it

One screen, worked top to bottom, left to right (layout from Jayme's multi-view blueprint; look from her CORE visual philosophy: dark shell, white container floating on it, the calendar's own rose as the one accent):

1. Calendar → **📤 Export**.
2. **Top bar:** dates - This month · Next month · Today on · Entire database (first to last event date in the database) · or type From / To. Every event that *touches* the dates is in. Under it, **1** the gyms (one row, logo + code, all on; tap to drop) and the buckets (* = has a monthly requirement).
3. **Left rail - 2 What to include:** tick any sections; each shows its row count. Click a section's name to see it in the preview. **Quick pick** sets sections + columns in one tap (Everything · Spots check · Prices · Live on the portal? · Monthly requirements · Audit).
4. **Right - live preview:** the section you clicked, exactly as it will download / copy (first 150 rows on screen; the file and the copy have them all). For Events, the column groups sit above the table as tabs; tap a column to drop or add it, or click **×** on a column header.
5. **Bottom bar:** "You get:" lists every ticked section and its rows. Pick **CSV** (Excel, Sheets) · **JSON** (backup) · **Printable page** (opens in a new tab - print or save there). Then **Copy** or **Download**.

**Copy and Download give the same thing.** Copy puts every ticked section on the clipboard: tables (each under its title) for Gmail / Outlook / Docs, cells for Sheets / Excel (a blank row between sections).

Your picks (sections, dropped columns) are remembered on this computer.

---

## The sections

| Section | One row per | Where the data comes from |
|---|---|---|
| **Events** | event (the columns you pick) | `events` + the signed-in iClass setup read |
| **Price tables** | price table those events use (once each) | `iclass_price_cells` (camps) · `iclass_appointment_price_cells` (appointments) |
| **Monthly requirements** | gym × month in the dates | `monthly_requirements` (only buckets with a number) · counts events live on the portal by the month they start, every bucket, whatever buckets are ticked |
| **Audit findings** | thing to fix (data error, no description, flyer only, AI review flag) | `events.validation_errors`, `description_status`, `ai_review_flags` - dismissed ones left out, sold-out is not an error |
| **Dismissed warnings** | dismissed warning, with its note | `events.acknowledged_errors` |
| **iClass setup read per gym** | gym | latest `iclass_setup_reads` row - a gym never read says **never read** |
| **Sync log** (admin: press `*` + PIN) | sync | `sync_log`, last 100 |

**"Also add camps built in iClass but not live"** (Events card): adds the faded calendar camps as rows marked **Not live**, with **Why Not Live** (Show on portal off / registration opens later / registration closed / not synced yet). Off by default. They never count toward requirements.

## The event columns

- **Event:** Gym · Gym Name · Bucket · Event · Start · End · Day · Hours · Ages · Description · Description Status · Link
- **Spots & sign-up:** Spots Left (the fullest day, same as the calendar) · Spots by Day · Status (FULL / Almost full ≤3 / Open) · Max Kids · Sign-up (Per day / Whole camp only; blank for a one-day event) · Registration Opens · Registration Closes
- **Live on the portal:** Live on Portal · Why Not Live · Show on Web · Online Registration
- **Price:** Price Table · Prices · Due at Sign-up
- **Where it lives in iClass:** iClass Event Type (an appointment shows its service) · iClass Program · Charge Category (says EXPIRED with the date when it is) · iClass Setup Read (date, or "not read")
- **Errors:** Data Errors · AI Review Flags (dismissed ones left out)

**Prices** read the price table iClass itself uses, in its own grid: rows = number of days (camps) or time slots (appointments), across = 1st / 2nd / 3rd child. A row where every child pays the same shows once (`1 day $120`); otherwise `1 day: 1st $35, 2nd+ $30`. A blank box in iClass says **BLANK**. Never read from a title or description (`docs/OPERATIONS/PRICING_SOURCE_OF_TRUTH.md`).

**Blank = not read, never a guess.** An event whose camp or appointment setup has not been read (e.g. a camp that ended before the first setup read on Nov 4, 2026) has blank setup columns and "not read"; the Price tables section says how many.

---

## Checked on the test copy, 2026-11-07 (November 2026, every gym, every bucket)

- Events 123 (128 with the 5 not-live camps) × 32 columns · Price tables 70 (72) · Monthly requirements 14 · Audit findings 89 · Dismissed warnings 0 · iClass setup read 14.
- CSV: 6 sections in one file, each under its title. JSON: the same 6 sections + every event's saved fields. Printable page: the same 6 tables. Copy: the same 6 tables (317 rows) - checked by catching what Copy hands the clipboard.
- Spot checks: PLG Rocket Cheer Prep Team Tryouts → Tiny/Mini Tryouts, `1 slot $65`, Max Kids 30; PLG Kids Night Out (Nov) → `1 slot: 1st $35, 2nd+ $30`; CCP Kids Night Out Nov 13 → `1 day: 1st $40, 2nd+ $35` + data error "iClass max age is 12 but title says 13".
- Not read: CCP School Year Camp Nov 2–3 and EST clinic Nov 3 (both ended before the first setup read).
- Not tested in a real paste: Copy was checked by what it hands the clipboard, not by pasting into Gmail / Sheets in this round (the clipboard code itself was pasted in Chrome on 2026-11-06).

## Known, not changed here

- The `*` unlock PIN has a fallback typed in the code (`ExportModal.js`, `AdminDashboard.js`, `AdminPortalModal.js`) when `REACT_APP_ADMIN_PIN` is not set. Any PIN in a React app ships inside the page, so it hides the Sync log; it does not protect it.
