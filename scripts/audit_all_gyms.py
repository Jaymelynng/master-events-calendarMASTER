"""
ONE run for every gym: re-runs the summer camp audit (camp_audit.py) for every gym in the calendar's
`gyms` table and builds each gym's new audit-email rows for the audit page, merged with what is on the page.

Why (Jayme 2026-11-05): "as we're making these rules and changes it's going in a script that edits all the
gyms - I don't want to have to go to all gyms and make the same changes." A rule changes ONCE in
camp_audit.py; this run carries it to every gym's email.

READ-ONLY on Supabase. It does not write the page itself: the page's rows live in the audit page's own
database (claude.ai artifact LczbQJLqT3QZmLv59KsiQv), which only Claude's ArtifactData tool can write.
So Claude: (1) downloads the page's `gyms` + `sheets` collections into --page, (2) runs this,
(3) uploads <out>/<code>.json files in one batch, pinned to each doc's version (UPLOAD.txt lists them).

MERGE RULES - what a re-run keeps and what it replaces:
  - A gym whose status is Sent or Ready to send is NEVER touched.
  - Rows from the script are rebuilt from scratch (a rule change reaches every gym).
  - A row tagged by:"eye" (Claude found it by looking at pictures / reading descriptions) or by:"hand"
    (Jayme edited or added it on the page - the page tags it) is KEPT exactly as it is. If a kept row
    has the same Error + Camp as a script row, the kept row wins and stands in that row's place.
  - The page doc's `hidden` list ([{err, camp}]) = script rows Jayme deleted on the page, or that an
    eye row replaces. A hidden row never comes back.
  - Subject, To, intro, Confirmed and sign-off are never overwritten; if the script's Confirmed block
    differs from the page's, the run says so (prices or ages changed in iClass).
  - Gyms in the `gyms` table with no doc on the page are listed, not created.

Usage:
  python scripts/audit_all_gyms.py --page <folder with gyms/ and sheets/> --out <folder>
      --from 2027-05-01 --to 2027-09-30 --launch 2026-11-16 --due 2026-11-09
"""
import argparse, glob, json, os, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit_page_sheets import get  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KEEP_TAGS = ('eye', 'hand')
SKIP_STATUS = ('sent', 'ready')


def key(r):
    return ((r.get('err') or '').strip(), (r.get('camp') or '').strip())


def merge(script_rows, page_rows, hidden):
    hide = {key(h) for h in hidden or []}
    kept = [r for r in page_rows if r.get('by') in KEEP_TAGS]
    kept_by_key = {}
    for r in kept:
        kept_by_key.setdefault(key(r), []).append(r)
    out, used = [], set()
    for r in script_rows:
        k = key(r)
        if k in kept_by_key:                       # her edit / Claude's eye row stands in its place
            for kr in kept_by_key[k]:
                if id(kr) not in used:
                    out.append(kr); used.add(id(kr))
            continue
        if k in hide:
            continue
        out.append(r)
    # Kept rows with no script twin go back where they sat on the page: right after the row that was above
    # them (matched by Error + Camp); if that row is gone, after the last row with the same Error; else at the end.
    for idx, r in enumerate(page_rows):
        if r.get('by') not in KEEP_TAGS or id(r) in used:
            continue
        at = None
        for prev in reversed(page_rows[:idx]):
            hit = [i for i, x in enumerate(out) if key(x) == key(prev)]
            if hit:
                at = hit[-1]; break
        if at is None:
            at = max((i for i, x in enumerate(out) if x.get('err') == r.get('err')), default=-1)
        out.insert(at + 1, r); used.add(id(r))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True, help='folder holding the downloaded page collections gyms/ and sheets/')
    ap.add_argument('--out', required=True)
    # Normally all four come from the Standards page ("Dates the audit uses"), downloaded into
    # <page>/standards/summer-2027.json; typing one here overrides it for this run only.
    ap.add_argument('--from', dest='frm')
    ap.add_argument('--to')
    ap.add_argument('--launch')
    ap.add_argument('--due')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    runs = os.path.join(a.out, '_script')
    os.makedirs(runs, exist_ok=True)
    std_path = os.path.join(a.page, 'standards', 'summer-2027.json')
    settings = (json.load(open(std_path, encoding='utf-8')).get('settings') or {}) if os.path.exists(std_path) else {}
    window = [a.frm or (settings.get('window') or [None, None])[0], a.to or (settings.get('window') or [None, None])[1]]
    print(f"Dates from the Standards page: launch {a.launch or settings.get('launch')}, due {a.due or settings.get('due')}, "
          f"summer camps {window[0]} to {window[1]}, closures {[c.get('date') for c in settings.get('closures') or []]}")

    page = {os.path.basename(f)[:-5]: json.load(open(f, encoding='utf-8')) for f in glob.glob(os.path.join(a.page, 'gyms', '*.json'))}
    # page code (AAR, EGF, PGN ...) <-> calendar code (AAG, EAG, PLG ...): the camp sheets carry both
    db_to_page = {}
    for f in glob.glob(os.path.join(a.page, 'sheets', '*.json')):
        s = json.load(open(f, encoding='utf-8'))
        db_to_page[s.get('dbCode') or s.get('code')] = s.get('code') or os.path.basename(f)[:-5]

    gyms = [g['id'] for g in get('gyms', {'select': 'id'}, 'id.asc')]   # every gym, never a typed list
    plan, skipped, missing = [], [], []
    for gid in gyms:
        code = db_to_page.get(gid, gid)
        doc = page.get(code)
        if doc is None:
            missing.append(gid); continue
        if (doc.get('status') or '').lower() in SKIP_STATUS:
            skipped.append(f"{code} ({doc.get('status')})")
        plan.append((gid, code, doc))   # every gym is audited (the camp sheet's per-camp record); Sent/Ready rows stay as they are

    print(f"Will audit {len(plan)} gyms: {', '.join(c for _, c, _ in plan)}")
    print(f"Email rows not touched (sent / ready to send): {', '.join(skipped) or 'none'}")
    if missing:
        print(f"In the gyms table but not on the audit page (not created): {', '.join(missing)}")

    upload = []
    coverage = {}   # calendar gym code -> {camp id: {on, checks, found}} from camp_audit.py
    for gid, code, doc in plan:
        cmd = [sys.executable, os.path.join(HERE, 'camp_audit.py'), gid, '--out', runs]
        if os.path.exists(std_path):
            cmd += ['--standards', std_path]
        for flag, v in (('--from', a.frm), ('--to', a.to), ('--launch', a.launch), ('--due', a.due)):
            if v:
                cmd += [flag, v]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
        if r.returncode != 0:
            print(f"  {code}: AUDIT FAILED - page left as it is\n{r.stderr[-800:]}")
            continue
        cov_f = os.path.join(runs, f'{gid}_coverage.json')
        coverage[gid] = json.load(open(cov_f, encoding='utf-8')) if os.path.exists(cov_f) else {}
        if (doc.get('status') or '').lower() in SKIP_STATUS:
            continue   # Sent / Ready: the email rows are never touched
        new = json.load(open(os.path.join(runs, f'{gid}_email.json'), encoding='utf-8'))
        old_rows = doc.get('rows') or []
        rows = merge(new['rows'], old_rows, doc.get('hidden'))
        ok = lambda rs: [(x.get('err'), x.get('camp'), x.get('note')) for x in rs]
        added = [x for x in ok(rows) if x not in ok(old_rows)]
        gone = [x for x in ok(old_rows) if x not in ok(rows)]
        kept = sum(1 for x in rows if x.get('by') in KEEP_TAGS)
        note = '' if (new.get('confirmed') or '') == (doc.get('confirmed') or '') or not new.get('confirmed') else '  | Confirmed block differs from the page - check prices/ages'
        print(f"  {code}: {len(old_rows)} -> {len(rows)} rows ({kept} kept by eye/hand, +{len(added)} new, -{len(gone)} gone){note}")
        for x in added:
            print(f"      + {x[0]} | {x[1]} | {x[2][:110]}")
        for x in gone:
            print(f"      - {x[0]} | {x[1]} | {x[2][:110]}")
        if added or gone:
            json.dump({'rows': rows}, open(os.path.join(a.out, f'{code}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
            upload.append(f'gyms/{code}')

    # The camp sheets (the gym data tab) for EVERY gym on the page - sheets are data, so Sent / Ready gyms too.
    sheets_dir = os.path.join(a.out, '_sheets')
    r = subprocess.run([sys.executable, os.path.join(HERE, 'audit_page_sheets.py'), '--from', window[0], '--to', window[1], '--out', sheets_dir],
                       capture_output=True, text=True, encoding='utf-8', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    if r.returncode != 0:
        print("CAMP SHEETS FAILED - sheets left as they are")
        print(r.stderr[-800:])
    else:
        os.makedirs(os.path.join(a.out, 'sheets'), exist_ok=True)
        for f in sorted(glob.glob(os.path.join(a.page, 'sheets', '*.json'))):
            old = json.load(open(f, encoding='utf-8'))
            code, gid = old.get('code') or os.path.basename(f)[:-5], old.get('dbCode') or old.get('code')
            nf = os.path.join(sheets_dir, f'{gid}.json')
            if not os.path.exists(nf):
                print(f"  sheet {code}: not rebuilt (no {gid} in the gyms table)"); continue
            new = dict(json.load(open(nf, encoding='utf-8')), code=code)
            # each camp carries its audit record (what checks ran on it, what they found); a camp the audit
            # did not cover gets none, and the sheet shows it as not audited
            cov = coverage.get(gid) or {}
            for cp in new.get('camps') or []:
                if str(cp.get('id')) in cov:
                    cp['audit'] = cov[str(cp.get('id'))]
            strip = lambda cs: [{k: v for k, v in c.items() if k != 'audit'} | ({'audit': {k: v for k, v in c['audit'].items() if k != 'on'}} if c.get('audit') else {}) for c in (cs or [])]
            same = all(json.dumps(old.get(k), sort_keys=True) == json.dumps(new.get(k), sort_keys=True) for k in ('pricing', 'ages', 'types', 'campCount')) \
                and json.dumps(strip(old.get('camps')), sort_keys=True) == json.dumps(strip(new.get('camps')), sort_keys=True)
            if not same:
                json.dump(new, open(os.path.join(a.out, 'sheets', f'{code}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
                upload.append(f'sheets/{code}')
                print(f"  sheet {code}: changed ({old.get('campCount')} -> {new.get('campCount')} camps, read {new.get('pulled')})")
    # New camp pictures (not yet copied into the page): downloaded + resized for Claude to upload
    r = subprocess.run([sys.executable, os.path.join(HERE, 'camp_pictures.py'), '--page', a.page, '--out', os.path.join(a.out, 'pictures')],
                       capture_output=True, text=True, encoding='utf-8', env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    print('Pictures: ' + (r.stdout.strip() or r.stderr.strip()[-400:]))
    with open(os.path.join(a.out, 'UPLOAD.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(upload))
    print(f"To upload ({len(upload)}): {', '.join(upload) or 'nothing changed'}")


if __name__ == '__main__':
    main()
