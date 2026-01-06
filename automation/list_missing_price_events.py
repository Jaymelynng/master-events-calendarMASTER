#!/usr/bin/env python3
"""
List ALL events with:
1. No description at all
2. Missing price in description
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

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only
    special_events = [e for e in data if e.get('type') in ['CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    no_description = []
    missing_price_in_desc = []
    
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
            'price_field': price_field,
            'url': url
        }
        
        # Check if description exists
        if not desc or len(desc.strip()) < 10:
            no_description.append(event_info)
            continue
        
        # Extract prices from description
        desc_prices = extract_prices_from_text(desc)
        
        if not desc_prices:
            missing_price_in_desc.append(event_info)
    
    # Sort by gym then date
    no_description.sort(key=lambda x: (x['gym'], x['date']))
    missing_price_in_desc.sort(key=lambda x: (x['gym'], x['date']))
    
    # Print Section 1: No Description
    print("=" * 100)
    print("SECTION 1: EVENTS WITH NO DESCRIPTION AT ALL ({} events)".format(len(no_description)))
    print("=" * 100)
    print()
    
    count = 0
    current_gym = None
    for e in no_description:
        if e['gym'] != current_gym:
            current_gym = e['gym']
            print()
            print("-" * 80)
            print(f"GYM: {current_gym}")
            print("-" * 80)
        
        count += 1
        print(f"{count}. [{e['type']}] {e['date']}")
        print(f"   Title: {e['title']}")
        print(f"   Time: {e['time']} | Price: ${e['price_field']}")
        print(f"   URL: {e['url']}")
        print()
    
    # Print Section 2: Missing Price in Description
    print()
    print("=" * 100)
    print("SECTION 2: EVENTS MISSING PRICE IN DESCRIPTION ({} events)".format(len(missing_price_in_desc)))
    print("=" * 100)
    print()
    
    count = 0
    current_gym = None
    for e in missing_price_in_desc:
        if e['gym'] != current_gym:
            current_gym = e['gym']
            print()
            print("-" * 80)
            print(f"GYM: {current_gym}")
            print("-" * 80)
        
        count += 1
        print(f"{count}. [{e['type']}] {e['date']}")
        print(f"   Title: {e['title']}")
        print(f"   Time: {e['time']} | Price: ${e['price_field']}")
        print(f"   URL: {e['url']}")
        print()

if __name__ == "__main__":
    main()

