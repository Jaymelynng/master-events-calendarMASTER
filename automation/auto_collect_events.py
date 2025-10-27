"""
Master Events Calendar - Automated Event Collector
Version: 1.0
Purpose:
    • Collects all iClassPro event JSON from every gym's public endpoint
    • Converts it using your documented F12 logic
    • Deduplicates and inserts into Supabase automatically
    • Can run locally or on Vercel Cron (daily)
"""

import os, json, requests
from datetime import datetime
from supabase import create_client, Client

# ========== CONFIG ==========
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xftiwouxpefchwoxxgpf.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4")  # Use anon/public key
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Gym subdomains + program IDs (from gym_links table)
GYMS = {
    "capgymavery": [14, 17, 7],
    "capgymhp": [31, 73, 81, 91],
    "capgymroundrock": [26, 28, 35, 40],
    "houstongymnastics": [1, 2, 7, 15],
    "rbatascocita": [33, 35, 45, 76],
    "rbkingwood": [6, 26, 31, 32],
    "estrellagymnastics": [3, 12, 24, 25, 33],
    "oasisgymnastics": [27, 33, 58, 60],
    "scottsdalegymnastics": [1, 5, 28, 32],
    "tigar": [2, 8, 12, 22],
}

def fetch_events(gym_slug, program_id):
    """Download JSON from iClassPro API endpoint (from BULK-IMPORT-LEARNINGS.md)."""
    # Use the EXACT API endpoint from your F12 process
    url = f"https://app.iclasspro.com/api/open/v1/{gym_slug}/camps/{program_id}"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            print(f"Failed {gym_slug}/{program_id}: {r.status_code}")
            return []
        
        # Check if response is empty
        if not r.text.strip():
            print(f"Empty response from {gym_slug}/{program_id}")
            return []
            
        data = r.json().get("data", [])
        if data:
            print(f"Found {len(data)} events from {gym_slug} program {program_id}")
        return data
    except Exception as e:
        print(f"Error fetching {gym_slug}/{program_id}: {e}")
        return []

def transform_event(gym_slug, event, gym_id):
    """Convert iClassPro JSON to Supabase schema (see F12-IMPORT-GUIDE.md)."""
    sched = event.get("schedule", [{}])[0]
    start = event.get("startDate")
    end = event.get("endDate")
    return {
        "gym_id": gym_id,
        "title": event["name"],
        "date": start,
        "start_date": start,
        "end_date": end,
        "time": f"{sched.get('startTime','')} - {sched.get('endTime','')}".strip(" -"),
        "type": "CAMP",
        "event_url": f"https://portal.iclasspro.com/{gym_slug}/camps/event?id={event['id']}",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

def get_gym_id(slug):
    """Map subdomain → short gym code (as in gyms table)."""
    mapping = {
        "capgymavery": "CCP",
        "capgymhp": "CPF",
        "capgymroundrock": "CRR",
        "houstongymnastics": "HGA",
        "rbatascocita": "RBA",
        "rbkingwood": "RBK",
        "estrellagymnastics": "EST",
        "oasisgymnastics": "OAS",
        "scottsdalegymnastics": "SGT",
        "tigar": "TIG",
    }
    return mapping.get(slug)

def import_events():
    all_events = []
    for gym, program_ids in GYMS.items():
        gym_id = get_gym_id(gym)
        for pid in program_ids:
            data = fetch_events(gym, pid)
            for e in data:
                all_events.append(transform_event(gym, e, gym_id))

    print(f"Prepared {len(all_events)} total events. Inserting...")
    # Deduplication handled by DB unique index on event_url
    res = supabase.table("events").upsert(all_events).execute()
    print(f"Upsert complete: {len(res.data or [])} records written")

if __name__ == "__main__":
    print("Starting automatic iClassPro import...")
    import_events()
    print("Finished all gyms!")