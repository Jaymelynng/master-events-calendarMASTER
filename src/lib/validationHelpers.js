/**
 * Shared validation helper functions
 * Used by SyncModal, EventsDashboard, and AdminAuditReview
 */

// Check if an error has been acknowledged/dismissed
export const isErrorAcknowledged = (acknowledgedErrors, errorMessage) => {
  if (!acknowledgedErrors || !Array.isArray(acknowledgedErrors)) return false;
  return acknowledgedErrors.some(ack =>
    typeof ack === 'string' ? ack === errorMessage : ack.message === errorMessage
  );
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
    'title_desc_mismatch', 'camp_price_mismatch'
  ];

  const statusErrorTypes = ['registration_closed', 'registration_not_open', 'sold_out'];

  if (dataErrorTypes.includes(error.type)) return 'data_error';
  if (statusErrorTypes.includes(error.type)) return 'status';
  return 'formatting';
};

// Check if an error type supports "Add as Rule"
export const canAddAsRule = (errorType) => {
  return errorType === 'camp_price_mismatch' || errorType === 'time_mismatch' ||
         errorType === 'program_mismatch' || errorType === 'missing_program_in_title';
};

// Extract rule value from an error object (price, time, or program synonym)
export const extractRuleValue = (errorObj, event = null) => {
  if (errorObj.type === 'camp_price_mismatch') {
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
    'title_desc_mismatch': '📝 Title/Description Mismatch',
    'camp_type_not_offered': '🏕️ Camp Type Not Offered',
    'registration_closed': '🔒 Registration Closed',
    'registration_not_open': '🔓 Registration Not Open Yet',
  };
  return labels[type] || type;
};
