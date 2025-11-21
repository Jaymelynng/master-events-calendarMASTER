#!/usr/bin/env python3
"""
Build EVENT_TYPE_URLS from your Supabase gym_links table
This pulls the actual URLs from your database instead of hardcoding
"""

import os
import sys
from supabase import create_client, Client

# Supabase connection
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xftiwouxpefchwoxxgpf.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Map link_type_id to event type name
LINK_TYPE_TO_EVENT_TYPE = {
    "kids_night_out": "KIDS NIGHT OUT",
    "skill_clinics": "CLINIC",
    "open_gym": "OPEN GYM",
    "camps": "SCHOOL YEAR CAMP",
    "camps_holiday": "SCHOOL YEAR CAMP",
    "special_events": "SPECIAL EVENT"
}

def build_event_type_urls():
    """Build EVENT_TYPE_URLS dictionary from gym_links table"""
    
    # Get all active gym links
    response = supabase.table('gym_links').select('*').eq('is_active', True).execute()
    links = response.data or []
    
    # Build structure
    event_type_urls = {}
    
    for link in links:
        gym_id = link.get('gym_id')
        link_type = link.get('link_type_id')
        url = link.get('url')
        
        if not gym_id or not link_type or not url:
            continue
        
        # Map link_type to event type
        event_type = LINK_TYPE_TO_EVENT_TYPE.get(link_type)
        if not event_type:
            continue  # Skip unknown link types
        
        # Initialize event type if needed
        if event_type not in event_type_urls:
            event_type_urls[event_type] = {}
        
        # Add URL for this gym
        # Ensure URL has ?sortBy=time
        if '?sortBy=time' not in url:
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
    print("BUILDING EVENT_TYPE_URLS FROM DATABASE")
    print("=" * 60)
    
    try:
        urls = build_event_type_urls()
        
        print("\n[OK] Found URLs for:")
        for event_type, gyms in urls.items():
            print(f"  {event_type}: {len(gyms)} gyms")
        
        print("\n" + "=" * 60)
        print("COPY THIS INTO f12_collect_and_import.py:")
        print("=" * 60 + "\n")
        print_python_dict(urls)
        
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

