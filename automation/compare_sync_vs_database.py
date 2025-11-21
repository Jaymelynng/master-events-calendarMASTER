#!/usr/bin/env python3
"""
Compare what the automated sync would import vs what's currently in Supabase.
Run this BEFORE importing to see what would be new/changed/unchanged.
"""

import json
import sys
from datetime import date
from f12_collect_and_import import collect_events_via_f12, convert_event_dicts_to_flat, GYMS

def load_supabase_events(json_file_path):
    """Load events from Supabase JSON export"""
    with open(json_file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def compare_events(sync_events, db_events, gym_id, event_type):
    """Compare sync events with database events"""
    # Filter DB events for this gym and event type
    db_filtered = [
        e for e in db_events 
        if e.get('gym_id') == gym_id and e.get('type') == event_type
    ]
    
    # Create maps by event_url
    sync_by_url = {e['event_url']: e for e in sync_events}
    db_by_url = {e['event_url']: e for e in db_filtered}
    
    all_urls = set(sync_by_url.keys()) | set(db_by_url.keys())
    
    new = []
    changed = []
    unchanged = []
    deleted = []
    
    for url in all_urls:
        sync_event = sync_by_url.get(url)
        db_event = db_by_url.get(url)
        
        if sync_event and not db_event:
            new.append(sync_event)
        elif db_event and not sync_event:
            deleted.append(db_event)
        elif sync_event and db_event:
            # Compare key fields
            fields_to_compare = ['title', 'date', 'start_date', 'end_date', 'time', 'price', 'age_min', 'age_max']
            is_different = False
            differences = []
            
            for field in fields_to_compare:
                sync_val = sync_event.get(field)
                db_val = db_event.get(field)
                
                # Normalize for comparison
                if sync_val is None:
                    sync_val = None
                if db_val is None:
                    db_val = None
                
                if str(sync_val) != str(db_val):
                    is_different = True
                    differences.append({
                        'field': field,
                        'sync': sync_val,
                        'db': db_val
                    })
            
            if is_different:
                changed.append({
                    'url': url,
                    'sync': sync_event,
                    'db': db_event,
                    'differences': differences
                })
            else:
                unchanged.append(sync_event)
    
    return {
        'new': new,
        'changed': changed,
        'unchanged': unchanged,
        'deleted': deleted
    }

def main():
    if len(sys.argv) < 4:
        print("Usage: python compare_sync_vs_database.py <gym_id> <event_type> <supabase_json_file>")
        print("\nExample:")
        print("  python compare_sync_vs_database.py TIG CLINIC supabase_events.json")
        print("\nAvailable gyms:", list(GYMS.keys()))
        print("Available event types: KIDS NIGHT OUT, CLINIC, OPEN GYM, SCHOOL YEAR CAMP, SPECIAL EVENT")
        sys.exit(1)
    
    gym_id = sys.argv[1].upper()
    event_type = sys.argv[2].upper()
    supabase_file = sys.argv[3]
    
    if gym_id not in GYMS:
        print(f"❌ Error: Gym '{gym_id}' not found. Available: {list(GYMS.keys())}")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"🔍 COMPARING: {GYMS[gym_id]['name']} - {event_type}")
    print(f"{'='*60}\n")
    
    # Step 1: Load Supabase events
    print("📥 Loading Supabase events...")
    try:
        db_events = load_supabase_events(supabase_file)
        print(f"   ✅ Loaded {len(db_events)} total events from Supabase")
    except FileNotFoundError:
        print(f"   ❌ Error: File '{supabase_file}' not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"   ❌ Error: Invalid JSON in '{supabase_file}': {e}")
        sys.exit(1)
    
    # Step 2: Run sync to get what WOULD be imported
    print(f"\n🔄 Running sync for {gym_id} - {event_type}...")
    try:
        events_raw = collect_events_via_f12(gym_id=gym_id, camp_type=event_type)
        if not events_raw:
            print(f"   ⚠️  No events collected from portal")
            sys.exit(0)
        
        gym = GYMS[gym_id]
        events_flat = convert_event_dicts_to_flat(
            events_raw, 
            gym_id=gym_id,
            portal_slug=gym['slug'],
            camp_type_label=event_type
        )
        print(f"   ✅ Collected {len(events_flat)} events from portal")
    except Exception as e:
        print(f"   ❌ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Step 3: Compare
    print(f"\n📊 Comparing sync events vs database...")
    comparison = compare_events(events_flat, db_events, gym_id, event_type)
    
    # Step 4: Display results
    print(f"\n{'='*60}")
    print(f"📈 COMPARISON RESULTS")
    print(f"{'='*60}\n")
    
    print(f"🆕 NEW EVENTS (will be added): {len(comparison['new'])}")
    if comparison['new']:
        for i, event in enumerate(comparison['new'][:5], 1):  # Show first 5
            print(f"   {i}. {event['title'][:60]}")
            print(f"      Date: {event['date']} | URL: {event['event_url'].split('/')[-1]}")
        if len(comparison['new']) > 5:
            print(f"   ... and {len(comparison['new']) - 5} more")
    
    print(f"\n🔄 CHANGED EVENTS (will be updated): {len(comparison['changed'])}")
    if comparison['changed']:
        for i, change in enumerate(comparison['changed'][:3], 1):  # Show first 3
            print(f"   {i}. {change['sync']['title'][:50]}")
            for diff in change['differences']:
                print(f"      {diff['field']}: '{diff['db']}' → '{diff['sync']}'")
        if len(comparison['changed']) > 3:
            print(f"   ... and {len(comparison['changed']) - 3} more")
    
    print(f"\n✓ UNCHANGED EVENTS (no action needed): {len(comparison['unchanged'])}")
    
    print(f"\n🗑️  DELETED EVENTS (in DB but not in portal): {len(comparison['deleted'])}")
    if comparison['deleted']:
        for i, event in enumerate(comparison['deleted'][:3], 1):  # Show first 3
            print(f"   {i}. {event['title'][:60]}")
            print(f"      Date: {event['date']}")
        if len(comparison['deleted']) > 3:
            print(f"   ... and {len(comparison['deleted']) - 3} more")
    
    print(f"\n{'='*60}")
    print(f"📋 SUMMARY")
    print(f"{'='*60}")
    print(f"   Total in Portal: {len(events_flat)}")
    print(f"   Total in Database: {len([e for e in db_events if e.get('gym_id') == gym_id and e.get('type') == event_type])}")
    print(f"   New: {len(comparison['new'])}")
    print(f"   Changed: {len(comparison['changed'])}")
    print(f"   Unchanged: {len(comparison['unchanged'])}")
    print(f"   Deleted: {len(comparison['deleted'])}")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    main()






