#!/usr/bin/env python3
"""Check which events are missing price in their description."""

import json
import re
from collections import defaultdict

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print('=== EVENTS WITH NO PRICE IN DESCRIPTION ===')
    print()
    
    missing_price = []
    
    for e in data:
        desc = e.get('description', '') or ''
        title = e.get('title', '') or ''
        
        # Look for price pattern ($XX or $XXX) in description
        desc_prices = re.findall(r'\$\d+', desc)
        
        # If no price in description, flag it
        if not desc_prices:
            missing_price.append({
                'gym': e.get('gym_id', 'unknown'),
                'type': e.get('type', 'unknown'),
                'title': title[:70] + '...' if len(title) > 70 else title,
                'date': e.get('date', 'N/A'),
                'price_field': e.get('price', 'N/A'),
                'has_desc': len(desc.strip()) > 10,
                'url': e.get('event_url', '')
            })
    
    # Sort by gym then date
    missing_price.sort(key=lambda x: (x['gym'], x['date']))
    
    # Group by gym
    by_gym = defaultdict(list)
    for e in missing_price:
        by_gym[e['gym']].append(e)
    
    total_missing = len(missing_price)
    print(f'Total events missing price in description: {total_missing} out of {len(data)}')
    print()
    
    # Summary by gym
    print('=== SUMMARY BY GYM ===')
    for gym in sorted(by_gym.keys()):
        events = by_gym[gym]
        print(f'  {gym}: {len(events)} events')
    
    print()
    print('=== DETAILED LIST ===')
    print()
    
    count = 0
    for gym in sorted(by_gym.keys()):
        events = by_gym[gym]
        print(f'--- {gym} ({len(events)} events) ---')
        for e in events:
            count += 1
            desc_status = 'Has description' if e['has_desc'] else 'NO DESCRIPTION'
            print(f"{count}. [{e['type']}] {e['title']}")
            print(f"   Date: {e['date']} | Price field: ${e['price_field']} | {desc_status}")
        print()

if __name__ == "__main__":
    main()

