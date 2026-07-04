// ============================================================================
// CALENDAR GRID - The main calendar view showing events by gym and date
// ============================================================================
import React from 'react';
import EventCard from './EventCard';
import CampBand from './CampBand';
import { theme, gymColors, multiDayEventTypes } from './constants';
import { groupCampEventsForDisplay, eventFallsOnDate } from './utils';

// Camps go to the CampBand below the day-cells row; everything else
// (KNO, OPEN GYM, CLINIC, SPECIAL EVENT) renders in the day cells as before.
const isCampType = (e) => multiDayEventTypes.includes((e.type || e.event_type || '').toUpperCase());

export default function CalendarGrid({
  displayDates,
  allGymsFromList,
  gymsList,
  filteredEvents,
  eventTypes,
  currentMonth,
  currentYear,
  calendarRef,
  gymRefs,
  selectedEventForPanel,
  onEventSelect,
  errorFocus = false
}) {
  return (
    <div className={`mx-2 mb-20 pb-20 transition-all duration-300 ${selectedEventForPanel ? 'mr-[400px]' : ''}`}>
      <div ref={calendarRef} className="w-full overflow-x-auto overflow-y-visible rounded-xl shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        <div className="min-w-full pb-8">
          {/* Calendar Header */}
          <div
            className="grid sticky top-0 z-50 border-b-2 shadow-lg"
            style={{
              gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)`,
              backgroundColor: theme.colors.secondary,
              borderColor: theme.colors.primary
            }}
          >
            {/* Gym Header */}
            <div className="p-2 font-bold text-center border-r-2" style={{ borderColor: theme.colors.primary }}>
              Gym
            </div>

            {/* Date Headers */}
            {displayDates.map(date => (
              <div key={date} className="p-2 text-center font-medium border-r border-gray-200 min-w-0">
                <div className="text-sm font-bold">{date}</div>
                <div className="text-xs text-gray-600">
                  {new Date(currentYear, currentMonth, date).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Body — divide-y removed; each gym row gets its own
              explicit borderBottom because the 1px gray divider was
              invisible against the brand-pink GymCell. */}
          <div className="relative">
            {allGymsFromList.map(gym => {
              // Find the gym data to get both name and id (gym code like "CRR")
              const gymData = gymsList.find(g => g.name === gym);
              const gymId = gymData?.id;

              // Match events by gym_name, gym_code, OR gym_id
              const gymEvents = filteredEvents.filter(e =>
                (e.gym_name || e.gym_code) === gym ||
                e.gym_id === gymId
              );

              // Split: camps render as horizontal bars in the band below;
              // everything else stays in the day cells.
              const gymCampEvents = gymEvents.filter(isCampType);
              const gymNonCampEvents = gymEvents.filter(e => !isCampType(e));
              const hasCamps = gymCampEvents.length > 0;

              return (
                <div
                  key={gym}
                  ref={el => gymRefs.current[gym] = el}
                  className="grid hover:bg-gray-50 transition-colors"
                  style={{
                    gridTemplateColumns: `100px repeat(${displayDates.length}, 1fr)`,
                    // Strong row separator that's visible against BOTH the
                    // brand-pink GymCell (left col) AND the white day cells.
                    // Brand-tinted dusty rose (theme.colors.primary at low
                    // opacity-feel) so it reads as part of the calendar's
                    // visual language, not a generic gray line.
                    borderBottom: '2px solid #c5b4b4',
                  }}
                >
                  {/* Gym Logo Column — spans both rows when there are camps so
                      its background covers col 1 across the camp band too. */}
                  <GymCell
                    gym={gym}
                    gymData={gymData}
                    gymId={gymId}
                    gymEvents={gymEvents}
                    gridRow={hasCamps ? '1 / 3' : undefined}
                  />

                  {/* Date Columns (single-day events only) */}
                  {displayDates.map(date => (
                    <DateCell
                      key={`${gym}-${date}`}
                      date={date}
                      gymEvents={gymNonCampEvents}
                      currentMonth={currentMonth}
                      currentYear={currentYear}
                      eventTypes={eventTypes}
                      onEventSelect={onEventSelect}
                      errorFocus={errorFocus}
                    />
                  ))}

                  {/* Camp Band (only renders when this gym has camps in view) */}
                  {hasCamps && (
                    <CampBand
                      campEvents={gymCampEvents}
                      displayDates={displayDates}
                      currentYear={currentYear}
                      currentMonth={currentMonth}
                      onEventSelect={onEventSelect}
                      errorFocus={errorFocus}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Gym cell with logo/badge
function GymCell({ gym, gymData, gymId, gymEvents, gridRow }) {
  const logoUrl = gymData?.logo_url;

  return (
    <div
      className="p-2 font-medium border-r-2 flex flex-col items-center justify-center gap-1"
      style={{
        borderColor: theme.colors.primary,
        gridRow,
        // Brand-tinted bg so the gym column visually anchors each row.
        // Matches the calendar header's pink, creating an L-shape of brand
        // identity (top header + left column).
        backgroundColor: theme.colors.secondary,
        // Soft outward shadow on the right edge gives the gym cell visual
        // depth without competing with event content.
        boxShadow: '3px 0 5px -2px rgba(140, 100, 100, 0.18)',
      }}
      title={`${gym} - ${gymEvents.length} event${gymEvents.length !== 1 ? 's' : ''}`}
    >
      <div className="cursor-help flex flex-col items-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={gym}
            className="w-10 h-10 rounded-full object-cover shadow-md border-2 border-white"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md"
            style={{ backgroundColor: gymColors[gymId] || theme.colors.accent }}
          >
            {gymId || gym.substring(0, 2).toUpperCase()}
          </div>
        )}
        {/* Gym Abbreviation Below Logo */}
        <div className="text-xs text-gray-700 font-bold mt-1">
          {gymId || gym.substring(0, 3).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// Individual date cell with events
function DateCell({ date, gymEvents, currentMonth, currentYear, eventTypes, onEventSelect, errorFocus }) {
  // Filter events that fall on this date
  const dateEvents = gymEvents.filter(event =>
    eventFallsOnDate(event, date, currentYear, currentMonth, multiDayEventTypes)
  );

  // Group camp events for display
  const displayEvents = groupCampEventsForDisplay(dateEvents);

  return (
    <div className="p-1 border-r border-gray-200 min-h-[100px] relative">
      {/* Day indicator */}
      <div
        className="absolute top-1 left-1 text-xs font-bold opacity-50 bg-white rounded px-1"
        style={{ color: theme.colors.textPrimary, fontSize: '10px', zIndex: 10 }}
      >
        {date}
      </div>

      <div className="space-y-1 pt-1">
        {displayEvents.length > 0 ? (
          displayEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              eventTypes={eventTypes}
              onClick={onEventSelect}
              errorFocus={errorFocus}
            />
          ))
        ) : (
          <div className="text-xs text-gray-400 p-1">
            {/* Empty */}
          </div>
        )}
      </div>
    </div>
  );
}
