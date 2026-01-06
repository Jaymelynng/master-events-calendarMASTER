#!/usr/bin/env python3
"""Check which events are missing price in their TITLE."""

import json
import re
from collections import defaultdict

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print('=== EVENTS WITH NO PRICE IN TITLE ===')
    print()
    
    missing_price = []
    
    for e in data:
        title = e.get('title', '') or ''
        
        # Look for price pattern ($XX or $XXX) in TITLE
        title_prices = re.findall(r'\$\d+', title)
        
        # If no price in title, flag it
        if not title_prices:
            missing_price.append({
                'gym': e.get('gym_id', 'unknown'),
                'type': e.get('type', 'unknown'),
                'title': title,
                'date': e.get('date', 'N/A'),
                'price_field': e.get('price', 'N/A'),
                'url': e.get('event_url', '')
            })
    
    # Sort by gym then type then date
    missing_price.sort(key=lambda x: (x['gym'], x['type'], x['date']))
    
    # Group by gym
    by_gym = defaultdict(list)
    for e in missing_price:
        by_gym[e['gym']].append(e)
    
    total_missing = len(missing_price)
    print(f'Total events missing price in TITLE: {total_missing} out of {len(data)}')
    print()
    
    # Summary by gym
    print('=== SUMMARY BY GYM ===')
    for gym in sorted(by_gym.keys()):
        events = by_gym[gym]
        print(f'  {gym}: {len(events)} events')
    
    print()
    print('=== FULL LIST - EVERY TITLE MISSING A PRICE ===')
    print()
    
    count = 0
    for gym in sorted(by_gym.keys()):
        events = by_gym[gym]
        print(f'========== {gym} ({len(events)} events) ==========')
        print()
        for e in events:
            count += 1
            # Remove emojis/special chars for Windows console
            clean_title = e['title'].encode('ascii', 'ignore').decode('ascii')
            print(f"{count}. [{e['type']}] {e['date']}")
            print(f"   TITLE: {clean_title}")
            print(f"   Price field: ${e['price_field']}")
            print()

if __name__ == "__main__":
    main()

