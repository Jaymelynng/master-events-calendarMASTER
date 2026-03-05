# Test Coverage Analysis

**Date:** March 5, 2026
**Build status:** Passes (with ESLint warnings only, no errors)

---

## Current State: Effectively 0% Automated Test Coverage

### What exists today

| File | Type | Automated? | Notes |
|------|------|-----------|-------|
| `automation/test_price_validation.py` | Ad-hoc script | No | Hardcoded Windows path, reads local JSON, not runnable in CI |
| `automation/test_completeness_validation.py` | Ad-hoc script | No | Same — manual validation script, not a test suite |

**JavaScript tests: 0.** Jest is configured via `react-scripts` but there are zero `.test.js` files in `src/`. Running `npm test` exits with "No tests found."

**Python tests: 0 automated.** The two Python files are standalone validation scripts that read from hardcoded local file paths — they don't use pytest/unittest and can't run in CI.

---

## Codebase Size

| Area | Files | Lines (key files) |
|------|-------|--------------------|
| Frontend (`src/`) | 47 JS files | ~10,000+ (EventsDashboard.js alone is 4,200 lines) |
| Backend (`automation/`) | 21 Python files | ~4,500+ (f12_collect_and_import.py is 2,205 lines) |

---

## Priority Areas for Test Coverage

### Priority 1 — Pure utility functions (highest ROI, easiest to test)

These are pure functions with no external dependencies. They're testable today with zero mocking.

#### 1a. `src/lib/eventComparison.js` — Event sync comparison logic

This is the **most critical untested code** in the app. It determines which events are NEW, CHANGED, DELETED, or UNCHANGED during sync. A bug here causes data loss or phantom duplicates.

**Functions to test:**
- `compareEvents(newEvents, existingEvents)` — Core sync decision engine
  - New event detection (URL not in DB)
  - Changed event detection (URL in DB but fields differ)
  - Deleted event detection (URL in DB but not in sync, **only future events**)
  - Unchanged detection
  - Soft-deleted event handling (`deleted_at` skip)
  - Restored event detection (was deleted, now reappears)
  - Null/empty input handling
- `normalizeValue(value, fieldName)` — Value normalization
  - Price: `"40"` → `40`, `"0"` → `null`, `""` → `null`
  - Age: `"5"` → `5`, `"0"` → `null`
  - Date: `"2026-03-05T00:00:00"` → `"2026-03-05"`
  - Time: whitespace normalization
  - Description: whitespace-only → `null`
- `getComparisonSummary(comparison)` — Summary stats

**Estimated tests: ~25-30 test cases**

#### 1b. `src/lib/validationHelpers.js` — Validation error processing

Powers the audit dashboard. Bugs here mean errors shown/hidden incorrectly.

**Functions to test:**
- `isErrorAcknowledged()` — String and object acknowledgment matching
- `isErrorAcknowledgedAnywhere()` — Combined per-event + pattern check
- `matchesAcknowledgedPattern()` — Gym + type + message pattern matching
- `inferErrorCategory()` — Maps error types to categories (data_error, formatting, status)
- `matchesErrorTypeFilter()` — Filter matching with hidePrices toggle
- `computeAccuracyStats()` — Accuracy percentage calculation
- `extractRuleValue()` — Regex extraction from error messages (price, time, program)
- `parsePriceErrorDetails()` — Price error message parsing
- `processEventsWithIssues()` — Full pipeline: filter, categorize, separate active/dismissed

**Estimated tests: ~35-40 test cases**

#### 1c. `src/components/EventsDashboard/utils.js` — Date and display helpers

**Functions to test:**
- `parseYmdLocal()` — Timezone-safe date parsing (this has historically caused bugs)
- `formatTimeShort()` — Time formatting ("6:30 PM" → "6:30p")
- `getDisplayDates()` — Calendar view slicing (full, firstHalf, week1, etc.)
- `eventFallsOnDate()` — Multi-day event date matching
- `getActualEndDate()` — End date extraction from title patterns
- `groupCampEventsForDisplay()` — Camp consolidation logic
- `parseCampOptionFromTitle()` — Activity/duration extraction from titles

**Estimated tests: ~20-25 test cases**

#### 1d. `src/components/EventsDashboard/constants.js` — Helper functions

- `getEventTypeColor()` — Color lookup with fallback
- `isMultiDayType()` — Multi-day type detection

**Estimated tests: ~5 test cases**

---

### Priority 2 — Cache layer

#### `src/lib/cache.js` — CacheManager class

Testable with time mocking (fake timers in Jest).

**Test scenarios:**
- Set and get within TTL → returns cached value
- Get after TTL expires → returns null and clears entry
- `clear()` / `invalidate()` removes specific entry
- `clearAll()` removes everything
- `cleanUp()` only removes expired entries
- `getCacheKey()` generates unique keys for different params

**Estimated tests: ~10 test cases**

---

### Priority 3 — API layer (requires Supabase mocking)

#### `src/lib/api.js` — All CRUD operations (778 lines)

Needs `@supabase/supabase-js` mocked. Tests would verify:
- Correct Supabase query construction (table, filters, ordering)
- Error handling (network failures, missing data)
- Date range filtering for events
- Soft-delete behavior (sets `deleted_at` instead of removing)
- Upsert logic for sync operations

**Estimated tests: ~30-40 test cases**

---

### Priority 4 — Python backend (requires pytest setup)

#### `automation/f12_collect_and_import.py` — Core sync engine (2,205 lines)

The validation logic in this file can be extracted and tested without Playwright:
- Price extraction regex
- Age detection regex
- Time parsing and comparison
- Date/day-of-week validation
- Program type mapping
- Year mismatch detection
- The "pre-cleaning" logic for false positives ("$62 a day", "Ages 4-13", "Monday-Friday")

#### `automation/local_api_server.py` — Flask API (583 lines)

- Endpoint request/response validation
- Authentication checks
- Error handling paths

**Estimated tests: ~40-50 test cases**

---

### Priority 5 — React component tests (requires @testing-library/react)

These need `@testing-library/react` and `@testing-library/jest-dom` added as dev dependencies.

**Key components to test:**
- `ExportModal.js` — Verify it uses `filteredEvents` not `activeEvents` (regression from known bug)
- `SyncModal.js` — Sync flow state transitions
- `CalendarGrid.js` — Event rendering on correct dates
- `EventCard.js` — Display logic, badge colors, error indicators
- `RuleWizard.js` — Multi-step form flow validation
- `AdminAuditReview.js` — Filter and display logic

---

## Recommended Implementation Order

### Phase 1: Foundation (get testing infrastructure working)

1. Install test dependencies:
   ```bash
   npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
   ```
2. Create `src/setupTests.js` with `@testing-library/jest-dom` import
3. Add coverage script to `package.json`:
   ```json
   "test:coverage": "react-scripts test --coverage --watchAll=false"
   ```

### Phase 2: Pure function tests (highest impact, ~1-2 hours)

Write tests for the four utility modules:
- `src/lib/__tests__/eventComparison.test.js`
- `src/lib/__tests__/validationHelpers.test.js`
- `src/components/EventsDashboard/__tests__/utils.test.js`
- `src/lib/__tests__/cache.test.js`

This alone would cover the most critical business logic.

### Phase 3: API mocking tests (~2-3 hours)

- `src/lib/__tests__/api.test.js` with Supabase mocked

### Phase 4: Python test suite (~2-3 hours)

- Add `pytest` to `requirements.txt`
- Extract testable functions from `f12_collect_and_import.py`
- Write `automation/tests/test_validation_logic.py`

### Phase 5: Component tests (ongoing)

- Start with components that have known bugs (ExportModal, SyncModal)
- Gradually add coverage for admin components

---

## Build Warnings (from `npm run build`)

These ESLint warnings should also be addressed:

| File | Warning | Severity |
|------|---------|----------|
| `AdminDashboard.js` | `useEffect` missing dependency `fetchEventsForDateRange` | Medium — potential stale closure |
| `AdminDashboard.js` | `useEffect` missing dependency `syncLog.length` | Low |
| `AdminDashboard.js` | `unlockAdmin` assigned but never used | Low — dead code |
| `AdminDashboard.js` | `useEffect` missing dependency `SUPER_ADMIN_PIN` | Low — constant |
| `SyncModal.js` | `forceUpdate` assigned but never used | Low — dead code |

---

## Summary

| Metric | Current | After Phase 2 |
|--------|---------|---------------|
| JS test files | 0 | 4 |
| JS test cases | 0 | ~90-100 |
| Critical logic covered | 0% | ~80% of pure functions |
| CI-runnable | No | Yes |
| Python automated tests | 0 | 0 (Phase 4) |

**The single highest-impact action is writing tests for `eventComparison.js`.** This is the sync decision engine — a bug here can create duplicate events, lose events, or trigger false deletions across all 10 gyms. It's a pure function that's trivial to test.
