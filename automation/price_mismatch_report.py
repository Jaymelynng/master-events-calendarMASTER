#!/usr/bin/env python3
"""
Clear pricing mismatch report:
- Column 1: Price showing in iClassPro (title/description)
- Column 2: Confirmed correct price from Source of Truth
- Column 3: Link to fix it
"""

import json
import re
import csv
from collections import defaultdict

# Source of Truth - CONFIRMED CORRECT PRICES
CORRECT_PRICES = {
    "Capital Gymnastics - Cedar Park": {
        "CLINIC": {
            "default": 25,
            "bar": 30,
            "dance_1.5": 35,
            "flip_flop": 20,
            "cartwheel_20": 20,
            "hot_shots": 50,
        },
        "KIDS NIGHT OUT": 35,
        "OPEN GYM": {
            "gym_fun_fridays": 10,
            "open_gym": 20,
        }
    },
    "Capital Gymnastics - Pflugerville": {
        "CLINIC": {
            "default": 25,
            "bar": 30,
            "dance_1.5": 35,
            "flip_flop": 20,
        },
        "KIDS NIGHT OUT": 35,
        "OPEN GYM": {
            "gym_fun_fridays": 10,
            "open_gym": 20,
        }
    },
    "Capital Gymnastics - Round Rock": {
        "CLINIC": {
            "1hr": 25,
            "1.5hr": 30,
            "2hr": 40,
            "specialty_1hr": 30,
            "specialty_1.5hr": 35,
            "specialty_2hr": 45,
        },
        "KIDS NIGHT OUT": 35,
        "OPEN GYM": 10,
    },
    "Estrella Gymnastics": {
        "CLINIC": 25,
        "KIDS NIGHT OUT": 40,
        "OPEN GYM": {
            "homeschool": 10,
            "regular": 30,
        }
    },
    "Houston Gymnastics Academy": {
        "CLINIC": {
            "default": 25,
            "tumble_dance": 75,
            "conditioning": 30,
        },
        "KIDS NIGHT OUT": 40,
        "OPEN GYM": 20,
    },
    "Oasis Gymnastics": {
        "CLINIC": 25,
        "KIDS NIGHT OUT": 40,
        "OPEN GYM": 20,
    },
    "Rowland Ballard - Atascocita": {
        "CLINIC": {
            "default": 25,
            "team": 15,
        },
        "KIDS NIGHT OUT": [20, 25, 30, 35, 40],
        "OPEN GYM": 20,
    },
    "Rowland Ballard - Kingwood": {
        "CLINIC": {
            "back_handspring": 25,
            "bonus_tumbling": 15,
            "master_class": 30,
        },
        "KIDS NIGHT OUT": [35, 40, 45],
        "OPEN GYM": {
            "friday_fun_night": 15,
            "friday_fun_gym": [20, 25],
        }
    },
    "Scottsdale Gymnastics": {
        "CLINIC": {
            "sgt": 25,
            "spf": [40, 50],
            "tumbling": 40,
            "trampoline": 40,
        },
        "KIDS NIGHT OUT": 45,
        "OPEN GYM": 20,
    },
    "TIGAR Gymnastics": {
        "CLINIC": 25,
        "KIDS NIGHT OUT": 35,
        "OPEN GYM": 20,
    }
}

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

def get_correct_price(gym_name, event_type, title):
    """Get the CORRECT price from Source of Truth."""
    title_lower = title.lower()
    
    gym_prices = CORRECT_PRICES.get(gym_name, {})
    type_prices = gym_prices.get(event_type, None)
    
    if type_prices is None:
        return None
    
    if isinstance(type_prices, (int, float)):
        return type_prices
    
    if isinstance(type_prices, list):
        return type_prices[0]  # Return first/main price
    
    if isinstance(type_prices, dict):
        # Check for specialty types
        if 'bar' in title_lower:
            return type_prices.get('bar', type_prices.get('default'))
        if 'dance' in title_lower and ('1.5' in title_lower or '1 1/2' in title_lower):
            return type_prices.get('dance_1.5', type_prices.get('default'))
        if 'flip' in title_lower and 'flop' in title_lower:
            return type_prices.get('flip_flop', type_prices.get('default'))
        if 'hot shot' in title_lower:
            return type_prices.get('hot_shots', type_prices.get('default'))
        if 'tumble' in title_lower and 'dance' in title_lower:
            return type_prices.get('tumble_dance', type_prices.get('default'))
        if 'conditioning' in title_lower:
            return type_prices.get('conditioning', type_prices.get('default'))
        if 'master class' in title_lower:
            return type_prices.get('master_class', type_prices.get('default'))
        if 'gym fun' in title_lower or 'gff' in title_lower:
            return type_prices.get('gym_fun_fridays', type_prices.get('default'))
        if 'homeschool' in title_lower:
            return type_prices.get('homeschool', type_prices.get('default'))
        if 'friday fun' in title_lower:
            val = type_prices.get('friday_fun_gym', type_prices.get('friday_fun_night'))
            if isinstance(val, list):
                return val[0]
            return val
        
        # Return default or first value
        if 'default' in type_prices:
            return type_prices['default']
        if '1hr' in type_prices:
            return type_prices['1hr']
        if 'open_gym' in type_prices:
            return type_prices['open_gym']
        if 'regular' in type_prices:
            return type_prices['regular']
        
        # Just return first value
        return list(type_prices.values())[0]
    
    return None

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    output_csv = r'C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar\exports\price_mismatches_to_fix.csv'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only
    special_events = [e for e in data if e.get('type') in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    mismatches = []
    
    for e in special_events:
        gym_code = e.get('gym_id', 'unknown')
        gym_name = GYM_NAMES.get(gym_code, gym_code)
        title = e.get('title', '')
        date = e.get('date', '')
        etype = e.get('type', '')
        current_price = e.get('price')  # What's currently in iClassPro
        url = e.get('event_url', '')
        
        correct_price = get_correct_price(gym_name, etype, title)
        
        if correct_price is None:
            continue
        
        # Convert for comparison
        current_float = float(current_price) if current_price else None
        correct_float = float(correct_price)
        
        # Skip if prices match or if no current price
        if current_float == correct_float:
            continue
        
        if current_float is None:
            continue  # Skip events with no price - separate issue
        
        # Clean title
        clean_title = title.encode('ascii', 'ignore').decode('ascii')
        
        mismatches.append({
            'Gym': gym_name,
            'Event Type': etype,
            'Date': date,
            'Event Title': clean_title,
            'Price in iClassPro (WRONG)': f"${int(current_float)}",
            'Confirmed Correct Price': f"${int(correct_float)}",
            'iClassPro Link (Click to Fix)': url
        })
    
    # Sort by gym, then date
    mismatches.sort(key=lambda x: (x['Gym'], x['Date']))
    
    # Write CSV
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'Gym', 'Event Type', 'Date', 'Event Title',
            'Price in iClassPro (WRONG)', 'Confirmed Correct Price', 
            'iClassPro Link (Click to Fix)'
        ])
        writer.writeheader()
        writer.writerows(mismatches)
    
    print(f"CSV saved to: {output_csv}")
    print(f"\nTotal mismatches found: {len(mismatches)}")
    print()
    print("=" * 100)
    print("PRICE MISMATCHES - NEED TO FIX IN iCLASSPRO")
    print("=" * 100)
    
    current_gym = None
    for m in mismatches:
        if m['Gym'] != current_gym:
            current_gym = m['Gym']
            print(f"\n### {current_gym} ###\n")
        
        print(f"  {m['Date']} | {m['Event Type']}")
        print(f"    {m['Event Title'][:60]}...")
        print(f"    WRONG: {m['Price in iClassPro (WRONG)']} --> SHOULD BE: {m['Confirmed Correct Price']}")
        print(f"    FIX IT: {m['iClassPro Link (Click to Fix)']}")
        print()

if __name__ == "__main__":
    main()

