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
        k = ' '.join(x for x in (sport, fh) if x)
    return wk, theme, k


def label(c):
    wk, theme, k = kind_of(c)
    if wk:
        return f"Week {wk} {theme} {k}".strip()
    parts = [p.strip() for p in (c['camp_name'] or '').split('|')]
    if len(parts) >= 4:   # Kim's format: Theme | Summer Camp | Gym or Ninja | Age | Date
        return f"{parts[0].replace(chr(39), '’')} {parts[2]}".strip()
    return c['camp_name']


def sport(c):
    """What the camp NAME says it is (Gym / Ninja / care) - the label a parent reads."""
    parts = [p.strip() for p in (c['camp_name'] or '').split('|')]
    if len(parts) >= 4 and not re.match(r'\s*Week\s*\d', c['camp_name']):
        return parts[2]
    return kind_of(c)[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('gym')
    ap.add_argument('--from', dest='frm', required=True)
    ap.add_argument('--to', required=True)
    ap.add_argument('--launch', required=True, help='launch date, e.g. 2026-11-16')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    G = a.gym.upper()
    os.makedirs(a.out, exist_ok=True)
    today = dt.date.today()
    launch = d(a.launch)

    gym = [g for g in get('gyms', {'select': 'id,name,manager_name,iclass_slug', 'id': f'eq.{G}'}, 'id.asc')][0]
    rules = [r for r in get('event_type_mappings', {'select': 'id,iclass_type_name,gym_id,match_type,event_type,is_active'}, 'id.asc') if r.get('is_active')]
    camps = [c for c in get('iclass_camp_audit', {'select': '*', 'gym_id': f'eq.{G}', 'start_date': f'gte.{a.frm}', 'gone_from_iclass_at': 'is.null'}, 'camp_id.asc') if c['start_date'] <= a.to]
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
        c['_bucket'] = bucket(c['camp_type_name'], G, rules)
        c['_care'] = c['_bucket'] == 'CAMP CARE'
        c['_href'] = f"https://portal.iclasspro.com/{gym['iclass_slug']}/camp-details/{c['camp_id']}?typeId={c['camp_type_id']}"
        c['_week'] = d(c['_days'][0][0] if c['_days'] else c['start_date'])
        c['_week'] -= dt.timedelta(days=c['_week'].weekday())
        c['_enrolled'] = max([int(n) for n in re.findall(r'(\d+) in', c.get('per_day') or '')] or [0])
    camps.sort(key=lambda c: (c['_week'], c['_care'], label(c)))
    rows = []

    def row(err, camp, note, href=''):
        rows.append({'err': err, 'camp': camp, 'href': href, 'note': note})

    N = len(camps)
    # 1. Camps are live (SETTINGS) + enrolled
    live = [c for c in camps if c['show_on_web'] and c['allow_registration']]
    enrolled = [c for c in camps if c['_enrolled']]
    if live:
        who = f"All {N}" if len(live) == N else f"{len(live)} of {N}"
        enr = ' '.join(f"{c['_enrolled']} already enrolled in {label(c)}." for c in enrolled) or '0 enrolled.'
        row('Camps are live', who,
            f"{'All ' + str(N) if len(live) == N else str(len(live))} camps are currently visible and open for registration in the customer portal. "
            f"Please hide the camps and close registration until the {['January','February','March','April','May','June','July','August','September','October','November','December'][launch.month-1]} {launch.day} launch.\n\n{enr}",
            f"https://portal.iclasspro.com/{gym['iclass_slug']}/booking")
    late_start = [c for c in camps if c['registration_start'] and d(c['registration_start']) > launch]
    for c in late_start:
        row('Registration start date', label(c), f"Registration starts {mdy(c['registration_start'])}. Launch is {mdy(a.launch)}.", c['_href'])

    # 2. Registration end = camp's last day
    for c in camps:
        last = c['_days'][-1][0] if c['_days'] else c['end_date']
        if c['registration_end'] and d(c['registration_end']) != d(last):
            note = f"Registration ends {mdy(c['registration_end'])} instead of {mdy(last)} (last day of camp)."
            if d(c['registration_end']) < today:
                note += ' Registration is already closed, so this camp is missing from the portal list and its page says Registration Closed.'
            row('Registration end date', label(c), note, c['_href'])

    # 2b. The same camp entered twice (same name, same dates)
    twins = collections.defaultdict(list)
    for c in camps:
        twins[(re.sub(r'\s+', ' ', c['camp_name']).strip().lower(), c['start_date'], c['end_date'])].append(c)
    for group in twins.values():
        if len(group) > 1:
            for c in group:
                row('Same camp twice', label(c), f"This camp is in iClass {len(group)} times (camp IDs {', '.join(str(x['camp_id']) for x in group)}). On purpose?", c['_href'])

    # 2c. Camp type + price table vs the other camps the NAME says it matches (an Aftercare set up as Full Day)
    by_sport = collections.defaultdict(list)
    for c in camps:
        by_sport[sport(c)].append(c)
    # A different price table is fine when it charges the same for that camp's days (SGT "PRO RATED" tables).
    for s_name, group in by_sport.items():
        types = collections.Counter(c['camp_type_name'] for c in group)
        tables = collections.Counter(c['price_table_id'] for c in group)
        ct, n = types.most_common(1)[0]
        tid, _ = tables.most_common(1)[0]
        main_pt = next(c['price_table_name'] for c in group if c['price_table_id'] == tid)
        for c in group:
            nd = len(c['_days']) or 5
            same_charge = price.get(c['price_table_id'], {}).get((1, nd)) == price.get(tid, {}).get((1, nd))
            if c['camp_type_name'] != ct or not same_charge:
                row('Camp type / price table', label(c), f"Set up as {c['camp_type_name']} with the {c['price_table_name']} price table. The other {n} {s_name} camps are {ct} with {main_pt}. On purpose?", c['_href'])

    # 2d. A week missing a kind of camp every other week has
    kinds_by_week = collections.defaultdict(set)
    for c in camps:
        kinds_by_week[c['_week']].add(sport(c))
    for s_name in by_sport:
        have_wk = [w for w, ks in kinds_by_week.items() if s_name in ks]
        if len(have_wk) >= len(kinds_by_week) - 2 and len(have_wk) < len(kinds_by_week):
            for w in sorted(set(kinds_by_week) - set(have_wk)):
                ref = next(c for c in camps if c['_week'] == w)
                row(f"No {s_name} camp", f"{(ref['camp_name'].split('|')[0]).strip()} week ({mon_d(w.isoformat())})", f"No {s_name} camp this week. The other {len(have_wk)} weeks have one. On purpose?")

    # 3. Every day's times vs the camp's other days + the same kind of camp
    by_kind = collections.defaultdict(list)
    for c in camps:
        by_kind[(c['camp_type_name'], kind_of(c)[2])].append(c)
    for (t, k), group in by_kind.items():
        common = collections.Counter((s, e) for c in group for (_, s, e) in c['_days'])
        if not common:
            continue
        (cs, ce), _ = common.most_common(1)[0]
        for c in group:
            odd = collections.defaultdict(list)
            for day, s, e in c['_days']:
                if (s, e) != (cs, ce):
                    odd[(d(day).weekday(), s, e)].append(day)
            for (wd, s, e), _days in odd.items():
                ampm = ' AM' if s < 12 * 3600 and cs >= 12 * 3600 else (' PM' if s >= 12 * 3600 and cs < 12 * 3600 else '')
                want = span(cs, ce) + (' PM' if ampm == ' AM' else (' AM' if ampm == ' PM' else ''))
                row(f"{k} {DAYNAME[wd]} time", label(c), f"{DAYNAME[wd]} {span(s, e)}{ampm}. Should it be {want}?", c['_href'])

    # 4. Missing day / start or end date on a no-camp day, vs the week's matching camps
    weeks = collections.defaultdict(list)
    for c in camps:
        weeks[c['_week']].append(c)
    for wk, group in weeks.items():
        allwd = collections.Counter(d(day).weekday() for c in group for (day, _, _) in c['_days'])
        common_days = {w for w, n in allwd.items() if n > len(group) / 2}
        for c in group:
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
        if c['max_entries'] == 0 and c['waitlist_requests']:
            row('Spots not consistent', label(c), 'Max students is set to 0, so it shows as full and parents can only ask for the waitlist. On purpose?', c['_href'])

    # 6. Ages: settings consistent within the same kind; title ages vs setting (whole years) and description
    for s_name, group in by_sport.items():
        for fld, word in (('min_age', 'Min age'), ('max_age', 'Max age')):
            vals = collections.Counter(int(float(c[fld])) for c in group if c[fld] is not None)
            if len(vals) > 1:
                (common, n_common), = vals.most_common(1)
                for c in group:
                    if c[fld] is not None and int(float(c[fld])) != common:
                        row(f'{word} not consistent', label(c), f"{word} {int(float(c[fld]))}. The other {n_common} {s_name} camps are {common}. On purpose?", c['_href'])
    for c in camps:
        m = re.search(r'Ages?\s*(\d+)\s*[-–]\s*(\d+)', c['camp_name'], re.I)
        if m and c['min_age'] is not None and c['max_age'] is not None:
            if (int(m.group(1)), int(m.group(2))) != (int(float(c['min_age'])), int(float(c['max_age']))):
                dm = re.search(r'Ages?\s*:?\s*(\d+\s*[-–]\s*\d+)', c['_desc'], re.I)
                row('Ages in title', label(c), f"Title says Ages {m.group(1)}-{m.group(2)}. Setting is {age_text(c['min_age'])} – {age_text(c['max_age'])}." + (f" Description says {dm.group(1).replace(' ', '')}." if dm else ''), c['_href'])

    # 7. Single-day sign-up: pattern row if mixed, then each camp vs its description
    main_camps = [c for c in camps if not c['_care']]
    on = [c for c in main_camps if c['per_day_signup']]
    if on and len(on) != len(main_camps):
        wk_all = collections.defaultdict(list)
        for c in main_camps:
            wk_all[c['_week']].append(c)
        whole = [w for w, g in wk_all.items() if all(c['per_day_signup'] for c in g)]
        if sum(len(wk_all[w]) for w in whole) == len(on):   # follows the week: whole weeks on, the rest off
            nums = ', '.join(kind_of(wk_all[w][0])[0] for w in sorted(whole))
            note = f"On for all {len(wk_all[whole[0]])} camps in Weeks {nums}. Off for the other {len(wk_all) - len(whole)} weeks. On purpose?"
        else:
            note = f"On for {', '.join(label(c) for c in on)}. Off for the other {len(main_camps) - len(on)}. On purpose?"
        row('Single-day sign-up', f"All {len(main_camps)}", note)
    for c in main_camps:
        day_price = re.search(r'\$\s?\d+(?:\.\d\d)?\s*(?:/\s*day|per\s+day|a\s+day|daily)', c['_desc'], re.I)
        explained = re.search(r'single[- ]?days?\b[^.]*\b(open|available)', c['_desc'], re.I)
        if not c['per_day_signup'] and day_price and not explained:
            row('Single-day sign-up', label(c), f"Single-day sign-up off. Description offers {re.sub(r'\s+', ' ', day_price.group(0))}.", c['_href'])
        if c['per_day_signup'] and not day_price:
            row('Single-day sign-up', label(c), 'Single-day sign-up on. Description only gives the week price.', c['_href'])

    # 8. Description price vs what the price table charges; blank boxes
    for c in main_camps:
        t = price.get(c['price_table_id'])
        nd = len(c['_days'])
        if not t or not nd:
            continue
        charge = t.get((1, nd))
        said = re.findall(r'\$\s?(\d[\d,]*(?:\.\d\d)?)', c['_desc'])
        week_said = None
        wm = re.search(r'\$\s?(\d[\d,]*(?:\.\d\d)?)\s*(?:/\s*(?:wk|week)|per\s+week|a\s+week|for\s+the\s+week)', c['_desc'], re.I)
        week_said = float(wm.group(1).replace(',', '')) if wm else (float(said[0].replace(',', '')) if said else None)
        first_is_day = (not wm) and said and re.search(r'\$\s?' + re.escape(said[0]) + r'\s*(?:/\s*day|per\s+day)', c['_desc'], re.I)
        if charge is not None and week_said is not None and abs(week_said - charge) > 0.009 and not first_is_day:
            why = f" ({nd}-day week)" if nd < 5 else ''
            row('Price in description', label(c), f"Says ${week_said:g}. Charges ${charge:g}{why}", c['_href'])
    seen_blank = set()
    for c in camps:
        t = price.get(c['price_table_id']) or {}
        for (k, n), v in t.items():
            if v is None and (c['price_table_id'], k, n) not in seen_blank:
                seen_blank.add((c['price_table_id'], k, n))
                users = [x for x in camps if x['price_table_id'] == c['price_table_id']]
                row('Price table blank', f"All {len(users)} {users[0]['camp_type_name']}", f"{['1st','2nd','3rd'][k-1] if k <= 3 else str(k)+'th'} child, {n} day{'s' if n > 1 else ''} has no price. Every other box is filled")

    # 11 + 12. Description has theme / dates / time; dates and time match; copied from another camp
    for c in camps:
        wk, theme, k = kind_of(c)
        missing = []
        if theme and re.sub(r'\s*week$', '', theme, flags=re.I).lower().replace('’', "'") not in c['_desc'].lower().replace('’', "'"):
            missing.append('no theme')
        dm = re.search(r'\b(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(?:(' + '|'.join(MONTHS) + r')[a-z]*\.?\s*)?(\d{1,2})', c['_desc'], re.I)
        if not dm:
            missing.append('no dates')
        tm = re.search(r'\d{1,2}(?::\d{2})?\s*(am|pm)', c['_desc'], re.I)
        if not tm:
            missing.append('no time')
        if missing:
            c['_missing'] = ', '.join(missing).capitalize()
        if dm and c['_days']:
            sm = MONTHS.index(dm.group(1)[:3].lower()) + 1
            em = MONTHS.index((dm.group(3) or dm.group(1))[:3].lower()) + 1
            f, l = d(c['_days'][0][0]), d(c['_days'][-1][0])
            yr = re.match(r'\s*,?\s*(20\d\d)', c['_desc'][dm.end():])      # a year right after the dates
            if (sm, int(dm.group(2))) != (f.month, f.day) or (em, int(dm.group(4))) != (l.month, l.day):
                row('Dates in description', label(c), f"Says {dm.group(0)}. Camp is {mon_d(f.isoformat())}–{l.day}", c['_href'])
            elif yr and int(yr.group(1)) != f.year:
                row('Dates in description', label(c), f"Says {dm.group(0)}, {yr.group(1)}. Camp is {f.year}.", c['_href'])
        if not c['_care']:
            for word, what in (('snack', 'snack'), ):
                if not re.search(r'\bsnacks?\b', c['_desc'], re.I):
                    c['_nosnack'] = True
    # one row when every camp is missing the same things, else one row per camp
    miss = [c for c in camps if c.get('_missing')]
    if miss and len(miss) == N and len({c['_missing'] for c in miss}) == 1:
        row('Theme, dates or time missing from description', f"All {N}", miss[0]['_missing'])
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
            row('Snack not in description', cell, "Descriptions don’t mention snack. Confirming you are not providing one?")
        else:
            for c in group:
                row('Snack not in description', label(c), "Description doesn’t mention snack. Confirming you are not providing one?", c['_href'])
    # A Ninja camp whose description is the Gymnastics one (and the other way round)
    for c in main_camps:
        body = c['_desc'].lower()
        if re.search(r'ninja|parkour', sport(c), re.I) and re.search(r'vault, bars, beam|gymnastics skills', body) and not re.search(r'ninja (course|equipment|warrior)|obstacle', body):
            row('Description from another camp', label(c), 'Ninja camp, but the description is the Gymnastics one (“Learn gymnastics skills … vault, bars, beam”).', c['_href'])
    for c in main_camps:
        if sport(c).lower().startswith(('after', 'before', 'extended')):
            continue   # care camps are not checked for wear / bring, even when set up as a camp type
        if not re.search(r'\bwear\b|clothing|leotard', c['_desc'], re.I) or not re.search(r'\bbring\b|pack', c['_desc'], re.I):
            row('What to wear or bring missing', label(c), 'Description doesn’t say what to wear or what to bring.', c['_href'])

    # 12b. Every time range written in the description vs the camp's own schedule (AM/PM mix-ups, wrong hours)
    def secs(t):
        m = re.match(r'(\d{1,2})(?::(\d{2}))?\s*([ap])', t.strip(), re.I)
        h = int(m.group(1)) % 12 + (12 if m.group(3).lower() == 'p' else 0)
        return h * 3600 + int(m.group(2) or 0) * 60
    for c in camps:
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
                row(f"{k} time in description", label(c), f"Says “{m.group(0)}”. Schedule is {clock(cs)}–{clock(ce)}", c['_href'])
                break

    # 14. Pictures: every camp has one, no two weeks share one
    pic_weeks = collections.defaultdict(set)
    for c in camps:
        if not c['picture_path']:
            row('Picture missing', label(c), 'No thumbnail picture.', c['_href'])
        else:
            pic_weeks[c['picture_path'].split('.')[-2]].add(c['_week'])
    for h, wks in pic_weeks.items():
        if len(wks) > 1:
            names = sorted({label(c) for c in camps if c['picture_path'] and c['picture_path'].split('.')[-2] == h})
            for n in names:
                row('Picture used on more than one week', n, f"Same picture as weeks {', '.join(str(int(kind_of(c)[0] or 0)) for c in camps if c['picture_path'] and c['picture_path'].split('.')[-2] == h and label(c) != n)}.")

    # 15. Camp name format (Kim's): Theme | Summer Camp | (Gym or Ninja) | Age | Date
    off = [c for c in camps if not re.match(r'^[^|]+\|\s*Summer Camp\s*\|', c['camp_name'] or '')]
    if off:
        row('Title format', f"All {N}" if len(off) == N else f"{len(off)} of {N}",
            f"Now: {off[0]['camp_name']}. Format: Theme | Summer Camp | Gym or Ninja | Age | Date. Full Day or Half Day is optional; if used, it goes in the Gym or Ninja spot.")

    # One "All N <kind>" row when the same note hits EVERY camp of that kind (her rule: "All N" only when it
    # truly is every one), otherwise one row per camp.
    uniq, seen_rows = [], set()            # the same camp listed twice gives the same row twice - keep one
    for r in rows:
        k = (r['err'], r['camp'], r['note'])
        if k not in seen_rows:
            seen_rows.add(k)
            uniq.append(r)
    rows[:] = uniq
    sport_of = {label(c): sport(c) for c in camps}
    count_sport = collections.Counter(sport_of.values())
    grouped, done = [], set()
    for i, r in enumerate(rows):
        if i in done:
            continue
        sp = sport_of.get(r['camp'])
        same = [j for j, x in enumerate(rows) if x['err'] == r['err'] and x['note'] == r['note'] and sport_of.get(x['camp']) == sp] if sp else [i]
        if sp and len(same) > 1 and len(same) == count_sport[sp]:
            grouped.append({'err': r['err'], 'camp': f"All {len(same)} {sp}", 'href': '', 'note': r['note'].replace('Description offers', 'Descriptions offer').replace('Description doesn’t', 'Descriptions don’t')})
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
        conf.append(f"{type_word(t_name)}: " + ' · '.join(b for b in bits if b))
        s2, s3 = t.get((2, 1)), t.get((3, 1))
        off = [round((1 - x / day1) * 100) if (x and day1) else 0 for x in (s2, s3)]
        sib['none' if not any(off) else (f"{off[0]}% off the 2nd and 3rd child" if off[0] == off[1] else f"{off[0]}% off the 2nd child, {off[1]}% off the 3rd")].append(type_word(t_name))
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
