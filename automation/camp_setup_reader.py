#!/usr/bin/env python3
"""
Camp setup reader — signed-in, READ ONLY.

Reads what the public feed can't: hidden camps, Show on Web / Allow Registration, Maximum Number of
Entries, each camp's price table, and per-day sign-ups. Saves every reply WHOLE into:
  iclass_camp_setup   (one row per camp that has not ended, hidden ones included)
  iclass_price_tables (one row per price table; view iclass_price_cells flattens it)
  iclass_setup_reads  (one row per gym per read — "ok" or why it was NOT read)

Runs AFTER the normal sync and never touches the events table, so the public sync is unchanged.

Login per gym, typed by Jayme into Railway Variables (never in code or chat):
  ICLASS_SETUP_USER_<GYM CODE>, ICLASS_SETUP_PASS_<GYM CODE>   e.g. ICLASS_SETUP_USER_SGT
A gym with no login is recorded as 'no_login' — its checks show "setup not read", never "no errors".

Test without a login (from one of Jayme's F12 recordings, nothing sent to iClass):
  python camp_setup_reader.py --har "<part 1>.har" "<part 2>.har" --gym CCP [--save]
Live:
  python camp_setup_reader.py --gym SGT [--save]      (or --all)
Without --save it prints counts only.
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from http.cookiejar import CookieJar
from urllib.parse import quote, urlencode
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
]


def _allowed(path):
    return any(re.fullmatch(p, path) for p in ALLOWED_GETS)


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


class HarSource:
    """Serves the same calls from Jayme's F12 recording. Sends nothing to iClass."""

    def __init__(self, har_files):
        self.replies = {}
        self.account = None
        self.recorded_at = None
        for f in har_files:
            with open(f, encoding='utf-8') as fh:
                entries = json.load(fh)['log']['entries']
            for e in entries:
                if e['request']['method'] != 'GET' or 'iclasspro.com/api/' not in e['request']['url']:
                    continue
                path = e['request']['url'].split('iclasspro.com', 1)[1].split('?')[0]
                if not _allowed(path):
                    continue
                text = (e['response'].get('content') or {}).get('text')
                if e['response']['status'] != 200 or not text:
                    continue
                try:
                    self.replies[path] = json.loads(text)
                except ValueError:
                    continue
                if not self.recorded_at or e['startedDateTime'] > self.recorded_at:
                    self.recorded_at = e['startedDateTime']
                for h in e['request']['headers']:
                    if h['name'].lower() == 'x-icp-account':
                        self.account = h['value']

    def sign_in(self):
        return True, 'recording'

    def read_time(self):
        # When iClass actually sent these replies, not when the file was loaded.
        return self.recorded_at or datetime.now(timezone.utc).isoformat()

    def get(self, path):
        if not _allowed(path):
            raise RuntimeError(f"refused: {path} is not on the read-only list")
        return self.replies.get(path)


def collect(source, today=None):
    """Every price table + every camp that has not ended (hidden ones included), each reply whole."""
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
        camps.append({'camp_id': camp_id, 'raw': detail, 'occupancy': occ.get('data') if occ else None})
    return {'price_tables': tables, 'camps': camps, 'camps_listed': len(listing),
            'camps_kept': len(keep), 'camps_missing': missing}, None


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


def start_read(gym_id):
    row = _sb('POST', 'iclass_setup_reads', [{'gym_id': gym_id, 'status': 'running'}], prefer='return=representation')
    return row[0]['id']


def finish_read(read_id, status, note, result=None):
    patch = {'status': status, 'note': note, 'finished_at': datetime.now(timezone.utc).isoformat()}
    if result:
        patch.update({'camps_listed': result['camps_listed'], 'camps_read': len(result['camps']),
                      'price_tables_read': len(result['price_tables'])})
    _sb('PATCH', f'iclass_setup_reads?id=eq.{read_id}', patch)


def save(gym_id, result, read_at):
    """Upsert every row, then drop this gym's rows the read no longer saw (camp ended or deleted)."""
    tables = [{'gym_id': gym_id, 'price_table_id': t['id'], 'name': t.get('name'), 'raw': t, 'read_at': read_at}
              for t in result['price_tables']]
    camps = [{'gym_id': gym_id, 'camp_id': c['camp_id'], 'raw': c['raw'], 'occupancy': c['occupancy'],
              'read_at': read_at} for c in result['camps']]
    for i in range(0, len(tables), 200):
        _sb('POST', 'iclass_price_tables?on_conflict=gym_id,price_table_id', tables[i:i + 200],
            prefer='resolution=merge-duplicates')
    for i in range(0, len(camps), 100):
        _sb('POST', 'iclass_camp_setup?on_conflict=gym_id,camp_id', camps[i:i + 100],
            prefer='resolution=merge-duplicates')
    # Only after every row above saved: remove what this full read did not see.
    _sb('DELETE', f'iclass_price_tables?gym_id=eq.{gym_id}&read_at=lt.{quote(read_at)}')
    _sb('DELETE', f'iclass_camp_setup?gym_id=eq.{gym_id}&read_at=lt.{quote(read_at)}')


def fetch_gyms():
    rows = _sb('GET', 'gyms?select=id,iclass_slug&order=id') or []
    return {r['id']: r['iclass_slug'] for r in rows if r.get('iclass_slug')}


def run_gym(gym_id, source, do_save, note_prefix=''):
    read_id = start_read(gym_id) if do_save else None
    ok, why = source.sign_in()
    if not ok:
        print(f"  [SETUP] {gym_id}: NOT READ - {why}")
        if read_id:
            finish_read(read_id, 'sign_in_failed', why)
        return
    try:
        read_at = source.read_time()
        result, err = collect(source)
    except RuntimeError as e:
        print(f"  [SETUP] {gym_id}: STOPPED - {e}")
        if read_id:
            finish_read(read_id, 'stopped', str(e))
        return
    if err:
        print(f"  [SETUP] {gym_id}: NOT READ - {err}")
        if read_id:
            finish_read(read_id, 'stopped', err)
        return
    print(f"  [SETUP] {gym_id}: {result['camps_listed']} camps listed, {result['camps_kept']} not ended, "
          f"{len(result['camps'])} read, {len(result['camps_missing'])} did not answer, "
          f"{sum(1 for c in result['camps'] if c['occupancy'] is not None)} with per-day counts, "
          f"{len(result['price_tables'])} price tables")
    if do_save:
        save(gym_id, result, read_at)
        status = 'ok' if not result['camps_missing'] else 'stopped'
        note = note_prefix + (f"{len(result['camps_missing'])} camps did not answer: {result['camps_missing'][:20]}"
                              if result['camps_missing'] else 'every camp answered')
        finish_read(read_id, status, note, result)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--gym', help='gym code from the gyms table')
    ap.add_argument('--all', action='store_true', help='every gym in the gyms table')
    ap.add_argument('--har', nargs='+', help='read from F12 recording files instead of iClass')
    ap.add_argument('--save', action='store_true', help='write to Supabase (default: print counts only)')
    a = ap.parse_args()
    if a.save and (not SUPABASE_URL or not SUPABASE_KEY):
        sys.exit('SUPABASE_URL / SUPABASE_SERVICE_KEY not set')

    if a.har:
        if not a.gym:
            sys.exit('--har needs --gym (the gym the recording is from)')
        src = HarSource(a.har)
        gyms = fetch_gyms() if SUPABASE_URL else {}
        if gyms and src.account and gyms.get(a.gym) != src.account:
            sys.exit(f"the recording is from '{src.account}', not {a.gym} ('{gyms.get(a.gym)}') - stopping")
        run_gym(a.gym, src, a.save, note_prefix='from F12 recording; ')
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit('SUPABASE_URL / SUPABASE_KEY not set - the gym list comes from the gyms table')
    gyms = fetch_gyms()
    targets = list(gyms) if a.all else [a.gym]
    for gym_id in targets:
        if gym_id not in gyms:
            print(f"  [SETUP] {gym_id}: not in the gyms table (or no iclass_slug)")
            continue
        user = os.environ.get(f'ICLASS_SETUP_USER_{gym_id}')
        pw = os.environ.get(f'ICLASS_SETUP_PASS_{gym_id}')
        if not user or not pw:
            print(f"  [SETUP] {gym_id}: NOT READ - no login set in Railway Variables")
            if a.save:
                finish_read(start_read(gym_id), 'no_login', 'no ICLASS_SETUP_USER / ICLASS_SETUP_PASS for this gym')
            continue
        run_gym(gym_id, LiveSource(gyms[gym_id], user, pw), a.save)


if __name__ == '__main__':
    main()
