// ============================================================================
// COPY WHAT'S SHOWN — the events on screen, as a table you can paste anywhere.
// ============================================================================
// "What's shown" = the same events the calendar is drawing right now: the
// gyms picked in the logo row, the category / chip, the search box, and the
// days in view (Full Month, Days 1-15, a single week, Today → End of Month).
// In Table View it is every row in the table.
//
// The clipboard gets two versions at once: a real table (pastes as a table in
// Gmail, Outlook, Word, Google Docs) and tab-separated text (pastes into
// cells in Excel / Google Sheets). Nothing is invented: a value iClass didn't
// send stays blank. Columns + spots: src/lib/eventRow.js (shared with the Export window).
// ============================================================================
import { multiDayEventTypes } from './constants';
import { eventFallsOnDate } from './utils';
import { buildEventRows, toClipboard, fetchDayCounts, DEFAULT_COPY_COLUMNS } from '../../lib/eventRow';

// The events the calendar is drawing for the days in view.
export const eventsInView = (events, displayDates, currentYear, currentMonth) =>
  events.filter(e => displayDates.some(d =>
    eventFallsOnDate(e, d, currentYear, currentMonth, multiDayEventTypes)));

// The columns, the spots number and the formatting come from the ONE shared list (src/lib/eventRow.js), so
// this copy, the Export window's Copy and its CSV file always agree. Spots = the fullest day, like the calendar.
export const buildCopy = async (events, gymsList = [], columnKeys = DEFAULT_COPY_COLUMNS) => {
  const dayCounts = await fetchDayCounts(events);
  return toClipboard(buildEventRows(events, { columnKeys, gymsList, dayCounts }));
};

// Puts both versions on the clipboard. Falls back to plain text if the
// browser won't take the table version.
export const copyToClipboardRich = async ({ text, html }) => {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
      return true;
    }
  } catch (e) { /* fall through to plain text */ }
  await navigator.clipboard.writeText(text);
  return true;
};
