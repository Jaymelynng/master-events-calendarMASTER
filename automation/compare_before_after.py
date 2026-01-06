#!/usr/bin/env python3
"""
Compare old vs new Supabase data after force re-import.
Check if validation_errors now includes pricing validation.
"""

import json

def main():
    old_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    new_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T191448.414.json'
    
    with open(old_path, 'r', encoding='utf-8') as f:
        old_data = json.load(f)
    
    with open(new_path, 'r', encoding='utf-8') as f:
        new_data = json.load(f)
    
    # Filter to Cedar Park only
    old_ccp = [e for e in old_data if e.get('gym_id') == 'CCP']
    new_ccp = [e for e in new_data if e.get('gym_id') == 'CCP']
    
    print("=" * 80)
    print("COMPARING CEDAR PARK (CCP) - OLD vs NEW")
    print("=" * 80)
    print(f"Old data: {len(old_ccp)} events")
    print(f"New data: {len(new_ccp)} events")
    print()
    
    # Check for pricing validation errors
    old_pricing_errors = 0
    new_pricing_errors = 0
    
    print("VALIDATION ERRORS COMPARISON:")
    print("-" * 80)
    
    # Create lookup by event_url
    old_by_url = {e.get('event_url'): e for e in old_ccp}
    new_by_url = {e.get('event_url'): e for e in new_ccp}
    
    changes = []
    
    for url, old_event in old_by_url.items():
        new_event = new_by_url.get(url)
        if not new_event:
            continue
        
        old_errors = old_event.get('validation_errors') or []
        new_errors = new_event.get('validation_errors') or []
        
        # Handle JSON string format
        if isinstance(old_errors, str):
            try:
                old_errors = json.loads(old_errors)
            except:
                old_errors = []
        if isinstance(new_errors, str):
            try:
                new_errors = json.loads(new_errors)
            except:
                new_errors = []
        
        # Count pricing errors
        old_has_price_error = any(e.get('type') in ['missing_price_in_description', 'price_mismatch'] for e in old_errors)
        new_has_price_error = any(e.get('type') in ['missing_price_in_description', 'price_mismatch'] for e in new_errors)
        
        if old_has_price_error:
            old_pricing_errors += 1
        if new_has_price_error:
            new_pricing_errors += 1
        
        # Check if validation_errors changed
        old_json = json.dumps(old_errors, sort_keys=True)
        new_json = json.dumps(new_errors, sort_keys=True)
        
        if old_json != new_json:
            title = old_event.get('title', '')[:50]
            changes.append({
                'title': title,
                'old_errors': old_errors,
                'new_errors': new_errors,
                'old_count': len(old_errors),
                'new_count': len(new_errors)
            })
    
    print(f"\nOLD: {old_pricing_errors} events with pricing validation errors")
    print(f"NEW: {new_pricing_errors} events with pricing validation errors")
    print()
    
    if changes:
        print(f"CHANGES DETECTED: {len(changes)} events have different validation_errors")
        print("-" * 80)
        for c in changes[:15]:  # Show first 15
            print(f"\n{c['title']}...")
            print(f"  OLD ({c['old_count']} errors): {[e.get('type') for e in c['old_errors']]}")
            print(f"  NEW ({c['new_count']} errors): {[e.get('type') for e in c['new_errors']]}")
            
            # Show new pricing errors specifically
            new_price_errs = [e for e in c['new_errors'] if e.get('type') in ['missing_price_in_description', 'price_mismatch']]
            if new_price_errs:
                for err in new_price_errs:
                    print(f"    >> {err.get('type')}: {err.get('message')}")
    else:
        print("NO CHANGES DETECTED in validation_errors!")
        print("The force re-import may not have worked, or Railway hasn't deployed yet.")
    
    # Summary: What should the audit show?
    print()
    print("=" * 80)
    print("WHAT THE AUDIT SHOULD SHOW FOR CEDAR PARK:")
    print("=" * 80)
    
    # Count different error types in NEW data
    all_errors = []
    for e in new_ccp:
        errors = e.get('validation_errors') or []
        if isinstance(errors, str):
            try:
                errors = json.loads(errors)
            except:
                errors = []
        for err in errors:
            if isinstance(err, dict):
                all_errors.append(err.get('type'))
    
    from collections import Counter
    error_counts = Counter(all_errors)
    
    print("\nValidation Error Types (NEW data):")
    for error_type, count in sorted(error_counts.items(), key=lambda x: -x[1]):
        print(f"  {error_type}: {count}")
    
    # Events that should show X badge
    events_with_errors = [e for e in new_ccp if (e.get('validation_errors') or [])]
    events_no_desc = [e for e in new_ccp if e.get('description_status') == 'none']
    events_flyer_only = [e for e in new_ccp if e.get('description_status') == 'flyer_only']
    
    print(f"\nEvents with validation_errors: {len(events_with_errors)}")
    print(f"Events with no description: {len(events_no_desc)}")
    print(f"Events with flyer only: {len(events_flyer_only)}")
    print(f"\nTOTAL that should show audit badge: {len(events_with_errors) + len(events_no_desc) + len(events_flyer_only)}")

if __name__ == "__main__":
    main()

