/**
 * Event Comparison Logic
 * Uses event_url (built from event ID) as the source of truth
 */

/**
 * Compare new events with existing events to identify:
 * - NEW: event_url doesn't exist in database
 * - CHANGED: event_url exists but data is different
 * - DELETED: event_url exists in database but not in new sync
 * - UNCHANGED: event_url exists and data is the same
 */
export function compareEvents(newEvents, existingEvents) {
  // Create maps for fast lookup
  const existingByUrl = new Map();
  (existingEvents || []).forEach(ev => {
    existingByUrl.set(ev.event_url, ev);
  });

  const newByUrl = new Map();
  (newEvents || []).forEach(ev => {
    newByUrl.set(ev.event_url, ev);
  });

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
      // DELETED: Exists in database but not in new sync
      comparison.deleted.push({
        ...existing,
        _status: 'deleted',
        _reason: 'Event no longer available from source'
      });
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
  // Fields to compare (excluding auto-generated fields)
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
    'description'
  ];

  for (const field of fieldsToCompare) {
    const existingValue = normalizeValue(existing[field], field);
    const incomingValue = normalizeValue(incoming[field], field);

    if (existingValue !== incomingValue) {
      // Debug log for troubleshooting
      console.log(`Field "${field}" changed:`, { existing: existingValue, incoming: incomingValue });
      return true; // Found a change
    }
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
    'description'
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
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Special handling for price - convert to number for consistent comparison
  if (fieldName === 'price') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  
  // Special handling for age fields - convert to integer
  if (fieldName === 'age_min' || fieldName === 'age_max') {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
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

