"""
Merge a fresh camp audit with the work already on the email - ONE copy of the rule, used by the
Run camp audit job on Railway (camp_audit_job.py) and by scripts/audit_all_gyms.py.

  - Rows from the script are rebuilt from scratch (a rule change reaches every gym).
  - A row tagged by:"eye" (found by reading) or by:"hand" (Jayme edited or added it) is KEPT exactly as it
    is. If it has the same Error + Camp as a script row, the kept row stands in that row's place.
  - `hidden` ([{err, camp}]) = script rows Jayme deleted, or that an eye row replaces: never brought back.
"""
import re

from error_names import name as error_name

KEEP_TAGS = ('eye', 'hand')


def norm_camp(s):
    # group cells were "9 of 10 Ninja Half Day" / "All 10 Ninja Half Day" before 2026-11-10 and are now
    # "9 Ninja Half Day camps" / "All 10 Ninja Half Day camps" (her Estrella wording): one key for both
    s = (s or '').strip()
    m = re.match(r'^(\d+) of \d+ (.+?)( camps)?$', s)
    if m:
        return f"{m.group(1)} {m.group(2)} camps"
    m = re.match(r'^All (\d+) (?!in )(.+?)( camps)?$', s)
    if m:
        return f"All {m.group(1)} {m.group(2)} camps"
    return s


def key(r):
    return ((r.get('err') or '').strip(), norm_camp(r.get('camp')))


def renamed(rows):
    # rows already on the page carry the error's name from when they were written; give them today's
    # fixed name so a kept or deleted row still matches its script twin after a rename (error_names.py)
    return [dict(r, err=error_name(r.get('err'))) for r in rows or []]


def merge(script_rows, page_rows, hidden):
    page_rows = renamed(page_rows)
    hide = {key(h) for h in renamed(hidden)}
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
