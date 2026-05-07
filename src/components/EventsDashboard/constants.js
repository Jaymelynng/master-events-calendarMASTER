// ============================================================================
// CONSTANTS - All the fixed values used across the Events Dashboard
// ============================================================================

// Theme colors used throughout the app
export const theme = {
  colors: {
    primary: '#b48f8f',      // Dusty rose - main brand color
    secondary: '#e6d5d5',    // Light pink - backgrounds
    accent: '#8b6f6f',       // Darker rose - emphasis
    background: '#faf5f5',   // Off-white pink tint
    textPrimary: '#2a2a2a',  // Near black
    textSecondary: '#666666' // Gray
  }
};

// Colors assigned to each gym for their badges
export const gymColors = {
  'CRR': '#e91e63',    // Pink
  'CAP': '#9c27b0',    // Purple
  'CSP': '#673ab7',    // Deep Purple
  'CPF': '#3f51b5',    // Indigo
  'CLC': '#2196f3',    // Blue
  'CGT': '#00bcd4',    // Cyan
  'CKT': '#009688',    // Teal
  'CHG': '#4caf50',    // Green
  'CWL': '#8bc34a',    // Light Green
  'CBR': '#ff9800',    // Orange
  'CSA': '#ff5722',    // Deep Orange
  'CMO': '#795548',    // Brown
};

// Static fallback colors. Used when an event_types DB row doesn't exist
// for the given type, OR when a caller doesn't pass eventTypes through.
// The PRIMARY source of truth is the event_types.color column in Supabase.
export const eventTypeColors = {
  'CLINIC': '#F3E8FF',       // Light purple (fallback)
  'KIDS NIGHT OUT': '#FFCCCB', // Light pink/coral (fallback)
  'OPEN GYM': '#C8E6C9',     // Light green (fallback)
  'CAMP': '#fde685',         // Light yellow (fallback)
  'SPECIAL EVENT': '#E3F2FD', // Light blue (fallback)
  'BOOKING': '#F5F5F5',      // Light gray (fallback)
};

// Convert a saturated hex (typical of event_types.color, e.g. #8B5CF6) into
// the soft pastel tint the calendar UI expects for backgrounds. Picks ~18%
// alpha over white so the resulting hex is readable on a light background.
const hexToPastelHex = (hex) => {
  if (!hex) return '#f0f0f0';
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  if (full.length !== 6) return hex; // already weird, return as-is
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Mix with white at ~82% white / 18% color for a soft tint
  const mix = (c) => Math.round(c * 0.18 + 255 * 0.82);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

// Get color for an event type. If `eventTypes` (DB rows) is provided AND
// contains a matching row with a color, use that. Otherwise fall back to
// the static eventTypeColors map. Returns a pastel-friendly hex suitable
// for backgrounds on light surfaces.
export const getEventTypeColor = (type, eventTypes = null) => {
  if (!type) return '#f0f0f0';
  const upperType = type.toUpperCase();

  if (eventTypes && Array.isArray(eventTypes)) {
    const dbRow = eventTypes.find(et => {
      const name = (et.name || et.event_type || '').toUpperCase();
      return name === upperType;
    });
    if (dbRow?.color) return hexToPastelHex(dbRow.color);
  }

  return eventTypeColors[upperType] || '#f0f0f0';
};

// Default monthly requirements per event type
export const defaultMonthlyRequirements = {
  'CLINIC': 1,
  'KIDS NIGHT OUT': 2,
  'OPEN GYM': 1
};

// Event types that can span multiple days (only camps)
export const multiDayEventTypes = ['CAMP', 'CAMPS', 'SUMMER CAMP', 'SUMMER CAMP - GYMNASTICS', 'SUMMER CAMP - NINJA'];

// Check if an event type can be multi-day
export const isMultiDayType = (type) => {
  if (!type) return false;
  return multiDayEventTypes.includes(type.toUpperCase());
};

// Calendar view options
export const calendarViews = {
  FULL: 'full',
  FIRST_HALF: 'firstHalf',
  SECOND_HALF: 'secondHalf',
  WEEK1: 'week1',
  WEEK2: 'week2',
  WEEK3: 'week3',
  WEEK4: 'week4'
};

// Error type labels for validation issues
export const errorTypeLabels = {
  // Data errors (mismatches between sources)
  'year_mismatch': '📅 Wrong Year in Title',
  'date_mismatch': '📅 Date/Month Mismatch',
  'time_mismatch': '🕐 Time Mismatch',
  'age_mismatch': '👶 Age Mismatch',
  'day_mismatch': '📅 Day of Week Mismatch',
  'program_mismatch': '🏷️ Program Type Mismatch',
  'skill_mismatch': '🎯 Skill Mismatch',
  'price_mismatch': '💰 Price Mismatch',
  'title_desc_mismatch': '📋 Title vs Description Conflict',
  // Camp pricing validation
  'camp_price_mismatch': '💰 Camp Price Mismatch',
  'event_price_mismatch': '💰 Event Price Mismatch',
  'camp_type_not_offered': '🏕️ Camp Type Not Offered',
  // Registration/availability (info, not errors)
  'registration_closed': '🔒 Registration Closed',
  'registration_not_open': '🔓 Registration Not Open Yet',
};

// Get friendly label for an error type
export const getErrorLabel = (type) => {
  return errorTypeLabels[type] || type;
};
