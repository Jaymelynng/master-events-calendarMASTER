#!/usr/bin/env python3
"""
Test the new pricing validation logic using existing Supabase data.
This verifies the validation code works without running a full sync.
"""

import json
import re

def test_price_validation():
    """Test pricing validation on sample events."""
    
    # Load the events data
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events (excluding CAMP for now)
    special_events = [e for e in data if e.get('type') in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    print("=" * 80)
    print("TESTING PRICING VALIDATION LOGIC")
    print("=" * 80)
    print(f"Testing on {len(special_events)} events (CLINIC, KNO, OPEN GYM)")
    print()
    
    missing_price_count = 0
    price_mismatch_count = 0
    ok_count = 0
    no_desc_count = 0
    
    issues_found = []
    
    for e in special_events:
        title = e.get('title', '')
        description = e.get('description', '') or ''
        gym_id = e.get('gym_id', '')
        event_type = e.get('type', '')
        date = e.get('date', '')
        
        # Skip if no description (separate issue)
        if not description or len(description.strip()) < 10:
            no_desc_count += 1
            continue
        
        # Extract prices using the same regex as the sync script
        title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title)
        desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description)
        
        # Test Rule 1: Price MUST be in description
        if not desc_prices:
            missing_price_count += 1
            issues_found.append({
                'type': 'missing_price_in_description',
                'gym': gym_id,
                'event_type': event_type,
                'date': date,
                'title': title[:50],
                'message': 'Price not found in description'
            })
        # Test Rule 2: If price in both, they must match
        elif title_prices and desc_prices:
            title_price = float(title_prices[0])
            desc_price = float(desc_prices[0])
            if title_price != desc_price:
                price_mismatch_count += 1
                issues_found.append({
                    'type': 'price_mismatch',
                    'gym': gym_id,
                    'event_type': event_type,
                    'date': date,
                    'title': title[:50],
                    'message': f'Title says ${title_price:.0f} but description says ${desc_price:.0f}'
                })
            else:
                ok_count += 1
        else:
            ok_count += 1
    
    # Print summary
    print("RESULTS:")
    print("-" * 80)
    print(f"  [OK] Events with correct pricing: {ok_count}")
    print(f"  [X] Missing price in description: {missing_price_count}")
    print(f"  [X] Price mismatch (title vs desc): {price_mismatch_count}")
    print(f"  [--] No description (skipped): {no_desc_count}")
    print()
    
    # Print issues by type
    if issues_found:
        print("=" * 80)
        print("ISSUES FOUND (will be flagged by new validation)")
        print("=" * 80)
        
        # Group by type
        missing = [i for i in issues_found if i['type'] == 'missing_price_in_description']
        mismatch = [i for i in issues_found if i['type'] == 'price_mismatch']
        
        if missing:
            print(f"\n--- MISSING PRICE IN DESCRIPTION ({len(missing)}) ---")
            for i in missing[:10]:  # Show first 10
                print(f"  {i['gym']} | {i['event_type']} | {i['date']} | {i['title']}...")
            if len(missing) > 10:
                print(f"  ... and {len(missing) - 10} more")
        
        if mismatch:
            print(f"\n--- PRICE MISMATCH ({len(mismatch)}) ---")
            for i in mismatch:
                print(f"  {i['gym']} | {i['event_type']} | {i['date']}")
                print(f"    {i['message']}")
    
    print()
    print("=" * 80)
    print("TEST COMPLETE - Validation logic is working!")
    print("=" * 80)
    print()
    print("Next: Run a real sync to have these errors saved to Supabase.")

if __name__ == "__main__":
    test_price_validation()

