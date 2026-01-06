#!/usr/bin/env python3
"""
Check event descriptions for:
1. Missing price in description
2. Price in description matches price field (from iClass pricing schedule)
"""

import json
import re
from collections import defaultdict

def extract_prices_from_text(text):
    """Extract all dollar amounts from text."""
    if not text:
        return []
    # Match $XX, $XXX, $X,XXX patterns
    prices = re.findall(r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    # Convert to floats
    return [float(p.replace(',', '')) for p in prices]

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only (not regular classes)
    # Focus on CAMP, CLINIC, KIDS NIGHT OUT, OPEN GYM
    special_events = [e for e in data if e.get('type') in ['CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    missing_price_in_desc = []
    price_mismatch = []
    correct = []
    no_description = []
    
    for e in special_events:
        gym = e.get('gym_id', 'unknown')
        title = e.get('title', '')
        date = e.get('date', '')
        etype = e.get('type', '')
        desc = e.get('description', '') or ''
        price_field = e.get('price')
        
        # Clean title for display
        clean_title = title.encode('ascii', 'ignore').decode('ascii')[:70]
        
        # Check if description exists
        if not desc or len(desc.strip()) < 10:
            no_description.append({
                'gym': gym,
                'type': etype,
                'title': clean_title,
                'date': date,
                'price_field': price_field
            })
            continue
        
        # Extract prices from description
        desc_prices = extract_prices_from_text(desc)
        
        if not desc_prices:
            # No price found in description
            missing_price_in_desc.append({
                'gym': gym,
                'type': etype,
                'title': clean_title,
                'date': date,
                'price_field': price_field,
                'desc_preview': desc[:150].encode('ascii', 'ignore').decode('ascii')
            })
        else:
            # Check if price field matches any price in description
            if price_field:
                try:
                    price_float = float(price_field)
                    if price_float in desc_prices:
                        correct.append({
                            'gym': gym,
                            'type': etype,
                            'title': clean_title,
                            'date': date,
                            'price_field': price_field,
                            'desc_prices': desc_prices
                        })
                    else:
                        price_mismatch.append({
                            'gym': gym,
                            'type': etype,
                            'title': clean_title,
                            'date': date,
                            'price_field': price_field,
                            'desc_prices': desc_prices
                        })
                except (ValueError, TypeError):
                    # Can't convert price field
                    missing_price_in_desc.append({
                        'gym': gym,
                        'type': etype,
                        'title': clean_title,
                        'date': date,
                        'price_field': price_field,
                        'desc_preview': desc[:150].encode('ascii', 'ignore').decode('ascii')
                    })
            else:
                # No price field but has price in description - that's okay
                correct.append({
                    'gym': gym,
                    'type': etype,
                    'title': clean_title,
                    'date': date,
                    'price_field': 'None',
                    'desc_prices': desc_prices
                })
    
    # Print results
    print("=" * 80)
    print("DESCRIPTION PRICING AUDIT REPORT")
    print("=" * 80)
    print()
    print(f"Total special events checked: {len(special_events)}")
    print(f"  - No description at all: {len(no_description)}")
    print(f"  - Missing price in description: {len(missing_price_in_desc)}")
    print(f"  - Price MISMATCH (desc vs field): {len(price_mismatch)}")
    print(f"  - Correct (price in desc matches): {len(correct)}")
    print()
    
    # 1. Events with NO DESCRIPTION
    if no_description:
        print("=" * 80)
        print("1. EVENTS WITH NO DESCRIPTION")
        print("=" * 80)
        print()
        by_gym = defaultdict(list)
        for e in no_description:
            by_gym[e['gym']].append(e)
        
        for gym in sorted(by_gym.keys()):
            events = by_gym[gym]
            print(f"--- {gym} ({len(events)} events) ---")
            for e in events:
                print(f"  [{e['type']}] {e['date']} | {e['title']}")
                print(f"    Price field: ${e['price_field']}")
            print()
    
    # 2. Events MISSING PRICE in description
    if missing_price_in_desc:
        print("=" * 80)
        print("2. EVENTS MISSING PRICE IN DESCRIPTION")
        print("=" * 80)
        print()
        by_gym = defaultdict(list)
        for e in missing_price_in_desc:
            by_gym[e['gym']].append(e)
        
        for gym in sorted(by_gym.keys()):
            events = by_gym[gym]
            print(f"--- {gym} ({len(events)} events) ---")
            for e in events:
                print(f"  [{e['type']}] {e['date']} | {e['title']}")
                print(f"    Price field: ${e['price_field']}")
            print()
    
    # 3. Events with PRICE MISMATCH
    if price_mismatch:
        print("=" * 80)
        print("3. PRICE MISMATCH - Description vs iClass Price Field")
        print("=" * 80)
        print()
        by_gym = defaultdict(list)
        for e in price_mismatch:
            by_gym[e['gym']].append(e)
        
        for gym in sorted(by_gym.keys()):
            events = by_gym[gym]
            print(f"--- {gym} ({len(events)} events) ---")
            for e in events:
                print(f"  [{e['type']}] {e['date']} | {e['title']}")
                print(f"    iClass Price: ${e['price_field']}")
                print(f"    Prices in Description: ${e['desc_prices']}")
                print()

if __name__ == "__main__":
    main()

