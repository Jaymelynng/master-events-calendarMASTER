import { compareEvents, getComparisonSummary } from '../eventComparison';

// Helper to create a minimal event object
const makeEvent = (overrides = {}) => ({
  event_url: 'https://app.iclasspro.com/portal/gym/events/123',
  title: 'Test Event',
  date: '2099-06-15',
  start_date: '2099-06-15',
  end_date: '2099-06-15',
  time: '6:00 PM - 8:00 PM',
  price: 40,
  type: 'CLINIC',
  age_min: 5,
  age_max: 12,
  description: 'A test event',
  gym_id: 'CRR',
  deleted_at: null,
  ...overrides,
});

describe('compareEvents', () => {
  describe('NEW events', () => {
    test('detects event that exists in sync but not in database', () => {
      const newEvents = [makeEvent()];
      const existingEvents = [];
      const result = compareEvents(newEvents, existingEvents);
      expect(result.new).toHaveLength(1);
      expect(result.new[0]._status).toBe('new');
    });

    test('detects multiple new events', () => {
      const newEvents = [
        makeEvent({ event_url: 'url-1' }),
        makeEvent({ event_url: 'url-2' }),
      ];
      const result = compareEvents(newEvents, []);
      expect(result.new).toHaveLength(2);
    });
  });

  describe('UNCHANGED events', () => {
    test('detects event with identical data', () => {
      const event = makeEvent();
      const result = compareEvents([event], [event]);
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0]._status).toBe('unchanged');
    });

    test('treats null and empty string as equivalent', () => {
      const incoming = makeEvent({ description: null });
      const existing = makeEvent({ description: '' });
      const result = compareEvents([incoming], [existing]);
      expect(result.unchanged).toHaveLength(1);
    });

    test('treats price 0 and null as equivalent', () => {
      const incoming = makeEvent({ price: 0 });
      const existing = makeEvent({ price: null });
      const result = compareEvents([incoming], [existing]);
      expect(result.unchanged).toHaveLength(1);
    });

    test('normalizes date with time component', () => {
      const incoming = makeEvent({ date: '2099-06-15' });
      const existing = makeEvent({ date: '2099-06-15T00:00:00' });
      const result = compareEvents([incoming], [existing]);
      expect(result.unchanged).toHaveLength(1);
    });
  });

  describe('CHANGED events', () => {
    test('detects title change', () => {
      const existing = makeEvent({ title: 'Old Title' });
      const incoming = makeEvent({ title: 'New Title' });
      const result = compareEvents([incoming], [existing]);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0]._status).toBe('changed');
    });

    test('detects price change', () => {
      const existing = makeEvent({ price: 40 });
      const incoming = makeEvent({ price: 45 });
      const result = compareEvents([incoming], [existing]);
      expect(result.changed).toHaveLength(1);
    });

    test('detects time change', () => {
      const existing = makeEvent({ time: '6:00 PM - 8:00 PM' });
      const incoming = makeEvent({ time: '7:00 PM - 9:00 PM' });
      const result = compareEvents([incoming], [existing]);
      expect(result.changed).toHaveLength(1);
    });

    test('reports which fields changed', () => {
      const existing = makeEvent({ title: 'Old', price: 40 });
      const incoming = makeEvent({ title: 'New', price: 50 });
      const result = compareEvents([incoming], [existing]);
      const changes = result.changed[0]._changes;
      expect(changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'price' }),
        ])
      );
    });

    test('detects restored event (was soft-deleted, reappears)', () => {
      const existing = makeEvent({ deleted_at: '2026-01-01T00:00:00' });
      const incoming = makeEvent();
      const result = compareEvents([incoming], [existing]);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0]._wasDeleted).toBe(true);
    });
  });

  describe('DELETED events', () => {
    test('detects future event missing from sync as deleted', () => {
      const existing = makeEvent({ start_date: '2099-12-01', date: '2099-12-01' });
      const result = compareEvents([], [existing]);
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0]._status).toBe('deleted');
    });

    test('does NOT mark past event as deleted (it naturally expired)', () => {
      const existing = makeEvent({ start_date: '2020-01-01', date: '2020-01-01' });
      const result = compareEvents([], [existing]);
      expect(result.deleted).toHaveLength(0);
    });

    test('skips already soft-deleted events', () => {
      const existing = makeEvent({
        start_date: '2099-12-01',
        date: '2099-12-01',
        deleted_at: '2026-01-01T00:00:00',
      });
      const result = compareEvents([], [existing]);
      expect(result.deleted).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('handles null inputs gracefully', () => {
      const result = compareEvents(null, null);
      expect(result.new).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    test('handles empty arrays', () => {
      const result = compareEvents([], []);
      expect(result.new).toHaveLength(0);
    });

    test('handles mixed scenario (new + changed + deleted + unchanged)', () => {
      const existing = [
        makeEvent({ event_url: 'url-unchanged' }),
        makeEvent({ event_url: 'url-changed', title: 'Old' }),
        makeEvent({ event_url: 'url-deleted', start_date: '2099-12-01', date: '2099-12-01' }),
      ];
      const incoming = [
        makeEvent({ event_url: 'url-unchanged' }),
        makeEvent({ event_url: 'url-changed', title: 'New' }),
        makeEvent({ event_url: 'url-new' }),
      ];
      const result = compareEvents(incoming, existing);
      expect(result.new).toHaveLength(1);
      expect(result.changed).toHaveLength(1);
      expect(result.deleted).toHaveLength(1);
      expect(result.unchanged).toHaveLength(1);
    });
  });
});

describe('getComparisonSummary', () => {
  test('computes correct counts', () => {
    const comparison = {
      new: [{ a: 1 }, { a: 2 }],
      changed: [{ a: 3 }],
      deleted: [{ a: 4 }],
      unchanged: [{ a: 5 }, { a: 6 }, { a: 7 }],
    };
    const summary = getComparisonSummary(comparison);
    expect(summary.totalNew).toBe(2);
    expect(summary.totalChanged).toBe(1);
    expect(summary.totalDeleted).toBe(1);
    expect(summary.totalUnchanged).toBe(3);
    expect(summary.totalIncoming).toBe(6); // new + changed + unchanged
    expect(summary.totalExisting).toBe(5); // changed + deleted + unchanged
  });
});
