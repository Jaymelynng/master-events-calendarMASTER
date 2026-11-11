"""
The PARENT side of the camp audit: what the public iClass portal shows right now, camp by camp,
next to the signed-in setup read (iclass_camp_audit). READ-ONLY; no login.

For one gym it answers:
  - which camps parents can find in the portal camp lists (and which they cannot, and why)
  - whether each camp's name / dates / description / picture on the portal still match the setup read
    (a mismatch = the gym edited the camp after the read -> re-read before trusting the audit)

Public API (memory note reference_iclasspro_open_api): /locations, /bookings/{loc}, /camps?locationId&typeId,
/camps/{id}. locationId is not always 1 - read it.

Usage:  python scripts/portal_check.py HGA --from 2027-05-01 --to 2027-09-30 --out <folder>
"""
import argparse, json, os, re, sys, urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'automation'))
from audit_page_sheets import get, plain  # noqa: E402

API = 'https://app.iclasspro.com/api/open/v1'


def pub(path):
    req = urllib.request.Request(f"{API}/{path}", headers={'x_icp_source': 'portal', 'Accept': 'application/json', 'User-Agent': 'camp-audit'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        return {'error': str(e)}


def norm(s):
    return re.sub(r'\s+', ' ', (s or '')).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('gym'); ap.add_argument('--from', dest='frm', required=True); ap.add_argument('--to', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    G = a.gym.upper()
    gym = get('gyms', {'select': 'id,iclass_slug', 'id': f'eq.{G}'}, 'id.asc')[0]
    slug = gym['iclass_slug']
    camps = [c for c in get('iclass_camp_audit', {'select': '*', 'gym_id': f'eq.{G}', 'start_date': f'gte.{a.frm}', 'gone_from_iclass_at': 'is.null'}, 'camp_id.asc') if c['start_date'] <= a.to]

    locs = (pub(f"{slug}/locations").get('data') or [])
    listed = {}
    for loc in locs:
        lid = loc.get('id')
        types = {c['camp_type_id'] for c in camps}
        for tid in sorted(t for t in types if t is not None):
            page = 1
            while True:
                r = pub(f"{slug}/camps?locationId={lid}&typeId={tid}&limit=24&page={page}&sortBy=time")
                data = r.get('data') or []
                new = [x for x in data if x.get('id') not in listed]
                for x in data:
                    listed[x.get('id')] = x
                if not data or not new or page > 40:   # the portal pages by 24; stop when a page adds nothing
                    break
                page += 1

    out = []
    for c in camps:
        det = pub(f"{slug}/camps/{c['camp_id']}").get('data') or {}
        d_name, d_desc = norm(det.get('name')), norm(plain(det.get('description') or ''))
        b_name, b_desc = norm(c['camp_name']), norm(plain(c['description_html']))
        img = det.get('image') or ''
        out.append({
            'camp_id': c['camp_id'], 'name': c['camp_name'],
            'in_portal_list': c['camp_id'] in listed,
            'portal_page_exists': bool(det),
            'show_on_web': c['show_on_web'], 'allow_registration': c['allow_registration'],
            'registration_end': c['registration_end'],
            'portal_openings': det.get('openings'),
            'name_changed_since_read': bool(det) and d_name != b_name,
            'description_changed_since_read': bool(det) and d_desc != b_desc,
            'portal_name': det.get('name') if bool(det) and d_name != b_name else None,
            'picture_on_portal': img,
            'picture_in_read': c['picture_path'] or '',
        })
    os.makedirs(a.out, exist_ok=True)
    json.dump(out, open(os.path.join(a.out, f'{G}_portal.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n_list = sum(o['in_portal_list'] for o in out)
    changed = [o for o in out if o['name_changed_since_read'] or o['description_changed_since_read']]
    print(f"{G}: {len(out)} camps in the setup read | {n_list} in the portal lists parents browse | {len(changed)} changed since the read | locations {[l.get('id') for l in locs]}")
    for o in out:
        if not o['in_portal_list'] or o['name_changed_since_read'] or o['description_changed_since_read']:
            why = []
            if not o['in_portal_list']:
                why.append('NOT in portal list' + ('' if o['show_on_web'] else ' (Show on Web off)') + ('' if o['allow_registration'] else ' (registration off)') + (f" (reg ended {o['registration_end']})" if o['registration_end'] and o['registration_end'] < __import__('datetime').date.today().isoformat() else ''))
            if o['name_changed_since_read']:
                why.append(f"NAME CHANGED -> {o['portal_name']}")
            if o['description_changed_since_read']:
                why.append('DESCRIPTION CHANGED')
            print(f"   {o['camp_id']} {o['name'][:60]} | {'; '.join(why)}")


if __name__ == '__main__':
    main()
