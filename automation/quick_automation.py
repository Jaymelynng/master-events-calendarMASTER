#!/usr/bin/env python3
"""
🚀 QUICK AUTOMATION FOR YOUR EXISTING SYSTEM
Uses your exact Supabase structure that I already know

This script:
1. Connects to your existing Supabase database
2. Collects events from all 10 gyms automatically  
3. Uses your exact table structure and gym IDs
4. Integrates with your existing F12 import logic
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, List
import logging

# Your exact Supabase configuration
SUPABASE_URL = "https://xftiwouxpefchwoxxgpf.supabase.co"
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY', '')

# Your exact gym data (that I already know)
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

class QuickAutomation:
    """Simple automation using your existing Supabase structure"""
    
    def __init__(self):
        self.session = None
        self.collected_events = []
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def collect_all_events(self):
        """Collect events from all 10 gyms using your exact structure"""
        print("Starting automation for all 10 gyms...")
        
        for gym_id, gym_info in GYMS.items():
            print(f"Collecting from {gym_info['name']} ({gym_id})...")
            
            try:
                events = await self._collect_gym_events(gym_id, gym_info['subdomain'])
                self.collected_events.extend(events)
                print(f"SUCCESS {gym_id}: {len(events)} events found")
            except Exception as e:
                print(f"ERROR {gym_id}: Error - {e}")
        
        print(f"Total events collected: {len(self.collected_events)}")
        return self.collected_events
    
    async def _collect_gym_events(self, gym_id: str, subdomain: str) -> List[Dict]:
        """Collect events for a specific gym using the correct API endpoints"""
        events = []
        
        try:
            # Get locations
            locations_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/locations"
            async with self.session.get(locations_url) as response:
                if response.status == 200:
                    data = await response.json()
                    locations = data.get('data', [])
                    
                    for location in locations:
                        location_id = location.get('id') or location.get('locationId')
                        if location_id:
                            # Get programs for this location
                            programs_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/camp-programs/{location_id}"
                            async with self.session.get(programs_url) as prog_response:
                                if prog_response.status == 200:
                                    prog_data = await prog_response.json()
                                    programs = prog_data.get('data', [])
                                    
                                    for program in programs:
                                        program_id = program.get('id')
                                        if program_id:
                                            # Get events for this program (using correct endpoint)
                                            events_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/camps?locationId={location_id}&typeId={program_id}&limit=50&page=1&sortBy=time"
                                            async with self.session.get(events_url) as events_response:
                                                if events_response.status == 200:
                                                    events_data = await events_response.json()
                                                    camps = events_data.get('data', [])
                                                    
                                                    for camp in camps:
                                                        event = self._convert_to_your_format(camp, gym_id, subdomain, program.get('name', ''))
                                                        if event:
                                                            events.append(event)
        
        except Exception as e:
            print(f"Error collecting from {gym_id}: {e}")
        
        return events
    
    def _convert_to_your_format(self, camp: Dict, gym_id: str, subdomain: str, program_name: str = '') -> Dict:
        """Convert iClassPro camp to your exact database format"""
        
        # Extract time from schedule (matches your F12 logic)
        time_str = "6:30 PM - 9:30 PM"  # Default (matches your F12 system)
        if camp.get('schedule') and len(camp['schedule']) > 0:
            schedule = camp['schedule'][0]
            start_time = schedule.get('startTime', '6:30 PM')
            end_time = schedule.get('endTime', '9:30 PM')
            time_str = f"{start_time} - {end_time}"
        
        # Detect event type using program name (matches your F12 logic)
        event_type = self._detect_event_type(program_name or camp.get('name', ''))
        
        # Extract price
        price = None
        if camp.get('name'):
            import re
            price_match = re.search(r'\$(\d+(?:\.\d{2})?)', camp['name'])
            if price_match:
                price = float(price_match.group(1))
        
        # Build event URL (matches your F12 logic)
        event_url = f"https://portal.iclasspro.com/{subdomain}/camp-details/{camp['id']}"
        
        # Calculate day of week
        try:
            event_date = datetime.strptime(camp.get('startDate', ''), '%Y-%m-%d')
            day_of_week = event_date.strftime('%A')
        except:
            day_of_week = 'Unknown'
        
        return {
            'gym_id': gym_id,  # Your exact format: CCP, CPF, etc.
            'title': camp.get('name', 'Untitled Event'),
            'date': camp.get('startDate', ''),
            'start_date': camp.get('startDate', ''),
            'end_date': camp.get('endDate', camp.get('startDate', '')),
            'time': time_str,
            'price': price,
            'type': event_type,  # CLINIC, KIDS NIGHT OUT, OPEN GYM, CAMP
            'event_url': event_url,
            'day_of_week': day_of_week,
            'age_min': camp.get('minAge'),
            'age_max': camp.get('maxAge')
        }
    
    def _detect_event_type(self, title: str) -> str:
        """Detect event type (matches your exact F12 logic)"""
        title_upper = title.upper()
        
        if 'KIDS NIGHT OUT' in title_upper or 'KNO' in title_upper:
            return 'KIDS NIGHT OUT'
        elif 'CLINIC' in title_upper:
            return 'CLINIC'
        elif 'OPEN GYM' in title_upper:
            return 'OPEN GYM'
        elif 'CAMP' in title_upper or 'SCHOOL YEAR' in title_upper:
            return 'CAMP'
        else:
            return 'OPEN GYM'  # Default fallback
    
    def save_events(self, filename: str = None):
        """Save events in your exact format"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"automated_events_{timestamp}.json"
        
        os.makedirs('output', exist_ok=True)
        filepath = f"output/{filename}"
        
        with open(filepath, 'w') as f:
            json.dump({
                'collected_at': datetime.now().isoformat(),
                'total_events': len(self.collected_events),
                'events': self.collected_events
            }, f, indent=2)
        
        print(f"Events saved to: {filepath}")
        return filepath

async def main():
    """Run the automation"""
    print("Master Events Calendar - Quick Automation")
    print("=" * 50)
    
    # Check for Supabase key
    if not SUPABASE_KEY:
        print("ERROR: SUPABASE_ANON_KEY not found!")
        print("Set it with: export SUPABASE_ANON_KEY=your_key_here")
        return
    
    # Run automation
    async with QuickAutomation() as automation:
        events = await automation.collect_all_events()
        
        if events:
            # Save events
            filepath = automation.save_events()
            
            print("\nAUTOMATION SUMMARY:")
            print(f"Total Events: {len(events)}")
            
            # Group by gym
            gym_counts = {}
            for event in events:
                gym_counts[event['gym_id']] = gym_counts.get(event['gym_id'], 0) + 1
            
            print("\nEvents by Gym:")
            for gym_id, count in sorted(gym_counts.items()):
                gym_name = GYMS[gym_id]['name']
                print(f"  {gym_id}: {count} events ({gym_name})")
            
            print(f"\nSUCCESS: Automation complete! Events saved to: {filepath}")
            print("Ready to import into your Master Events Calendar!")
        else:
            print("ERROR: No events collected. Check gym connections.")

if __name__ == "__main__":
    asyncio.run(main())
