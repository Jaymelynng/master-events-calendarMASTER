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
      // ONLY mark as deleted if it's a FUTURE event
      // Past events naturally disappear from iClassPro - that's expected behavior
      const eventDate = existing.end_date || existing.date;
      const isFutureEvent = eventDate && eventDate >= todayStr;
      
      if (isFutureEvent) {
        comparison.deleted.push({
          ...existing,
          _status: 'deleted',
          _reason: 'Future event no longer available from source'
        });
      }
      // Past events are silently ignored - they're not "deleted", just expired
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
  // Fields to compare - ONLY source data from iClassPro
  // EXCLUDE computed/derived fields like validation_errors, description_status
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
    'flyer_url'
    // NOTE: Removed 'description_status' and 'validation_errors' 
    // These are COMPUTED fields, not source data - shouldn't trigger "changed"
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
  // Fields to compare - ONLY source data from iClassPro
  // EXCLUDE computed/derived fields like validation_errors, description_status
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
    'flyer_url'
    // NOTE: Removed 'description_status' and 'validation_errors' 
    // These are COMPUTED fields, not source data
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
  
  // Special handling for arrays (like validation_errors) - convert to JSON string for comparison
  if (Array.isArray(value)) {
    // Empty arrays are treated as null
    if (value.length === 0) {
      return null;
    }
    // Sort and stringify for consistent comparison
    return JSON.stringify([...value].sort());
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
  
  // Special handling for boolean fields (like has_flyer)
  if (fieldName === 'has_flyer') {
    // Normalize to boolean
    if (value === true || value === 'true' || value === 1) return true;
    if (value === false || value === 'false' || value === 0) return false;
    return null;
  }
  
  // Special handling for description_status - normalize case
  if (fieldName === 'description_status') {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
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

/**
 * Generate an exportable report from comparison results
 * Returns CSV string and triggers download
 */
export function exportComparisonReport(comparison, gymName = 'All Gyms', eventType = 'All Types') {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `sync-report-${gymName.replace(/\s+/g, '-')}-${timestamp}.csv`;
  
  // Build CSV rows
  const rows = [];
  
  // Header
  rows.push(['Status', 'Title', 'Gym', 'Date', 'Time', 'Type', 'Price', 'Ages', 'Changed Fields', 'Reason'].join(','));
  
  // NEW events
  comparison.new.forEach(ev => {
    rows.push([
      'NEW',
      `"${(ev.title || '').replace(/"/g, '""')}"`,
      `"${(ev.gym_name || '').replace(/"/g, '""')}"`,
      ev.date || '',
      `"${(ev.time || '').replace(/"/g, '""')}"`,
      ev.type || '',
      ev.price || '',
      ev.age_min && ev.age_max ? `${ev.age_min}-${ev.age_max}` : '',
      '',
      'New event - not in database'
    ].join(','));
  });
  
  // CHANGED events
  comparison.changed.forEach(item => {
    const ev = item.incoming || item;
    const changes = item._changes || [];
    const changedFieldsList = changes.map(c => `${c.field}: "${c.old}" → "${c.new}"`).join('; ');
    
    rows.push([
      item._wasDeleted ? 'RESTORED' : 'CHANGED',
      `"${(ev.title || '').replace(/"/g, '""')}"`,
      `"${(ev.gym_name || '').replace(/"/g, '""')}"`,
      ev.date || '',
      `"${(ev.time || '').replace(/"/g, '""')}"`,
      ev.type || '',
      ev.price || '',
      ev.age_min && ev.age_max ? `${ev.age_min}-${ev.age_max}` : '',
      `"${changedFieldsList.replace(/"/g, '""')}"`,
      item._wasDeleted ? 'Restored from deleted' : 'Data changed'
    ].join(','));
  });
  
  // DELETED events
  comparison.deleted.forEach(ev => {
    rows.push([
      'DELETED',
      `"${(ev.title || '').replace(/"/g, '""')}"`,
      `"${(ev.gym_name || '').replace(/"/g, '""')}"`,
      ev.date || '',
      `"${(ev.time || '').replace(/"/g, '""')}"`,
      ev.type || '',
      ev.price || '',
      ev.age_min && ev.age_max ? `${ev.age_min}-${ev.age_max}` : '',
      '',
      'No longer in source - will be soft-deleted'
    ].join(','));
  });
  
  // Create CSV content
  const csvContent = rows.join('\n');
  
  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return {
    filename,
    rowCount: rows.length - 1, // Exclude header
    summary: {
      new: comparison.new.length,
      changed: comparison.changed.length,
      deleted: comparison.deleted.length
    }
  };
}

