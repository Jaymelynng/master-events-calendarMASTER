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
        title_lower = title.lower()
        description_lower = description.lower() if description else ''
        
        # ========== COMPLETENESS CHECKS (ALL event types including CAMP) ==========
        # These check if REQUIRED fields EXIST (not just if they're accurate)
        
        if True:  # Now includes ALL event types (CAMP, KNO, CLINIC, OPEN GYM)
            
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
                # Match: "6:30pm", "6:30 pm", "6pm", "6 pm", "6:30p", "6:30 p.m."
                return bool(re.search(r'\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)', txt))
            
            # 1. TITLE: Must have AGE
            if not has_age_in_text(title):
                validation_errors.append({
                    "type": "missing_age_in_title",
                    "severity": "warning",
                    "message": "Title missing age (e.g., 'Ages 5+')"
                })
                print(f"    [!] COMPLETENESS: Title missing age")
            
            # 2. TITLE: Must have DATE
            if not has_date_in_text(title):
                validation_errors.append({
                    "type": "missing_date_in_title",
                    "severity": "warning",
                    "message": "Title missing date (e.g., 'January 9th')"
                })
                print(f"    [!] COMPLETENESS: Title missing date")
            
            # --- DESCRIPTION COMPLETENESS ---
            
            if description:
                # 3. DESCRIPTION: Must have AGE
                if not has_age_in_text(description):
                    validation_errors.append({
                        "type": "missing_age_in_description",
                        "severity": "warning",
                        "message": "Description missing age"
                    })
                    print(f"    [!] COMPLETENESS: Description missing age")
                
                # 4. DESCRIPTION: Must have DATE or TIME
                if not has_date_in_text(description) and not has_time_in_text(description):
                    validation_errors.append({
                        "type": "missing_datetime_in_description",
                        "severity": "warning",
                        "message": "Description missing date/time"
                    })
                    print(f"    [!] COMPLETENESS: Description missing date/time")
                
                # 5. DESCRIPTION: Must have TIME (required per standardization doc)
                if not has_time_in_text(description):
                    validation_errors.append({
                        "type": "missing_time_in_description",
                        "severity": "warning",
                        "message": "Description missing specific time (e.g., '6:30pm')"
                    })
                    print(f"    [!] COMPLETENESS: Description missing time")
            
            # --- PROGRAM-SPECIFIC COMPLETENESS ---
            
            # CLINIC: Should mention skill in description
            if event_type == 'CLINIC' and description:
                skills = ['cartwheel', 'back handspring', 'backhandspring', 'handstand', 'tumbling', 
                         'bars', 'pullover', 'pullovers', 'front flip', 'roundoff', 'backbend', 
                         'ninja', 'cheer', 'beam', 'vault', 'floor', 'trampoline', 'bridge', 'kickover',
                         'walkover', 'flip flop', 'flip-flop']
                has_skill = any(skill in description_lower for skill in skills)
                if not has_skill:
                    validation_errors.append({
                        "type": "clinic_missing_skill",
                        "severity": "info",
                        "message": "Clinic description doesn't mention specific skill"
                    })
                    print(f"    [i] COMPLETENESS: Clinic missing skill mention")
        
        # ========== ACCURACY CHECKS (Compare values across sources) ==========
        # These check if values MATCH when they exist in multiple places
        # Now includes ALL event types (CAMP, KNO, CLINIC, OPEN GYM)
        
        if description:
            
            # --- DATE/MONTH VALIDATION: Compare structured date to description ---
            # Extract month from structured start_date
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d")
                event_month = event_date.strftime("%B").lower()  # e.g., "january"
                event_year = event_date.year
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
                        """Check if times in text match event times"""
                        text_lower = text.lower()[:char_limit]
                        found_times = re.findall(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)', text_lower)
                        
                        for found_time in found_times:
                            found_hour = int(found_time[0])
                            found_ampm = found_time[2].replace('.', '') if found_time[2] else ''
                            
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
                                time_str_formatted += f" {found_time[2]}"
                                return time_str_formatted
                        return None
                    
                    # Check times in TITLE
                    title_time_mismatch = check_times_in_text(title, "title", char_limit=200)
                    if title_time_mismatch:
                        validation_errors.append({
                            "type": "time_mismatch",
                            "severity": "warning",
                            "message": f"iClass time is {time_str} but title says {title_time_mismatch}"
                        })
                        print(f"    [!] TIME MISMATCH: iClass={time_str}, Title says {title_time_mismatch}")
                    
                    # Check times in DESCRIPTION
                    desc_time_mismatch = check_times_in_text(description, "description", char_limit=300)
                    if desc_time_mismatch:
                        validation_errors.append({
                            "type": "time_mismatch",
                            "severity": "warning",
                            "message": f"iClass time is {time_str} but description says {desc_time_mismatch}"
                        })
                        print(f"    [!] TIME MISMATCH: iClass={time_str}, Description says {desc_time_mismatch}")
            
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
                        "message": f"iClass min age is {age_min} but title says {title_age}"
                    })
                    print(f"    [!] AGE MISMATCH: iClass age_min={age_min}, Title says {title_age}")
            
            # Check 2: iClass age_min vs Description
            if age_min is not None and desc_age is not None:
                if age_min != desc_age:
                    validation_errors.append({
                        "type": "age_mismatch",
                        "severity": "warning",
                        "message": f"iClass min age is {age_min} but description says {desc_age}"
                    })
                    print(f"    [!] AGE MISMATCH: iClass age_min={age_min}, Description says {desc_age}")
            
            # Check 3: Title vs Description (even if iClass age_min is missing)
            if title_age is not None and desc_age is not None:
                if title_age != desc_age:
                    validation_errors.append({
                        "type": "age_mismatch",
                        "severity": "warning",
                        "message": f"Title says age {title_age} but description says {desc_age}"
                    })
                    print(f"    [!] AGE MISMATCH: Title says {title_age}, Description says {desc_age}")
            
            # NOTE: MAX age validation not checked - managers often omit max age or use "+" notation
            
            # --- DAY OF WEEK VALIDATION: Compare calculated day to description ---
            if day_of_week:
                day_lower = day_of_week.lower()  # e.g., "friday"
                # List of days to check
                all_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                
                # Check first 200 chars for day mentions
                desc_snippet = description_lower[:200]
                for check_day in all_days:
                    if check_day in desc_snippet and check_day != day_lower:
                        # Found a different day mentioned prominently
                        validation_errors.append({
                            "type": "day_mismatch",
                            "severity": "warning",
                            "message": f"Event is on {day_of_week} but description says '{check_day.title()}'"
                        })
                        print(f"    ⚠️ DAY MISMATCH: Event is {day_of_week}, description says {check_day.title()}")
                        break
            
            # --- PROGRAM TYPE VALIDATION ---
            
            # First: Check iClass program type vs TITLE keywords
            # This catches: iClass says "CLINIC" but title says "Kids Night Out"
            kno_title_keywords = ['kids night out', "kid's night out", "kids' night out", 'kno', 'ninja night out']
            clinic_title_keywords = ['clinic']
            open_gym_title_keywords = ['open gym', 'gym fun', 'fun gym', 'preschool fun', 'bonus tumbling']
            
            title_has_kno = any(kw in title_lower for kw in kno_title_keywords)
            title_has_clinic = any(kw in title_lower for kw in clinic_title_keywords)
            title_has_open_gym = any(kw in title_lower for kw in open_gym_title_keywords)
            
            # Check: iClass type vs Title keywords
            if event_type == 'KIDS NIGHT OUT' and title_has_clinic and not title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "message": "iClass says KNO but title says 'Clinic'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=KNO, Title says Clinic")
            
            if event_type == 'KIDS NIGHT OUT' and title_has_open_gym and not title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "message": "iClass says KNO but title says 'Open Gym'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=KNO, Title says Open Gym")
            
            if event_type == 'CLINIC' and title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "message": "iClass says CLINIC but title says 'Kids Night Out'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=CLINIC, Title says KNO")
            
            if event_type == 'CLINIC' and title_has_open_gym and not title_has_clinic:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "message": "iClass says CLINIC but title says 'Open Gym'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=CLINIC, Title says Open Gym")
            
            if event_type == 'OPEN GYM' and title_has_kno:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
                    "message": "iClass says OPEN GYM but title says 'Kids Night Out'"
                })
                print(f"    [!] PROGRAM MISMATCH: iClass=OPEN GYM, Title says KNO")
            
            if event_type == 'OPEN GYM' and title_has_clinic and not title_has_open_gym:
                validation_errors.append({
                    "type": "program_mismatch",
                    "severity": "error",
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
                # Check for any variation of kids night out
                desc_start_no_apos = description_lower[:100].replace("'", "").replace("'", "")
                has_kno = ('kids night out' in desc_start_no_apos or 
                          'kid night out' in desc_start_no_apos or 
                          description_lower[:50].startswith('kno'))
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
                # Check for any variation of kids night out
                desc_start_no_apos = description_lower[:100].replace("'", "").replace("'", "")
                has_kno = ('kids night out' in desc_start_no_apos or 
                          'kid night out' in desc_start_no_apos)
                
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
                        "message": "CAMP event but description starts with 'Clinic'"
                    })
                    print(f"    🚨 CAMP: Description starts with 'Clinic' - wrong program!")
                
                if has_kno_start:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "CAMP event but description starts with 'Kids Night Out'"
                    })
                    print(f"    🚨 CAMP: Description starts with 'Kids Night Out' - wrong program!")
                
                # Check if title says Clinic or KNO but iClass says CAMP
                if title_has_kno:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
                        "message": "iClass says CAMP but title says 'Kids Night Out'"
                    })
                    print(f"    [!] PROGRAM MISMATCH: iClass=CAMP, Title says KNO")
                
                if title_has_clinic:
                    validation_errors.append({
                        "type": "program_mismatch",
                        "severity": "error",
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
            title_has_open_gym = ('open gym' in title_lower or 
                                  'gym fun' in title_lower or
                                  'fun gym' in title_lower)
            
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
                    "message": "Title says 'Clinic' but description says 'Kids Night Out'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Clinic' but description says 'Kids Night Out'")
            
            # Cross-check: Title says KNO but Description says Clinic
            if title_has_kno and desc_has_clinic:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "message": "Title says 'Kids Night Out' but description says 'Clinic'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'KNO' but description says 'Clinic'")
            
            # Cross-check: Title says Open Gym but Description says KNO
            if title_has_open_gym and desc_has_kno:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "message": "Title says 'Open Gym' but description says 'Kids Night Out'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Open Gym' but description says 'Kids Night Out'")
            
            # Cross-check: Title says KNO but Description starts with Open Gym
            if title_has_kno and desc_has_open_gym:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "message": "Title says 'Kids Night Out' but description starts with 'Open Gym'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'KNO' but description starts with 'Open Gym'")
            
            # Cross-check: Title says Clinic but Description starts with Open Gym
            if title_has_clinic and desc_has_open_gym:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "message": "Title says 'Clinic' but description starts with 'Open Gym'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Clinic' but description starts with 'Open Gym'")
            
            # Cross-check: Title says Open Gym but Description says Clinic
            if title_has_open_gym and desc_has_clinic:
                validation_errors.append({
                    "type": "title_desc_mismatch",
                    "severity": "error",
                    "message": "Title says 'Open Gym' but description says 'Clinic'"
                })
                print(f"    🚨 TITLE/DESC MISMATCH: Title has 'Open Gym' but description says 'Clinic'")
            
            # --- PRICING VALIDATION ---
            # Extract all prices from title and description
            title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', title)
            desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', description)
            
            # Rule: Price MUST be in description
            if not desc_prices:
                validation_errors.append({
                    "type": "missing_price_in_description",
                    "severity": "error",
                    "message": "Price not found in description"
                })
                print(f"    ❌ MISSING PRICE: No $ found in description")
            
            # Rule: If price in BOTH title and description, they must match
            elif title_prices and desc_prices:
                title_price = float(title_prices[0])
                desc_price = float(desc_prices[0])
                if title_price != desc_price:
                    validation_errors.append({
                        "type": "price_mismatch",
                        "severity": "error",
                        "message": f"Title says ${title_price:.0f} but description says ${desc_price:.0f}"
                    })
                    print(f"    ❌ PRICE MISMATCH: Title ${title_price:.0f} vs Desc ${desc_price:.0f}")
        
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
