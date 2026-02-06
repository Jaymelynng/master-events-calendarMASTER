// ============================================================================
// EVENTS DASHBOARD - Component Index
// ============================================================================
// This file exports all components from the EventsDashboard folder
// Making imports cleaner elsewhere in the app
// ============================================================================

// Main hook
export { default as useEventsDashboard } from './useEventsDashboard';

// Constants and utilities
export * from './constants';
export * from './utils';

// Components
export { default as EventCard } from './EventCard';
export { default as CalendarGrid } from './CalendarGrid';
export { default as TableView } from './TableView';
export { default as EventDetailPanel } from './EventDetailPanel';
export { default as CalendarControls, CalendarViewToggle, CalendarLegend } from './CalendarControls';
export { default as DashboardHeader, ActionButtons } from './DashboardHeader';
export { default as BulkPortalOpener } from './BulkPortalOpener';
export { default as MonthlyRequirementsTable } from './MonthlyRequirementsTable';
