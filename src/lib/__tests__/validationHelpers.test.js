import {
  isErrorAcknowledged,
  isErrorAcknowledgedAnywhere,
  matchesAcknowledgedPattern,
  getAcknowledgmentDetails,
  inferErrorCategory,
  canAddAsRule,
  extractRuleValue,
  matchesErrorTypeFilter,
  processEventsWithIssues,
  computeAccuracyStats,
  isErrorVerified,
} from '../validationHelpers';

// ── isErrorAcknowledged ──────────────────────────────────────────────

describe('isErrorAcknowledged', () => {
  test('returns true when patternMatch is true', () => {
    expect(isErrorAcknowledged([], 'anything', true)).toBe(true);
  });

  test('returns false for null/undefined acknowledged list', () => {
    expect(isErrorAcknowledged(null, 'msg')).toBe(false);
    expect(isErrorAcknowledged(undefined, 'msg')).toBe(false);
  });

  test('matches string entries', () => {
    expect(isErrorAcknowledged(['msg A', 'msg B'], 'msg A')).toBe(true);
    expect(isErrorAcknowledged(['msg A'], 'msg C')).toBe(false);
  });

  test('matches object entries by .message', () => {
    const acks = [{ message: 'time error', note: 'ok' }];
    expect(isErrorAcknowledged(acks, 'time error')).toBe(true);
    expect(isErrorAcknowledged(acks, 'other error')).toBe(false);
  });
});

// ── matchesAcknowledgedPattern ───────────────────────────────────────

describe('matchesAcknowledgedPattern', () => {
  const patterns = [
    { gym_id: 'CRR', event_type: 'CLINIC', error_message: 'Time mismatch' },
  ];

  test('matches exact gym + type + message', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CRR', 'CLINIC', 'Time mismatch')).toBe(true);
  });

  test('case-insensitive on event_type', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CRR', 'clinic', 'Time mismatch')).toBe(true);
  });

  test('returns false for wrong gym', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CAP', 'CLINIC', 'Time mismatch')).toBe(false);
  });

  test('returns false for null/empty patterns', () => {
    expect(matchesAcknowledgedPattern(null, 'CRR', 'CLINIC', 'msg')).toBe(false);
    expect(matchesAcknowledgedPattern([], 'CRR', 'CLINIC', 'msg')).toBe(false);
  });
});

// ── isErrorAcknowledgedAnywhere ──────────────────────────────────────

describe('isErrorAcknowledgedAnywhere', () => {
  test('returns true if per-event acknowledged', () => {
    const event = { acknowledged_errors: ['msg'], gym_id: 'CRR', type: 'CLINIC' };
    expect(isErrorAcknowledgedAnywhere(event, 'msg', [])).toBe(true);
  });

  test('returns true if pattern matches', () => {
    const event = { acknowledged_errors: [], gym_id: 'CRR', type: 'CLINIC' };
    const patterns = [{ gym_id: 'CRR', event_type: 'CLINIC', error_message: 'msg' }];
    expect(isErrorAcknowledgedAnywhere(event, 'msg', patterns)).toBe(true);
  });

  test('returns false if neither', () => {
    const event = { acknowledged_errors: [], gym_id: 'CRR', type: 'CLINIC' };
    expect(isErrorAcknowledgedAnywhere(event, 'msg', [])).toBe(false);
  });
});

// ── getAcknowledgmentDetails ─────────────────────────────────────────

describe('getAcknowledgmentDetails', () => {
  test('returns object with matching message', () => {
    const acks = [{ message: 'err', note: 'ok' }];
    expect(getAcknowledgmentDetails(acks, 'err')).toEqual({ message: 'err', note: 'ok' });
  });

  test('returns null for string entries (no details)', () => {
    expect(getAcknowledgmentDetails(['err'], 'err')).toBeNull();
  });

  test('returns null when not found', () => {
    expect(getAcknowledgmentDetails([], 'err')).toBeNull();
    expect(getAcknowledgmentDetails(null, 'err')).toBeNull();
  });
});

// ── inferErrorCategory ───────────────────────────────────────────────

describe('inferErrorCategory', () => {
  test('returns existing category if present', () => {
    expect(inferErrorCategory({ category: 'custom' })).toBe('custom');
  });

  test('classifies data error types', () => {
    expect(inferErrorCategory({ type: 'year_mismatch' })).toBe('data_error');
    expect(inferErrorCategory({ type: 'time_mismatch' })).toBe('data_error');
    expect(inferErrorCategory({ type: 'age_mismatch' })).toBe('data_error');
  });

  test('classifies status types', () => {
    expect(inferErrorCategory({ type: 'registration_closed' })).toBe('status');
    expect(inferErrorCategory({ type: 'sold_out' })).toBe('status');
  });

  test('defaults to other for unknown types', () => {
    expect(inferErrorCategory({ type: 'missing_age_in_title' })).toBe('other');
    expect(inferErrorCategory({ type: 'unknown_type' })).toBe('other');
  });
});

// ── canAddAsRule ─────────────────────────────────────────────────────

describe('canAddAsRule', () => {
  test('returns true for supported types', () => {
    expect(canAddAsRule('time_mismatch')).toBe(true);
    expect(canAddAsRule('program_mismatch')).toBe(true);
  });

  test('returns false for unsupported types', () => {
    expect(canAddAsRule('year_mismatch')).toBe(false);
    expect(canAddAsRule('age_mismatch')).toBe(false);
  });
});

// ── matchesErrorTypeFilter ───────────────────────────────────────────

describe('matchesErrorTypeFilter', () => {
  test('"all" matches everything', () => {
    expect(matchesErrorTypeFilter('time_mismatch', 'all')).toBe(true);
    expect(matchesErrorTypeFilter('age_mismatch', 'all')).toBe(true);
  });

  test('date filter matches date/day/year types', () => {
    expect(matchesErrorTypeFilter('date_mismatch', 'date')).toBe(true);
    expect(matchesErrorTypeFilter('day_mismatch', 'date')).toBe(true);
    expect(matchesErrorTypeFilter('year_mismatch', 'date')).toBe(true);
  });

});

// ── extractRuleValue ─────────────────────────────────────────────────

describe('extractRuleValue', () => {
  test('extracts time from time_mismatch', () => {
    const err = { type: 'time_mismatch', message: 'description says 6:30 PM but fields say 7:00 PM' };
    const result = extractRuleValue(err);
    expect(result).toEqual({ ruleType: 'time', value: '6:30 PM' });
  });

  test('returns null for unsupported type', () => {
    expect(extractRuleValue({ type: 'age_mismatch', message: 'age wrong' })).toBeNull();
  });
});

// ── computeAccuracyStats ─────────────────────────────────────────────

describe('computeAccuracyStats', () => {
  test('counts correct and incorrect verdicts', () => {
    const events = [
      { verified_errors: [{ verdict: 'correct' }, { verdict: 'correct' }] },
      { verified_errors: [{ verdict: 'incorrect' }] },
    ];
    const stats = computeAccuracyStats(events);
    expect(stats.verified).toBe(2);
    expect(stats.incorrect).toBe(1);
    expect(stats.total).toBe(3);
    expect(stats.accuracyPct).toBe(67); // 2/3 = 66.67 → rounds to 67
  });

  test('returns null accuracy when no verified errors', () => {
    expect(computeAccuracyStats([]).accuracyPct).toBeNull();
    expect(computeAccuracyStats(null).accuracyPct).toBeNull();
  });

  test('treats entries without verdict as correct (backwards compat)', () => {
    const events = [{ verified_errors: [{ message: 'old entry' }] }];
    expect(computeAccuracyStats(events).verified).toBe(1);
  });
});

// ── isErrorVerified ──────────────────────────────────────────────────

describe('isErrorVerified', () => {
  test('finds verified entry by message', () => {
    const verified = [{ message: 'err', verdict: 'correct' }];
    expect(isErrorVerified(verified, 'err')).toEqual({ message: 'err', verdict: 'correct' });
  });

  test('returns null when not found or empty', () => {
    expect(isErrorVerified([], 'err')).toBeNull();
    expect(isErrorVerified(null, 'err')).toBeNull();
  });
});

// ── processEventsWithIssues ──────────────────────────────────────────

describe('processEventsWithIssues', () => {
  test('returns empty array for empty input', () => {
    expect(processEventsWithIssues([])).toEqual([]);
    expect(processEventsWithIssues(null)).toEqual([]);
  });

  test('includes events with validation errors', () => {
    const events = [
      { validation_errors: [{ type: 'time_mismatch', message: 'bad time' }] },
    ];
    const result = processEventsWithIssues(events);
    expect(result).toHaveLength(1);
    expect(result[0].dataErrors).toHaveLength(1);
  });

  test('includes events with description_status "none"', () => {
    const events = [{ validation_errors: [], description_status: 'none' }];
    const result = processEventsWithIssues(events);
    expect(result).toHaveLength(1);
    expect(result[0].hasDescriptionIssue).toBe(true);
  });

  test('excludes events with only sold_out errors', () => {
    const events = [{ validation_errors: [{ type: 'sold_out', message: 'sold out' }] }];
    const result = processEventsWithIssues(events);
    expect(result).toHaveLength(0);
  });

  test('separates active and dismissed errors', () => {
    const events = [{
      validation_errors: [
        { type: 'time_mismatch', message: 'bad time' },
        { type: 'age_mismatch', message: 'bad age' },
      ],
      acknowledged_errors: ['bad time'],
    }];
    const result = processEventsWithIssues(events);
    expect(result[0].activeErrors).toHaveLength(1);
    expect(result[0].dismissedErrors).toHaveLength(1);
    expect(result[0].activeErrors[0].message).toBe('bad age');
  });
});

// ── pricing stays removed (2026-10-02) ──────────────────────────────

describe('pricing is removed', () => {
  test('price error types are no longer data errors or rule-able', () => {
    expect(inferErrorCategory({ type: 'price_mismatch' })).toBe('other');
    expect(canAddAsRule('camp_price_mismatch')).toBe(false);
    expect(extractRuleValue({ type: 'event_price_mismatch', message: 'CLINIC price $40' })).toBeNull();
  });
});
