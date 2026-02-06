// ============================================================================
// BULK PORTAL OPENER - Buttons to open all gym portals for each event type
// ============================================================================
import React from 'react';

export default function BulkPortalOpener({
  getAllUrlsForEventType,
  openMultipleTabs
}) {
  const buttons = [
    {
      id: 'clinics',
      type: 'CLINIC',
      label: 'All Clinics',
      icon: '⭐',
      bgColor: '#b48f8f',
      borderColor: '#9a7a7a'
    },
    {
      id: 'kno',
      type: 'KIDS NIGHT OUT',
      label: 'All KNO',
      icon: '🌙',
      bgColor: '#d4a574',
      borderColor: '#b8956a'
    },
    {
      id: 'opengym',
      type: 'OPEN GYM',
      label: 'All Open Gym',
      icon: '🎯',
      bgColor: '#6b8e6b',
      borderColor: '#5a7a5a'
    },
    {
      id: 'booking',
      type: 'BOOKING',
      label: 'All Booking',
      icon: '🌐',
      bgColor: '#7a9a9e',
      borderColor: '#6a8a8e'
    },
    {
      id: 'camps',
      type: 'camps',
      label: 'School Year Full',
      icon: '🏕️',
      bgColor: '#c4956b',
      borderColor: '#a67b51'
    },
    {
      id: 'camps_half',
      type: 'camps_half',
      label: 'School Year Half',
      icon: '🕐',
      bgColor: '#9e9e9e',
      borderColor: '#8a8a8a'
    },
    {
      id: 'camps_summer_full',
      type: 'camps_summer_full',
      label: 'Summer Full Day',
      icon: '☀️',
      bgColor: '#d4a060',
      borderColor: '#b88a4a'
    },
    {
      id: 'camps_summer_half',
      type: 'camps_summer_half',
      label: 'Summer Half Day',
      icon: '🌤️',
      bgColor: '#c4856b',
      borderColor: '#a66b51'
    }
  ];

  const handleClick = (button) => {
    const urls = getAllUrlsForEventType(button.type);
    openMultipleTabs(
      urls,
      `Opening ${urls.length} ${button.label.toLowerCase()} pages...`,
      `Opened ${urls.length} ${button.label.toLowerCase()} pages!`
    );
  };

  return (
    <div className="rounded-lg shadow-lg p-4 mb-3 mx-2" style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}>
      <div className="flex flex-col items-center justify-center text-center mb-4">
        <div className="rounded-full px-6 py-2 shadow-md mb-2" style={{ backgroundColor: '#b48f8f' }}>
          <span className="text-xl font-bold text-white">🚀 BULK PORTAL OPENER</span>
        </div>
        <p className="text-sm mb-2" style={{ color: '#737373' }}>
          Click any button below to open ALL gym portals for that event type at once
        </p>
        <div className="rounded-lg px-4 py-2" style={{ backgroundColor: '#f5ebe0', border: '1px solid #c3a5a5' }}>
          <span className="text-sm font-bold" style={{ color: '#8b6f6f' }}>
            ⚠️ IMPORTANT: Allow pop-ups in your browser for this to work!
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {buttons.map(button => (
          <button
            key={button.id}
            onClick={() => handleClick(button)}
            className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
            style={{ backgroundColor: button.bgColor, border: `2px solid ${button.borderColor}` }}
          >
            <span className="text-2xl">{button.icon}</span>
            <span className="text-xs font-bold text-white">{button.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
