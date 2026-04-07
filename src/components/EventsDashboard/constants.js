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

// Event type colors for cards and badges
export const eventTypeColors = {
  'CLINIC': '#F3E8FF',       // Light purple
  'KIDS NIGHT OUT': '#FFCCCB', // Light pink/coral
  'OPEN GYM': '#C8E6C9',     // Light green
  'CAMP': '#fde685',         // Light yellow
  'SPECIAL EVENT': '#E3F2FD', // Light blue
  'BOOKING': '#F5F5F5',      // Light gray
};

// Get color for an event type (with fallback)
export const getEventTypeColor = (type) => {
  if (!type) return '#f0f0f0';
  const upperType = type.toUpperCase();
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
