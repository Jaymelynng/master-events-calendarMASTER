#!/usr/bin/env python3
"""
Helper script to discover typeId values for each gym
Opens each gym's portal page and tries common typeIds to find which ones work
"""

from playwright.sync_api import sync_playwright
import json

GYMS = {
    "CCP": {"name": "Capital Gymnastics Cedar Park", "slug": "capgymavery"},
    "CPF": {"name": "Capital Gymnastics Pflugerville", "slug": "capgymhp"},
    "CRR": {"name": "Capital Gymnastics Round Rock", "slug": "capgymroundrock"},
    "HGA": {"name": "Houston Gymnastics Academy", "slug": "houstongymnastics"},
    "RBA": {"name": "Rowland Ballard Atascocita", "slug": "rbatascocita"},
    "RBK": {"name": "Rowland Ballard Kingwood", "slug": "rbkingwood"},
    "EST": {"name": "Estrella Gymnastics", "slug": "estrellagymnastics"},
    "OAS": {"name": "Oasis Gymnastics", "slug": "oasisgymnastics"},
    "SGT": {"name": "Scottsdale Gymnastics", "slug": "scottsdalegymnastics"},
    "TIG": {"name": "Tigar Gymnastics", "slug": "tigar"},
}

# Common typeIds to try (based on RBA and common patterns)
COMMON_TYPEIDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
                  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
                  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
                  70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
                  100, 101, 102, 103, 104, 105, 170, 171, 172, 173, 174, 175]

def test_typeid(gym_slug, typeid):
    """Test if a typeId returns events for a gym"""
    url = f"https://portal.iclasspro.com/{gym_slug}/camps/{typeid}?sortBy=time"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        events_found = []
        
        def handle_response(response):
            try:
                response_url = response.url
                content_type = response.headers.get("content-type", "")
                
                if "application/json" not in content_type:
                    return
                
                if "/camps/" in response_url and "?" not in response_url:
                    try:
                        body = response.json()
                        if body.get("data") and isinstance(body["data"], dict):
                            event_id = body["data"].get("id")
                            if event_id:
                                events_found.append(event_id)
                    except:
                        pass
            except:
                pass
        
        page.on("response", handle_response)
        
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=10000)
            page.wait_for_timeout(2000)
        except:
            pass
        
        browser.close()
        
        return len(events_found) > 0, len(events_found)

def discover_gym_typeids(gym_id, gym_slug):
    """Discover which typeIds work for a gym"""
    print(f"\n🔍 Discovering typeIds for {gym_id} ({gym_slug})...")
    
    working_typeids = []
    
    for typeid in COMMON_TYPEIDS:
        has_events, count = test_typeid(gym_slug, typeid)
        if has_events:
            working_typeids.append(typeid)
            print(f"  ✅ typeId {typeid}: Found {count} events")
        else:
            print(f"  ❌ typeId {typeid}: No events")
    
    return working_typeids

if __name__ == "__main__":
    print("=" * 60)
    print("TYPEID DISCOVERY TOOL")
    print("=" * 60)
    print("This will test common typeIds for each gym")
    print("It may take a while...")
    print("=" * 60)
    
    results = {}
    
    for gym_id, gym_info in GYMS.items():
        typeids = discover_gym_typeids(gym_id, gym_info["slug"])
        results[gym_id] = typeids
        print(f"\n{gym_id}: {typeids}")
    
    print("\n" + "=" * 60)
    print("RESULTS:")
    print("=" * 60)
    print(json.dumps(results, indent=2))















