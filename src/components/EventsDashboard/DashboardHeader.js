// ============================================================================
// DASHBOARD HEADER - Top section with title, stats, and month navigation
// ============================================================================
import React, { useRef } from 'react';
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
  setShowAuditHistory,
  eventTypes = [],
  monthlyRequirements = {},
}) {
  // ONE strip instead of a 460px band of six cards.
  //
  // What was there: title, subtitle, timestamp, month nav, then "Total Events /
  // Active Gyms / Requirements Met" as three cards, then "Clinics / Kids Night
  // Out / Open Gym" as three more. Six cards, three words each, and the month
  // was repeated twice more further down the page.
  //
  // What changed and why:
  //   - "Requirements Met 9/14" was a number you cannot act on. It is now
  //     "N gyms short", and clicking it takes you to them.
  //   - Each tracked type shows its count AND its goal on one chip, so
  //     "20 Clinics" and "goal 1" stop living in two separate widgets saying
  //     different things about the same word.
  //   - Total Events and Active Gyms are one line of text, not two cards.
  //
  // Every chip is still a filter button, exactly as before.
  const short = allGyms.filter(gym => getMissingEventTypes(gym).length > 0);

  const tracked = (eventTypes || []).filter(t => t.is_tracked);
  const chips = (tracked.length
    ? tracked.map(t => ({ name: t.name, label: t.display_name || t.name, color: t.color }))
    : Object.keys(monthlyRequirements).map(n => ({ name: n, label: n, color: null })));

  return (
    <div className="w-full mb-3 px-5 py-3 rounded-2xl shadow-xl" style={{ backgroundColor: '#b48f8f' }}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

        {/* Month — the one and only month control on the page */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { onPreviousMonth(); setCalendarView('full'); }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-gray-800 hover:bg-white transition"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="px-4 py-1.5 rounded-full bg-white text-gray-900 text-lg font-bold whitespace-nowrap">
            {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h1>
          <button
            onClick={() => { onNextMonth(); setCalendarView('full'); }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-gray-800 hover:bg-white transition"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Count + goal on the SAME chip, so one word means one thing */}
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(c => {
            const have = events.filter(e => e.type === c.name).length;
            const goal = monthlyRequirements[c.name];
            return (
              <button
                key={c.name}
                onClick={() => { setSelectedEventType(c.name); setViewMode('calendar'); }}
                className="flex items-baseline gap-1.5 rounded-full bg-white/95 px-3 py-1.5 hover:bg-white transition"
                title={`Show only ${c.name}`}
              >
                <span className="text-base font-black" style={{ color: c.color || '#2a2030' }}>{have}</span>
                <span className="text-xs font-semibold text-gray-700">{c.label}</span>
                {goal ? <span className="text-[10px] text-gray-500">goal {goal}/gym</span> : null}
              </button>
            );
          })}
        </div>

        {/* The one number worth acting on */}
        <button
          onClick={() => setViewMode('table')}
          className="ml-auto flex items-center gap-2 rounded-full px-4 py-1.5 font-bold transition hover:brightness-105"
          style={{
            backgroundColor: short.length ? '#8f4a55' : '#4f7d5c',
            color: '#fff',
          }}
          title={short.length ? short.join(', ') : 'Every gym has met its monthly requirements'}
        >
          {short.length
            ? <>{short.length} gym{short.length === 1 ? '' : 's'} short <span className="opacity-70">→</span></>
            : <>All {allGyms.length} gyms complete</>}
        </button>

        {/* Was two cards. Now a line of text. Ctrl+click still opens audit history. */}
        <div
          className="text-xs text-white/85 whitespace-nowrap cursor-default select-none"
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); loadAuditHistory(); setShowAuditHistory(true); }
          }}
          title="Ctrl+Click for audit history"
        >
          {events.length} events · {uniqueGymsWithEvents.length} of {allGyms.length} gyms active
        </div>
      </div>
    </div>
  );
}

// Sync and Export buttons
export function ActionButtons({
  onOpenAdminPortal,
  onOpenExportModal
}) {
  // Long-press to open Admin on touch devices (Shift+Click on desktop still works).
  // Threshold: 600ms — comfortable hold without accidental triggers.
  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const startWandPress = () => {
    longPressFiredRef.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenAdminPortal();
    }, 600);
  };
  const cancelWandPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

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

      {/* Magic Wand - Admin Dashboard
          Desktop: Shift+Click. Mobile/touch: long-press (600ms hold). */}
      <button
        onClick={(e) => {
          // Suppress click if long-press already opened admin
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          if (e.shiftKey) {
            onOpenAdminPortal();
          }
        }}
        onPointerDown={startWandPress}
        onPointerUp={cancelWandPress}
        onPointerLeave={cancelWandPress}
        onPointerCancel={cancelWandPress}
        onContextMenu={(e) => e.preventDefault()}
        className="flex items-center justify-center w-10 h-10 bg-white rounded-lg border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group opacity-70 hover:opacity-100 hover:scale-105 active:scale-95 select-none"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
        title="🔐 Shift+Click (desktop) or long-press (mobile) for Admin Dashboard"
      >
        <span className="text-xl group-hover:scale-125 transition-transform pointer-events-none">🪄</span>
      </button>
    </div>
  );
}
