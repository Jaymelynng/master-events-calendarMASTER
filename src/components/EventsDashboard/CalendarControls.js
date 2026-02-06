// ============================================================================
// CALENDAR CONTROLS - Month navigation, view toggles, and filters
// ============================================================================
import React from 'react';
import { ChevronLeft, ChevronRight, Search, List, Grid, Plus } from 'lucide-react';
import { theme } from './constants';

export default function CalendarControls({
  currentMonth,
  currentYear,
  onPreviousMonth,
  onNextMonth,
  calendarView,
  onCalendarViewChange,
  viewMode,
  onViewModeToggle,
  selectedGym,
  onGymChange,
  selectedEventType,
  onEventTypeChange,
  searchTerm,
  onSearchChange,
  gymsList,
  eventTypesFromEvents,
  onAddEvent
}) {
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

      {/* All Controls in One Row */}
      <div className="flex justify-center items-end gap-3 mb-2">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Gym:</label>
          <select
            value={selectedGym}
            onChange={(e) => onGymChange(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white shadow-sm min-w-[140px]"
          >
            <option value="all">All Gyms</option>
            {gymsList.map(gym => (
              <option key={gym.id} value={gym.name}>{gym.name}</option>
            ))}
          </select>
        </div>

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

      {/* Event Types - All Filter Buttons */}
      <div className="flex justify-center items-center gap-2 mb-2">
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

        <button
          onClick={() => onEventTypeChange('CLINIC')}
          className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
            selectedEventType === 'CLINIC' ? 'border-purple-400 shadow-md' : 'border-transparent'
          }`}
          style={{ backgroundColor: '#F3E8FF' }}
        >
          CLINIC
        </button>

        <button
          onClick={() => onEventTypeChange('KIDS NIGHT OUT')}
          className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
            selectedEventType === 'KIDS NIGHT OUT' ? 'border-pink-400 shadow-md' : 'border-transparent'
          }`}
          style={{ backgroundColor: '#FFCCCB' }}
        >
          KNO
        </button>

        <button
          onClick={() => onEventTypeChange('OPEN GYM')}
          className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
            selectedEventType === 'OPEN GYM' ? 'border-green-400 shadow-md' : 'border-transparent'
          }`}
          style={{ backgroundColor: '#C8E6C9' }}
        >
          OPEN GYM
        </button>

        <button
          onClick={() => onEventTypeChange('CAMP')}
          className={`flex items-center gap-1 px-3 py-1 rounded cursor-pointer border transition-all text-sm ${
            selectedEventType === 'CAMP' ? 'border-yellow-400 shadow-md' : 'border-transparent'
          }`}
          style={{ backgroundColor: '#fde685' }}
        >
          CAMP
        </button>
      </div>
    </div>
  );
}

// Calendar View Toggle Buttons (Days 1-15, Days 16-30, Full Month, Weeks)
export function CalendarViewToggle({
  calendarView,
  onCalendarViewChange,
  theme
}) {
  return (
    <div className="text-center mb-2">
      <h3 className="text-base font-semibold mb-2" style={{ color: theme.colors.textPrimary }}>
        Calendar View:
      </h3>

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
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded-full border border-red-700 inline-block"></span>
          Data Error
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-orange-400 rounded-full border border-orange-600 inline-block"></span>
          Formatting
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full border border-red-700 inline-block"></span>
          <span className="w-2 h-2 bg-orange-400 rounded-full border border-orange-600 inline-block -ml-1.5"></span>
          Both
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
          Flyer Only
        </span>
      </div>
    </div>
  );
}
