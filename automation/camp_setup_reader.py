#!/usr/bin/env python3
"""
Camp setup reader — signed-in, READ ONLY.

Reads what the public feed can't: hidden camps, Show on Web / Allow Registration, Maximum Number of
Entries, each camp's price table, and per-day sign-ups. Saves every reply WHOLE into:
  iclass_camp_setup   (one row per camp; re-read while it has not ended, hidden ones included; also the
                       public reply, the only home of "waitlist requests on/off")
  iclass_price_tables (one row per price table; view iclass_price_cells flattens it)
  iclass_gym_settings (the gym-wide calls in GYM_SETTINGS_CALLS, one row each)
  iclass_setup_reads  (one row per gym per read — "ok" or why it was NOT read)
  iclass_appointment_setup        (one row per APPOINTMENT with a time slot from today on, hidden ones too;
                                   the sign-up lists are taken out - they name children - and counted instead)
  iclass_appointment_price_tables (one row per appointment price table - a separate numbering from camps')
Nothing is ever deleted: an ended camp keeps its last read; a camp or price table iClass no longer
lists gets gone_from_iclass_at.

Runs AFTER the normal sync and never touches the events table, so the public sync is unchanged.

Login, typed by Jayme into Railway Variables (never in code or chat):
  ICLASS_SETUP_USER                 the one username she made at every gym
  ICLASS_SETUP_PASS_<GYM CODE>      that gym's password, e.g. ICLASS_SETUP_PASS_SGT
  (ICLASS_SETUP_USER_<GYM CODE> overrides the username for one gym if ever needed)
A gym with no login is recorded as 'no_login' — its checks show "setup not read", never "no errors".

Test without a login (from one of Jayme's F12 recordings, nothing sent to iClass):
  python camp_setup_reader.py --har "<part 1>.har" "<part 2>.har" --gym CCP [--save]
  (a network recorder .capture.jsonl file works the same way as a .har)
Live (or press POST /setup-read on the backend):
  python camp_setup_reader.py --gym SGT [--save] [--prices]      (or --all)
Without --save it prints counts only.
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from http.cookiejar import CookieJar
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '') or os.environ.get('SUPABASE_KEY', '')

ICLASS = 'https://app.iclasspro.com'

# The ONLY iClass calls this reader may make. Anything else is refused before it leaves.
ALLOWED_GETS = [
    r'/api/v1/user/permissions',
    r'/api/v1/camps/',
    r'/api/v1/camps/\d+',
    r'/api/v1/get-camp-occupancy/\d+',
    r'/api/v1/pricing-schedules/',
    r'/api/v1/camp-types/',
    r'/api/v1/programs',
    r'/api/v1/charge-categories',
    r'/api/v1/settings/parent-portal-camp-registration',
    r'/api/v1/settings/parent-portal-general',
    r'/api/open/v1/[a-z0-9]+/camps/\d+',
    # Appointments (Planet runs main events as appointments). Proven on her Planet recording 2026-11-07.
    r'/api/v1/appointments/\d+',
    r'/api/v1/appointment-pricing-schedules/',
    r'/api/v1/appointments-settings',
]

# The ONLY POST this reader may send: the appointment calendar's own SEARCH. It changes nothing in iClass -
# it answers which time slots exist between two dates (the screen sends the same call on every page view).
ALLOWED_POSTS = [
    r'/api/v1/appointment-timeslots/filtered',
]

# Gym-wide calls, read once per gym, each reply saved whole (iclass_gym_settings.setting_key = the key).
# Every one is in Jayme's F12 recordings (_HAR-CAPTURES field map, checked 2026-11-04).
GYM_SETTINGS_CALLS = {
    'camp-types': '/api/v1/camp-types/',
    'programs': '/api/v1/programs',
    'charge-categories': '/api/v1/charge-categories',
    'parent-portal-camp-registration': '/api/v1/settings/parent-portal-camp-registration',
    'parent-portal-general': '/api/v1/settings/parent-portal-general',
}


def _allowed(path, method='GET'):
    return any(re.fullmatch(p, path) for p in (ALLOWED_POSTS if method == 'POST' else ALLOWED_GETS))


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class LiveSource:
    """Signs in to one gym with its own staff login, then GETs only the allowed calls."""

    def __init__(self, slug, user, password):
        self.slug = slug
        self.jar = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.jar), _NoRedirect)
        self.user = user
        self.password = password

    def sign_in(self):
        try:
            self.opener.open(Request(f"{ICLASS}/a/{self.slug}"), timeout=30).read()
        except HTTPError:
            pass
        body = urlencode({'stafflogin': '1', 'uname': self.user, 'passwd': self.password}).encode()
        req = Request(f"{ICLASS}/a/{self.slug}/", data=body, method='POST')
        req.add_header('content-type', 'application/x-www-form-urlencoded')
        try:
            self.opener.open(req, timeout=30).read()
        except HTTPError as e:
            if e.code not in (301, 302, 303):
                return False, f"sign-in answered {e.code}"
        perm = self.get('/api/v1/user/permissions')
        if not perm or not perm.get('data'):
            return False, 'iClass did not accept the login (no permissions after sign-in)'
        return True, 'signed in'

    def read_time(self):
        return datetime.now(timezone.utc).isoformat()

    def get(self, path):
        if not _allowed(path):
            raise RuntimeError(f"refused: {path} is not on the read-only list")
        req = Request(ICLASS + path)
        req.add_header('x-icp-account', self.slug)
        req.add_header('accept', 'application/json')
        try:
            with self.opener.open(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            if e.code in (403, 429):
                raise RuntimeError(f"iClass answered {e.code} on {path} - stopping, never retrying past a block")
            print(f"  [SETUP] HTTP {e.code}: {path}")
            return None

    def post(self, path, body):
        """Only the search calls in ALLOWED_POSTS - never a save."""
        if not _allowed(path, 'POST'):
            raise RuntimeError(f"refused: POST {path} is not on the read-only search list")
        req = Request(ICLASS + path, data=json.dumps(body).encode(), method='POST')
        req.add_header('x-icp-account', self.slug)
        req.add_header('accept', 'application/json')
        req.add_header('content-type', 'application/json')
        try:
            with self.opener.open(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            if e.code in (403, 429):
                raise RuntimeError(f"iClass answered {e.code} on {path} - stopping, never retrying past a block")
            print(f"  [SETUP] HTTP {e.code}: POST {path}")
            return None


class HarSource:
    """Serves the same calls from Jayme's F12 recording. Sends nothing to iClass."""

    def __init__(self, har_files):
        self.replies = {}       # (method, path) -> reply
        self.account = None
        self.recorded_at = None
        for f in har_files:
            for method, url, status, text, started, headers in self._entries(f):
                if method not in ('GET', 'POST') or 'iclasspro.com/api/' not in url:
                    continue
                path = url.split('iclasspro.com', 1)[1].split('?')[0]
                if not _allowed(path, method):
                    continue
                if status != 200 or not text:
                    continue
                try:
                    self.replies[(method, path)] = json.loads(text)
                except ValueError:
                    continue
                if started and (not self.recorded_at or started > self.recorded_at):
                    self.recorded_at = started
                for name, value in headers.items():
                    if name.lower() == 'x-icp-account':
                        self.account = value

    @staticmethod
    def _entries(f):
        """(method, url, status, reply text, started, request headers) from a .har file or from the
        network recorder's .capture.jsonl (one JSON record per line: request records + body records)."""
        import base64
        if f.lower().endswith('.jsonl'):
            reqs, bodies = {}, {}
            with open(f, encoding='utf-8') as fh:
                for line in fh:
                    try:
                        o = json.loads(line)
                    except ValueError:
                        continue
                    v = o.get('value') or {}
                    if o.get('type') == 'request':
                        reqs[v.get('key')] = v
                    elif o.get('type') == 'body':
                        b = v.get('body') or ''
                        bodies[v.get('key')] = base64.b64decode(b).decode('utf-8', 'replace') if v.get('base64Encoded') else b
            for k, v in reqs.items():
                r = v.get('request') or {}
                yield (r.get('method'), r.get('url') or '', (v.get('response') or {}).get('status'),
                       bodies.get(k), v.get('startedAt'), r.get('headers') or {})
            return
        with open(f, encoding='utf-8') as fh:
            entries = json.load(fh)['log']['entries']
        for e in entries:
            yield (e['request']['method'], e['request']['url'], e['response']['status'],
                   (e['response'].get('content') or {}).get('text'), e['startedDateTime'],
                   {h['name']: h['value'] for h in e['request']['headers']})

    def sign_in(self):
        return True, 'recording'

    def read_time(self):
        # When iClass actually sent these replies, not when the file was loaded.
        return self.recorded_at or datetime.now(timezone.utc).isoformat()

    def get(self, path):
        if not _allowed(path):
            raise RuntimeError(f"refused: {path} is not on the read-only list")
        return self.replies.get(('GET', path))

    def post(self, path, body):
        # A recording holds the search for the dates Jayme looked at, whatever dates are asked for here.
        if not _allowed(path, 'POST'):
            raise RuntimeError(f"refused: POST {path} is not on the read-only search list")
        return self.replies.get(('POST', path))


def collect(source, slug, today=None):
    """Every price table + gym-wide setting + every camp that has not ended (hidden ones too), each reply whole."""
    today = (today or date.today()).isoformat()
    tables = (source.get('/api/v1/pricing-schedules/') or {}).get('data')
    listing = (source.get('/api/v1/camps/') or {}).get('data')
    if tables is None or listing is None:
        return None, 'the camp list or the price tables did not answer'

    # The list sends most settings blank (proven on CCP 2026-11-04) — it is only used to find camp ids.
    # A camp with no end date is kept: a blank is not "ended".
    keep = [c['id'] for c in listing if not c.get('endDate') or str(c['endDate'])[:10] >= today]
    camps, missing = [], []
    for camp_id in keep:
        detail = (source.get(f'/api/v1/camps/{camp_id}') or {}).get('data')
        if not detail:
            missing.append(camp_id)
            continue
        occ = source.get(f'/api/v1/get-camp-occupancy/{camp_id}')
        public = source.get(f'/api/open/v1/{slug}/camps/{camp_id}')
        camps.append({'camp_id': camp_id, 'raw': detail, 'occupancy': occ.get('data') if occ else None,
                      'public_raw': public.get('data') if public else None})
    settings, settings_missing = {}, []
    for key, path in GYM_SETTINGS_CALLS.items():
        reply = source.get(path)
        if reply is None:
            settings_missing.append(key)
        else:
            settings[key] = reply
    return {'price_tables': tables, 'camps': camps, 'camps_listed': len(listing),
            'listed_ids': [c['id'] for c in listing], 'camps_kept': len(keep), 'camps_missing': missing,
            'settings': settings, 'settings_missing': settings_missing}, None


# Sign-up lists inside an appointment reply. They name children, and these tables are readable by the app's
# public key - so they are taken out before saving and counted instead. Everything else is stored whole.
APPOINTMENT_PEOPLE_KEYS = ('bookings', 'bookingTimeslots', 'attendances', 'tempBookings')
APPOINTMENT_DAYS_AHEAD = 400   # how far ahead the time-slot search looks (a bit over a year)


def collect_appointments(source, today=None):
    """Every appointment with a time slot from today on (hidden ones too), its whole setup, and every
    appointment price table. Returns (result, None) or (None, why it was not read)."""
    from datetime import timedelta
    start = today or date.today()
    end = start + timedelta(days=APPOINTMENT_DAYS_AHEAD)
    tables = (source.get('/api/v1/appointment-pricing-schedules/') or {}).get('data')
    if tables is None:
        return None, 'the appointment price tables did not answer'
    ids, page, last = [], 1, 1
    while page <= last and page <= 200:
        reply = source.post('/api/v1/appointment-timeslots/filtered', {'filters': {
            'searchString': '', 'startDate': start.isoformat(), 'endDate': end.isoformat(),
            'startTime': '', 'endTime': '', 'booked': None, 'inSession': None, 'recurring': None,
            'checkedIn': None, 'group': None, 'zones': [], 'programs': [], 'services': [], 'days': [],
            'instructors': [], 'genders': [], 'keywords': [], 'startAge': None, 'endAge': None,
            'onlineSettings': [], 'bookingId': None, 'smartFilterId': None,
            'page': page, 'pageSize': 50, 'sortType': '', 'sortReverse': False}})
        data = (reply or {}).get('data')
        if data is None:
            return None, f'the appointment time-slot search did not answer (page {page})'
        for o in data.get('objects') or []:
            if o.get('appointmentId') and o['appointmentId'] not in ids:
                ids.append(o['appointmentId'])
        last = int(data.get('lastPage') or 1)
        page += 1
    appts, missing = [], []
    for appt_id in ids:
        detail = (source.get(f'/api/v1/appointments/{appt_id}') or {}).get('data')
        if not detail:
            missing.append(appt_id)
            continue
        bookings = detail.get('bookings') or []
        summary = {'listed': len(bookings), 'not_cancelled': sum(1 for b in bookings if not b.get('cancelledAt'))}
        raw = {k: v for k, v in detail.items() if k not in APPOINTMENT_PEOPLE_KEYS}
        appts.append({'appointment_id': appt_id, 'raw': raw, 'bookings_summary': summary})
    settings = source.get('/api/v1/appointments-settings')
    return {'appointments': appts, 'appointment_ids': ids, 'appointments_missing': missing,
            'appointment_price_tables': tables, 'appointments_settings': settings}, None


# ---------------------------------------------------------------- Supabase

def _sb(method, path, body=None, prefer=None):
    req = Request(f"{SUPABASE_URL}/rest/v1/{path}", method=method,
                  data=json.dumps(body).encode() if body is not None else None)
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f"Bearer {SUPABASE_KEY}")
    req.add_header('Content-Type', 'application/json')
    if prefer:
        req.add_header('Prefer', prefer)
    with build_opener().open(req, timeout=60) as r:
        text = r.read().decode()
        return json.loads(text) if text else None


def start_read(gym_id, what='full'):
    row = _sb('POST', 'iclass_setup_reads', [{'gym_id': gym_id, 'status': 'running', 'what': what}],
              prefer='return=representation')
    return row[0]['id']


def close_cut_off_reads():
    """A read still 'running' when the server starts was cut off by a restart (a deploy). Say so,
    so the screen never shows a gym as reading forever. Returns how many were closed."""
    rows = _sb('PATCH', 'iclass_setup_reads?status=eq.running',
               {'status': 'stopped', 'note': 'cut off - the server restarted during this read',
                'finished_at': datetime.now(timezone.utc).isoformat()},
               prefer='return=representation') or []
    return len(rows)


def finish_read(read_id, status, note, result=None):
    patch = {'status': status, 'note': note, 'finished_at': datetime.now(timezone.utc).isoformat()}
    if result:
        patch.update({'camps_listed': result.get('camps_listed'), 'camps_read': len(result.get('camps', [])),
                      'price_tables_read': len(result['price_tables'])})
        appt = result.get('appointment_read')
        if appt:
            patch.update({'appointments_read': len(appt['appointments']),
                          'appointment_price_tables_read': len(appt['appointment_price_tables'])})
    _sb('PATCH', f'iclass_setup_reads?id=eq.{read_id}', patch)


def save(gym_id, result, read_at):
    """Upsert every row. Never deletes: what iClass no longer lists gets gone_from_iclass_at."""
    tables = [{'gym_id': gym_id, 'price_table_id': t['id'], 'name': t.get('name'), 'raw': t, 'read_at': read_at,
               'gone_from_iclass_at': None} for t in result['price_tables']]
    camps = [{'gym_id': gym_id, 'camp_id': c['camp_id'], 'raw': c['raw'], 'occupancy': c['occupancy'],
              'public_raw': c['public_raw'], 'read_at': read_at, 'gone_from_iclass_at': None}
             for c in result['camps']]
    settings = [{'gym_id': gym_id, 'setting_key': k, 'raw': v, 'read_at': read_at}
                for k, v in result['settings'].items()]
    for i in range(0, len(tables), 200):
        _sb('POST', 'iclass_price_tables?on_conflict=gym_id,price_table_id', tables[i:i + 200],
            prefer='resolution=merge-duplicates')
    for i in range(0, len(camps), 100):
        _sb('POST', 'iclass_camp_setup?on_conflict=gym_id,camp_id', camps[i:i + 100],
            prefer='resolution=merge-duplicates')
    if settings:
        _sb('POST', 'iclass_gym_settings?on_conflict=gym_id,setting_key', settings,
            prefer='resolution=merge-duplicates')
    # Mark (never delete) what iClass no longer lists. An empty list is treated as a failed read, not
    # "everything is gone" - a suspiciously clean answer is never trusted.
    if result['listed_ids']:
        ids = ','.join(str(i) for i in result['listed_ids'])
        _sb('PATCH', f'iclass_camp_setup?gym_id=eq.{gym_id}&camp_id=not.in.({ids})&gone_from_iclass_at=is.null',
            {'gone_from_iclass_at': read_at})
    if result['price_tables']:
        ids = ','.join(str(t['id']) for t in result['price_tables'])
        _sb('PATCH', f'iclass_price_tables?gym_id=eq.{gym_id}&price_table_id=not.in.({ids})'
                     f'&gone_from_iclass_at=is.null', {'gone_from_iclass_at': read_at})


def save_prices(gym_id, tables, read_at):
    """Prices-only read: upsert every price table, mark (never delete) the ones iClass stopped listing."""
    rows = [{'gym_id': gym_id, 'price_table_id': t['id'], 'name': t.get('name'), 'raw': t, 'read_at': read_at,
             'gone_from_iclass_at': None} for t in tables]
    for i in range(0, len(rows), 200):
        _sb('POST', 'iclass_price_tables?on_conflict=gym_id,price_table_id', rows[i:i + 200],
            prefer='resolution=merge-duplicates')
    if tables:
        ids = ','.join(str(t['id']) for t in tables)
        _sb('PATCH', f'iclass_price_tables?gym_id=eq.{gym_id}&price_table_id=not.in.({ids})'
                     f'&gone_from_iclass_at=is.null', {'gone_from_iclass_at': read_at})


def save_appointments(gym_id, appt, read_at):
    """Upsert every appointment + appointment price table. Never deletes: an appointment keeps its last read
    after its last time slot passes; a price table iClass stopped listing gets gone_from_iclass_at."""
    rows = [{'gym_id': gym_id, 'appointment_id': a['appointment_id'], 'raw': a['raw'],
             'bookings_summary': a['bookings_summary'], 'read_at': read_at} for a in appt['appointments']]
    for i in range(0, len(rows), 100):
        _sb('POST', 'iclass_appointment_setup?on_conflict=gym_id,appointment_id', rows[i:i + 100],
            prefer='resolution=merge-duplicates')
    tables = [{'gym_id': gym_id, 'price_table_id': t['id'], 'name': t.get('name'), 'raw': t, 'read_at': read_at,
               'gone_from_iclass_at': None} for t in appt['appointment_price_tables']]
    for i in range(0, len(tables), 200):
        _sb('POST', 'iclass_appointment_price_tables?on_conflict=gym_id,price_table_id', tables[i:i + 200],
            prefer='resolution=merge-duplicates')
    # An empty list is treated as "nothing to mark", never as "every price table is gone".
    if tables:
        ids = ','.join(str(t['price_table_id']) for t in tables)
        _sb('PATCH', f'iclass_appointment_price_tables?gym_id=eq.{gym_id}&price_table_id=not.in.({ids})'
                     f'&gone_from_iclass_at=is.null', {'gone_from_iclass_at': read_at})
    if appt.get('appointments_settings') is not None:
        _sb('POST', 'iclass_gym_settings?on_conflict=gym_id,setting_key',
            [{'gym_id': gym_id, 'setting_key': 'appointments-settings', 'raw': appt['appointments_settings'],
              'read_at': read_at}], prefer='resolution=merge-duplicates')


def read_appointments(source):
    """The appointment part of a read. It runs AFTER the camps and never stops them: a problem here is
    returned as words for the read's note, and the camps are still saved."""
    try:
        appt, err = collect_appointments(source)
    except RuntimeError as e:
        return None, f'appointments STOPPED - {e}'
    if err:
        return None, f'appointments NOT READ - {err}'
    return appt, None


def fetch_gyms():
    rows = _sb('GET', 'gyms?select=id,iclass_slug&order=id') or []
    return {r['id']: r['iclass_slug'] for r in rows if r.get('iclass_slug')}


def _log(line):
    # flush so each gym shows up in Railway's logs the moment it finishes
    print(line, flush=True)


def run_gym(gym_id, slug, source, do_save, what='full', note_prefix=''):
    """Read one gym. Returns a one-line summary {gym, status, said} for the screen and the logs."""
    read_id = start_read(gym_id, what) if do_save else None

    def done(status, said, result=None, note=None):
        _log(f"  [SETUP] {gym_id}: {said}")
        if read_id:
            finish_read(read_id, status, note_prefix + (note or said), result)
        return {'gym': gym_id, 'status': status, 'said': said}

    ok, why = source.sign_in()
    if not ok:
        return done('sign_in_failed', f'NOT READ - {why}')
    try:
        read_at = source.read_time()
        if what == 'prices':
            tables = (source.get('/api/v1/pricing-schedules/') or {}).get('data')
            if tables is None:
                return done('stopped', 'NOT READ - the price tables did not answer')
            if do_save:
                save_prices(gym_id, tables, read_at)
            boxes = sum(len(r) for t in tables for r in (t.get('tableCells') or []))
            return done('ok', f'{len(tables)} price tables, {boxes} price boxes', {'price_tables': tables},
                        note='price tables only')
        result, err = collect(source, slug)
        if not err:
            appt, appt_err = read_appointments(source)
            result['appointment_read'] = appt
            result['appointment_error'] = appt_err
    except RuntimeError as e:
        return done('stopped', f'STOPPED - {e}')
    if err:
        return done('stopped', f'NOT READ - {err}')
    said = (f"{result['camps_listed']} camps listed, {result['camps_kept']} not ended, "
            f"{len(result['camps'])} read, {len(result['camps_missing'])} did not answer, "
            f"{sum(1 for c in result['camps'] if c['occupancy'] is not None)} with per-day counts, "
            f"{sum(1 for c in result['camps'] if c['public_raw'] is not None)} with the public reply, "
            f"{len(result['price_tables'])} price tables, "
            f"{len(result['settings'])} of {len(GYM_SETTINGS_CALLS)} gym settings"
            + (f" (not read: {', '.join(result['settings_missing'])})" if result['settings_missing'] else ''))
    appt = result.get('appointment_read')
    if appt:
        said += (f"; {len(appt['appointments'])} appointments read"
                 + (f", {len(appt['appointments_missing'])} did not answer" if appt['appointments_missing'] else '')
                 + f", {len(appt['appointment_price_tables'])} appointment price tables")
    else:
        said += f"; {result.get('appointment_error')}"
    if do_save:
        save(gym_id, result, read_at)
        if appt:
            save_appointments(gym_id, appt, read_at)
    note = (f"{len(result['camps_missing'])} camps did not answer: {result['camps_missing'][:20]}"
            if result['camps_missing'] else 'every camp answered')
    if result['settings_missing']:
        note += '; gym settings not read: ' + ', '.join(result['settings_missing'])
    if appt and appt['appointments_missing']:
        note += f"; {len(appt['appointments_missing'])} appointments did not answer: {appt['appointments_missing'][:20]}"
    elif not appt:
        note += '; ' + (result.get('appointment_error') or 'appointments not read')
    return done('ok' if not result['camps_missing'] else 'stopped', said, result, note=note)


def run_gyms(gym_ids=None, what='full', do_save=True):
    """Read the given gyms (default: every gym in the gyms table) with the logins in Railway Variables.
    One gym at a time; a gym that fails never stops the others. Returns one summary per gym."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError('SUPABASE_URL / SUPABASE_KEY not set - the gym list comes from the gyms table')
    gyms = fetch_gyms()
    summary = []
    for gym_id in (gym_ids or list(gyms)):
        if gym_id not in gyms:
            _log(f"  [SETUP] {gym_id}: not in the gyms table (or no iclass_slug)")
            summary.append({'gym': gym_id, 'status': 'unknown_gym', 'said': 'not in the gyms table'})
            continue
        # One username at every gym (Jayme made the same one everywhere); a gym can still override it.
        user = os.environ.get(f'ICLASS_SETUP_USER_{gym_id}') or os.environ.get('ICLASS_SETUP_USER')
        pw = os.environ.get(f'ICLASS_SETUP_PASS_{gym_id}')
        if not user or not pw:
            said = f'NOT READ - no ICLASS_SETUP_USER / ICLASS_SETUP_PASS_{gym_id} in Railway Variables'
            _log(f"  [SETUP] {gym_id}: {said}")
            if do_save:
                try:
                    finish_read(start_read(gym_id, what), 'no_login', said)
                except Exception as e:
                    _log(f"  [SETUP] {gym_id}: could not save the 'no login' status - {e}")
            summary.append({'gym': gym_id, 'status': 'no_login', 'said': said})
            continue
        try:
            summary.append(run_gym(gym_id, gyms[gym_id], LiveSource(gyms[gym_id], user, pw), do_save, what))
        except Exception as e:  # one gym's surprise never stops the rest - and is never shown as fine
            _log(f"  [SETUP] {gym_id}: FAILED - {e}")
            summary.append({'gym': gym_id, 'status': 'stopped', 'said': f'FAILED - {e}'})
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--gym', help='gym code from the gyms table')
    ap.add_argument('--all', action='store_true', help='every gym in the gyms table')
    ap.add_argument('--prices', action='store_true', help='read only the price tables')
    ap.add_argument('--har', nargs='+', help='read from F12 recording files instead of iClass')
    ap.add_argument('--save', action='store_true', help='write to Supabase (default: print counts only)')
    a = ap.parse_args()
    if a.save and (not SUPABASE_URL or not SUPABASE_KEY):
        sys.exit('SUPABASE_URL / SUPABASE_SERVICE_KEY not set')
    what = 'prices' if a.prices else 'full'

    if a.har:
        if not a.gym:
            sys.exit('--har needs --gym (the gym the recording is from)')
        src = HarSource(a.har)
        gyms = fetch_gyms() if SUPABASE_URL else {}
        if gyms and src.account and gyms.get(a.gym) != src.account:
            sys.exit(f"the recording is from '{src.account}', not {a.gym} ('{gyms.get(a.gym)}') - stopping")
        run_gym(a.gym, src.account or gyms.get(a.gym), src, a.save, what, note_prefix='from F12 recording; ')
        return

    if not a.all and not a.gym:
        sys.exit('name a gym with --gym, or use --all')
    try:
        run_gyms(None if a.all else [a.gym], what, a.save)
    except RuntimeError as e:
        sys.exit(str(e))


if __name__ == '__main__':
    main()
