// ============================================================================
// SHARED CONSTANTS - Values used across the Events Dashboard
// ============================================================================
// This file extracts constants that were previously hardcoded in EventsDashboard.js
// Import from here instead of hardcoding values!
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
  'OPEN GYM': 4
};

// Event types that can span multiple days (only camps)
export const multiDayEventTypes = [
  'CAMP',
  'CAMPS',
  'SUMMER CAMP',
  'SUMMER CAMP - GYMNASTICS',
  'SUMMER CAMP - NINJA'
];
