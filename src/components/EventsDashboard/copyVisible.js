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
// send stays blank.
// ============================================================================
import { multiDayEventTypes } from './constants';
import { eventFallsOnDate } from './utils';

const COLUMNS = ['Gym', 'Gym Name', 'Category', 'Event', 'Start', 'End', 'Day', 'Time', 'Ages', 'Spots', 'Link'];

const ymd = (v) => (v ? String(v).split('T')[0] : '');

const fmtDate = (v) => {
  const d = ymd(v);
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${Number(m)}/${Number(day)}/${y}`;
};

const ages = (e) => {
  const hasMin = e.age_min !== null && e.age_min !== undefined;
  const hasMax = e.age_max !== null && e.age_max !== undefined;
  if (hasMin && hasMax) return `${e.age_min}-${e.age_max}`;
  if (hasMin) return `${e.age_min}+`;
  return '';
};

// Same wording as the calendar cards. Blank when iClass sent no count.
const spots = (e) => {
  if (e.has_openings === false || e.openings === 0) return 'FULL';
  if (e.openings === null || e.openings === undefined) return '';
  return `${e.openings} left`;
};

// The events the calendar is drawing for the days in view.
export const eventsInView = (events, displayDates, currentYear, currentMonth) =>
  events.filter(e => displayDates.some(d =>
    eventFallsOnDate(e, d, currentYear, currentMonth, multiDayEventTypes)));

export const buildCopy = (events, gymsList = []) => {
  const nameOf = (id) => gymsList.find(g => g.id === id)?.name || '';
  const rows = [...events]
    .sort((a, b) => (a.gym_id || '').localeCompare(b.gym_id || '')
      || ymd(a.start_date || a.date).localeCompare(ymd(b.start_date || b.date))
      || (a.title || '').localeCompare(b.title || ''))
    .map(e => {
      const start = ymd(e.start_date || e.date);
      const end = ymd(e.end_date);
      return [
        e.gym_id || '',
        nameOf(e.gym_id),
        e.type || e.event_type || '',
        (e.title || '').replace(/\s+/g, ' ').trim(),
        fmtDate(start),
        end && end !== start ? fmtDate(end) : '',
        e.day_of_week || '',
        e.time || '',
        ages(e),
        spots(e),
        e.event_url || '',
      ];
    });

  const text = [COLUMNS, ...rows]
    .map(r => r.map(c => String(c).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = 'border:1px solid #ccc;padding:4px 8px;font-family:Arial,sans-serif;font-size:13px;';
  const html = '<table style="border-collapse:collapse;">'
    + '<tr>' + COLUMNS.map(c => `<th style="${cell}background:#eee;text-align:left;">${esc(c)}</th>`).join('') + '</tr>'
    + rows.map(r => '<tr>' + r.map((c, i) => {
      const v = i === r.length - 1 && c ? `<a href="${esc(c)}">${esc(c)}</a>` : esc(c);
      return `<td style="${cell}">${v}</td>`;
    }).join('') + '</tr>').join('')
    + '</table>';

  return { text, html, count: rows.length };
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
