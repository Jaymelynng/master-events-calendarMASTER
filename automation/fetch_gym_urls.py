#!/usr/bin/env python3
"""
Fetch gym URLs from Supabase and generate EVENT_TYPE_URLS configuration
Uses REST API - no packages needed
"""

import urllib.request
import json

SUPABASE_URL = "https://xftiwouxpefchwoxxgpf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4"

# Map link_type_id to event type name
LINK_TYPE_TO_EVENT_TYPE = {
    "kids_night_out": "KIDS NIGHT OUT",
    "skill_clinics": "CLINIC",
    "open_gym": "OPEN GYM",
    "camps": "SCHOOL YEAR CAMP",
    "camps_holiday": "SCHOOL YEAR CAMP",
    "special_events": "SPECIAL EVENT"
}

def fetch_gym_links():
    """Fetch gym links from Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/gym_links?is_active=eq.true&select=*"
    
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        return data

def build_event_type_urls(links):
    """Build EVENT_TYPE_URLS dictionary from gym_links"""
    event_type_urls = {}
    
    for link in links:
        gym_id = link.get('gym_id')
        link_type = link.get('link_type_id')
        url = link.get('url')
        
        if not gym_id or not link_type or not url:
            continue
        
        # Skip placeholder URLs
        if 'REPLACE_WITH' in url or not url.startswith('http'):
            continue
        
        # Map link_type to event type
        event_type = LINK_TYPE_TO_EVENT_TYPE.get(link_type)
        if not event_type:
            continue
        
        # Initialize event type if needed
        if event_type not in event_type_urls:
            event_type_urls[event_type] = {}
        
        # Ensure URL has ?sortBy=time (clean up duplicates first)
        if 'sortBy=' in url:
            # Remove existing sortBy parameters
            import re
            url = re.sub(r'[?&]sortBy=[^&]*', '', url)
            if '?' in url:
                url = url + '&sortBy=time'
            else:
                url = url + '?sortBy=time'
        else:
            if '?' in url:
                url = url + '&sortBy=time'
            else:
                url = url + '?sortBy=time'
        
        event_type_urls[event_type][gym_id] = url
    
    return event_type_urls

def print_python_dict(event_type_urls):
    """Print as Python dictionary for copy/paste"""
    print("EVENT_TYPE_URLS = {")
    for event_type, gyms in sorted(event_type_urls.items()):
        print(f'    "{event_type}": {{')
        for gym_id, url in sorted(gyms.items()):
            print(f'        "{gym_id}": "{url}",')
        print("    },")
    print("}")

if __name__ == "__main__":
    print("=" * 60)
    print("FETCHING GYM URLS FROM SUPABASE")
    print("=" * 60)
    
    try:
        links = fetch_gym_links()
        print(f"[OK] Fetched {len(links)} links from database")
        
        urls = build_event_type_urls(links)
        
        print("\n[OK] Found URLs for:")
        for event_type, gyms in urls.items():
            print(f"  {event_type}: {len(gyms)} gyms")
            for gym_id in sorted(gyms.keys()):
                print(f"    - {gym_id}")
        
        print("\n" + "=" * 60)
        print("COPY THIS INTO f12_collect_and_import.py:")
        print("=" * 60 + "\n")
        print_python_dict(urls)
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

