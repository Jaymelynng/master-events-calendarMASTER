#!/usr/bin/env python3
"""
F12 Event Collection Script
Uses Playwright to intercept /camps/{id} detail calls (like the working script)
"""

import asyncio
import json
import os
import re
import html
from datetime import datetime, date
from urllib.request import Request, urlopen
from playwright.async_api import async_playwright

# Supabase configuration — read from environment variables (set in Railway / .env)
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = (
    os.environ.get('SUPABASE_SERVICE_KEY')
    or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    or os.environ.get('SUPABASE_ANON_KEY')
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  WARNING: SUPABASE_URL and/or SUPABASE_SERVICE_KEY not set in environment.")
    print("   Set them via Railway env vars, or create a .env file in the automation/ folder.")
    print("   See .env.example in the project root for details.")

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

# Camp pricing is now fetched from Supabase camp_pricing table
# Validates Full Day Daily and Full Day Weekly prices only

def fetch_camp_pricing():
    """Fetch camp pricing from Supabase camp_pricing table (all 4 price types)"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/camp_pricing?select=*"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        
        with urlopen(req) as response:
            rows = json.loads(response.read().decode())
        
        pricing = {}
        for row in rows:
            gym_id = row.get('gym_id')
            if gym_id:
                pricing[gym_id] = {
                    'full_day_daily': row.get('full_day_daily'),
                    'full_day_weekly': row.get('full_day_weekly'),
                    'half_day_daily': row.get('half_day_daily'),
                    'half_day_weekly': row.get('half_day_weekly')
                }
        
        print(f"[INFO] Loaded camp pricing for {len(pricing)} gyms from Supabase (Full Day + Half Day)")
        return pricing
    except Exception as e:
        print(f"[WARN] Could not fetch camp pricing: {e}")
        return {}

# Global cache for camp pricing
CAMP_PRICING = None

def get_camp_pricing():
    """Get cached camp pricing or fetch from Supabase"""
    global CAMP_PRICING
    if CAMP_PRICING is None:
        CAMP_PRICING = fetch_camp_pricing()
    return CAMP_PRICING

# Event pricing (Clinic, KNO, Open Gym) from event_pricing table
EVENT_PRICING = None

def fetch_event_pricing():
    """Fetch event pricing from Supabase event_pricing table.
    Returns dict grouped by gym_id and event_type with list of valid prices.
    Only returns prices that are currently effective (based on effective_date and end_date).
    { 'CCP': { 'KIDS NIGHT OUT': [40.0], 'CLINIC': [35.0], 'OPEN GYM': [10.0] } }
    """
    try:
        # Get today's date for filtering
        from datetime import date
        today = date.today().isoformat()
        
        # Query with date filtering - get prices where today is between effective_date and end_date
        url = f"{SUPABASE_URL}/rest/v1/event_pricing?select=*&effective_date=lte.{today}&or=(end_date.is.null,end_date.gte.{today})"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")

        with urlopen(req) as response:
            rows = json.loads(response.read().decode())

        pricing = {}
        for row in rows:
            gym_id = row.get('gym_id')
            event_type = row.get('event_type')
            price = row.get('price')
            if gym_id and event_type and price is not None:
                if gym_id not in pricing:
                    pricing[gym_id] = {}
                if event_type not in pricing[gym_id]:
                    pricing[gym_id][event_type] = []
                # Convert to float and add to list (gym may have multiple valid prices)
                pricing[gym_id][event_type].append(float(price))

        total_prices = sum(len(prices) for gym in pricing.values() for prices in gym.values())
        print(f"[INFO] Loaded {total_prices} event prices for {len(pricing)} gyms from Supabase (effective {today})")
        return pricing
    except Exception as e:
        print(f"[WARN] Could not fetch event pricing: {e}")
        return {}

def get_event_pricing():
    """Get cached event pricing or fetch from Supabase"""
    global EVENT_PRICING
    if EVENT_PRICING is None:
        EVENT_PRICING = fetch_event_pricing()
    return EVENT_PRICING

# Per-gym valid values (extra prices, times, etc.) from gym_valid_values table
GYM_VALID_VALUES = None

def fetch_gym_valid_values():
    """Fetch per-gym valid values from Supabase gym_valid_values table.
    Returns dict grouped by gym_id and rule_type:
    { 'RBA': { 'price': [{'value': '20', 'label': 'Before Care'}], 'time': [...] } }
    """
    try:
        url = f"{SUPABASE_URL}/rest/v1/gym_valid_values?select=*"
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")

        with urlopen(req) as response:
            rows = json.loads(response.read().decode())

        values = {}
        for row in rows:
            gym_id = row.get('gym_id')
            rule_type = row.get('rule_type')
            if gym_id and rule_type:
                if gym_id not in values:
                    values[gym_id] = {}
                if rule_type not in values[gym_id]:
                    values[gym_id][rule_type] = []
                values[gym_id][rule_type].append({
                    'value': row.get('value', ''),
                    'label': row.get('label', ''),
                    'event_type': row.get('event_type') or None  # CAMP, OPEN GYM, etc. or None/ALL for apply-to-all
                })

        total_rules = sum(len(v) for gym in values.values() for v in gym.values())
        print(f"[INFO] Loaded {total_rules} gym valid value rules for {len(values)} gyms from Supabase")
        return values
    except Exception as e:
        print(f"[WARN] Could not fetch gym valid values: {e}")
        return {}

def get_gym_valid_values():
    """Get cached gym valid values or fetch from Supabase.
    Rules with gym_id='ALL' are merged into every gym's rules."""
    global GYM_VALID_VALUES
    if GYM_VALID_VALUES is None:
        GYM_VALID_VALUES = fetch_gym_valid_values()
    return GYM_VALID_VALUES

def get_rules_for_gym(gym_id, event_type=None):
    """Get merged rules for a specific gym, optionally filtered by event type.
    event_type: CAMP, CLINIC, KIDS NIGHT OUT, OPEN GYM. Rules apply only when:
    - rule.event_type is None/empty (legacy = apply to all), or
    - rule.event_type == 'ALL', or
    - rule.event_type matches event_type
    """
    all_values = get_gym_valid_values()
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
    Opens the camp listing page and collects JSON from /camps/<id> detail calls.
    (EXACT same approach as the working script)
    
    If camp_type is "CAMP", collects from ALL camp URLs for the gym.
    If camp_type is "ALL", collects ALL program types for the gym.
    
    Returns:
        events_raw: list of event dicts (one per event)
        OR for "ALL": dict of { event_type: [events...] }
    """
    # Reset all pricing/rules caches so fresh data is always used
    global GYM_VALID_VALUES, EVENT_PRICING, CAMP_PRICING
    GYM_VALID_VALUES = None
    EVENT_PRICING = None
    CAMP_PRICING = None

    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return [] if camp_type != "ALL" else {}

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
            event_pricing_data = get_event_pricing()
            if gym_id in event_pricing_data and event_type_upper in event_pricing_data[gym_id]:
                valid_prices = event_pricing_data[gym_id][event_type_upper]
                if valid_prices:
                    price = valid_prices[0]  # Use first valid price
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
        registration_start_date = ev.get("registrationStartDate")  # YYYY-MM-DD or None
        registration_end_date = ev.get("registrationEndDate")  # YYYY-MM-DD or None
        
        # Log availability status
        if has_openings == False:
            print(f"    🔴 SOLD OUT / FULL - no openings available")
        
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
        
        # ========== VALIDATION SETUP ==========
        event_type = camp_type_label.upper()
        title_lower = title.lower()
        description_lower = description.lower() if description else ''
        
        # NOTE: FORMAT/completeness checks removed — focus is DATA errors only
        # (wrong info that hurts signups). Format checks can be re-added later.
        
        # ========== [REMOVED] COMPLETENESS CHECKS ==========
        # FORMAT checks (missing info) removed to focus on DATA errors (wrong info).
        # Can be re-enabled later. See git history for the full completeness checks.
        
        if False and event_type != 'SPECIAL EVENT':
            
            # --- TITLE COMPLETENESS ---
            
            # Helper to check if age exists in text
            def has_age_in_text(text):
                if not text:
                    return False
                txt = text.lower()
                # Match: "Ages 5", "Age 5", "5+", "5-12", "Students 5+"
                return bool(re.search(r'ages?\s*\d{1,2}|students?\s*\d{1,2}|\d{1,2}\s*[-–+]|\d{1,2}\s*to\s*\d{1,2}', txt))
            
            # Helper to check if date exists in text
            def has_date_in_text(text):
                if not text:
                    return False
                txt = text.lower()
                # Match: "January", "Jan", "1/9", "01/09", "9th", etc.
                months = r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)'
                date_formats = r'(\d{1,2}/\d{1,2}|\d{1,2}(st|nd|rd|th))'
                return bool(re.search(months + r'|' + date_formats, txt))
            
            # Helper to check if time exists in text
            def has_time_in_text(text):
                if not text:
                    return False
                txt = text.lower()
                
                # PRE-CLEAN: Remove patterns that cause false positives
                # "$62 a day" -> "62 a" matched as time, "Ages 4-13" -> "13 a" matched as time
                txt = re.sub(r'\$\d+(?:\.\d{2})?\s*(?:a\s+day|a\s+week|/day|/week|per\s+day|per\s+week)', ' ', txt)
                txt = re.sub(r'ages?\s*\d{1,2}\s*[-–to]+\s*\d{1,2}', ' ', txt)
                txt = re.sub(r'\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)', ' ', txt)
                # Catch-all: "$50 a" (price followed by "a") but NOT "$50 am" (legitimate time)
                txt = re.sub(r'\$\d+(?:\.\d{2})?\s+a(?!\s*m)', ' ', txt)
                
                # Match many time formats:
                # - "6:30pm", "6:30 pm", "6pm", "6 pm", "6:30p", "6:30 p.m."
                # - "6:30a", "6:30 a.m.", "6am", "6 am"  
                # - "9:00 - 3:00" (colon times, even without am/pm)
                # - "9-3" followed by context suggesting time (less reliable, so require am/pm nearby)
                
                # Pattern 1: Time with am/pm indicator (most reliable)
                has_ampm_time = bool(re.search(r'\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.|a|p)\b', txt))
                
                # Pattern 2: Colon time like "9:00" or "9:00 - 3:00" (even without am/pm)
                has_colon_time = bool(re.search(r'\d{1,2}:\d{2}', txt))
                
                return has_ampm_time or has_colon_time
            
            # 1. TITLE: Must have AGE
            if not has_age_in_text(title):
                validation_errors.append({
                    "type": "missing_age_in_title",
                    "severity": "warning",
                    "category": "formatting",
                    "message": "Title missing age (e.g., 'Ages 5+')"
                })
                print(f"    [!] COMPLETENESS: Title missing age")
            
            # 2. TITLE: Must have DATE
            if not has_date_in_text(title):
                validation_errors.append({
                    "type": "missing_date_in_title",
                    "severity": "warning",
                    "category": "formatting",
                    "message": "Title missing date (e.g., 'January 9th')"
                })
                print(f"    [!] COMPLETENESS: Title missing date")
            
            # 3. TITLE: Must have PROGRAM TYPE keyword
            # Per standardization: Theme | Program | Age | Date
            # Program keywords by type
            def has_program_type_in_text(text, etype):
                txt = text.lower()
                txt_no_apos = txt.replace("'", "").replace("'", "")

                # First check gym_valid_values for program_synonym rules for this gym
                synonym_rules = get_rules_for_gym(gym_id, event_type).get('program_synonym', [])
                for rule in synonym_rules:
                    keyword = rule.get('value', '').lower()
                    target_type = rule.get('label', '').upper()
                    if keyword and keyword in txt and target_type == etype:
                        return True

                if etype == 'KIDS NIGHT OUT':
                    return ('kids night out' in txt_no_apos or 'kid night out' in txt_no_apos or
                            'kno' in txt or 'night out' in txt or 'parents night out' in txt_no_apos or
                            'ninja night out' in txt)
                elif etype == 'CLINIC':
                    return 'clinic' in txt
                elif etype == 'OPEN GYM':
                    return 'open gym' in txt
                elif etype == 'CAMP':
                    return 'camp' in txt
                return True  # Unknown types pass
            
            if not has_program_type_in_text(title, event_type):
                validation_errors.append({
                    "type": "missing_program_in_title",
                    "severity": "warning",
                    "category": "formatting",
                    "message": f"Title missing program type (should include '{event_type.title()}' or similar)"
                })
                print(f"    [!] COMPLETENESS: Title missing program type '{event_type}'")
            
            # --- DESCRIPTION COMPLETENESS ---
            
            if description:
                # 3. DESCRIPTION: Must have AGE
                if not has_age_in_text(description):
                    validation_errors.append({
                        "type": "missing_age_in_description",
                        "severity": "warning",
                        "category": "formatting",
                        "message": "Description missing age"
                    })
                    print(f"    [!] COMPLETENESS: Description missing age")
                
                # 4. DESCRIPTION: Must have DATE or TIME
                if not has_date_in_text(description) and not has_time_in_text(description):
                    validation_errors.append({
                        "type": "missing_datetime_in_description",
                        "severity": "warning",
                        "category": "formatting",
                        "message": "Description missing date/time"
                    })
                    print(f"    [!] COMPLETENESS: Description missing date/time")
                
                # 5. DESCRIPTION: Must have TIME (required per standardization doc)
                # EXCEPTION: Camps can use "Full Day" or "Half Day" instead of specific times
                has_camp_time_format = event_type == 'CAMP' and ('full day' in description_lower or 'half day' in description_lower)
                if not has_time_in_text(description) and not has_camp_time_format:
                    validation_errors.append({
                        "type": "missing_time_in_description",
                        "severity": "warning",
                        "category": "formatting",
                        "message": "Description missing specific time (e.g., '6:30pm')"
                    })
                    print(f"    [!] COMPLETENESS: Description missing time")
                
                # 6. DESCRIPTION: Must have PROGRAM TYPE keyword
                if not has_program_type_in_text(description, event_type):
                    validation_errors.append({
                        "type": "missing_program_in_description",
                        "severity": "warning",
                        "category": "formatting",
                        "message": f"Description missing program type (should mention '{event_type.title()}' or similar)"
                    })
                    print(f"    [!] COMPLETENESS: Description missing program type '{event_type}'")
            
            # --- PROGRAM-SPECIFIC COMPLETENESS ---
            
            # CLINIC: Should mention skill in description
            if event_type == 'CLINIC' and description:
                # Comprehensive skills list - check in BOTH title and description
                skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling', 
                         'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend', 
                         'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'tumbl', 'bridge', 
                         'kickover', 'walkover', 'flip flop', 'flip-flop', 'back walkover', 'front walkover']
                # Check description OR title for skill (skill in title is sufficient context)
                has_skill_in_desc = any(skill in description_lower for skill in skills)
                has_skill_in_title = any(skill in title_lower for skill in skills)
                has_skill = has_skill_in_desc or has_skill_in_title
                if not has_skill:
                    validation_errors.append({
                        "type": "clinic_missing_skill",
                        "severity": "info",
                        "category": "formatting",
                        "message": "Clinic description doesn't mention specific skill"
                    })
                    print(f"    [i] COMPLETENESS: Clinic missing skill mention")
        
        # ========== ACCURACY CHECKS (Compare values across sources) ==========
        # These check if values MATCH when they exist in multiple places
        # Covers: CAMP, KNO, CLINIC, OPEN GYM
        # SPECIAL EVENT is excluded — one-off events with no standard pricing or format
        
        if description and event_type != 'SPECIAL EVENT':
            
            # --- DATE VALIDATION: Cross-check iClassPro dates vs description ---
            # SCANS the description to catch manager mistakes (wrong dates in descriptions)
            # BUILT-IN RULES (universal - no per-gym setup needed):
            #   - Camps spanning multiple months are NORMAL (June 28 - July 5)
            #     All months between start and end are valid
            #   - End date before start date = manager error
            #   - Registration dates, promo references are ignored
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d")
                event_month = event_date.strftime("%B").lower()
                event_year = event_date.year
                event_day = event_date.day

                end_date_str = ev.get("endDate") or start_date
                end_date_obj = datetime.strptime(end_date_str, "%Y-%m-%d")

                # BUILT-IN: End date before start date = manager error
                if end_date_obj < event_date:
                    validation_errors.append({
                        "type": "date_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": f"End date ({end_date_str}) is before start date ({start_date})"
                    })
                    print(f"    [!] DATE ERROR: End date {end_date_str} before start date {start_date}")

                # Build valid months from iClassPro start_date and end_date
                # BUILT-IN: Include ALL months between start and end
                # So a camp from June 28 - August 1 won't flag July
                import calendar
                event_month_abbr = event_date.strftime("%b").lower()
                end_month = end_date_obj.strftime("%B").lower()
                end_month_abbr = end_date_obj.strftime("%b").lower()
                valid_months = {event_month, end_month, event_month_abbr, end_month_abbr}

                # Add every month BETWEEN start and end
                if event_date.month != end_date_obj.month:
                    m = event_date.month
                    while m != end_date_obj.month:
                        m = m % 12 + 1
                        valid_months.add(calendar.month_name[m].lower())
                        valid_months.add(calendar.month_abbr[m].lower())

                # Scan description for month mentions that DON'T match the event dates
                all_months = {}
                for i, full_name in enumerate(calendar.month_name):
                    if full_name:
                        all_months[full_name.lower()] = i
                for i, abbr in enumerate(calendar.month_abbr):
                    if abbr:
                        all_months[abbr.lower()] = i

                for month_name, month_num in all_months.items():
                    if len(month_name) <= 3:
                        pattern = r'\b' + month_name + r'\b'
                        if not re.search(pattern, description_lower[:200]):
                            continue
                    else:
                        if month_name not in description_lower[:200]:
                            continue

                    if month_name not in valid_months:
                        # BUILT-IN: Skip registration/signup context
                        # "Register by September 1" is not a date error
                        skip_patterns = [
                            r'(register|registration|sign\s*up|enroll|deadline|closes?|opens?|book\s*by|by)\s+\w*\s*' + month_name,
                            r'(also|check out|see our|upcoming|next|other|more)\s+\w*\s*' + month_name,
                        ]
                        if any(re.search(p, description_lower[:300]) for p in skip_patterns):
                            continue

                        # Only flag if prominent (first 200 chars)
                        if len(month_name) <= 3:
                            in_first_200 = bool(re.search(r'\b' + month_name + r'\b', description_lower[:200]))
                        else:
                            in_first_200 = month_name in description_lower[:200]

                        if in_first_200:
                            validation_errors.append({
                                "type": "date_mismatch",
                                "severity": "error",
                                "category": "data_error",
                                "message": f"Event is {event_month.title()} {event_day} but description says '{month_name.title()}'"
                            })
                            print(f"    [!] DATE MISMATCH: Event is {event_month.title()}, description says {month_name.title()}")
                            break
            except ValueError:
                pass  # Invalid date format, skip
            
            # --- WRONG YEAR IN TITLE: Check if title has wrong year ---
            # Catches: "01/17/2025" when event is actually 2026
            title_year_matches = re.findall(r'\b(20\d{2})\b', title)
            for title_year in title_year_matches:
                title_year_int = int(title_year)
                if title_year_int != event_year:
                    validation_errors.append({
                        "type": "year_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": f"Title says {title_year} but event is in {event_year}"
                    })
                    print(f"    [!] YEAR MISMATCH: Title says {title_year}, event is {event_year}")
                    break  # Only flag once
            
            # --- TIME VALIDATION: Compare structured time to title AND description ---
            # Handles all formats: 5:00, 5pm, 5:00pm, 5:00 PM, 5 pm, 5:00 p.m.
            if time_str:
                # Extract ALL hours from structured time (e.g., "6:30 PM - 9:30 PM" -> [18, 21] in 24hr)
                event_times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?', time_str.lower())
                event_hours = set()
                for et in event_times:
                    if et[0]:
                        hour = int(et[0])
                        ampm = (et[2] or '').replace('.', '')
                        # Convert to 24hr
                        if ampm == 'pm' and hour != 12:
                            hour += 12
                        elif ampm == 'am' and hour == 12:
                            hour = 0
                        event_hours.add(hour)
                
                if event_hours:
                    # Helper to check times in text
                    def check_times_in_text(text, text_name, char_limit=300):
                        """Check if times in text match event times. Format-tolerant."""
                        text_lower = text.lower()[:char_limit]
                        
                        # PRE-CLEAN: Remove patterns that cause false positives
                        # 1. Price patterns: "$62 a day" -> remove so "62 a" isn't matched as time
                        text_cleaned = re.sub(r'\$\d+(?:\.\d{2})?\s*(?:a\s+day|a\s+week|/day|/week|per\s+day|per\s+week)', ' ', text_lower)
                        # 2. Age patterns: "Ages 4-13" -> remove so "13 a" isn't matched as time
                        text_cleaned = re.sub(r'ages?\s*\d{1,2}\s*[-–to]+\s*\d{1,2}', ' ', text_cleaned)
                        text_cleaned = re.sub(r'\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)', ' ', text_cleaned)
                        # 3. Standalone price amounts: "$XX" followed by space and "a" (but not "am")
                        text_cleaned = re.sub(r'\$\d+(?:\.\d{2})?\s+a(?!\s*m)', ' ', text_cleaned)
                        
                        # Match many time formats:
                        # "6:30pm", "6:30 pm", "6pm", "6 pm", "6:30p", "6:30 p.m."
                        # "6:30a", "6am", "9a - 3p" (TIGAR format)
                        # Captures: (hour, minutes_or_empty, am/pm indicator)
                        found_times = re.findall(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)(?:\b|(?=\s|-))', text_cleaned)
                        
                        for found_time in found_times:
                            found_hour = int(found_time[0])
                            raw_ampm = found_time[2].replace('.', '') if found_time[2] else ''
                            # Normalize: "a" -> "am", "p" -> "pm"
                            found_ampm = 'am' if raw_ampm in ['a', 'am'] else 'pm' if raw_ampm in ['p', 'pm'] else ''
                            
                            # Convert to 24hr
                            if found_ampm == 'pm' and found_hour != 12:
                                found_hour += 12
                            elif found_ampm == 'am' and found_hour == 12:
                                found_hour = 0
                            
                            # Check if this time matches ANY of the event times - EXACT HOUR MATCH
                            matches_event = any(found_hour == eh for eh in event_hours)
                            
                            if not matches_event:
                                # Format the time for message
                                time_str_formatted = f"{found_time[0]}"
                                if found_time[1]:  # has minutes
                                    time_str_formatted += f":{found_time[1]}"
                                time_str_formatted += f" {raw_ampm}"
                                return time_str_formatted
                        return None
                    
                    # Get extra valid times for this gym (e.g. "8:30 AM" for early dropoff)
                    extra_time_rules = get_rules_for_gym(gym_id, event_type).get('time', [])
                    extra_time_values = [t['value'].lower().strip() for t in extra_time_rules]

                    # Check times in TITLE
                    title_time_mismatch = check_times_in_text(title, "title", char_limit=200)
                    if title_time_mismatch:
                        # Check if this time is an approved extra time for this gym
                        if title_time_mismatch.lower().strip() not in extra_time_values:
                            validation_errors.append({
                                "type": "time_mismatch",
                                "severity": "warning",
                                "category": "data_error",
                                "message": f"iClass time is {time_str} but title says {title_time_mismatch}"
                            })
                            print(f"    [!] TIME MISMATCH: iClass={time_str}, Title says {title_time_mismatch}")
                        else:
                            print(f"    [OK] Time {title_time_mismatch} is a valid extra time for {gym_id}")

                    # Check times in DESCRIPTION
                    desc_time_mismatch = check_times_in_text(description, "description", char_limit=300)
                    if desc_time_mismatch:
                        # Check if this time is an approved extra time for this gym
                        if desc_time_mismatch.lower().strip() not in extra_time_values:
                            validation_errors.append({
                                "type": "time_mismatch",
                                "severity": "warning",
                                "category": "data_error",
                                "message": f"iClass time is {time_str} but description says {desc_time_mismatch}"
                            })
                            print(f"    [!] TIME MISMATCH: iClass={time_str}, Description says {desc_time_mismatch}")
                        else:
                            print(f"    [OK] Time {desc_time_mismatch} is a valid extra time for {gym_id}")
            
            # --- AGE VALIDATION: Compare iClass age_min vs Title vs Description ---
            # All three should match (we only check MIN age because managers often use "Ages 5+")
            
            # Helper function to extract min age from text
            def extract_min_age(text, char_limit=300):
                """Extract the minimum age from text like 'Ages 5-12', 'Ages 5+', 'Age 5'"""
                if not text:
                    return None
                text_lower = text.lower()[:char_limit]
                age_patterns = re.findall(r'ages?\s*(\d{1,2})\s*[-–to+]|ages?\s*(\d{1,2})\b|(\d{1,2})\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)', text_lower)
                for age_match in age_patterns:
                    for group in age_match:
                        if group:
                            return int(group)
                return None
            
            # Extract ages from title and description
            title_age = extract_min_age(title, char_limit=200)
            desc_age = extract_min_age(description, char_limit=300)
            
            # Check 1: iClass age_min vs Title
            if age_min is not None and title_age is not None:
                if age_min != title_age:
                    validation_errors.append({
                        "type": "age_mismatch",
                        "severity": "warning",
                        "category": "data_error",
                        "message": f"iClass min age is {age_min} but title says {title_age}"
                    })
                    print(f"    [!] AGE MISMATCH: iClass age_min={age_min}, Title says {title_age}")
            
            # Check 2: iClass age_min vs Description
            if age_min is not None and desc_age is not None:
                if age_min != desc_age:
                    validation_errors.append({
                        "type": "age_mismatch",
                        "severity": "warning",
                        "category": "data_error",
                        "message": f"iClass min age is {age_min} but description says {desc_age}"
                    })
                    print(f"    [!] AGE MISMATCH: iClass age_min={age_min}, Description says {desc_age}")
            
            # Check 3: Title vs Description (even if iClass age_min is missing)
            if title_age is not None and desc_age is not None:
                if title_age != desc_age:
                    validation_errors.append({
                        "type": "age_mismatch",
                        "severity": "warning",
                        "category": "data_error",
                        "message": f"Title says age {title_age} but description says {desc_age}"
                    })
                    print(f"    [!] AGE MISMATCH: Title says {title_age}, Description says {desc_age}")
            
            # NOTE: MAX age validation not checked - managers often omit max age or use "+" notation
            
            # --- DAY OF WEEK VALIDATION: Compare calculated day to description ---
            # Skip for CAMP events - camps span multiple days so day mentions are expected
            if day_of_week and event_type != 'CAMP':
                day_lower = day_of_week.lower()  # e.g., "friday"
                # List of days to check (full names and abbreviations)
                all_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                day_abbrevs = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
                
                # Check first 200 chars for day mentions
                desc_snippet = description_lower[:200]
                
                # PRE-CLEAN: Remove day ranges like "Monday-Friday", "Mon-Fri", "Monday through Friday" before checking
                # These describe schedules, not the specific event day
                day_range_pattern = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*(?:[-–]|to|thru|through)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)'
                desc_snippet_cleaned = re.sub(day_range_pattern, '', desc_snippet)
                
                # Also remove parenthetical day ranges like "(Monday-Friday)"
                desc_snippet_cleaned = re.sub(r'\([^)]*(?:monday|mon)[-–][^)]*(?:friday|fri)[^)]*\)', '', desc_snippet_cleaned)
                
                day_abbrev_lower = day_lower[:3]  # e.g. "friday" → "fri"
                day_found = False
                for full, abbr in zip(all_days, day_abbrevs):
                    if full == day_lower or abbr == day_abbrev_lower:
                        continue
                    # Check full name first, then abbreviation with word boundary
                    if full in desc_snippet_cleaned or re.search(r'\b' + abbr + r'\b', desc_snippet_cleaned):
                        validation_errors.append({
                            "type": "day_mismatch",
                            "severity": "warning",
                            "category": "data_error",
                            "message": f"Event is on {day_of_week} but description says '{full.title()}'"
                        })
                        print(f"    ⚠️ DAY MISMATCH: Event is {day_of_week}, description says {full.title()}")
                        day_found = True
                        break
                if day_found:
                    pass
            
            # --- PROGRAM TYPE VALIDATION ---
            
            # First: Check iClass program type vs TITLE keywords
            # This catches: iClass says "CLINIC" but title says "Kids Night Out"
            kno_title_keywords = ['kids night out', "kid's night out", "kids' night out", 'kno', 'ninja night out']
            clinic_title_keywords = ['clinic']
            open_gym_title_keywords = ['open gym']
            # Add program_synonym rules from gym_valid_values for dynamic keyword matching
            synonym_rules = get_rules_for_gym(gym_id, event_type).get('program_synonym', [])
            for rule in synonym_rules:
                target = rule.get('label', '').upper()
                keyword = rule.get('value', '').lower()
                if not keyword:
                    continue
                if target == 'OPEN GYM' and keyword not in open_gym_title_keywords:
                    open_gym_title_keywords.append(keyword)
                elif target == 'KIDS NIGHT OUT' and keyword not in kno_title_keywords:
                    kno_title_keywords.append(keyword)
                elif target == 'CLINIC' and keyword not in clinic_title_keywords:
                    clinic_title_keywords.append(keyword)

            title_has_kno = any(kw in title_lower for kw in kno_title_keywords)
            title_has_clinic = any(kw in title_lower for kw in clinic_title_keywords)
            title_has_open_gym = any(kw in title_lower for kw in open_gym_title_keywords)
            
            # Check: iClass type vs Title keywords
            if event_type == 'KIDS NIGHT OUT' and title_has_clinic and not title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says KNO but title says 'Clinic'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=KNO, Title says Clinic")
            
            if event_type == 'KIDS NIGHT OUT' and title_has_open_gym and not title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says KNO but title says 'Open Gym'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=KNO, Title says Open Gym")
            
            if event_type == 'CLINIC' and title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says CLINIC but title says 'Kids Night Out'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=CLINIC, Title says KNO")
            
            if event_type == 'CLINIC' and title_has_open_gym and not title_has_clinic:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says CLINIC but title says 'Open Gym'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=CLINIC, Title says Open Gym")
            
            if event_type == 'OPEN GYM' and title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says OPEN GYM but title says 'Kids Night Out'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=OPEN GYM, Title says KNO")
            
            if event_type == 'OPEN GYM' and title_has_clinic and not title_has_open_gym:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "iClass says OPEN GYM but title says 'Clinic'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=OPEN GYM, Title says Clinic")
            
            # Now check iClass type vs DESCRIPTION (existing code)
            if event_type == 'KIDS NIGHT OUT':
                # KNO: Must contain "kids night out" (any apostrophe style) or "kno"
                # Strip apostrophes to handle: Kids Night Out, Kid's Night Out, Kids' Night Out
                desc_no_apostrophes = description_lower.replace("'", "").replace("'", "").replace("`", "")
                has_kno = ('kids night out' in desc_no_apostrophes or 
                          'kid night out' in desc_no_apostrophes or
                          'kno' in description_lower)
                has_clinic = 'clinic' in description_lower[:100]  # Check start only
                
                if has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "KNO event but description says 'Clinic'"
                    })
                    print(f"    🚨 KNO: Description says 'Clinic' - wrong program!")
            
            elif event_type == 'CLINIC':
                # CLINIC: Must contain "clinic", check for skill mismatch, should NOT say KNO/Open Gym
                has_clinic = 'clinic' in description_lower
                # Check for any variation of kids night out
                desc_start_no_apos = description_lower[:100].replace("'", "").replace("'", "")
                has_kno = ('kids night out' in desc_start_no_apos or 
                          'kid night out' in desc_start_no_apos or 
                          description_lower[:50].startswith('kno'))
                has_open_gym = description_lower[:100].startswith('open gym')
                
                if has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "CLINIC event but description says 'Kids Night Out'"
                    })
                    print(f"    🚨 CLINIC: Description says 'Kids Night Out' - wrong program!")
                
                if has_open_gym:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "CLINIC event but description starts with 'Open Gym'"
                    })
                    print(f"    🚨 CLINIC: Description starts with 'Open Gym' - wrong program!")
                
                # Check for SKILL MISMATCH
                # Use the same comprehensive skills list as the completeness check
                skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling', 
                         'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend', 
                         'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'tumbl', 'bridge', 
                         'kickover', 'walkover', 'flip flop', 'flip-flop', 'back walkover', 'front walkover']
                
                title_skill = None
                desc_skill = None
                
                for skill in skills:
                    if skill in title_lower:
                        title_skill = skill
                        break
                
                # Check first 100 chars of description for a skill
                desc_start = description_lower[:150]
                for skill in skills:
                    if skill in desc_start:
                        desc_skill = skill
                        break
                
                # Flag if BOTH have a skill and they're DIFFERENT
                if title_skill and desc_skill and title_skill != desc_skill:
                    # Handle "back handspring" vs "backhandspring"
                    title_normalized = title_skill.replace(' ', '')
                    desc_normalized = desc_skill.replace(' ', '')
                    if title_normalized != desc_normalized:
                        validation_errors.append({
                            "type": "skill_mismatch",
                            "severity": "error",
                            "category": "data_error",
                            "message": f"Title says '{title_skill}' but description says '{desc_skill}'"
                        })
                        print(f"    🚨 SKILL MISMATCH: Title '{title_skill}' vs Description '{desc_skill}'")
            
            elif event_type == 'OPEN GYM':
                # OPEN GYM: Must contain "open gym" or variations, should NOT say Clinic or KNO
                # Program synonym rules from gym_valid_values replace hardcoded keywords
                has_open_gym = (
                    'open gym' in description_lower or
                    'play and explore the gym' in description_lower or
                    'open to all' in description_lower
                )
                # Also check program_synonym rules for this gym that map to OPEN GYM
                if not has_open_gym:
                    og_synonym_rules = get_rules_for_gym(gym_id, event_type).get('program_synonym', [])
                    for rule in og_synonym_rules:
                        if rule.get('label', '').upper() == 'OPEN GYM' and rule.get('value', '').lower() in description_lower:
                            has_open_gym = True
                            break
                has_clinic = description_lower[:100].startswith('clinic') or 'clinic' in description_lower[:50]
                # Check for any variation of kids night out
                desc_start_no_apos = description_lower[:100].replace("'", "").replace("'", "")
                has_kno = ('kids night out' in desc_start_no_apos or 
                          'kid night out' in desc_start_no_apos)
                
                if has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "OPEN GYM event but description says 'Clinic'"
                    })
                    print(f"    🚨 OPEN GYM: Description says 'Clinic' - wrong program!")
                
                if has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "OPEN GYM event but description says 'Kids Night Out'"
                    })
                    print(f"    🚨 OPEN GYM: Description says 'Kids Night Out' - wrong program!")
            
            elif event_type == 'CAMP':
                # CAMP: Check for major program type mismatches
                # CAMPs might mention "open gym" or "ninja" as activities - that's OK
                # But if description STARTS with "Clinic" or "Kids Night Out", that's wrong
                has_clinic_start = description_lower[:50].startswith('clinic')
                desc_start_no_apos = description_lower[:100].replace("'", "").replace("'", "")
                has_kno_start = (desc_start_no_apos.startswith('kids night out') or 
                                desc_start_no_apos.startswith('kid night out') or
                                description_lower[:50].startswith('kno '))
                
                if has_clinic_start:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "CAMP event but description starts with 'Clinic'"
                    })
                    print(f"    🚨 CAMP: Description starts with 'Clinic' - wrong program!")
                
                if has_kno_start:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "CAMP event but description starts with 'Kids Night Out'"
                    })
                    print(f"    🚨 CAMP: Description starts with 'Kids Night Out' - wrong program!")
                
                # Check if title says Clinic or KNO but iClass says CAMP
                if title_has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "iClass says CAMP but title says 'Kids Night Out'"
                    })
                    print(f"    [!] PROGRAM MISMATCH: iClass=CAMP, Title says KNO")
                
                if title_has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": "iClass says CAMP but title says 'Clinic'"
                    })
                    print(f"    [!] PROGRAM MISMATCH: iClass=CAMP, Title says Clinic")
            
            # --- TITLE vs DESCRIPTION CROSS-CHECK (applies to ALL events) ---
            # This catches copy/paste errors regardless of which iClassPro page the event is on
            
            # Check what program keywords are in the TITLE
            title_no_apos = title_lower.replace("'", "").replace("'", "")
            title_has_clinic = 'clinic' in title_lower
            title_has_kno = ('kids night out' in title_no_apos or 
                            'kid night out' in title_no_apos or
                            title_lower.startswith('kno ') or ' kno ' in title_lower)
            title_has_open_gym = 'open gym' in title_lower
            # Also check program_synonym rules for this gym that map to OPEN GYM
            if not title_has_open_gym:
                og_syn_rules = get_rules_for_gym(gym_id, event_type).get('program_synonym', [])
                for rule in og_syn_rules:
                    if rule.get('label', '').upper() == 'OPEN GYM' and rule.get('value', '').lower() in title_lower:
                        title_has_open_gym = True
                        break

            # Check what program keywords are in the DESCRIPTION (first 150 chars)
            desc_start = description_lower[:150]
            desc_start_no_apos = desc_start.replace("'", "").replace("'", "")
            desc_has_clinic = 'clinic' in desc_start
            desc_has_kno = ('kids night out' in desc_start_no_apos or 
                           'kid night out' in desc_start_no_apos or
                           desc_start.startswith('kno '))
            desc_has_open_gym = desc_start.startswith('open gym')
            
            # Cross-check: Title says Clinic but Description says KNO
            if title_has_clinic and desc_has_kno:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Clinic' but description says 'Kids Night Out'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Clinic' but description says 'Kids Night Out'")
            
            # Cross-check: Title says KNO but Description says Clinic
            if title_has_kno and desc_has_clinic:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Kids Night Out' but description says 'Clinic'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'KNO' but description says 'Clinic'")
            
            # Cross-check: Title says Open Gym but Description says KNO
            if title_has_open_gym and desc_has_kno:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Open Gym' but description says 'Kids Night Out'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Open Gym' but description says 'Kids Night Out'")
            
            # Cross-check: Title says KNO but Description starts with Open Gym
            if title_has_kno and desc_has_open_gym:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Kids Night Out' but description starts with 'Open Gym'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'KNO' but description starts with 'Open Gym'")
            
            # Cross-check: Title says Clinic but Description starts with Open Gym
            if title_has_clinic and desc_has_open_gym:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Clinic' but description starts with 'Open Gym'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Clinic' but description starts with 'Open Gym'")
            
            # Cross-check: Title says Open Gym but Description says Clinic
            if title_has_open_gym and desc_has_clinic:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "category": "data_error",
                    "message": "Title says 'Open Gym' but description says 'Clinic'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Open Gym' but description says 'Clinic'")
            
            # --- PRICING VALIDATION ---
            # Extract all prices from title and description
            title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title)
            desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description)
            
            # Rule: If price in BOTH title and description, title price must appear somewhere in description
            if title_prices and desc_prices:
                title_price = float(title_prices[0])
                desc_price_floats = [float(p) for p in desc_prices]
                # Title price is valid if it matches ANY price in the description (within $1 tolerance)
                title_price_found = any(abs(title_price - dp) <= 1 for dp in desc_price_floats)
                if not title_price_found:
                    validation_errors.append({
                        "type": "price_mismatch",
                        "severity": "error",
                        "category": "data_error",
                        "message": f"Title says ${title_price:.0f} but description prices are {', '.join(['$' + p for p in desc_prices])}"
                    })
                    print(f"    ❌ PRICE MISMATCH: Title ${title_price:.0f} not found in description prices: {', '.join(['$' + p for p in desc_prices])}")
            
            # --- CAMP PRICE VALIDATION (Full Day + Half Day, Daily + Weekly) ---
            # Checks if price in title OR description matches ANY valid camp price for this gym
            # Valid prices: full_day_daily, full_day_weekly, half_day_daily, half_day_weekly
            # Note: Some gyms don't offer half day (NULL values) - those are skipped
            # Check both title and description prices (some camps only have price in title)
            all_camp_prices = list(set(title_prices + desc_prices))  # Combine and dedupe
            if event_type == 'CAMP' and all_camp_prices:
                camp_pricing = get_camp_pricing()
                if gym_id in camp_pricing:
                    gym_prices = camp_pricing[gym_id]
                    
                    # Build list of all valid prices for this gym (skip NULL values)
                    valid_prices = []
                    price_labels = []
                    
                    if gym_prices.get('full_day_daily'):
                        valid_prices.append(float(gym_prices['full_day_daily']))
                        price_labels.append(f"Full Day Daily ${gym_prices['full_day_daily']}")
                    if gym_prices.get('full_day_weekly'):
                        valid_prices.append(float(gym_prices['full_day_weekly']))
                        price_labels.append(f"Full Day Weekly ${gym_prices['full_day_weekly']}")
                    if gym_prices.get('half_day_daily'):
                        valid_prices.append(float(gym_prices['half_day_daily']))
                        price_labels.append(f"Half Day Daily ${gym_prices['half_day_daily']}")
                    if gym_prices.get('half_day_weekly'):
                        valid_prices.append(float(gym_prices['half_day_weekly']))
                        price_labels.append(f"Half Day Weekly ${gym_prices['half_day_weekly']}")

                    # Also add any extra valid prices from gym_valid_values table
                    # (e.g. Before Care $20, After Care $20 - per-gym rules)
                    extra_price_rules = get_rules_for_gym(gym_id, event_type).get('price', [])
                    for ep in extra_price_rules:
                        try:
                            extra_price = float(ep['value'])
                            if extra_price not in valid_prices:
                                valid_prices.append(extra_price)
                                price_labels.append(f"{ep.get('label', 'Custom')} ${ep['value']}")
                        except (ValueError, TypeError):
                            pass

                    if valid_prices:
                        # Check each price found in title or description
                        for camp_price_str in all_camp_prices:
                            camp_price = float(camp_price_str)
                            
                            # Check if price matches any valid price (with $2 tolerance for rounding)
                            is_valid = any(abs(camp_price - vp) <= 2 for vp in valid_prices)
                            
                            if not is_valid:
                                validation_errors.append({
                                    "type": "camp_price_mismatch",
                                    "severity": "warning",
                                    "category": "data_error",
                                    "message": f"Camp price ${camp_price:.0f} doesn't match any valid price for {gym_id}. Valid: {', '.join(price_labels)}"
                                })
                                print(f"    ⚠️ CAMP PRICE: ${camp_price:.0f} not valid for {gym_id}. Expected one of: {', '.join(price_labels)}")
                                break  # Only flag once per event
            
            # --- EVENT PRICE VALIDATION (Clinic, KNO, Open Gym) ---
            # Checks if the expected price from event_pricing table appears ANYWHERE in the title OR description
            # Uses effective_date to automatically use correct price (handles price increases)
            # Approach: Instead of extracting one price and comparing, check if ANY valid price
            # from Supabase appears in the text. This avoids false positives when descriptions
            # have multiple prices (e.g., "$45 for 1 child, $40 for siblings").
            # NOTE: Checks title+description combined (not just description) so gyms that only
            # put prices in titles (like CCP, CPF) still get validated.
            if event_type in ['CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']:
                event_pricing = get_event_pricing()
                if gym_id in event_pricing and event_type in event_pricing[gym_id]:
                    valid_prices = event_pricing[gym_id][event_type]

                    # Also add any extra valid prices from gym_valid_values table
                    extra_price_rules = get_rules_for_gym(gym_id, event_type).get('price', [])
                    for ep in extra_price_rules:
                        try:
                            extra_price = float(ep['value'])
                            if extra_price not in valid_prices:
                                valid_prices.append(extra_price)
                        except (ValueError, TypeError):
                            pass

                    if valid_prices:
                        # Combine prices from BOTH title and description (not just description)
                        # This fixes a bug where gyms that only put prices in titles
                        # (like CCP, CPF) were never getting price-validated
                        all_event_prices = list(set(title_prices + desc_prices))

                        if all_event_prices:
                            # Prices found in text — check if any match expected
                            all_found_prices = set(float(p) for p in all_event_prices)
                            expected_price_found = any(
                                any(abs(found - vp) <= 1 for found in all_found_prices)
                                for vp in valid_prices
                            )

                            if not expected_price_found:
                                valid_str = ', '.join([f'${p:.0f}' for p in valid_prices])
                                found_str = ', '.join([f'${p}' for p in all_event_prices])
                                validation_errors.append({
                                    "type": "event_price_mismatch",
                                    "severity": "error",
                                    "category": "data_error",
                                    "message": f"{event_type} price {found_str} doesn't match expected price for {gym_id}. Valid: {valid_str}"
                                })
                                print(f"    ❌ {event_type} PRICE: Expected {valid_str} not found for {gym_id}. Found in text: {found_str}")
                        # else: No prices found in text at all — already caught by
                        # missing_price_in_description (FORMAT error). No need to double-flag.
        
        # ========== AVAILABILITY INFO ==========
        # NOTE: Sold out is NOT a validation error - it's informational status
        # The has_openings field is saved separately and displays "FULL" badge
        # We do NOT add sold_out to validation_errors (it's not an audit issue)
        
        # Check if registration has closed but event is still in the future
        if registration_end_date and start_date:
            try:
                reg_end = datetime.strptime(registration_end_date, "%Y-%m-%d").date()
                event_start = datetime.strptime(start_date, "%Y-%m-%d").date()
                today = date.today()
                
                # Registration closed but event hasn't happened yet
                if reg_end < today and event_start >= today:
                    validation_errors.append({
                        "type": "registration_closed",
                        "severity": "warning",
                        "category": "status",
                        "message": f"Registration closed on {registration_end_date} but event is {start_date}"
                    })
                    print(f"    ⚠️ REGISTRATION CLOSED: Ended {registration_end_date}, event on {start_date}")
            except (ValueError, TypeError):
                pass  # Invalid date format, skip
        
        # Check if registration hasn't opened yet
        if registration_start_date and start_date:
            try:
                reg_start = datetime.strptime(registration_start_date, "%Y-%m-%d").date()
                today = date.today()
                
                if reg_start > today:
                    validation_errors.append({
                        "type": "registration_not_open",
                        "severity": "info",
                        "category": "status",
                        "message": f"Registration opens {registration_start_date}"
                    })
                    print(f"    ℹ️ REGISTRATION NOT OPEN YET: Opens {registration_start_date}")
            except (ValueError, TypeError):
                pass  # Invalid date format, skip
        
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
            "end_date": (ev.get("endDate") or start_date),
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
            # Availability tracking from iClassPro
            "has_openings": has_openings,
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
            format_errors = sum(1 for e in all_errors if e.get("category") == "formatting")
            status_errors = sum(1 for e in all_errors if e.get("category") == "status")
            
            print(f"\n{'='*60}")
            print(f"📊 VALIDATION SUMMARY: {len(processed)} events checked, {len(all_errors)} total errors found")
            print(f"   🚨 DATA errors (wrong info): {data_errors}")
            print(f"   ⚠️  FORMAT errors (missing info): {format_errors}")
            print(f"   ℹ️  STATUS errors: {status_errors}")
            print(f"   Breakdown by type:")
            for err_type, count in sorted(error_counts.items(), key=lambda x: -x[1]):
                print(f"     - {err_type}: {count}")
            print(f"{'='*60}\n")
        else:
            print(f"\n✅ VALIDATION SUMMARY: {len(processed)} events checked, 0 errors found\n")
    
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
