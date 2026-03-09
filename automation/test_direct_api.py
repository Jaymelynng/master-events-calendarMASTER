#!/usr/bin/env python3
"""
Direct API Test Script — SAFE / READ-ONLY
==========================================
Tests the iClassPro public API for all 10 gyms WITHOUT touching Supabase.
Saves results to local JSON files for manual verification.

How to run:
    cd automation
    python test_direct_api.py

Or test a single gym:
    python test_direct_api.py CCP

Output goes to: automation/test_output/
"""

import json
import sys
import os
import time
import io

# Fix Windows console encoding for special characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# ============================================================================
# CONFIG
# ============================================================================

API_BASE = "https://app.iclasspro.com/api/open/v1"

# All 10 gyms — slug is the only thing we need
GYMS = {
    'CCP': {'name': 'Capital Gymnastics Cedar Park', 'slug': 'capgymavery'},
    'CPF': {'name': 'Capital Gymnastics Pflugerville', 'slug': 'capgymhp'},
    'CRR': {'name': 'Capital Gymnastics Round Rock', 'slug': 'capgymroundrock'},
    'HGA': {'name': 'Houston Gymnastics Academy', 'slug': 'houstongymnastics'},
    'RBA': {'name': 'Rowland Ballard Atascocita', 'slug': 'rbatascocita'},
    'RBK': {'name': 'Rowland Ballard Kingwood', 'slug': 'rbkingwood'},
    'EST': {'name': 'Estrella Gymnastics', 'slug': 'estrellagymnastics'},
    'OAS': {'name': 'Oasis Gymnastics', 'slug': 'oasisgymnastics'},
    'SGT': {'name': 'Scottsdale Gymnastics', 'slug': 'scottsdalegymnastics'},
    'TIG': {'name': 'Tigar Gymnastics', 'slug': 'tigar'},
}

# Map iClassPro booking titles to our event types
TITLE_TO_EVENT_TYPE = {
    'CLINIC': 'CLINIC',
    'CLINICS': 'CLINIC',
    'KIDS NIGHT OUT': 'KIDS NIGHT OUT',
    'OPEN GYM': 'OPEN GYM',
    'OPEN GYMS': 'OPEN GYM',
    'SCHOOL YEAR CAMP': 'CAMP',
    'SCHOOL YEAR CAMP - FULL DAY': 'CAMP',
    'SCHOOL YEAR CAMP - HALF DAY': 'CAMP',
    'SUMMER CAMP': 'CAMP',
    'SUMMER CAMP - FULL DAY': 'CAMP',
    'SUMMER CAMP - HALF DAY': 'CAMP',
    'SUMMER CAMP AFTER CARE': 'CAMP',
    'EVENTS': 'SPECIAL EVENT',
    'SPECIAL EVENTS': 'SPECIAL EVENT',
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'test_output')

# ============================================================================
# API HELPERS
# ============================================================================

def api_get(url, timeout=15):
    """Make a GET request to iClassPro API. Returns parsed JSON or None."""
    try:
        req = Request(url)
        req.add_header('User-Agent', 'TeamCalendar-Test/1.0')
        with urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        print(f"  ❌ HTTP {e.code}: {url}")
        return None
    except URLError as e:
        print(f"  ❌ Network error: {e.reason} — {url}")
        return None
    except Exception as e:
        print(f"  ❌ Error: {e} — {url}")
        return None


def get_location_id(slug):
    """Step 1: Get the locationId for a gym."""
    url = f"{API_BASE}/{slug}/locations"
    result = api_get(url)
    if result and result.get('data') and len(result['data']) > 0:
        loc = result['data'][0]
        return {
            'id': loc['id'],
            'name': loc.get('name', ''),
            'email': loc.get('email', ''),
            'phone': loc.get('phone', ''),
            'address': loc.get('address', ''),
            'city': loc.get('city', ''),
            'state': loc.get('state', ''),
            'zip': loc.get('zip', ''),
            'primaryColor': loc.get('primaryColor', ''),
            'secondaryColor': loc.get('secondaryColor', ''),
            'logo': loc.get('logoImage', ''),
        }
    return None


def get_categories(slug, location_id):
    """Step 2: Get all booking categories with their typeIds."""
    url = f"{API_BASE}/{slug}/bookings/{location_id}"
    result = api_get(url)
    if result and result.get('data'):
        categories = []
        for item in result['data']:
            # Only care about camps/events (not classes or parties)
            if item.get('target') != 'camps':
                continue
            params = item.get('targetParams', {})
            type_id = params.get('typeId')
            if type_id is not None:
                categories.append({
                    'title': item.get('title', ''),
                    'typeId': type_id,
                    'image': item.get('image', ''),
                    'our_event_type': TITLE_TO_EVENT_TYPE.get(
                        item.get('title', '').upper().strip(),
                        'UNKNOWN'
                    ),
                })
        return categories
    return []


def get_event_listing(slug, location_id, type_id, limit=50):
    """Step 3: Get all events for a category (handles pagination)."""
    all_events = []
    page = 1
    total_records = None

    while True:
        url = f"{API_BASE}/{slug}/camps?locationId={location_id}&typeId={type_id}&limit={limit}&page={page}&sortBy=time"
        result = api_get(url)

        if not result or not result.get('data'):
            break

        events = result['data']
        if isinstance(events, list):
            all_events.extend(events)
        elif isinstance(events, dict) and events.get('records'):
            # Some responses wrap in {records: [], totalRecords: N}
            all_events.extend(events['records'])
            total_records = events.get('totalRecords', 0)

        # Check if we got a totalRecords at the top level
        if total_records is None:
            total_records = result.get('totalRecords', len(all_events))

        # Check if we need more pages
        if len(all_events) >= total_records:
            break

        page += 1
        time.sleep(0.2)  # Be polite to the API

    return all_events, total_records or len(all_events)


def get_event_detail(slug, event_id):
    """Step 4: Get full detail for a single event."""
    url = f"{API_BASE}/{slug}/camps/{event_id}"
    result = api_get(url)
    if result and result.get('data'):
        return result['data']
    return None


# ============================================================================
# MAIN COLLECTION
# ============================================================================

def collect_gym(gym_id, gym_info):
    """Collect ALL data for a single gym via direct API."""
    slug = gym_info['slug']
    name = gym_info['name']

    print(f"\n{'='*60}")
    print(f"  {gym_id} — {name}")
    print(f"  Slug: {slug}")
    print(f"{'='*60}")

    gym_result = {
        'gym_id': gym_id,
        'gym_name': name,
        'slug': slug,
        'collected_at': datetime.now().isoformat(),
        'location': None,
        'categories': [],
        'events_by_category': {},
        'event_details': {},
        'summary': {},
    }

    # Step 1: Get location
    print(f"\n  📍 Step 1: Getting location...")
    location = get_location_id(slug)
    if not location:
        print(f"  ❌ Could not get location for {slug}")
        return gym_result

    gym_result['location'] = location
    loc_id = location['id']
    print(f"     Location ID: {loc_id}")
    print(f"     Email: {location.get('email', 'N/A')}")
    print(f"     Phone: {location.get('phone', 'N/A')}")

    # Step 2: Get categories
    print(f"\n  📂 Step 2: Discovering categories...")
    categories = get_categories(slug, loc_id)
    gym_result['categories'] = categories

    if not categories:
        print(f"  ⚠️ No camp/event categories found")
        return gym_result

    for cat in categories:
        mapped = cat['our_event_type']
        flag = " ⚠️ UNKNOWN" if mapped == 'UNKNOWN' else ""
        print(f"     {cat['title']} → typeId={cat['typeId']} → maps to: {mapped}{flag}")

    # Step 3 & 4: Get events for each category
    total_events = 0
    total_detail_calls = 0

    for cat in categories:
        cat_title = cat['title']
        type_id = cat['typeId']

        print(f"\n  📋 Step 3: Listing events for {cat_title} (typeId={type_id})...")
        events, total_records = get_event_listing(slug, loc_id, type_id)

        print(f"     Found {len(events)} events (totalRecords={total_records})")

        gym_result['events_by_category'][cat_title] = {
            'typeId': type_id,
            'our_event_type': cat['our_event_type'],
            'total_records': total_records,
            'events': [],
        }

        # Get detail for each event
        for ev in events:
            event_id = ev.get('id')
            event_name = ev.get('name', 'Unknown')

            print(f"     📄 Detail: {event_id} — {event_name[:60]}...")
            detail = get_event_detail(slug, event_id)
            total_detail_calls += 1

            if detail:
                # Build the event_url (matching key)
                event_url = f"https://portal.iclasspro.com/{slug}/camp-details/{event_id}"

                event_summary = {
                    'event_id': event_id,
                    'event_url': event_url,
                    'name': detail.get('name', ''),
                    'startDate': detail.get('startDate', ''),
                    'endDate': detail.get('endDate', ''),
                    'minAge': detail.get('minAge'),
                    'maxAge': detail.get('maxAge'),
                    'hasOpenings': detail.get('hasOpenings'),
                    'schedule': detail.get('schedule', []),
                    'description': detail.get('description', '')[:200] + '...' if detail.get('description') else None,
                    'image': detail.get('image', ''),
                    # NEW data we're not currently capturing:
                    'programName': detail.get('programName', ''),
                    'roomName': detail.get('roomName'),
                    'instructors': detail.get('instructors', []),
                    'programIsDeleted': detail.get('programIsDeleted', False),
                    'campRegisterExpired': detail.get('campRegisterExpired', False),
                    'autoApprove': detail.get('autoApprove'),
                    'allowToRequestCampThatIsFull': detail.get('allowToRequestCampThatIsFull'),
                    'registrationStartDate': detail.get('registrationStartDate'),
                    'registrationEndDate': detail.get('registrationEndDate'),
                }

                gym_result['events_by_category'][cat_title]['events'].append(event_summary)
                gym_result['event_details'][str(event_id)] = detail  # Full raw response
                total_events += 1

            time.sleep(0.1)  # Be polite

    # Summary
    gym_result['summary'] = {
        'total_categories': len(categories),
        'total_events': total_events,
        'total_api_calls': 2 + len(categories) + total_detail_calls,  # location + bookings + listings + details
        'categories_found': [c['title'] for c in categories],
    }

    print(f"\n  ✅ Done! {total_events} events across {len(categories)} categories")
    print(f"     API calls made: {gym_result['summary']['total_api_calls']}")

    return gym_result


def print_final_summary(all_results):
    """Print a nice summary table."""
    print(f"\n\n{'='*70}")
    print(f"  FINAL SUMMARY — All Gyms")
    print(f"{'='*70}\n")

    total_events = 0
    total_calls = 0

    print(f"  {'Gym':<6} {'Name':<35} {'Categories':<12} {'Events':<8} {'API Calls'}")
    print(f"  {'-'*6} {'-'*35} {'-'*12} {'-'*8} {'-'*10}")

    for gym_id, result in all_results.items():
        s = result.get('summary', {})
        cats = s.get('total_categories', 0)
        evts = s.get('total_events', 0)
        calls = s.get('total_api_calls', 0)
        name = result.get('gym_name', '')[:35]
        total_events += evts
        total_calls += calls
        print(f"  {gym_id:<6} {name:<35} {cats:<12} {evts:<8} {calls}")

    print(f"  {'-'*6} {'-'*35} {'-'*12} {'-'*8} {'-'*10}")
    print(f"  {'TOTAL':<6} {'':<35} {'':<12} {total_events:<8} {total_calls}")

    # Show category discovery across all gyms
    print(f"\n  📂 Categories discovered per gym:")
    for gym_id, result in all_results.items():
        cats = result.get('summary', {}).get('categories_found', [])
        print(f"     {gym_id}: {', '.join(cats) if cats else '(none)'}")

    # Show any UNKNOWN mappings
    unknown_found = False
    for gym_id, result in all_results.items():
        for cat in result.get('categories', []):
            if cat['our_event_type'] == 'UNKNOWN':
                if not unknown_found:
                    print(f"\n  ⚠️ UNKNOWN category mappings (need to add to TITLE_TO_EVENT_TYPE):")
                    unknown_found = True
                print(f"     {gym_id}: '{cat['title']}' (typeId={cat['typeId']})")

    if not unknown_found:
        print(f"\n  ✅ All categories mapped successfully!")


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    start_time = time.time()

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Determine which gyms to test
    if len(sys.argv) > 1:
        gym_ids = [g.upper() for g in sys.argv[1:]]
        gyms_to_test = {gid: GYMS[gid] for gid in gym_ids if gid in GYMS}
        if not gyms_to_test:
            print(f"Unknown gym ID(s): {sys.argv[1:]}. Valid: {', '.join(GYMS.keys())}")
            sys.exit(1)
    else:
        gyms_to_test = GYMS

    print(f"🚀 Direct API Test — {len(gyms_to_test)} gym(s)")
    print(f"   Output: {OUTPUT_DIR}")
    print(f"   This is READ-ONLY. No data will be written to Supabase.")

    # Collect all gyms
    all_results = {}
    for gym_id, gym_info in gyms_to_test.items():
        result = collect_gym(gym_id, gym_info)
        all_results[gym_id] = result

        # Save individual gym result
        output_file = os.path.join(OUTPUT_DIR, f'{gym_id}_result.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str)

    # Save combined results
    combined_file = os.path.join(OUTPUT_DIR, 'ALL_GYMS_combined.json')
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, default=str)

    # Print summary
    print_final_summary(all_results)

    elapsed = time.time() - start_time
    print(f"\n  ⏱️  Total time: {elapsed:.1f} seconds")
    print(f"  📁 Results saved to: {OUTPUT_DIR}/")
    print(f"\n  Next steps:")
    print(f"  1. Open the JSON files and compare against the portal pages")
    print(f"  2. Check: do event counts match? Are any events missing?")
    print(f"  3. Look at the 'NEW' fields: instructors, roomName, programIsDeleted")
