"""
Analyze January 2026 events for validation alerts using the current logic.
"""
import json
import re
from datetime import datetime

# Load the JSON data
with open(r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T204528.196.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

alerts = []

for event in events:
    title = event.get('title', '')
    description = event.get('description', '') or ''
    start_date = event.get('start_date', '')
    time_str = event.get('time', '')
    age_min = event.get('age_min')
    age_max = event.get('age_max')
    event_type = (event.get('type', '') or '').upper()
    event_url = event.get('event_url', '')
    day_of_week = event.get('day_of_week', '')
    price = event.get('price')
    deleted = event.get('deleted_at')
    
    # Skip deleted or non-January events
    if deleted:
        continue
    if not start_date.startswith('2026-01'):
        continue
    
    event_errors = []
    description_lower = description.lower() if description else ''
    title_lower = title.lower()
    
    # Skip CAMP for most validation
    skip_validation = event_type == 'CAMP'
    
    # === DESCRIPTION STATUS ===
    if not description:
        event_errors.append('No description at all')
    
    # === PRICING VALIDATION ===
    title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title)
    desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description) if description else []
    
    if description and not desc_prices:
        event_errors.append('No price in description')
    elif title_prices and desc_prices:
        title_price = float(title_prices[0])
        desc_price = float(desc_prices[0])
        if title_price != desc_price:
            event_errors.append(f'Price mismatch: Title ${title_price:.0f} vs Desc ${desc_price:.0f}')
    
    if not skip_validation and description:
        # === YEAR VALIDATION (NEW) ===
        try:
            event_date = datetime.strptime(start_date, '%Y-%m-%d')
            event_year = event_date.year
            title_years = re.findall(r'\b(20\d{2})\b', title)
            for ty in title_years:
                if int(ty) != event_year:
                    event_errors.append(f'Wrong year in title: says {ty} but event is {event_year}')
                    break
        except:
            pass
        
        # === TIME VALIDATION ===
        if time_str:
            event_times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?', time_str.lower())
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
            
            if event_hours:
                # Check description times
                desc_times = re.findall(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)', description_lower[:300])
                for dt in desc_times:
                    d_hour = int(dt[0])
                    d_ampm = dt[2].replace('.', '') if dt[2] else ''
                    if d_ampm == 'pm' and d_hour != 12:
                        d_hour += 12
                    elif d_ampm == 'am' and d_hour == 12:
                        d_hour = 0
                    if d_hour not in event_hours:
                        time_fmt = f"{dt[0]}:{dt[1]} {dt[2]}" if dt[1] else f"{dt[0]} {dt[2]}"
                        event_errors.append(f'Time mismatch: Desc says {time_fmt}, iClass is {time_str}')
                        break
        
        # === AGE VALIDATION ===
        def extract_min_age(text, limit=300):
            if not text:
                return None
            txt = text.lower()[:limit]
            # Match "Ages 5-12", "Ages 5+", "Age 5", "5-12 years"
            matches = re.findall(r'ages?\s*(\d{1,2})\s*[-\u2013to+]|ages?\s*(\d{1,2})\b|(\d{1,2})\s*[-\u2013]\s*\d{1,2}\s*(?:years?|yrs?)', txt)
            for m in matches:
                for g in m:
                    if g:
                        return int(g)
            return None
        
        title_age = extract_min_age(title, 200)
        desc_age = extract_min_age(description, 300)
        
        if age_min is not None and title_age is not None and age_min != title_age:
            event_errors.append(f'Age mismatch: iClass={age_min}, Title={title_age}')
        if age_min is not None and desc_age is not None and age_min != desc_age:
            event_errors.append(f'Age mismatch: iClass={age_min}, Desc={desc_age}')
        if title_age is not None and desc_age is not None and title_age != desc_age:
            event_errors.append(f'Age mismatch: Title={title_age}, Desc={desc_age}')
        
        # === PROGRAM TYPE VALIDATION ===
        kno_kws = ['kids night out', "kid's night out", "kids' night out", 'kno', 'ninja night out']
        clinic_kws = ['clinic']
        og_kws = ['open gym', 'gym fun', 'fun gym', 'preschool fun', 'bonus tumbling']
        
        title_kno = any(k in title_lower for k in kno_kws)
        title_clinic = any(k in title_lower for k in clinic_kws)
        title_og = any(k in title_lower for k in og_kws)
        
        # iClass type vs Title
        if event_type == 'KIDS NIGHT OUT' and title_clinic and not title_kno:
            event_errors.append('Program mismatch: iClass=KNO but Title says Clinic')
        if event_type == 'KIDS NIGHT OUT' and title_og and not title_kno:
            event_errors.append('Program mismatch: iClass=KNO but Title says Open Gym')
        if event_type == 'CLINIC' and title_kno:
            event_errors.append('Program mismatch: iClass=CLINIC but Title says KNO')
        if event_type == 'CLINIC' and title_og and not title_clinic:
            event_errors.append('Program mismatch: iClass=CLINIC but Title says Open Gym')
        if event_type == 'OPEN GYM' and title_kno:
            event_errors.append('Program mismatch: iClass=OPEN GYM but Title says KNO')
        if event_type == 'OPEN GYM' and title_clinic and not title_og:
            event_errors.append('Program mismatch: iClass=OPEN GYM but Title says Clinic')
        
        # iClass type vs Description
        desc_no_apos = description_lower.replace("'", '').replace("'", '').replace('`', '')
        desc_kno = 'kids night out' in desc_no_apos or 'kid night out' in desc_no_apos or 'kno' in description_lower
        desc_clinic = 'clinic' in description_lower
        desc_og = 'open gym' in description_lower or 'fun gym' in description_lower or 'gym fun' in description_lower or 'play and explore the gym' in description_lower
        
        if event_type == 'KIDS NIGHT OUT' and not desc_kno:
            event_errors.append('KNO missing in description')
        if event_type == 'KIDS NIGHT OUT' and desc_clinic:
            event_errors.append('KNO event but Desc says Clinic')
        if event_type == 'CLINIC' and not desc_clinic:
            event_errors.append('Clinic missing in description')
        if event_type == 'CLINIC' and desc_kno:
            event_errors.append('CLINIC event but Desc says KNO')
        if event_type == 'OPEN GYM' and not desc_og:
            event_errors.append('Open Gym missing in description')
        if event_type == 'OPEN GYM' and desc_clinic:
            event_errors.append('OPEN GYM event but Desc says Clinic')
    
    if event_errors:
        alerts.append({
            'title': title,
            'errors': event_errors,
            'url': event_url
        })

print(f'\n=== JANUARY 2026 VALIDATION ALERTS ({len(alerts)} events with issues) ===\n')
for i, a in enumerate(alerts, 1):
    display_title = a['title'][:70] + '...' if len(a['title']) > 70 else a['title']
    print(f'{i}. {display_title}')
    for err in a['errors']:
        print(f'   [X] {err}')
    print(f'   URL: {a["url"]}')
    print()

