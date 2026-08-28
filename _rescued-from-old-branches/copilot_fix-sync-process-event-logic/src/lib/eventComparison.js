/**
 * Event Comparison Logic
 * Uses event_url (built from event ID) as the source of truth
 */

/**
 * Compare new events with existing events to identify:
 * - NEW: event_url doesn't exist in database
 * - CHANGED: event_url exists but data is different
 * - DELETED: event_url exists in database but not in new sync (FUTURE EVENTS ONLY)
 * - UNCHANGED: event_url exists and data is the same
 * 
 * IMPORTANT: We only consider FUTURE events as "deleted" because:
 * - iClassPro only shows upcoming events
 * - Past events naturally disappear from the portal after they occur
 * - We should NOT mark past events as deleted just because they're not in the sync
 */
export function compareEvents(newEvents, existingEvents) {
  // DEBUG: Log what we're comparing
  console.log('🔍 compareEvents called:');
  console.log('  - newEvents count:', (newEvents || []).length);
  console.log('  - existingEvents count:', (existingEvents || []).length);
  
  // Get today's date for filtering "deleted" detection
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Create maps for fast lookup
  const existingByUrl = new Map();
  (existingEvents || []).forEach(ev => {
    existingByUrl.set(ev.event_url, ev);
  });

  const newByUrl = new Map();
  (newEvents || []).forEach(ev => {
    newByUrl.set(ev.event_url, ev);
  });
  
  // DEBUG: Log first few URLs from each
  console.log('  - First 3 existing URLs:', [...existingByUrl.keys()].slice(0, 3));
  console.log('  - First 3 new URLs:', [...newByUrl.keys()].slice(0, 3));

  // Get all unique URLs
  const allUrls = new Set([
    ...existingByUrl.keys(),
    ...newByUrl.keys()
  ]);

  const comparison = {
    new: [],
    changed: [],
    deleted: [],
    unchanged: []
  };

  allUrls.forEach(url => {
    const existing = existingByUrl.get(url);
    const incoming = newByUrl.get(url);

    if (!existing && incoming) {
      // NEW: Exists in new sync but not in database
      comparison.new.push({
        ...incoming,
        _status: 'new',
        _reason: 'Event not found in database'
      });
    } else if (existing && !incoming) {
      // POTENTIALLY DELETED: Exists in database but not in new sync
      // ONLY mark as deleted if it's a FUTURE event that HASN'T STARTED YET
      // Events that have already started (even if they extend into the future) won't appear in iClassPro sync
      // Past events naturally disappear from iClassPro - that's expected behavior
      const startDate = existing.start_date || existing.date;
      const endDate = existing.end_date || existing.date;
      const hasNotStarted = startDate && startDate > todayStr;
      const isFutureEvent = endDate && endDate >= todayStr;
      
      // Only mark as deleted if the event hasn't started yet AND is in the future
      if (hasNotStarted && isFutureEvent) {
        comparison.deleted.push({
          ...existing,
          _status: 'deleted',
          _reason: 'Future event no longer available from source'
        });
      }
      // Events that have already started or are past are silently ignored - they're not "deleted", just expired or in-progress
    } else if (existing && incoming) {
      // Check if event was previously deleted (should be restored)
      const wasDeleted = existing.deleted_at !== null && existing.deleted_at !== undefined;
      
      // Check if data changed
      const hasChanges = hasEventChanged(existing, incoming);
      
      if (wasDeleted || hasChanges) {
        // CHANGED: Same URL but different data, or was deleted and should be restored
        comparison.changed.push({
          existing,
          incoming,
          _status: 'changed',
          _changes: getChangedFields(existing, incoming),
          _wasDeleted: wasDeleted  // Flag if this is a restore
        });
      } else {
        // UNCHANGED: Same URL and same data
        comparison.unchanged.push({
          ...existing,
          _status: 'unchanged'
        });
      }
    }
  });

  return comparison;
}

/**
 * Check if an event has changed by comparing key fields
 */
function hasEventChanged(existing, incoming) {
  // Fields to compare (excluding auto-generated fields and user-managed fields)
  // NOTE: acknowledged_errors is NOT included - user dismissals shouldn't trigger "changed"
  const fieldsToCompare = [
    'title',
    'date',
    'start_date',
    'end_date',
    'time',
    'price',
    'type',
    'age_min',
    'age_max',
    'description',
    'has_flyer',
    'flyer_url',
    'description_status',
    'validation_errors'
    // 'acknowledged_errors' - intentionally excluded, managed by user
  ];

  const changes = [];
  
  for (const field of fieldsToCompare) {
    const existingValue = normalizeValue(existing[field], field);
    const incomingValue = normalizeValue(incoming[field], field);

    if (existingValue !== incomingValue) {
      changes.push({ field, existing: existingValue, incoming: incomingValue });
    }
  }

  if (changes.length > 0) {
    // Debug log for troubleshooting - show all changes at once
    console.log(`🔄 Event "${(incoming.title || '').substring(0, 40)}..." has ${changes.length} change(s):`);
    changes.forEach(c => {
      console.log(`   - ${c.field}: "${c.existing}" → "${c.incoming}"`);
    });
    return true;
  }

  return false; // No changes detected
}

/**
 * Get list of fields that changed
 */
function getChangedFields(existing, incoming) {
  const fieldsToCompare = [
    'title',
    'date',
    'start_date',
    'end_date',
    'time',
    'price',
    'type',
    'age_min',
    'age_max',
    'description',
    'has_flyer',
    'flyer_url',
    'description_status',
    'validation_errors'
  ];

  const changes = [];

  for (const field of fieldsToCompare) {
    const existingValue = normalizeValue(existing[field], field);
    const incomingValue = normalizeValue(incoming[field], field);

    if (existingValue !== incomingValue) {
      changes.push({
        field,
        old: existingValue,
        new: incomingValue
      });
    }
  }

  return changes;
}

/**
 * Normalize values for comparison (handle null, undefined, empty strings)
 */
function normalizeValue(value, fieldName = '') {
  // Treat null, undefined, empty string, and 0 as equivalent for optional fields
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Special handling for price - convert to number for consistent comparison
  if (fieldName === 'price') {
    const num = parseFloat(value);
    // Treat 0 as null for price (no price = 0 = null)
    return isNaN(num) || num === 0 ? null : num;
  }
  
  // Special handling for age fields - convert to integer
  if (fieldName === 'age_min' || fieldName === 'age_max') {
    const num = parseInt(value, 10);
    // Treat 0 as null for age (no age = 0 = null)
    return isNaN(num) || num === 0 ? null : num;
  }
  
  // Special handling for date fields - normalize to YYYY-MM-DD format
  if (fieldName === 'date' || fieldName === 'start_date' || fieldName === 'end_date') {
    if (typeof value === 'string') {
      // Handle both ISO format and YYYY-MM-DD
      const dateStr = value.split('T')[0]; // Remove time component if present
      return dateStr.trim();
    }
  }
  
  // Special handling for time - normalize format
  if (fieldName === 'time') {
    if (typeof value === 'string') {
      // Normalize whitespace and case
      return value.trim().replace(/\s+/g, ' ');
    }
  }
  
  // Special handling for description - treat empty/whitespace as null
  if (fieldName === 'description') {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
  }
  
  // Special handling for validation_errors - compare as sorted JSON string
  // Arrays can't be compared by reference, so we stringify them
  if (fieldName === 'validation_errors') {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return null; // Empty array = null for comparison
    }
    if (Array.isArray(value)) {
      // Sort by type and message for consistent comparison
      const sorted = [...value].sort((a, b) => {
        const typeCompare = (a.type || '').localeCompare(b.type || '');
        if (typeCompare !== 0) return typeCompare;
        return (a.message || '').localeCompare(b.message || '');
      });
      return JSON.stringify(sorted);
    }
    // Already a string (from database)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length === 0) return null;
        return value;
      } catch {
        return value;
      }
    }
    return null;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

/**
 * Get summary statistics from comparison
 */
export function getComparisonSummary(comparison) {
  return {
    totalNew: comparison.new.length,
    totalChanged: comparison.changed.length,
    totalDeleted: comparison.deleted.length,
    totalUnchanged: comparison.unchanged.length,
    totalIncoming: comparison.new.length + comparison.changed.length + comparison.unchanged.length,
    totalExisting: comparison.changed.length + comparison.deleted.length + comparison.unchanged.length
  };
}

