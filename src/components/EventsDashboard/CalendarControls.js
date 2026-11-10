// ============================================================================
// CALENDAR CONTROLS - Month navigation, view toggles, and filters
// ============================================================================
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, List, Grid, Copy } from 'lucide-react';
import { theme, gymColors, getEventTypeColor } from './constants';

// Long bucket names get a short chip label; everything else shows as-is.
const CHIP_LABELS = { 'KIDS NIGHT OUT': 'KNO' };
const chipLabel = (t) => CHIP_LABELS[t] || t;

// Smallest a gym tile may get before the row breaks. Only a layout size - the gym list itself
// always comes from the gyms table, so this works for any number of gyms.
const GYM_TILE_MIN = 56;
const GYM_TILE_GAP = 6;

// Width of an element, kept current as the window or panel resizes.
// A callback ref, so it starts measuring whenever the element appears (not only on first mount).
function useWidth() {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return undefined;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width];
}

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
  onAddEvent,
  onCopyShown,
  shownCount = 0,
  portalView = 'both',
  onPortalViewChange,
  portalCounts = { on: 0, off: 0 },
  errorFocus = false,
  onErrorFocusToggle,
}) {
  const [copiedCount, setCopiedCount] = useState(null);
  const [gymRowRef, gymRowWidth] = useWidth();
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

      {/* (ADD EVENT button removed 2026-11-04: every event comes from the iClass sync - 0 of 507 were
           ever added by hand. Jayme: "ADD EVENT button makes zero sense why is that there?") */}

      {/* Gym picker - click any number of gym logos; only those gyms show on the calendar, and the
          type chips, search and view buttons below act on that same set. None picked = all gyms.
          Gym tiles share the rows EVENLY and fill the width, so a new gym never ends up alone on
          its own line (Jayme 2026-11-04: TIG sat by itself under 14 others). Fewest rows that fit,
          then the same number of tiles in each: 15 tiles on a laptop = one row; on a narrow
          screen = 8 + 7, never 14 + 1. The first tile is ALL; when gyms are picked it turns into
          the red "show all" tile - same click, one tile, so the row never shifts. */}
      {(() => {
        const sortedGyms = [...gymsList].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        const tiles = sortedGyms.length + 1;
        const perRow = gymRowWidth
          ? Math.max(1, Math.floor((gymRowWidth + GYM_TILE_GAP) / (GYM_TILE_MIN + GYM_TILE_GAP)))
          : tiles;
        const rows = Math.ceil(tiles / perRow);
        const cols = Math.ceil(tiles / rows);
        return (
          <div
            ref={gymRowRef}
            className="mb-3"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GYM_TILE_GAP }}
          >
            <button
              onClick={() => onGymsChange([])}
              className="flex flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all hover:shadow-md"
              style={{
                cursor: allPicked ? 'default' : 'pointer', height: 76, minWidth: 0,
                backgroundColor: allPicked ? theme.colors.primary : '#b91c1c',
                color: '#ffffff',
                border: `2px solid ${allPicked ? theme.colors.primary : '#b91c1c'}`,
                boxShadow: '0 2px 6px rgba(60, 40, 40, 0.25)',
              }}
              title={allPicked ? 'Every gym is showing' : 'Un-pick every gym and show them all'}
            >
              {allPicked ? (
                <>
                  <span className="font-black" style={{ fontSize: 16 }}>ALL</span>
                  <span className="font-bold" style={{ fontSize: 15 }}>{gymsList.length}</span>
                </>
              ) : (
                <>
                  <span className="font-black" style={{ fontSize: 14, lineHeight: 1.1 }}>✕ ALL</span>
                  <span className="font-bold" style={{ fontSize: 12, lineHeight: 1.2 }}>{selectedGyms.length} picked</span>
                </>
              )}
            </button>
            {sortedGyms.map(gym => {
              const picked = selectedGyms.includes(gym.name);
              const dim = !allPicked && !picked;
              return (
                <button
                  key={gym.id}
                  onClick={() => toggleGym(gym.name)}
                  className="flex flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all hover:shadow-md"
                  style={{
                    cursor: 'pointer', height: 76, minWidth: 0,
                    backgroundColor: picked ? theme.colors.secondary : '#ffffff',
                    border: `2px solid ${picked ? theme.colors.primary : '#e5dcdc'}`,
                    boxShadow: picked ? '0 2px 8px rgba(140, 100, 100, 0.35)' : '0 1px 3px rgba(60, 40, 40, 0.12)',
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
        );
      })()}

      {/* ONE control panel, two rows (Jayme 2026-11-10: "it's flat, it blends together, zero communication on
          what it does / what to do ... save vertical space but make it so visually I know what to do").
          Each job sits in its own labeled box: SHOW (category chips + search) · ON THE PORTAL? · DAYS · VIEW & COPY.
          The picked button in every box is dark plum with white text and lifts; the rest are raised white.
          The Category dropdown is gone - it repeated the chips (every fact once). Was 5 rows, now 2. */}
      <div
        className="rounded-2xl p-2.5 space-y-2"
        style={{ background: '#ffffff', border: `1px solid ${PANEL_EDGE}`, boxShadow: '0 10px 28px rgba(60,30,30,.16), 0 3px 8px rgba(60,30,30,.12)' }}
      >
        <div className="flex flex-wrap gap-2 items-stretch">
          <Group label="Show" grow>
            <Seg on={selectedEventType === 'all'} onClick={() => onEventTypeChange('all')} title="Every category">ALL</Seg>
            {chipTypes.map(type => {
              const on = selectedEventType === type;
              return (
                <button
                  key={type}
                  onClick={() => onEventTypeChange(type)}
                  aria-pressed={on}
                  title={type}
                  className="px-2.5 py-1 rounded-lg text-[13px] cursor-pointer transition-all hover:-translate-y-px hover:shadow-md"
                  style={{
                    backgroundColor: getEventTypeColor(type, eventTypes),
                    color: INK,
                    fontWeight: on ? 800 : 600,
                    boxShadow: on ? `0 0 0 3px ${PLUM}, 0 5px 12px rgba(74,51,54,.4)` : '0 1px 3px rgba(60,30,30,.28)',
                    transform: on ? 'translateY(-1px)' : 'none',
                  }}
                >
                  {on ? '✓ ' : ''}{chipLabel(type)}
                </button>
              );
            })}
            <div className="relative ml-1" style={{ minWidth: 150, flex: '1 1 150px', maxWidth: 230 }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: INK }} />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-2 py-1 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2"
                style={{ border: `1.5px solid ${PANEL_EDGE}`, color: INK, boxShadow: 'inset 0 1px 2px rgba(60,30,30,.12)' }}
              />
            </div>
          </Group>
          {onPortalViewChange && (
            <Group label="On the portal?">
              <PortalChips portalView={portalView} onPortalViewChange={onPortalViewChange} portalCounts={portalCounts} />
            </Group>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-stretch">
          {viewMode !== 'table' && onCalendarViewChange && (
            <Group label="Days" grow>
              {[['firstHalf', 'Days 1–15'], ['secondHalf', 'Days 16–30'], ['full', 'Full month'], ['fromToday', '📍 Today → end']].map(([k, l]) => (
                <Seg key={k} on={calendarView === k} onClick={() => onCalendarViewChange(k)}>{l}</Seg>
              ))}
              <span aria-hidden="true" className="mx-1 self-stretch" style={{ width: 2, background: PANEL_EDGE, borderRadius: 2 }} />
              {['week1', 'week2', 'week3', 'week4'].map((w, i) => (
                <Seg key={w} on={calendarView === w} onClick={() => onCalendarViewChange(w)}>Week {i + 1}{i === 3 ? '+' : ''}</Seg>
              ))}
            </Group>
          )}
          <Group label="View & copy" grow={viewMode === 'table'}>
            <button
              onClick={onViewModeToggle}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold cursor-pointer transition-all hover:-translate-y-px hover:shadow-md"
              style={{ background: '#ffffff', color: INK, boxShadow: '0 1px 3px rgba(60,30,30,.3)' }}
            >
              {viewMode === 'calendar' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              {viewMode === 'calendar' ? 'Table view' : 'Calendar view'}
            </button>
            {viewMode !== 'table' && onErrorFocusToggle && (
              <button
                onClick={onErrorFocusToggle}
                className="px-3 py-1 rounded-lg text-[13px] font-bold text-white cursor-pointer transition-all hover:-translate-y-px"
                style={errorFocus
                  ? { background: PLUM, boxShadow: '0 4px 10px rgba(74,51,54,.45)' }
                  : { background: '#c62828', boxShadow: '0 4px 10px rgba(198,40,40,.4)' }}
                title={errorFocus ? 'Go back to the normal calendar (events + spots)' : 'See only the events with errors'}
              >
                {errorFocus ? '📅 Back to calendar' : '🚨 Error view'}
              </button>
            )}
            {onCopyShown && (
              <button
                onClick={async () => {
                  const n = await onCopyShown();
                  if (n !== null && n !== undefined) {
                    setCopiedCount(n);
                    setTimeout(() => setCopiedCount(null), 2500);
                  }
                }}
                disabled={!shownCount}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold text-white transition-all hover:-translate-y-px disabled:opacity-40"
                style={{
                  cursor: shownCount ? 'pointer' : 'not-allowed',
                  background: copiedCount !== null ? '#15803d' : PLUM,
                  boxShadow: '0 4px 10px rgba(74,51,54,.4)',
                }}
                title="Copy every event on screen right now as a table — paste into email, Excel or Google Sheets"
              >
                <Copy className="w-4 h-4" />
                {copiedCount !== null ? `Copied ${copiedCount} ✓` : `Copy what's shown (${shownCount || 0})`}
              </button>
            )}
          </Group>
        </div>
      </div>
    </div>
  );
}

// The control panel's pieces: a labeled box per job, and the button inside it.
const INK = '#2b2224';
const PLUM = '#4a3336';
const PANEL_EDGE = '#d9c4c4';
function Group({ label, grow, children }) {
  return (
    <div
      className="rounded-xl px-2.5 pt-1.5 pb-2"
      style={{ background: '#ead8d8', border: `1px solid ${PANEL_EDGE}`, boxShadow: 'inset 0 1px 3px rgba(60,30,30,.16)', flex: grow ? '1 1 auto' : '0 0 auto', minWidth: 0 }}
    >
      <div className="uppercase mb-1" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.07em', color: INK }}>{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
function Seg({ on, onClick, title, dashed, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] cursor-pointer transition-all hover:-translate-y-px hover:shadow-md"
      style={on
        ? { background: PLUM, color: '#ffffff', fontWeight: 800, boxShadow: '0 4px 10px rgba(74,51,54,.45)', transform: 'translateY(-1px)' }
        : { background: '#ffffff', color: INK, fontWeight: 600, boxShadow: '0 1px 3px rgba(60,30,30,.3)', outline: dashed ? `1.5px dashed ${PLUM}` : 'none', outlineOffset: -2 }}
    >
      {children}
    </button>
  );
}

export function PortalChips({ portalView = 'both', onPortalViewChange, portalCounts = { on: 0, off: 0 } }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Portal filter">
      {[
        ['both', 'Both', portalCounts.on + portalCounts.off, 'Live events plus the faded not-on-portal camps'],
        ['on', 'On portal', portalCounts.on, 'Only events parents can see and book now'],
        ['off', 'Not on portal', portalCounts.off, 'Camps built in iClass that parents cannot see yet (the faded ones)'],
      ].map(([key, label, n, tip]) => (
        <Seg key={key} on={portalView === key} onClick={() => onPortalViewChange(key)} title={tip} dashed={key === 'off'}>
          {label} <span style={{ fontWeight: 800 }}>{n}</span>
        </Seg>
      ))}
    </div>
  );
}

// Calendar View Toggle Buttons (Days 1-15, Days 16-30, Full Month, Weeks)
export function CalendarViewToggle({
  calendarView,
  onCalendarViewChange,
  theme,
  errorFocus,
  onErrorFocusToggle,
  portalView,
  onPortalViewChange,
  portalCounts,
}) {
  return (
    <div className="text-center mb-2">
      {/* One row (Jayme 2026-11-10, "this can be one row to save vertical space"): the Portal filter +
          the Errors focus toggle, which flips the calendar between "show me the data (spots, etc.)" and
          "show me only what's wrong". The old "Calendar View:" heading is gone - the button says what it does. */}
      <div className="flex justify-center items-center gap-x-5 gap-y-2 mb-2 flex-wrap">
        {onPortalViewChange && (
          <PortalChips portalView={portalView} onPortalViewChange={onPortalViewChange} portalCounts={portalCounts} />
        )}
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
