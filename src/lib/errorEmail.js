// ============================================================================
// Shared error-email builder — used by BOTH the Admin Errors Center and the
// calendar's Event Detail panel so the email is IDENTICAL wherever she sends
// it from. Opens a pre-filled Outlook compose (sends from Jayme's own Powers
// account — she reviews and hits Send). Recording the send is done by the
// caller via errorEmailLogApi so each screen can update its own UI instantly.
// ============================================================================

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// Build ONE Outlook deeplink for a whole event, listing ALL its errors in a
// single email. `errorLines` is an array of already-formatted strings, e.g.
//   "Title vs Description Conflict: Title says 'Open Gym' but description says 'Clinic'"
// Returns { url, recipients, summary }. url is null when the gym has no
// manager/front-desk email on file — the caller shows the "add an email in
// Contacts" message in that case. `summary` is the joined list, stored in the
// send log so history shows what was flagged at send time.
export function buildErrorEmailUrl({ event, errorLines = [], gym, cc = '', fromName = 'Jayme' }) {
  const toList = [gym?.manager_email, gym?.front_desk_email].filter(Boolean);
  const lines = (errorLines || []).filter(Boolean);
  const summary = lines.join('\n');
  if (toList.length === 0) return { url: null, recipients: [], summary };

  const evDate = fmtDate(event.start_date || event.date);
  const many = lines.length > 1;
  const subject = `Heads up — Notification of event error — ${event.gym_id} — ${event.title || 'Event'}`;
  const bodyLines = [
    `Hi ${gym?.manager_name || 'team'},`,
    ``,
    many
      ? `A few data errors were flagged on one of your events. Please take a look and update them in iClassPro when you get a chance:`
      : `A data error was flagged on one of your events. Please take a look and update it in iClassPro when you get a chance:`,
    ``,
    `Event: ${event.title || '(no title)'}`,
    `Type: ${event.type || event.event_type || ''}`,
    `Date: ${evDate}`,
    `Gym: ${gym?.name || event.gym_id}`,
    ``,
    `What to update:`,
    ...lines.map(l => `  • ${l}`),
    ``,
    event.event_url ? `Open in iClassPro: ${event.event_url}` : '',
    ``,
    `Thanks,`,
    fromName,
  ].filter(l => l !== null && l !== undefined);

  const to = encodeURIComponent(toList.join(';'));
  const ccEnc = encodeURIComponent((cc || '').trim());
  const subj = encodeURIComponent(subject);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${to}${cc ? `&cc=${ccEnc}` : ''}&subject=${subj}&body=${body}`;
  return { url, recipients: toList, summary };
}

// "Emailed Jul 4 · 2 days ago" pieces for the most recent send timestamp.
export function fmtSentStamp(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  const dateStr = then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return { dateStr, ago, days };
}
