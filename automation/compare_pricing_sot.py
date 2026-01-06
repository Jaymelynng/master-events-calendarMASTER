#!/usr/bin/env python3
"""
Compare Source of Truth pricing against actual Supabase event prices.
Flags any mismatches where the event price doesn't match expected pricing.
"""

import json
import re
from collections import defaultdict

# Source of Truth - Expected pricing by gym and event type
SOURCE_OF_TRUTH = {
    "Capital Gymnastics - Cedar Park": {
        "clinics": {
            "default": 25,  # Clinics - 1 Hour
            "bar": 30,
            "dance_1.5": 35,
            "flip_flop": 20,
            "cartwheel_20": 20,
            "hot_shots": 50,
        },
        "kids_night_out": 35,  # First child price
        "open_gym": {
            "gym_fun_fridays": 10,
            "open_gym": 20,
        }
    },
    "Capital Gymnastics - Pflugerville": {
        "clinics": {
            "default": 25,
            "bar": 30,
            "dance_1.5": 35,
            "flip_flop": 20,
        },
        "kids_night_out": 35,
        "open_gym": {
            "gym_fun_fridays": 10,
            "open_gym": 20,  # NOT $25!
        }
    },
    "Capital Gymnastics - Round Rock": {
        "clinics": {
            "1hr": 25,
            "1.5hr": 30,
            "2hr": 40,
            "specialty_1hr": 30,
            "specialty_1.5hr": 35,
            "specialty_2hr": 45,
        },
        "kids_night_out": 35,
        "open_gym": 10,  # Gym Fun Friday
    },
    "Estrella Gymnastics": {
        "clinics": 25,
        "kids_night_out": 40,
        "open_gym": {
            "homeschool": 10,
            "regular": 30,
        }
    },
    "Houston Gymnastics Academy": {
        "clinics": {
            "default": 25,
            "tumble_dance": 75,
            "conditioning": 30,
        },
        "kids_night_out": 40,
        "open_gym": 20,
    },
    "Oasis Gymnastics": {
        "clinics": 25,
        "kids_night_out": 40,
        "open_gym": 20,
    },
    "Rowland Ballard - Atascocita": {
        "clinics": {
            "default": 25,
            "team": 15,
        },
        "kids_night_out": [20, 25, 30, 35, 40],  # Various price points
        "open_gym": 20,
    },
    "Rowland Ballard - Kingwood": {
        "clinics": {
            "back_handspring": 25,
            "bonus_tumbling": 15,
            "master_class": 30,
        },
        "kids_night_out": [35, 40, 45],
        "parents_night_out": [30, 35],
        "open_gym": {
            "friday_fun_night": 15,
            "friday_fun_gym": [20, 25],
        }
    },
    "Scottsdale Gymnastics": {
        "clinics": {
            "sgt": 25,  # NOT $20!
            "spf": [40, 50],
            "tumbling": 40,
            "trampoline": 40,
        },
        "kids_night_out": 45,
        "open_gym": 20,  # NOT $30!
    },
    "TIGAR Gymnastics": {
        "clinics": 25,
        "kids_night_out": 35,
        "open_gym": 20,
    }
}

# Gym ID to name mapping
GYM_NAMES = {
    'CCP': 'Capital Gymnastics - Cedar Park',
    'CPF': 'Capital Gymnastics - Pflugerville', 
    'CRR': 'Capital Gymnastics - Round Rock',
    'EST': 'Estrella Gymnastics',
    'HGA': 'Houston Gymnastics Academy',
    'OAS': 'Oasis Gymnastics',
    'RBA': 'Rowland Ballard - Atascocita',
    'RBK': 'Rowland Ballard - Kingwood',
    'SGT': 'Scottsdale Gymnastics',
    'TIG': 'TIGAR Gymnastics'
}

def get_expected_price(gym_name, event_type, title):
    """Get expected price based on Source of Truth."""
    title_lower = title.lower()
    
    sot = SOURCE_OF_TRUTH.get(gym_name, {})
    
    if event_type == 'CLINIC':
        clinics = sot.get('clinics', {})
        if isinstance(clinics, int):
            return clinics
        # Check for specialty types
        if 'bar' in title_lower:
            return clinics.get('bar', clinics.get('default', None))
        if 'dance' in title_lower and '1.5' in title_lower:
            return clinics.get('dance_1.5', clinics.get('default', None))
        if 'flip' in title_lower and 'flop' in title_lower:
            return clinics.get('flip_flop', clinics.get('default', None))
        if 'hot shot' in title_lower:
            return clinics.get('hot_shots', clinics.get('default', None))
        if 'tumble' in title_lower and 'dance' in title_lower:
            return clinics.get('tumble_dance', clinics.get('default', None))
        if 'conditioning' in title_lower:
            return clinics.get('conditioning', clinics.get('default', None))
        if 'master class' in title_lower:
            return clinics.get('master_class', clinics.get('default', None))
        if 'back handspring' in title_lower or 'backhandspring' in title_lower:
            return clinics.get('back_handspring', clinics.get('default', None))
        return clinics.get('default', clinics.get('1hr', None))
    
    elif event_type == 'KIDS NIGHT OUT':
        kno = sot.get('kids_night_out', None)
        if isinstance(kno, list):
            return kno  # Multiple valid prices
        return kno
    
    elif event_type == 'OPEN GYM':
        og = sot.get('open_gym', {})
        if isinstance(og, int):
            return og
        # Check for type
        if 'gym fun' in title_lower or 'gff' in title_lower:
            return og.get('gym_fun_fridays', og.get('friday_fun_night', None))
        if 'homeschool' in title_lower:
            return og.get('homeschool', None)
        return og.get('open_gym', og.get('regular', None))
    
    return None

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only
    special_events = [e for e in data if e.get('type') in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    print("=" * 120)
    print("PRICING COMPARISON: Source of Truth vs Supabase")
    print("=" * 120)
    print()
    
    mismatches = []
    correct = []
    unknown = []
    
    for e in special_events:
        gym_code = e.get('gym_id', 'unknown')
        gym_name = GYM_NAMES.get(gym_code, gym_code)
        title = e.get('title', '')
        date = e.get('date', '')
        etype = e.get('type', '')
        actual_price = e.get('price')
        url = e.get('event_url', '')
        
        expected = get_expected_price(gym_name, etype, title)
        
        if expected is None:
            unknown.append({
                'gym': gym_name,
                'type': etype,
                'title': title,
                'date': date,
                'actual': actual_price,
                'url': url
            })
            continue
        
        # Check if price matches
        # Convert to float for comparison
        actual_float = float(actual_price) if actual_price else None
        
        if isinstance(expected, list):
            expected_floats = [float(e) for e in expected]
            # Multiple valid prices
            if actual_float in expected_floats:
                correct.append({'gym': gym_name, 'type': etype, 'actual': actual_price})
            elif actual_float is None:
                unknown.append({
                    'gym': gym_name,
                    'type': etype,
                    'title': title,
                    'date': date,
                    'actual': actual_price,
                    'expected': expected,
                    'url': url
                })
            else:
                mismatches.append({
                    'gym': gym_name,
                    'type': etype,
                    'title': title,
                    'date': date,
                    'actual': actual_price,
                    'expected': f"One of {expected}",
                    'url': url
                })
        else:
            expected_float = float(expected) if expected else None
            if actual_float == expected_float:
                correct.append({'gym': gym_name, 'type': etype, 'actual': actual_price})
            elif actual_float is None:
                unknown.append({
                    'gym': gym_name,
                    'type': etype,
                    'title': title,
                    'date': date,
                    'actual': actual_price,
                    'expected': expected,
                    'url': url
                })
            else:
                mismatches.append({
                    'gym': gym_name,
                    'type': etype,
                    'title': title,
                    'date': date,
                    'actual': actual_price,
                    'expected': expected,
                    'url': url
                })
    
    # Print mismatches (the important ones!)
    if mismatches:
        print("[!!!] PRICE MISMATCHES FOUND (Supabase price != Source of Truth)")
        print("-" * 120)
        for m in sorted(mismatches, key=lambda x: (x['gym'], x['date'])):
            clean_title = m['title'].encode('ascii', 'ignore').decode('ascii')[:80]
            print(f"\nGym: {m['gym']}")
            print(f"  Type: {m['type']}")
            print(f"  Date: {m['date']}")
            print(f"  Title: {clean_title}...")
            print(f"  [X] Actual Price: ${m['actual']}")
            print(f"  [OK] Expected Price: ${m['expected']}")
            print(f"  URL: {m['url']}")
    else:
        print("[OK] NO PRICE MISMATCHES FOUND!")
    
    print()
    print("=" * 120)
    print("SUMMARY")
    print("=" * 120)
    print(f"Total events checked: {len(special_events)}")
    print(f"[OK] Correct prices: {len(correct)}")
    print(f"[X] Mismatches: {len(mismatches)}")
    print(f"[?] No price in system: {len([u for u in unknown if u.get('actual') is None])}")
    
    # Group mismatches by gym
    if mismatches:
        print()
        print("Mismatches by Gym:")
        gym_counts = defaultdict(int)
        for m in mismatches:
            gym_counts[m['gym']] += 1
        for gym, count in sorted(gym_counts.items()):
            print(f"  {gym}: {count}")

if __name__ == "__main__":
    main()

