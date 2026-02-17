/**
 * Shared validation helper functions
 * Used by SyncModal, EventsDashboard, and AdminAuditReview
 */

// Check if an error has been acknowledged/dismissed (per-event or by pattern for "all in program")
export const isErrorAcknowledged = (acknowledgedErrors, errorMessage, patternMatch = false) => {
  if (patternMatch) return true;
  if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return false;
  return acknowledgedErrors.some(ack =>
    typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
  );
};

// One call: check if error is dismissed (per-event OR pattern) — use everywhere
export const isErrorAcknowledgedAnywhere = (event, errorMessage, patterns = []) => {
  const pm = matchesAcknowledgedPattern(patterns, event?.gym_id, event?.type, errorMessage);
  return isErrorAcknowledged(event?.acknowledged_errors || [], errorMessage, pm);
};

// Check if an error matches an acknowledged pattern (gym + event_type + message)
export const matchesAcknowledgedPattern = (patterns, gymId, eventType, errorMessage) => {
  if (!patterns || !Array.isArray(patterns)) return false;
  const et = (eventType || '').toUpperCase();
  return patterns.some(p => {
    const pt = (p.event_type || '').toUpperCase();
    return p.gym_id === gymId && pt === et && p.error_message === errorMessage;
  });
};

// Get the acknowledgment details for an error (note, timestamp)
export const getAcknowledgmentDetails = (acknowledgedErrors, errorMessage) => {
  if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return null;
  const found = acknowledgedErrors.find(ack =>
    typeof ack === 'object' && ack.message === errorMessage
  );
  return found || null;
};

// Infer category from error type (for legacy data that doesn't have category field)
export const inferErrorCategory = (error) => {
  if (error.category) return error.category;

  const dataErrorTypes = [
    'year_mismatch', 'date_mismatch', 'time_mismatch', 'age_mismatch',
    'day_mismatch', 'program_mismatch', 'skill_mismatch', 'price_mismatch',
    'title_desc_mismatch', 'camp_price_mismatch', 'event_price_mismatch'
  ];

  const statusErrorTypes = ['registration_closed', 'registration_not_open', 'sold_out'];

  if (dataErrorTypes.includes(error.type)) return 'data_error';
  if (statusErrorTypes.includes(error.type)) return 'status';
  return 'formatting';
};

// Check if an error type supports "Add as Rule"
export const canAddAsRule = (errorType) => {
  return errorType === 'camp_price_mismatch' || errorType === 'event_price_mismatch' ||
         errorType === 'time_mismatch' ||
         errorType === 'program_mismatch' || errorType === 'missing_program_in_title';
};

// Extract rule value from an error object (price, time, or program synonym)
export const extractRuleValue = (errorObj, event = null) => {
  if (errorObj.type === 'camp_price_mismatch' || errorObj.type === 'event_price_mismatch') {
    const priceMatch = errorObj.message.match(/\$(\d+(?:\.\d{2})?)/);
    return priceMatch ? { ruleType: 'price', value: priceMatch[1] } : null;
  } else if (errorObj.type === 'time_mismatch') {
    const timeMatch = errorObj.message.match(/(?:description|title) says (\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p))/i);
    return timeMatch ? { ruleType: 'time', value: timeMatch[1].trim() } : null;
  } else if (errorObj.type === 'program_mismatch' || errorObj.type === 'missing_program_in_title') {
    const titleValue = event?.title || '';
    return titleValue ? { ruleType: 'program_synonym', value: titleValue.toLowerCase(), suggestedLabel: event?.type || '' } : null;
  }
  return null;
};

// Process events with validation issues - separates errors by category
export const processEventsWithIssues = (events) => {
  if (!events || events.length === 0) return [];

  return events.filter(event => {
    const errors = event.validation_errors || [];
    const realErrors = errors.filter(err => err.type !== 'sold_out');
    return realErrors.length > 0 ||
           event.description_status === 'none' ||
           event.description_status === 'flyer_only';
  }).map(event => {
    const errors = (event.validation_errors || []).filter(err => err.type !== 'sold_out');
    const acknowledged = event.acknowledged_errors || [];

    // Separate by category using inferErrorCategory for legacy data
    const dataErrors = errors.filter(e => inferErrorCategory(e) === 'data_error');
    const formattingErrors = errors.filter(e => inferErrorCategory(e) === 'formatting');
    const statusErrors = errors.filter(e => inferErrorCategory(e) === 'status');
    const otherErrors = errors.filter(e => !e.category && !inferErrorCategory(e));

    // Separate active vs dismissed
    const activeErrors = errors.filter(err => !isErrorAcknowledged(acknowledged, err.message));
    const dismissedErrors = errors.filter(err => isErrorAcknowledged(acknowledged, err.message));

    return {
      ...event,
      dataErrors,
      formattingErrors,
      statusErrors,
      otherErrors,
      activeErrors,
      dismissedErrors,
      totalErrors: errors.length,
      hasDescriptionIssue: event.description_status === 'none' || event.description_status === 'flyer_only'
    };
  });
};

// Check if an error has been verified (verdict: 'correct' or 'incorrect')
export const isErrorVerified = (verifiedErrors, errorMessage) => {
  if (!verifiedErrors || !Array.isArray(verifiedErrors)) return null;
  return verifiedErrors.find(v => v.message === errorMessage) || null;
};

// Compute accuracy stats from an array of events
// Only counts verified_errors entries:
//   - verdict: 'correct' (checkbox) = system was right
//   - verdict: 'incorrect' (X button) = system was wrong
// Dismissals (acknowledged_errors) are NOT counted - they just mean "handled"
export const computeAccuracyStats = (events) => {
  let correct = 0;
  let incorrect = 0;

  (events || []).forEach(event => {
    const verifiedArr = event.verified_errors || [];
    verifiedArr.forEach(v => {
      if (v.verdict === 'incorrect') {
        incorrect++;
      } else {
        // Default to 'correct' for backwards compatibility (old entries without verdict)
        correct++;
      }
    });
  });

  const total = correct + incorrect;
  return {
    total,
    verified: correct,      // renamed from "verified" but keeping for UI compatibility
    incorrect,
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
  };
};

// Get error type label for display
export const getErrorLabel = (type) => {
  const labels = {
    'year_mismatch': '📅 Year Mismatch',
    'date_mismatch': '📅 Date Mismatch',
    'day_mismatch': '📅 Day Mismatch',
    'time_mismatch': '🕐 Time Mismatch',
    'age_mismatch': '👶 Age Mismatch',
    'program_mismatch': '🏷️ Program Mismatch',
    'missing_program_in_title': '🏷️ Missing Program in Title',
    'skill_mismatch': '⭐ Skill Mismatch',
    'price_mismatch': '💰 Price Mismatch',
    'camp_price_mismatch': '💰 Camp Price Mismatch',
    'event_price_mismatch': '💰 Event Price Mismatch',
    'title_desc_mismatch': '📝 Title/Description Mismatch',
    'camp_type_not_offered': '🏕️ Camp Type Not Offered',
    'registration_closed': '🔒 Registration Closed',
    'registration_not_open': '🔓 Registration Not Open Yet',
  };
  return labels[type] || type;
};

// Error type filter groups for audit page
const PRICE_TYPES = ['price_mismatch', 'camp_price_mismatch', 'event_price_mismatch'];
const TIME_TYPES = ['time_mismatch'];
const AGE_TYPES = ['age_mismatch'];
const DATE_TYPES = ['date_mismatch', 'day_mismatch', 'year_mismatch'];
const PROGRAM_TYPES = ['program_mismatch', 'missing_program_in_title'];
const FORMAT_TYPES = [
  'missing_age_in_description', 'missing_age_in_title',
  'missing_time_in_description', 'missing_price_in_description',
  'missing_program_in_description', 'missing_datetime_in_description',
  'missing_date_in_title', 'clinic_missing_skill', 'title_desc_mismatch',
];

// Check if an error matches the error type filter + hidePrices toggle
export const matchesErrorTypeFilter = (errorType, filterValue, hidePrices = false) => {
  // Always hide prices when toggle is on
  if (hidePrices && PRICE_TYPES.includes(errorType)) return false;

  if (filterValue === 'all') return true;
  if (filterValue === 'price') return PRICE_TYPES.includes(errorType);
  if (filterValue === 'time') return TIME_TYPES.includes(errorType);
  if (filterValue === 'age') return AGE_TYPES.includes(errorType);
  if (filterValue === 'date') return DATE_TYPES.includes(errorType);
  if (filterValue === 'program') return PROGRAM_TYPES.includes(errorType);
  if (filterValue === 'format') return FORMAT_TYPES.includes(errorType);
  return true;
};
