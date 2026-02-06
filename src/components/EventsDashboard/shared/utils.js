// ============================================================================
// SHARED UTILITIES - Helper functions used across the Events Dashboard
// ============================================================================
// These are pure functions that don't depend on React state
// They can be safely imported and used anywhere
// ============================================================================

/**
 * Parse a YYYY-MM-DD date string as LOCAL time (not UTC)
 * This prevents the "off by one day" bug when dates shift due to timezone
 *
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Date} - Date object in local time
 */
export const parseYmdLocal = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format time string for display
 * @param {string} timeStr - Time string
 * @returns {string} - Formatted time
 */
export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr;
};

/**
 * Format time string in short format (e.g., "6:30p" instead of "6:30 PM")
 * @param {string} timeStr - Time string
 * @returns {string} - Short formatted time
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
 * @param {string} calendarView - View type (full, firstHalf, secondHalf, week1-4)
 * @param {number} currentYear - Current year
 * @param {number} currentMonth - Current month (0-11)
 * @returns {number[]} - Array of day numbers to display
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
 * Generate month options for dropdowns
 * @param {number} monthsBefore - Months before current to include
 * @param {number} monthsAfter - Months after current to include
 * @returns {Array} - Array of {value, label} objects
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
