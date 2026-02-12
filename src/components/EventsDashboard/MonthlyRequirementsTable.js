// ============================================================================
// MONTHLY REQUIREMENTS TABLE - Shows event counts vs requirements per gym
// ============================================================================
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { theme, getEventTypeColor } from './constants';
import { isErrorAcknowledgedAnywhere } from '../../lib/validationHelpers';

export default function MonthlyRequirementsTable({
  currentMonth,
  currentYear,
  onPreviousMonth,
  onNextMonth,
  allGyms,
  events,
  eventTypes,
  monthlyRequirements,
  gymLinks,
  scrollToGym,
  getGymLinkUrl,
  handleMagicControlClick,
  getEventCounts,
  acknowledgedPatterns = []
}) {
  const counts = getEventCounts();

  // Get missing event types for a gym
  const getMissingEventTypes = (gym) => {
    const missing = [];
    Object.keys(monthlyRequirements).forEach(eventType => {
      const requiredCount = monthlyRequirements[eventType];
      const currentCount = counts[gym]?.[eventType] || 0;
      if (currentCount < requiredCount) {
        const deficit = requiredCount - currentCount;
        const shortLabel = eventType === 'KIDS NIGHT OUT' ? 'KNO' : eventType;
        missing.push(`+${deficit} ${shortLabel}`);
      }
    });
    return missing;
  };

  // Count quality issues for a gym
  const getQualityIssues = (gym) => {
    const gymEvents = events.filter(e => {
      const eventDate = new Date(e.date);
      return e.gym_name === gym &&
             eventDate.getMonth() === currentMonth &&
             eventDate.getFullYear() === currentYear;
    });

    const errors = gymEvents.filter(e =>
      (e.validation_errors || []).some(err =>
        err.type !== 'sold_out' && !isErrorAcknowledgedAnywhere(e, err.message, acknowledgedPatterns)
      )
    ).length;

    const warnings = gymEvents.filter(e => e.description_status === 'flyer_only').length;
    const missing = gymEvents.filter(e => e.description_status === 'none').length;

    return errors + warnings + missing;
  };

  return (
    <div className="rounded-lg shadow-lg p-3 mb-2 mx-2" style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}>
      {/* Month Navigation */}
      <div className="flex justify-center items-center gap-4 mb-3">
        <button
          onClick={onPreviousMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium transition-all duration-200 hover:bg-gray-200 hover:scale-105"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold" style={{ color: theme.colors.textPrimary }}>
            {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        <button
          onClick={onNextMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium transition-all duration-200 hover:bg-gray-200 hover:scale-105"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-2">
        <h3 className="text-sm font-semibold" style={{ color: '#737373' }}>
          📊 Monthly Requirements
        </h3>
      </div>

      {/* Monthly Goal centered under title */}
      <div className="flex justify-center mb-2 text-xs">
        <div className="bg-gray-50 px-3 py-2 rounded border">
          <span className="font-semibold text-gray-700">Monthly Goal: </span>
          <span className="text-gray-600">
            {monthlyRequirements['CLINIC']} Clinic • {monthlyRequirements['KIDS NIGHT OUT']} KNO • {monthlyRequirements['OPEN GYM']} Open Gym
          </span>
        </div>
      </div>

      {/* Instructions - subtle, above table */}
      <div className="text-xs text-gray-500 text-center mb-2">
        📍 Gym → scroll | 🔢 Number → open page | ✨ Sparkle → open all
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead>
            <tr style={{ backgroundColor: '#8b6f6f' }}>
              <th className="p-2 border text-sm text-center font-bold text-white">Gym</th>
              {eventTypes.filter(et => et.is_tracked).map((eventType, i) => (
                <th key={i} className="p-2 border text-sm text-center font-bold text-white">
                  {eventType.display_name || eventType.name}
                </th>
              ))}
              <th className="p-2 border text-sm text-center font-bold text-white">Status</th>
              <th className="p-2 border text-sm text-center font-bold text-white" title="Data quality issues">Issues</th>
            </tr>
          </thead>
          <tbody>
            {allGyms.map((gym, i) => {
              const missing = getMissingEventTypes(gym);
              const qualityIssues = getQualityIssues(gym);

              return (
                <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                  {/* Gym Name Cell */}
                  <td className="p-1 border font-medium text-sm" style={{ color: theme.colors.textPrimary }}>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => scrollToGym(gym)}
                        className="hover:underline inline-flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors font-bold cursor-pointer text-base"
                        style={{ color: '#4a4a4a' }}
                        title={`Jump to ${gym} in calendar`}
                      >
                        {gym}
                        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </button>
                      {getGymLinkUrl(gym, 'Booking (Special Events)') && (
                        <a
                          href={getGymLinkUrl(gym, 'Booking (Special Events)')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:scale-125 px-1 py-1 rounded transition-all text-xs"
                          title={`View all special events at ${gym}`}
                        >
                          ✨
                        </a>
                      )}
                      <button
                        onClick={() => handleMagicControlClick(gym)}
                        className="ml-1 inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold hover:bg-purple-50 transition-colors hover:scale-110"
                        style={{ color: theme.colors.textPrimary }}
                        title={`Open Clinic, KNO, Open Gym for ${gym}`}
                      >
                        <span aria-hidden>✨</span>
                        <span className="sr-only">Open All Events</span>
                      </button>
                    </div>
                  </td>

                  {/* Event Type Count Cells */}
                  {Object.keys(monthlyRequirements).map((eventType, j) => {
                    const count = counts[gym]?.[eventType] || 0;
                    const requiredCount = monthlyRequirements[eventType];
                    const isDeficient = count < requiredCount;
                    const url = getGymLinkUrl(gym, eventType) || getGymLinkUrl(gym, 'BOOKING') || '#';
                    const backgroundColor = getEventTypeColor(eventType);

                    // Adjust background opacity for deficient counts
                    let adjustedBackgroundColor = backgroundColor;
                    if (isDeficient && backgroundColor.startsWith('#')) {
                      const hex = backgroundColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16);
                      const g = parseInt(hex.substr(2, 2), 16);
                      const b = parseInt(hex.substr(4, 2), 16);
                      adjustedBackgroundColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
                    }

                    return (
                      <td key={j} className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold inline-flex items-center justify-center gap-1 px-3 py-2 rounded transition-all duration-200 hover:scale-105 hover:shadow-md text-gray-700 min-w-[48px] h-[40px]"
                          style={{ backgroundColor: adjustedBackgroundColor }}
                          title={`View ${eventType} page at ${gym} (${count}/${requiredCount})`}
                        >
                          <span className="text-lg font-bold">{count}</span>
                          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    );
                  })}

                  {/* Status Cell */}
                  <td className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                    {missing.length === 0 ? (
                      <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white" style={{ backgroundColor: '#6b8e6b' }}>
                        ✓ Complete
                      </span>
                    ) : (
                      <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white" style={{ backgroundColor: '#c27878' }}>
                        {missing.join(' • ')}
                      </span>
                    )}
                  </td>

                  {/* Quality Issues Cell */}
                  <td className="p-1 border text-center text-sm" style={{ color: theme.colors.textPrimary }}>
                    {qualityIssues === 0 ? (
                      <span className="font-bold px-3 py-1 rounded-lg shadow-sm text-white text-xs" style={{ backgroundColor: '#6b8e6b' }}>
                        ✓
                      </span>
                    ) : (
                      <span
                        className="font-bold px-3 py-1 rounded-lg shadow-sm text-white text-xs inline-flex items-center gap-1 cursor-pointer hover:shadow-md"
                        style={{ backgroundColor: '#c27878' }}
                        title={`${qualityIssues} issues`}
                      >
                        {qualityIssues}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
