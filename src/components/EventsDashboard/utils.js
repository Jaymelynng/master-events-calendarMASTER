// ============================================================================
// UTILITY FUNCTIONS - Helper functions used across the Events Dashboard
// ============================================================================

/**
 * Parse a YYYY-MM-DD date string as LOCAL time (not UTC)
 * This prevents the "off by one day" bug when dates shift due to timezone
 */
export const parseYmdLocal = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format time string for display (e.g., "6:30 PM - 9:00 PM")
 */
export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr;
};

/**
 * Format time string in short format (e.g., "6:30p")
 */
export const formatTimeShort = (timeStr) => {
  if (!timeStr) return '';

  // Already short format
  if (timeStr.length < 10) return timeStr;

  // Try to extract just the start time and shorten it
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/);
  if (match) {
    const hour = match[1];
    const minutes = match[2] || '00';
    const period = match[3] ? match[3].toLowerCase().charAt(0) : '';

    if (minutes === '00') {
      return `${hour}${period}`;
    }
    return `${hour}:${minutes}${period}`;
  }

  return timeStr;
};

/**
 * Get dates to display based on calendar view selection
 */
export const getDisplayDates = (calendarView, currentYear, currentMonth) => {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  switch (calendarView) {
    case 'firstHalf':
      return allDates.filter(d => d <= 15);
    case 'secondHalf':
      return allDates.filter(d => d > 15);
    case 'week1':
      return allDates.filter(d => d >= 1 && d <= 7);
    case 'week2':
      return allDates.filter(d => d >= 8 && d <= 14);
    case 'week3':
      return allDates.filter(d => d >= 15 && d <= 21);
    case 'week4':
      return allDates.filter(d => d >= 22);
    case 'full':
    default:
      return allDates;
  }
};

/**
 * Generate month options for dropdowns (current month ± range)
 */
export const generateMonthOptions = (monthsBefore = 3, monthsAfter = 6) => {
  const options = [];
  const now = new Date();

  for (let i = -monthsBefore; i <= monthsAfter; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }

  return options;
};

/**
 * Group camp events for display (consolidates same-day camps)
 */
export const groupCampEventsForDisplay = (events) => {
  const campGroups = new Map();
  const regularEvents = [];

  events.forEach(event => {
    if (event.type === 'CAMP') {
      // Group ALL camps by gym + date
      const eventDate = event.date;
      const groupKey = `${event.gym_id}-CAMP-${eventDate}`;

      if (!campGroups.has(groupKey)) {
        campGroups.set(groupKey, []);
      }
      campGroups.get(groupKey).push(event);
    } else {
      regularEvents.push(event);
    }
  });

  // Convert groups to consolidated display events
  const consolidatedCamps = [];
  campGroups.forEach((groupEvents, key) => {
    if (groupEvents.length === 1) {
      // Single option - show as-is
      consolidatedCamps.push({ ...groupEvents[0], isGrouped: false, groupedEvents: null });
    } else {
      // Multiple options - create consolidated event
      consolidatedCamps.push({
        ...groupEvents[0],
        isGrouped: true,
        groupedEvents: groupEvents,
        optionCount: groupEvents.length
      });
    }
  });

  return [...consolidatedCamps, ...regularEvents.map(e => ({ ...e, isGrouped: false, groupedEvents: null }))];
};

/**
 * Extract actual end date from event title if database end_date is wrong
 */
export const getActualEndDate = (event, parseYmdLocalFn) => {
  const title = event.title || '';

  // Pattern: "11/24 - 11/26" or "11/24-11/26"
  const dateRangeMatch = title.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
  if (dateRangeMatch) {
    const [, , , endMonth, endDay] = dateRangeMatch; // We only need endMonth and endDay
    const year = parseYmdLocalFn(event.start_date).getFullYear();
    return new Date(year, parseInt(endMonth) - 1, parseInt(endDay));
  }

  // Pattern: "March 16th-20th" (same month, different days)
  const sameMonthMatch = title.match(/(\d{1,2})(?:st|nd|rd|th)-(\d{1,2})(?:st|nd|rd|th)/);
  if (sameMonthMatch) {
    const [, , endDay] = sameMonthMatch; // We only need endDay
    const startDate = parseYmdLocalFn(event.start_date);
    return new Date(startDate.getFullYear(), startDate.getMonth(), parseInt(endDay));
  }

  // Fallback to database end_date
  return event.end_date ? parseYmdLocalFn(event.end_date) : parseYmdLocalFn(event.start_date);
};

/**
 * Check if an event falls on a specific date (handles multi-day events)
 */
export const eventFallsOnDate = (event, date, currentYear, currentMonth, multiDayTypes) => {
  if (!event.date) return false;

  const isMultiDayType = multiDayTypes.includes((event.type || '').toUpperCase());

  // For multi-day events (camps), check if date falls within range
  if (isMultiDayType && event.start_date && event.end_date) {
    const currentDate = new Date(currentYear, currentMonth, date);
    const startDate = parseYmdLocal(event.start_date);
    const endDate = getActualEndDate(event, parseYmdLocal);

    // Only treat as multi-day if start and end are actually different
    if (startDate.getTime() !== endDate.getTime()) {
      return currentDate >= startDate && currentDate <= endDate;
    }
  }

  // For single-day events, match by exact date
  const eventDate = parseYmdLocal(event.date);
  return eventDate.getFullYear() === currentYear &&
         eventDate.getMonth() === currentMonth &&
         eventDate.getDate() === date;
};

/**
 * Parse activity and duration from camp event title
 */
export const parseCampOptionFromTitle = (title) => {
  let icon = '📋';
  let label = '';

  // Detect activity from title content
  if (title.includes('Gymnastics') || title.includes('Girls Gymnastics')) {
    icon = '🤸';
    label = title.includes('Girls') ? 'Girls Gymnastics' : 'Gymnastics';
  } else if (title.includes('Ninja')) {
    icon = '🥷';
    if (title.includes('Co-ed')) label = 'Co-ed Ninja';
    else if (title.includes('Warrior')) label = 'Ninja Warrior';
    else if (title.includes('Parkour')) label = 'Parkour & Ninja';
    else if (title.includes('COED')) label = 'COED Ninja';
    else label = 'Ninja';
  }

  // Add duration if detected
  if (title.includes('Full Day') || title.includes('FULL DAY')) {
    label = label ? `${label} - Full Day` : 'Full Day';
  } else if (title.includes('Half Day') || title.includes('HALF DAY')) {
    label = label ? `${label} - Half Day` : 'Half Day';
  }

  // If still no label, use first part of title
  if (!label) {
    const parts = title.split('|');
    label = parts[0].trim();
  }

  return { icon, label };
};
