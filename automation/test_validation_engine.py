"""
Test: Compare old hardcoded validation vs new database-driven engine.

This script:
1. Fetches all events from Supabase that have validation_errors
2. Runs the NEW validation engine against the same event data
3. Compares results: old errors vs new errors
4. Reports matches, misses, and extras

Run: python test_validation_engine.py
"""

import os
import sys
import io
import json
from datetime import datetime, date

# Fix Windows console encoding for emoji output
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation_engine import ValidationContext, run_validation, fetch_active_checks, CHECK_REGISTRY

def main():
    # Connect to Supabase
    from supabase import create_client
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')

    if not url or not key:
        # Try .env.local
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if '=' in line and not line.startswith('#'):
                        k, v = line.split('=', 1)
                        os.environ[k.strip()] = v.strip()
            url = os.environ.get('REACT_APP_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
            key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('REACT_APP_SUPABASE_ANON_KEY')
        # Also set SUPABASE_URL and SUPABASE_SERVICE_KEY so f12_collect_and_import picks them up
        if url:
            os.environ['SUPABASE_URL'] = url
        if key:
            os.environ['SUPABASE_SERVICE_KEY'] = key

    if not url or not key:
        print("ERROR: No Supabase credentials found. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")
        return

    sb = create_client(url, key)
    print("Connected to Supabase.\n")

    # Fetch active checks from database
    active_checks = fetch_active_checks(sb)
    print(f"Active checks in database: {len(active_checks)}")
    for check in active_checks:
        print(f"  - {check['rule_type']}: {check['label']} (gym: {check['gym_ids']}, program: {check['program']})")
    print()

    # Fetch all events with validation errors (the old system's results)
    response = sb.table('events').select('*').not_.is_('validation_errors', 'null').is_('deleted_at', 'null').execute()
    events_with_errors = [e for e in (response.data or []) if e.get('validation_errors') and len(e['validation_errors']) > 0]

    # Also fetch events WITHOUT errors to test for false negatives
    response_all = sb.table('events').select('*').is_('deleted_at', 'null').execute()
    all_events = response_all.data or []

    print(f"Total active events: {len(all_events)}")
    print(f"Events with existing errors: {len(events_with_errors)}")
    print()

    # Import helper functions from f12 (for rules lookup, pricing)
    # We need these for ValidationContext
    from f12_collect_and_import import get_rules_for_gym, get_camp_pricing, get_event_pricing

    # Run new engine against ALL events
    total_old_errors = 0
    total_new_errors = 0
    matches = 0
    old_only = []  # Errors old system found but new missed
    new_only = []  # Errors new system found but old didn't
    perfect_match_events = 0
    mismatch_events = 0

    for event in all_events:
        # Get old errors
        old_errors = [e for e in (event.get('validation_errors') or [])
                      if e.get('category') == 'data_error']

        # Build context for new engine
        ctx = ValidationContext(
            event_dict=event,
            gym_id=event.get('gym_id', ''),
            event_type=(event.get('type') or '').upper(),
            title=event.get('title', ''),
            description=event.get('description', ''),
            start_date=event.get('start_date', ''),
            end_date_str=event.get('end_date', event.get('start_date', '')),
            time_str=event.get('time', '') or event.get('event_time', ''),
            age_min=event.get('age_min'),
            day_of_week=event.get('day_of_week', ''),
            get_rules_for_gym_fn=get_rules_for_gym,
            get_camp_pricing_fn=get_camp_pricing,
            get_event_pricing_fn=get_event_pricing,
        )

        # Run new engine
        new_errors, hit_counts = run_validation(ctx, active_checks)

        total_old_errors += len(old_errors)
        total_new_errors += len(new_errors)

        # Compare by error type + message
        old_set = set((e['type'], e['message']) for e in old_errors)
        new_set = set((e['type'], e['message']) for e in new_errors)

        if old_set == new_set:
            perfect_match_events += 1
            matches += len(old_set)
        else:
            mismatch_events += 1
            for item in old_set - new_set:
                old_only.append({
                    'event_id': event['id'],
                    'gym': event.get('gym_id'),
                    'title': event.get('title', '')[:60],
                    'error_type': item[0],
                    'message': item[1]
                })
            for item in new_set - old_set:
                new_only.append({
                    'event_id': event['id'],
                    'gym': event.get('gym_id'),
                    'title': event.get('title', '')[:60],
                    'error_type': item[0],
                    'message': item[1]
                })
            matches += len(old_set & new_set)

    # Report
    print("=" * 70)
    print("VALIDATION ENGINE COMPARISON RESULTS")
    print("=" * 70)
    print(f"\nTotal events checked:     {len(all_events)}")
    print(f"Old system errors:        {total_old_errors}")
    print(f"New engine errors:        {total_new_errors}")
    print(f"Perfect match events:     {perfect_match_events}")
    print(f"Mismatch events:          {mismatch_events}")
    print(f"Matching errors:          {matches}")
    print()

    if old_only:
        print(f"ERRORS OLD SYSTEM FOUND BUT NEW ENGINE MISSED ({len(old_only)}):")
        print("-" * 60)
        for item in old_only:
            print(f"  {item['gym']} | {item['title']}")
            print(f"    {item['error_type']}: {item['message']}")
        print()

    if new_only:
        print(f"ERRORS NEW ENGINE FOUND THAT OLD SYSTEM DIDN'T ({len(new_only)}):")
        print("-" * 60)
        for item in new_only:
            print(f"  {item['gym']} | {item['title']}")
            print(f"    {item['error_type']}: {item['message']}")
        print()

    if not old_only and not new_only:
        print("PERFECT MATCH! New engine produces identical results to old system.")
        print("Safe to swap.")
    elif old_only and not new_only:
        print("WARNING: New engine MISSED some errors the old system caught.")
        print("DO NOT SWAP until these are fixed.")
    elif new_only and not old_only:
        print("New engine found ADDITIONAL errors (possibly from new checks like impossible_date).")
        print("Review the extras above. If they're real errors, the new engine is better.")
    else:
        print("MIXED RESULTS: Some missed, some new. Review both lists above.")


if __name__ == '__main__':
    main()
