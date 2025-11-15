#!/usr/bin/env python3
"""
F12 Event Collection Script
Uses Playwright to intercept /camps/{id} detail calls (like the working script)
"""

import asyncio
import json
import re
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
    "camps": "SCHOOL YEAR CAMP",
    "camps_holiday": "SCHOOL YEAR CAMP",
    "special_events": "SPECIAL EVENT"
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

# Cache for EVENT_TYPE_URLS
_EVENT_TYPE_URLS_CACHE = None

def get_event_type_urls():
    """Get EVENT_TYPE_URLS (cached)"""
    global _EVENT_TYPE_URLS_CACHE
    if _EVENT_TYPE_URLS_CACHE is None:
        _EVENT_TYPE_URLS_CACHE = fetch_event_type_urls()
    return _EVENT_TYPE_URLS_CACHE

async def collect_events_via_f12(gym_id, camp_type):
    """
    Opens the camp listing page and collects JSON from /camps/<id> detail calls.
    (EXACT same approach as the working script)
    
    Returns:
        events_raw: list of event dicts (one per event)
    """
    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return []
    
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
        
        # Extract description (clean HTML, keep text content)
        description = ev.get("description", "")
        if description:
            # Remove HTML tags but keep text content
            description = re.sub(r'<[^>]+>', '', description)
            # Clean up whitespace
            description = " ".join(description.split())
            # Limit length to avoid huge descriptions
            if len(description) > 1000:
                description = description[:1000] + "..."
        else:
            description = None
        
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
            "age_min": ev.get("minAge"),
            "age_max": ev.get("maxAge"),
            "day_of_week": day_of_week,
            "description": description,
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
