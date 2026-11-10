"""
Summer camp audit for ONE gym -> the audit email rows, in Jayme's format.

READ-ONLY. Reads the latest signed-in iClass setup read (Railway -> iclass_camp_audit, iclass_camp_setup,
iclass_price_cells, event_type_mappings, gyms) and writes:
    <out>/<GYM>_email.json   {gm, subject, intro, confirmed, rows:[{err, camp, href, note}], status}
    <out>/<GYM>_review.txt   what a person still reads by eye: every distinct description, word for word,
                             and every distinct picture link (the script cannot read pictures or spot spelling)
Claude writes the email into the audit page (ArtifactData `update gyms/<page code>`).

THE RULES ARE NOT HERE - they live in the memory note project-summer-camp-2027-audit-checklist (16 checks)
and the row wording in feedback-audit-writeup-findings-only. This script runs the checks a machine can
run and says so; it never decides what Jayme decided against:
  - no row for small spaces / apostrophes / spaces around colons ("June14th", "Before Care :", "ROCKIN")
  - a past registration end date = closed now (said in its own row; "Camps are live" counts SETTINGS)
  - 13 years 11 months = through 13, never an error
  - single-day: a description that EXPLAINS the day price (mentions single days opening) is not a row
  - Full / Half Day in the name is optional
  - no holiday is a short week unless the camps themselves skip it (Memorial Day 2027 was the only one)
Tested against the final, sent SGT and EST emails (2026-11-05) before first use on another gym.

Usage:  python scripts/camp_audit.py HGA --from 2027-05-01 --to 2027-09-30 --launch 2026-11-16 --out <folder>
"""
import argparse, collections, datetime as dt, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit_page_sheets import get, bucket, plain, age_text, clock  # noqa: E402
from error_names import name as error_name  # noqa: E402

MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
DAYNAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def d(s):
    return dt.date.fromisoformat(s[:10])


def mdy(s):
    x = d(s)
    return f"{x.month}/{x.day}/{x.year}"


def mon_d(s):
    x = d(s)
    return f"{['January','February','March','April','May','June','July','August','September','October','November','December'][x.month-1]} {x.day}"


def short_time(sec):  # 9 AM -> "9", 8:30 AM -> "8:30"; AM/PM kept by caller when it matters
    h, m = divmod(int(sec) // 60, 60)
    return f"{h % 12 or 12}" + (f":{m:02d}" if m else '')


def span(a, b):
    """'9-12' or '3-5 AM' when the pair is odd (AM where the camp's normal time is PM)."""
    return f"{short_time(a)}-{short_time(b)}"


def kind_of(c):
    """Week label pieces, from the camp name (display only, never a source of truth)."""
    n = c['camp_name']
    m = re.match(r'\s*Week\s*(\d+)\s*:\s*(.*?)\s*\|', n)
    wk, theme = (m.group(1), m.group(2).strip()) if m else (None, None)
    # Times ("9:00 AM", "3:00PM") hold a ":" and an AM / PM that are not the theme or the camp kind
    # (EGF 2026-11-10: "Week 1 HAWAIIAN HULLABALOO- ALL DAY CAMP 9:00 AM - 3:00 PM" came out "Week 1 00 AM - 3:00 PM AM").
    n_nt = re.sub(r'\d{1,2}(?::\d{2})?\s*[AP]\.?M\.?|\d{1,2}:\d{2}', ' ', n, flags=re.I)
    if not m and ':' not in n_nt:   # "Week 1 THEME - KIND <times>", no colon outside the times
        m3 = re.match(r'\s*Week\s*(\d+)\s+(.+?)\s*-\s*\S', n_nt, re.I)
        if m3:
            m, wk, theme = m3, m3.group(1), m3.group(2).strip(' -,!')
    if not m:   # other name patterns, e.g. AAG "Week 1 AM Camp: Passport to Fun June 21-June 25"
        m2 = re.match(r'\s*Week\s*(\d+)\b[^:]*:\s*(.*?)\s*(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d.*)?$', n, re.I)
        if m2:
            wk, theme = m2.group(1), m2.group(2).strip(' -,!')
    if theme:
        # "Week 1|AM Camp: Passport to Fun| June 21..." (AAG 2026-11-06): the theme ends at the next "|"
        theme = theme.split('|')[0].strip(' -,!') or None
    if theme:
        theme = theme.replace("'", '’')
    t = (c['camp_type_name'] or '').upper()
    if 'BEFORE' in t or re.search(r'before ?care', n, re.I):
        k = 'Before Care'
    elif 'AFTER' in t or re.search(r'after ?care', n, re.I):
        k = 'After Care'
    else:
        sport = 'Ninja' if re.search(r'ninja|parkour', n, re.I) else ('Girls' if re.search(r'girls', n, re.I) else ('Gym' if re.search(r'gymnastics', n, re.I) else ''))
        fh = 'Full Day' if 'FULL' in t or re.search(r'full day', n, re.I) else ('Half Day' if 'HALF' in t or re.search(r'half day', n, re.I) else '')
        if not fh and re.search(r'\ball[- ]day\b(?!\s*care)', n_nt, re.I):   # EGF "ALL DAY CAMP" (not MGC "ALL DAY CARE")
            fh = 'Full Day'
        if not fh:   # AM / PM half-day camps named that way (AAG "AM Camp", "PM Camp"); a time's AM / PM does not count
            fh = 'AM' if re.search(r'\bAM\b', n_nt) else ('PM' if re.search(r'\bPM\b', n_nt) else '')
            if fh and re.search(r'\bextended\b', n_nt, re.I):   # EGF "AM Extended" / "PM Extended" = its care hours
                fh += ' Extended'
        elif fh == 'Half Day':   # PLG "Summer - AM Half Day" / "PM Half Day": two different camps, never one group
            ap = re.search(r'\b(AM|PM)\b', n)
            if ap:
                fh = f"{ap.group(1)} Half Day"
        k = ' '.join(x for x in (sport, fh) if x)
    return wk, theme, k


def _kim_kind(c):
    """The Gym / Ninja / care word in a Kim-format name (Theme | Summer Camp | Gym or Ninja | Age | Date),
    or None when that spot holds the ages or a date (CCP / RBK names put the ages there)."""
    parts = [p.strip() for p in (c['camp_name'] or '').split('|')]
    if len(parts) >= 4 and not re.match(r'\s*Week\s*\d', c['camp_name']):
        third = parts[2]
        if third and not re.search(r'\bages?\b|\d', third, re.I):
            return parts[0], third
        return parts[0], None
    return None, None


def label(c):
    if c.get('_label'):
        return c['_label']
    wk, theme, k = kind_of(c)
    if wk:
        return f"Week {wk} {theme} {k}".strip()
    th, kk = _kim_kind(c)
    if th:
        return f"{th.replace(chr(39), '’')} {kk or k}".strip()
    return c['camp_name']


def sport(c):
    """What kind of camp it is: the Gym / Ninja / care word in the name, else from the camp type.
    A camp whose NAME says Full / Half Day against its own settings is grouped by its SETTINGS
    (c['_set_kind'], see name_vs_settings) - the settings are the truth, the name is the finding."""
    if c.get('_set_kind'):
        return c['_set_kind']
    th, kk = _kim_kind(c)
    return kk or kind_of(c)[2] or (c['camp_type_name'] or '')


def is_care(c):
    """Before / After / Extended Care: its settings say care, or its name does (HGA's Memorial Week Aftercare
    is set up under SUMMER CAMP - FULL DAY). Their text is not checked for snack, what to wear or bring."""
    return bool(c.get('_care') or re.search(r'\b(after|before|extended)\s*care\b|aftercare|\b[AP]M\s+extended\b', c['camp_name'] or '', re.I))


def name_vs_settings(c):
    """The name says Half Day but the camp is set up as Full Day (or the other way round): Event Type AND
    price table both say the other one. SGT 2026-11-06: the 9-3 Candyland Ninja camp was renamed "Half Day";
    the audit then blamed its correct Event Type + price table (4 rows). Returns (said, set_up) or None."""
    n = c['camp_name'] or ''
    said = 'Full Day' if re.search(r'full\s*day', n, re.I) else ('Half Day' if re.search(r'half\s*day', n, re.I) else None)
    t, pt = (c['camp_type_name'] or '').upper(), (c['price_table_name'] or '').upper()
    set_up = 'Full Day' if ('FULL' in t and 'FULL' in pt) else ('Half Day' if ('HALF' in t and 'HALF' in pt) else None)
    return (said, set_up) if said and set_up and said != set_up else None


def edits(a, b):
    """How many letters differ between two words (insert / delete / change)."""
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def theme_typos(theme_words, desc_words):
    """The theme written in the description with a letter or two off (MGC 2026-11-06: name 'Tumbling Tunes',
    description 'Tumbling Toons'; name 'Fordbidden', description 'forbidden'). Returns the [(name word, description
    word)] pairs that differ, or None when the theme is not there at all. Plural s is not a difference; words under
    5 letters must match exactly; at most 2 letters off in the whole theme - 3 when another theme word of 5+ letters
    matches exactly and the odd word starts with the same letter ("tumbling tunes" / "tumbling toons" is 3 off).
    Returns [] when the theme is there exactly (whole words; plural s / es is the same word).
    A word typed twice over ("Mayhemayhem" for "Mayhem", SGT 2026-11-06) is a typo pair too."""
    ends = ('s', 'es', 'ing', 'ed', 'er', 'y')   # Splash / Splashing is the same word, never a typo
    same = lambda a, b: a == b or a.rstrip('s') == b.rstrip('s') or any(b == a + e or a == b + e for e in ends)
    doubled = lambda a, b: len(a) >= 5 and len(b) > len(a) and b.startswith(a) and a.endswith(b[len(a):])
    n = len(theme_words)
    best = None
    for i in range(len(desc_words) - n + 1):
        win = desc_words[i:i + n]
        anchored = any(a == b and len(a) >= 5 for a, b in zip(theme_words, win))
        pairs, total = [], 0
        for a, b in zip(theme_words, win):
            if same(a, b):
                continue
            if doubled(a, b) or doubled(b, a):
                pairs.append((a, b))
                continue
            if min(len(a), len(b)) < 5:
                break
            total += edits(a, b)
            if total > (3 if anchored and a[0] == b[0] else 2):
                break
            pairs.append((a, b))
        else:
            if not pairs:
                return []
            best = best or pairs
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('gym')
    ap.add_argument('--standards', help="the audit page's Summer Camp Standards doc (JSON). Its `settings` (launch, due, "
                    "window, closures - Jayme edits them on the Standards page) are what the audit uses; nothing typed here")
    ap.add_argument('--from', dest='frm')
    ap.add_argument('--to')
    ap.add_argument('--launch', help='launch date, e.g. 2026-11-16')
    ap.add_argument('--out', required=True)
    ap.add_argument('--due', help='date camps are due in iClass, e.g. 2026-11-09 (used in the "no summer camps yet" row)')
    a = ap.parse_args()
    std = (json.load(open(a.standards, encoding='utf-8')).get('settings') or {}) if a.standards else {}
    a.frm = a.frm or (std.get('window') or [None, None])[0]
    a.to = a.to or (std.get('window') or [None, None])[1]
    a.launch = a.launch or std.get('launch')
    a.due = a.due or std.get('due')
    closures = {x['date']: x.get('name') or 'closed' for x in (std.get('closures') or []) if x.get('date')}
    if not (a.frm and a.to and a.launch):
        sys.exit('Need the summer window and launch date: pass --standards (the Standards page doc) or --from/--to/--launch')
    G = a.gym.upper()
    os.makedirs(a.out, exist_ok=True)
    today = dt.date.today()
    launch = d(a.launch)

    gym = [g for g in get('gyms', {'select': 'id,name,manager_name,iclass_slug', 'id': f'eq.{G}'}, 'id.asc')][0]
    rules = [r for r in get('event_type_mappings', {'select': 'id,iclass_type_name,gym_id,match_type,event_type,is_active'}, 'id.asc') if r.get('is_active')]
    camps = [c for c in get('iclass_camp_audit', {'select': '*', 'gym_id': f'eq.{G}', 'start_date': f'gte.{a.frm}', 'gone_from_iclass_at': 'is.null'}, 'camp_id.asc') if c['start_date'] <= a.to]
    # SUMMER camps only: the camp's bucket (Admin > Buckets) must be CAMP or CAMP CARE, and school-year /
    # school-closure camps that fall in the summer window are left out (MGC Memorial Day camp, PLG School Year
    # Day Program, OAS School Closure Camp). Kids Night Out etc. drop out by bucket.
    skipped = [c for c in camps if bucket(c['camp_type_name'], G, rules) not in ('CAMP', 'CAMP CARE') or re.search(r'school\s*(year|closure)', f"{c['camp_type_name']} {c['camp_name']}", re.I)]
    camps = [c for c in camps if c not in skipped]
    if not camps:
        # No summer camps entered yet: one row, the wording on the audit page since 2026-11-05.
        due = f" (camps due {d(a.due).strftime('%A')} {d(a.due).month}/{d(a.due).day})" if a.due else ''
        email = {'code': G, 'name': gym['name'], 'gm': (gym.get('manager_name') or '').split(' ')[0], 'status': 'auditing',
                 'subject': f"{gym['name']} Summer Camps 2027", 'confirmed': '',
                 'rows': [{'err': 'No summer camps yet', 'camp': '—', 'href': '', 'note': f"No summer 2027 camps are in iClass yet{due}."}]}
        json.dump(email, open(os.path.join(a.out, f'{G}_email.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f"{G}: 0 summer camps -> {a.out}")
        return
    setups = {s['camp_id']: s for s in get('iclass_camp_setup', {'select': 'camp_id,raw', 'gym_id': f'eq.{G}'}, 'camp_id.asc')}
    cells = get('iclass_price_cells', {'select': 'price_table_id,price_table_name,child_number,days,amount', 'gym_id': f'eq.{G}'}, 'price_table_id.asc,child_number.asc,days.asc')

    price = collections.defaultdict(dict)  # table id -> {(child, days): amount}
    for x in cells:
        price[x['price_table_id']][(x['child_number'], x['days'])] = None if x['amount'] is None else float(x['amount'])

    for c in camps:
        raw = (setups.get(c['camp_id']) or {}).get('raw') or {}
        days = []
        for sch in raw.get('schedule') or []:
            for b in sch.get('blocks') or []:
                days.append((b['date'], sch.get('startTimeInt'), sch.get('endTimeInt')))
        c['_days'] = sorted(days)
        c['_desc'] = plain(c['description_html'])
        c['_empty'] = not c['_desc'].strip()   # an empty description gets ONE row, not every content row
        # Kim's instructions pasted in as the description (MGC 2026-11-05): counts as no description at all
        c['_template'] = bool(re.search(r'be sure to note if snack is provided|use the standardized descriptions', c['_desc'], re.I))
        # (template camps keep _empty False: their header lines - dates, hours, price - are real and still checked)
        c['_bucket'] = bucket(c['camp_type_name'], G, rules)
        # care = the Buckets say CAMP CARE, or the camp type itself says care (MGC 'SUMMER CAMP (ALL DAY CARE)')
        c['_care'] = c['_bucket'] == 'CAMP CARE' or bool(re.search(r'\bcare\b', c['camp_type_name'] or '', re.I))
        c['_href'] = f"https://portal.iclasspro.com/{gym['iclass_slug']}/camp-details/{c['camp_id']}?typeId={c['camp_type_id']}"
        c['_week'] = d(c['_days'][0][0] if c['_days'] else c['start_date'])
        c['_week'] -= dt.timedelta(days=c['_week'].weekday())
        c['_enrolled'] = max([int(n) for n in re.findall(r'(\d+) in', c.get('per_day') or '')] or [0])
        # Status (Active / Inactive) - the 4th switch (Jayme found it 2026-11-05, HGA Disney Dreamers). KB line 33688:
        # the portal shows an event type only with an ACTIVE event set to show online and inside its registration dates.
        # Not in the read = unknown, never treated as inactive.
        c['_active'] = raw.get('active') != 0
        nvs = name_vs_settings(c)
        if nvs:   # group it with the camps its SETTINGS match; the name gets its own row (below)
            c['_name_vs_settings'] = nvs
            c['_set_kind'] = sport(c).replace(nvs[0], nvs[1])
    camps.sort(key=lambda c: (c['_week'], c['_care'], label(c)))
    # the same label on camps in different weeks (MGC runs "Fathoms Below" twice): add the start date
    by_lab = collections.defaultdict(set)
    for c in camps:
        by_lab[label(c)].add(c['start_date'])
    for c in camps:
        base = label(c)
        if len(by_lab[base]) > 1:
            c['_label'] = f"{base} ({mon_d(c['start_date'])})"
    rows = []
    # Per-camp audit record (Jayme 2026-11-05: "for every camp week u need some kind of symbol that marks it was
    # audited"). ran() is called INSIDE each check's loop, so the list is what really ran on that camp - never a
    # typed list. A row whose Camp cell is that camp's label is a finding on it.
    ran_on = collections.defaultdict(list)
    found_on = collections.defaultdict(list)
    lab2ids = collections.defaultdict(list)
    for c in camps:
        lab2ids[label(c)].append(c['camp_id'])

    hit_on = collections.defaultdict(set)   # camp id -> the checks that found something on it
    notes_on = collections.defaultdict(list)   # camp id -> [{err, check, note}] - what exactly is wrong
    cur = [None]                             # the check running now (set by ran(), or by hand before a group row)

    def ran(c, name):
        cur[0] = name
        if name not in ran_on[c['camp_id']]:
            ran_on[c['camp_id']].append(name)

    def row(err, camp, note, href='', who=None):
        # who = the camps a group row ("All 12 Aftercare") is about, so each of them carries the finding
        err = error_name(err)   # the ONE fixed name: what was checked against what (scripts/error_names.py)
        rows.append({'err': err, 'camp': camp, 'href': href, 'note': note})
        for cid in ([x['camp_id'] for x in who] if who is not None else lab2ids.get(camp, [])):
            found_on[cid].append(err)
            notes_on[cid].append({'err': err, 'check': cur[0], 'note': note})
            if cur[0]:
                hit_on[cid].add(cur[0])

    N = len(camps)
    # 1. What PARENTS can see and book right now - the settings AND the live portal (front end).
    #    Portal list = Show on Web + registration window started + the camp's type is in the portal MENU
    #    (RBK 2026-11-05: camps with registration OFF still list). A camp parents can't see is never a finding.
    import urllib.request
    def pub(path):
        try:
            req = urllib.request.Request(f"https://app.iclasspro.com/api/open/v1/{gym['iclass_slug']}/{path}", headers={'x_icp_source': 'portal', 'User-Agent': 'camp-audit'})
            return json.load(urllib.request.urlopen(req, timeout=30))
        except Exception:
            return {}
    menu = set()
    for loc in pub('locations').get('data') or []:
        for b in pub(f"bookings/{loc.get('id')}").get('data') or []:
            if b.get('target') == 'camps':
                menu.add(str((b.get('targetParams') or {}).get('typeId')))   # the portal sends ids as text
    LM = ['January','February','March','April','May','June','July','August','September','October','November','December']
    launch_words = f"{LM[launch.month-1]} {launch.day}"
    for c in camps:
        ran(c, 'Hidden until launch')
        rs, re_ = (d(c['registration_start']) if c['registration_start'] else None), (d(c['registration_end']) if c['registration_end'] else None)
        c['_window'] = bool(rs and rs <= today and (not re_ or re_ >= today))
        c['_in_menu'] = str(c['camp_type_id']) in menu
        # 'Camps are live' counts the SETTINGS (her rule): Show on Web on and registration already started.
        # A camp whose registration END has passed still counts - that gets its own Registration end date row.
        c['_listed'] = bool(c['_active'] and c['show_on_web'] and rs and rs <= today and c['_in_menu'])
    enrolled = [c for c in camps if c['_enrolled']]
    enr = ' '.join(f"{c['_enrolled']} already enrolled in {label(c)}." for c in enrolled) or '0 enrolled.'
    listed = [c for c in camps if c['_listed']]
    if listed:
        who = f"All {N}" if len(listed) == N else f"{len(listed)} of {N}"
        # open = registration on AND its end date not passed (EST 2026-11-06: "All 40 ... open for registration" while
        # one camp's registration had ended 6/12/2026 - that camp has its own Registration end date row)
        open_n = sum(1 for c in listed if c['allow_registration'] and not (c['registration_end'] and d(c['registration_end']) < today))
        what = 'visible and open for registration' if open_n == len(listed) else f"visible ({open_n} open for registration)"
        row('Camps are live', who, f"{who.replace('All', 'All').replace(' of ', ' of ')} camps are currently {what} in the customer portal. Please hide the camps and close registration until the {launch_words} launch.\n\n{enr}",
            f"https://portal.iclasspro.com/{gym['iclass_slug']}/booking", who=listed)
    # No 'direct link' rows (Jayme 2026-11-05): a camp parents can't see in the portal can't be found, so an
    # early or old registration start on a hidden camp, or one whose type isn't in the menu, is not a finding.
    # 'Goes live early' only when the camp will really appear on that date: Active + Show on Web. The type's portal
    # tile appears by itself once one of its camps is live (KB line 33688), so the menu is not a gym step.
    for c in camps:
        ran(c, 'Registration start date')
        rs = d(c['registration_start']) if c['registration_start'] else None
        if rs and today < rs < launch and c['allow_registration'] and c['show_on_web'] and c['_active']:
            row('Goes live early', label(c), f"Registration starts {mdy(c['registration_start'])}, so this camp goes live on the portal before the {launch_words} launch.", c['_href'])
    late_start = [c for c in camps if c['registration_start'] and d(c['registration_start']) > launch]
    for c in late_start:
        row('Registration start date', label(c), f"Registration starts {mdy(c['registration_start'])}. Launch is {mdy(a.launch)}.", c['_href'])
    # No 'Not in the portal menu' rows: a type is missing from the menu only because none of its camps is live yet.
    # No 'Status Inactive' rows either (Jayme 2026-11-05: "she obviously will turn them to active"): HOW a gym hides
    # its camps before launch is the gym's choice. Inactive only keeps a camp out of 'Camps are live' / 'Goes live early'.

    # 2. Registration end = camp's last day
    #    Many camps closing the same number of days early = ONE row (EGF 2026-11-10: 43 camps each a day early were
    #    43 rows; TIG's 22 camps all close the Wednesday before camp). Closed-already camps keep their own row.
    early = collections.defaultdict(list)
    for c in camps:
        ran(c, 'Registration end date')
        last = c['_days'][-1][0] if c['_days'] else c['end_date']
        if c['registration_end'] and d(c['registration_end']) != d(last):
            gap = (d(last) - d(c['registration_end'])).days
            if d(c['registration_end']) >= today and gap > 0:
                early[gap].append((c, last))
                continue
            note = f"Registration ends {mdy(c['registration_end'])} instead of {mdy(last)} (last day of camp)."
            if d(c['registration_end']) < today:
                note += ' Registration is already closed, so this camp is missing from the portal list and its page says Registration Closed.'
            row('Registration end date', label(c), note, c['_href'])
    for gap, grp in sorted(early.items()):
        if len(grp) < 3:
            for c, last in grp:
                row('Registration end date', label(c), f"Registration ends {mdy(c['registration_end'])} instead of {mdy(last)} (last day of camp).", c['_href'])
            continue
        c0, last0 = grp[0]
        who = f"All {N}" if len(grp) == N else f"{len(grp)} of {N}"
        row('Registration end date', who, f"Registration ends {gap} day{'s' if gap != 1 else ''} before the last day of camp (e.g. {label(c0)}: ends {mdy(c0['registration_end'])}, last day {mdy(last0)}). On purpose?", who=[c for c, _ in grp])

    # 2b. The same camp entered twice (same name, same dates)
    twins = collections.defaultdict(list)
    for c in camps:
        ran(c, 'Not entered twice')
        twins[(re.sub(r'\s+', ' ', c['camp_name']).strip().lower(), c['start_date'], c['end_date'])].append(c)
    for group in twins.values():
        if len(group) > 1:
            for c in group:
                # Jayme's wording 2026-11-05 (the GM won't know the IDs; they are for us)
                ids = [str(x['camp_id']) for x in group]
                times = 'twice' if len(group) == 2 else f'{len(group)} times'
                many = 'two' if len(group) == 2 else str(len(group))
                row('Same camp twice', label(c), f"This camp is listed {times} in iClass (IDs {', '.join(ids[:-1])} and {ids[-1]}), so parents will see {many} listings for the same camp. Is that intentional?", c['_href'])

    # 2c. Camp type + price table vs the other camps the NAME says it matches (an Aftercare set up as Full Day)
    by_sport = collections.defaultdict(list)
    for c in camps:
        by_sport[sport(c)].append(c)
    # A different price table is fine when it charges the same for that camp's days (SGT "PRO RATED" tables).
    for s_name, group in by_sport.items():
        types = collections.Counter(c['camp_type_name'] for c in group)
        tables = collections.Counter(c['price_table_id'] for c in group)
        ct, n = types.most_common(1)[0]
        tid, n_t = tables.most_common(1)[0]
        main_pt = next(c['price_table_name'] for c in group if c['price_table_id'] == tid)
        # Two separate findings, in iClass's own words (Jayme 2026-11-05): Event Type = where the camp is grouped on
        # the booking page (KB 38949); Event Pricing Schedule (Payment Settings) = what it charges (KB 38916).
        for c in group:
            ran(c, 'Event Type and price table')
            nd = len({x[0] for x in c['_days']}) or 5
            mine_c, main_c = price.get(c['price_table_id'], {}).get((1, nd)), price.get(tid, {}).get((1, nd))
            if c['camp_type_name'] != ct:
                row('Event Type', label(c), f"Event Type is {c['camp_type_name']}, so it shows under {c['camp_type_name']} on the booking page, not with the other {n} {s_name} camps ({ct}). On purpose?", c['_href'])
            if mine_c != main_c:
                wk = f" for this {nd}-day week" if nd < 5 else ''
                cost = lambda v: 'blank' if v is None else f"${v:g}"
                row('Event Pricing Schedule', label(c), f"Payment Settings use the {c['price_table_name']} pricing schedule, so it charges {cost(mine_c)}{wk}. The other {n_t} {s_name} camps use {main_pt} ({cost(main_c)}). On purpose?", c['_href'])
                c['_expected_table'] = tid   # the description price is then checked against the table its matching camps use

    # 2c-2. Sibling discount the same across matching camps (Standards #11): what each camp's own pricing schedule
    #       gives the 2nd and 3rd child, vs the schedule most camps of its Event Type use.
    def sib_of(tid_):
        t_ = price.get(tid_) or {}
        d1 = t_.get((1, 1))
        if not d1:
            return None
        return tuple(round((1 - t_[(k, 1)] / d1) * 100) if t_.get((k, 1)) else None for k in (2, 3))
    def sib_words(v):
        if v is None:
            return 'no day price to compare'
        a2, a3 = v
        if not a2 and not a3:
            return 'no sibling discount'
        return f"{a2 or 0}% off the 2nd child" + ('' if a3 is None else f", {a3}% off the 3rd")
    for t_name in {c['camp_type_name'] for c in camps}:
        users = [c for c in camps if c['camp_type_name'] == t_name]
        main_tid, n_main = collections.Counter(c['price_table_id'] for c in users).most_common(1)[0]
        want = sib_of(main_tid)
        for c in users:
            ran(c, 'Sibling discount')
            got = sib_of(c['price_table_id'])
            if c['price_table_id'] != main_tid and got is not None and want is not None and got != want:
                row('Sibling discount', label(c), f"{sib_words(got)}. The other {n_main} {t_name} camps give {sib_words(want)}. On purpose?", c['_href'])

    # 2d. A week missing a kind of camp every other week has
    kinds_by_week = collections.defaultdict(set)
    for c in camps:
        kinds_by_week[c['_week']].add(sport(c))
    for s_name in by_sport:
        have_wk = [w for w, ks in kinds_by_week.items() if s_name in ks]
        if len(have_wk) >= len(kinds_by_week) - 2 and len(have_wk) < len(kinds_by_week):
            for w in sorted(set(kinds_by_week) - set(have_wk)):
                ref = next(c for c in camps if c['_week'] == w)
                wk_, th_, _ = kind_of(ref)
                wlabel = f"Week {wk_} {th_}" if wk_ else (ref['camp_name'].split('|')[0]).strip()
                row(f"No {s_name} camp", f"{wlabel} (week of {mon_d(w.isoformat())})", f"No {s_name} camp this week. The other {len(have_wk)} weeks have one. On purpose?")

    # 3. Every day's times vs the camp's other days + the same kind of camp
    by_kind = collections.defaultdict(list)
    for c in camps:
        by_kind[(c['camp_type_name'], kind_of(c)[2])].append(c)
    for (t, k), group in by_kind.items():
        per_date = {id(c): collections.defaultdict(list) for c in group}
        for c in group:
            ran(c, 'Same hours every day')
            for day, s, e in c['_days']:
                per_date[id(c)][day].append((s, e))
        if any(len(v) > 1 for c in group for v in per_date[id(c)].values()):
            # more than one time block a day (MGC all-day care: morning + afternoon) - compare each DAY's set
            pats = collections.Counter(tuple(sorted(v)) for c in group for v in per_date[id(c)].values())
            cp, _ = pats.most_common(1)[0]
            txt = lambda pat: ' and '.join(f"{clock(a)}–{clock(b)}" for a, b in pat)
            for c in group:
                for day, v in sorted(per_date[id(c)].items()):
                    if tuple(sorted(v)) != cp:
                        row(f"{(k or sport(c)).strip()} {DAYNAME[d(day).weekday()]} time", label(c), f"{DAYNAME[d(day).weekday()]} is {txt(sorted(v))}. The other days are {txt(cp)}. Should {DAYNAME[d(day).weekday()]} be {txt(cp)}?", c['_href'])
            continue
        common = collections.Counter((s, e) for c in group for (_, s, e) in c['_days'])
        if not common:
            continue
        (cs, ce), _ = common.most_common(1)[0]
        for c in group:
            odd = collections.defaultdict(list)
            for day, s, e in c['_days']:
                if (s, e) != (cs, ce):
                    odd[(d(day).weekday(), s, e)].append(day)
            if len({(s, e) for (_, s, e) in odd}) >= 2:
                # hours change more than once across the week: one row that lists every day (AAG PM camps)
                days_txt = '; '.join(f"{DAYNAME[d(day).weekday()]} {clock(s)}–{clock(e)}" for day, s, e in c['_days'])
                row(f"{k} hours", label(c), f"Hours are not the same every day: {days_txt}. Should every day be the same?", c['_href'])
                continue
            for (wd, s, e), _days in odd.items():
                ampm = ' AM' if s < 12 * 3600 and cs >= 12 * 3600 else (' PM' if s >= 12 * 3600 and cs < 12 * 3600 else '')
                want = span(cs, ce) + (' PM' if ampm == ' AM' else (' AM' if ampm == ' PM' else ''))
                row(f"{(k or sport(c)).strip()} {DAYNAME[wd]} time", label(c), f"{DAYNAME[wd]} is {span(s, e)}{ampm}. The other days are {want}. Should {DAYNAME[wd]} be {want}?", c['_href'])

    # 4a. A camp day on a KNOWN closure (Standards > Short weeks; the list lives on the Standards page)
    for c in camps:
        ran(c, 'No camp on a closure day')
        for day in sorted({x[0] for x in c['_days']}):
            if day in closures:
                row('Closed day', label(c), f"Has camp on {DAYNAME[d(day).weekday()]} {mon_d(day)} ({closures[day]}), a known closure. On purpose?", c['_href'])

    # 4. Missing day / start or end date on a no-camp day, vs the week's matching camps
    weeks = collections.defaultdict(list)
    for c in camps:
        weeks[c['_week']].append(c)
    for wk, group in weeks.items():
        allwd = collections.Counter(d(day).weekday() for c in group for (day, _, _) in c['_days'])
        common_days = {w for w, n in allwd.items() if n > len(group) / 2}
        for c in group:
            ran(c, 'Camp days and dates')
            have = {d(day).weekday() for (day, _, _) in c['_days']}
            for w in sorted(common_days - have):
                date = wk + dt.timedelta(days=w)
                others = sum(1 for o in group if o is not c and w in {d(x[0]).weekday() for x in o['_days']})
                row(f"{kind_of(c)[2]} {DAYNAME[w]}", label(c), f"No {DAYNAME[w]} {mon_d(date.isoformat())}. The other {others} Week {kind_of(c)[0]} camps have {DAYNAME[w]}. On purpose?", c['_href'])
            if c['_days']:
                first, lastd = c['_days'][0][0], c['_days'][-1][0]
                # a start/end date on a no-camp day - unless the "No <day>" row above already says it
                sw, ew = d(c['start_date']).weekday(), d(c['end_date']).weekday()
                if d(c['start_date']) != d(first) and sw not in have and sw not in common_days:
                    row('Camp start date', label(c), f"Start date set to {mon_d(c['start_date'])}. Camp days are {mon_d(first)}–{d(lastd).day}.", c['_href'])
                if d(c['end_date']) != d(lastd) and ew not in have and ew not in common_days:
                    row('Camp end date', label(c), f"End date set to {mon_d(c['end_date'])}. Camp days are {mon_d(first)}–{d(lastd).day}.", c['_href'])

    # 5. 0 spots while waitlist requests are on
    for c in camps:
        ran(c, 'Spots')
        if c['max_entries'] == 0 and c['waitlist_requests']:
            row('Spots not consistent', label(c), 'Max students is set to 0, so it shows as full and parents can only ask for the waitlist. On purpose?', c['_href'])

    # 6. Ages: settings consistent within the same kind; title ages vs setting (whole years) and description
    cur[0] = 'Ages'   # its group rows come before its camp loop
    for s_name, group in by_sport.items():
        for fld, word in (('min_age', 'Min age'), ('max_age', 'Max age')):
            vals = collections.Counter(int(float(c[fld])) for c in group if c[fld] is not None)
            if len(vals) > 1:
                (common, n_common), = vals.most_common(1)
                for c in group:
                    if c[fld] is not None and int(float(c[fld])) != common:
                        row(f'{word} not consistent', label(c), f"{word} {int(float(c[fld]))}. The other {n_common} {s_name} camps are {common}. On purpose?", c['_href'])
    for c in camps:
        ran(c, 'Ages')
        m = re.search(r'Ages?\s*(\d+)\s*[-–]\s*(\d+)', c['camp_name'], re.I)
        if m and c['min_age'] is not None and c['max_age'] is not None:
            if (int(m.group(1)), int(m.group(2))) != (int(float(c['min_age'])), int(float(c['max_age']))):
                dm = re.search(r'Ages?\s*:?\s*(\d+\s*[-–]\s*\d+)', c['_desc'], re.I)
                row('Ages in title', label(c), f"Title says Ages {m.group(1)}-{m.group(2)}. Setting is {age_text(c['min_age'])} – {age_text(c['max_age'])}." + (f" Description says {dm.group(1).replace(' ', '')}." if dm else ''), c['_href'])

    # 7. Single-day sign-up: pattern row if mixed, then each camp vs its description
    cur[0] = 'Single-day sign-up'   # the pattern row comes before its camp loop
    main_camps = [c for c in camps if not c['_care']]
    on = [c for c in main_camps if c['per_day_signup']]
    if on and len(on) != len(main_camps):
        wk_all = collections.defaultdict(list)
        for c in main_camps:
            wk_all[c['_week']].append(c)
        whole = [w for w, g in wk_all.items() if all(c['per_day_signup'] for c in g)]
        if sum(len(wk_all[w]) for w in whole) == len(on):   # follows the week: whole weeks on, the rest off
            # week numbers when the names have them, else the week's date (RBK names have no week number)
            have_nums = all(kind_of(wk_all[w][0])[0] for w in whole)
            nums = ', '.join(kind_of(wk_all[w][0])[0] if have_nums else f"of {mon_d(w.isoformat())}" for w in sorted(whole))
            note = (f"On for all {len(wk_all[whole[0]])} camps in Weeks {nums}." if have_nums
                    else f"On for every camp in the week{'s' if len(whole) > 1 else ''} {nums}.") + f" Off for the other {len(wk_all) - len(whole)} weeks. On purpose?"
        else:
            note = f"On for {', '.join(label(c) for c in on)}. Off for the other {len(main_camps) - len(on)}. On purpose?"
        row('Single-day sign-up (pattern)', f"All {len(main_camps)}", note, who=main_camps)
    # Each camp's setting vs its own description - Before Care / After Care too (Jayme 2026-11-05: HGA's 12 After
    # Care camps say "$30 per day" with single-day sign-up off; skipping care camps here missed all 12).
    for c in camps:
        if c['_empty']:
            continue
        ran(c, 'Single-day sign-up')
        # a day price = "$62 per day" or "Single Day: $62" (RBK)
        day_price = re.search(r'\$\s?\d+(?:\.\d\d)?\s*(?:/\s*day|per\s+day|a\s+day|daily)|single[- ]?day\w*\W{0,4}\$\s?\d+(?:\.\d\d)?', c['_desc'], re.I)
        # explained = single days open LATER ("Single-Day will open 1 week prior if spots are still available", SGT).
        # "individual day registration available!" is a promise of single days NOW, not an explanation (RBK 2026-11-06:
        # 18 camps with single-day sign-up off passed because the old test only looked for the word "available")
        explained = re.search(r'single[- ]?days?\b[^.]*?\b(will\s+(?:open|be\s+(?:open|available))|open(?:s|ing)?\s+(?:\d+\s+\w+\s+)?(?:prior|before|later|closer)|if\s+spots)', c['_desc'], re.I)
        if not c['per_day_signup'] and day_price and not explained:
            row('Single-day sign-up (description)', label(c), f"Single-day sign-up off. Description offers {re.sub(r'\s+', ' ', day_price.group(0))}.", c['_href'])
        if c['per_day_signup'] and not day_price:
            row('Single-day sign-up (description)', label(c), 'Single-day sign-up on. Description only gives the week price.', c['_href'])

    # 8. Description price vs what the price table charges; blank boxes. Every camp, care too (Jayme 2026-11-05).
    for c in camps:
        if c['_empty']:
            continue
        ran(c, 'Price in description')
        # A camp on the wrong pricing schedule already has its own row; its description is checked against the
        # schedule its matching camps use, so the same wrong charge is not reported twice.
        exp = c.get('_expected_table')
        t = price.get(exp if exp is not None else c['price_table_id'])
        nd = len({x[0] for x in c['_days']})   # camp DAYS, not time blocks (MGC all-day care has 2 a day)
        if not t or not nd:
            continue
        charge = t.get((1, nd))
        said = re.findall(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['_desc'])
        week_said = None
        wm = re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)\s*(?:/\s*(?:wk|week)|per\s+week|a\s+week|for\s+the\s+week)', c['_desc'], re.I)
        week_said = float(wm.group(1).replace(',', '')) if wm else (float(said[0].replace(',', '')) if said else None)
        first_is_day = (not wm) and said and re.search(r'\$\s?' + re.escape(said[0]) + r'\s*(?:/\s*day|per\s+day)', c['_desc'], re.I)
        if charge is not None and week_said is not None and abs(week_said - charge) > 0.009 and not first_is_day:
            day_charge = t.get((1, 1))
            if c['_care'] and day_charge is not None:   # care is charged by the day: word the row so it is true
                wk_txt = f"${charge:g} for the {nd}-day week" if nd < 5 else f"${charge:g} for the week"
                said_day = re.search(r'\$\s?(\d+(?:\.\d\d)?)\s*(?:/\s*day|per\s+day|a\s+day)', c['_desc'], re.I)
                if not wm and not said_day and abs(week_said - day_charge) <= 0.009:
                    row('Price in description', label(c), f"Says ${week_said:g} without “per day” or “for the week”. Charges ${day_charge:g} per day ({wk_txt}). On purpose?", c['_href'])
                elif said_day and abs(float(said_day.group(1)) - day_charge) <= 0.009:
                    row('Price in description', label(c), f"Also says ${week_said:g}, which is not this camp’s price (another camp’s prices are in this description). Charges ${day_charge:g} per day ({wk_txt}).", c['_href'])
                else:
                    row('Price in description', label(c), f"Says ${week_said:g}. Charges {wk_txt} (${day_charge:g} per day).", c['_href'])
                continue
            why = f" ({nd}-day week)" if nd < 5 else ''
            k_ = kind_of(c)[2].lower(); tn = (c['price_table_name'] or '').lower()
            if ('full' in k_ and 'half' in tn) or ('half' in k_ and 'full' in tn):
                why += f" - it is on the “{c['price_table_name']}” price table"
            if exp is not None:
                exp_name = next((x['price_table_name'] for x in camps if x['price_table_id'] == exp), 'the matching camps’ table')
                row('Price in description', label(c), f"Says ${week_said:g}. {exp_name} charges ${charge:g}" + (f" ({nd}-day week)" if nd < 5 else ''), c['_href'])
            else:
                row('Price in description', label(c), f"Says ${week_said:g}. Charges ${charge:g}{why}", c['_href'])
    for c in camps:
        # the DAY price written in the description vs the table's 1-day price - every camp (2026-11-06: this ran on
        # care camps only, so a wrong Full / Half Day day price was never caught)
        if c['_empty']:
            continue
        exp_ = c.get('_expected_table')
        t = price.get(exp_ if exp_ is not None else c['price_table_id']) or {}
        # every price the description SAYS is per day, plus "Single Day: $62" (RBK); one matching the table is enough -
        # RBK descriptions also say "After Care ... $20 per day", which is not this camp's day price
        said_days = [float(x) for x in re.findall(r'\$\s?(\d+(?:\.\d\d)?)\s*(?:/\s*day|per\s+day|a\s+day)', c['_desc'], re.I)]
        said_days += [float(x) for x in re.findall(r'single[- ]?day\w*\W{0,4}\$\s?(\d+(?:\.\d\d)?)', c['_desc'], re.I)]
        day_t = t.get((1, 1))
        if said_days and day_t is not None and all(abs(v - day_t) > 0.009 for v in said_days):
            row('Price in description', label(c), f"Says ${said_days[0]:g} per day. Charges ${day_t:g} per day", c['_href'])
    # 8c. EVERY dollar amount the manager wrote vs the camp's own price table (Jayme 2026-11-06: "every price table
    # connected to any and all camps are verified in settings then compared to the text the manager put in").
    # An amount that is no box of this camp's table (any child, any number of days) is a finding, quoted with the
    # words around it. Not a finding: an amount whose own words name Before / After Care and that IS a box of one
    # of this gym's care tables (RBK Full Day: "After Care: 3PM-5:30PM for $20 per day").
    care_boxes = {round(v, 2) for c in camps if is_care(c) for v in (price.get(c['price_table_id']) or {}).values() if v is not None}
    for c in camps:
        ran(c, 'Every price in the description')
        if c['_empty']:
            continue
        exp_ = c.get('_expected_table')
        t = price.get(exp_ if exp_ is not None else c['price_table_id']) or {}
        boxes = {round(v, 2) for v in t.values() if v is not None}
        if not boxes:
            continue
        # line breaks kept: a quote never runs into the next line (RBK 2026-11-06 read “$250, Monday–Friday Single Day:”)
        txt = re.sub(r'[ \t\xa0]+', ' ', c['_desc'])
        # an amount another price row on this camp already names is not reported twice (AAG $430 / $86 got 3 rows)
        said_before = ' '.join(n['note'] for n in notes_on[c['camp_id']] if n['err'].startswith('Price'))
        bad, seen_v = [], set()
        for m in re.finditer(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', txt):
            v = round(float(m.group(1).replace(',', '')), 2)
            if v in boxes or v in seen_v:
                continue
            if re.search(r'\$' + re.escape(f"{v:g}") + r'(?!\d)', said_before):
                continue
            around = txt[max(0, m.start() - 70):m.end() + 25]
            if not is_care(c) and v in care_boxes and re.search(r'(after|before|extended)\s*care|aftercare', around, re.I):
                continue
            # an add-on is not the camp's price (PLG 2026-11-06: "Swimming is an additional $10 per day")
            if re.search(r'\b(additional|extra|add-?on)\s*$', txt[max(0, m.start() - 30):m.start()], re.I):
                continue
            seen_v.add(v)
            ls, le = txt.rfind('\n', 0, m.start()) + 1, (txt.find('\n', m.end()) + 1 or len(txt) + 1) - 1
            # quote just the price words: up to 4 words before (stopping at a number, date or | ) and up to 3 after,
            # so the same price on every week reads the same and groups into one "All N" row
            before = []
            for w in reversed(txt[ls:m.start()].split()[-6:]):
                if re.search(r'\d|\||[.!?]$', w) or not re.search(r'[A-Za-z]', w):
                    break
                before.insert(0, w)
            before = before[-4:]
            while before and before[0].lower().strip(',:') in ('per', 'day', 'week', 'or', 'and', 'for', 'the', 'a', 'days', 'weeks'):
                before.pop(0)
            after = []
            for w in txt[m.end():le].split()[:3]:
                if re.search(r'\d|\|', w):
                    break
                after.append(w)
                if re.search(r'[.,;!?]$', w) or w.lower().strip('.,;!?') in ('day', 'week', 'days', 'weeks'):
                    break
            sep = ' ' if txt[m.end():m.end() + 1].isspace() else ''   # "$62—individual" stays joined, as written
            quote = (' '.join(before + [m.group(0)]) + (sep + ' '.join(after) if after else '')).strip(' ,;.')
            bad.append(f"“{quote}”")
        if bad:
            one = sorted(v for (k, n), v in t.items() if k == 1 and v is not None)
            row('Price not in price table', label(c), f"Description says {' and '.join(bad)}. That amount is not a price in this camp's price table "
                f"({c['price_table_name']}: 1st child ${' / $'.join(f'{v:g}' for v in one)}).", c['_href'])
    seen_blank = set()
    for c in camps:
        ran(c, 'Price table filled in')
        t = price.get(c['price_table_id']) or {}
        for (k, n), v in t.items():
            if v is None and (c['price_table_id'], k, n) not in seen_blank:
                seen_blank.add((c['price_table_id'], k, n))
                users = [x for x in camps if x['price_table_id'] == c['price_table_id']]
                row('Price table blank', f"All {len(users)} {users[0]['camp_type_name']}", f"{['1st','2nd','3rd'][k-1] if k <= 3 else str(k)+'th'} child, {n} day{'s' if n > 1 else ''} has no price. Every other box is filled", who=users)

    # 16. The dates written in the camp NAME vs the camp's real days
    for c in camps:
        ran(c, 'Dates in the name')
        tm_ = re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(?:(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*)?(\d{1,2}))?', c['camp_name'], re.I)
        if tm_ and c['_days']:
            f, l = d(c['_days'][0][0]), d(c['_days'][-1][0])
            sm = MONTHS.index(tm_.group(1)[:3].lower()) + 1
            starts = {(f.month, f.day), (d(c['start_date']).month, d(c['start_date']).day)}
            bad = (sm, int(tm_.group(2))) not in starts
            if tm_.group(4):
                em = MONTHS.index((tm_.group(3) or tm_.group(1))[:3].lower()) + 1
                bad = bad or (em, int(tm_.group(4))) not in {(l.month, l.day), (d(c['end_date']).month, d(c['end_date']).day)}
            if bad:
                row('Dates in camp name', label(c), f"Name says {tm_.group(0).strip()}. Camp is {mon_d(f.isoformat())}–{l.day}.", c['_href'])
        elif not tm_ and len([x for x in camps if re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*\d', x['camp_name'], re.I)]) > len(camps) / 2:
            row('Dates in camp name', label(c), 'Name has no dates. The other camps’ names do.', c['_href'])

    for c in camps:   # price written in the camp NAME - care too
        ran(c, 'Price in the name')
        pm = re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['camp_name'])
        t = price.get(c['price_table_id']) or {}
        nd = len({x[0] for x in c['_days']})   # camp DAYS, not time blocks (MGC all-day care has 2 a day)
        if pm and nd and t.get((1, nd)) is not None and abs(float(pm.group(1).replace(',', '')) - t[(1, nd)]) > 0.009:
            row('Price in camp name', label(c), f"Name says ${pm.group(1)}. Charges ${t[(1, nd)]:g}" + (f" ({nd}-day week)" if nd < 5 else ''), c['_href'])

    # Themes of every camp (used by 11 and 14b)
    def theme_of(c):
        wk_, th_, _ = kind_of(c)
        if not th_:
            th_, _k = _kim_kind(c)
        return re.sub(r'\s*week$', '', (th_ or '').strip(), flags=re.I) or None
    words_ = lambda s: ' '.join(re.findall(r'[a-z0-9]+', (s or '').lower().replace('’', '').replace("'", '')))
    themes = {theme_of(c) for c in camps if theme_of(c)}

    def other_theme_in_heading(c):
        """Another week's theme in the description HEADING (first ~160 characters) and not its own. RBK descriptions
        list every week's theme further down, which hid a copied heading when the whole text was searched."""
        own = theme_of(c)
        head = words_(c['_desc'][:160])
        others = [t for t in themes if t != own and len(words_(t)) > 3 and words_(t) in head
                  and not (own and words_(t) in words_(own))]
        return others[0] if own and words_(own) not in head and others else None

    # 11 + 12. Description has theme / dates / time; dates and time match; copied from another camp
    for c in camps:
        if c.get('_template'):
            row('No description', label(c), 'The description is the template instructions (“Description (Be sure to note if snack is provided and the theme) - You can use the standardized descriptions…”), with empty What to Wear and What to Bring lines.', c['_href'])
            c['_empty'] = True
            continue
        if not c['_desc'].strip():
            row('No description', label(c), 'The description is empty.', c['_href'])
            c['_empty'] = True
            continue
        ran(c, 'Description has everything')
        wk, theme, k = kind_of(c)
        if not theme:   # Kim-format names: the theme is the first part (CCP, HGA, RBK)
            th_, _ = _kim_kind(c)
            theme = re.sub(r'^\W+', '', th_ or '').strip() or None
        missing = []
        # letters and digits only: AAG writes the theme as "Wicked Good" Sports / AHOY, Campers! (2026-11-06)
        words = lambda s: ' '.join(re.findall(r'[a-z0-9]+', s.lower().replace('’', '').replace("'", '')))
        th_w = words(re.sub(r'\s*week$', '', theme or '', flags=re.I))
        # whole words only: "Minion Mayhem" is NOT in "Minion Mayhemayhem" (SGT 2026-11-06 passed as a substring)
        if theme and f" {th_w} " not in f" {words(c['_desc'])} ":
            typos = theme_typos(th_w.split(), words(c['_desc']).split())
            if typos is None and not other_theme_in_heading(c):   # another week's theme: its own row (14b), said once
                missing.append('no theme')
            elif typos:   # the theme IS there, spelled differently: a Spelling row (15b), never "No theme"
                c['_theme_typos'] = typos
        dm = re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(?:(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*)?(\d{1,2})', c['_desc'], re.I)
        if not dm:
            missing.append('no dates')
        tm = re.search(r'\d{1,2}(?::\d{2})?\s*(am|pm)', c['_desc'], re.I)
        if not tm:
            missing.append('no time')
        # Kim's list: ages and price in every description. Ages = "Ages 5-13" / "Age: 5" / "5-12 years" - a number,
        # never the word alone (CCP 2026-11-06: "groups based on age and ability" passed with no ages written)
        if not re.search(r'\bages?\b\W{0,3}\d|\d+\s*(?:yrs?|years?)\b|\d\s*(?:-|–|to)\s*\d+\s*(?:yrs?|years?|year olds?)', c['_desc'], re.I):
            missing.append('no ages')
        if not re.search(r'\$\s?\d', c['_desc']):
            missing.append('no price')
        if missing:
            c['_missing'] = ', '.join(missing).capitalize()   # e.g. 'No theme, no dates' / 'No ages'
        if dm and c['_days']:
            sm = MONTHS.index(dm.group(1)[:3].lower()) + 1
            em = MONTHS.index((dm.group(3) or dm.group(1))[:3].lower()) + 1
            f, l = d(c['_days'][0][0]), d(c['_days'][-1][0])
            yr = re.match(r'\s*,?\s*(20\d\d)', c['_desc'][dm.end():])      # a year right after the dates
            if (sm, int(dm.group(2))) != (f.month, f.day) or (em, int(dm.group(4))) != (l.month, l.day):
                row('Dates in description', label(c), f"Says {dm.group(0)}. Camp is {mon_d(f.isoformat())}–{l.day}", c['_href'])
            elif yr and int(yr.group(1)) != f.year:
                row('Dates in description', label(c), f"Says {dm.group(0)}, {yr.group(1)}. Camp is {f.year}.", c['_href'])
        # Before / After / Extended Care text does not need snack, what to wear or what to bring (Jayme 2026-11-06)
        if not is_care(c) and not re.search(r'\bsnacks?\b', c['_desc'], re.I):
            c['_nosnack'] = True
    # one row when every camp is missing the same things, else one row per camp
    miss = [c for c in camps if c.get('_missing')]
    if miss and len(miss) == N and len({c['_missing'] for c in miss}) == 1:
        row('Theme, dates or time missing from description', f"All {N}", miss[0]['_missing'], who=miss)
    else:
        for c in miss:
            row('Theme, dates or time missing from description', label(c), c['_missing'], c['_href'])
    nosnack = collections.defaultdict(list)
    for c in camps:
        if c.get('_nosnack'):
            nosnack[kind_of(c)[2]].append(c)
    for k, group in nosnack.items():
        total = sum(1 for c in camps if kind_of(c)[2] == k)
        cell = f"All {total} {k}" if len(group) == total else None
        if cell:
            row('Snack not in description', cell, "Descriptions don’t mention snack. Confirming you are not providing one?", who=group)
        else:
            for c in group:
                row('Snack not in description', label(c), "Description doesn’t mention snack. Confirming you are not providing one?", c['_href'])
    # A Ninja camp whose description is the Gymnastics one (and the other way round)
    for c in main_camps:
        body = c['_desc'].lower()
        if re.search(r'ninja|parkour', sport(c), re.I) and re.search(r'vault, bars, beam|gymnastics skills', body) and not re.search(r'ninja (course|equipment|warrior)|obstacle', body):
            row('Description from another camp', label(c), 'Ninja camp, but the description is the Gymnastics one (“Learn gymnastics skills … vault, bars, beam”).', c['_href'])
    for c in camps:
        # Before / After / Extended Care are NOT checked for what to wear or bring (Jayme 2026-11-06: "aftercare
        # doesnt need to say what to wear or bring its after care"). Care = its settings say care, or its name does
        # (HGA's Memorial Week Aftercare is set up under SUMMER CAMP - FULL DAY).
        if c['_empty'] or is_care(c):
            continue
        ran(c, 'What to wear and bring')
        no_wear = not re.search(r'\bwear\b|clothing|leotard', c['_desc'], re.I)
        no_bring = not re.search(r'\bbring\b|pack', c['_desc'], re.I)
        if no_wear or no_bring:   # say exactly which one is missing
            what = 'what to wear or what to bring' if no_wear and no_bring else ('what to wear' if no_wear else 'what to bring')
            row('What to wear or bring missing', label(c), f'Description doesn’t say {what}.', c['_href'])

    # 12b. Every time range written in the description vs the camp's own schedule (AM/PM mix-ups, wrong hours)
    def secs(t):
        m = re.match(r'(\d{1,2})(?::(\d{2}))?\s*([ap])', t.strip(), re.I)
        h = int(m.group(1)) % 12 + (12 if m.group(3).lower() == 'p' else 0)
        return h * 3600 + int(m.group(2) or 0) * 60
    for c in camps:
        ran(c, 'Times in description')
        sched = collections.Counter((s, e) for (_, s, e) in c['_days'])
        if not sched:
            continue
        (cs, ce), _ = sched.most_common(1)[0]
        # The FIRST range is the camp's hours line: any difference counts. Later ranges are often a part
        # of the day ("open gym from 3pm-4pm") - those count only when AM/PM is flipped against the schedule.
        for i, m in enumerate(re.finditer(r'(\d{1,2}(?::\d{2})?\s*[AaPp]\.?[Mm]\.?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*[AaPp]\.?[Mm]\.?)', c['_desc'])):
            try:
                s, e = secs(m.group(1)), secs(m.group(2))
            except Exception:
                continue
            flipped = (s, e) in {(cs + 43200, ce), (cs - 43200, ce), (cs, ce + 43200), (cs, ce - 43200)}
            if (i == 0 and (s, e) != (cs, ce)) or flipped:
                k = kind_of(c)[2]
                row('AM / PM mix-up in description' if flipped else f"{k} time in description", label(c),
                    f"Says “{m.group(0)}”. Schedule is {clock(cs)}–{clock(ce)}", c['_href'])
                break

    # 8b. Ages written in the DESCRIPTION vs the age settings (Standards #8; 13 yrs 11 mos = through 13)
    for c in camps:
        ran(c, 'Ages in description')
        if c['_empty'] or c['min_age'] is None or c['max_age'] is None:
            continue
        lo, hi = int(float(c['min_age'])), int(float(c['max_age']))
        m = re.search(r'\bages?\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–]|to)\s*(\d{1,2})', c['_desc'], re.I)
        p = None if m else re.search(r'\bages?\s*:?\s*(\d{1,2})\s*\+', c['_desc'], re.I)
        if m and (int(m.group(1)), int(m.group(2))) != (lo, hi):
            row('Ages in description', label(c), f"Description says Ages {m.group(1)}-{m.group(2)}. Setting is {age_text(c['min_age'])} – {age_text(c['max_age'])}.", c['_href'])
        elif p and int(p.group(1)) != lo:
            row('Ages in description', label(c), f"Description says Ages {p.group(1)}+. Setting is {age_text(c['min_age'])} – {age_text(c['max_age'])}.", c['_href'])

    # 14b. Text copied from another camp (Standards #14): the description names another week's theme and not its
    # own, or says school-year / school-closure in a summer camp (EST "School Closure Camps", PLG Superheroes
    # with the "Secret Agent Academy!" heading), or carries a WEEK-SPECIFIC paragraph from another week's camps
    # (PLG 2026-11-06: Gold Medal Moves AM Half Day = the Gold Medal heading over the Time Travelers body).
    # Week-specific = a sentence of 60+ letters found in exactly two weeks: in 2+ camps of the other week and in
    # this camp only, in its own week. Text a gym uses every week is never week-specific.
    def sentences(c):
        return {words_(s) for s in re.split(r'(?<=[.!?])\s+|\n', c['_desc']) if len(words_(s)) >= 60}
    sent_of = {c['camp_id']: sentences(c) for c in camps if not c['_empty']}
    where = collections.defaultdict(list)   # sentence -> camps that have it
    for c in camps:
        for s in sent_of.get(c['camp_id'], ()):
            where[s].append(c)
    for c in camps:
        ran(c, 'Text from another camp')
        if c['_empty']:
            continue
        own = theme_of(c)
        other = other_theme_in_heading(c)
        if other:
            row('Text from another camp', label(c), f"Description names “{other}”, another week's theme, not “{own}”.", c['_href'])
        else:
            for s in sorted(sent_of.get(c['camp_id'], ())):
                wks = collections.Counter(o['_week'] for o in where[s])
                if len(wks) == 2 and wks[c['_week']] == 1:
                    w2 = next(w for w in wks if w != c['_week'])
                    if wks[w2] >= 2:
                        src = next(o for o in where[s] if o['_week'] == w2)
                        th2 = theme_of(src) or f"week of {mon_d(w2.isoformat())}"
                        quote = next((x.strip() for x in re.split(r'(?<=[.!?])\s+|\n', c['_desc']) if words_(x) == s), '')
                        row('Text from another camp', label(c), f"Description has the {th2} camps’ text: “{quote[:90].rstrip()}…”", c['_href'])
                        break
        sy = re.search(r'school\s*(year|closure)s?\s*(camp|program)s?', c['_desc'], re.I)
        if sy:
            row('Text from another camp', label(c), f"Description says “{sy.group(0)}” in a summer camp.", c['_href'])

    # 15b. Spelling between the NAME and the DESCRIPTION (Standards #15): a word in one that is one or two letters
    # off a word in the other ("ummer"/"Summer", "Fordbidden"/"forbidden") is a typo in one of them. Words under 7
    # letters may be only ONE letter off here, so "Tunes"/"Toons" (3 off) is caught by the theme check instead
    # (theme_typos). No dictionary: the camp's own name and description are compared with each other.
    def near(a, b):
        if a == b or a.rstrip('s') == b.rstrip('s') or abs(len(a) - len(b)) > 2:
            return False
        prev = list(range(len(b) + 1))   # edit distance
        for i, ca in enumerate(a, 1):
            cur = [i]
            for j, cb in enumerate(b, 1):
                cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
            prev = cur
        return prev[-1] <= (1 if min(len(a), len(b)) < 7 else 2)
    for c in camps:
        ran(c, 'Spelling: name vs description')
        if c['_empty']:
            continue
        name_w = {w for w in re.findall(r'[a-z]+', (c['camp_name'] or '').lower()) if len(w) >= 5}
        desc_w = set(re.findall(r'[a-z]+', c['_desc'].lower()))
        seen_pairs = set()
        for nw in sorted(name_w):
            if nw in desc_w:
                continue
            hits = sorted(dw for dw in desc_w if len(dw) >= 4 and near(nw, dw))
            if hits and (nw, hits[0]) not in seen_pairs:
                seen_pairs.add((nw, hits[0]))
                row('Spelling', label(c), f"Name says “{nw}”, description says “{hits[0]}”. One of them is spelled wrong.", c['_href'])
        for nw, dw in c.get('_theme_typos') or []:   # the theme spelled differently in the two (Tunes / Toons)
            if (nw, dw) not in seen_pairs:
                seen_pairs.add((nw, dw))
                row('Spelling', label(c), f"Name says “{nw}”, description says “{dw}”. One of them is spelled wrong.", c['_href'])

    # 14. Pictures: every camp has one, no two weeks share one
    # "Same picture" = the same picture FILE (its bytes). Never the iClass file name: its long middle part is
    # NOT unique to a picture (2026-11-05, SGT: Beach Bash After Care and Color Wars Gymnastics share the name
    # part and are different pictures, 75 KB vs 98 KB) - comparing names gave false "same picture" rows.
    import hashlib
    _pic_hash = {}
    def pic_key(path):
        if path not in _pic_hash:
            try:
                raw_ = urllib.request.urlopen(urllib.request.Request(f"https://images.iclasspro.com/images/{path}", headers={'User-Agent': 'camp-audit'}), timeout=30).read()
                _pic_hash[path] = hashlib.sha256(raw_).hexdigest()
            except Exception:
                _pic_hash[path] = None   # could not open it: never counted as matching another picture
        return _pic_hash[path]
    pic_weeks = collections.defaultdict(set)
    for c in camps:
        ran(c, 'Picture')
        if not c['picture_path']:
            row('Picture missing', label(c), 'No thumbnail picture.', c['_href'])
        elif pic_key(c['picture_path']):
            pic_weeks[pic_key(c['picture_path'])].add(c['_week'])
    for h, wks in pic_weeks.items():
        if len(wks) > 1:
            names = sorted({label(c) for c in camps if c['picture_path'] and pic_key(c['picture_path']) == h})
            for n in names:
                others = [x for x in names if x != n]
                row('Picture used on more than one week', n, f"Same picture as {', '.join(others)}.")

    for c in camps:
        ran(c, 'Name format')
        # leftover "copy" text in the name (CRR 2026-11-06: "... WK9 July 26–30 (COPY)", the week's other 3 camps
        # have no such tail). Parents see the name at launch.
        cp_ = re.search(r'\(?\bcopy\b\)?', c['camp_name'] or '', re.I)
        if cp_:
            row('Camp name', label(c), f"Name has “{cp_.group(0)}” in it: {c['camp_name']}. Leftover text?", c['_href'])
        if c.get('_name_vs_settings'):
            said, set_up = c['_name_vs_settings']
            hrs = collections.Counter((s, e) for (_, s, e) in c['_days']).most_common(1)
            hrs_txt = f", {clock(hrs[0][0][0])}–{clock(hrs[0][0][1])}" if hrs else ''
            # Jayme 2026-11-06: "Camp name" read as if the name format was wrong. It is a MISMATCH: the name
            # against the camp's own settings, and the description is said too, so nobody has to open it.
            dsays = {k for k in ('Full Day', 'Half Day') if re.search(k.replace(' ', r'\s*-?\s*'), c['_desc'], re.I)}
            dtxt = (f" The description also says {set_up}." if dsays == {set_up}
                    else f" The description says {said} too." if dsays == {said}
                    else " The description says both Full Day and Half Day." if dsays else " The description does not say.")
            row(f'Name says {said}, setup says {set_up}', label(c), f"Name says {said}, but the camp is set up as {set_up} (Event Type {c['camp_type_name']}, "
                f"price table {c['price_table_name']}{hrs_txt}).{dtxt} Should the name say {set_up}?", c['_href'])
    # 15. Camp name format (Kim's): [Week #:] Theme | Summer Camp | (Gym or Ninja) | Age | Date
    # Kim 2026-11-05: a week number before the theme is fine, Gym or Ninja may be spelled out
    # (Gymnastics / Parkour & Ninja), Full Day or Half Day goes right after it, Ages 5+ is fine (a range is
    # her preference, never an error). So the second part must be exactly "Summer Camp" - no sport before it,
    # no year after it - and nothing else here is flagged.
    def name_problem(n, yr_want=None):
        """What exactly is off in the name, in plain words (Jayme 2026-11-06: say what is wrong, not the whole format)."""
        parts = [p.strip() for p in (n or '').split('|')]
        second = parts[1] if len(parts) > 1 else ''
        bits = []
        # every problem in the name, not just the first group (2026-11-06: CCP's row said only "Week #" and
        # never the hours and price parts in its names)
        if re.search(r'summer\s*camp', second, re.I):
            before = re.sub(r'\s*summer\s*camp.*', '', second, flags=re.I).strip()
            if before:
                bits.append(f"has “{before}” before Summer Camp (it goes after, as its own part)")
            after = re.sub(r'.*summer\s*camp\s*(20\d\d)?', '', second, flags=re.I).strip()
            after = re.sub(r'\bweek\s*\d+\b', 'Week #', after, flags=re.I)   # one line for every week, not ten
            if after:
                bits.append(f"has “{after}” after Summer Camp in the same part (it goes in its own part)")
        elif not re.search(r'summer\s*camp', n or '', re.I):
            return "has no “Summer Camp” part"
        else:
            return "“Summer Camp” is not the second part"
        # the rest of Kim's format (Standards #17): Full / Half Day right after Summer Camp (with Gym or Ninja),
        # an Ages part, and the dates
        rest = parts[2:]
        fh_at = [i for i, p in enumerate(rest) if re.search(r'\b(full|half)\s*day\b', p, re.I)]
        if fh_at and fh_at[0] != 0:
            bits.append(f"has “{re.search(r'(full|half)\s*day', rest[fh_at[0]], re.I).group(0)}” in its own part, not right after Summer Camp (it goes with Gym or Ninja)")
        if not any(re.search(r'\bages?\b', p, re.I) for p in rest):
            bits.append("has no Ages part")
        if not any(re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*\d', p, re.I) for p in rest):
            bits.append("has no dates")
        # hours or a price as a part of the name: not in Kim's format (only a short note in parentheses after the
        # date is). Said without the amount, so every week's name groups into one line.
        if any(re.search(r'\d\s*(am|pm)\b', p, re.I) and not p.startswith('(') for p in rest):
            bits.append("has the camp hours in the name")
        if any(re.search(r'\$\s?\d', p) for p in rest):
            bits.append("has the price in the name")
        # a year anywhere in the name is fine; a WRONG year is the error
        for y in re.findall(r'\b(20\d\d)\b', n or ''):
            if yr_want and int(y) != yr_want:
                bits.append(f"says {y}, but the camp is in {yr_want}")
        return '; '.join(bits) or None
    off = [c for c in camps if name_problem(c['camp_name'], d(c['start_date']).year)]
    # Kim's format: "Gym or Ninja" only at a gym with both (AAG 2026-11-06 is gymnastics only and was shown the other)
    has_ninja = any(re.search(r'ninja|parkour', c['camp_name'] or '', re.I) for c in camps)
    fmt = 'Theme | Summer Camp | Gym or Ninja | Age | Date' if has_ninja else 'Theme | Summer Camp | Age | Date'
    if off:
        probs = collections.Counter(name_problem(c['camp_name'], d(c['start_date']).year) for c in off)
        what = ' · '.join(f"{p}" + (f" ({k} camps)" if len(probs) > 1 else '') for p, k in probs.most_common())
        row('Title format', f"All {N}" if len(off) == N else f"{len(off)} of {N}",
            f"Now: {off[0]['camp_name']}. The name {what}. Format: {fmt}.", who=off)

    # One "All N <kind>" row when the same note hits EVERY camp of that kind (her rule: "All N" only when it
    # truly is every one), otherwise one row per camp.
    uniq, seen_rows = [], set()            # the same camp listed twice gives the same row twice - keep one
    for r in rows:
        k = (r['err'], r['camp'], r['note'])
        if k not in seen_rows:
            seen_rows.add(k)
            uniq.append(r)
    rows[:] = uniq
    by_note = collections.defaultdict(list)
    for i, r in enumerate(rows):
        by_note[(r['err'], r['note'])].append(i)
    labels_all = {label(c) for c in camps}
    drop = set()
    for (err, note), idx in by_note.items():
        if len(idx) > 1 and {rows[i]['camp'] for i in idx} >= labels_all - {''}:
            pass
        cams = {rows[i]['camp'] for i in idx}
        if len(idx) > 1 and len(cams) == len(labels_all) and cams == labels_all:
            rows[idx[0]] = {'err': err, 'camp': f"All {N}", 'href': '', 'note': note.replace('Description offers', 'Descriptions offer')}
            drop.update(idx[1:])
    rows[:] = [r for i, r in enumerate(rows) if i not in drop]
    sport_of = {label(c): sport(c) for c in camps}
    count_sport = collections.Counter(sport_of.values())
    grouped, done = [], set()
    for i, r in enumerate(rows):
        if i in done:
            continue
        sp = sport_of.get(r['camp'])
        same = [j for j, x in enumerate(rows) if x['err'] == r['err'] and x['note'] == r['note'] and sport_of.get(x['camp']) == sp] if sp else [i]
        plural = lambda t: t.replace('Description offers', 'Descriptions offer').replace('Description doesn’t', 'Descriptions don’t')
        if sp and len(same) > 1 and len(same) == count_sport[sp]:
            grouped.append({'err': r['err'], 'camp': f"All {len(same)} {sp}", 'href': '', 'note': plural(r['note'])})
            done.update(same)
        elif sp and len(same) >= 3 and len(same) > count_sport[sp] / 2:
            # most camps of the kind, same note: ONE "9 of 10 Full Day" row that names the ones it is NOT about
            # (2026-11-06: RBK got 9 identical single-day lines per kind). True as written: the rest are named.
            hit = {rows[j]['camp'] for j in same}
            rest = sorted(l for l, s in sport_of.items() if s == sp and l not in hit)
            own_row = {x['camp'] for x in rows if x['err'] == r['err']}   # an excluded camp may have its own wording
            rest = [l + (' (its own row)' if l in own_row else '') for l in rest]
            grouped.append({'err': r['err'], 'camp': f"{len(same)} of {count_sport[sp]} {sp}", 'href': '',
                            'note': f"{plural(r['note'])} (Every {sp} camp except {', '.join(rest)}.)"})
            done.update(same)
        else:
            grouped.append(r)
            done.add(i)
    rows[:] = grouped

    # Confirmed block, straight from the price tables + age settings
    def type_word(t):   # display only: how the Confirmed block names a camp type
        u = (t or '').upper()
        return 'Full Day' if 'FULL' in u else 'Half Day' if 'HALF' in u else 'After Care' if 'AFTER' in u else 'Before Care' if 'BEFORE' in u else (t or '').title()
    conf, sib = [], collections.defaultdict(list)
    for t_name in sorted({c['camp_type_name'] for c in camps}, key=lambda x: (('CARE' in (x or '').upper()), x or '')):
        users = [c for c in camps if c['camp_type_name'] == t_name]
        tid = collections.Counter(c['price_table_id'] for c in users).most_common(1)[0][0]
        t = price.get(tid) or {}
        day1, wk5, wk4 = t.get((1, 1)), t.get((1, 5)), t.get((1, 4))
        care = 'CARE' in (t_name or '').upper()
        bits = [f"${day1:g} per day" if day1 else None] + ([] if care else [f"${wk5:g} per week" if wk5 else None, f"${wk4:g} for a 4-day week" if wk4 else None])
        kinds_here = sorted({sport(c) for c in users})
        head = type_word(t_name) if len(kinds_here) == 1 or 'CARE' in (t_name or '').upper() else f"{type_word(t_name)} ({', '.join(kinds_here)}, all on the “{users[0]['price_table_name']}” price table)"
        conf.append(f"{head}: " + ' · '.join(b for b in bits if b))
        s2, s3 = t.get((2, 1)), t.get((3, 1))
        off = [round((1 - x / day1) * 100) if (x and day1) else 0 for x in (s2, s3)]
        if not any(off):
            key = 'none'
        elif (3, 1) not in t:   # no 3rd-child row in the table at all (RBK) - say so, never "0%"
            key = f"{off[0]}% off the 2nd child (the price table has no 3rd-child row)"
        else:
            key = f"{off[0]}% off the 2nd and 3rd child" if off[0] == off[1] else f"{off[0]}% off the 2nd child, {off[1]}% off the 3rd"
        sib[key].append(type_word(t_name))
    if len(sib) == 1:
        conf.append(f"Sibling discount: {next(iter(sib))}")
    else:
        conf.append('Sibling discount: ' + ' · '.join(f"{k} on {' and '.join(v)}" for k, v in sib.items()))
    ages = collections.defaultdict(collections.Counter)
    for c in camps:
        if c['min_age'] is not None:
            ages[sport(c)][f"{age_text(c['min_age'])} – {age_text(c['max_age'])}"] += 1
    common = {s: cnt.most_common(1)[0][0] for s, cnt in ages.items()}
    if len(set(common.values())) == 1:
        conf.append(f"Ages: {next(iter(common.values()))}")
    else:
        conf.append('Ages: ' + ' · '.join(f"{a} ({', '.join(s for s in common if common[s] == a)})" for a in dict.fromkeys(common.values())))

    first = (gym.get('manager_name') or '').split(' ')[0]
    email = {
        'code': G, 'name': gym['name'], 'gm': first, 'status': 'auditing',
        'subject': f"{gym['name']} Summer Camps 2027",
        'intro': "I was linking all of your summer camp data and getting it ready for marketing. Here’s what I confirmed, and the things I found that need a look.",
        'confirmed': '\n'.join(conf), 'rows': rows, 'signoff': 'Thank you,\nJayme',
    }
    json.dump(email, open(os.path.join(a.out, f'{G}_email.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # Per-camp audit record for the camp sheet: when it ran, every check that ran on the camp, and its own findings.
    # A camp the audit left out (not a summer camp) has no record - the sheet shows "not audited", never a check.
    cov = {str(c['camp_id']): {'on': today.isoformat(), 'checks': ran_on[c['camp_id']], 'found': sorted(set(found_on[c['camp_id']])),
                               'hit': [k for k in ran_on[c['camp_id']] if k in hit_on[c['camp_id']]],
                               'notes': notes_on[c['camp_id']]}
           for c in camps}
    json.dump(cov, open(os.path.join(a.out, f'{G}_coverage.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # What a person still reads by eye
    with open(os.path.join(a.out, f'{G}_review.txt'), 'w', encoding='utf-8') as f:
        bodies = collections.defaultdict(list)
        for c in camps:
            bodies[c['_desc']].append(label(c))
        f.write(f"{gym['name']}: {N} camps, {len(bodies)} different descriptions, {len(pic_weeks)} different pictures\n\n")
        for b, who in bodies.items():
            f.write(f"=== {len(who)} camps: {', '.join(who)}\n{b}\n\n")
        f.write('=== PICTURES (open each one, read every word)\n')
        done = set()
        for c in camps:
            if c['picture_path'] and c['picture_path'] not in done:
                done.add(c['picture_path'])
                f.write(f"{label(c)} | https://images.iclasspro.com/images/{c['picture_path']}\n")
    print(f"{G}: {N} camps, {len(rows)} rows -> {a.out}")


if __name__ == '__main__':
    main()
