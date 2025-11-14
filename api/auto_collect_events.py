"""
Vercel API endpoint for automated event collection
Runs daily at 6 AM via Vercel Cron
"""

import os
import json
import requests
from datetime import datetime
from supabase import create_client, Client

# ========== CONFIG ==========
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xftiwouxpefchwoxxgpf.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
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
    """Download JSON from iClassPro endpoint."""
    url = f"https://app.iclasspro.com/portal/api/camps/search?programId={program_id}"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            return []
        
        if not r.text.strip():
            return []
            
        data = r.json().get("data", [])
        return data
    except Exception as e:
        return []

def transform_event(gym_slug, event, gym_id):
    """Convert iClassPro JSON to Supabase schema."""
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
    """Map subdomain → short gym code."""
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

    if all_events:
        # Deduplication handled by DB unique index on event_url
        res = supabase.table("events").upsert(all_events).execute()
        return len(res.data or [])
    return 0

def handler(request):
    """Vercel API handler"""
    try:
        events_imported = import_events()
        return {
            "statusCode": 200,
            "body": json.dumps({
                "success": True,
                "events_imported": events_imported,
                "timestamp": datetime.utcnow().isoformat()
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
        }










