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

// Outlook's compose deeplink body is PLAIN TEXT only (no bold/HTML), so the
// best we can do is keep it tight. Camps often carry the same problem worded
// three ways (two structural age errors + the AI age note) — the manager needs
// the fix ONCE, not three restatements. Collapse to the first line per topic.
const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/;
function topicOf(line) {
  const t = line.toLowerCase();
  if (t.includes('age')) return 'age';
  if (t.includes('time') || /\d\s*(am|pm)\b/.test(t)) return 'time';
  if (t.includes('year')) return 'year';
  if (t.includes('day of week') || t.includes('day mismatch')) return 'day';
  if (t.includes('date') || MONTH_RE.test(t)) return 'date';
  if (t.includes('program')) return 'program';
  return line; // anything else is its own bucket — never collapsed
}
function dedupeByTopic(lines) {
  const seen = new Set();
  const out = [];
  for (const l of (lines || []).filter(Boolean)) {
    const k = topicOf(l);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
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
  const lines = dedupeByTopic(errorLines);
  const summary = lines.join('\n');
  if (toList.length === 0) return { url: null, recipients: [], summary };

  // Outlook's deeplink/compose IGNORES the cc/bcc params (Microsoft limitation),
  // so a configured CC (e.g. Kim) would silently drop off. Fold it into the To
  // line instead so she's guaranteed on every email. All recipients:
  const ccList = (cc || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const allTo = [...toList, ...ccList];

  const evDate = fmtDate(event.start_date || event.date);
  const many = lines.length > 1;
  const subject = `Heads up — Notification of event error — ${event.gym_id} — ${event.title || 'Event'}`;
  const bodyLines = [
    `Hello!`,
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
    event.event_url ? `Event link: ${event.event_url}` : '',
    ``,
    `Thanks,`,
    fromName,
  ].filter(l => l !== null && l !== undefined);

  const to = encodeURIComponent(allTo.join(';'));
  const subj = encodeURIComponent(subject);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subj}&body=${body}`;
  return { url, recipients: allTo, summary };
}

// ONE email to a gym covering SEVERAL of its flagged events. `items` is
// [{ title, date, url, lines: [...] }]. Returns { url, recipients }.
export function buildBulkGymEmailUrl({ gym, items = [], cc = '', fromName = 'Jayme' }) {
  const toList = [gym?.manager_email, gym?.front_desk_email].filter(Boolean);
  if (toList.length === 0) return { url: null, recipients: [] };
  const ccList = (cc || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const allTo = [...toList, ...ccList];
  const many = items.length > 1;

  const DIV = '──────────────────────────────';
  const bodyLines = [
    `Hello!`,
    ``,
    many
      ? `A few of your events have something to update. Please take a look in iClassPro when you get a chance:`
      : `One of your events has something to update. Please take a look in iClassPro when you get a chance:`,
    ``,
  ];
  items.forEach((it, idx) => {
    bodyLines.push(DIV);
    // Title in CAPS so each event stands out — plain text can't do bold.
    bodyLines.push(`${idx + 1}) ${(it.title || '(no title)').toUpperCase()}`);
    if (it.date) bodyLines.push(`   ${it.date}`);
    bodyLines.push(``);
    dedupeByTopic(it.lines).forEach(l => bodyLines.push(`   • ${l}`));
    if (it.url) {
      bodyLines.push(``);
      bodyLines.push(`   Event link: ${it.url}`);
    }
    bodyLines.push(``);
  });
  bodyLines.push(DIV);
  bodyLines.push(``);
  bodyLines.push(`Thanks,`);
  bodyLines.push(fromName);

  const subject = `Heads up — ${items.length} event${many ? 's' : ''} to update — ${gym?.id || ''}`;
  const to = encodeURIComponent(allTo.join(';'));
  const subj = encodeURIComponent(subject);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subj}&body=${body}`;
  return { url, recipients: allTo };
}

// A "What to update" line for a missing/flyer-only description, so the email
// (and the button) also cover no-description events. Returns null otherwise.
export function descriptionIssueLine(status) {
  if (status === 'none') {
    return 'No description: this event has no description text — please add one in iClassPro';
  }
  if (status === 'flyer_only') {
    return 'No text description: the event has a flyer image but no typed text — please add a text description in iClassPro';
  }
  return null;
}

// "Emailed Jul 4 · 2 days ago" pieces for the most recent send timestamp.
export function fmtSentStamp(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  const dateStr = then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return { dateStr, ago, days };
}
