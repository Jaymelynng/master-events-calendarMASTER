#!/usr/bin/env python3
"""
Dry-Run Comparison: Direct API vs Supabase — READ-ONLY
=======================================================
Compares the events we collected via direct API (in test_output/*.json)
against what's currently stored in the Supabase events table.

NO WRITES. Only SELECT queries. Safe to run anytime.

How to run:
    cd automation
    set SUPABASE_URL=https://...
    set SUPABASE_SERVICE_KEY=eyJ...
    python test_compare_supabase.py

Output goes to: automation/test_output/comparison_report.txt
"""

import json
import sys
import os
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from datetime import datetime
from supabase import create_client

# ============================================================================
# CONFIG
# ============================================================================

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
    sys.exit(1)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'test_output')
COMBINED_FILE = os.path.join(OUTPUT_DIR, 'ALL_GYMS_combined.json')

# Map our gym IDs to Supabase gym_id values
GYM_ID_MAP = {
    'CCP': 'CCP',
    'CPF': 'CPF',
    'CRR': 'CRR',
    'HGA': 'HGA',
    'RBA': 'RBA',
    'RBK': 'RBK',
    'EST': 'EST',
    'OAS': 'OAS',
    'SGT': 'SGT',
    'TIG': 'TIG',
}

# Fields to compare between API and Supabase
COMPARE_FIELDS = [
    ('name', 'title'),           # API 'name' → Supabase 'title'
    ('startDate', 'start_date'),
    ('endDate', 'end_date'),
    ('hasOpenings', 'has_openings'),
    ('image', 'flyer_url'),
]

# ============================================================================
# HELPERS
# ============================================================================

def normalize_date(val):
    """Normalize date strings for comparison."""
    if not val:
        return ''
    # Strip time portion if present
    return str(val).strip()[:10]

def normalize_str(val):
    """Normalize strings for comparison."""
    if val is None:
        return ''
    return str(val).strip()

def normalize_bool(val):
    """Normalize booleans."""
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ('true', '1', 'yes')
    return bool(val)

# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{'='*70}")
    print(f"  DRY-RUN COMPARISON: Direct API vs Supabase")
    print(f"  READ-ONLY — No data will be modified")
    print(f"{'='*70}\n")

    # Load direct API results
    if not os.path.exists(COMBINED_FILE):
        print(f"ERROR: Run test_direct_api.py first to generate {COMBINED_FILE}")
        sys.exit(1)

    with open(COMBINED_FILE, 'r', encoding='utf-8') as f:
        api_data = json.load(f)

    print(f"  Loaded API data: {sum(g.get('summary',{}).get('total_events',0) for g in api_data.values())} events across {len(api_data)} gyms")

    # Connect to Supabase (read-only)
    print(f"  Connecting to Supabase (read-only)...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch ALL events from Supabase (active only, not soft-deleted)
    print(f"  Fetching events from Supabase...")

    all_sb_events = []
    page_size = 1000
    offset = 0

    while True:
        result = sb.table('events').select('*').is_('deleted_at', 'null').range(offset, offset + page_size - 1).execute()
        batch = result.data or []
        all_sb_events.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    print(f"  Fetched {len(all_sb_events)} active events from Supabase\n")

    # Index Supabase events by event_url (the matching key)
    sb_by_url = {}
    for ev in all_sb_events:
        url = ev.get('event_url', '')
        if url:
            sb_by_url[url] = ev

    # Also index by gym_id for counting
    sb_by_gym = {}
    for ev in all_sb_events:
        gid = ev.get('gym_id', 'UNKNOWN')
        if gid not in sb_by_gym:
            sb_by_gym[gid] = []
        sb_by_gym[gid].append(ev)

    # ========================================================================
    # COMPARISON
    # ========================================================================

    report = []
    report.append(f"COMPARISON REPORT — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"{'='*70}\n")

    total_matched = 0
    total_api_only = 0
    total_sb_only = 0
    total_field_diffs = 0
    all_api_urls = set()

    for gym_id, gym_data in api_data.items():
        gym_name = gym_data.get('gym_name', gym_id)
        slug = gym_data.get('slug', '')

        report.append(f"\n{'='*60}")
        report.append(f"  {gym_id} — {gym_name}")
        report.append(f"{'='*60}")

        # Collect all events from API for this gym
        api_events = []
        for cat_name, cat_data in gym_data.get('events_by_category', {}).items():
            for ev in cat_data.get('events', []):
                ev['_category'] = cat_name
                ev['_event_type'] = cat_data.get('our_event_type', 'UNKNOWN')
                api_events.append(ev)

        # Count Supabase events for this gym
        sb_gym_events = sb_by_gym.get(gym_id, [])

        report.append(f"\n  API events: {len(api_events)}")
        report.append(f"  Supabase events: {len(sb_gym_events)}")

        gym_matched = 0
        gym_api_only = 0
        gym_diffs = []

        for ev in api_events:
            event_url = ev.get('event_url', '')
            all_api_urls.add(event_url)

            sb_ev = sb_by_url.get(event_url)

            if not sb_ev:
                gym_api_only += 1
                total_api_only += 1
                report.append(f"\n  NEW (not in Supabase):")
                report.append(f"    URL: {event_url}")
                report.append(f"    Name: {ev.get('name', '')[:70]}")
                report.append(f"    Dates: {ev.get('startDate', '')} to {ev.get('endDate', '')}")
                report.append(f"    Category: {ev.get('_category', '')}")
                continue

            # Found a match — compare fields
            gym_matched += 1
            total_matched += 1
            diffs = []

            # Compare title
            api_name = normalize_str(ev.get('name', ''))
            sb_title = normalize_str(sb_ev.get('title', ''))
            if api_name != sb_title:
                diffs.append(f"    title: API='{api_name[:60]}' vs DB='{sb_title[:60]}'")

            # Compare start_date
            api_start = normalize_date(ev.get('startDate', ''))
            sb_start = normalize_date(sb_ev.get('start_date', ''))
            if api_start != sb_start:
                diffs.append(f"    start_date: API='{api_start}' vs DB='{sb_start}'")

            # Compare end_date
            api_end = normalize_date(ev.get('endDate', ''))
            sb_end = normalize_date(sb_ev.get('end_date', ''))
            if api_end != sb_end:
                diffs.append(f"    end_date: API='{api_end}' vs DB='{sb_end}'")

            # Compare has_openings
            api_open = normalize_bool(ev.get('hasOpenings'))
            sb_open = normalize_bool(sb_ev.get('has_openings'))
            if api_open != sb_open:
                diffs.append(f"    has_openings: API={api_open} vs DB={sb_open}")

            # Compare flyer_url
            api_img = normalize_str(ev.get('image', ''))
            sb_img = normalize_str(sb_ev.get('flyer_url', ''))
            if api_img and sb_img and api_img != sb_img:
                diffs.append(f"    flyer_url: DIFFERENT (both exist but don't match)")
            elif api_img and not sb_img:
                diffs.append(f"    flyer_url: API has image, DB is empty")
            elif not api_img and sb_img:
                diffs.append(f"    flyer_url: API empty, DB has image")

            # Compare event_type
            api_type = ev.get('_event_type', '')
            sb_type = normalize_str(sb_ev.get('event_type', ''))
            if api_type and sb_type and api_type.upper() != sb_type.upper():
                diffs.append(f"    event_type: API='{api_type}' vs DB='{sb_type}'")

            # Check for NEW data not in Supabase yet
            new_data = []
            if ev.get('instructors'):
                names = [f"{i.get('firstName','')} {i.get('lastName','')}".strip() for i in ev['instructors']]
                new_data.append(f"instructors: {names}")
            if ev.get('roomName'):
                new_data.append(f"roomName: {ev['roomName']}")
            if ev.get('programName'):
                new_data.append(f"programName: {ev['programName']}")

            if diffs:
                total_field_diffs += len(diffs)
                gym_diffs.append({
                    'url': event_url,
                    'name': ev.get('name', '')[:60],
                    'diffs': diffs,
                })

        # Find events in Supabase but NOT in API (potential deletions)
        gym_sb_only = 0
        for sb_ev in sb_gym_events:
            sb_url = sb_ev.get('event_url', '')
            if sb_url and sb_url not in all_api_urls:
                # Check if it's a past event (expected to be gone from API)
                sb_start = sb_ev.get('start_date', '')
                is_past = False
                if sb_start:
                    try:
                        event_date = datetime.strptime(str(sb_start)[:10], '%Y-%m-%d')
                        is_past = event_date.date() < datetime.now().date()
                    except:
                        pass

                gym_sb_only += 1
                total_sb_only += 1
                past_label = " (PAST EVENT — expected)" if is_past else " *** FUTURE EVENT — would be deleted! ***"
                report.append(f"\n  IN SUPABASE BUT NOT IN API{past_label}:")
                report.append(f"    URL: {sb_url}")
                report.append(f"    Title: {normalize_str(sb_ev.get('title', ''))[:70]}")
                report.append(f"    Start: {sb_start}")
                report.append(f"    Type: {sb_ev.get('event_type', '')}")

        # Summary for this gym
        report.append(f"\n  --- {gym_id} Summary ---")
        report.append(f"  Matched: {gym_matched}")
        report.append(f"  New (API only): {gym_api_only}")
        report.append(f"  Missing from API (DB only): {gym_sb_only}")
        report.append(f"  Events with field differences: {len(gym_diffs)}")

        if gym_diffs:
            report.append(f"\n  Field differences:")
            for d in gym_diffs[:10]:  # Show first 10
                report.append(f"    {d['name']}")
                for diff in d['diffs']:
                    report.append(f"  {diff}")
            if len(gym_diffs) > 10:
                report.append(f"    ... and {len(gym_diffs) - 10} more")

    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================

    report.append(f"\n\n{'='*70}")
    report.append(f"  FINAL SUMMARY")
    report.append(f"{'='*70}\n")
    report.append(f"  Total API events:         {sum(g.get('summary',{}).get('total_events',0) for g in api_data.values())}")
    report.append(f"  Total Supabase events:    {len(all_sb_events)}")
    report.append(f"  Matched (same event_url): {total_matched}")
    report.append(f"  New (API only):           {total_api_only}")
    report.append(f"  DB only (not in API):     {total_sb_only}")
    report.append(f"  Field differences:        {total_field_diffs}")
    report.append(f"\n  Verdict:")
    if total_field_diffs == 0 and total_api_only == 0:
        report.append(f"  PERFECT MATCH — Direct API produces identical data to Playwright")
    elif total_field_diffs < 10 and total_api_only < 5:
        report.append(f"  VERY CLOSE — Minor differences, safe to swap")
    else:
        report.append(f"  DIFFERENCES FOUND — Review the details above before swapping")

    # Print and save
    full_report = '\n'.join(report)
    print(full_report)

    report_file = os.path.join(OUTPUT_DIR, 'comparison_report.txt')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(full_report)

    print(f"\n  Report saved to: {report_file}")


if __name__ == '__main__':
    main()
