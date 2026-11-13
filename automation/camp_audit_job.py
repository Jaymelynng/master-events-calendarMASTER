"""
The Run camp audit button (Admin > Camp Audit, step 1 - Jayme 2026-11-11: "Yes, start step 1").

POST /camp-audit {"gyms": ["AAG", ...]} (local_api_server.py) starts start_run(); it answers at once and this
file works through the gyms one at a time in the background. Every step is written to Supabase, so the app's
progress bar shows what really happened - never a guess:
  camp_audit_runs         one press: which gyms, running / done / failed / stopped
  camp_audit_gym_results  one gym: waiting / running / done / failed, the step it is on, its rows

Per gym it runs the SAME audit as on her PC (camp_audit.py, the one copy of every rule) with the Standards
settings from camp_audit_standards, then merges the rows with her own work (camp_audit_gym_state: rows she
edited or added, rows found by reading, rows she deleted) using camp_audit_merge.py - the merge the audit
page used. READ-ONLY on iClass and on every existing table; it writes only the camp_audit_* tables.
"""
import json, os, subprocess, sys, tempfile, threading, traceback
from datetime import datetime, timezone

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '') or os.environ.get('SUPABASE_KEY', '')
STANDARDS_ID = os.environ.get('CAMP_AUDIT_STANDARDS', 'summer-2027')

_lock = threading.Lock()
_running = {'run_id': None}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _sb(method, path, body=None, prefer=None):
    headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}
    if prefer:
        headers['Prefer'] = prefer
    r = requests.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, data=None if body is None else json.dumps(body), timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"Supabase {method} {path.split('?')[0]}: {r.status_code} {r.text[:300]}")
    return r.json() if r.text else None


def _log(msg):
    print(f"[CAMP AUDIT] {msg}", flush=True)


def close_cut_off_runs():
    """A run cut off by a Railway restart is marked stopped - never left 'running' on her screen."""
    note = 'cut off - the server restarted during this run'
    _sb('PATCH', 'camp_audit_gym_results?status=in.(running,waiting)', {'status': 'failed', 'error': note, 'finished_at': _now()})
    rows = _sb('PATCH', 'camp_audit_runs?status=eq.running', {'status': 'stopped', 'note': note, 'finished_at': _now()}, prefer='return=representation')
    return len(rows or [])


def current():
    """The run in progress, if any (only one at a time: two presses never audit the same gym twice at once)."""
    rows = _sb('GET', 'camp_audit_runs?status=eq.running&order=id.desc&limit=1')
    return rows[0] if rows else None


def start_run(gyms):
    """Make the run + one waiting row per gym, start the background worker, answer with the run id."""
    with _lock:
        live = current()
        if live:
            return {'started': False, 'run_id': live['id'], 'reason': 'a camp audit is already running'}
        known = [g['id'] for g in _sb('GET', 'gyms?select=id&order=id.asc')]   # the gyms table, never a typed list
        gyms = [g for g in (gyms or known) if g in known]
        if not gyms:
            return {'started': False, 'reason': 'no gyms picked'}
        run = _sb('POST', 'camp_audit_runs', [{'gyms': gyms, 'status': 'running'}], prefer='return=representation')[0]
        _sb('POST', 'camp_audit_gym_results', [{'run_id': run['id'], 'gym_id': g, 'status': 'waiting'} for g in gyms])
        _running['run_id'] = run['id']
    threading.Thread(target=_work, args=(run['id'], gyms), daemon=True).start()
    _log(f"run {run['id']} started: {', '.join(gyms)}")
    return {'started': True, 'run_id': run['id'], 'gyms': gyms}


def _set(run_id, gym, **patch):
    _sb('PATCH', f"camp_audit_gym_results?run_id=eq.{run_id}&gym_id=eq.{gym}", patch)


def _work(run_id, gyms):
    failed = 0
    try:
        std = (_sb('GET', f"camp_audit_standards?id=eq.{STANDARDS_ID}&select=settings") or [{}])[0].get('settings') or {}
        if not (std.get('window') and std.get('launch')):
            raise RuntimeError(f"camp_audit_standards '{STANDARDS_ID}' has no summer window or launch date")
        tmp = tempfile.mkdtemp(prefix='camp_audit_')
        std_file = os.path.join(tmp, 'standards.json')
        json.dump({'settings': std}, open(std_file, 'w', encoding='utf-8'))
        for g in gyms:
            try:
                _one_gym(run_id, g, std_file, tmp)
            except Exception as e:   # one gym failing never stops the others
                failed += 1
                _log(f"run {run_id} {g}: FAILED - {e}")
                _set(run_id, g, status='failed', error=str(e)[:2000], finished_at=_now(), step=None)
        _sb('PATCH', f"camp_audit_runs?id=eq.{run_id}", {'status': 'done', 'finished_at': _now(),
                                                         'note': f"{len(gyms) - failed} of {len(gyms)} gyms audited" + (f", {failed} failed" if failed else '')})
        _log(f"run {run_id} done: {len(gyms) - failed} of {len(gyms)} ok")
    except Exception as e:
        _log(f"run {run_id} FAILED - {e}\n{traceback.format_exc()}")
        try:
            _sb('PATCH', f"camp_audit_runs?id=eq.{run_id}", {'status': 'failed', 'finished_at': _now(), 'note': str(e)[:2000]})
            _sb('PATCH', f"camp_audit_gym_results?run_id=eq.{run_id}&status=in.(running,waiting)", {'status': 'failed', 'error': 'the run stopped: ' + str(e)[:500], 'finished_at': _now()})
        except Exception:
            pass
    finally:
        _running['run_id'] = None


EDITABLE = ('rows', 'hidden', 'subject', 'gm', 'intro', 'signoff', 'status')
STATUSES = ('not', 'missing', 'auditing', 'ready', 'sent')


def save_gym_edit(gym, patch):
    """Jayme's edit to one gym's email (Admin > Camp Audit, step 2). Saved to camp_audit_gym_state - the work the
    next run merges with (camp_audit_merge.py: rows tagged by:'hand' are kept, `hidden` rows never come back) -
    and, when rows change, onto the gym's newest finished result so the screen shows it at once."""
    known = [x['id'] for x in _sb('GET', 'gyms?select=id&order=id.asc')]
    if gym not in known:
        raise ValueError(f"unknown gym {gym!r}")
    clean = {k: v for k, v in (patch or {}).items() if k in EDITABLE}
    if not clean:
        raise ValueError('nothing to save')
    if 'status' in clean and clean['status'] not in STATUSES:
        raise ValueError(f"unknown status {clean['status']!r}")
    for k in ('rows', 'hidden'):
        if k in clean and not (isinstance(clean[k], list) and all(isinstance(r, dict) for r in clean[k])):
            raise ValueError(f"{k} must be a list of rows")
    if 'rows' in clean:
        clean['rows'] = [{f: r.get(f) for f in ('err', 'camp', 'note', 'href', 'by') if r.get(f) is not None} for r in clean['rows']]
    if 'hidden' in clean:
        clean['hidden'] = [{'err': h.get('err'), 'camp': h.get('camp')} for h in clean['hidden']]
    state = _sb('PATCH', f"camp_audit_gym_state?gym_id=eq.{gym}", clean, prefer='return=representation')
    if not state:
        raise ValueError(f"{gym} has no saved audit email yet")
    if 'rows' in clean:
        latest = _sb('GET', f"camp_audit_gym_results?gym_id=eq.{gym}&status=eq.done&order=finished_at.desc&limit=1&select=id")
        if latest:
            _sb('PATCH', f"camp_audit_gym_results?id=eq.{latest[0]['id']}", {'rows': clean['rows']})
    return sorted(clean)


def _one_gym(run_id, g, std_file, tmp):
    from camp_audit_merge import merge
    _set(run_id, g, status='running', started_at=_now(), step='Checking every camp against its iClass settings')
    # when iClass was last read for this gym (not when the audit runs): the newest finished setup read
    read = _sb('GET', f"iclass_setup_reads?gym_id=eq.{g}&finished_at=not.is.null&order=finished_at.desc&limit=1&select=finished_at,status")
    source_read_at = read[0]['finished_at'] if read else None
    out = os.path.join(tmp, g)
    cmd = [sys.executable, os.path.join(HERE, 'camp_audit.py'), g, '--standards', std_file, '--out', out]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=dict(os.environ, PYTHONIOENCODING='utf-8'), timeout=1800)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or 'camp_audit.py failed')[-1500:])
    email = json.load(open(os.path.join(out, f'{g}_email.json'), encoding='utf-8'))
    cov_f = os.path.join(out, f'{g}_coverage.json')
    coverage = json.load(open(cov_f, encoding='utf-8')) if os.path.exists(cov_f) else {}
    _set(run_id, g, step='Merging with your own rows and deleted rows')
    state = (_sb('GET', f"camp_audit_gym_state?gym_id=eq.{g}&select=rows,hidden") or [{}])[0]
    rows = merge(email.get('rows') or [], state.get('rows') or [], state.get('hidden'))
    _set(run_id, g, status='done', finished_at=_now(), step=None, source_read_at=source_read_at, camp_count=len(coverage),
         script_rows=email.get('rows') or [], rows=rows, confirmed=email.get('confirmed') or '', coverage=coverage)
    _log(f"run {run_id} {g}: {len(coverage)} camps, {len(rows)} rows")
