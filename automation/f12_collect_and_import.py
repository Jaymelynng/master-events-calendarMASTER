#!/usr/bin/env python3
"""
F12 Event Collection Script
Collects events from iClassPro portals using API calls
"""

import asyncio
import aiohttp
import json
import re
from datetime import datetime, date
from urllib.request import Request, urlopen

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
    Collect events for a specific gym and event type
    
    Args:
        gym_id: Gym ID (e.g., 'RBA', 'RBK')
        camp_type: Event type (e.g., 'KIDS NIGHT OUT', 'CLINIC')
    
    Returns:
        List of raw event dictionaries
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
    
    portal_url = event_type_urls[camp_type][gym_id]
    print(f"Collecting events from: {portal_url}")
    
    slug = GYMS[gym_id]['slug']
    events = []
    
    # Map event type to keywords for matching
    event_type_keywords = {
        'KIDS NIGHT OUT': ['KIDS NIGHT OUT', 'KNO', 'KID', 'NIGHT'],
        'CLINIC': ['CLINIC', 'SKILL'],
        'OPEN GYM': ['OPEN GYM', 'OPEN'],
        'SCHOOL YEAR CAMP': ['CAMP', 'SCHOOL YEAR'],
        'SPECIAL EVENT': ['SPECIAL', 'EVENT']
    }
    keywords = event_type_keywords.get(camp_type, [camp_type.upper()])
    
    async with aiohttp.ClientSession() as session:
        # Method 1: Use Open API v1 (gym-specific, more reliable)
        try:
            # Step 1: Get locations
            locations_url = f"https://app.iclasspro.com/api/open/v1/{slug}/locations"
            async with session.get(locations_url) as loc_response:
                if loc_response.status == 200:
                    loc_data = await loc_response.json()
                    locations = loc_data.get('data', [])
                    
                    for location in locations:
                        location_id = location.get('id') or location.get('locationId')
                        if not location_id:
                            continue
                        
                        # Step 2: Get programs for this location
                        programs_url = f"https://app.iclasspro.com/api/open/v1/{slug}/camp-programs/{location_id}"
                        async with session.get(programs_url) as prog_response:
                            if prog_response.status == 200:
                                prog_data = await prog_response.json()
                                programs = prog_data.get('data', [])
                                
                                for program in programs:
                                    program_name = program.get('name', '').upper()
                                    program_id = program.get('id')
                                    
                                    # Check if program name matches our event type
                                    name_matches = any(keyword in program_name for keyword in keywords)
                                    
                                    if name_matches and program_id:
                                        # Step 3: Get events for this program
                                        events_url = f"https://app.iclasspro.com/api/open/v1/{slug}/camps?locationId={location_id}&typeId={program_id}&limit=50&page=1&sortBy=time"
                                        async with session.get(events_url) as events_response:
                                            if events_response.status == 200:
                                                events_data = await events_response.json()
                                                camps = events_data.get('data', [])
                                                
                                                if camps:
                                                    events = camps
                                                    print(f"✅ Found {len(events)} events using Open API v1")
                                                    print(f"   Program: {program.get('name')} (ID: {program_id})")
                                                    break
                                
                                if events:
                                    break
                        
                        if events:
                            break
        except Exception as e:
            print(f"Open API v1 error: {str(e)[:100]}")
        
        # Method 2: Fallback to portal API (if Open API didn't work)
        if not events:
            print("Trying portal API as fallback...")
            match = re.search(r'/camps/(\d+)', portal_url)
            program_ids_to_try = []
            
            if match:
                program_id_from_url = int(match.group(1))
                program_ids_to_try.append(program_id_from_url)
                print(f"Extracted program ID {program_id_from_url} from URL")
            
            program_ids_to_try.extend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 102])
            program_ids_to_try = list(dict.fromkeys(program_ids_to_try))
            
            for program_id in program_ids_to_try:
                api_url = f"https://app.iclasspro.com/portal/api/camps/search?programId={program_id}"
                try:
                    async with session.get(api_url) as response:
                        if response.status == 200:
                            data = await response.json()
                            event_data = data.get('data', []) if isinstance(data, dict) else []
                            
                            if event_data and len(event_data) > 0:
                                # Filter by gym - check if event URLs contain our slug
                                filtered_events = []
                                for ev in event_data:
                                    ev_id = ev.get('id')
                                    if ev_id:
                                        # Check if this event belongs to our gym by checking URL pattern
                                        ev_url = f"https://portal.iclasspro.com/{slug}/camp-details/{ev_id}"
                                        # Also check campTypeName
                                        camp_type_name = data.get('campTypeName', '').upper() if isinstance(data, dict) else ''
                                        name_matches = any(keyword in camp_type_name for keyword in keywords) if camp_type_name else False
                                        
                                        if name_matches:
                                            filtered_events.append(ev)
                                
                                if filtered_events:
                                    events = filtered_events
                                    print(f"✅ Found {len(events)} events using Portal API")
                                    break
                except Exception as e:
                    continue
    
    if not events:
        print(f"⚠️ No events found for {gym_id} - {camp_type}")
        print(f"   Tried Open API v1 and Portal API methods")
    
    return events

def convert_event_dicts_to_flat(events, gym_id, portal_slug, camp_type_label):
    """
    Convert raw event dictionaries to flat format for database
    
    Args:
        events: List of raw event dictionaries from API
        gym_id: Gym ID
        portal_slug: Portal subdomain/slug
        camp_type_label: Event type label
    
    Returns:
        List of flat event dictionaries ready for database
    """
    if not events:
        return []
    
    processed = []
    seen_urls = set()
    today = date.today()
    
    for ev in events:
        # Extract event ID
        event_id = ev.get('id')
        if not event_id:
            continue
        
        # Build event URL
        event_url = f"https://portal.iclasspro.com/{portal_slug}/camp-details/{event_id}"
        
        # Skip duplicates
        if event_url in seen_urls:
            continue
        seen_urls.add(event_url)
        
        # Extract dates
        start_date = ev.get('startDate')
        if not start_date:
            continue
        
        # Filter to future events only
        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            if event_date < today:
                continue
        except (ValueError, AttributeError):
            continue
        
        # Extract time from schedule
        time_str = None
        if ev.get('schedule') and len(ev['schedule']) > 0:
            schedule = ev['schedule'][0]
            start_time = schedule.get('startTime', '')
            end_time = schedule.get('endTime', '')
            if start_time and end_time:
                time_str = f"{start_time} - {end_time}"
        
        # Extract title
        title = ev.get('name', 'Untitled Event')
        
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
