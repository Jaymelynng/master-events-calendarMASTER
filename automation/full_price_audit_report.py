#!/usr/bin/env python3
"""
Full audit report: All events missing price in description, organized by gym.
Includes clickable URLs for each event.
"""

import json
import re
from collections import defaultdict

def extract_prices_from_text(text):
    """Extract all dollar amounts from text."""
    if not text:
        return []
    prices = re.findall(r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    return [float(p.replace(',', '')) for p in prices]

# Gym name mapping
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

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only
    special_events = [e for e in data if e.get('type') in ['CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    # Categorize events by gym
    events_by_gym = defaultdict(lambda: {'no_desc': [], 'missing_price': [], 'correct': []})
    
    for e in special_events:
        gym = e.get('gym_id', 'unknown')
        title = e.get('title', '')
        date = e.get('date', '')
        etype = e.get('type', '')
        desc = e.get('description', '') or ''
        price_field = e.get('price')
        time_field = e.get('time', '')
        url = e.get('event_url', '')
        
        # Clean title for display
        clean_title = title.encode('ascii', 'ignore').decode('ascii')
        
        event_info = {
            'gym': gym,
            'type': etype,
            'title': clean_title,
            'date': date,
            'time': time_field,
            'price_field': price_field if price_field else 'None',
            'url': url
        }
        
        # Check if description exists
        if not desc or len(desc.strip()) < 10:
            events_by_gym[gym]['no_desc'].append(event_info)
            continue
        
        # Extract prices from description
        desc_prices = extract_prices_from_text(desc)
        
        if not desc_prices:
            events_by_gym[gym]['missing_price'].append(event_info)
        else:
            events_by_gym[gym]['correct'].append(event_info)
    
    # Print full report
    print("=" * 120)
    print("FULL PRICING AUDIT REPORT - ALL GYMS")
    print("Events Missing Price in Description")
    print("=" * 120)
    print()
    
    total_no_desc = 0
    total_missing_price = 0
    total_correct = 0
    
    for gym_code in sorted(GYM_NAMES.keys()):
        gym_data = events_by_gym[gym_code]
        gym_name = GYM_NAMES.get(gym_code, gym_code)
        
        no_desc = gym_data['no_desc']
        missing_price = gym_data['missing_price']
        correct = gym_data['correct']
        
        total_no_desc += len(no_desc)
        total_missing_price += len(missing_price)
        total_correct += len(correct)
        
        # Sort by date
        no_desc.sort(key=lambda x: x['date'])
        missing_price.sort(key=lambda x: x['date'])
        
        all_issues = len(no_desc) + len(missing_price)
        
        print()
        print("#" * 120)
        print(f"# GYM: {gym_name} ({gym_code})")
        print(f"# Events with issues: {all_issues} | Correct: {len(correct)}")
        print("#" * 120)
        print()
        
        if all_issues == 0:
            print("*** ALL EVENTS HAVE PRICE IN DESCRIPTION - NO ACTION NEEDED ***")
            print()
            continue
        
        # Section 1: No Description
        if no_desc:
            print("-" * 100)
            print(f"NO DESCRIPTION AT ALL ({len(no_desc)} events)")
            print("-" * 100)
            print()
            
            count = 0
            for e in no_desc:
                count += 1
                print(f"{count}. [{e['type']}] {e['date']}")
                print(f"   Title: {e['title']}")
                print(f"   Time: {e['time']} | Price: ${e['price_field']}")
                print(f"   URL: {e['url']}")
                print()
        
        # Section 2: Missing Price in Description
        if missing_price:
            print("-" * 100)
            print(f"MISSING PRICE IN DESCRIPTION ({len(missing_price)} events)")
            print("-" * 100)
            print()
            
            count = 0
            for e in missing_price:
                count += 1
                print(f"{count}. [{e['type']}] {e['date']}")
                print(f"   Title: {e['title']}")
                print(f"   Time: {e['time']} | Price: ${e['price_field']}")
                print(f"   URL: {e['url']}")
                print()
    
    # Summary
    print()
    print("=" * 120)
    print("SUMMARY")
    print("=" * 120)
    print(f"Total events with NO description: {total_no_desc}")
    print(f"Total events MISSING price in description: {total_missing_price}")
    print(f"Total events CORRECT (price in description): {total_correct}")
    print(f"TOTAL EVENTS NEEDING FIXES: {total_no_desc + total_missing_price}")

if __name__ == "__main__":
    main()

