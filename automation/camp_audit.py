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

Usage:  python automation/camp_audit.py HGA --from 2027-05-01 --to 2027-09-30 --launch 2026-11-16 --out <folder>
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
    # Summer or not is Jayme's mark on the camp's iClass TYPE ID (Admin > Buckets > Every iClass type:
    # camp_type_settings), or her by-hand mark on the one camp (camp_season_overrides). A 'both' type goes by
    # the camp's start date against that type's summer dates (blank = the Standards window). Only a type she
    # has NOT marked yet falls back to the old wording test, so nothing changes until she marks it.
    marks = {m['type_id']: m for m in get('camp_type_settings', {'select': 'type_id,season,summer_from,summer_to', 'gym_id': f'eq.{G}'}, 'type_id.asc')}
    forced = {o['camp_id']: o['season'] for o in get('camp_season_overrides', {'select': 'camp_id,season', 'gym_id': f'eq.{G}'}, 'camp_id.asc')}

    def not_summer(c):
        if c['camp_id'] in forced:
            return forced[c['camp_id']] != 'summer'
        m = marks.get(c['camp_type_id']) or {}
        if m.get('season') == 'summer':
            return False
        if m.get('season') == 'school_year':
            return True
        if m.get('season') == 'both':
            return not ((m.get('summer_from') or a.frm) <= c['start_date'] <= (m.get('summer_to') or a.to))
        return bool(re.search(r'school\s*(year|closure)', f"{c['camp_type_name']} {c['camp_name']}", re.I))

    skipped = [c for c in camps if bucket(c['camp_type_name'], G, rules) not in ('CAMP', 'CAMP CARE') or not_summer(c)]
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
        daymax = collections.defaultdict(list)   # camp day -> that day's own "max students" box(es)
        for sch in raw.get('schedule') or []:
            for b in sch.get('blocks') or []:
                days.append((b['date'], sch.get('startTimeInt'), sch.get('endTimeInt')))
                # a blank box is kept as -1 ("blank"): Eagle's PM camps had Friday blank and Monday-Thursday at 60
                daymax[b['date']].append(-1 if sch.get('maxStudents') is None else int(sch['maxStudents']))
        c['_days'] = sorted(days)
        c['_daymax'] = {day: tuple(sorted(v)) for day, v in daymax.items()}
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
        err = error_name(err)   # the ONE fixed name: what was checked against what (automation/error_names.py)
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
    enr = ' '.join(f"{c['_enrolled']} already enrolled in {label(c)}." for c in enrolled)   # said only when someone is in
    listed = [c for c in camps if c['_listed']]
    if listed:
        who = f"All {N}" if len(listed) == N else f"{len(listed)} of {N}"
        # open = registration on AND its end date not passed (EST 2026-11-06: "All 40 ... open for registration" while
        # one camp's registration had ended 6/12/2026 - that camp has its own Registration end date row)
        # Jayme's words (EST 2026-11-10): "Hide camps and turn off registration until November 16. All 40 have Show on Web enabled."
        verb = 'has' if len(listed) == 1 and who != f"All {N}" else 'have'
        row('Camps are live', who, f"Hide camps and turn off registration until {launch_words}. {who} {verb} Show on Web enabled." + (f" {enr}" if enr else ''),
            f"https://portal.iclasspro.com/{gym['iclass_slug']}/booking", who=listed)
    # No 'direct link' rows (Jayme 2026-11-05): a camp parents can't see in the portal can't be found, so an
    # early or old registration start on a hidden camp, or one whose type isn't in the menu, is not a finding.
    # 'Goes live early' only when the camp will really appear on that date: Active + Show on Web. The type's portal
    # tile appears by itself once one of its camps is live (KB line 33688), so the menu is not a gym step.
    for c in camps:
        ran(c, 'Registration start date')
        rs = d(c['registration_start']) if c['registration_start'] else None
        if rs and today < rs < launch and c['allow_registration'] and c['show_on_web'] and c['_active']:
            row('Goes live early', label(c), f"Change registration start from {mdy(c['registration_start'])} to {mdy(a.launch)}, the launch date. It would go live on the portal before {launch_words}.", c['_href'])
    # Jayme 2026-11-11: every summer camp's registration opens ON launch day - not earlier (even when the camp is
    # hidden some other way) and not later. Blank counts too. Until launch day itself; after it, only a LATER date is wrong.
    off_start = [c for c in camps if (not c['registration_start'] and today <= launch) or (c['registration_start'] and (d(c['registration_start']) > launch or (d(c['registration_start']) < launch and today <= launch)))]
    for c in off_start:
        row('Registration start date', label(c), (f"Change registration start from {mdy(c['registration_start'])} to {mdy(a.launch)}, the launch date." if c['registration_start'] else f"Registration start is blank. Set it to {mdy(a.launch)}, the launch date."), c['_href'])
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
            note = f"Change registration end from {mdy(c['registration_end'])} to {mdy(last)}, the last camp day."
            if d(c['registration_end']) < today:
                # her clearer words (EST 2026-11-10): "Registration is already closed because the end date is set to 2026 instead of 2027."
                re_y, last_y = d(c['registration_end']).year, d(last).year
                note += (f" Registration is already closed because the end date is set to {re_y} instead of {last_y}." if re_y != last_y
                         else ' Registration is already closed because the end date has passed.')
            row('Registration end date', label(c), note, c['_href'])
    for gap, grp in sorted(early.items()):
        if len(grp) < 3:
            for c, last in grp:
                row('Registration end date', label(c), f"Change registration end from {mdy(c['registration_end'])} to {mdy(last)}, the last camp day.", c['_href'])
            continue
        c0, last0 = grp[0]
        who = f"All {N}" if len(grp) == N else f"{len(grp)} of {N}"
        row('Registration end date', who, f"Registration ends {gap} day{'s' if gap != 1 else ''} before the last camp day (e.g. {label(c0)}: ends {mdy(c0['registration_end'])}, last day {mdy(last0)}). Is that intentional?", who=[c for c, _ in grp])

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
                if any(x['_listed'] for x in group):
                    row('Same camp twice', label(c), f"This camp is listed {times} in iClass (IDs {', '.join(ids[:-1])} and {ids[-1]}), so parents see {many} listings for the same camp. Is that intentional?", c['_href'])
                else:   # not on the portal yet (HGA: Inactive) - checker 2026-11-11
                    row('Same camp twice', label(c), f"This camp is in iClass {times} (IDs {', '.join(ids[:-1])} and {ids[-1]}). At launch parents would see {many} listings. Should one be removed?", c['_href'])

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
                row('Event Type', label(c), f"Event Type is {c['camp_type_name']}, so it shows under {c['camp_type_name']} on the booking page, not with the other {n} {s_name} camps ({ct}). Is that intentional?", c['_href'])
            if mine_c != main_c:
                wk = f" for this {nd}-day week" if nd < 5 else ''
                cost = lambda v: 'blank' if v is None else f"${v:g}"
                # the WEEK price the description says ("$30 per day or $150 for the week" -> $150), else its first price
                ds_ = (re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)\s*(?:/\s*(?:wk|week)|per\s+week|a\s+week|for\s+the\s+week)', c['_desc'], re.I) if nd >= 2 else None) or re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['_desc'])
                dtxt_ = f"; the description says ${ds_.group(1)}" if ds_ and main_c is not None and abs(float(ds_.group(1).replace(',', '')) - main_c) > 0.009 else ''
                # checker 2026-11-11 (HGA Memorial Aftercare): say what it charges NOW, never the other table's price as if it were
                row('Event Pricing Schedule', label(c), f"Payment Settings use the {c['price_table_name']} pricing schedule, so it charges {cost(mine_c)}{wk}{dtxt_}. The other {n_t} {s_name} camps use {main_pt} ({cost(main_c)}). Should it use {main_pt}" + (", with the description updated to match?" if dtxt_ else '?'), c['_href'])
                c['_expected_table'] = tid   # the description price is then checked against the table its matching camps use

    # 2c-2. Sibling discount the same across matching camps (Standards #11): what each camp's own pricing schedule
    #       gives the 2nd and 3rd child, vs the schedule most camps of its Event Type use.
    sib_odd = {}   # table id -> the boxes whose sibling price is off the table's own discount
    def sib_of(tid_):
        """The table's sibling discount read from every box: the % most boxes give, plus each box that gives another."""
        t_ = price.get(tid_) or {}
        cells_ = {(k, n): (v, t_[(1, n)]) for (k, n), v in t_.items() if k in (2, 3) and v is not None and t_.get((1, n))}
        if not cells_:
            return None
        pct = {kn: round((1 - v / b) * 100, 1) for kn, (v, b) in cells_.items()}
        main_p = collections.Counter(pct.values()).most_common(1)[0][0]
        kids = sorted({k for k, _ in cells_})
        who = '2nd and 3rd child' if kids == [2, 3] else '2nd child' + ('' if (3, 1) in t_ or any(k == 3 for k, _ in t_) else ' (the price table has no 3rd-child row)')
        exc = collections.defaultdict(list)
        for (k, n), p_ in sorted(pct.items(), key=lambda x: (x[0][1], x[0][0])):
            if abs(p_ - main_p) > 0.5:
                v, b = cells_[(k, n)]
                exc[(n, v, round(b * (1 - main_p / 100), 2))].append(k)
        money = lambda x: f"${x:,.2f}" if abs(x - round(x)) > 0.001 else f"${x:,.0f}"
        ex_txt = '; '.join(f"{n} day{'s' if n > 1 else ''}: {money(v)} for the {' and '.join(['2nd', '3rd'][k - 2] for k in ks)} child, not {money(want)}"
                          for (n, v, want), ks in exc.items())
        base = 'none' if not main_p else f"{main_p:g}% off the {who}"
        sib_odd[tid_] = [(n, v, want, ks, main_p) for (n, v, want), ks in exc.items()]
        return base + (f" (except {ex_txt})" if ex_txt else '')
    def sib_words(v):
        return 'no day price to compare' if v is None else ('no sibling discount' if v == 'none' else v)
    for t_name in {c['camp_type_name'] for c in camps}:
        users = [c for c in camps if c['camp_type_name'] == t_name]
        main_tid, n_main = collections.Counter(c['price_table_id'] for c in users).most_common(1)[0]
        want = sib_of(main_tid)
        for c in users:
            ran(c, 'Sibling discount')
            got = sib_of(c['price_table_id'])
            base_ = lambda v: v.split(' (except')[0] if v else v   # odd boxes get their own row (below)
            if c['price_table_id'] != main_tid and got is not None and want is not None and base_(got) != base_(want):
                row('Sibling discount', label(c), f"{sib_words(got)}. The other {n_main} {t_name} camps give {sib_words(want)}. Is that intentional?", c['_href'])

    # 2c-3. One box of a price table off the table's own sibling discount (EGF AM Extended: 2nd child $35.50 for
    #       the week, every other box 10% off; PM Extended the same on 3 days - 2026-11-11)
    for tid_ in sorted({c['price_table_id'] for c in camps if c['price_table_id'] is not None}):
        sib_of(tid_)
        users = [c for c in camps if c['price_table_id'] == tid_]
        for n, v, want, ks, main_p in sib_odd.get(tid_) or []:
            money = lambda x: f"${x:,.2f}" if abs(x - round(x)) > 0.001 else f"${x:,.0f}"
            base_v = (price.get(tid_) or {}).get((1, n))
            kid = ' and '.join(['2nd', '3rd'][k - 2] for k in ks)
            note = (f"“{users[0]['price_table_name']}”: the {kid} child pays {money(v)} for {n} day{'s' if n > 1 else ''}"
                    + (' (the week)' if n == 5 else '') + f". Every other box is {main_p:g}% off; {main_p:g}% off {money(base_v)} is {money(want)}. Is that intentional?")
            sps = {sport(c) for c in users}
            if len(sps) == 1 and len(users) == sum(1 for c in camps if sport(c) == next(iter(sps))):
                row('Price table', f"All {len(users)} {next(iter(sps))} camps", note, who=users)
            else:
                for c in users:
                    row('Price table', label(c), note, c['_href'])

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
                row(f"No {s_name} camp", f"{wlabel} (week of {mon_d(w.isoformat())})", f"No {s_name} camp this week. The other {len(have_wk)} weeks have one. Is that intentional?")

    # 3. Every day's times vs the camp's other days + the same kind of camp
    by_kind = collections.defaultdict(list)
    # Hours written in the camp's NAME split the group: Planet runs "EXT DAY: 4 - 5 PM" and "EXT DAY: 5 - 6 PM"
    # side by side each week - one kind of camp, two products. Lumped together, every 4-5 day read as wrong (11/10).
    name_hours = lambda c: tuple(re.findall(r'\d{1,2}(?::\d{2})?\s*-\s*\d{1,2}(?::\d{2})?\s*[AP]\.?M', c['camp_name'] or '', flags=re.I))
    for c in camps:
        by_kind[(c['camp_type_name'], kind_of(c)[2], name_hours(c))].append(c)
    for (t, k, _nh), group in by_kind.items():
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
                        row(f"{(k or sport(c)).strip()} {DAYNAME[d(day).weekday()]} time", label(c), f"{DAYNAME[d(day).weekday()]} is {txt(sorted(v))}; the other days are {txt(cp)}. Is that intentional?", c['_href'])
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
            mine_t = {(s, e) for (_, s, e) in c['_days']}
            flipped_wd = set()
            # only when the hours change more than once: an AM / PM flip among them is said as its own change
            # (checker 2026-11-11, AAG Friday 12:30 AM–3:30 AM was buried in "Hours change through the week").
            # A flip = a night-time day (starts before 6 AM, or at 9 PM or later) whose 12-hour twin is the usual
            # hours or another day of this camp.
            for key_ in (list(odd) if len({(s, e) for (_, s, e) in odd}) >= 2 else []):
                wd, s, e = key_
                if not (s < 6 * 3600 or s >= 21 * 3600):
                    continue
                for sh in (43200, -43200):
                    if (s + sh, e + sh) in mine_t or (s + sh, e + sh) == (cs, ce):
                        to = (s + sh, e + sh)
                        row(f"{(k or sport(c)).strip()} {DAYNAME[wd]} time", label(c), f"Change {DAYNAME[wd]} from {clock(s)}–{clock(e)} to {clock(to[0])}–{clock(to[1])}.", c['_href'])
                        del odd[key_]
                        flipped_wd.add(wd)
                        break
            if len({(s, e) for (_, s, e) in odd}) >= 2:
                # hours change more than once across the week: one row that lists every day (AAG PM camps)
                days_txt = '; '.join(f"{DAYNAME[d(day).weekday()]} {clock(s)}–{clock(e)}" for day, s, e in c['_days'] if d(day).weekday() not in flipped_wd)
                row(f"{k} hours", label(c), f"Hours change through the week: {days_txt}. Is that intentional?", c['_href'])
                continue
            for (wd, s, e), _days in odd.items():
                ampm = ' AM' if s < 12 * 3600 and cs >= 12 * 3600 else (' PM' if s >= 12 * 3600 and cs < 12 * 3600 else '')
                want = span(cs, ce) + (' PM' if ampm == ' AM' else (' AM' if ampm == ' PM' else ''))
                row(f"{(k or sport(c)).strip()} {DAYNAME[wd]} time", label(c), (f"Change {DAYNAME[wd]} from {span(s, e)}{ampm} to {want}, like the other days." if ampm   # AM / PM flipped: clearly wrong
                     else f"{DAYNAME[wd]} is {span(s, e)}; the other days are {want}. Is that intentional?"), c['_href'])

    # 4a. A camp day on a KNOWN closure (Standards > Short weeks; the list lives on the Standards page)
    for c in camps:
        ran(c, 'No camp on a closure day')
        for day in sorted({x[0] for x in c['_days']}):
            if day in closures:
                row('Closed day', label(c), f"Has camp on {DAYNAME[d(day).weekday()]} {mon_d(day)} ({closures[day]}), a known closure. Is that intentional?", c['_href'])

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
                row(f"Missing {DAYNAME[w]}", label(c), f"{DAYNAME[w]}, {mon_d(date.isoformat())} is missing. The other {others} Week {kind_of(c)[0]} camps include {DAYNAME[w]}. Should this one include it too?", c['_href'])
            if c['_days']:
                first, lastd = c['_days'][0][0], c['_days'][-1][0]
                # a start/end date on a no-camp day - unless the "No <day>" row above already says it
                sw, ew = d(c['start_date']).weekday(), d(c['end_date']).weekday()
                if d(c['start_date']) != d(first) and sw not in have and sw not in common_days:
                    row('Camp start date', label(c), f"Start date is {mon_d(c['start_date'])}, but camp runs {mon_d(first)}–{d(lastd).day if d(lastd).month == d(first).month else mon_d(lastd)}.", c['_href'])
                if d(c['end_date']) != d(lastd) and ew not in have and ew not in common_days:
                    row('Camp end date', label(c), f"End date is {mon_d(c['end_date'])}, but camp runs {mon_d(first)}–{d(lastd).day if d(lastd).month == d(first).month else mon_d(lastd)}.", c['_href'])

    # 5. 0 spots while waitlist requests are on
    for c in camps:
        ran(c, 'Spots')
        if c['max_entries'] == 0 and c['waitlist_requests']:
            row('Spots not consistent', label(c), 'Max students is 0, so it shows as full and parents can only join the waitlist. Is that intentional?', c['_href'])

    for s_name, group in by_sport.items():
        for c in group:
            ran(c, 'Spots')
            rest_ = sorted({int(x['max_entries']) for x in group if x is not c and x.get('max_entries')})
            if c.get('max_entries') and rest_ and int(c['max_entries']) > 2 * rest_[-1]:
                vals_ = ' or '.join(str(v) for v in rest_) if len(rest_) <= 3 else f"{rest_[0]}–{rest_[-1]}"
                row('Max students', label(c), f"Max students is {int(c['max_entries'])}; the other {len(group) - 1} {s_name} camps are {vals_}. Is that intentional?", c['_href'])

    # 5b. One camp day has a different max than the camp's other days (Jayme 2026-11-11, All Around: every Full Day
    #     camp has Monday, Wednesday, Thursday and Friday at 35 and Tuesday at 25). Each camp day has its own
    #     "max students" box in iClass, so one day can fill while the rest of that week still has room.
    #     Weekday names (not dates) in the note, so the same pattern in every week folds into one "All 9 ..." row.
    for c in camps:
        ran(c, 'Spots by day')
        per = c.get('_daymax') or {}
        if len(set(per.values())) > 1:
            fmt = lambda v: ' + '.join('blank' if x < 0 else str(x) for x in v)
            byval = collections.defaultdict(list)
            for day in sorted(per):
                byval[per[day]].append(DAYNAME[d(day).weekday()])
            ranked = sorted(byval.items(), key=lambda kv: -len(kv[1]))
            join = lambda names: names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]
            if len(ranked) == 2 and len(ranked[0][1]) > len(ranked[1][1]):
                (main_v, main_days), (odd_v, odd_days) = ranked
                be = lambda names: 'is' if len(names) == 1 else 'are'
                if all(x < 0 for x in odd_v):
                    note = f"Max students is blank on {join(odd_days)}; {join(main_days)} {be(main_days)} {fmt(main_v)}. Is that intentional?"
                else:
                    note = (f"{join(odd_days)} {be(odd_days)} set to {fmt(odd_v)} spot{'' if fmt(odd_v) == '1' else 's'}; {join(main_days)} "
                            f"{be(main_days)} {fmt(main_v)}. " + (f"{join(odd_days)} could fill while the rest of the week still has room. " if all(x >= 0 for x in main_v) and max(odd_v) < max(main_v) else '') + "Is that intentional?")
            else:
                note = ('Max students is not the same every day: ' + '; '.join(f"{join(names)} {fmt(v)}" for v, names in ranked)
                        + '. One day could fill while the rest of the week still has room. Is that intentional?')
            row('Spots by day', label(c), note, c['_href'])

    # 6. Ages: settings consistent within the same kind; title ages vs setting (whole years) and description
    cur[0] = 'Ages'   # its group rows come before its camp loop
    for s_name, group in by_sport.items():
        for fld, word in (('min_age', 'Min age'), ('max_age', 'Max age')):
            vals = collections.Counter(int(float(c[fld])) for c in group if c[fld] is not None)
            if len(vals) > 1:
                (common, n_common), = vals.most_common(1)
                for c in group:
                    if c[fld] is not None and int(float(c[fld])) != common:
                        row(f'{word} not consistent', label(c), f"{word} is {int(float(c[fld]))}; the other {n_common} {s_name} camps are {common}. Is that intentional?", c['_href'])
    def allow(c, said_lo):
        lo = int(float(c['min_age']))
        return f"through {age_text(c['max_age'])}" if lo == said_lo else f"{age_text(c['min_age'])} through {age_text(c['max_age'])}"
    for c in camps:
        ran(c, 'Ages')
        m = re.search(r'Ages?\s*(\d+)\s*[-–]\s*(\d+)', c['camp_name'], re.I)
        if m and c['min_age'] is not None and c['max_age'] is not None:
            if (int(m.group(1)), int(m.group(2))) != (int(float(c['min_age'])), int(float(c['max_age']))):
                dm = re.search(r'Ages?\s*:?\s*(\d+\s*[-–]\s*\d+)', c['_desc'], re.I)
                dtx = re.sub(r'\s*[-–]\s*', '–', dm.group(1)) if dm else None
                if dtx == f"{m.group(1)}–{m.group(2)}":
                    c['_ages_said_both'] = True   # the description row below would say the same thing again
                    row('Ages in title', label(c), f"Title and description say {dtx}; settings allow {allow(c, int(m.group(1)))}.", c['_href'])
                else:
                    row('Ages in title', label(c), f"Title says {m.group(1)}–{m.group(2)}; " + (f"description says {dtx}, and " if dm else '')
                        + f"settings allow {allow(c, int(m.group(1)))}.", c['_href'])

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
            nl = nums.split(', ')
            nums = nl[0] if len(nl) == 1 else (' and '.join(nl) if len(nl) == 2 else ', '.join(nl[:-1]) + ', and ' + nl[-1])
            note = (f"Single-day registration is on for Week{'s' if len(whole) > 1 else ''} {nums}, but off for the other weeks." if have_nums
                    else f"Single-day registration is on for every camp in the week{'s' if len(whole) > 1 else ''} {nums}, but off for the other weeks.") + " Is that intentional?"
        else:
            note = f"Single-day registration is on for {', '.join(label(c) for c in on)}, but off for the other {len(main_camps) - len(on)}. Is that intentional?"
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
        explained = re.search(r'(?:single[- ]?days?|daily|individual\s+days?)\b[^.]*?\b(will\s+(?:open|be\s+(?:open|available))|open(?:s|ing)?\s+(?:\d+\s+\w+\s+)?(?:prior|before|later|closer)|if\s+spots|(?:will\s+)?not\s+be\s+(?:sold|available|open)|until\s+the\s+week)', c['_desc'], re.I)
        if not c['per_day_signup'] and day_price and not explained:
            row('Single-day registration', label(c), f"Single-day registration is off, but the description offers {re.sub(r'\s+', ' ', day_price.group(0))}. Should it be on?", c['_href'])
        t1_ = (price.get(c['price_table_id']) or {}).get((1, 1))
        bare_day = t1_ is not None and any(abs(float(x.replace(',', '')) - t1_) < 0.01 for x in re.findall(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['_desc']))
        if c['per_day_signup'] and not day_price and not bare_day:
            row('Missing daily price', label(c), 'Single-day registration is on, but the description only lists a weekly price.', c['_href'])

    # 8. Description price vs what the price table charges; blank boxes. Every camp, care too (Jayme 2026-11-05).
    for c in camps:
        if c['_empty']:
            continue
        ran(c, 'Price in description')
        # A camp on the wrong pricing schedule already has its own row; its description is checked against the
        # schedule its matching camps use, so the same wrong charge is not reported twice.
        exp = c.get('_expected_table')
        if exp is not None:   # the wrong-table row already says the description's price and both charges
            continue
        t = price.get(c['price_table_id'])
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
                    row('Price in description', label(c), f"Description says ${week_said:g} without “per day” or “for the week”; the daily price is ${day_charge:g} ({wk_txt}). Add “per day.”", c['_href'])
                elif nd < 5 and t.get((1, 5)) is not None and abs(week_said - t[(1, 5)]) <= 0.009:
                    # checker 2026-11-11: $100 is this care table's own 5-day price, not another camp's
                    row('Price in description', label(c), f"This is a {nd}-day week. Change the weekly amount from ${week_said:g} to ${charge:g}, the {nd}-day price.", c['_href'])
                elif said_day and abs(float(said_day.group(1)) - day_charge) <= 0.009:
                    row('Price in description', label(c), f"Description also says ${week_said:g}, another camp’s price; this camp is ${day_charge:g} per day ({wk_txt}).", c['_href'])
                else:
                    row('Price in description', label(c), f"Description says ${week_said:g}; this camp is {wk_txt} (${day_charge:g} per day).", c['_href'])
                continue
            which = f"the {nd}-day price" if nd < 5 else 'the weekly price'
            why = ''
            k_ = kind_of(c)[2].lower(); tn = (c['price_table_name'] or '').lower()
            if ('full' in k_ and 'half' in tn) or ('half' in k_ and 'full' in tn):
                why = f" It is on the “{c['price_table_name']}” price table."
            if exp is not None:
                exp_name = next((x['price_table_name'] for x in camps if x['price_table_id'] == exp), 'the matching camps’ table')
                row('Price in description', label(c), f"Description says ${week_said:g}; {exp_name} charges ${charge:g}" + (f" for the {nd}-day week." if nd < 5 else '.'), c['_href'])
            else:
                row('Price in description', label(c), f"Description says ${week_said:g}; {which} is ${charge:g}.{why}", c['_href'])
    for c in camps:
        # the DAY price written in the description vs the table's 1-day price - every camp (2026-11-06: this ran on
        # care camps only, so a wrong Full / Half Day day price was never caught)
        if c['_empty']:
            continue
        if c.get('_expected_table') is not None:
            continue
        t = price.get(c['price_table_id']) or {}
        # every price the description SAYS is per day, plus "Single Day: $62" (RBK); one matching the table is enough -
        # RBK descriptions also say "After Care ... $20 per day", which is not this camp's day price
        said_days = [float(x) for x in re.findall(r'\$\s?(\d+(?:\.\d\d)?)\s*(?:/\s*day|per\s+day|a\s+day)', c['_desc'], re.I)]
        said_days += [float(x) for x in re.findall(r'single[- ]?day\w*\W{0,4}\$\s?(\d+(?:\.\d\d)?)', c['_desc'], re.I)]
        day_t = t.get((1, 1))
        if said_days and day_t is not None and all(abs(v - day_t) > 0.009 for v in said_days):
            row('Price in description', label(c), f"Description says ${said_days[0]:g} per day; the daily price is ${day_t:g}.", c['_href'])
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
        if c.get('_expected_table') is not None:
            continue
        t = price.get(c['price_table_id']) or {}
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
            row('Price not in price table', label(c), f"Description says {' and '.join(bad)}; that amount isn't in this camp's price table "
                f"({c['price_table_name']}: 1st child ${' / $'.join(f'{v:g}' for v in one)}).", c['_href'])
    seen_blank = set()
    for c in camps:
        ran(c, 'Price table filled in')
        t = price.get(c['price_table_id']) or {}
        for (k, n), v in t.items():
            if v is None and (c['price_table_id'], k, n) not in seen_blank:
                seen_blank.add((c['price_table_id'], k, n))
                users = [x for x in camps if x['price_table_id'] == c['price_table_id']]
                row('Price table blank', f"All {len(users)} {users[0]['camp_type_name']} camps", f"{['1st','2nd','3rd'][k-1] if k <= 3 else str(k)+'th'} child, {n} day{'s' if n > 1 else ''} has no price; every other box is filled.", who=users)

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
                row('Dates in camp name', label(c), f"Title says {tm_.group(0).strip()}; camp runs {mon_d(f.isoformat())}–{l.day if (l.month, l.year) == (f.month, f.year) else mon_d(l.isoformat())}.", c['_href'])
        elif not tm_ and len([x for x in camps if re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*\d', x['camp_name'], re.I)]) > len(camps) / 2:
            row('Dates in camp name', label(c), 'Add the dates to the title, like the other camps’ titles.', c['_href'])

    for c in camps:   # price written in the camp NAME - care too
        ran(c, 'Price in the name')
        pm = re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['camp_name'])
        t = price.get(c['price_table_id']) or {}
        nd = len({x[0] for x in c['_days']})   # camp DAYS, not time blocks (MGC all-day care has 2 a day)
        if pm and nd and t.get((1, nd)) is not None and abs(float(pm.group(1).replace(',', '')) - t[(1, nd)]) > 0.009:
            row('Price in camp name', label(c), f"Title says ${pm.group(1)}; " + (f"the {nd}-day price" if nd < 5 else 'the weekly price') + f" is ${t[(1, nd)]:g}.", c['_href'])

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

    # The description's own HEADING for its week: its first line, when that line is not shared with any camp of
    # another theme and still has words of its own once dates, numbers and words every other theme's heading uses
    # are taken out. TIG "COED Ninja Summer Camp | Sports Week" / PLG "Villains Take Over" (checker 2026-11-11):
    # a theme written another way, not a missing theme.
    def first_line(c):
        return next((x.strip() for x in c['_desc'].split('\n') if x.strip()), '')
    def heading_of(c):
        fl = first_line(c)
        own = theme_of(c)
        others = [o for o in camps if theme_of(o) != own]
        if not fl or any(first_line(o) == fl for o in others) or re.search(r'school\s*(year|closure)', fl, re.I):
            return None   # a school-closure heading is copied text (its own row, 14b), not a theme
        shared = {w for o in others for w in re.findall(r'[a-z]+', first_line(o).lower())}
        mine = [w for w in re.findall(r'[a-z]+', fl.lower()) if len(w) >= 4 and w not in shared and w[:3] not in MONTHS
                and w not in {x.lower() for x in DAYNAME}]
        return fl if mine else None
    # 11 + 12. Description has theme / dates / time; dates and time match; copied from another camp
    for c in camps:
        if c.get('_template'):
            row('No description', label(c), 'The description is still the template instructions (“Description (Be sure to note if snack is provided and the theme) - You can use the standardized descriptions…”), with empty What to Wear and What to Bring lines. Replace it with this camp’s description.', c['_href'])
            c['_empty'] = True
            continue
        if not c['_desc'].strip():
            row('No description', label(c), 'Add a description.', c['_href'])
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
            head_ = heading_of(c)
            # the heading names the theme in a shorter form (TIG "Sports Week" for Sports Spectacular Week, CPF
            # "Color Wars!" for Color Wars: The Grand Finale): the theme IS there - no row (checker 2026-11-11)
            short_ok = head_ and any(w in re.findall(r'[a-z0-9]+', head_.lower()) for w in th_w.split() if len(w) >= 4 and w not in ('week', 'summer', 'camp'))
            if typos is None and short_ok:
                pass
            elif typos is None and head_:   # a heading of its own with none of the theme's words (PLG "Villains Take Over")
                c['_theme_heading'] = head_
            elif typos is None and not other_theme_in_heading(c):   # another week's theme: its own row (14b), said once
                missing.append('no theme')
            elif typos:   # the theme IS there, spelled differently: a Spelling row (15b), never "No theme"
                c['_theme_typos'] = typos
        dm = re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(?:(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*)?(\d{1,2})', c['_desc'], re.I)
        if not dm:
            missing.append('no dates')
        # "9 AM", "9am", "9:00 a.m." - and the short "9a - 3p" / "9 a-3p" a range is written in (TIG 2026-11-11:
        # all 22 descriptions say "9a - 3p" and the audit said "add the hours")
        tm = re.search(r'\d{1,2}(?::\d{2})?\s*[ap]\.?m\b|\d{1,2}(?::\d{2})?\s*[ap]\.?\s*(?:-|–|—|to)\s*\d{1,2}(?::\d{2})?\s*[ap]\b', c['_desc'], re.I)
        if not tm:
            missing.append('no hours')
        # Kim's list: ages and price in every description. Ages = "Ages 5-13" / "Age: 5" / "5-12 years" - a number,
        # never the word alone (CCP 2026-11-06: "groups based on age and ability" passed with no ages written)
        if not re.search(r'\bages?\b\W{0,3}\d|\d+\s*(?:yrs?|years?)\b|\d\s*(?:-|–|to)\s*\d+\s*(?:yrs?|years?|year olds?)', c['_desc'], re.I):
            missing.append('no ages')
        if not re.search(r'\$\s?\d', c['_desc']):
            missing.append('no price')
        if missing:
            # her words (EST 2026-11-10): "Add the camp’s theme, dates, and hours to each description."
            items = [x[3:] for x in missing]
            joined = items[0] if len(items) == 1 else (' and '.join(items) if len(items) == 2 else ', '.join(items[:-1]) + ', and ' + items[-1])
            c['_missing'] = f"Add the camp’s {joined} to the description."
        if dm and c['_days']:
            sm = MONTHS.index(dm.group(1)[:3].lower()) + 1
            em = MONTHS.index((dm.group(3) or dm.group(1))[:3].lower()) + 1
            f, l = d(c['_days'][0][0]), d(c['_days'][-1][0])
            yr = re.match(r'\s*,?\s*(20\d\d)', c['_desc'][dm.end():])      # a year right after the dates
            if (sm, int(dm.group(2))) != (f.month, f.day) or (em, int(dm.group(4))) != (l.month, l.day):
                row('Dates in description', label(c), f"Description says {dm.group(0)}; camp runs {mon_d(f.isoformat())}–{l.day if (l.month, l.year) == (f.month, f.year) else mon_d(l.isoformat())}.", c['_href'])
            elif yr and int(yr.group(1)) != f.year:
                row('Dates in description', label(c), f"Description says {dm.group(0)}, {yr.group(1)}; camp is in {f.year}.", c['_href'])
        # Before / After / Extended Care text does not need snack, what to wear or what to bring (Jayme 2026-11-06)
        if not is_care(c) and not re.search(r'\bsnacks?\b', c['_desc'], re.I):
            c['_nosnack'] = True
    for c in camps:
        if c.get('_theme_heading'):
            th_ = theme_of(c) or ''
            row('Theme name', label(c), f"Title says “{th_}”; the description heading says “{c['_theme_heading']}”. Should they match?", c['_href'])
    # one row when every camp is missing the same things, else one row per camp
    miss = [c for c in camps if c.get('_missing')]
    if miss and len(miss) == N and len({c['_missing'] for c in miss}) == 1:
        row('Theme, dates or time missing from description', f"All {N}", miss[0]['_missing'].replace('to the description.', 'to each description.'), who=miss)
    else:
        for c in miss:
            row('Theme, dates or time missing from description', label(c), c['_missing'], c['_href'])
    nosnack = collections.defaultdict(list)
    for c in camps:
        if c.get('_nosnack'):
            nosnack[kind_of(c)[2]].append(c)
    for k, group in nosnack.items():
        total = sum(1 for c in camps if kind_of(c)[2] == k)
        cell = f"All {total} {k} camps" if len(group) == total else None
        if cell:
            row('Snack not in description', cell, "Descriptions don’t mention snacks. Is a snack provided? Add that information.", who=group)
        else:
            for c in group:
                row('Snack not in description', label(c), "Description doesn’t mention snacks. Is a snack provided? Add that information.", c['_href'])
    # A Ninja camp whose description is the Gymnastics one (and the other way round)
    for c in main_camps:
        body = c['_desc'].lower()
        if re.search(r'ninja|parkour', sport(c), re.I) and re.search(r'vault, bars, beam|gymnastics skills', body) and not re.search(r'ninja (course|equipment|warrior)|obstacle', body):
            row('Description from another camp', label(c), 'Ninja camp, but the description is the Gymnastics one (“Learn gymnastics skills … vault, bars, beam”). Replace it with the Ninja description.', c['_href'])
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
            row('What to wear or bring missing', label(c), f'Description doesn’t say {what}. Add that information.', c['_href'])

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
        for i, m in enumerate(re.finditer(r'(\d{1,2}(?::\d{2})?\s*[AaPp]\.?(?:[Mm]\.?)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?\s*[AaPp]\.?(?:[Mm]\.?)?)(?![A-Za-z])', c['_desc'])):
            try:
                s, e = secs(m.group(1)), secs(m.group(2))
            except Exception:
                continue
            flipped = (s, e) in {(cs + 43200, ce), (cs - 43200, ce), (cs, ce + 43200), (cs, ce - 43200)}
            if (i == 0 and (s, e) != (cs, ce)) or flipped:
                k = kind_of(c)[2]
                row('AM / PM mix-up in description' if flipped else f"{k} time in description", label(c),
                    f"Description says “{m.group(0)}”; the schedule is {clock(cs)}–{clock(ce)}.", c['_href'])
                break

    # 8b. Ages written in the DESCRIPTION vs the age settings (Standards #8; 13 yrs 11 mos = through 13)
    for c in camps:
        ran(c, 'Ages in description')
        if c['_empty'] or c['min_age'] is None or c['max_age'] is None or c.get('_ages_said_both'):
            continue
        lo, hi = int(float(c['min_age'])), int(float(c['max_age']))
        m = re.search(r'\bages?\s*:?\s*(\d{1,2})\s*(?:yrs?|years?)?\s*(?:[-–]|to)\s*(\d{1,2})', c['_desc'], re.I)
        p = None if m else re.search(r'\bages?\s*:?\s*(\d{1,2})\s*\+', c['_desc'], re.I)
        if m and (int(m.group(1)), int(m.group(2))) != (lo, hi):
            row('Ages in description', label(c), f"Description says {m.group(1)}–{m.group(2)}; settings allow {allow(c, int(m.group(1)))}.", c['_href'])
        elif p and int(p.group(1)) != lo:
            row('Ages in description', label(c), f"Description says {p.group(1)}+; settings allow {allow(c, int(p.group(1)))}.", c['_href'])

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
            row('Text from another camp', label(c), f"Description names “{other}”, another week’s theme. Change it to “{own}”.", c['_href'])
        else:
            for s in sorted(sent_of.get(c['camp_id'], ())):
                wks = collections.Counter(o['_week'] for o in where[s])
                if len(wks) == 2 and wks[c['_week']] == 1:
                    w2 = next(w for w in wks if w != c['_week'])
                    if wks[w2] >= 2:
                        src = next(o for o in where[s] if o['_week'] == w2)
                        th2 = theme_of(src) or f"week of {mon_d(w2.isoformat())}"
                        quote = next((x.strip() for x in re.split(r'(?<=[.!?])\s+|\n', c['_desc']) if words_(x) == s), '')
                        row('Text from another camp', label(c), f"Description has the {th2} camps’ text (“{quote[:90].rstrip()}…”). Replace it with this camp’s text.", c['_href'])
                        break
        sy = re.search(r'school\s*(year|closure)s?\s*(camp|program)s?', c['_desc'], re.I)
        if sy:
            row('Text from another camp', label(c), f"Change “{sy.group(0)}” to “Summer Camp.”", c['_href'])

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
    name_words_of = {o['camp_id']: set(re.findall(r'[a-z]+', (o['camp_name'] or '').lower())) for o in camps}
    desc_words_of = {o['camp_id']: set(re.findall(r'[a-z]+', o['_desc'].lower())) for o in camps}
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
            hits = sorted(dw for dw in desc_w if len(dw) >= 4 and near(nw, dw)
                          and not any(dw in desc_words_of[o['camp_id']] for o in camps if nw not in name_words_of[o['camp_id']]))
            if hits and (nw, hits[0]) not in seen_pairs:
                seen_pairs.add((nw, hits[0]))
                row('Spelling', label(c), f"Title says “{nw}”; description says “{hits[0]}”. Which is right?", c['_href'])
        for nw, dw in c.get('_theme_typos') or []:   # the theme spelled differently in the two (Tunes / Toons)
            if (nw, dw) not in seen_pairs:
                seen_pairs.add((nw, dw))
                row('Spelling', label(c), f"Title says “{nw}”; description says “{dw}”. Which is right?", c['_href'])

    # 14. Pictures: every camp has one, no two weeks share one
    # "Same picture" = the same picture FILE (its bytes). Never the iClass file name: its long middle part is
    # NOT unique to a picture (2026-11-05, SGT: Beach Bash After Care and Color Wars Gymnastics share the name
    # part and are different pictures, 75 KB vs 98 KB) - comparing names gave false "same picture" rows.
    import hashlib
    _pic_hash = {}
    def pic_key(path):
        if path not in _pic_hash:
            _pic_hash[path] = None   # could not open it: never counted as matching another picture
            for _try in range(2):    # twice, so one network blip is not reported as a broken picture
                try:
                    raw_ = urllib.request.urlopen(urllib.request.Request(f"https://images.iclasspro.com/images/{path}", headers={'User-Agent': 'camp-audit'}), timeout=30).read()
                    if raw_:
                        _pic_hash[path] = hashlib.sha256(raw_).hexdigest()
                        break
                except Exception:
                    pass
        return _pic_hash[path]
    pic_weeks = collections.defaultdict(set)
    for c in camps:
        ran(c, 'Picture')
        if not c['picture_path']:
            row('Picture missing', label(c), 'Add a thumbnail picture.', c['_href'])
        elif pic_key(c['picture_path']):
            pic_weeks[pic_key(c['picture_path'])].add(c['_week'])
        else:   # a picture is set but its file does not open (All Around Week 5 AM, 2026-11-11): parents see no picture
            row('Picture missing', label(c), 'A picture is set, but it does not open. Upload it again.', c['_href'])
    for h, wks in pic_weeks.items():
        if len(wks) > 1:
            names = sorted({label(c) for c in camps if c['picture_path'] and pic_key(c['picture_path']) == h})
            for n in names:
                others = [x for x in names if x != n]
                row('Picture used on more than one week', n, f"Same picture as {', '.join(others)}. Is that intentional?")

    for c in camps:
        ran(c, 'Name format')
        # leftover "copy" text in the name (CRR 2026-11-06: "... WK9 July 26–30 (COPY)", the week's other 3 camps
        # have no such tail). Parents see the name at launch.
        cp_ = re.search(r'\(?\bcopy\b\)?', c['camp_name'] or '', re.I)
        if cp_:
            row('Camp name', label(c), f"Remove “{cp_.group(0)}” from the title: {c['camp_name']}.", c['_href'])
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
            row(f'Name says {said}, setup says {set_up}', label(c), f"Title says {said}, but the camp is set up as {set_up} (Event Type {c['camp_type_name']}, "
                f"price table {c['price_table_name']}{hrs_txt}).{dtxt} Should the title say {set_up}?", c['_href'])
    # 15. Camp name format (Kim's): [Week #:] Theme | Summer Camp | (Gym or Ninja) | Age | Date
    # Kim 2026-11-05: a week number before the theme is fine, Gym or Ninja may be spelled out
    # (Gymnastics / Parkour & Ninja), Full Day or Half Day goes right after it, Ages 5+ is fine (a range is
    # her preference, never an error). So the second part must be exactly "Summer Camp" - no sport before it
    # (a year is fine; only a WRONG year is flagged) - and nothing else here is flagged.
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
    fmt = 'Theme | Summer Camp | Gym or Ninja | Ages | Dates' if has_ninja else 'Theme | Summer Camp | Ages | Dates'
    if off:
        probs = collections.Counter(name_problem(c['camp_name'], d(c['start_date']).year) for c in off)
        what = ' · '.join(f"{p}" + (f" ({k} camps)" if len(probs) > 1 else '') for p, k in probs.most_common())
        row('Title format', f"All {N}" if len(off) == N else f"{len(off)} of {N}",
            f"Use {fmt}. Now: {off[0]['camp_name']}. " + (f"The title {what}." if what.startswith('has') else f"In the title, {what}."), who=off)

    # One "All N <kind>" row when the same note hits EVERY camp of that kind (her rule: "All N" only when it
    # truly is every one), otherwise one row per camp.
    def plural_note(t):   # one camp's note said for a group of camps
        for a, b in (('Title and description say', 'Titles and descriptions say'), ('Title says', 'Titles say'), ('description says', 'descriptions say'), ('Description says', 'Descriptions say'),
                     ('the description offers', 'the descriptions offer'), ('the description heading says', 'the description headings say'), ('the description only lists', 'the descriptions only list'),
                     ('Description doesn’t', 'Descriptions don’t'), ('to the description.', 'to each description.'),
                     ('Description has', 'Descriptions have'), ('Description names', 'Descriptions name'), ('Description also says', 'Descriptions also say'),
                     ('this camp is', 'these camps are'), ("this camp's price table", 'their price table'), ('this camp’s text', 'each camp’s text')):
            t = t.replace(a, b)
        return t
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
            rows[idx[0]] = {'err': err, 'camp': f"All {N}", 'href': '', 'note': plural_note(note)}
            drop.update(idx[1:])
    rows[:] = [r for i, r in enumerate(rows) if i not in drop]
    sport_of = {label(c): sport(c) for c in camps}
    theme_by_label = {label(c): theme_of(c) for c in camps}
    count_sport = collections.Counter(sport_of.values())          # labels: decides "all" vs "most"
    recs_of = collections.Counter(label(c) for c in camps)         # records per label: the number said
    recs_sport = collections.Counter(sport(c) for c in camps)
    grouped, done = [], set()
    for i, r in enumerate(rows):
        if i in done:
            continue
        sp = sport_of.get(r['camp'])
        same = [j for j, x in enumerate(rows) if x['err'] == r['err'] and x['note'] == r['note'] and sport_of.get(x['camp']) == sp] if sp else [i]
        plural = plural_note
        if sp and len(same) > 1 and len(same) == count_sport[sp]:
            grouped.append({'err': r['err'], 'camp': f"All {recs_sport[sp]} {sp} camps", 'href': '', 'note': plural(r['note'])})
            done.update(same)
        elif sp and len(same) >= 3 and len(same) > count_sport[sp] / 2:
            # most camps of the kind, same note: ONE "9 of 10 Full Day" row that names the ones it is NOT about
            # (2026-11-06: RBK got 9 identical single-day lines per kind). True as written: the rest are named.
            hit = {rows[j]['camp'] for j in same}
            rest = sorted(l for l, s in sport_of.items() if s == sp and l not in hit)
            # her words (EST 2026-11-10): "Update all except Color Wars and Disney Fest." - the theme only
            short = [theme_by_label.get(l) or l for l in rest]
            # one theme run twice (TIG Sports Spectacular): the week's date tells them apart
            short = [s if short.count(s) == 1 else l.replace(' ' + sp, '') for s, l in zip(short, rest)]
            names = short[0] if len(short) == 1 else (' and '.join(short) if len(short) == 2 else ', '.join(short[:-1]) + ', and ' + short[-1])
            exc = ('Update all except' if r['err'].startswith('Ages') else 'All except') + f" {names}."
            body = plural(r['note'])
            q = re.search(r'\s+[^.?!]*\?$', body)   # the exception goes before a closing question
            body = f"{body[:q.start()]} {exc}{body[q.start():]}" if q else f"{body} {exc}"
            grouped.append({'err': r['err'], 'camp': f"{sum(recs_of[rows[j]['camp']] for j in same)} {sp} camps", 'href': '', 'note': body})
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
        four = None
        if wk4:
            four = f"4-day week ${wk4:g} ({'4 × ' + f'${day1:g}' if day1 and abs(wk4 - 4 * day1) < 0.01 else 'not 4 × the day price'})"
        bits = [f"${day1:g} per day" if day1 else None] + ([] if care else [f"${wk5:g} per week" if wk5 else None, four])
        # a kind counts here only when most of its camps are this type (HGA's one Aftercare set up as Full Day is
        # its own finding, not "Aftercare, all on the SUMMER CAMP table" - checker 2026-11-11)
        kinds_here = sorted({sport(c) for c in users if collections.Counter(x['camp_type_name'] for x in camps if sport(x) == sport(c)).most_common(1)[0][0] == t_name}) or sorted({sport(c) for c in users})
        # a kind whose every camp has a price finding: the table is what it is LINKED to, not its confirmed price (AAG Full Day)
        wrong_kinds = [k_ for k_ in kinds_here if all(any(n_['err'].startswith('Price') and re.search(r'; the (weekly|daily|\d-day) price is \$', n_['note']) and 'Add “per day.”' not in n_['note']
                                                          for n_ in notes_on[c['camp_id']]) for c in users if sport(c) == k_)]
        head = type_word(t_name) if len(kinds_here) == 1 or 'CARE' in (t_name or '').upper() else f"{type_word(t_name)} ({', '.join(kinds_here)}, all on the “{users[0]['price_table_name']}” price table)"
        wk_note = (f" ({' and '.join(wrong_kinds)} camps are linked to this table, but their descriptions say other prices: see Price mismatch)" if wrong_kinds else '')
        conf.append(f"{head}: " + ' · '.join(b for b in bits if b) + wk_note)
        sib[sib_of(tid) or 'none'].append(type_word(t_name))
    if len(sib) == 1:
        conf.append(f"Sibling discount: {next(iter(sib))}")
    else:
        conf.append('Sibling discount: ' + ' · '.join(f"{k} on {' and '.join(v)}" for k, v in sib.items()))
    ages = collections.defaultdict(collections.Counter)
    for c in camps:
        if c['min_age'] is not None:
            ages[sport(c)][f"{age_text(c['min_age'])} – {age_text(c['max_age'])}"] += 1
    common = {s: cnt.most_common(1)[0][0] for s, cnt in ages.items()}
    age_exc = [f"{label(c)}: {age_text(c['min_age'])} – {age_text(c['max_age'])}" for c in camps
               if c['min_age'] is not None and f"{age_text(c['min_age'])} – {age_text(c['max_age'])}" != common[sport(c)]]
    age_tail = (f" (except {'; '.join(dict.fromkeys(age_exc))})" if 0 < len(age_exc) <= 4 else (f" ({len(age_exc)} camps differ: see the age rows)" if age_exc else ''))
    if len(set(common.values())) == 1:
        conf.append(f"Ages: {next(iter(common.values()))}{age_tail}")
    else:
        conf.append('Ages: ' + ' · '.join(f"{a} ({', '.join(s for s in common if common[s] == a)})" for a in dict.fromkeys(common.values())) + age_tail)

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
