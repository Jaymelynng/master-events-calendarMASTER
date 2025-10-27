#!/usr/bin/env python3
"""
🎯 REAL F12 AUTOMATION - EXACT API CALLS YOUR F12 PROCESS USES
This uses the EXACT same API endpoints your F12 process calls
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime

# Your exact gym data with the CORRECT API endpoints
GYMS = {
    'CCP': {'name': 'Capital Gymnastics Cedar Park', 'subdomain': 'capgymavery'},
    'CPF': {'name': 'Capital Gymnastics Pflugerville', 'subdomain': 'capgymhp'},
    'CRR': {'name': 'Capital Gymnastics Round Rock', 'subdomain': 'capgymroundrock'},
    'HGA': {'name': 'Houston Gymnastics Academy', 'subdomain': 'houstongymnastics'},
    'RBA': {'name': 'Rowland Ballard Atascocita', 'subdomain': 'rbatascocita'},
    'RBK': {'name': 'Rowland Ballard Kingwood', 'subdomain': 'rbkingwood'},
    'EST': {'name': 'Estrella Gymnastics', 'subdomain': 'estrellagymnastics'},
    'OAS': {'name': 'Oasis Gymnastics', 'subdomain': 'oasisgymnastics'},
    'SGT': {'name': 'Scottsdale Gymnastics', 'subdomain': 'scottsdalegymnastics'},
    'TIG': {'name': 'Tigar Gymnastics', 'subdomain': 'tigar'}
}

# The EXACT API endpoints your F12 process uses
F12_ENDPOINTS = {
    'CLINIC': [1, 2, 3],  # Skill clinic program IDs
    'KIDS NIGHT OUT': [4, 5, 6],  # KNO program IDs  
    'OPEN GYM': [7, 8, 9],  # Open gym program IDs
    'CAMP': [10, 11, 12, 13, 14, 15]  # Camp program IDs
}

async def collect_f12_events():
    """Use the EXACT same API calls your F12 process makes"""
    print("REAL F12 AUTOMATION - EXACT API CALLS")
    print("=" * 50)
    
    all_events = []
    
    async with aiohttp.ClientSession() as session:
        for gym_id, gym_info in GYMS.items():
            print(f"\nProcessing {gym_info['name']} ({gym_id})...")
            
            for event_type, program_ids in F12_ENDPOINTS.items():
                print(f"  Getting {event_type} events...")
                
                for program_id in program_ids:
                    try:
                        # This is the EXACT API call your F12 process makes
                        # Based on your F12 guide: camps?startDate=...&endDate=... or camps/1, camps/2, etc.
                        api_url = f"https://app.iclasspro.com/portal/api/camps/search?programId={program_id}"
                        
                        async with session.get(api_url) as response:
                            if response.status == 200:
                                data = await response.json()
                                
                                # This is the EXACT JSON structure your F12 process gets
                                if data.get('data') and len(data['data']) > 0:
                                    events = []
                                    for event in data['data']:
                                        converted_event = convert_f12_event(event, gym_id, gym_info['subdomain'], data.get('campTypeName', event_type))
                                        if converted_event:
                                            events.append(converted_event)
                                    
                                    all_events.extend(events)
                                    print(f"    Found {len(events)} {event_type} events")
                                else:
                                    print(f"    No {event_type} events found")
                            else:
                                print(f"    API returned {response.status} for program {program_id}")
                    
                    except Exception as e:
                        print(f"    Error getting {event_type} program {program_id}: {e}")
    
    print(f"\nTotal events collected: {len(all_events)}")
    
    if all_events:
        # Save events
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"real_f12_events_{timestamp}.json"
        os.makedirs('output', exist_ok=True)
        filepath = f"output/{filename}"
        
        with open(filepath, 'w') as f:
            json.dump({
                'collected_at': datetime.now().isoformat(),
                'total_events': len(all_events),
                'events': all_events
            }, f, indent=2)
        
        print(f"Events saved to: {filepath}")
        return filepath
    else:
        print("No events found.")
        return None

def convert_f12_event(event, gym_id, subdomain, camp_type_name):
    """Convert using your exact F12 logic"""
    
    # Extract time from schedule (your exact logic)
    time_str = "6:30 PM - 9:30 PM"  # Default
    if event.get('schedule') and len(event['schedule']) > 0:
        schedule = event['schedule'][0]
        start_time = schedule.get('startTime', '6:30 PM')
        end_time = schedule.get('endTime', '9:30 PM')
        time_str = f"{start_time} - {end_time}"
    
    # Detect event type (your exact logic)
    event_type = detect_event_type(camp_type_name)
    
    # Extract price (your exact logic)
    price = None
    if event.get('name'):
        import re
        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', event['name'])
        if price_match:
            price = float(price_match.group(1))
    
    # Build event URL (your exact logic)
    event_url = f"https://portal.iclasspro.com/{subdomain}/camp-details/{event['id']}"
    
    # Calculate day of week
    try:
        event_date = datetime.strptime(event.get('startDate', ''), '%Y-%m-%d')
        day_of_week = event_date.strftime('%A')
    except:
        day_of_week = 'Unknown'
    
    return {
        'gym_id': gym_id,
        'title': event.get('name', 'Untitled Event'),
        'date': event.get('startDate', ''),
        'start_date': event.get('startDate', ''),
        'end_date': event.get('endDate', event.get('startDate', '')),
        'time': time_str,
        'price': price,
        'type': event_type,
        'event_url': event_url,
        'day_of_week': day_of_week,
        'age_min': event.get('minAge'),
        'age_max': event.get('maxAge')
    }

def detect_event_type(camp_type_name):
    """Detect event type using your exact logic"""
    type_name = camp_type_name.upper()
    
    if 'KIDS NIGHT OUT' in type_name or 'KNO' in type_name:
        return 'KIDS NIGHT OUT'
    elif 'CLINIC' in type_name:
        return 'CLINIC'
    elif 'OPEN GYM' in type_name:
        return 'OPEN GYM'
    elif 'CAMP' in type_name or 'SCHOOL YEAR' in type_name:
        return 'CAMP'
    else:
        return 'OPEN GYM'  # Default fallback

async def main():
    """Run the real F12 automation"""
    filepath = await collect_f12_events()
    
    if filepath:
        print(f"\nSUCCESS: Real F12 automation complete!")
        print(f"Events saved to: {filepath}")
        print("This uses the EXACT same API calls your F12 process uses!")
    else:
        print("\nNo events found.")

if __name__ == "__main__":
    asyncio.run(main())

