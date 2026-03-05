# How to Run Tests (Non-Technical Guide)

**What are tests?** They're like a checklist that automatically verifies your app's logic is working correctly. Instead of you manually clicking through the app to check things, the computer runs 98 checks in about 7 seconds and tells you if anything broke.

---

## Quick Start: Run Tests

Open your terminal and type:

```bash
npm test
```

This starts "watch mode" — it runs tests and watches for changes. Press `q` to quit.

**To run tests once (no watch mode):**

```bash
npx react-scripts test --watchAll=false
```

---

## What You'll See

When everything is working:

```
PASS src/lib/__tests__/cache.test.js
PASS src/components/EventsDashboard/__tests__/utils.test.js
PASS src/lib/__tests__/validationHelpers.test.js
PASS src/lib/__tests__/eventComparison.test.js

Test Suites: 4 passed, 4 total
Tests:       98 passed, 98 total
```

**All green = you're good!**

If something breaks, you'll see red text showing exactly which test failed and why. That's the whole point — it catches problems before your users do.

---

## When Should You Run Tests?

- **Before deploying** — Run `npm test` to make sure nothing is broken
- **After an AI session changes code** — Run tests to verify the AI didn't break anything
- **When something seems off** — Tests can help narrow down where the problem is

---

## What Do the Tests Actually Check?

### 1. Event Sync Logic (`eventComparison.test.js` — 17 tests)
Verifies that when your app syncs events from iClassPro:
- New events get detected correctly
- Changed events (title, price, time updates) get flagged
- Deleted events only get flagged if they're in the FUTURE (past events just expired naturally)
- Already-deleted events don't get re-flagged
- Events that reappear after being deleted get restored

**Why this matters:** A bug here could delete real events or create duplicates across all 10 gyms.

### 2. Validation & Error Handling (`validationHelpers.test.js` — 40 tests)
Verifies that the audit dashboard:
- Correctly categorizes errors (data error vs formatting vs status)
- Dismissed errors stay dismissed
- Pattern-based dismissals work (dismiss for all events of a type)
- Price filter hides/shows the right errors
- Accuracy percentages calculate correctly

**Why this matters:** If errors get miscategorized, real problems get hidden.

### 3. Date & Calendar Logic (`utils.test.js` — 31 tests)
Verifies that:
- Dates parse correctly without timezone bugs (the "off by one day" problem)
- Calendar views show the right days (full month, first half, weeks)
- Multi-day camps show up on all their days
- Camp grouping works (Full Day + Half Day at same gym on same date)
- End dates get extracted correctly from event titles

**Why this matters:** Wrong dates = events showing on wrong days for all your gyms.

### 4. Cache System (`cache.test.js` — 10 tests)
Verifies that:
- Cached data expires after its time limit
- Clearing one cache entry doesn't clear others
- Expired entries get cleaned up

**Why this matters:** Stale cache = users see old data.

---

## Where Are the Test Files?

```
src/
├── lib/
│   └── __tests__/
│       ├── eventComparison.test.js    ← Sync logic tests
│       ├── validationHelpers.test.js  ← Audit/error tests
│       └── cache.test.js             ← Cache tests
└── components/
    └── EventsDashboard/
        └── __tests__/
            └── utils.test.js          ← Date/calendar tests
```

---

## FAQ

**Q: Do I need to write tests myself?**
A: No! The tests are already written. You just run `npm test` to check if everything still works.

**Q: What if a test fails after an AI session?**
A: Show the AI the failing test output. The test name tells you exactly what's broken (e.g., "detects future event missing from sync as deleted"). The AI can fix it.

**Q: Can tests break the app?**
A: No. Tests only READ your code and check it — they never change anything.

**Q: How long do tests take?**
A: About 7 seconds for all 98 tests.

---

**Last Updated:** March 5, 2026
