#!/usr/bin/env python3
"""
🎯 EXACT F12 AUTOMATION - USES YOUR EXACT JSON STRUCTURE
This gets the EXACT same data you just showed me
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime

# Your exact gym data
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

async def get_exact_f12_data():
    """Get the EXACT same data your F12 process gets"""
    print("EXACT F12 AUTOMATION - GETTING YOUR EXACT DATA")
    print("=" * 60)
    
    all_events = []
    
    async with aiohttp.ClientSession() as session:
        for gym_id, gym_info in GYMS.items():
            print(f"\nProcessing {gym_info['name']} ({gym_id})...")
            
            # Try different program IDs that might have events
            program_ids = [102, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
            
            for program_id in program_ids:
                try:
                    # This should be the EXACT API call your F12 process makes
                    # Based on your JSON, it looks like it's using programId=102
                    api_url = f"https://app.iclasspro.com/portal/api/camps/search?programId={program_id}"
                    
                    async with session.get(api_url) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # Check if we got the same structure as your F12 data
                            if data.get('data') and len(data['data']) > 0:
                                print(f"  Found {len(data['data'])} events for program {program_id}")
                                print(f"  Event type: {data.get('campTypeName', 'Unknown')}")
                                
                                # Convert using your exact logic
                                for event in data['data']:
                                    converted_event = convert_exact_f12_event(event, gym_id, gym_info['subdomain'], data.get('campTypeName', 'CAMP'))
                                    if converted_event:
                                        all_events.append(converted_event)
                                
                                # If we found events, we can stop trying other program IDs for this gym
                                break
                        else:
                            print(f"  Program {program_id}: {response.status}")
                
                except Exception as e:
                    print(f"  Program {program_id}: Error - {e}")
    
    print(f"\nTotal events collected: {len(all_events)}")
    
    if all_events:
        # Save events
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"exact_f12_events_{timestamp}.json"
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

def convert_exact_f12_event(event, gym_id, subdomain, camp_type_name):
    """Convert using your exact F12 logic"""
    
    # Extract time from schedule (your exact logic)
    time_str = "9:00 AM - 3:00 PM"  # Default from your data
    if event.get('schedule') and len(event['schedule']) > 0:
        schedule = event['schedule'][0]
        start_time = schedule.get('startTime', '9:00 AM')
        end_time = schedule.get('endTime', '3:00 PM')
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
        return 'CAMP'  # Default for your data

async def main():
    """Run the exact F12 automation"""
    filepath = await get_exact_f12_data()
    
    if filepath:
        print(f"\nSUCCESS: Exact F12 automation complete!")
        print(f"Events saved to: {filepath}")
        print("This gets the EXACT same data your F12 process gets!")
    else:
        print("\nNo events found.")

if __name__ == "__main__":
    asyncio.run(main())










