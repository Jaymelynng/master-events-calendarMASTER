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
// links are stored.
//
// The obvious source — iClassPro's /bookings/{locationId} endpoint — CANNOT be
// used here. It sends no Access-Control-Allow-Origin header, so the browser
// blocks it (verified 2026-08-28: all 14 calls failed CORS). Only the
// server-side sync can reach it.
//
// 2026-10-01 — the chips no longer open STORED links (gym_links). Those were
// typed in once and never followed the gyms: on this date KNO counted 14 gyms
// but had links for 12, Clinics counted 12 and had 10, and Planet's stored camp
// link pointed at a category id it no longer uses. Now each chip builds its
// pages from the events themselves: every synced event already carries its
// gym's portal address and the iClass category it sits in, so the link is
// always the category that event is really in. Nothing to keep up by hand.
//
// The chips themselves are the buckets in the event_types table. Add a bucket
// there and its chip appears; nothing is listed in this file.
// ============================================================================

import React, { useMemo, useState, useEffect } from 'react';
import { bucketsApi } from '../../lib/api';

// Decoration only (an emoji and a friendlier plural). A bucket missing from
// here still gets a chip - it just shows its own name and no emoji.
const CHIP_STYLE = {
  'CAMP':           { icon: '🏕️', label: 'Camps' },
  'KIDS NIGHT OUT': { icon: '🌙', label: 'KNO' },
  'OPEN GYM':       { icon: '🎯', label: 'Open Gym' },
  'CLINIC':         { icon: '⭐', label: 'Clinics' },
  'SPECIALTY':      { icon: '✨', label: 'Specialty' },
  'CAMP CARE':      { icon: '🧸', label: 'Camp Care' },
};

const PORTAL = 'https://portal.iclasspro.com/';

// The portal page that lists the iClass category an event sits in.
// Built only from what the event itself carries - null when it can't be.
const categoryPageFor = (e) => {
  const url = e.event_url || '';
  if (!url.startsWith(PORTAL)) return null;
  const [slug, kind] = url.slice(PORTAL.length).split('/');
  if (!slug) return null;
  if (kind === 'appointment-details') {
    const serviceId = new URLSearchParams(url.split('?')[1] || '').get('serviceId');
    return serviceId ? `${PORTAL}${slug}/appointments/${serviceId}` : null;
  }
  if (kind === 'camp-details' && e.type_id !== null && e.type_id !== undefined) {
    return `${PORTAL}${slug}/camps/${e.type_id}?sortBy=time`;
  }
  return null;
};

export default function BulkPortalOpener({
  getAllUrlsForEventType,
  openMultipleTabs,
  gymLinks = [],
  events = [],
  eventTypes = [],
}) {
  // The chips cover EVERY upcoming event, not only the month on screen. A gym
  // whose first camp is next month still has a camp page worth opening today
  // (2026-10-01: Eagle's and Metro's school-year camps start in November, so
  // in October the Camps chip left both out). Re-read whenever the page's own
  // events change, e.g. after a sync. Until it loads, or if it fails, the
  // month's events stand in.
  const [upcoming, setUpcoming] = useState(null);
  useEffect(() => {
    let live = true;
    bucketsApi.getUpcoming()
      .then(rows => { if (live) setUpcoming(rows); })
      .catch(() => { if (live) setUpcoming(null); });
    return () => { live = false; };
  }, [events.length]);
  const source = upcoming || events;

  // How many gyms have something coming up in this bucket, and which live
  // category pages those events sit in.
  // A chip with nothing behind it does not render at all.
  const chips = useMemo(() => {
    const byBucket = {};
    source.forEach(e => {
      const bucket = (e.type || e.event_type || '').toUpperCase();
      if (!bucket || !e.gym_id) return;
      if (!byBucket[bucket]) byBucket[bucket] = { gyms: new Set(), urls: new Set(), noLink: 0 };
      byBucket[bucket].gyms.add(e.gym_id);
      const page = categoryPageFor(e);
      if (page) byBucket[bucket].urls.add(page); else byBucket[bucket].noLink++;
    });

    // One chip per bucket in event_types: counted ones first, then by name.
    // A bucket that has events but isn't in event_types yet still gets a chip.
    const known = [...eventTypes].sort((a, b) =>
      (b.is_tracked === true) - (a.is_tracked === true) || (a.name || '').localeCompare(b.name || ''));
    const names = [
      ...known.map(t => t.name),
      ...Object.keys(byBucket).filter(n => !known.some(t => t.name === n)),
    ];

    return names
      .filter(name => byBucket[name])
      .map(name => {
        const row = known.find(t => t.name === name);
        const style = CHIP_STYLE[name] || {};
        return {
          key: name,
          label: style.label || row?.display_name || name,
          icon: style.icon || '',
          color: row?.color || '#8b7f85',
          count: byBucket[name].gyms.size,
          urls: [...byBucket[name].urls],
          noLink: byBucket[name].noLink,
        };
      });
  }, [source, eventTypes]);

  const bookingCount = useMemo(
    () => new Set(gymLinks.filter(gl => gl.link_type_id === 'booking').map(gl => gl.gym_id)).size,
    [gymLinks]
  );

  const openGroup = (group) => {
    const urls = group.urls;
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
            title={`Open ${chip.urls.length} ${chip.label} page${chip.urls.length === 1 ? '' : 's'} across ${chip.count} gym${chip.count === 1 ? '' : 's'}`
              + (chip.noLink ? ` (${chip.noLink} event${chip.noLink === 1 ? ' has' : 's have'} no category page to open)` : '')}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition active:translate-y-[1px] hover:-translate-y-0.5"
            style={{
              backgroundColor: '#fff',
              borderColor: chip.color,
              color: '#4a4046',
              boxShadow: '0 2px 5px rgba(75,65,65,.14)',
            }}
          >
            {chip.icon && <span className="text-sm leading-none">{chip.icon}</span>}
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
        Opens each gym’s live iClass page for that category — allow pop-ups. Counts are gyms with one coming up.
      </p>
    </div>
  );
}
