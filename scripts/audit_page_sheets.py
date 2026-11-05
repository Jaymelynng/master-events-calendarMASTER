"""
Camp sheets for the Summer Camp Audit page (claude.ai artifact LczbQJLqT3QZmLv59KsiQv, db collection `sheets`).

READ-ONLY on Supabase. Reads the latest signed-in iClass setup read (Railway -> iclass_camp_audit,
iclass_camp_setup, iclass_price_cells, event_type_mappings, gyms) and writes one JSON file per gym:
    <out>/<GYM>.json      the camp sheet, exactly as iClass has it
Claude then writes those files into the page with the ArtifactData tool (`set sheets/<page code>`).

The page's gym codes follow the audit page (AAR / EGF / PGN for three gyms); this database uses
AAG / EAG / PLG. The script never maps codes itself: it keys each file by this database's gym id and
stores the gym's name; the page code is matched by that name against the page's `brands` docs.

Usage:  python scripts/audit_page_sheets.py --from 2027-05-01 --to 2027-09-30 --out <folder>
Needs REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY in .env.local (the app's own read key).
"""
import argparse, html, json, os, re, sys, urllib.parse, urllib.request
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))


def env():
    vals = {}
    for p in (os.path.join(HERE, '..', '.env.local'),):
        if os.path.exists(p):
            for line in open(p, encoding='utf-8'):
                if '=' in line and not line.strip().startswith('#'):
                    k, v = line.strip().split('=', 1)
                    vals[k] = v.strip().strip('"')
    return vals['REACT_APP_SUPABASE_URL'].rstrip('/'), vals['REACT_APP_SUPABASE_ANON_KEY']


URL, KEY = env()


def get(table, params, order):
    """Every row, paged on a unique order (REST stops at 1,000 rows and still says success)."""
    rows, start = [], 0
    while True:
        q = dict(params, order=order)
        req = urllib.request.Request(f"{URL}/rest/v1/{table}?{urllib.parse.urlencode(q)}",
                                     headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}',
                                              'Range': f'{start}-{start + 999}'})
        page = json.load(urllib.request.urlopen(req))
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


# ---- Buckets (same order as src/lib/bucketRules.js): exact gym, exact every gym, word gym, word every gym
def word_match(name, word):
    w = re.escape(word.strip().lower())
    return re.search(rf'(^|[^a-z]){w}s?($|[^a-z])', (name or '').lower()) is not None


def bucket(name, gym, rules):
    low = (name or '').strip().lower()
    exact = [r for r in rules if r.get('match_type') != 'word' and (r['iclass_type_name'] or '').strip().lower() == low]
    hit = next((r for r in exact if r['gym_id'] == gym), None) or next((r for r in exact if not r['gym_id']), None)
    if hit:
        return hit['event_type']
    for g in (gym, None):
        words = [r for r in rules if r.get('match_type') == 'word' and (r['gym_id'] or None) == g and word_match(name, r['iclass_type_name'])]
        if words:
            return max(words, key=lambda r: len(r['iclass_type_name']))['event_type']
    return None


def age_text(v):
    """iClass's own words: 13.9167 -> '13 years 11 months'."""
    if v in (None, ''):
        return None
    n = float(v)
    y, m = int(n), round((n - int(n)) * 12)
    if m == 12:
        y, m = y + 1, 0
    s = f"{y} {'year' if y == 1 else 'years'}"
    return s + (f" {m} {'month' if m == 1 else 'months'}" if m else '')


def clock(sec):
    if sec is None:
        return '?'
    h, mi = divmod(int(sec) // 60, 60)
    ap = 'AM' if h < 12 else 'PM'
    h12 = h % 12 or 12
    return f"{h12}:{mi:02d} {ap}" if mi else f"{h12} {ap}"


def plain(desc_html):
    t = desc_html or ''
    # every line break iClass can store, attributes included (<br data-start="860" />) - a missed
    # one glues two lines together and reads as a typo that parents never see (SGT "pre-paid.All", 2026-11-05)
    t = re.sub(r'(?i)<br\b[^>]*>', '\n', t)
    t = re.sub(r'(?i)</(p|div|li|h\d|tr|ul|ol|table|blockquote)\s*>', '\n', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    return re.sub(r'\n\s*\n+', '\n', t).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='frm', required=True)
    ap.add_argument('--to', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    gyms = get('gyms', {'select': 'id,name,iclass_slug'}, 'id.asc')
    rules = [r for r in get('event_type_mappings', {'select': 'id,iclass_type_name,gym_id,match_type,event_type,is_active'}, 'id.asc') if r.get('is_active')]
    all_camps = get('iclass_camp_audit', {'select': 'gym_id,camp_id,read_at', 'gone_from_iclass_at': 'is.null'}, 'gym_id.asc,camp_id.asc')
    camps = get('iclass_camp_audit', {'select': '*', 'start_date': f'gte.{a.frm}', 'gone_from_iclass_at': 'is.null'}, 'gym_id.asc,camp_id.asc')
    camps = [c for c in camps if c['start_date'] <= a.to]
    setups = {(s['gym_id'], s['camp_id']): s for s in get('iclass_camp_setup', {'select': 'gym_id,camp_id,raw'}, 'gym_id.asc,camp_id.asc')}
    cells = get('iclass_price_cells', {'select': 'gym_id,price_table_id,price_table_name,child_number,days,amount'}, 'gym_id.asc,price_table_id.asc,child_number.asc,days.asc')

    for g in gyms:
        gid = g['id']
        mine = sorted([c for c in camps if c['gym_id'] == gid], key=lambda c: (c['start_date'], c['camp_type_name'] or '', c['camp_name'] or ''))
        # when this gym was last read (any camp, so a gym with no camps in the window still shows its read time)
        read_at = max((c['read_at'] or '' for c in all_camps if c['gym_id'] == gid), default=None)
        out_camps, ages, tables = [], defaultdict(lambda: defaultdict(int)), OrderedDict()
        for c in mine:
            raw = (setups.get((gid, c['camp_id'])) or {}).get('raw') or {}
            days = []
            for sch in raw.get('schedule') or []:
                for b in sch.get('blocks') or []:
                    days.append({'date': b.get('date'), 'start': clock(sch.get('startTimeInt')), 'end': clock(sch.get('endTimeInt'))})
            days.sort(key=lambda d: d['date'] or '')
            amin, amax = age_text(c['min_age']), age_text(c['max_age'])
            age = f"{amin} – {amax}" if amin and amax else (f"{amin} and up" if amin else (f"up to {amax}" if amax else 'not set'))
            ages[c['camp_type_name'] or 'No camp type'][age] += 1
            if c['price_table_id'] is not None:
                t = tables.setdefault(c['price_table_id'], {'schedule': c['price_table_name'], 'campCount': 0, 'types': []})
                t['campCount'] += 1
                if c['camp_type_name'] not in t['types']:
                    t['types'].append(c['camp_type_name'])
            out_camps.append({
                'id': str(c['camp_id']), 'name': c['camp_name'], 'type': c['camp_type_name'], 'typeId': c['camp_type_id'],
                'bucket': bucket(c['camp_type_name'], gid, rules),
                'link': f"https://portal.iclasspro.com/{g['iclass_slug']}/camp-details/{c['camp_id']}?typeId={c['camp_type_id']}" if g.get('iclass_slug') else None,
                'start': c['start_date'], 'end': c['end_date'], 'days': len(days) or None, 'dayList': days,
                'ages': age, 'singleDay': c['per_day_signup'], 'showOnWeb': c['show_on_web'], 'allowRegistration': c['allow_registration'],
                'regStart': c['registration_start'], 'regEnd': c['registration_end'], 'maxKids': c['max_entries'],
                'waitlistRequests': c['waitlist_requests'], 'priceTable': c['price_table_name'],
                'picture': f"https://images.iclasspro.com/images/{c['picture_path']}" if c.get('picture_path') else None,
                'description': plain(c['description_html']),
            })
        pricing = []
        for tid, t in tables.items():
            mine_cells = [x for x in cells if x['gym_id'] == gid and x['price_table_id'] == tid]
            dcols = sorted({x['days'] for x in mine_cells})
            rows = []
            for k in sorted({x['child_number'] for x in mine_cells}):
                by = {x['days']: x['amount'] for x in mine_cells if x['child_number'] == k}
                rows.append({'child': k, 'amounts': [None if by.get(d) is None else (int(by[d]) if float(by[d]).is_integer() else round(float(by[d]), 2)) for d in dcols]})
            pricing.append(dict(t, days=dcols, rows=rows))
        doc = {
            'dbCode': gid, 'name': g['name'], 'slug': g.get('iclass_slug'),
            'pulled': (read_at or '')[:16].replace('T', ' ') or None,
            'source': 'Signed-in iClass setup read (Railway) -> iclass_camp_audit',
            'window': [a.frm, a.to], 'campCount': len(out_camps),
            'types': sorted({c['type'] or 'No camp type' for c in out_camps}),
            'pricing': pricing,
            'ages': [{'type': t, 'count': sum(v.values()), 'ages': [{'ages': k, 'camps': n} for k, n in v.items()]} for t, v in ages.items()],
            'camps': out_camps,
        }
        json.dump(doc, open(os.path.join(a.out, f'{gid}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print(f"{gid}: {len(out_camps)} camps, {len(pricing)} price tables, read {doc['pulled']}, {os.path.getsize(os.path.join(a.out, gid + '.json'))} bytes")


if __name__ == '__main__':
    sys.exit(main())
