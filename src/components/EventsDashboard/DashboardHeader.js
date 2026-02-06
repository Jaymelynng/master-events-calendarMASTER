// ============================================================================
// DASHBOARD HEADER - Top section with title, stats, and month navigation
// ============================================================================
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { theme } from './constants';

export default function DashboardHeader({
  currentMonth,
  currentYear,
  onPreviousMonth,
  onNextMonth,
  events,
  uniqueGymsWithEvents,
  allGyms,
  getMissingEventTypes,
  setViewMode,
  setSelectedGym,
  setSelectedEventType,
  setCalendarView,
  loadAuditHistory,
  setShowAuditHistory
}) {
  return (
    <div className="w-full mb-6 px-6 py-8 rounded-2xl shadow-2xl" style={{ backgroundColor: '#b48f8f' }}>
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
          ✨ Master Events Calendar ✨
        </h1>
        <p className="text-white text-lg opacity-90">All gyms special events in one place</p>

        {/* Secret audit history trigger - Ctrl+Click */}
        <div
          className="text-sm text-white opacity-70 mt-3 cursor-default select-none hover:opacity-100 transition-opacity"
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              loadAuditHistory();
              setShowAuditHistory(true);
            }
          }}
          title="Ctrl+Click for secret features"
        >
          {new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex justify-center items-center gap-6 mb-8">
        <button
          onClick={() => {
            onPreviousMonth();
            setCalendarView('full');
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-800 font-semibold transition-all duration-200 hover:scale-105 hover:shadow-xl min-w-[120px] justify-center"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex-shrink-0">
          <h2 className="text-3xl font-bold px-10 py-4 rounded-full bg-white text-gray-800 text-center whitespace-nowrap"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}>
            {new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric'
            })}
          </h2>
        </div>

        <button
          onClick={() => {
            onNextMonth();
            setCalendarView('full');
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-800 font-semibold transition-all duration-200 hover:scale-105 hover:shadow-xl min-w-[120px] justify-center"
          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dashboard Stats Cards - Row 1: General Stats */}
      <div className="flex gap-3 justify-center max-w-4xl mx-auto mb-4">
        <button
          onClick={() => setViewMode('calendar')}
          className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
            {events.length}
          </div>
          <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
            Total Events
          </div>
          <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
            This Month
          </div>
        </button>

        <button
          onClick={() => {
            setSelectedGym('all');
            setSelectedEventType('all');
            setViewMode('calendar');
          }}
          className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
            {uniqueGymsWithEvents.length}
          </div>
          <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
            Active Gyms
          </div>
          <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
            This Month
          </div>
        </button>

        <button
          onClick={() => setViewMode('table')}
          className="bg-white rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
        >
          <div className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>
            {allGyms.filter(gym => getMissingEventTypes(gym).length === 0).length}/{allGyms.length}
          </div>
          <div className="text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
            Requirements Met
          </div>
          <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
            This Month
          </div>
        </button>
      </div>

      {/* Dashboard Stats Cards - Row 2: Event Types */}
      <div className="flex gap-3 justify-center max-w-3xl mx-auto">
        <button
          onClick={() => {
            setSelectedEventType('CLINIC');
            setViewMode('calendar');
          }}
          className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ backgroundColor: '#e3f2fd', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
        >
          <div className="text-xl font-bold text-blue-800">
            {events.filter(e => e.type === 'CLINIC').length}
          </div>
          <div className="text-sm font-medium text-blue-700">Clinics</div>
          <div className="text-xs text-blue-600">This month</div>
        </button>

        <button
          onClick={() => {
            setSelectedEventType('KIDS NIGHT OUT');
            setViewMode('calendar');
          }}
          className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ backgroundColor: '#f3e8ff', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
        >
          <div className="text-xl font-bold text-purple-800">
            {events.filter(e => e.type === 'KIDS NIGHT OUT').length}
          </div>
          <div className="text-sm font-medium text-purple-700">Kids Night Out</div>
          <div className="text-xs text-purple-600">This month</div>
        </button>

        <button
          onClick={() => {
            setSelectedEventType('OPEN GYM');
            setViewMode('calendar');
          }}
          className="rounded-lg px-4 py-3 hover:shadow-2xl transition-all duration-200 text-center flex-1 min-w-[110px] hover:scale-105"
          style={{ backgroundColor: '#e8f5e9', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
        >
          <div className="text-xl font-bold text-green-800">
            {events.filter(e => e.type === 'OPEN GYM').length}
          </div>
          <div className="text-sm font-medium text-green-700">Open Gym</div>
          <div className="text-xs text-green-600">This month</div>
        </button>
      </div>
    </div>
  );
}

// Sync and Export buttons
export function ActionButtons({
  onOpenAdminPortal,
  onOpenExportModal
}) {
  return (
    <div className="flex justify-center items-center gap-4 mb-3">
      <button
        onClick={onOpenAdminPortal}
        style={{
          background: 'linear-gradient(180deg, #d4a5a5 0%, #c3a5a5 100%)',
          color: '#2a2a2a',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
          border: '2px solid #b38d8d',
          borderTopColor: '#e6c5c5',
          borderBottomColor: '#a87d7d',
          position: 'relative',
          overflow: 'hidden',
          textShadow: '0 1px 0 rgba(255, 255, 255, 0.3)'
        }}
        className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 text-base font-bold uppercase tracking-wide hover:scale-105 active:scale-95"
        title="Open Admin Control Center"
      >
        <span className="text-lg">🔄</span>
        <span>SYNC</span>
        {/* Sparkle overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
          pointerEvents: 'none'
        }} />
      </button>

      {/* Export Button */}
      <button
        onClick={onOpenExportModal}
        style={{
          background: 'linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
          border: '2px solid #2a2a2a',
          borderTopColor: '#6a6a6a',
          borderBottomColor: '#1a1a1a',
          position: 'relative',
          overflow: 'hidden'
        }}
        className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 text-base font-semibold uppercase tracking-wide hover:scale-105 active:scale-95"
        title="Export Events Data"
      >
        <span className="text-white text-lg">⬇️</span>
        <span>EXPORT</span>
        {/* Sparkle overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }} />
      </button>
    </div>
  );
}
