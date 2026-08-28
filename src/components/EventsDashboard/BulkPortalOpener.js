// ============================================================================
// BULK PORTAL OPENER — Booking is the hub; the rest are shortcuts off it.
// ============================================================================
// Replaces the 3-card / 8-button band (May 2026 prototype). Two things drove
// the rewrite, both measured against live iClass data on 2026-08-28:
//
//   1. The old buttons carried no counts, so they all looked equal. They were
//      not. "Summer Full" had 11 stored links but only ONE gym (PLG) with a
//      live camp behind it. Four of the eight buttons opened pages that said
//      "no camps found".
//   2. Booking is the only link every gym has (14/14), the only one with no
//      typeId baked into the URL — so the only one that can never go stale —
//      and it is the gym's own live index of every category it offers.
//
// So Booking is the one primary action, and the category shortcuts collapse to
// a single quiet row underneath, each carrying a REAL count. A shortcut with
// nothing live behind it does not render at all — which is why Summer
// disappears in September and comes back in May on its own.
//
// Counts come from the events already loaded on this page, not from how many
// links are stored. Stored counts were the whole problem: "Summer Full" had 11
// stored links and exactly one real camp.
//
// The obvious source — iClassPro's /bookings/{locationId} endpoint — CANNOT be
// used here. It sends no Access-Control-Allow-Origin header, so the browser
// blocks it (verified 2026-08-28: all 14 calls failed CORS). Only the
// server-side sync can reach it. Counting the events is the browser-side
// stand-in and the better answer anyway: if a category has nothing on the
// calendar, there is nothing to go look at.
//
// Nothing is hardcoded per category. GROUPS maps a chip to one or more
// link_type_id values; add a link type to a group (or add a group) and it
// appears on its own.
// ============================================================================

import React, { useMemo } from 'react';

// A chip covers one or more link types (the pages it opens) and exactly one
// event bucket (what it counts). Camps is deliberately ONE chip: Full vs Half
// is a property of a camp, not a different thing to go look at, and the
// calendar already shows which is which in the event title.
const GROUPS = [
  { key: 'camps',     label: 'Camps',     icon: '🏕️', color: '#c79666', bucket: 'CAMP',
    linkTypes: ['camps', 'camps_half', 'camps_holiday', 'camps_summer_full', 'camps_summer_half'] },
  { key: 'kno',       label: 'KNO',       icon: '🌙', color: '#d5a36d', bucket: 'KIDS NIGHT OUT', linkTypes: ['kids_night_out'] },
  { key: 'openGym',   label: 'Open Gym',  icon: '🎯', color: '#6e936f', bucket: 'OPEN GYM',       linkTypes: ['open_gym'] },
  { key: 'clinics',   label: 'Clinics',   icon: '⭐',      color: '#b99396', bucket: 'CLINIC',         linkTypes: ['skill_clinics'] },
  { key: 'specialty', label: 'Specialty', icon: '✨',      color: '#7d6b96', bucket: 'SPECIALTY',      linkTypes: ['specialty', 'special_events'] },
  { key: 'care',      label: 'Camp Care', icon: '🧸', color: '#a18374', bucket: 'CAMP CARE',      linkTypes: ['camp_care', 'camp_care_am'] },
];

export default function BulkPortalOpener({
  getAllUrlsForEventType,
  openMultipleTabs,
  gymLinks = [],
  events = [],
}) {
  // How many gyms have something in this bucket in the month on screen.
  // Deliberately NOT filtered to "today forward": `events` is already scoped to
  // the month being viewed, so filtering again collapsed every count to 1-2 on
  // the 28th. The chip answers "for this month, who has one of these".
  //
  // A chip with nothing behind it does not render at all - which is why Summer
  // folds away in September and comes back on its own in May.
  const chips = useMemo(() => {
    const gymsByBucket = {};
    events.forEach(e => {
      const bucket = (e.type || e.event_type || '').toUpperCase();
      if (!bucket || !e.gym_id) return;
      if (!gymsByBucket[bucket]) gymsByBucket[bucket] = new Set();
      gymsByBucket[bucket].add(e.gym_id);
    });

    return GROUPS
      .map(g => ({ ...g, count: (gymsByBucket[g.bucket] || new Set()).size }))
      .filter(g => g.count > 0);
  }, [events]);

  const bookingCount = useMemo(
    () => new Set(gymLinks.filter(gl => gl.link_type_id === 'booking').map(gl => gl.gym_id)).size,
    [gymLinks]
  );

  const openGroup = (group) => {
    const urls = [...new Set(group.linkTypes.flatMap(t => getAllUrlsForEventType(t) || []))];
    if (!urls.length) return;
    openMultipleTabs(
      urls,
      `Opening ${urls.length} ${group.label} pages…`,
      `Opened ${urls.length} ${group.label} pages`
    );
  };

  const openBooking = () => {
    const urls = getAllUrlsForEventType('BOOKING') || [];
    if (!urls.length) return;
    openMultipleTabs(
      urls,
      `Opening ${urls.length} booking pages…`,
      `Opened ${urls.length} booking pages`
    );
  };

  return (
    <div
      className="rounded-lg shadow-lg px-4 py-3"
      style={{ backgroundColor: '#e6e6e6', border: '1px solid #adb2c6' }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {/* Booking — the hub. Every gym has one and it can never go stale. */}
        <button
          onClick={openBooking}
          disabled={!bookingCount}
          title="Open every gym's booking page — each gym's own index of everything it offers"
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-white transition active:translate-y-[1px] hover:-translate-y-0.5 disabled:opacity-40"
          style={{
            background: 'linear-gradient(180deg, #8ba7aa, #6f8f93)',
            boxShadow: '0 4px 10px rgba(111,143,147,.38), inset 0 1px 0 rgba(255,255,255,.28)',
          }}
        >
          <span className="text-lg leading-none">🌐</span>
          <span className="text-sm font-black leading-none">OPEN ALL BOOKING PAGES</span>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-black leading-none">
            {bookingCount}
          </span>
        </button>

        <span className="hidden h-7 w-px bg-black/10 sm:block" />

        {/* Shortcuts. A category with nothing live behind it is not rendered. */}
        {chips.map(chip => (
          <button
            key={chip.key}
            onClick={() => openGroup(chip)}
            title={`Open ${chip.label} for the ${chip.count} gym${chip.count === 1 ? '' : 's'} that currently have one`}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition active:translate-y-[1px] hover:-translate-y-0.5"
            style={{
              backgroundColor: '#fff',
              borderColor: chip.color,
              color: '#4a4046',
              boxShadow: '0 2px 5px rgba(75,65,65,.14)',
            }}
          >
            <span className="text-sm leading-none">{chip.icon}</span>
            <span className="text-xs font-bold leading-none">{chip.label}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none text-white"
              style={{ backgroundColor: chip.color }}
            >
              {chip.count}
            </span>
          </button>
        ))}

        {!chips.length && (
          <span className="text-xs" style={{ color: '#8b7f85' }}>
            No category shortcuts have anything live right now — use the booking pages.
          </span>
        )}
      </div>

      <p className="mt-2 text-center text-[11px]" style={{ color: '#8b7f85' }}>
        Opens one tab per gym — allow pop-ups. Counts are gyms with one of these on the calendar this month.
      </p>
    </div>
  );
}
