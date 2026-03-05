import {
  parseYmdLocal,
  formatTimeShort,
  getDisplayDates,
  getActualEndDate,
  eventFallsOnDate,
  groupCampEventsForDisplay,
  parseCampOptionFromTitle,
} from '../utils';

// ── parseYmdLocal ────────────────────────────────────────────────────

describe('parseYmdLocal', () => {
  test('parses YYYY-MM-DD as local date (not UTC)', () => {
    const d = parseYmdLocal('2026-03-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(d.getDate()).toBe(15);
  });

  test('returns current date for null/undefined', () => {
    const before = new Date();
    const result = parseYmdLocal(null);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('handles January correctly (month 0)', () => {
    const d = parseYmdLocal('2026-01-01');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  test('handles December correctly (month 11)', () => {
    const d = parseYmdLocal('2026-12-31');
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

// ── formatTimeShort ──────────────────────────────────────────────────

describe('formatTimeShort', () => {
  test('returns empty string for null/empty', () => {
    expect(formatTimeShort(null)).toBe('');
    expect(formatTimeShort('')).toBe('');
  });

  test('returns short strings as-is', () => {
    expect(formatTimeShort('6:30p')).toBe('6:30p');
  });

  test('shortens "6:30 PM - 8:00 PM" to "6:30p"', () => {
    expect(formatTimeShort('6:30 PM - 8:00 PM')).toBe('6:30p');
  });

  test('drops :00 minutes', () => {
    expect(formatTimeShort('6:00 PM - 8:00 PM')).toBe('6p');
  });
});

// ── getDisplayDates ──────────────────────────────────────────────────

describe('getDisplayDates', () => {
  test('full view returns all days in month', () => {
    const dates = getDisplayDates('full', 2026, 2); // March 2026
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe(1);
    expect(dates[30]).toBe(31);
  });

  test('firstHalf returns days 1-15', () => {
    const dates = getDisplayDates('firstHalf', 2026, 2);
    expect(dates).toHaveLength(15);
    expect(dates[dates.length - 1]).toBe(15);
  });

  test('secondHalf returns days 16+', () => {
    const dates = getDisplayDates('secondHalf', 2026, 2);
    expect(dates[0]).toBe(16);
    expect(dates[dates.length - 1]).toBe(31);
  });

  test('week1 returns days 1-7', () => {
    const dates = getDisplayDates('week1', 2026, 2);
    expect(dates).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('week4 returns days 22+', () => {
    const dates = getDisplayDates('week4', 2026, 2);
    expect(dates[0]).toBe(22);
    expect(dates[dates.length - 1]).toBe(31);
  });

  test('handles February (28 days)', () => {
    const dates = getDisplayDates('full', 2026, 1); // Feb 2026
    expect(dates).toHaveLength(28);
  });

  test('handles leap year February (29 days)', () => {
    const dates = getDisplayDates('full', 2028, 1); // Feb 2028 is a leap year
    expect(dates).toHaveLength(29);
  });
});

// ── getActualEndDate ─────────────────────────────────────────────────

describe('getActualEndDate', () => {
  test('extracts end date from "11/24 - 11/26" pattern in title', () => {
    const event = { title: 'Camp 11/24 - 11/26', start_date: '2026-11-24', end_date: '2026-11-24' };
    const result = getActualEndDate(event, parseYmdLocal);
    expect(result.getMonth()).toBe(10); // November
    expect(result.getDate()).toBe(26);
  });

  test('extracts end date from "16th-20th" pattern in title', () => {
    const event = { title: 'Spring Camp March 16th-20th', start_date: '2026-03-16', end_date: '2026-03-16' };
    const result = getActualEndDate(event, parseYmdLocal);
    expect(result.getDate()).toBe(20);
  });

  test('falls back to database end_date when no pattern in title', () => {
    const event = { title: 'Regular Camp', start_date: '2026-03-16', end_date: '2026-03-20' };
    const result = getActualEndDate(event, parseYmdLocal);
    expect(result.getDate()).toBe(20);
  });

  test('falls back to start_date when no end_date at all', () => {
    const event = { title: 'Single Day Camp', start_date: '2026-03-16', end_date: null };
    const result = getActualEndDate(event, parseYmdLocal);
    expect(result.getDate()).toBe(16);
  });
});

// ── eventFallsOnDate ─────────────────────────────────────────────────

describe('eventFallsOnDate', () => {
  const multiDayTypes = ['CAMP'];

  test('single-day event matches its exact date', () => {
    const event = { date: '2026-03-15', type: 'CLINIC' };
    expect(eventFallsOnDate(event, 15, 2026, 2, multiDayTypes)).toBe(true);
    expect(eventFallsOnDate(event, 14, 2026, 2, multiDayTypes)).toBe(false);
  });

  test('multi-day CAMP matches all days in range', () => {
    const event = {
      date: '2026-03-10',
      start_date: '2026-03-10',
      end_date: '2026-03-13',
      type: 'CAMP',
      title: 'Spring Camp',
    };
    expect(eventFallsOnDate(event, 10, 2026, 2, multiDayTypes)).toBe(true);
    expect(eventFallsOnDate(event, 12, 2026, 2, multiDayTypes)).toBe(true);
    expect(eventFallsOnDate(event, 13, 2026, 2, multiDayTypes)).toBe(true);
    expect(eventFallsOnDate(event, 14, 2026, 2, multiDayTypes)).toBe(false);
  });

  test('returns false for event with no date', () => {
    expect(eventFallsOnDate({ date: null }, 15, 2026, 2, multiDayTypes)).toBe(false);
  });
});

// ── groupCampEventsForDisplay ────────────────────────────────────────

describe('groupCampEventsForDisplay', () => {
  test('groups same-gym same-date camps together', () => {
    const events = [
      { type: 'CAMP', gym_id: 'CRR', date: '2026-06-15', title: 'Full Day' },
      { type: 'CAMP', gym_id: 'CRR', date: '2026-06-15', title: 'Half Day' },
    ];
    const result = groupCampEventsForDisplay(events);
    expect(result).toHaveLength(1);
    expect(result[0].isGrouped).toBe(true);
    expect(result[0].optionCount).toBe(2);
  });

  test('does not group camps from different gyms', () => {
    const events = [
      { type: 'CAMP', gym_id: 'CRR', date: '2026-06-15', title: 'Camp A' },
      { type: 'CAMP', gym_id: 'CAP', date: '2026-06-15', title: 'Camp B' },
    ];
    const result = groupCampEventsForDisplay(events);
    expect(result).toHaveLength(2);
  });

  test('non-camp events pass through unchanged', () => {
    const events = [
      { type: 'CLINIC', gym_id: 'CRR', date: '2026-06-15', title: 'Clinic' },
    ];
    const result = groupCampEventsForDisplay(events);
    expect(result).toHaveLength(1);
    expect(result[0].isGrouped).toBe(false);
  });

  test('single camp on a date is not grouped', () => {
    const events = [
      { type: 'CAMP', gym_id: 'CRR', date: '2026-06-15', title: 'Solo Camp' },
    ];
    const result = groupCampEventsForDisplay(events);
    expect(result).toHaveLength(1);
    expect(result[0].isGrouped).toBe(false);
  });
});

// ── parseCampOptionFromTitle ─────────────────────────────────────────

describe('parseCampOptionFromTitle', () => {
  test('detects Gymnastics camp', () => {
    const { icon, label } = parseCampOptionFromTitle('Gymnastics Camp Full Day');
    expect(icon).toBe('🤸');
    expect(label).toContain('Gymnastics');
    expect(label).toContain('Full Day');
  });

  test('detects Ninja camp', () => {
    const { icon, label } = parseCampOptionFromTitle('Ninja Warrior Camp');
    expect(icon).toBe('🥷');
    expect(label).toContain('Ninja');
  });

  test('detects Girls Gymnastics', () => {
    const { icon, label } = parseCampOptionFromTitle('Girls Gymnastics Half Day');
    expect(icon).toBe('🤸');
    expect(label).toContain('Girls Gymnastics');
  });

  test('falls back to first part of title for unknown', () => {
    const { label } = parseCampOptionFromTitle('Mystery Camp | Details');
    expect(label).toBe('Mystery Camp');
  });
});
