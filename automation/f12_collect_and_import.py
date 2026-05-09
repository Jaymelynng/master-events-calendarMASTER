#!/usr/bin/env python3
"""
Event Collection Script for iClassPro
======================================
Collects camp/event data from iClassPro portals for all 10 Rise Athletics gyms.

Two collection methods available (controlled by USE_DIRECT_API env var):
  - Direct API (default, fast ~5 min): HTTP calls to iClassPro public API
  - Playwright (fallback, slow ~50 min): Headless browser interception

History:
  - Original: Playwright browser automation (intercepted /camps/{id} network calls)
  - March 2026: Added Direct API method — 10x faster, no browser dependency
  - Playwright code kept as fallback (set USE_DIRECT_API=false to use)
"""

import asyncio
import json
import re
import html
import os
import time
from datetime import datetime, date
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from validation_engine import ValidationContext, run_validation
from pricing_supabase import get_active_event_prices_for_validation, build_event_pricing_for_today

# Playwright is optional — only needed if USE_DIRECT_API=false
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    async_playwright = None
    PLAYWRIGHT_AVAILABLE = False
    print("[INFO] Playwright not installed. Direct API mode only (USE_DIRECT_API=true)")

# Supabase configuration — reads from environment variables (set in Railway)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '') or os.environ.get('SUPABASE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[WARN] SUPABASE_URL or SUPABASE_KEY not set in environment variables.")
    print("[INFO] Gym data will use hardcoded fallback. Sync will still work if called from local_api_server.")

# Gym data — loaded from Supabase, with hardcoded fallback for safety
_GYMS_FALLBACK = {
    'CCP': {'name': 'Capital Gymnastics Cedar Park', 'slug': 'capgymavery'},
    'CPF': {'name': 'Capital Gymnastics Pflugerville', 'slug': 'capgymhp'},
    'CRR': {'name': 'Capital Gymnastics Round Rock', 'slug': 'capgymroundrock'},
    'HGA': {'name': 'Houston Gymnastics Academy', 'slug': 'houstongymnastics'},
    'RBA': {'name': 'Rowland Ballard Atascocita', 'slug': 'rbatascocita'},
    'RBK': {'name': 'Rowland Ballard Kingwood', 'slug': 'rbkingwood'},
    'EST': {'name': 'Estrella Gymnastics', 'slug': 'estrellagymnastics'},
    'OAS': {'name': 'Oasis Gymnastics', 'slug': 'oasisgymnastics'},
    'SGT': {'name': 'Scottsdale Gymnastics', 'slug': 'scottsdalegymnastics'},
    'TIG': {'name': 'Tigar Gymnastics', 'slug': 'tigar'}
}

def fetch_gyms_from_db():
    """Fetch gym data from Supabase gyms table (database-driven for sellability).
    Returns dict matching GYMS format: {gym_id: {'name': ..., 'slug': ...}}
    Requires 'iclass_slug' column in gyms table (added Feb 2026).
    Falls back to hardcoded _GYMS_FALLBACK if fetch fails."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/gyms?select=id,name,iclass_slug"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")

        with urlopen(req) as response:
            rows = json.loads(response.read().decode())

        gyms = {}
        for row in rows:
            gym_id = row.get('id')
            slug = row.get('iclass_slug')
            if gym_id and slug:
                gyms[gym_id] = {
                    'name': row.get('name', ''),
                    'slug': slug
                }

        if gyms:
            print(f"[INFO] Loaded {len(gyms)} gyms from Supabase database")
            return gyms
        else:
            print(f"[WARN] Supabase returned {len(rows)} gyms but none had iclass_slug set. Using fallback.")
            return {}
    except Exception as e:
        print(f"[WARN] Could not fetch gyms from database: {e}. Using fallback.")
        return {}

GYMS = fetch_gyms_from_db() or _GYMS_FALLBACK

# Map link_type_id to event type name
LINK_TYPE_TO_EVENT_TYPE = {
    "kids_night_out": "KIDS NIGHT OUT",
    "skill_clinics": "CLINIC",
    "open_gym": "OPEN GYM",
    "camps": "CAMP",
    "camps_half": "CAMP",
    "camps_holiday": "CAMP",
    "camps_summer_full": "CAMP",
    "camps_summer_half": "CAMP",
    "special_events": "SPECIAL EVENT"
}

# All camp-related link types (for fetching ALL camps with one button)
CAMP_LINK_TYPES = [
    "camps",           # School Year Full Day
    "camps_half",      # School Year Half Day
    "camps_holiday",   # Holiday camps
    "camps_summer_full",   # Summer Full Day
    "camps_summer_half",   # Summer Half Day
]

# All program types for "SYNC ALL" functionality
ALL_PROGRAM_TYPES = {
    "kids_night_out": "KIDS NIGHT OUT",
    "skill_clinics": "CLINIC",
    "open_gym": "OPEN GYM",
    "special_events": "SPECIAL EVENT",
    # Camp types are handled separately via CAMP_LINK_TYPES
}

# Aliases for event type names (for backwards compatibility)
EVENT_TYPE_ALIASES = {
    "SCHOOL YEAR CAMP": "CAMP",
    "CAMP": "CAMP",
}

# ============================================================================
# DIRECT API COLLECTION — Added March 2026
# ============================================================================
# Replaces Playwright browser automation with direct HTTP API calls.
#
# Old method (Playwright):
#   Launch headless Chromium → navigate to portal page → wait for Angular app
#   → intercept /camps/{id} network responses → click pagination buttons
#   Time: ~10 minutes for all 10 gyms
#
# New method (Direct API):
#   HTTP GET to iClassPro public API endpoints:
#   1. /{slug}/locations → locationId
#   2. /{slug}/bookings/{locId} → discover category typeIds
#   3. /{slug}/camps?typeId={id} → event listings
#   4. /{slug}/camps/{eventId} → full event detail
#   Time: ~5 minutes for all 10 gyms
#
# Returns the SAME raw event dict format → convert_event_dicts_to_flat() works identically.
#
# To switch back to Playwright: set USE_DIRECT_API=false environment variable
# ============================================================================

USE_DIRECT_API = os.environ.get('USE_DIRECT_API', 'true').lower() in ('true', '1', 'yes')

ICLASSPRO_API_BASE = "https://app.iclasspro.com/api/open/v1"

# Map iClassPro booking category titles to our event types.
# Categories NOT listed here are SKIPPED (e.g., CAMP AFTER CARE, CAMP BEFORE CARE).
# To add new categories in the future, just add them here — they'll be collected automatically.
BOOKING_TITLE_TO_EVENT_TYPE = {
    'CLINIC': 'CLINIC',
    'CLINICS': 'CLINIC',
    'KIDS NIGHT OUT': 'KIDS NIGHT OUT',
    "KID'S NIGHT OUT": 'KIDS NIGHT OUT',
    "KIDS' NIGHT OUT": 'KIDS NIGHT OUT',
    'OPEN GYM': 'OPEN GYM',
    'OPEN GYMS': 'OPEN GYM',
    'SCHOOL YEAR CAMP': 'CAMP',
    'SCHOOL YEAR CAMP - FULL DAY': 'CAMP',
    'SCHOOL YEAR CAMP - HALF DAY': 'CAMP',
    'SUMMER CAMP': 'CAMP',
    'SUMMER CAMP - FULL DAY': 'CAMP',
    'SUMMER CAMP - HALF DAY': 'CAMP',
    'EVENTS': 'SPECIAL EVENT',
    'SPECIAL EVENTS': 'SPECIAL EVENT',
}


def _api_get(url, timeout=15):
    """Make a GET request to iClassPro public API. Returns parsed JSON or None."""
    try:
        req = Request(url)
        req.add_header('User-Agent', 'TeamCalendar/1.0')
        with urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        print(f"  [API] HTTP {e.code}: {url}")
        return None
    except URLError as e:
        print(f"  [API] Network error: {e.reason} — {url}")
        return None
    except Exception as e:
        print(f"  [API] Error: {e} — {url}")
        return None


def _get_location_id_api(slug):
    """Get the locationId for a gym from iClassPro public API."""
    url = f"{ICLASSPRO_API_BASE}/{slug}/locations"
    result = _api_get(url)
    if result and result.get('data') and len(result['data']) > 0:
        return result['data'][0].get('id')
    return None


def _get_booking_categories(slug, location_id):
    """
    Discover all camp/event categories for a gym via the bookings endpoint.
    Returns list of {title, typeId, our_event_type} for known event types only.
    Unknown categories (not in BOOKING_TITLE_TO_EVENT_TYPE) are skipped with a log message.
    """
    url = f"{ICLASSPRO_API_BASE}/{slug}/bookings/{location_id}"
    result = _api_get(url)
    if not result or not result.get('data'):
        return []

    categories = []
    for item in result['data']:
        if item.get('target') != 'camps':
            continue
        params = item.get('targetParams', {})
        type_id = params.get('typeId')
        if type_id is None:
            continue

        title = item.get('title', '').strip()
        our_type = BOOKING_TITLE_TO_EVENT_TYPE.get(title.upper())

        if our_type:
            categories.append({
                'title': title,
                'typeId': type_id,
                'our_event_type': our_type,
            })
        else:
            print(f"  [API] Skipping unknown category: '{title}' (typeId={type_id})")

    return categories


def _get_event_listing_api(slug, location_id, type_id, limit=50):
    """Get all events for a category via direct API. Handles pagination."""
    all_events = []
    page = 1
    total_records = None

    while True:
        url = (f"{ICLASSPRO_API_BASE}/{slug}/camps"
               f"?locationId={location_id}&typeId={type_id}"
               f"&limit={limit}&page={page}&sortBy=time")
        result = _api_get(url)
        if not result or not result.get('data'):
            break

        events = result['data']
        if isinstance(events, list):
            all_events.extend(events)
        elif isinstance(events, dict) and events.get('records'):
            all_events.extend(events['records'])
            total_records = events.get('totalRecords', 0)

        if total_records is None:
            total_records = result.get('totalRecords', len(all_events))

        if len(all_events) >= total_records:
            break

        page += 1
        time.sleep(0.2)  # Be polite to the API

    return all_events, total_records or len(all_events)


def _get_event_detail_api(slug, event_id):
    """Get full detail for a single event via direct API."""
    url = f"{ICLASSPRO_API_BASE}/{slug}/camps/{event_id}"
    result = _api_get(url)
    if result and result.get('data'):
        return result['data']
    return None


def _collect_events_direct_api(gym_id, event_type_filter=None):
    """
    Collect events for a gym via direct HTTP API calls to iClassPro.

    This replaces the Playwright browser automation approach. Instead of launching
    a headless browser and intercepting network calls, we call the iClassPro public
    API directly. Returns the SAME raw event dict format that
    convert_event_dicts_to_flat() expects — no downstream changes needed.

    Args:
        gym_id: Gym code (e.g., 'CCP', 'EST')
        event_type_filter: 'ALL' to collect all types, or specific type like 'CAMP', 'CLINIC'

    Returns:
        For 'ALL': {'events': {event_type: [raw_dicts]}, 'checked_types': [...]}
        For single type: [raw_dicts] (same format as old Playwright path)
    """
    if gym_id not in GYMS:
        print(f"[API] Unknown gym ID: {gym_id}")
        if event_type_filter and event_type_filter != 'ALL':
            return []
        return {'events': {}, 'checked_types': []}

    gym = GYMS[gym_id]
    slug = gym['slug']
    collect_all = (event_type_filter is None or event_type_filter == 'ALL')

    print(f"\n{'='*60}")
    print(f"  DIRECT API COLLECTION: {gym['name']} ({gym_id})")
    print(f"  Mode: {'ALL types' if collect_all else event_type_filter}")
    print(f"{'='*60}")

    # Step 1: Get locationId
    print(f"\n  [API] Step 1: Getting location for {slug}...")
    location_id = _get_location_id_api(slug)
    if not location_id:
        print(f"  [API] ❌ Could not get location for {slug}")
        if not collect_all:
            return []
        return {'events': {}, 'checked_types': []}
    print(f"  [API] Location ID: {location_id}")

    # Step 2: Discover categories automatically from bookings endpoint
    print(f"  [API] Step 2: Discovering categories...")
    categories = _get_booking_categories(slug, location_id)
    if not categories:
        print(f"  [API] ⚠️ No known categories found")
        if not collect_all:
            return []
        return {'events': {}, 'checked_types': []}

    for cat in categories:
        print(f"    {cat['title']} → typeId={cat['typeId']} → {cat['our_event_type']}")

    # Filter categories if a specific event type was requested
    if not collect_all:
        normalized_filter = EVENT_TYPE_ALIASES.get(event_type_filter, event_type_filter)
        categories = [c for c in categories if c['our_event_type'] == normalized_filter]
        if not categories:
            print(f"  [API] No categories match type '{event_type_filter}'")
            return []

    # Build checked_types from discovered categories
    checked_types = sorted(set(c['our_event_type'] for c in categories))

    # Steps 3 & 4: Get event listings and full details for each category
    all_results = {}  # {event_type: [raw_dicts]}
    global_seen_ids = set()  # Dedupe across all categories (e.g., SUMMER CAMP + SCHOOL YEAR CAMP)

    for cat in categories:
        cat_title = cat['title']
        type_id = cat['typeId']
        our_type = cat['our_event_type']

        print(f"\n  [API] Step 3: Listing events for '{cat_title}' (typeId={type_id})...")
        events_list, total_records = _get_event_listing_api(slug, location_id, type_id)
        print(f"  [API] Found {len(events_list)} events (totalRecords={total_records})")

        if our_type not in all_results:
            all_results[our_type] = []

        for ev in events_list:
            event_id = ev.get('id')
            if not event_id:
                continue
            if event_id in global_seen_ids:
                print(f"    [API] ⏭️ Skipping duplicate {event_id}")
                continue

            print(f"    [API] Step 4: Detail {event_id} — {ev.get('name', 'Unknown')[:50]}...")
            detail = _get_event_detail_api(slug, event_id)

            if detail:
                global_seen_ids.add(event_id)
                all_results[our_type].append(detail)
                # Log same debug info as Playwright version for consistency
                print(f"      [RAW API] minAge={detail.get('minAge')}, maxAge={detail.get('maxAge')}")
                price_fields = [k for k in detail.keys() if any(
                    w in k.lower() for w in ['price', 'fee', 'cost', 'amount', 'rate', 'tuition']
                )]
                if price_fields:
                    print(f"      [RAW API] PRICE FIELDS: {price_fields}")
                    for pk in price_fields:
                        print(f"        - {pk}: {detail.get(pk)}")
                # Log all keys on first event per type to see full API response structure
                if len(all_results[our_type]) == 1:
                    print(f"      [RAW API] ALL FIELDS IN API RESPONSE: {list(detail.keys())}")

            time.sleep(0.1)  # Be polite to the API

    total = sum(len(evs) for evs in all_results.values())
    print(f"\n{'='*60}")
    print(f"  DIRECT API COMPLETE: {total} events across {len(all_results)} types for {gym_id}")
    print(f"  Checked types: {checked_types}")
    print(f"{'='*60}\n")

    if collect_all:
        return {'events': all_results, 'checked_types': checked_types}
    else:
        # Single type — return flat list (same as old Playwright _collect_events_from_url)
        normalized_filter = EVENT_TYPE_ALIASES.get(event_type_filter, event_type_filter)
        return all_results.get(normalized_filter, [])


# ============================================================================
# PLAYWRIGHT COLLECTION (Original method — kept as fallback)
# ============================================================================
# Set USE_DIRECT_API=false to use this path instead of direct API.
# Requires: pip install playwright && playwright install chromium

# ============================================================================
# PRICING: Source of truth — Supabase camp_pricing + event_pricing + rules
# See docs/OPERATIONS/PRICING_SOURCE_OF_TRUTH.md
# ============================================================================

CAMP_PRICING_CACHE = None


def fetch_camp_pricing_from_db():
    """Load camp_pricing rows from Supabase. Returns { gym_id: { full_day_daily, ... } }."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/camp_pricing?select=gym_id,full_day_daily,full_day_weekly,half_day_daily,half_day_weekly"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        with urlopen(req) as response:
            rows = json.loads(response.read().decode())
        out = {}
        for row in rows:
            gid = row.get('gym_id')
            if not gid:
                continue
            out[gid] = {
                'full_day_daily': row.get('full_day_daily'),
                'full_day_weekly': row.get('full_day_weekly'),
                'half_day_daily': row.get('half_day_daily'),
                'half_day_weekly': row.get('half_day_weekly'),
            }
        print(f"[INFO] Loaded camp_pricing for {len(out)} gyms from Supabase")
        return out
    except Exception as e:
        print(f"[WARN] Could not fetch camp_pricing: {e}")
        return {}


def get_camp_pricing():
    """Cached camp pricing by gym (camp_pricing table). Values are numeric or None."""
    global CAMP_PRICING_CACHE
    if CAMP_PRICING_CACHE is None:
        raw = fetch_camp_pricing_from_db()
        CAMP_PRICING_CACHE = {}
        for gid, cols in raw.items():
            CAMP_PRICING_CACHE[gid] = {
                'full_day_daily': str(cols['full_day_daily']) if cols.get('full_day_daily') is not None else None,
                'full_day_weekly': str(cols['full_day_weekly']) if cols.get('full_day_weekly') is not None else None,
                'half_day_daily': str(cols['half_day_daily']) if cols.get('half_day_daily') is not None else None,
                'half_day_weekly': str(cols['half_day_weekly']) if cols.get('half_day_weekly') is not None else None,
            }
    return CAMP_PRICING_CACHE


def get_event_pricing():
    """
    Build { gym_id: { event_type: [prices] } } using **today** for effective_date / end_date window.
    Per-event validation uses get_active_event_prices_for_validation(..., event_start_date) from pricing_supabase.
    """
    return build_event_pricing_for_today()

# Per-gym validation rules (extra prices, times, synonyms) from unified `rules` table
RULES_CACHE = None
GYM_VALID_VALUES = None  # Backward-compat alias — do not use in new code

def fetch_rules():
    """Fetch validation rules from Supabase `rules` table (unified rules system).
    Filters to active rules only (permanent, or temporary with end_date >= today).
    Maps new rule_type names to legacy names used by validation code:
      valid_price -> price, valid_time -> time, program_synonym -> program_synonym
    Returns dict grouped by gym_id and rule_type:
    { 'RBA': { 'price': [{'value': '20', 'label': 'Before Care'}], 'time': [...] } }
    """
    # Map rules table rule_types to the legacy names used throughout validation code
    RULE_TYPE_MAP = {
        'valid_price': 'price',
        'valid_time': 'time',
        'sibling_price': 'price',       # sibling prices are still valid prices
        'program_synonym': 'program_synonym',
        'program_ignore': 'program_ignore',  # suppresses program-mismatch flags for a keyword in a given event_type
        # 'exception' and 'requirement_exception' are NOT used for validation — skip them
    }

    try:
        today_str = datetime.now().strftime('%Y-%m-%d')

        url = f"{SUPABASE_URL}/rest/v1/rules?select=*"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")

        with urlopen(req) as response:
            rows = json.loads(response.read().decode())

        values = {}
        active_count = 0
        skipped_expired = 0
        skipped_type = 0

        for row in rows:
            # --- Filter: skip expired temporary rules ---
            is_permanent = row.get('is_permanent', True)
            end_date = row.get('end_date')
            if not is_permanent and end_date and end_date < today_str:
                skipped_expired += 1
                continue

            # --- Filter: only rule types relevant to validation ---
            rule_type_raw = row.get('rule_type', '')
            rule_type = RULE_TYPE_MAP.get(rule_type_raw)
            if not rule_type:
                skipped_type += 1
                continue

            # --- Build rule entry in legacy format ---
            program = row.get('program', 'ALL')
            rule_entry = {
                'value': row.get('value', ''),
                'label': row.get('label', ''),
                'event_type': program if program and program != 'ALL' else None,
                # Carry scope fields through for future enhanced matching
                'scope': row.get('scope', 'all_events'),
                'keyword': row.get('keyword'),
                'event_id': str(row['event_id']) if row.get('event_id') else None,
            }

            # --- Expand gym_ids array into individual gym entries ---
            gym_ids = row.get('gym_ids', ['ALL'])
            if not gym_ids:
                gym_ids = ['ALL']

            for gym_id in gym_ids:
                if gym_id not in values:
                    values[gym_id] = {}
                if rule_type not in values[gym_id]:
                    values[gym_id][rule_type] = []
                values[gym_id][rule_type].append(rule_entry)
                active_count += 1

        total_gyms = len([g for g in values.keys() if g != 'ALL'])
        print(f"[INFO] Loaded {active_count} active rules for {total_gyms} gyms from Supabase rules table"
              f" (skipped {skipped_expired} expired, {skipped_type} non-validation types)")
        return values
    except Exception as e:
        print(f"[WARN] Could not fetch rules from rules table: {e}")
        return {}

fetch_gym_valid_values = fetch_rules  # Backward-compat alias

def get_rules():
    """Get cached rules or fetch from Supabase.
    Rules with gym_id='ALL' are merged into every gym's rules."""
    global RULES_CACHE, GYM_VALID_VALUES
    if RULES_CACHE is None:
        RULES_CACHE = fetch_rules()
        GYM_VALID_VALUES = RULES_CACHE  # Keep alias in sync
    return RULES_CACHE

get_gym_valid_values = get_rules  # Backward-compat alias

def get_rules_for_gym(gym_id, event_type=None):
    """Get merged rules for a specific gym, optionally filtered by event type.
    event_type: CAMP, CLINIC, KIDS NIGHT OUT, OPEN GYM. Rules apply only when:
    - rule.event_type is None/empty (legacy = apply to all), or
    - rule.event_type == 'ALL', or
    - rule.event_type matches event_type
    """
    all_values = get_rules()
    gym_rules = {}

    def matches_event_type(rule):
        rt = rule.get('event_type')
        if not rt or rt == 'ALL':
            return True
        return event_type and rt.upper() == event_type.upper()

    # Start with global 'ALL' rules
    for rule_type, rules_list in all_values.get('ALL', {}).items():
        gym_rules[rule_type] = [r for r in rules_list if matches_event_type(r)]

    # Merge gym-specific rules (override/add to global)
    for rule_type, rules_list in all_values.get(gym_id, {}).items():
        if rule_type not in gym_rules:
            gym_rules[rule_type] = []
        existing_values = {r['value'] for r in gym_rules[rule_type]}
        for rule in rules_list:
            if rule['value'] not in existing_values and matches_event_type(rule):
                gym_rules[rule_type].append(rule)

    return gym_rules

def fetch_event_type_urls():
    """Fetch EVENT_TYPE_URLS from Supabase gym_links table"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/gym_links?is_active=eq.true&select=*"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        
        with urlopen(req) as response:
            links = json.loads(response.read().decode())
        
        event_type_urls = {}
        
        for link in links:
            gym_id = link.get('gym_id')
            link_type = link.get('link_type_id')
            url_str = link.get('url')
            
            if not gym_id or not link_type or not url_str:
                continue
            
            # Skip placeholder URLs
            if 'REPLACE_WITH' in url_str or not url_str.startswith('http'):
                continue
            
            # Map link_type to event type
            event_type = LINK_TYPE_TO_EVENT_TYPE.get(link_type)
            if not event_type:
                continue
            
            # Initialize event type if needed
            if event_type not in event_type_urls:
                event_type_urls[event_type] = {}
            
            # Ensure URL has ?sortBy=time
            if 'sortBy=' in url_str:
                url_str = re.sub(r'[?&]sortBy=[^&]*', '', url_str)
            if '?' in url_str:
                url_str = url_str + '&sortBy=time'
            else:
                url_str = url_str + '?sortBy=time'
            
            event_type_urls[event_type][gym_id] = url_str
        
        return event_type_urls
    except Exception as e:
        print(f"Error fetching URLs from database: {e}")
        return {}

# Cache for EVENT_TYPE_URLS (with TTL to pick up database changes)
_EVENT_TYPE_URLS_CACHE = None
_EVENT_TYPE_URLS_CACHE_TIME = None
_CACHE_TTL_SECONDS = 300  # 5 minutes - refresh from database periodically

def get_event_type_urls():
    """Get EVENT_TYPE_URLS (cached for 5 minutes, then refreshes from database)"""
    global _EVENT_TYPE_URLS_CACHE, _EVENT_TYPE_URLS_CACHE_TIME
    import time
    
    current_time = time.time()
    
    # Refresh cache if it's None or older than TTL
    if _EVENT_TYPE_URLS_CACHE is None or _EVENT_TYPE_URLS_CACHE_TIME is None or (current_time - _EVENT_TYPE_URLS_CACHE_TIME) > _CACHE_TTL_SECONDS:
        print("🔄 Refreshing EVENT_TYPE_URLS from database...")
        _EVENT_TYPE_URLS_CACHE = fetch_event_type_urls()
        _EVENT_TYPE_URLS_CACHE_TIME = current_time
    
    return _EVENT_TYPE_URLS_CACHE

def fetch_all_camp_urls_for_gym(gym_id):
    """
    Fetch ALL camp URLs for a specific gym from gym_links table.
    Returns a list of (link_type_id, url) tuples.
    """
    try:
        url = f"{SUPABASE_URL}/rest/v1/gym_links?gym_id=eq.{gym_id}&is_active=eq.true&select=link_type_id,url"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        
        with urlopen(req) as response:
            links = json.loads(response.read().decode())
        
        camp_urls = []
        for link in links:
            link_type = link.get('link_type_id')
            url_str = link.get('url')
            
            # Only include camp-related link types
            if link_type not in CAMP_LINK_TYPES:
                continue
            
            if not url_str or 'REPLACE_WITH' in url_str or not url_str.startswith('http'):
                continue
            
            # Ensure URL has ?sortBy=time
            if 'sortBy=' in url_str:
                url_str = re.sub(r'[?&]sortBy=[^&]*', '', url_str)
            if '?' in url_str:
                url_str = url_str + '&sortBy=time'
            else:
                url_str = url_str + '?sortBy=time'
            
            camp_urls.append((link_type, url_str))
        
        return camp_urls
    except Exception as e:
        print(f"Error fetching camp URLs for {gym_id}: {e}")
        return []

async def collect_all_camps_for_gym(gym_id):
    """
    Collect ALL camp types for a gym (school year, summer, full day, half day).
    Returns combined list of all camp events.
    """
    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return []
    
    gym = GYMS[gym_id]
    slug = gym["slug"]
    
    # Get all camp URLs for this gym
    camp_urls = fetch_all_camp_urls_for_gym(gym_id)
    
    if not camp_urls:
        print(f"No camp URLs found for gym '{gym_id}'")
        return []
    
    print(f"\n[INFO] Found {len(camp_urls)} camp URL(s) for {gym['name']}:")
    for link_type, url in camp_urls:
        print(f"  - {link_type}: {url}")
    
    all_events = []
    seen_ids = set()
    
    for link_type, url in camp_urls:
        print(f"\n[INFO] Collecting from {link_type}...")
        events = await _collect_events_from_url(gym_id, url)
        
        # Dedupe across all camp types
        for ev in events:
            event_id = ev.get("id")
            if event_id and event_id not in seen_ids:
                seen_ids.add(event_id)
                all_events.append(ev)
                print(f"  ✅ Added event {event_id}")
            elif event_id:
                print(f"  ⏭️ Skipped duplicate {event_id}")
    
    print(f"\n[INFO] Total unique camp events collected: {len(all_events)}")
    return all_events

def fetch_all_program_urls_for_gym(gym_id):
    """
    Fetch ALL program URLs for a specific gym from gym_links table.
    Returns a dict: { event_type: [(link_type_id, url), ...] }
    """
    try:
        url = f"{SUPABASE_URL}/rest/v1/gym_links?gym_id=eq.{gym_id}&is_active=eq.true&select=link_type_id,url"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        
        with urlopen(req) as response:
            links = json.loads(response.read().decode())
        
        program_urls = {}
        
        for link in links:
            link_type = link.get('link_type_id')
            url_str = link.get('url')
            
            if not url_str or 'REPLACE_WITH' in url_str or not url_str.startswith('http'):
                continue
            
            # Ensure URL has ?sortBy=time
            if 'sortBy=' in url_str:
                url_str = re.sub(r'[?&]sortBy=[^&]*', '', url_str)
            if '?' in url_str:
                url_str = url_str + '&sortBy=time'
            else:
                url_str = url_str + '?sortBy=time'
            
            # Determine event type
            if link_type in CAMP_LINK_TYPES:
                event_type = "CAMP"
            elif link_type in ALL_PROGRAM_TYPES:
                event_type = ALL_PROGRAM_TYPES[link_type]
            else:
                continue  # Skip unknown link types
            
            if event_type not in program_urls:
                program_urls[event_type] = []
            program_urls[event_type].append((link_type, url_str))
        
        return program_urls
    except Exception as e:
        print(f"Error fetching program URLs for {gym_id}: {e}")
        return {}

async def collect_all_programs_for_gym(gym_id):
    """
    Collect ALL programs for a gym (KNO, CLINIC, OPEN GYM, CAMP, SPECIAL EVENT).
    Returns a dict: { 
        'events': { event_type: [events...] },
        'checked_types': [list of all types that were checked]
    }
    """
    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return {'events': {}, 'checked_types': []}
    
    gym = GYMS[gym_id]
    
    # Get all program URLs for this gym
    program_urls = fetch_all_program_urls_for_gym(gym_id)
    
    if not program_urls:
        print(f"No program URLs found for gym '{gym_id}'")
        return {'events': {}, 'checked_types': []}
    
    print(f"\n{'='*60}")
    print(f"SYNC ALL PROGRAMS: {gym['name']} ({gym_id})")
    print(f"{'='*60}")
    print(f"Found {len(program_urls)} program type(s):")
    for event_type, urls in program_urls.items():
        print(f"  - {event_type}: {len(urls)} URL(s)")
    
    all_results = {}
    checked_types = list(program_urls.keys())  # Track all types we're checking
    
    for event_type, urls in program_urls.items():
        print(f"\n[INFO] Collecting {event_type}...")
        all_events = []
        seen_ids = set()
        
        for link_type, url in urls:
            print(f"  - Fetching from {link_type}: {url}")
            events = await _collect_events_from_url(gym_id, url)
            print(f"  - Raw events returned: {len(events)}")
            
            # Debug: Check if events have description
            for ev in events:
                has_desc = bool(ev.get("description"))
                print(f"    Event {ev.get('id')}: has_description={has_desc}")
            
            # Dedupe within this event type
            for ev in events:
                event_id = ev.get("id")
                if event_id and event_id not in seen_ids:
                    seen_ids.add(event_id)
                    all_events.append(ev)
        
        all_results[event_type] = all_events
        print(f"  ✅ Collected {len(all_events)} {event_type} events")
    
    total = sum(len(evs) for evs in all_results.values())
    print(f"\n{'='*60}")
    print(f"TOTAL: {total} events across {len(all_results)} program types")
    print(f"CHECKED TYPES: {checked_types}")
    print(f"{'='*60}\n")
    
    return {'events': all_results, 'checked_types': checked_types}

async def _collect_events_from_url(gym_id, url):
    """
    Internal function to collect events from a single URL.
    Now handles pagination — detects totalRecords from listing response
    and clicks through pages if needed.
    """
    captured_events = []
    seen_ids = set()
    total_records = [0]  # Use list to allow mutation in nested function

    async def handle_response(response):
        nonlocal captured_events, seen_ids
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
        except Exception:
            return

        if "application/json" not in content_type:
            return

        # ALSO intercept the listing response (has ? in URL) to get totalRecords
        if "/camps?" in response_url:
            try:
                body = await response.json()
                if isinstance(body, dict) and "totalRecords" in body:
                    total_records[0] = body["totalRecords"]
                    print(f"    [PAGINATION] Listing response: totalRecords={total_records[0]}")
            except Exception:
                pass
            return

        if "/camps/" in response_url and "?" not in response_url:
            try:
                body = await response.json()
            except Exception:
                return

            if not isinstance(body, dict):
                return

            data = body.get("data")
            if not isinstance(data, dict):
                return

            event_id = data.get("id")
            if event_id is None or event_id in seen_ids:
                return

            seen_ids.add(event_id)
            captured_events.append(data)
            print(f"    [CAPTURED] Event {event_id}: {data.get('name', 'Unknown')[:50]}...")
            # DEBUG: Log age fields immediately when captured
            print(f"      [RAW API] minAge={data.get('minAge')}, maxAge={data.get('maxAge')}")
            # DEBUG: Log ALL fields to find price-related data
            price_related = [k for k in data.keys() if any(word in k.lower() for word in ['price', 'fee', 'cost', 'amount', 'rate', 'tuition', 'charge'])]
            if price_related:
                print(f"      [RAW API] PRICE FIELDS FOUND: {price_related}")
                for pk in price_related:
                    print(f"        - {pk}: {data.get(pk)}")
            # Log all keys on first event to see full API response structure
            if len(captured_events) == 1:
                print(f"      [RAW API] ALL FIELDS IN API RESPONSE: {list(data.keys())}")

    print(f"  [BROWSER] Opening: {url}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        page.on("response", handle_response)

        print(f"  [BROWSER] Loading page...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"  [BROWSER] Reloading for network idle...")
        await page.reload(wait_until="networkidle", timeout=30000)
        print(f"  [BROWSER] Waiting for async responses (5s)...")
        await page.wait_for_timeout(5000)
        await asyncio.sleep(2)

        # PAGINATION: If totalRecords > captured, click through pages
        page_num = 1
        max_pages = 10  # Safety limit
        while total_records[0] > len(captured_events) and page_num < max_pages:
            page_num += 1
            print(f"  [PAGINATION] Have {len(captured_events)}/{total_records[0]} events — loading page {page_num}...")

            # Try clicking the "next page" button
            try:
                next_btn = await page.query_selector('button.page-link >> text=">"')
                if not next_btn:
                    next_btn = await page.query_selector('a.page-link >> text=">"')
                if not next_btn:
                    # Try generic next/arrow selectors
                    next_btn = await page.query_selector('[aria-label="Next"]')
                if not next_btn:
                    next_btn = await page.query_selector('.pagination .next')
                if not next_btn:
                    # Try finding page number link
                    next_btn = await page.query_selector(f'a.page-link >> text="{page_num}"')
                if not next_btn:
                    next_btn = await page.query_selector(f'button.page-link >> text="{page_num}"')

                if next_btn:
                    await next_btn.click()
                    print(f"  [PAGINATION] Clicked page {page_num}, waiting for events...")
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    await page.wait_for_timeout(5000)
                    await asyncio.sleep(2)
                else:
                    print(f"  [PAGINATION] No next page button found — may need scroll pagination")
                    # Try scrolling to bottom to trigger lazy load
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(3000)
                    await asyncio.sleep(1)
                    # If no new events loaded, break
                    if len(captured_events) <= len(seen_ids) - 1:
                        print(f"  [PAGINATION] Scrolling didn't load new events, stopping")
                        break
            except Exception as e:
                print(f"  [PAGINATION] Error navigating to page {page_num}: {e}")
                break

        # Log final pagination status
        if total_records[0] > 0:
            if len(captured_events) >= total_records[0]:
                print(f"  [PAGINATION] ✅ ALL events captured: {len(captured_events)}/{total_records[0]}")
            else:
                print(f"  [PAGINATION] ⚠️ MISSING EVENTS: captured {len(captured_events)}/{total_records[0]}")

        print(f"  [BROWSER] Captured {len(captured_events)} events, closing browser...")
        await browser.close()

    return captured_events

async def collect_events_via_f12(gym_id, camp_type):
    """
    Collect events from iClassPro for a gym.

    Routes to either:
      - Direct API (USE_DIRECT_API=true, default): Fast HTTP calls (~5 min all gyms)
      - Playwright browser (USE_DIRECT_API=false): Headless Chromium interception (~50 min)

    If camp_type is "CAMP", collects from ALL camp categories.
    If camp_type is "ALL", collects ALL program types for the gym.

    Returns:
        For single type: list of raw event dicts
        For "ALL": {'events': {event_type: [events...]}, 'checked_types': [...]}
    """
    # Reset all pricing/rules caches so fresh data is always used
    global RULES_CACHE, GYM_VALID_VALUES, EVENT_PRICING, CAMP_PRICING
    RULES_CACHE = None
    GYM_VALID_VALUES = None
    EVENT_PRICING = None
    CAMP_PRICING = None

    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return [] if camp_type != "ALL" else {}

    # ===== DIRECT API PATH (fast, ~5 min for all 10 gyms) =====
    # Uses HTTP calls to iClassPro public API — no browser needed
    if USE_DIRECT_API:
        print(f"[INFO] Using DIRECT API collection (fast mode)")
        return _collect_events_direct_api(gym_id, event_type_filter=camp_type)

    # ===== PLAYWRIGHT PATH (slow, ~50 min, kept as fallback) =====
    # Set USE_DIRECT_API=false to use this path
    print(f"[INFO] Using PLAYWRIGHT browser collection (fallback mode)")
    if not PLAYWRIGHT_AVAILABLE:
        print(f"[ERROR] Playwright is not installed! Install with: pip install playwright && playwright install chromium")
        print(f"[ERROR] Or set USE_DIRECT_API=true (default) to use the fast direct API method")
        return [] if camp_type != "ALL" else {'events': {}, 'checked_types': []}

    # Special handling for "ALL" - collect ALL program types
    if camp_type == "ALL":
        return await collect_all_programs_for_gym(gym_id)
    
    # Special handling for "CAMP" - collect ALL camp types
    if camp_type == "CAMP":
        return await collect_all_camps_for_gym(gym_id)
    
    event_type_urls = get_event_type_urls()
    
    if camp_type not in event_type_urls:
        print(f"Event type '{camp_type}' not found in database")
        return []
    
    if gym_id not in event_type_urls[camp_type]:
        print(f"Gym '{gym_id}' does not have URL for '{camp_type}'")
        return []
    
    gym = GYMS[gym_id]
    slug = gym["slug"]
    url = event_type_urls[camp_type][gym_id]
    
    print(f"[INFO] Collecting '{camp_type}' from {gym['name']} ({gym_id})")
    print(f"[INFO] Portal URL: {url}")
    
    captured_events = []
    seen_ids = set()
    all_responses = []  # Debug: track all responses
    total_records = [0]  # Track total from listing response for pagination

    async def handle_response(response):
        """Intercept /camps/{id} detail calls AND listing calls for totalRecords"""
        nonlocal captured_events, seen_ids, all_responses
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
            status = response.status

            # Debug: track all /camps/ responses
            if "/camps/" in response_url or "/camps?" in response_url:
                all_responses.append({
                    "url": response_url,
                    "status": status,
                    "content_type": content_type,
                    "has_query": "?" in response_url
                })
                print(f"[DEBUG] Found /camps/ response: {response_url} (status: {status}, type: {content_type})")
        except Exception as e:
            print(f"[DEBUG] Error getting response info: {e}")
            return

        # Only care about JSON
        if "application/json" not in content_type:
            return

        # ALSO intercept the listing response (has ? in URL) to get totalRecords
        if "/camps?" in response_url:
            try:
                body = await response.json()
                if isinstance(body, dict) and "totalRecords" in body:
                    total_records[0] = body["totalRecords"]
                    print(f"[PAGINATION] Listing response: totalRecords={total_records[0]}")
            except Exception:
                pass
            return

        # We want detail calls like /camps/2106, NOT the ? query
        if "/camps/" in response_url and "?" not in response_url:
            print(f"[DEBUG] Processing detail call: {response_url}")
            try:
                body = await response.json()
            except Exception as e:
                print(f"[DEBUG] Error parsing JSON: {e}")
                return

            if not isinstance(body, dict):
                print(f"[DEBUG] Body is not a dict: {type(body)}")
                return

            data = body.get("data")
            if not isinstance(data, dict):
                print(f"[DEBUG] data is not a dict: {type(data)}")
                return

            event_id = data.get("id")
            if event_id is None:
                print(f"[DEBUG] No event ID in data")
                return

            if event_id in seen_ids:
                print(f"[DEBUG] Event {event_id} already seen")
                return

            seen_ids.add(event_id)
            captured_events.append(data)
            print(f"[INFO] ✅ Captured event {event_id} from: {response_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        page.on("response", handle_response)

        print(f"[INFO] Loading page: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"[INFO] Page loaded, waiting for network...")
        await page.reload(wait_until="networkidle", timeout=30000)
        print(f"[INFO] Network idle, waiting additional 3s for all responses...")
        await page.wait_for_timeout(3000)

        # Give async handlers time to finish processing
        import asyncio
        await asyncio.sleep(1)

        # PAGINATION: If totalRecords > captured, click through pages
        page_num = 1
        max_pages = 10  # Safety limit
        while total_records[0] > len(captured_events) and page_num < max_pages:
            page_num += 1
            print(f"[PAGINATION] Have {len(captured_events)}/{total_records[0]} events — loading page {page_num}...")

            try:
                # Try clicking the "next page" button (various selectors for iClassPro Angular app)
                next_btn = await page.query_selector('button.page-link >> text=">"')
                if not next_btn:
                    next_btn = await page.query_selector('a.page-link >> text=">"')
                if not next_btn:
                    next_btn = await page.query_selector('[aria-label="Next"]')
                if not next_btn:
                    next_btn = await page.query_selector('.pagination .next')
                if not next_btn:
                    next_btn = await page.query_selector(f'a.page-link >> text="{page_num}"')
                if not next_btn:
                    next_btn = await page.query_selector(f'button.page-link >> text="{page_num}"')

                if next_btn:
                    await next_btn.click()
                    print(f"[PAGINATION] Clicked page {page_num}, waiting for events...")
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    await page.wait_for_timeout(5000)
                    await asyncio.sleep(2)
                else:
                    print(f"[PAGINATION] No next page button found — trying scroll...")
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(3000)
                    await asyncio.sleep(1)
                    prev_count = len(captured_events)
                    if len(captured_events) == prev_count:
                        print(f"[PAGINATION] Scrolling didn't load new events, stopping")
                        break
            except Exception as e:
                print(f"[PAGINATION] Error navigating to page {page_num}: {e}")
                break

        # Log final pagination status
        if total_records[0] > 0:
            if len(captured_events) >= total_records[0]:
                print(f"[PAGINATION] ✅ ALL events captured: {len(captured_events)}/{total_records[0]}")
            else:
                print(f"[PAGINATION] ⚠️ MISSING EVENTS: captured {len(captured_events)}/{total_records[0]}")

        await browser.close()

    print(f"\n[INFO] Total raw events captured (detail JSON): {len(captured_events)}")
    print(f"[DEBUG] Total /camps/ responses found: {len(all_responses)}")
    if all_responses:
        print(f"[DEBUG] Response details:")
        for resp in all_responses[:10]:  # Show first 10
            print(f"  - {resp['url']} (status: {resp['status']}, query: {resp['has_query']})")
    print()

    return captured_events

def convert_event_dicts_to_flat(events, gym_id, portal_slug, camp_type_label):
    """
    Convert raw event dictionaries to flat format for database
    (EXACT same logic as the working script)
    """
    if not events:
        return []
    
    processed = []
    seen_ids = set()
    today_str = date.today().isoformat()  # e.g. "2025-11-13"

    # Aggregator: rule_id -> total hits across every event we process here.
    # Written back to the rules table at end of batch so the admin UI can
    # show "X caught" instead of always 0. Without this, the dashboard
    # never updates last_hit_count / last_sync_at and looks broken.
    hit_count_accumulator = {}

    # Fetch active validation checks from database (once per batch)
    try:
        checks_url = f"{SUPABASE_URL}/rest/v1/rules?select=*&is_active=eq.true&rule_type=like.check_%2A"
        checks_req = Request(checks_url)
        checks_req.add_header("apikey", SUPABASE_KEY)
        checks_req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        with urlopen(checks_req) as checks_resp:
            all_check_rows = json.loads(checks_resp.read().decode())
        # Filter out expired temporary rules
        active_checks = []
        for cr in all_check_rows:
            if not cr.get('is_permanent', True) and cr.get('end_date'):
                if cr['end_date'] < today_str:
                    continue
            active_checks.append(cr)
        print(f"  📋 Loaded {len(active_checks)} active validation checks from database")
    except Exception as e:
        print(f"  [WARN] Could not load checks from database: {e}")
        active_checks = []

    for ev in events:
        event_id = ev.get("id")
        if event_id is None:
            continue
        
        # 1) dedupe by ID
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        
        # 2) future-only filter
        start_date = (ev.get("startDate") or "").strip()
        end_date = (ev.get("endDate") or start_date).strip()

        # iClass exposes two date concepts per camp:
        #   startDate / endDate = the bookend date range (can include days
        #                         the camp doesn't actually meet, e.g. when
        #                         Monday is excluded for a federal holiday).
        #   blocks              = the real scheduled meeting days.
        # When blocks exist, use the first/last block date as the true start/end
        # so the calendar, emails, and validation engine reflect when the camp
        # actually starts. Without this, Memorial Day / Labor Day / Thanksgiving
        # camps display the bookend (e.g. 5/25) instead of the real first day
        # (e.g. 5/26), which has propagated wrong dates to customer-facing
        # outputs (the calendar UI and Email Composer).
        # Pricing logic below intentionally still uses the bookend dates for
        # weekly-vs-daily distinction — that semantic doesn't change.
        blocks = ev.get("blocks") or []
        if blocks:
            block_dates = sorted({(b.get("sqlDate") or "")[:10] for b in blocks if b.get("sqlDate")})
            if block_dates:
                start_date = block_dates[0]
                end_date = block_dates[-1]

        if start_date and start_date < today_str:
            continue
        
        # 3) build URL from ID (your source of truth)
        event_url = f"https://portal.iclasspro.com/{portal_slug}/camp-details/{event_id}"
        
        # 4) time from schedule (None if no schedule data — skips time validation)
        time_str = None
        schedule_list = ev.get("schedule") or []
        if schedule_list:
            sched = schedule_list[0]
            start_time = (sched.get("startTime") or "").strip()
            end_time = (sched.get("endTime") or "").strip()
            if start_time and end_time:
                time_str = f"{start_time} - {end_time}"
        
        # 5) title
        title = (ev.get("name") or "Untitled Event").strip()
        title = " ".join(title.split())
        
        # Get price from SOURCE OF TRUTH (camp_pricing / event_pricing tables)
        # NOT from regex parsing of title/description
        price = None
        event_type_upper = camp_type_label.upper()

        # For CAMP events, get price from camp_pricing table
        if event_type_upper == 'CAMP':
            camp_pricing = get_camp_pricing()
            if gym_id in camp_pricing:
                gym_prices = camp_pricing[gym_id]

                # Use ONLY iClassPro API data - NOT title/description text
                program_name = (ev.get("programName") or "").lower()
                camp_start = ev.get("startDate") or ""
                camp_end = ev.get("endDate") or ""

                # Half day vs Full day: ONLY from programName (iClassPro API field)
                is_half_day = 'half day' in program_name or 'half-day' in program_name

                # Weekly vs Daily: Based on startDate vs endDate (iClassPro API fields)
                # If camp spans multiple days = weekly, single day = daily
                is_weekly = camp_start != camp_end and camp_start and camp_end

                if is_half_day:
                    if is_weekly and gym_prices.get('half_day_weekly'):
                        price = gym_prices['half_day_weekly']
                    elif gym_prices.get('half_day_daily'):
                        price = gym_prices['half_day_daily']
                else:  # Full day
                    if is_weekly and gym_prices.get('full_day_weekly'):
                        price = gym_prices['full_day_weekly']
                    elif gym_prices.get('full_day_daily'):
                        price = gym_prices['full_day_daily']

                if price:
                    print(f"    [PRICE] Source of truth: ${price} ({'half' if is_half_day else 'full'} day, {'weekly' if is_weekly else 'daily'}) [program: {ev.get('programName', 'N/A')}, dates: {camp_start} to {camp_end}]")

        # For non-CAMP events, get price from event_pricing table
        elif event_type_upper in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']:
            valid_prices = get_active_event_prices_for_validation(gym_id, event_type_upper, start_date)
            if valid_prices:
                price = valid_prices[0]
                print(f"    [PRICE] Using source of truth: ${price} ({event_type_upper})")

        # Fallback: extract from title/description only if no source of truth price found
        if price is None:
            price_match = re.search(r'\$(\d+(?:\.\d{2})?)', title)
            if price_match:
                price = float(price_match.group(1))
                print(f"    [PRICE] Fallback - extracted from title: ${price}")
            else:
                # Try description if available
                description_html = ev.get('description', '')
                if description_html:
                    price_match = re.search(r'\$(\d+(?:\.\d{2})?)', description_html)
                    if price_match:
                        price = float(price_match.group(1))
                        print(f"    [PRICE] Fallback - extracted from description: ${price}")
        
        # Calculate day_of_week from start_date
        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            day_of_week = event_date.strftime("%A")  # Monday, Tuesday, etc.
        except (ValueError, AttributeError):
            day_of_week = None
        
        # Extract availability info from iClassPro
        has_openings = ev.get("hasOpenings", True)  # Default to true if not present
        openings = ev.get("openings")  # Integer: exact spots remaining (e.g., 23)
        openings_display = ev.get("openingsDisplay")  # Pre-formatted string (e.g., "23 Openings Available")
        show_openings = ev.get("showOpenings", True)  # Gym setting: whether to show count publicly
        registration_start_date = ev.get("registrationStartDate")  # YYYY-MM-DD or None
        registration_end_date = ev.get("registrationEndDate")  # YYYY-MM-DD or None

        # Log availability status
        if has_openings == False:
            print(f"    🔴 SOLD OUT / FULL - no openings available")
        elif openings is not None:
            print(f"    🟢 {openings} spots remaining")
        
        # Extract description and check for flyer images
        description_raw = ev.get("description", "")
        has_flyer = False
        flyer_url = None
        
        # Check multiple possible image fields from iClassPro API
        # Field 1: Direct image/imageUrl field
        possible_image_fields = ['image', 'imageUrl', 'image_url', 'flyerUrl', 'flyer_url', 'mediaUrl', 'media_url', 'photo', 'photoUrl']
        for field in possible_image_fields:
            img_url = ev.get(field)
            if img_url and isinstance(img_url, str) and img_url.startswith('http'):
                has_flyer = True
                flyer_url = img_url
                print(f"    🖼️ Found flyer in '{field}': {flyer_url[:60]}...")
                break
        
        # Field 2: Check for image in description HTML if not found above
        if not has_flyer and description_raw:
            img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description_raw, re.IGNORECASE)
            if img_match:
                has_flyer = True
                flyer_url = img_match.group(1)
                # Make sure it's an absolute URL
                if flyer_url and not flyer_url.startswith('http'):
                    flyer_url = f"https://portal.iclasspro.com{flyer_url}" if flyer_url.startswith('/') else None
                print(f"    🖼️ Found flyer in description HTML: {flyer_url[:60] if flyer_url else 'relative URL'}...")
        
        # Debug: Log all fields in the event to help identify where images are stored
        if not has_flyer:
            # Check if any field contains 'image' or 'http' that we might have missed
            for key, value in ev.items():
                if isinstance(value, str) and ('image' in key.lower() or 'photo' in key.lower() or 'flyer' in key.lower() or 'media' in key.lower()):
                    print(f"    [DEBUG] Potential image field '{key}': {str(value)[:100]}...")
                elif isinstance(value, str) and value.startswith('http') and ('.jpg' in value.lower() or '.png' in value.lower() or '.gif' in value.lower() or '.webp' in value.lower()):
                    print(f"    [DEBUG] Found URL with image extension in '{key}': {value[:100]}...")
        
        if description_raw:
            # Step 1: Replace common block elements with newlines BEFORE stripping tags
            # This preserves paragraph/line structure
            desc_with_breaks = re.sub(r'<br\s*/?>', '\n', description_raw, flags=re.IGNORECASE)
            desc_with_breaks = re.sub(r'</p>\s*<p[^>]*>', '\n\n', desc_with_breaks, flags=re.IGNORECASE)
            desc_with_breaks = re.sub(r'</(p|div|li|h[1-6])>', '\n', desc_with_breaks, flags=re.IGNORECASE)
            
            # Step 2: Remove remaining HTML tags
            description = re.sub(r'<[^>]+>', '', desc_with_breaks)
            
            # Step 3: Decode HTML entities (&ndash; -> –, &rsquo; -> ', etc.)
            description = html.unescape(description)
            
            # Step 4: Clean up excessive whitespace while preserving single newlines
            # Replace multiple spaces with single space
            description = re.sub(r'[^\S\n]+', ' ', description)
            # Replace 3+ newlines with 2 newlines
            description = re.sub(r'\n{3,}', '\n\n', description)
            # Trim each line
            description = '\n'.join(line.strip() for line in description.split('\n'))
            # Final trim
            description = description.strip()
            
            # Limit length to avoid huge descriptions
            if len(description) > 1500:
                description = description[:1500] + "..."
        else:
            description = None
        
        # Get age values and convert to integers (database expects integers)
        # DEBUG: Log ALL age-related fields from iClassPro to catch any discrepancies
        raw_min_age = ev.get("minAge")
        raw_max_age = ev.get("maxAge")
        # Check for alternative field names that iClassPro might use
        alt_min_age = ev.get("min_age") or ev.get("minimumAge") or ev.get("ageMin") or ev.get("age_min")
        alt_max_age = ev.get("max_age") or ev.get("maximumAge") or ev.get("ageMax") or ev.get("age_max")
        
        print(f"    [DEBUG AGE] Event {event_id}:")
        print(f"      - Raw minAge from API: {raw_min_age} (type: {type(raw_min_age).__name__})")
        print(f"      - Raw maxAge from API: {raw_max_age} (type: {type(raw_max_age).__name__})")
        if alt_min_age or alt_max_age:
            print(f"      - Alternative age fields found: min={alt_min_age}, max={alt_max_age}")
        # Also log ALL keys in the event to see what fields exist
        age_related_keys = [k for k in ev.keys() if 'age' in k.lower()]
        if age_related_keys:
            print(f"      - All age-related keys in API response: {age_related_keys}")
        
        age_min = raw_min_age
        age_max = raw_max_age
        if age_min is not None:
            try:
                age_min = int(float(age_min))
            except (ValueError, TypeError):
                age_min = None
        if age_max is not None:
            try:
                age_max = int(float(age_max))
            except (ValueError, TypeError):
                age_max = None
        
        print(f"      - Final age_min saved to DB: {age_min}")
        print(f"      - Final age_max saved to DB: {age_max}")
        
        # Determine description status and validation errors
        description_status = 'unknown'
        validation_errors = []
        
        if not description and not has_flyer:
            description_status = 'none'
        elif has_flyer and not description:
            description_status = 'flyer_only'
        elif description:
            description_status = 'full'
        
        event_type = camp_type_label.upper()
        title_lower = title.lower()
        description_lower = description.lower() if description else ''
        
        # ========== DATABASE-DRIVEN VALIDATION ==========
        # All checks come from the `rules` table. Python has no hardcoded validation.
        if description and event_type != 'SPECIAL EVENT':
            ctx = ValidationContext(
                event_dict=ev,
                gym_id=gym_id,
                event_type=event_type,
                title=title,
                description=description,
                start_date=start_date,
                end_date_str=end_date,
                time_str=time_str,
                age_min=age_min,
                day_of_week=day_of_week,
                get_rules_for_gym_fn=get_rules_for_gym,
                get_camp_pricing_fn=get_camp_pricing,
                get_event_pricing_fn=get_event_pricing
            )
            validation_errors, per_event_hits = run_validation(ctx, active_checks)
            # Accumulate hit counts across this batch so we can write them
            # back to the rules table in one shot at the end.
            for rule_id, count in per_event_hits.items():
                hit_count_accumulator[rule_id] = hit_count_accumulator.get(rule_id, 0) + count
        
        # Registration status checks (not validation — informational)
        if registration_end_date:
            try:
                reg_end = datetime.strptime(registration_end_date, "%Y-%m-%d")
                if reg_end < datetime.now():
                    validation_errors.append({
                        "type": "registration_closed",
                        "severity": "info",
                        "category": "status",
                        "message": f"Registration closed on {registration_end_date}"
                    })
                    print(f"    ℹ️ REGISTRATION CLOSED: Ended {registration_end_date}")
            except (ValueError, TypeError):
                pass
        
        if registration_start_date:
            try:
                reg_start = datetime.strptime(registration_start_date, "%Y-%m-%d")
                if reg_start > datetime.now():
                    validation_errors.append({
                        "type": "registration_not_open",
                        "severity": "info",
                        "category": "status",
                        "message": f"Registration opens {registration_start_date}"
                    })
                    print(f"    ℹ️ REGISTRATION NOT OPEN YET: Opens {registration_start_date}")
            except (ValueError, TypeError):
                pass
        
        # Log status
        if description_status == 'none':
            print(f"    ❌ NO DESCRIPTION")
        elif description_status == 'flyer_only':
            print(f"    ⚠️ FLYER ONLY (no text)")
        
        processed.append({
            "gym_id": gym_id,
            "title": title,
            "date": start_date,
            "start_date": start_date,
            "end_date": end_date,
            "time": time_str,
            "price": price,
            "type": camp_type_label,
            "event_url": event_url,
            "age_min": age_min,
            "age_max": age_max,
            "day_of_week": day_of_week,
            "description": description,
            "has_flyer": has_flyer,
            "flyer_url": flyer_url,
            "description_status": description_status,
            "validation_errors": validation_errors,
            # iClassPro camp fields for pricing schedule matching
            "type_id": ev.get("typeId"),
            "allow_choose_days": ev.get("allowChooseDays"),
            "program_name": ev.get("programName"),
            # Availability tracking from iClassPro
            "has_openings": has_openings,
            "openings": openings,
            "openings_display": openings_display,
            "show_openings": show_openings,
            "registration_start_date": registration_start_date,
            "registration_end_date": registration_end_date,
        })
    
    # ========== VALIDATION SUMMARY ==========
    # Print a summary of all validation errors found across all events
    if processed:
        all_errors = []
        for ev in processed:
            all_errors.extend(ev.get("validation_errors", []))
        
        if all_errors:
            # Count by type
            error_counts = {}
            for err in all_errors:
                err_type = err.get("type", "unknown")
                error_counts[err_type] = error_counts.get(err_type, 0) + 1
            
            # Count by category
            data_errors = sum(1 for e in all_errors if e.get("category") == "data_error")
            status_errors = sum(1 for e in all_errors if e.get("category") == "status")

            print(f"\n{'='*60}")
            print(f"📊 VALIDATION SUMMARY: {len(processed)} events checked, {len(all_errors)} total errors found")
            print(f"   🚨 DATA errors (wrong info): {data_errors}")
            print(f"   ℹ️  STATUS errors: {status_errors}")
            print(f"   Breakdown by type:")
            for err_type, count in sorted(error_counts.items(), key=lambda x: -x[1]):
                print(f"     - {err_type}: {count}")
            print(f"{'='*60}\n")
        else:
            print(f"\n✅ VALIDATION SUMMARY: {len(processed)} events checked, 0 errors found\n")

    # Write the per-rule hit counts back to the `rules` table so the admin
    # UI can show "X caught" instead of always 0. Uses raw HTTP to match
    # the rest of this file's Supabase-write pattern (no supabase Python
    # client dep). Failures are logged but never crash the sync.
    if hit_count_accumulator:
        try:
            from datetime import datetime as _dt
            now_iso = _dt.utcnow().isoformat() + 'Z'
            for rule_id, total_hits in hit_count_accumulator.items():
                try:
                    update_url = f"{SUPABASE_URL}/rest/v1/rules?id=eq.{rule_id}"
                    payload = json.dumps({
                        'last_hit_count': int(total_hits),
                        'last_sync_at': now_iso,
                    }).encode('utf-8')
                    req = Request(update_url, data=payload, method='PATCH')
                    req.add_header('apikey', SUPABASE_KEY)
                    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
                    req.add_header('Content-Type', 'application/json')
                    req.add_header('Prefer', 'return=minimal')
                    with urlopen(req, timeout=10) as _resp:
                        pass
                except Exception as e:
                    print(f"  [WARN] Failed to update last_hit_count for rule {rule_id}: {e}")
            print(f"  ✓ Updated last_hit_count for {len(hit_count_accumulator)} rule(s) in DB")
        except Exception as e:
            print(f"  [WARN] Hit-count writeback failed: {e}")

    return processed

# For backward compatibility
EVENT_TYPE_URLS = get_event_type_urls()

if __name__ == "__main__":
    # Test
    async def test():
        events = await collect_events_via_f12("RBK", "KIDS NIGHT OUT")
        print(f"Collected {len(events)} events")
        if events:
            flat = convert_event_dicts_to_flat(events, "RBK", "rbkingwood", "KIDS NIGHT OUT")
            print(f"Converted to {len(flat)} flat events")
            print(json.dumps(flat[0] if flat else {}, indent=2))
    
    asyncio.run(test())
