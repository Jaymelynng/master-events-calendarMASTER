// ============================================================================
// BULK PORTAL OPENER — grouped 3-card layout (General / School Year / Summer)
// ============================================================================
// Replaces the previous flat 8-button row. Each "category" gets its own card
// with a header bar and the relevant action buttons inside. Visual layout
// based on the prototype Jayme designed in mockups/ (May 6, 2026).
//
// Props are unchanged from the prior version, so no parent file needs
// updating:
//   - getAllUrlsForEventType(type)  → returns array of URLs for a given type
//   - openMultipleTabs(urls, ...)   → opens them in sequence with a toast
//
// Category → action key → backend `type` mapping is preserved exactly:
//   clinic     → 'CLINIC'
//   kno        → 'KIDS NIGHT OUT'
//   openGym    → 'OPEN GYM'
//   booking    → 'BOOKING'
//   schoolFull → 'camps'
//   schoolHalf → 'camps_half'
//   summerFull → 'camps_summer_full'
//   summerHalf → 'camps_summer_half'
// ============================================================================

import React from 'react';

const BULK_GROUPS = [
  {
    id: 'general',
    title: 'General Portals',
    icon: '⭐',
    actions: [
      { key: 'clinic',   type: 'CLINIC',          label: 'Clinics',  icon: '⭐', color: '#b99396' },
      { key: 'kno',      type: 'KIDS NIGHT OUT',  label: 'KNO',      icon: '🌙', color: '#d5a36d' },
      { key: 'openGym',  type: 'OPEN GYM',        label: 'Open Gym', icon: '🎯', color: '#6e936f' },
      { key: 'booking',  type: 'BOOKING',         label: 'Booking',  icon: '🌐', color: '#7da0a3' },
    ],
  },
  {
    id: 'school-year',
    title: 'School Year Camps',
    icon: '🏫',
    actions: [
      { key: 'schoolFull', type: 'camps',      label: 'Full', icon: '🏕️', color: '#c79666' },
      { key: 'schoolHalf', type: 'camps_half', label: 'Half', icon: '🍂', color: '#a18374' },
    ],
  },
  {
    id: 'summer',
    title: 'Summer Camps',
    icon: '☀️',
    actions: [
      { key: 'summerFull', type: 'camps_summer_full', label: 'Full', icon: '☀️',  color: '#d7a257' },
      { key: 'summerHalf', type: 'camps_summer_half', label: 'Half', icon: '🌤️', color: '#c58164' },
    ],
  },
];

const CATEGORY_STYLES = {
  general: {
    body: 'linear-gradient(180deg, #fbf4f4 0%, #f3e7e7 100%)',
    border: '#c9aaaa',
    header: 'linear-gradient(180deg, #b99396 0%, #9f777a 100%)',
  },
  'school-year': {
    body: 'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
    border: '#9aaec4',
    header: 'linear-gradient(180deg, #6f8198 0%, #46576b 100%)',
  },
  summer: {
    body: 'linear-gradient(180deg, #fff2cf 0%, #f6d98f 100%)',
    border: '#d89b2b',
    header: 'linear-gradient(180deg, #f0aa2f 0%, #c77918 100%)',
  },
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function GroupCard({ group, onActionClick }) {
  const style = CATEGORY_STYLES[group.id];
  const colsClass = group.actions.length === 4 ? 'grid-cols-4' : 'grid-cols-2';

  return (
    <div
      className="flex h-full flex-col rounded-lg border p-2"
      style={{
        background: style.body,
        borderColor: style.border,
        boxShadow: '0 5px 12px rgba(75,65,65,.16), inset 0 1px 0 rgba(255,255,255,.85)',
      }}
    >
      {/* Header bar */}
      <div
        className="mb-2 flex h-7 items-center justify-center gap-2 rounded-md px-2 text-[11px] font-black uppercase tracking-wide text-white"
        style={{
          background: style.header,
          boxShadow: '0 3px 7px rgba(70,50,50,.22), inset 0 1px 0 rgba(255,255,255,.25)',
        }}
      >
        <span className="whitespace-nowrap leading-none">
          {group.icon} {group.title}
        </span>
      </div>

      {/* Action buttons */}
      <div className={`grid flex-1 gap-2 ${colsClass}`}>
        {group.actions.map(action => (
          <button
            key={action.key}
            onClick={() => onActionClick(action)}
            className="flex min-h-[58px] flex-col items-center justify-center rounded-md border px-2 py-2 text-center text-white transition active:translate-y-[1px] hover:-translate-y-0.5"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(action.color, 0.88)}, ${action.color})`,
              borderColor: hexToRgba(action.color, 0.95),
              boxShadow: `0 4px 9px ${hexToRgba(action.color, 0.32)}, inset 0 1px 0 rgba(255,255,255,.28)`,
            }}
            title={`Open ALL gyms — ${group.title} / ${action.label}`}
          >
            <div className="text-lg leading-none drop-shadow-sm">{action.icon}</div>
            <div className="mt-1 text-[11px] font-black leading-tight drop-shadow-sm">{action.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BulkPortalOpener({ getAllUrlsForEventType, openMultipleTabs }) {
  const handleActionClick = (action) => {
    const urls = getAllUrlsForEventType(action.type);
    openMultipleTabs(
      urls,
      `Opening ${urls.length} ${action.label.toLowerCase()} pages...`,
      `Opened ${urls.length} ${action.label.toLowerCase()} pages!`
    );
  };

  return (
    <div
      className="rounded-lg shadow-lg p-4"
      style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}
    >
      {/* Title + popup-warning header (unchanged from prior version) */}
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

      {/* 3-card grouped layout: General / School Year / Summer */}
      <div className="grid gap-3 md:grid-cols-[1.36fr_.82fr_.82fr]">
        {BULK_GROUPS.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            onActionClick={handleActionClick}
          />
        ))}
      </div>
    </div>
  );
}
