"""
The ONE list of error names the camp audit writes. Each name says what was checked against what
(Jayme 2026-11-06: "Camp name" and "Before Care Monday time" were confusing - "needs to have a set
definition ... camp times dont line up or time mismatch or what is this describing").

Pattern: WHAT IS WRONG · THE TWO THINGS COMPARED (A vs B), or "X missing" when something is absent.
camp_audit.py writes rows through name(); audit_all_gyms.py runs name() over rows already on the page
(eye / hand rows and the deleted-rows list), so a renamed error never comes back under its old name.
"""
import re

_DAYS = r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'

FIXED = {
    'Camps are live': 'Open before launch · live portal vs launch date',
    'Goes live early': 'Registration start · setting vs launch date',
    'Registration start date': 'Registration start · setting vs launch date',
    'Registration end date': 'Registration end · setting vs last camp day',
    'Same camp twice': 'Entered twice · same camp, two listings',
    'Event Type': 'Event Type · this camp vs matching camps',
    'Event Pricing Schedule': 'Price table · this camp vs matching camps',
    'Sibling discount': 'Sibling discount · this camp vs matching camps',
    'Closed day': 'Camp on a closure day · schedule vs closure list',
    'Camp start date': 'Start date · setting vs camp days',
    'Camp end date': 'End date · setting vs camp days',
    'Ages in title': 'Ages · name vs age setting',
    'Ages in description': 'Ages · description vs age setting',
    'Price in description': 'Price · description vs price table',
    'Price not in price table': 'Price · description vs price table',
    'Price table blank': 'Price table · blank box',
    'Dates in camp name': 'Dates · name vs camp dates',
    'Price in camp name': 'Price · name vs price table',
    'No description': 'Description missing',
    'Dates in description': 'Dates · description vs camp dates',
    'Theme, dates or time missing from description': 'Description missing · theme, dates, time or ages',
    'Snack not in description': 'Description missing · snack',
    'What to wear or bring missing': 'Description missing · what to wear or bring',
    'Description from another camp': 'Wrong description · another camp’s description',
    'Text from another camp': 'Wrong description · another camp’s text',
    'Spelling': 'Spelling · name vs description',
    'Picture missing': 'Picture missing',
    # rows found by eye (words inside a picture - not scripted yet, Jayme has it on hold)
    'Picture': 'Spelling · picture text',
    'Picture dates': 'Dates · picture vs camp dates',
    'Picture - different theme': 'Picture · another week’s theme',
    'Picture used on more than one week': 'Picture · same as another week',
    'Title format': 'Name format · name vs Kim’s format',
    'AM / PM mix-up in description': 'Time · description vs schedule (AM / PM mix-up)',
    'Camp name': 'Name · leftover text',   # CRR 11/6: "(COPY)" left in the name (the Full/Half Day row has its own name above)
}

PATTERNS = [
    (r'^Name says (Full|Half) Day, setup says (Full|Half) Day$', 'Full / Half Day · name vs settings'),
    (r'^.+ time in description$', 'Time · description vs schedule'),
    (r'^.+ ' + _DAYS + r' time$', 'Hours · one day vs the other days'),
    (r'^.+ hours$', 'Hours · not the same every day'),
    (r'^Single-day sign-up \(pattern\)$', 'Single-day sign-up · this week vs other weeks'),
    (r'^Single-day sign-up \(description\)$', 'Single-day sign-up · setting vs description'),
    (r'^No .+ camp$', 'Missing camp · this week vs other weeks'),
    (r'^(Min age|Max age|Spots) not consistent$', None),   # handled below: keeps which setting
    (r'^.+ ' + _DAYS + r'$', 'Camp days · this camp vs the week’s other camps'),
]


# Jayme's short labels (Estrella 2026-11-10: "Price mismatch", "Start date", "Ages in titles" ...). Every older
# name above maps on to one of these, so a row or a deleted-row key written under any earlier name still matches.
SHORT = {
    'Open before launch · live portal vs launch date': 'Open before launch',
    'Registration start · setting vs launch date': 'Registration start date',
    'Registration end · setting vs last camp day': 'Registration end date',
    'Entered twice · same camp, two listings': 'Entered twice',
    'Event Type · this camp vs matching camps': 'Event Type',
    'Price table · this camp vs matching camps': 'Price table',
    'Sibling discount · this camp vs matching camps': 'Sibling discount',
    'Camp on a closure day · schedule vs closure list': 'Camp on a closure day',
    'Start date · setting vs camp days': 'Start date',
    'End date · setting vs camp days': 'End date',
    'Ages · name vs age setting': 'Ages in titles',
    'Ages · description vs age setting': 'Ages in descriptions',
    'Price · description vs price table': 'Price mismatch',
    'Price table · blank box': 'Price table blank',
    'Dates · name vs camp dates': 'Dates in title',
    'Price · name vs price table': 'Price in title',
    'Description missing': 'Missing description',
    'Dates · description vs camp dates': 'Dates in description',
    'Description missing · theme, dates, time or ages': 'Missing camp details',
    'Description missing · snack': 'Snack information',
    'Description missing · what to wear or bring': 'What to wear or bring',
    'Wrong description · another camp’s description': 'Description from another camp',
    'Wrong description · another camp’s text': 'Description from another camp',
    'Spelling · name vs description': 'Spelling',
    'Spelling · picture text': 'Picture spelling',
    'Dates · picture vs camp dates': 'Picture dates',
    'Picture · another week’s theme': 'Picture from another week',
    'Picture · same as another week': 'Same picture',
    'Name format · name vs Kim’s format': 'Title format',
    'Time · description vs schedule (AM / PM mix-up)': 'Hours in description',
    'Time · description vs schedule': 'Hours in description',
    'Name · leftover text': 'Leftover text in title',
    'Full / Half Day · name vs settings': 'Full / Half Day',
    'Hours · one day vs the other days': 'Hours',
    'Hours · not the same every day': 'Hours',
    'Hours · this camp vs other weeks': 'Hours',
    'Single-day sign-up · this week vs other weeks': 'Single-day registration',
    'Single-day sign-up · setting vs description': 'Single-day registration',
    'Missing camp · this week vs other weeks': 'Missing camp',
    'Camp days · this camp vs the week’s other camps': 'Missing day',
    'Min age · this camp vs matching camps': 'Min age',
    'Max age · this camp vs matching camps': 'Max age',
    'Spots · this camp vs matching camps': 'Spots',
    'Price table · 2nd child vs other boxes': 'Price table',
}


def _older(err):
    """The 11-06 name for an error (an already-fixed name is returned as it is)."""
    if err in FIXED:
        return FIXED[err]
    m = re.match(r'^(Min age|Max age|Spots) not consistent$', err)
    if m:
        return f"{m.group(1)} · this camp vs matching camps"
    if re.match(r'^Missing ' + _DAYS + r'$', err):     # "Missing Monday" is already her label
        return err
    for pat, new in PATTERNS:
        if new and re.match(pat, err):
            return new
    return err


def name(err):
    """Her short label for an error, from any name it was ever written under."""
    err = (err or '').strip()
    o = _older(err)
    return SHORT.get(o, o)
