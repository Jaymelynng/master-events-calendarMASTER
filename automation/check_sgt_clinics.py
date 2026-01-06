import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T191448.414.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

# Find the SGT clinics with age issues
for e in events:
    if e.get('gym_id') == 'SGT' and 'clinic' in e.get('title', '').lower():
        if 'pullover' in e.get('title', '').lower() or 'backhandspring' in e.get('title', '').lower():
            print('=' * 80)
            print(f"TITLE: {e.get('title')}")
            print(f"DATE: {e.get('date')}")
            print(f"SYSTEM age_min: {e.get('age_min')}")
            print(f"SYSTEM age_max: {e.get('age_max')}")
            print(f"validation_errors: {e.get('validation_errors')}")
            print()

