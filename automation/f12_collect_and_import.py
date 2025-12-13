#!/usr/bin/env python3
"""
F12 Event Collection Script
Uses Playwright to intercept /camps/{id} detail calls (like the working script)
"""

import asyncio
import json
import re
import html
from datetime import datetime, date
from urllib.request import Request, urlopen
from playwright.async_api import async_playwright

# Supabase configuration
SUPABASE_URL = "https://xftiwouxpefchwoxxgpf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4"

# Gym data
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
    'TIG': {'name': 'Tigar Gymnastics', 'slug': 'tigar'}
}

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
    """
    captured_events = []
    seen_ids = set()
    
    async def handle_response(response):
        nonlocal captured_events, seen_ids
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
        except Exception:
            return
        
        if "application/json" not in content_type:
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
        await page.wait_for_timeout(5000)  # Increased from 3000
        await asyncio.sleep(2)  # Increased from 1
        
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
    
    async def handle_response(response):
        """Intercept /camps/{id} detail calls (NOT search calls)"""
        nonlocal captured_events, seen_ids, all_responses
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
            status = response.status
            
            # Debug: track all /camps/ responses
            if "/camps/" in response_url:
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
        
        # We want detail calls like /camps/2106, NOT the ? query
        # So require "/camps/" and NO "?" in the URL.
        if "/camps/" in response_url and "?" not in response_url:
            print(f"[DEBUG] Processing detail call: {response_url}")
            try:
                body = await response.json()  # FIX: await the async call
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
        await page.wait_for_timeout(3000)  # Wait longer for async handlers to complete
        
        # Give async handlers time to finish processing
        import asyncio
        await asyncio.sleep(1)
        
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
        
        # 4) time from schedule
        time_str = "10:00 AM - 11:30 AM"  # default
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
        
        # Extract price from title or description
        price = None
        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', title)
        if price_match:
            price = float(price_match.group(1))
        else:
            # Try description if available
            description_html = ev.get('description', '')
            if description_html:
                price_match = re.search(r'\$(\d+(?:\.\d{2})?)', description_html)
                if price_match:
                    price = float(price_match.group(1))
        
        # Calculate day_of_week from start_date
        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            day_of_week = event_date.strftime("%A")  # Monday, Tuesday, etc.
        except (ValueError, AttributeError):
            day_of_week = None
        
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
        age_min = ev.get("minAge")
        age_max = ev.get("maxAge")
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
        
        # Determine description status and validation errors
        description_status = 'unknown'
        validation_errors = []
        
        if not description and not has_flyer:
            description_status = 'none'
        elif has_flyer and not description:
            description_status = 'flyer_only'
        elif description:
            description_status = 'full'
        
        # ========== SMART VALIDATION (KNO, CLINIC, OPEN GYM only - skip CAMP) ==========
        event_type = camp_type_label.upper()
        
        if description and event_type != 'CAMP':
            description_lower = description.lower()
            title_lower = title.lower()
            
            # --- DATE VALIDATION: Compare structured date to description ---
            # Extract month from structured start_date
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d")
                event_month = event_date.strftime("%B").lower()  # e.g., "january"
                event_day = event_date.day
                
                # Check if description mentions a DIFFERENT month
                import calendar
                all_months = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
                
                for month_name, month_num in all_months.items():
                    if month_name in description_lower and month_name != event_month:
                        # Found a different month - check if it's prominent (in first 200 chars)
                        if month_name in description_lower[:200]:
                            validation_errors.append({
                                "type": "date_mismatch",
                                "severity": "error",
                                "message": f"Event is {event_month.title()} {event_day} but description says '{month_name.title()}'"
                            })
                            print(f"    🚨 DATE MISMATCH: Event is {event_month.title()}, description says {month_name.title()}")
                            break
            except ValueError:
                pass  # Invalid date format, skip
            
            # --- TIME VALIDATION: Compare structured time to description ---
            if time_str:
                # Extract ALL hours from structured time (e.g., "6:30 PM - 9:30 PM" -> [6, 9])
                event_times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(am|pm)?', time_str.lower())
                event_hours = set()
                for et in event_times:
                    if et[0]:
                        hour = int(et[0])
                        ampm = et[2] or ''
                        # Convert to 24hr
                        if ampm == 'pm' and hour != 12:
                            hour += 12
                        elif ampm == 'am' and hour == 12:
                            hour = 0
                        event_hours.add(hour)
                
                if event_hours:
                    # Look for times in description (first 250 chars)
                    desc_times = re.findall(r'(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)', description_lower[:250])
                    
                    for desc_time in desc_times:
                        desc_hour = int(desc_time[0])
                        desc_ampm = desc_time[2].replace('.', '') if desc_time[2] else ''
                        
                        # Convert to 24hr
                        if desc_ampm == 'pm' and desc_hour != 12:
                            desc_hour += 12
                        elif desc_ampm == 'am' and desc_hour == 12:
                            desc_hour = 0
                        
                        # Check if this time matches ANY of the event times (start OR end)
                        matches_event = any(abs(desc_hour - eh) <= 1 for eh in event_hours)
                        
                        if not matches_event:
                            # This description time doesn't match start or end
                            validation_errors.append({
                                "type": "time_mismatch",
                                "severity": "warning",
                                "message": f"Event time is {time_str} but description mentions {desc_time[0]}:{desc_time[1]} {desc_time[2]}"
                            })
                            print(f"    ⚠️ TIME MISMATCH: Event is {time_str}, description says {desc_time[0]}:{desc_time[1]} {desc_time[2]}")
                            break
            
            # --- AGE VALIDATION: Compare structured MIN age to description ---
            if age_min is not None:
                # Look for age patterns in description (first 250 chars)
                age_patterns = re.findall(r'ages?\s*(\d{1,2})\s*[-–to]+\s*\d{1,2}|ages?\s*(\d{1,2})\+?', description_lower[:250])
                
                for age_match in age_patterns:
                    desc_age_min = int(age_match[0]) if age_match[0] else (int(age_match[1]) if age_match[1] else None)
                    
                    if desc_age_min is not None:
                        # Check for mismatch (2+ years off on min age)
                        if abs(age_min - desc_age_min) >= 2:
                            validation_errors.append({
                                "type": "age_mismatch",
                                "severity": "warning",
                                "message": f"Event min age is {age_min} but description says {desc_age_min}"
                            })
                            print(f"    ⚠️ AGE MISMATCH: Event min age is {age_min}, description says {desc_age_min}")
                            break
            
            # --- PROGRAM TYPE VALIDATION ---
            
            if event_type == 'KIDS NIGHT OUT':
                # KNO: Must contain "kids night out" or "kno", should NOT say "clinic"
                has_kno = 'kids night out' in description_lower or 'kno' in description_lower or "kids' night out" in description_lower
                has_clinic = 'clinic' in description_lower[:100]  # Check start only
                
                if not has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "warning",
                        "message": "KNO event but description doesn't mention 'Kids Night Out' or 'KNO'"
                    })
                    print(f"    ⚠️ KNO: Description missing 'Kids Night Out' or 'KNO'")
                
                if has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "KNO event but description says 'Clinic'"
                    })
                    print(f"    🚨 KNO: Description says 'Clinic' - wrong program!")
            
            elif event_type == 'CLINIC':
                # CLINIC: Must contain "clinic", check for skill mismatch, should NOT say KNO/Open Gym
                has_clinic = 'clinic' in description_lower
                has_kno = 'kids night out' in description_lower[:100] or description_lower[:50].startswith('kno')
                has_open_gym = description_lower[:100].startswith('open gym')
                
                if not has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "warning",
                        "message": "CLINIC event but description doesn't mention 'Clinic'"
                    })
                    print(f"    ⚠️ CLINIC: Description missing 'Clinic'")
                
                if has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "CLINIC event but description says 'Kids Night Out'"
                    })
                    print(f"    🚨 CLINIC: Description says 'Kids Night Out' - wrong program!")
                
                if has_open_gym:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "CLINIC event but description starts with 'Open Gym'"
                    })
                    print(f"    🚨 CLINIC: Description starts with 'Open Gym' - wrong program!")
                
                # Check for SKILL MISMATCH
                skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling', 
                         'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend', 
                         'ninja', 'cheer', 'beam', 'vault', 'floor']
                
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
                            "message": f"Title says '{title_skill}' but description says '{desc_skill}'"
                        })
                        print(f"    🚨 SKILL MISMATCH: Title '{title_skill}' vs Description '{desc_skill}'")
            
            elif event_type == 'OPEN GYM':
                # OPEN GYM: Must contain "open gym" or variations, should NOT say Clinic or KNO
                # Some gyms call it "Gym Fun Fridays", "Preschool Fun Gym", "Fun Gym", etc.
                has_open_gym = (
                    'open gym' in description_lower or
                    'fun gym' in description_lower or
                    'gym fun' in description_lower or
                    'preschool fun' in description_lower or
                    'play and explore the gym' in description_lower or
                    'open to all' in description_lower
                )
                has_clinic = description_lower[:100].startswith('clinic') or 'clinic' in description_lower[:50]
                has_kno = 'kids night out' in description_lower[:100]
                
                if not has_open_gym:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "warning",
                        "message": "OPEN GYM event but description doesn't mention 'Open Gym' or similar"
                    })
                    print(f"    ⚠️ OPEN GYM: Description missing 'Open Gym' or similar")
                
                if has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "OPEN GYM event but description says 'Clinic'"
                    })
                    print(f"    🚨 OPEN GYM: Description says 'Clinic' - wrong program!")
                
                if has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "OPEN GYM event but description says 'Kids Night Out'"
                    })
                    print(f"    🚨 OPEN GYM: Description says 'Kids Night Out' - wrong program!")
        
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
        })
    
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
