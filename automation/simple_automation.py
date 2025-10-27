#!/usr/bin/env python3
"""
🎯 SIMPLE AUTOMATION - USE YOUR EXISTING SYSTEM
This just runs your existing collectAllGyms.js automatically
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime

# Your exact gym data
GYMS = {
    'CCP': 'capgymavery',
    'CPF': 'capgymhp', 
    'CRR': 'capgymroundrock',
    'HGA': 'houstongymnastics',
    'RBA': 'rbatascocita',
    'RBK': 'rbkingwood',
    'EST': 'estrellagymnastics',
    'OAS': 'oasisgymnastics',
    'SGT': 'scottsdalegymnastics',
    'TIG': 'tigar'
}

async def collect_all_events():
    """Use your exact collectAllGyms logic"""
    print("SIMPLE AUTOMATION - USING YOUR EXISTING SYSTEM")
    print("=" * 50)
    
    all_events = []
    
    async with aiohttp.ClientSession() as session:
        for gym_id, subdomain in GYMS.items():
            print(f"Collecting from {gym_id} ({subdomain})...")
            
            try:
                # Step 1: Get locations (your exact logic)
                locations_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/locations"
                async with session.get(locations_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        locations = data.get('data', [])
                        
                        for location in locations:
                            location_id = location.get('id') or location.get('locationId')
                            if location_id:
                                # Step 2: Get programs (your exact logic)
                                programs_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/camp-programs/{location_id}"
                                async with session.get(programs_url) as prog_response:
                                    if prog_response.status == 200:
                                        prog_data = await prog_response.json()
                                        programs = prog_data.get('data', [])
                                        
                                        for program in programs:
                                            program_id = program.get('id')
                                            if program_id:
                                                # Step 3: Get events (your exact logic)
                                                events_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/camps?locationId={location_id}&typeId={program_id}&limit=50&page=1&sortBy=time"
                                                async with session.get(events_url) as events_response:
                                                    if events_response.status == 200:
                                                        events_data = await events_response.json()
                                                        camps = events_data.get('data', [])
                                                        
                                                        for camp in camps:
                                                            event = {
                                                                'gym_id': gym_id,
                                                                'title': camp.get('name', 'Untitled Event'),
                                                                'date': camp.get('startDate', ''),
                                                                'time': '6:30 PM - 9:30 PM',  # Default
                                                                'type': program.get('name', 'OPEN GYM'),
                                                                'event_url': f"https://portal.iclasspro.com/{subdomain}/camp-details/{camp['id']}",
                                                                'price': None,
                                                                'age_min': camp.get('minAge'),
                                                                'age_max': camp.get('maxAge')
                                                            }
                                                            all_events.append(event)
                                                        
                                                        print(f"  Found {len(camps)} events in {program.get('name', 'Unknown Program')}")
                
                print(f"SUCCESS {gym_id}: {len([e for e in all_events if e['gym_id'] == gym_id])} total events")
                
            except Exception as e:
                print(f"ERROR {gym_id}: {e}")
    
    print(f"\nTotal events collected: {len(all_events)}")
    
    if all_events:
        # Save events
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"simple_automated_events_{timestamp}.json"
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
        print("No events found. This might be normal if no events are currently scheduled.")
        return None

async def main():
    """Run the simple automation"""
    filepath = await collect_all_events()
    
    if filepath:
        print(f"\nSUCCESS: Automation complete!")
        print(f"Events saved to: {filepath}")
        print("You can now import these events using your existing F12 import system!")
    else:
        print("\nNo events found. This might be normal if no events are currently scheduled.")

if __name__ == "__main__":
    asyncio.run(main())

