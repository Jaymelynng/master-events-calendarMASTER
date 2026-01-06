"""
Test the NEW completeness validation checks on January 2026 data.
"""
import json
import re
from datetime import datetime

# Load the JSON data
with open(r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T204528.196.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

# Counters
completeness_issues = {
    'missing_age_in_title': [],
    'missing_date_in_title': [],
    'missing_age_in_description': [],
    'missing_datetime_in_description': [],
    'missing_time_in_description': [],
    'clinic_missing_skill': [],
}

accuracy_issues = {
    'year_mismatch': [],
    'age_mismatch': [],
    'time_mismatch': [],
    'program_mismatch': [],
    'missing_price_in_description': [],
    'no_description': [],
}

# Helper functions
def has_age_in_text(text):
    if not text:
        return False
    txt = text.lower()
    return bool(re.search(r'ages?\s*\d{1,2}|students?\s*\d{1,2}|\d{1,2}\s*[-–+]|\d{1,2}\s*to\s*\d{1,2}', txt))

def has_date_in_text(text):
    if not text:
        return False
    txt = text.lower()
    months = r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)'
    date_formats = r'(\d{1,2}/\d{1,2}|\d{1,2}(st|nd|rd|th))'
    return bool(re.search(months + r'|' + date_formats, txt))

def has_time_in_text(text):
    if not text:
        return False
    txt = text.lower()
    return bool(re.search(r'\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)', txt))

def has_price_in_text(text):
    if not text:
        return False
    return bool(re.search(r'\$\d+', text))

skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling', 
         'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend', 
         'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'bridge', 'kickover',
         'walkover', 'flip flop', 'flip-flop']

for event in events:
    title = event.get('title', '')
    description = event.get('description', '') or ''
    start_date = event.get('start_date', '')
    event_type = (event.get('type', '') or '').upper()
    deleted = event.get('deleted_at')
    event_url = event.get('event_url', '')
    
    # Skip deleted or non-January events or CAMP
    if deleted:
        continue
    if not start_date.startswith('2026-01'):
        continue
    if event_type == 'CAMP':
        continue
    
    # === COMPLETENESS CHECKS ===
    
    # Title must have age
    if not has_age_in_text(title):
        completeness_issues['missing_age_in_title'].append({
            'title': title,
            'url': event_url
        })
    
    # Title must have date
    if not has_date_in_text(title):
        completeness_issues['missing_date_in_title'].append({
            'title': title,
            'url': event_url
        })
    
    if description:
        # Description must have age
        if not has_age_in_text(description):
            completeness_issues['missing_age_in_description'].append({
                'title': title,
                'description': description[:100] + '...',
                'url': event_url
            })
        
        # Description must have date or time
        if not has_date_in_text(description) and not has_time_in_text(description):
            completeness_issues['missing_datetime_in_description'].append({
                'title': title,
                'description': description[:100] + '...',
                'url': event_url
            })
        
        # Description should have time
        if not has_time_in_text(description):
            completeness_issues['missing_time_in_description'].append({
                'title': title,
                'url': event_url
            })
        
        # Description must have price
        if not has_price_in_text(description):
            accuracy_issues['missing_price_in_description'].append({
                'title': title,
                'url': event_url
            })
        
        # Clinic should mention skill
        if event_type == 'CLINIC':
            description_lower = description.lower()
            has_skill = any(skill in description_lower for skill in skills)
            if not has_skill:
                completeness_issues['clinic_missing_skill'].append({
                    'title': title,
                    'description': description[:100] + '...',
                    'url': event_url
                })
    else:
        accuracy_issues['no_description'].append({
            'title': title,
            'url': event_url
        })

# Print results
print("\n" + "="*80)
print("COMPLETENESS VALIDATION RESULTS - January 2026")
print("="*80)

print(f"\n{'='*40}")
print("COMPLETENESS ISSUES (Missing Required Fields)")
print(f"{'='*40}")

print(f"\n1. MISSING AGE IN TITLE: {len(completeness_issues['missing_age_in_title'])} events")
for e in completeness_issues['missing_age_in_title'][:10]:
    print(f"   - {e['title'][:60]}...")
    print(f"     {e['url']}")

print(f"\n2. MISSING DATE IN TITLE: {len(completeness_issues['missing_date_in_title'])} events")
for e in completeness_issues['missing_date_in_title']:
    print(f"   - {e['title'][:60]}...")
    print(f"     {e['url']}")

print(f"\n3. MISSING AGE IN DESCRIPTION: {len(completeness_issues['missing_age_in_description'])} events")
for e in completeness_issues['missing_age_in_description'][:10]:
    print(f"   - {e['title'][:60]}...")
    print(f"     {e['url']}")

print(f"\n4. MISSING DATE/TIME IN DESCRIPTION: {len(completeness_issues['missing_datetime_in_description'])} events")
for e in completeness_issues['missing_datetime_in_description']:
    print(f"   - {e['title'][:60]}...")
    print(f"     {e['url']}")

print(f"\n5. CLINIC MISSING SKILL: {len(completeness_issues['clinic_missing_skill'])} events")
for e in completeness_issues['clinic_missing_skill']:
    print(f"   - {e['title'][:60]}...")
    print(f"     {e['url']}")

print(f"\n{'='*40}")
print("SUMMARY")
print(f"{'='*40}")
print(f"Missing age in title:        {len(completeness_issues['missing_age_in_title'])}")
print(f"Missing date in title:       {len(completeness_issues['missing_date_in_title'])}")
print(f"Missing age in description:  {len(completeness_issues['missing_age_in_description'])}")
print(f"Missing date/time in desc:   {len(completeness_issues['missing_datetime_in_description'])}")
print(f"Clinic missing skill:        {len(completeness_issues['clinic_missing_skill'])}")
print(f"Missing price in desc:       {len(accuracy_issues['missing_price_in_description'])}")
print(f"No description at all:       {len(accuracy_issues['no_description'])}")

