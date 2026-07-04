"""
Database-Driven Validation Engine
=================================
Replaces hardcoded validation checks in f12_collect_and_import.py.

How it works:
1. Fetches active check rules from the Supabase `rules` table
2. For each active check, runs the corresponding validation function
3. Returns errors in the SAME format as the old hardcoded system
4. Updates hit counts on each rule after validation

The old code stays in f12_collect_and_import.py until this is verified.
Switch over by calling run_validation() instead of the inline block.
"""

import re
import calendar
from datetime import datetime, date


# ============================================================
# VALIDATION CONTEXT — shared data used by all checks
# ============================================================

class ValidationContext:
    """Holds all the data a check function needs. Built once per event."""

    def __init__(self, event_dict, gym_id, event_type, title, description,
                 start_date, end_date_str, time_str, age_min, day_of_week,
                 get_rules_for_gym_fn, get_camp_pricing_fn, get_event_pricing_fn):
        self.event = event_dict
        self.gym_id = gym_id
        self.event_type = event_type  # e.g. 'CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM'
        self.title = title
        self.description = description or ''
        self.start_date = start_date
        self.end_date_str = end_date_str or start_date
        self.time_str = time_str
        self.age_min = age_min
        self.day_of_week = day_of_week

        # Lowercase versions (used by almost every check)
        self.title_lower = title.lower() if title else ''
        self.description_lower = self.description.lower()

        # Parsed dates
        self.event_date = None
        self.event_month = None
        self.event_year = None
        self.event_day = None
        self.end_date_obj = None
        try:
            self.event_date = datetime.strptime(start_date, "%Y-%m-%d")
            self.event_month = self.event_date.strftime("%B").lower()
            self.event_year = self.event_date.year
            self.event_day = self.event_date.day
            self.end_date_obj = datetime.strptime(self.end_date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            pass

        # Database lookup functions (passed in from main module)
        self.get_rules_for_gym = get_rules_for_gym_fn
        self.get_camp_pricing = get_camp_pricing_fn
        self.get_event_pricing = get_event_pricing_fn

        # Extracted prices (used by multiple price checks)
        self.title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title) if title else []
        self.desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', self.description) if self.description else []


# ============================================================
# INDIVIDUAL CHECK FUNCTIONS
# Each returns a list of error dicts (same format as old system)
# ============================================================

def check_date_mismatch(ctx):
    """Check if month in description matches actual event dates."""
    errors = []
    if not ctx.event_date or not ctx.description:
        return errors

    # End date before start date
    if ctx.end_date_obj and ctx.end_date_obj < ctx.event_date:
        errors.append({
            "type": "date_mismatch",
            "severity": "error",
            "category": "data_error",
            "message": f"End date ({ctx.end_date_str}) is before start date ({ctx.start_date})"
        })

    # Build valid months from start and end dates
    event_month_abbr = ctx.event_date.strftime("%b").lower()
    end_month = ctx.end_date_obj.strftime("%B").lower() if ctx.end_date_obj else ctx.event_month
    end_month_abbr = ctx.end_date_obj.strftime("%b").lower() if ctx.end_date_obj else event_month_abbr
    valid_months = {ctx.event_month, end_month, event_month_abbr, end_month_abbr}

    # Add every month between start and end
    if ctx.end_date_obj and ctx.event_date.month != ctx.end_date_obj.month:
        m = ctx.event_date.month
        while m != ctx.end_date_obj.month:
            m = m % 12 + 1
            valid_months.add(calendar.month_name[m].lower())
            valid_months.add(calendar.month_abbr[m].lower())

    # Scan description for month mentions that don't match
    all_months = {}
    for i, full_name in enumerate(calendar.month_name):
        if full_name:
            all_months[full_name.lower()] = i
    for i, abbr in enumerate(calendar.month_abbr):
        if abbr:
            all_months[abbr.lower()] = i

    for month_name, month_num in all_months.items():
        if len(month_name) <= 3:
            pattern = r'\b' + month_name + r'\b'
            if not re.search(pattern, ctx.description_lower[:200]):
                continue
        else:
            if month_name not in ctx.description_lower[:200]:
                continue

        if month_name not in valid_months:
            # Skip registration/signup context
            skip_patterns = [
                r'(register|registration|sign\s*up|enroll|deadline|closes?|opens?|book\s*by|by)\s+\w*\s*' + month_name,
                r'(also|check out|see our|upcoming|next|other|more)\s+\w*\s*' + month_name,
            ]
            if any(re.search(p, ctx.description_lower[:300]) for p in skip_patterns):
                continue

            if len(month_name) <= 3:
                in_first_200 = bool(re.search(r'\b' + month_name + r'\b', ctx.description_lower[:200]))
            else:
                in_first_200 = month_name in ctx.description_lower[:200]

            if in_first_200:
                errors.append({
                    "type": "date_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": f"Event is {ctx.event_month.title()} {ctx.event_day} but description says '{month_name.title()}'"
                })
                break

    return errors


def check_year_mismatch(ctx):
    """Check if year in title or description matches actual event year."""
    errors = []
    if not ctx.event_date:
        return errors

    # Check title
    title_year_matches = re.findall(r'\b(20\d{2})\b', ctx.title)
    for title_year in title_year_matches:
        title_year_int = int(title_year)
        if title_year_int != ctx.event_year:
            errors.append({
                "type": "year_mismatch",
                "severity": "error",
                "category": "data_error",
                "message": f"Title says {title_year} but event is in {ctx.event_year}"
            })
            break

    # Check description (first 300 chars)
    desc_year_matches = re.findall(r'\b(20\d{2})\b', ctx.description[:300])
    for desc_year in desc_year_matches:
        desc_year_int = int(desc_year)
        if desc_year_int != ctx.event_year:
            end_year = ctx.end_date_obj.year if ctx.end_date_obj else ctx.event_year
            if desc_year_int != end_year:
                errors.append({
                    "type": "year_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": f"Description says {desc_year} but event is in {ctx.event_year}"
                })
                break

    return errors


def check_time_mismatch(ctx):
    """Check if time in title/description matches iClass time."""
    errors = []
    if not ctx.time_str:
        return errors

    # Extract hours from structured time
    event_times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?', ctx.time_str.lower())
    event_hours = set()
    for et in event_times:
        if et[0]:
            hour = int(et[0])
            ampm = (et[2] or '').replace('.', '')
            if ampm == 'pm' and hour != 12:
                hour += 12
            elif ampm == 'am' and hour == 12:
                hour = 0
            event_hours.add(hour)

    if not event_hours:
        return errors

    def find_mismatched_time(text, char_limit=300):
        """Find a time in text that doesn't match event times."""
        text_lower = text.lower()[:char_limit]
        # Pre-clean false positives
        text_cleaned = re.sub(r'\$\d+(?:\.\d{2})?\s*(?:a\s+day|a\s+week|/day|/week|per\s+day|per\s+week)', ' ', text_lower)
        text_cleaned = re.sub(r'ages?\s*\d{1,2}\s*[-\u2013to]+\s*\d{1,2}', ' ', text_cleaned)
        text_cleaned = re.sub(r'\d{1,2}\s*[-\u2013]\s*\d{1,2}\s*(?:years?|yrs?)', ' ', text_cleaned)
        text_cleaned = re.sub(r'\$\d+(?:\.\d{2})?\s+a(?!\s*m)', ' ', text_cleaned)
        # Drop-off / pick-up / before-after care times are NOT the event time \u2014
        # e.g. "Complementary 8:30am Early Drop Off Available" on a 9am camp.
        # Strip the time when a care/drop/pick keyword sits right before or
        # after it (real false positive, ~10 RBA/RBK camps, July 2026).
        _care = r'(?:early\s+|late\s+)?(?:drop[\s-]?off|pick[\s-]?up|before[\s-]*care|after[\s-]*care|doors?\s+open|extended\s+care)'
        text_cleaned = re.sub(r'\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*' + _care, ' ', text_cleaned)
        text_cleaned = re.sub(_care + r'[^.\n]{0,15}?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?', ' ', text_cleaned)

        found_times = re.findall(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)(?:\b|(?=\s|-))', text_cleaned)
        for found_time in found_times:
            found_hour = int(found_time[0])
            raw_ampm = found_time[2].replace('.', '') if found_time[2] else ''
            found_ampm = 'am' if raw_ampm in ['a', 'am'] else 'pm' if raw_ampm in ['p', 'pm'] else ''
            if found_ampm == 'pm' and found_hour != 12:
                found_hour += 12
            elif found_ampm == 'am' and found_hour == 12:
                found_hour = 0

            if not any(found_hour == eh for eh in event_hours):
                time_str_formatted = f"{found_time[0]}"
                if found_time[1]:
                    time_str_formatted += f":{found_time[1]}"
                time_str_formatted += f" {raw_ampm}"
                return time_str_formatted
        return None

    # Get extra valid times from rules
    extra_time_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('time', [])
    extra_time_values = [t['value'].lower().strip() for t in extra_time_rules]

    # Check title
    title_mismatch = find_mismatched_time(ctx.title, char_limit=200)
    if title_mismatch and title_mismatch.lower().strip() not in extra_time_values:
        errors.append({
            "type": "time_mismatch",
            "severity": "warning",
            "category": "data_error",
            "message": f"iClass time is {ctx.time_str} but title says {title_mismatch}"
        })

    # Check description
    desc_mismatch = find_mismatched_time(ctx.description, char_limit=300)
    if desc_mismatch and desc_mismatch.lower().strip() not in extra_time_values:
        errors.append({
            "type": "time_mismatch",
            "severity": "warning",
            "category": "data_error",
            "message": f"iClass time is {ctx.time_str} but description says {desc_mismatch}"
        })

    return errors


def check_age_mismatch(ctx):
    """Check if age in title/description matches iClass age_min."""
    errors = []

    def extract_min_age(text, char_limit=300):
        if not text:
            return None
        text_lower = text.lower()[:char_limit]
        # Pre-clean ages expressed in MONTHS ("ages 18 months to 4 years",
        # "12 mos+") \u2014 iClass age_min is in years, so a months number is not
        # comparable and produced false positives (real case: OAS preschool
        # open gym, "ages 18 months to 4 years" flagged as "says 18" vs min 1).
        text_lower = re.sub(r'ages?\s*\d{1,2}\s*(?:months?|mos?)\b', ' ', text_lower)
        text_lower = re.sub(r'\b\d{1,2}\s*(?:months?|mos?)\b', ' ', text_lower)
        age_patterns = re.findall(
            r'ages?\s*(\d{1,2})\s*[-\u2013to+]|ages?\s*(\d{1,2})\b|(\d{1,2})\s*[-\u2013]\s*\d{1,2}\s*(?:years?|yrs?)',
            text_lower
        )
        for age_match in age_patterns:
            for group in age_match:
                if group:
                    return int(group)
        return None

    title_age = extract_min_age(ctx.title, char_limit=200)
    desc_age = extract_min_age(ctx.description, char_limit=300)

    if ctx.age_min is not None and title_age is not None and ctx.age_min != title_age:
        errors.append({
            "type": "age_mismatch",
            "severity": "warning",
            "category": "data_error",
            "message": f"iClass min age is {ctx.age_min} but title says {title_age}"
        })

    if ctx.age_min is not None and desc_age is not None and ctx.age_min != desc_age:
        errors.append({
            "type": "age_mismatch",
            "severity": "warning",
            "category": "data_error",
            "message": f"iClass min age is {ctx.age_min} but description says {desc_age}"
        })

    if title_age is not None and desc_age is not None and title_age != desc_age:
        errors.append({
            "type": "age_mismatch",
            "severity": "warning",
            "category": "data_error",
            "message": f"Title says age {title_age} but description says {desc_age}"
        })

    return errors


def check_day_mismatch(ctx):
    """Check if day of week in description matches actual event day. Skipped for camps."""
    errors = []
    if not ctx.day_of_week or ctx.event_type == 'CAMP':
        return errors

    day_lower = ctx.day_of_week.lower()
    all_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    day_abbrevs = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

    desc_snippet = ctx.description_lower[:200]

    # Pre-clean day ranges
    day_range_pattern = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*(?:[-\u2013]|to|thru|through)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)'
    desc_snippet_cleaned = re.sub(day_range_pattern, '', desc_snippet)
    desc_snippet_cleaned = re.sub(r'\([^)]*(?:monday|mon)[-\u2013][^)]*(?:friday|fri)[^)]*\)', '', desc_snippet_cleaned)

    day_abbrev_lower = day_lower[:3]
    for full, abbr in zip(all_days, day_abbrevs):
        if full == day_lower or abbr == day_abbrev_lower:
            continue
        if full in desc_snippet_cleaned or re.search(r'\b' + abbr + r'\b', desc_snippet_cleaned):
            errors.append({
                "type": "day_mismatch",
                "severity": "warning",
                "category": "data_error",
                "message": f"Event is on {ctx.day_of_week} but description says '{full.title()}'"
            })
            break

    return errors


def check_program_mismatch(ctx):
    """Check if program type in title/description conflicts with iClass type."""
    errors = []

    # Build keyword lists (with synonym rules from database)
    kno_keywords = ['kids night out', "kid's night out", "kids' night out", 'kno', 'night out', 'parents night out', 'ninja night out']
    clinic_keywords = ['clinic']
    open_gym_keywords = ['open gym']

    synonym_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('program_synonym', [])
    for rule in synonym_rules:
        target = rule.get('label', '').upper()
        keyword = rule.get('value', '').lower()
        if not keyword:
            continue
        if target == 'OPEN GYM' and keyword not in open_gym_keywords:
            open_gym_keywords.append(keyword)
        elif target == 'KIDS NIGHT OUT' and keyword not in kno_keywords:
            kno_keywords.append(keyword)
        elif target == 'CLINIC' and keyword not in clinic_keywords:
            clinic_keywords.append(keyword)

    # program_ignore: keywords that should NOT trigger program-mismatch flags
    # for THIS event_type. e.g., {program: 'KIDS NIGHT OUT', value: 'open gym'}
    # → "open gym" is treated as an activity name inside KNO, not a program type.
    # When no rules exist, ignored_keywords is empty and behavior is unchanged.
    ignore_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('program_ignore', [])
    ignored_keywords = {r.get('value', '').lower().strip() for r in ignore_rules if r.get('value')}
    if ignored_keywords:
        kno_keywords = [kw for kw in kno_keywords if kw not in ignored_keywords]
        clinic_keywords = [kw for kw in clinic_keywords if kw not in ignored_keywords]
        open_gym_keywords = [kw for kw in open_gym_keywords if kw not in ignored_keywords]

    title_has_kno = any(kw in ctx.title_lower for kw in kno_keywords)
    title_has_clinic = any(kw in ctx.title_lower for kw in clinic_keywords)
    title_has_open_gym = any(kw in ctx.title_lower for kw in open_gym_keywords)

    # iClass type vs Title
    if ctx.event_type == 'KIDS NIGHT OUT':
        if title_has_clinic and not title_has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says KNO but title says 'Clinic'"})
        if title_has_open_gym and not title_has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says KNO but title says 'Open Gym'"})

    elif ctx.event_type == 'CLINIC':
        if title_has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says CLINIC but title says 'Kids Night Out'"})
        if title_has_open_gym and not title_has_clinic:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says CLINIC but title says 'Open Gym'"})

    elif ctx.event_type == 'OPEN GYM':
        if title_has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says OPEN GYM but title says 'Kids Night Out'"})
        if title_has_clinic and not title_has_open_gym:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says OPEN GYM but title says 'Clinic'"})

    elif ctx.event_type == 'CAMP':
        if title_has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says CAMP but title says 'Kids Night Out'"})
        if title_has_clinic:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "iClass says CAMP but title says 'Clinic'"})

    # iClass type vs Description
    desc_no_apos = ctx.description_lower.replace("'", "").replace("\u2019", "").replace("`", "")
    desc_start = ctx.description_lower[:150]
    desc_start_no_apos = desc_start.replace("'", "").replace("\u2019", "")

    # Helper for description-side literal-string checks: skip if the keyword
    # is in the ignore list for this event_type.
    def _ignored(kw):
        return kw in ignored_keywords

    if ctx.event_type == 'KIDS NIGHT OUT':
        has_clinic = (not _ignored('clinic')) and ('clinic' in ctx.description_lower[:100])
        if has_clinic:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "KNO event but description says 'Clinic'"})

    elif ctx.event_type == 'CLINIC':
        kno_phrase_active = not (_ignored('kids night out') or _ignored('kno') or _ignored('night out'))
        has_kno = kno_phrase_active and (
            'kids night out' in desc_start_no_apos or 'kid night out' in desc_start_no_apos or
            ctx.description_lower[:50].startswith('kno') or 'night out' in desc_start_no_apos or
            'parents night out' in desc_start_no_apos or 'ninja night out' in ctx.description_lower[:100])
        has_open_gym = (not _ignored('open gym')) and ctx.description_lower[:100].startswith('open gym')

        if has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "CLINIC event but description says 'Kids Night Out'"})
        if has_open_gym:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "CLINIC event but description starts with 'Open Gym'"})

    elif ctx.event_type == 'OPEN GYM':
        has_clinic = (not _ignored('clinic')) and (
            ctx.description_lower[:100].startswith('clinic') or 'clinic' in ctx.description_lower[:50])
        kno_phrase_active = not (_ignored('kids night out') or _ignored('kno') or _ignored('night out'))
        has_kno = kno_phrase_active and (
            'kids night out' in desc_start_no_apos or 'kid night out' in desc_start_no_apos or
            'night out' in desc_start_no_apos or 'parents night out' in desc_start_no_apos or
            'ninja night out' in ctx.description_lower[:100])

        if has_clinic:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "OPEN GYM event but description says 'Clinic'"})
        if has_kno:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "OPEN GYM event but description says 'Kids Night Out'"})

    elif ctx.event_type == 'CAMP':
        has_clinic_start = (not _ignored('clinic')) and ctx.description_lower[:50].startswith('clinic')
        kno_phrase_active = not (_ignored('kids night out') or _ignored('kno') or _ignored('night out'))
        has_kno_start = kno_phrase_active and (
            desc_start_no_apos.startswith('kids night out') or
            desc_start_no_apos.startswith('kid night out') or
            ctx.description_lower[:50].startswith('kno ') or
            desc_start_no_apos.startswith('parents night out') or
            desc_start_no_apos.startswith('ninja night out'))

        if has_clinic_start:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "CAMP event but description starts with 'Clinic'"})
        if has_kno_start:
            errors.append({"type": "program_mismatch", "severity": "error", "category": "data_error",
                          "message": "CAMP event but description starts with 'Kids Night Out'"})

    return errors


def check_skill_mismatch(ctx):
    """Check if skill in title matches skill in description (CLINIC only)."""
    errors = []
    if ctx.event_type != 'CLINIC':
        return errors

    skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling',
              'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend',
              'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'tumbl', 'bridge',
              'kickover', 'walkover', 'flip flop', 'flip-flop', 'back walkover', 'front walkover']

    title_skill = None
    desc_skill = None

    for skill in skills:
        if skill in ctx.title_lower:
            title_skill = skill
            break

    desc_start = ctx.description_lower[:150]
    for skill in skills:
        if skill in desc_start:
            desc_skill = skill
            break

    if title_skill and desc_skill and title_skill != desc_skill:
        if title_skill.replace(' ', '') != desc_skill.replace(' ', ''):
            errors.append({
                "type": "skill_mismatch",
                "severity": "error",
                "category": "data_error",
                "message": f"Title says '{title_skill}' but description says '{desc_skill}'"
            })

    return errors


def check_title_desc_mismatch(ctx):
    """Check if title and description contradict each other on program type."""
    errors = []

    title_no_apos = ctx.title_lower.replace("'", "").replace("\u2019", "")
    title_has_clinic = 'clinic' in ctx.title_lower
    title_has_kno = ('kids night out' in title_no_apos or 'kid night out' in title_no_apos or
                     ctx.title_lower.startswith('kno ') or ' kno ' in ctx.title_lower or
                     'night out' in title_no_apos or 'parents night out' in title_no_apos or
                     'ninja night out' in ctx.title_lower)
    title_has_open_gym = 'open gym' in ctx.title_lower

    # Check synonym rules for open gym
    if not title_has_open_gym:
        og_syn_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('program_synonym', [])
        for rule in og_syn_rules:
            if rule.get('label', '').upper() == 'OPEN GYM' and rule.get('value', '').lower() in ctx.title_lower:
                title_has_open_gym = True
                break

    desc_start = ctx.description_lower[:150]
    desc_start_no_apos = desc_start.replace("'", "").replace("\u2019", "")
    desc_has_clinic = 'clinic' in desc_start
    desc_has_kno = ('kids night out' in desc_start_no_apos or 'kid night out' in desc_start_no_apos or
                    desc_start.startswith('kno ') or 'night out' in desc_start_no_apos or
                    'parents night out' in desc_start_no_apos or 'ninja night out' in desc_start)
    desc_has_open_gym = desc_start.startswith('open gym')

    # program_ignore: force any ignored program-keyword bool to False so the
    # cross-check below won't fire on it. Empty rule set = no behavior change.
    ignore_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('program_ignore', [])
    ignored_keywords = {r.get('value', '').lower().strip() for r in ignore_rules if r.get('value')}
    if 'open gym' in ignored_keywords:
        title_has_open_gym = False
        desc_has_open_gym = False
    if 'clinic' in ignored_keywords:
        title_has_clinic = False
        desc_has_clinic = False
    if ignored_keywords & {'kids night out', 'kno', 'night out'}:
        title_has_kno = False
        desc_has_kno = False

    cross_checks = [
        (title_has_clinic, desc_has_kno, "Title says 'Clinic' but description says 'Kids Night Out'"),
        (title_has_kno, desc_has_clinic, "Title says 'Kids Night Out' but description says 'Clinic'"),
        (title_has_open_gym, desc_has_kno, "Title says 'Open Gym' but description says 'Kids Night Out'"),
        (title_has_kno, desc_has_open_gym, "Title says 'Kids Night Out' but description starts with 'Open Gym'"),
        (title_has_clinic, desc_has_open_gym, "Title says 'Clinic' but description starts with 'Open Gym'"),
        (title_has_open_gym, desc_has_clinic, "Title says 'Open Gym' but description says 'Clinic'"),
    ]

    for title_cond, desc_cond, message in cross_checks:
        if title_cond and desc_cond:
            errors.append({
                "type": "title_desc_mismatch",
                "severity": "error",
                "category": "data_error",
                "message": message
            })

    return errors


def check_impossible_date(ctx):
    """Check for dates that cannot exist (e.g., June 31st, February 30th). NEW CHECK."""
    errors = []

    # Look for date patterns in title and description
    # Patterns: "June 31st", "June 31", "6/31", "06/31"
    month_days = {
        1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
        7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
    }

    texts_to_check = [ctx.title, ctx.description[:300]] if ctx.description else [ctx.title]

    for text in texts_to_check:
        if not text:
            continue
        text_lower = text.lower()

        # Pattern 1: "Month DDth" or "Month DD" (e.g., "June 31st", "June 31")
        for month_num in range(1, 13):
            month_full = calendar.month_name[month_num].lower()
            month_abbr = calendar.month_abbr[month_num].lower()

            for month_str in [month_full, month_abbr]:
                # Match "June 31st", "June 31", "Jun 31st", etc.
                pattern = month_str + r'\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s|,|$|-)'
                matches = re.findall(pattern, text_lower)
                for day_str in matches:
                    day = int(day_str)
                    max_days = month_days[month_num]
                    if day > max_days:
                        errors.append({
                            "type": "date_mismatch",
                            "severity": "error",
                            "category": "data_error",
                            "message": f"Impossible date: {calendar.month_name[month_num]} {day} doesn't exist ({calendar.month_name[month_num]} has {max_days} days)"
                        })
                        return errors  # One is enough

        # Pattern 2: "MM/DD" format (e.g., "6/31", "06/31")
        slash_dates = re.findall(r'\b(\d{1,2})/(\d{1,2})(?:/\d{2,4})?\b', text)
        for month_str, day_str in slash_dates:
            month_num = int(month_str)
            day = int(day_str)
            if 1 <= month_num <= 12:
                max_days = month_days[month_num]
                if day > max_days:
                    errors.append({
                        "type": "date_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": f"Impossible date: {calendar.month_name[month_num]} {day} doesn't exist ({calendar.month_name[month_num]} has {max_days} days)"
                    })
                    return errors

    return errors


def check_price_mismatch(ctx):
    """Check if price in title differs from price in description."""
    errors = []
    if not ctx.title_prices or not ctx.desc_prices:
        return errors

    title_price = float(ctx.title_prices[0])
    desc_price_floats = [float(p) for p in ctx.desc_prices]
    title_price_found = any(abs(title_price - dp) <= 1 for dp in desc_price_floats)

    if not title_price_found:
        errors.append({
            "type": "price_mismatch",
            "severity": "error",
            "category": "data_error",
            "message": f"Title says ${title_price:.0f} but description prices are {', '.join(['$' + p for p in ctx.desc_prices])}"
        })

    return errors


def check_camp_price(ctx):
    """Check camp prices against valid prices in pricing table."""
    errors = []
    if ctx.event_type != 'CAMP':
        return errors

    all_camp_prices = list(set(ctx.title_prices + ctx.desc_prices))
    if not all_camp_prices:
        return errors

    camp_pricing = ctx.get_camp_pricing()
    if ctx.gym_id not in camp_pricing:
        return errors

    gym_prices = camp_pricing[ctx.gym_id]
    valid_prices = []
    price_labels = []

    # Detect duration (half-day vs full-day) from title and program_name so
    # we constrain the valid prices to ONLY the matching subset. Without
    # this, a half-day camp whose description shows the full-day price
    # silently passes (the full-day price is "valid" for the gym, just for
    # the wrong variant). Real bug Jayme found in May 2026: 12 CRR half-day
    # camps had full-day prices in their descriptions and the engine never
    # caught it.
    title_lower = ctx.title_lower or ''
    program_lower = (ctx.event.get('program_name') or '').lower() if ctx.event else ''
    is_half = 'half' in title_lower or 'half' in program_lower
    is_full = 'full' in title_lower or 'full' in program_lower

    if is_half and not is_full:
        allowed_keys = [('half_day_daily', 'Half Day Daily'),
                        ('half_day_weekly', 'Half Day Weekly')]
    elif is_full and not is_half:
        allowed_keys = [('full_day_daily', 'Full Day Daily'),
                        ('full_day_weekly', 'Full Day Weekly')]
    else:
        # No clear hint either way (or both present, e.g. a mixed-format
        # event listing both options) — accept any of the 4. Original
        # behaviour, preserved as the safe fallback.
        allowed_keys = [('full_day_daily', 'Full Day Daily'),
                        ('full_day_weekly', 'Full Day Weekly'),
                        ('half_day_daily', 'Half Day Daily'),
                        ('half_day_weekly', 'Half Day Weekly')]

    for key, label_prefix in allowed_keys:
        if gym_prices.get(key):
            valid_prices.append(float(gym_prices[key]))
            price_labels.append(f"{label_prefix} ${gym_prices[key]}")

    # Add extra valid prices from rules
    extra_price_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('price', [])
    for ep in extra_price_rules:
        try:
            extra_price = float(ep['value'])
            if extra_price not in valid_prices:
                valid_prices.append(extra_price)
                price_labels.append(f"{ep.get('label', 'Custom')} ${ep['value']}")
        except (ValueError, TypeError):
            pass

    if not valid_prices:
        return errors

    for camp_price_str in all_camp_prices:
        camp_price = float(camp_price_str)
        is_valid = any(abs(camp_price - vp) <= 2 for vp in valid_prices)
        if not is_valid:
            errors.append({
                "type": "camp_price_mismatch",
                "severity": "warning",
                "category": "data_error",
                "message": f"Camp price ${camp_price:.0f} doesn't match any valid price for {ctx.gym_id}. Valid: {', '.join(price_labels)}"
            })
            break

    return errors


def check_event_price(ctx):
    """Check clinic/KNO/open gym prices against valid prices in pricing table."""
    errors = []
    if ctx.event_type not in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']:
        return errors

    event_pricing = ctx.get_event_pricing()
    if ctx.gym_id not in event_pricing or ctx.event_type not in event_pricing[ctx.gym_id]:
        return errors

    valid_prices = list(event_pricing[ctx.gym_id][ctx.event_type])

    # Add extra valid prices from rules
    extra_price_rules = ctx.get_rules_for_gym(ctx.gym_id, ctx.event_type).get('price', [])
    for ep in extra_price_rules:
        try:
            extra_price = float(ep['value'])
            if extra_price not in valid_prices:
                valid_prices.append(extra_price)
        except (ValueError, TypeError):
            pass

    if not valid_prices:
        return errors

    all_event_prices = list(set(ctx.title_prices + ctx.desc_prices))
    if not all_event_prices:
        return errors

    all_found_prices = set(float(p) for p in all_event_prices)
    expected_price_found = any(
        any(abs(found - vp) <= 1 for found in all_found_prices)
        for vp in valid_prices
    )

    if not expected_price_found:
        valid_str = ', '.join([f'${p:.0f}' for p in valid_prices])
        found_str = ', '.join([f'${p}' for p in all_event_prices])
        errors.append({
            "type": "event_price_mismatch",
            "severity": "error",
            "category": "data_error",
            "message": f"{ctx.event_type} price {found_str} doesn't match expected price for {ctx.gym_id}. Valid: {valid_str}"
        })

    return errors


# ============================================================
# CHECK REGISTRY — maps rule_type to check function
# ============================================================

CHECK_REGISTRY = {
    'check_date_mismatch': check_date_mismatch,
    'check_year_mismatch': check_year_mismatch,
    'check_time_mismatch': check_time_mismatch,
    'check_age_mismatch': check_age_mismatch,
    'check_day_mismatch': check_day_mismatch,
    'check_program_mismatch': check_program_mismatch,
    'check_title_desc_mismatch': check_title_desc_mismatch,
    'check_impossible_date': check_impossible_date,
    'check_price_mismatch': check_price_mismatch,
    'check_camp_price': check_camp_price,
    'check_event_price': check_event_price,
}

# Skill mismatch is part of program_mismatch check (runs inside check_program_mismatch context)
# We register it separately so it can be toggled independently in the future
CHECK_REGISTRY['check_skill_mismatch'] = check_skill_mismatch


# ============================================================
# MAIN VALIDATION FUNCTION
# ============================================================

def run_validation(ctx, active_checks):
    """
    Run all active validation checks against a single event.

    Args:
        ctx: ValidationContext with all event data
        active_checks: list of rule dicts from the database
                       (only rules where is_active=True and rule_type starts with 'check_')

    Returns:
        list of error dicts (same format as old system)
        dict mapping rule_id -> hit_count for this event
    """
    all_errors = []
    hit_counts = {}  # rule_id -> number of errors this rule found

    if not ctx.description or ctx.event_type == 'SPECIAL EVENT':
        return all_errors, hit_counts

    for check_rule in active_checks:
        rule_type = check_rule['rule_type']
        rule_id = check_rule['id']

        # Check if this rule applies to this gym
        gym_ids = check_rule.get('gym_ids', ['ALL'])
        if 'ALL' not in gym_ids and ctx.gym_id not in gym_ids:
            continue

        # Check if this rule applies to this program type
        program = check_rule.get('program', 'ALL')
        if program != 'ALL' and program != ctx.event_type:
            continue

        # Look up the check function
        check_fn = CHECK_REGISTRY.get(rule_type)
        if not check_fn:
            continue

        # Run the check
        try:
            errors = check_fn(ctx)
            if errors:
                all_errors.extend(errors)
                hit_counts[rule_id] = len(errors)
        except Exception as e:
            print(f"    [ERROR] Check {rule_type} failed: {e}")

    return all_errors, hit_counts


def fetch_active_checks(supabase_client):
    """
    Fetch all active check rules from the database.
    Returns list of rule dicts.
    """
    try:
        response = supabase_client.table('rules').select('*').eq('is_active', True).like('rule_type', 'check_%').execute()
        rules = response.data or []
        # Also filter out expired temporary rules
        active_rules = []
        today = date.today().isoformat()
        for rule in rules:
            if not rule.get('is_permanent', True) and rule.get('end_date'):
                if rule['end_date'] < today:
                    continue  # Expired
            active_rules.append(rule)
        return active_rules
    except Exception as e:
        print(f"[ERROR] Failed to fetch active checks from database: {e}")
        return []


def update_hit_counts(supabase_client, hit_counts_by_rule):
    """
    Update last_hit_count and last_sync_at on each rule that ran.

    Args:
        supabase_client: Supabase client
        hit_counts_by_rule: dict mapping rule_id -> total hits across all events
    """
    now = datetime.utcnow().isoformat()
    for rule_id, count in hit_counts_by_rule.items():
        try:
            supabase_client.table('rules').update({
                'last_hit_count': count,
                'last_sync_at': now
            }).eq('id', rule_id).execute()
        except Exception as e:
            print(f"[WARNING] Failed to update hit count for rule {rule_id}: {e}")
