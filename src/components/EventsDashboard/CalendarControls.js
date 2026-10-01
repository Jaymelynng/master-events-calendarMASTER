// ============================================================================
// CALENDAR CONTROLS - Month navigation, view toggles, and filters
// ============================================================================
import React from 'react';
import { ChevronLeft, ChevronRight, Search, List, Grid, Plus } from 'lucide-react';
import { theme, gymColors, getEventTypeColor } from './constants';

// Long bucket names get a short chip label; everything else shows as-is.
const CHIP_LABELS = { 'KIDS NIGHT OUT': 'KNO' };
const chipLabel = (t) => CHIP_LABELS[t] || t;

export default function CalendarControls({
  currentMonth,
  currentYear,
  onPreviousMonth,
  onNextMonth,
  calendarView,
  onCalendarViewChange,
  viewMode,
  onViewModeToggle,
  selectedGyms = [],
  onGymsChange,
  selectedEventType,
  onEventTypeChange,
  searchTerm,
  onSearchChange,
  gymsList,
  eventTypesFromEvents,
  eventTypes = [],
  onAddEvent
}) {
  // No gym picked means every gym is showing.
  const allPicked = selectedGyms.length === 0;
  const toggleGym = (name) => {
    const next = selectedGyms.includes(name)
      ? selectedGyms.filter(n => n !== name)
      : [...selectedGyms, name];
    // Picking every gym one by one is the same as "all".
    onGymsChange(next.length === gymsList.length ? [] : next);
  };
  // Every bucket that exists, ordered: the scored ones first, then the rest.
  // Falls back to whatever types the loaded events actually have, so the row is
  // never empty even before event_types loads.
  const chipTypes = (eventTypes && eventTypes.length)
    ? [...eventTypes]
        .sort((a, b) => (b.is_tracked === true) - (a.is_tracked === true)
          || (a.name || '').localeCompare(b.name || ''))
        .map(t => t.name)
        .filter(Boolean)
    : eventTypesFromEvents;

  return (
    <div className="mb-2 space-y-2">
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <button
          onClick={onPreviousMonth}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <h2 className="text-lg font-bold px-4 py-1 rounded-full text-white shadow-md"
            style={{ backgroundColor: theme.colors.accent }}>
          {new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          })}
        </h2>

        <button
          onClick={onNextMonth}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-white transition-all duration-200 hover:scale-105 hover:shadow-md text-sm"
          style={{ backgroundColor: theme.colors.primary }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ADD EVENT - Centered Under Header */}
      <div className="flex justify-center mb-2">
        <button
          onClick={onAddEvent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 shadow-md font-medium text-sm"
          style={{
            backgroundColor: theme.colors.primary,
            color: 'white'
          }}
        >
          <Plus className="w-4 h-4" />
          ADD EVENT
        </button>
      </div>

      {/* Gym picker - every gym's logo in one row. Click any number of them;
          only those gyms show on the calendar, and the type chips, search and
          view buttons below all act on that same set. None picked = all gyms. */}
      <div className="flex justify-center items-start gap-1.5 flex-wrap mb-3">
        <button
          onClick={() => onGymsChange([])}
          className="flex flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all hover:shadow-md"
          style={{
            cursor: 'pointer', minWidth: 60, height: 76,
            backgroundColor: allPicked ? theme.colors.primary : '#ffffff',
            color: allPicked ? '#ffffff' : '#2b2224',
            border: `2px solid ${theme.colors.primary}`,
          }}
          title="Show every gym"
        >
          <span className="font-black" style={{ fontSize: 16 }}>ALL</span>
          <span className="font-bold" style={{ fontSize: 15 }}>{gymsList.length}</span>
        </button>
        {[...gymsList].sort((a, b) => (a.id || '').localeCompare(b.id || '')).map(gym => {
          const picked = selectedGyms.includes(gym.name);
          const dim = !allPicked && !picked;
          return (
            <button
              key={gym.id}
              onClick={() => toggleGym(gym.name)}
              className="flex flex-col items-center justify-center rounded-xl px-1.5 py-1.5 transition-all hover:shadow-md"
              style={{
                cursor: 'pointer', minWidth: 60, height: 76,
                backgroundColor: picked ? theme.colors.secondary : '#ffffff',
                border: `2px solid ${picked ? theme.colors.primary : '#e5dcdc'}`,
                boxShadow: picked ? '0 2px 8px rgba(140, 100, 100, 0.35)' : 'none',
              }}
              title={picked ? `${gym.name} - click to remove` : `${gym.name} - click to show`}
            >
              {gym.logo_url ? (
                <img
                  src={gym.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                  style={{ opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(1)' : 'none' }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: gymColors[gym.id] || theme.colors.accent, opacity: dim ? 0.35 : 1, fontSize: 15 }}
                >
                  {(gym.id || '').substring(0, 2)}
                </div>
              )}
              <span className="font-black" style={{ fontSize: 15, color: '#2b2224' }}>{gym.id}</span>
            </button>
          );
        })}
      </div>

      {/* All Controls in One Row */}
      <div className="flex justify-center items-end gap-3 mb-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Category:</label>
          <select
            value={selectedEventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm min-w-[140px]"
          >
            <option value="all">All Events</option>
            {eventTypesFromEvents.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm w-48"
          />
        </div>

        <button
          onClick={onViewModeToggle}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border hover:bg-gray-50 transition-colors shadow-sm"
        >
          {viewMode === 'calendar' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          {viewMode === 'calendar' ? 'Table View' : 'Calendar View'}
        </button>
      </div>

      {/* Event Types - one chip per bucket, straight from the event_types table.
          Add a bucket on the admin side and its chip appears here on its own -
          nothing to hardcode. Buckets that aren't scored (CAMP CARE, SPECIALTY,
          UNSORTED) still get a chip so Jayme can pull them up on the calendar. */}
      <div className="flex justify-center items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() => onEventTypeChange('all')}
          className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
            selectedEventType === 'all'
              ? 'border-gray-500 shadow-md bg-gray-100 font-semibold'
              : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          ALL
        </button>

        {chipTypes.map(type => (
          <button
            key={type}
            onClick={() => onEventTypeChange(type)}
            className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
              selectedEventType === type ? 'border-gray-600 shadow-md font-semibold' : 'border-transparent'
            }`}
            style={{ backgroundColor: getEventTypeColor(type, eventTypes) }}
            title={type}
          >
            {chipLabel(type)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Calendar View Toggle Buttons (Days 1-15, Days 16-30, Full Month, Weeks)
export function CalendarViewToggle({
  calendarView,
  onCalendarViewChange,
  theme,
  errorFocus,
  onErrorFocusToggle
}) {
  return (
    <div className="text-center mb-2">
      <h3 className="text-base font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
        Calendar View:
      </h3>

      {/* Errors focus toggle — flips the whole calendar between "show me the
          data (spots, etc.)" and "show me only what's wrong". */}
      <div className="flex justify-center mb-2">
        <button
          onClick={onErrorFocusToggle}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold text-white transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
          style={errorFocus
            ? { background: '#8b6f6f', boxShadow: '0 3px 10px rgba(139,111,111,.35)' }
            : { background: '#dc2626', boxShadow: '0 3px 10px rgba(220,38,38,.35)' }}
          title={errorFocus ? 'Go back to the normal calendar (events + spots)' : 'See only the events with errors'}
        >
          {errorFocus ? '📅 Switch to Calendar View' : '🚨 Switch to Error View'}
        </button>
      </div>

      {/* Main view buttons */}
      <div className="flex justify-center gap-2 mb-2">
        <button
          onClick={() => onCalendarViewChange('firstHalf')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            calendarView === 'firstHalf' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
          }`}
          style={calendarView === 'firstHalf' ? { backgroundColor: theme.colors.primary } : {}}
        >
          Days 1-15
        </button>
        <button
          onClick={() => onCalendarViewChange('secondHalf')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            calendarView === 'secondHalf' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
          }`}
          style={calendarView === 'secondHalf' ? { backgroundColor: theme.colors.primary } : {}}
        >
          Days 16-30
        </button>
        <button
          onClick={() => onCalendarViewChange('full')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            calendarView === 'full' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
          }`}
          style={calendarView === 'full' ? { backgroundColor: theme.colors.primary } : {}}
        >
          Full Month
        </button>
        {/* From today → end of month. Hides days already past in the current
            month; leaves other months in full. Full Month stays untouched. */}
        <button
          onClick={() => onCalendarViewChange('fromToday')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
            calendarView === 'fromToday' ? 'text-white shadow-lg' : 'text-gray-600 bg-white border hover:shadow-md'
          }`}
          style={calendarView === 'fromToday' ? { backgroundColor: theme.colors.primary } : {}}
          title="Show from today's date through the end of the month"
        >
          📍 Today → End of Month
        </button>
      </div>

      {/* Quick weeks */}
      <div className="flex justify-center items-center gap-2">
        <span className="text-sm text-gray-600 mr-2">Quick:</span>
        {['week1', 'week2', 'week3', 'week4'].map((week, index) => (
          <button
            key={week}
            onClick={() => onCalendarViewChange(week)}
            className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
              calendarView === week ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={calendarView === week ? { backgroundColor: theme.colors.accent } : {}}
          >
            Week {index + 1}{index === 3 ? '+' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// Calendar Legend showing what the colored dots mean
export function CalendarLegend({ theme }) {
  return (
    <div className="mt-4 text-xs text-center" style={{ color: theme.colors.textSecondary }}>
      <p>• Click any event card to open the side panel with full details and registration links</p>
      {/* Legend mirrors the actual corner dots in EventCard.js. "Formatting" /
          "Both" removed July 2026 (formatting errors never existed). AI review
          lives in the Errors tab, NOT the calendar — no dot here. */}
      <div className="mt-2 flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded-full border border-red-700 inline-block"></span>
          Data Error
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border-2 border-red-500 rounded-full inline-block bg-white"></span>
          No Description
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
          Flyer Only
        </span>
      </div>
    </div>
  );
}
