import {
  isErrorAcknowledged,
  isErrorAcknowledgedAnywhere,
  matchesAcknowledgedPattern,
  getAcknowledgmentDetails,
  inferErrorCategory,
  canAddAsRule,
  extractRuleValue,
  matchesErrorTypeFilter,
  parsePriceErrorDetails,
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
    const acks = [{ message: 'price error', note: 'ok' }];
    expect(isErrorAcknowledged(acks, 'price error')).toBe(true);
    expect(isErrorAcknowledged(acks, 'other error')).toBe(false);
  });
});

// ── matchesAcknowledgedPattern ───────────────────────────────────────

describe('matchesAcknowledgedPattern', () => {
  const patterns = [
    { gym_id: 'CRR', event_type: 'CLINIC', error_message: 'Price mismatch' },
  ];

  test('matches exact gym + type + message', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CRR', 'CLINIC', 'Price mismatch')).toBe(true);
  });

  test('case-insensitive on event_type', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CRR', 'clinic', 'Price mismatch')).toBe(true);
  });

  test('returns false for wrong gym', () => {
    expect(matchesAcknowledgedPattern(patterns, 'CAP', 'CLINIC', 'Price mismatch')).toBe(false);
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
    expect(inferErrorCategory({ type: 'price_mismatch' })).toBe('data_error');
    expect(inferErrorCategory({ type: 'camp_price_mismatch' })).toBe('data_error');
  });

  test('classifies status types', () => {
    expect(inferErrorCategory({ type: 'registration_closed' })).toBe('status');
    expect(inferErrorCategory({ type: 'sold_out' })).toBe('status');
  });

  test('defaults to formatting for unknown types', () => {
    expect(inferErrorCategory({ type: 'missing_age_in_title' })).toBe('formatting');
    expect(inferErrorCategory({ type: 'unknown_type' })).toBe('formatting');
  });
});

// ── canAddAsRule ─────────────────────────────────────────────────────

describe('canAddAsRule', () => {
  test('returns true for supported types', () => {
    expect(canAddAsRule('camp_price_mismatch')).toBe(true);
    expect(canAddAsRule('event_price_mismatch')).toBe(true);
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
    expect(matchesErrorTypeFilter('price_mismatch', 'all')).toBe(true);
    expect(matchesErrorTypeFilter('age_mismatch', 'all')).toBe(true);
  });

  test('price filter matches price types', () => {
    expect(matchesErrorTypeFilter('price_mismatch', 'price')).toBe(true);
    expect(matchesErrorTypeFilter('camp_price_mismatch', 'price')).toBe(true);
    expect(matchesErrorTypeFilter('age_mismatch', 'price')).toBe(false);
  });

  test('hidePrices hides all price types even with "all"', () => {
    expect(matchesErrorTypeFilter('price_mismatch', 'all', true)).toBe(false);
    expect(matchesErrorTypeFilter('camp_price_mismatch', 'all', true)).toBe(false);
    expect(matchesErrorTypeFilter('age_mismatch', 'all', true)).toBe(true);
  });

  test('date filter matches date/day/year types', () => {
    expect(matchesErrorTypeFilter('date_mismatch', 'date')).toBe(true);
    expect(matchesErrorTypeFilter('day_mismatch', 'date')).toBe(true);
    expect(matchesErrorTypeFilter('year_mismatch', 'date')).toBe(true);
  });

  test('format filter matches formatting types', () => {
    expect(matchesErrorTypeFilter('missing_age_in_title', 'format')).toBe(true);
    expect(matchesErrorTypeFilter('clinic_missing_skill', 'format')).toBe(true);
    expect(matchesErrorTypeFilter('price_mismatch', 'format')).toBe(false);
  });
});

// ── extractRuleValue ─────────────────────────────────────────────────

describe('extractRuleValue', () => {
  test('extracts price from event_price_mismatch', () => {
    const err = { type: 'event_price_mismatch', message: 'CLINIC price $40 doesn\'t match' };
    const result = extractRuleValue(err);
    expect(result).toEqual({ ruleType: 'price', value: '40' });
  });

  test('extracts time from time_mismatch', () => {
    const err = { type: 'time_mismatch', message: 'description says 6:30 PM but fields say 7:00 PM' };
    const result = extractRuleValue(err);
    expect(result).toEqual({ ruleType: 'time', value: '6:30 PM' });
  });

  test('returns null for unsupported type', () => {
    expect(extractRuleValue({ type: 'age_mismatch', message: 'age wrong' })).toBeNull();
  });
});

// ── parsePriceErrorDetails ───────────────────────────────────────────

describe('parsePriceErrorDetails', () => {
  test('parses event_price_mismatch message', () => {
    const err = {
      type: 'event_price_mismatch',
      message: "KIDS NIGHT OUT price $40 doesn't match expected price for HGA. Valid: $45",
    };
    const result = parsePriceErrorDetails(err, { type: 'KIDS NIGHT OUT' });
    expect(result.foundPrice).toBe('40');
    expect(result.gymId).toBe('HGA');
    expect(result.validPrices).toEqual(['45']);
  });

  test('parses camp_price_mismatch message', () => {
    const err = {
      type: 'camp_price_mismatch',
      message: "Camp price $360 doesn't match any valid price for HGA. Valid: Full Day Daily $90, Full Day Weekly $400",
    };
    const result = parsePriceErrorDetails(err);
    expect(result.foundPrice).toBe('360');
    expect(result.gymId).toBe('HGA');
    expect(result.eventType).toBe('CAMP');
  });

  test('returns null for unrecognized message', () => {
    expect(parsePriceErrorDetails(null)).toBeNull();
    expect(parsePriceErrorDetails({ type: 'other', message: 'nope' })).toBeNull();
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
      { validation_errors: [{ type: 'price_mismatch', message: 'bad price' }] },
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
        { type: 'price_mismatch', message: 'bad price' },
        { type: 'age_mismatch', message: 'bad age' },
      ],
      acknowledged_errors: ['bad price'],
    }];
    const result = processEventsWithIssues(events);
    expect(result[0].activeErrors).toHaveLength(1);
    expect(result[0].dismissedErrors).toHaveLength(1);
    expect(result[0].activeErrors[0].message).toBe('bad age');
  });
});
