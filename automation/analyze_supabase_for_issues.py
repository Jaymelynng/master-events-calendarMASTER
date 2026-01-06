"""
Analyze Supabase JSON export for validation issues.
Simulates what our validation would flag.
"""
import json
import re
import sys
from collections import defaultdict

# Fix encoding for Windows
sys.stdout.reconfigure(encoding='utf-8')

# Load the data
with open(r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T191448.414.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

print(f"[CHART] Total events: {len(events)}")
print("=" * 80)

# Categories for issues
issues = {
    'no_description': [],
    'flyer_only': [],
    'no_price_in_desc': [],
    'price_mismatch': [],
    'age_mismatch': [],
    'time_mismatch': [],
    'skill_mismatch': [],
    'program_type_mismatch': [],
}

# Keywords for program types
kno_keywords = ['kids night out', "kid's night out", 'kno', 'ninja night out']
clinic_keywords = ['clinic']
open_gym_keywords = ['open gym', 'gym fun', 'fun gym', 'preschool fun']

# Skills for clinics
clinic_skills = [
    'cartwheel', 'handstand', 'pullover', 'bridge', 'kickover', 
    'back handspring', 'backhandspring', 'front handspring', 'roundoff',
    'walkover', 'backwalkover', 'back walkover', 'front walkover',
    'trampoline', 'tumbl', 'bar', 'beam', 'floor', 'vault', 'kip'
]

for event in events:
    title = event.get('title', '') or ''
    description = event.get('description', '') or ''
    event_type = event.get('type', '') or ''
    price_field = event.get('price', '')
    age_min = event.get('age_min')
    age_max = event.get('age_max')
    time_field = event.get('time', '') or ''
    gym_id = event.get('gym_id', '')
    date = event.get('date', '')
    desc_status = event.get('description_status', '')
    
    title_lower = title.lower()
    desc_lower = description.lower()
    
    # Skip CAMP type for price validation (they have complex pricing)
    skip_price = (event_type == 'CAMP')
    
    event_info = {
        'gym': gym_id,
        'title': title[:80] + '...' if len(title) > 80 else title,
        'date': date,
        'type': event_type
    }
    
    # 1. NO DESCRIPTION
    if not description.strip() or desc_status == 'none':
        issues['no_description'].append(event_info)
        continue  # Can't check other things without description
    
    # 2. FLYER ONLY
    if desc_status == 'flyer_only':
        issues['flyer_only'].append(event_info)
        continue
    
    # 3. NO PRICE IN DESCRIPTION (non-camp only)
    if not skip_price:
        desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description)
        if not desc_prices:
            issues['no_price_in_desc'].append(event_info)
    
    # 4. PRICE MISMATCH (title vs description)
    if not skip_price:
        title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title)
        desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description)
        if title_prices and desc_prices:
            title_price = float(title_prices[0])
            desc_price = float(desc_prices[0])
            if title_price != desc_price:
                event_info['detail'] = f"Title: ${title_price:.0f} vs Desc: ${desc_price:.0f}"
                issues['price_mismatch'].append(event_info)
    
    # 5. AGE MISMATCH (title vs system age_min)
    if age_min:
        # Find ages in title like "Ages 4-13" or "Ages 5+"
        age_matches = re.search(r'ages?\s*(\d+)', title_lower)
        if age_matches:
            title_age = int(age_matches.group(1))
            if title_age != age_min:
                event_info['detail'] = f"Title: {title_age}, System: {age_min}"
                issues['age_mismatch'].append(event_info)
    
    # 6. PROGRAM TYPE MISMATCH (title vs description)
    title_has_kno = any(kw in title_lower for kw in kno_keywords)
    title_has_clinic = any(kw in title_lower for kw in clinic_keywords)
    title_has_open_gym = any(kw in title_lower for kw in open_gym_keywords)
    
    desc_has_kno = any(kw in desc_lower[:200] for kw in kno_keywords)
    desc_has_clinic = any(kw in desc_lower[:200] for kw in clinic_keywords)
    desc_has_open_gym = any(kw in desc_lower[:200] for kw in open_gym_keywords)
    
    # Title says Clinic, Description says KNO
    if title_has_clinic and desc_has_kno:
        event_info['detail'] = "Title: Clinic, Desc: KNO"
        issues['program_type_mismatch'].append(event_info)
    # Title says KNO, Description says Clinic
    elif title_has_kno and desc_has_clinic:
        event_info['detail'] = "Title: KNO, Desc: Clinic"
        issues['program_type_mismatch'].append(event_info)
    # Title says Open Gym, Description says KNO
    elif title_has_open_gym and desc_has_kno:
        event_info['detail'] = "Title: Open Gym, Desc: KNO"
        issues['program_type_mismatch'].append(event_info)
    # Title says KNO, Description says Open Gym
    elif title_has_kno and desc_has_open_gym:
        event_info['detail'] = "Title: KNO, Desc: Open Gym"
        issues['program_type_mismatch'].append(event_info)
    
    # 7. SKILL MISMATCH (for clinics - title skill vs description skill)
    if title_has_clinic:
        # Find skill in title
        title_skill = None
        for skill in clinic_skills:
            if skill in title_lower:
                title_skill = skill
                break
        
        if title_skill:
            # Check if that skill is in the first 250 chars of description
            desc_first_250 = desc_lower[:250]
            if title_skill not in desc_first_250:
                # Check for a different skill in desc
                for skill in clinic_skills:
                    if skill in desc_first_250 and skill != title_skill:
                        event_info['detail'] = f"Title: {title_skill}, Desc: {skill}"
                        issues['skill_mismatch'].append(event_info)
                        break

# Print results
print("\n" + "=" * 80)
print("[!!] VALIDATION ISSUES FOUND")
print("=" * 80)

for issue_type, events_list in issues.items():
    if events_list:
        print(f"\n### {issue_type.upper().replace('_', ' ')} ({len(events_list)} events)")
        print("-" * 60)
        for i, e in enumerate(events_list[:15]):  # Show first 15
            detail = e.get('detail', '')
            if detail:
                print(f"  {i+1}. [{e['gym']}] {e['date']} - {e['title']}")
                print(f"      → {detail}")
            else:
                print(f"  {i+1}. [{e['gym']}] {e['date']} - {e['title']}")
        if len(events_list) > 15:
            print(f"  ... and {len(events_list) - 15} more")

# Summary
print("\n" + "=" * 80)
print("[SUMMARY]")
print("=" * 80)
for issue_type, events_list in issues.items():
    if events_list:
        print(f"  {issue_type.replace('_', ' ').title()}: {len(events_list)}")

total_issues = sum(len(v) for v in issues.values())
print(f"\n  TOTAL ISSUES: {total_issues}")
print(f"  Total Events: {len(events)}")
print(f"  Clean Events: {len(events) - total_issues}")

