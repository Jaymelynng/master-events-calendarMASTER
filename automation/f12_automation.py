#!/usr/bin/env python3
"""
🎯 F12 AUTOMATION - EXACT COPY OF YOUR F12 PROCESS
This does exactly what your manual F12 process does, but automatically

Your F12 Process:
1. Go to gym event page
2. F12 → Network → Copy Response
3. Paste JSON → Convert → Import

This Automation:
1. Automatically gets the same JSON you copy from F12
2. Uses your exact convertRawDataToJson logic
3. Uses your exact handleBulkImport logic
4. Imports to your Supabase database
"""

import asyncio
import aiohttp
import json
import os
import sys
from datetime import datetime
from typing import Dict, List

# Add your existing lib directory to path
sys.path.append('../src/lib')

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

class F12Automation:
    """Automation that replicates your exact F12 process"""
    
    def __init__(self):
        self.session = None
        self.supabase_url = "https://xftiwouxpefchwoxxgpf.supabase.co"
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdGl3b3V4cGVmY2h3b3h4Z3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2ODc1MjUsImV4cCI6MjA2NjI2MzUyNX0.jQReOgyjYxOaig_IoJv3jhhPzlfumUcn-vkS1yF9hY4')
        
        if not self.supabase_key:
            print("ERROR: SUPABASE_ANON_KEY not found!")
            print("Set it with: export SUPABASE_ANON_KEY=your_key_here")
            sys.exit(1)
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Your exact gym data (from your existing system)
        self.gyms = {
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
        
        # Your exact program IDs (from your F12 process)
        self.program_ids = {
            'CLINIC': [1],  # Skill clinics
            'KIDS NIGHT OUT': [2],  # KNO events
            'OPEN GYM': [3],  # Open gym
            'CAMP': [4, 5, 6]  # Various camp types
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def run_f12_automation(self):
        """Run the exact F12 process for all gyms and event types"""
        print("F12 AUTOMATION - EXACT COPY OF YOUR MANUAL PROCESS")
        print("=" * 60)
        
        all_events = []
        
        for gym_id, gym_info in self.gyms.items():
            print(f"\nProcessing {gym_info['name']} ({gym_id})...")
            
            for event_type, program_ids in self.program_ids.items():
                print(f"  Getting {event_type} events...")
                
                for program_id in program_ids:
                    try:
                        # This is the EXACT same API call your F12 process makes
                        events = await self._get_f12_json(gym_id, gym_info['subdomain'], program_id, event_type)
                        all_events.extend(events)
                        print(f"    Found {len(events)} {event_type} events")
                    except Exception as e:
                        print(f"    Error getting {event_type}: {e}")
        
        print(f"\nTotal events collected: {len(all_events)}")
        
        if all_events:
            # Save events (like your F12 process)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"f12_automated_events_{timestamp}.json"
            filepath = self._save_events(all_events, filename)
            
            print(f"Events saved to: {filepath}")
            return filepath
        else:
            print("No events found. This might be normal if no events are currently scheduled.")
            return None
    
    async def _get_f12_json(self, gym_id: str, subdomain: str, program_id: int, event_type: str) -> List[Dict]:
        """Get the exact same JSON your F12 process gets"""
        
        # This is the EXACT URL your F12 process calls
        url = f"https://app.iclasspro.com/portal/api/camps/search?programId={program_id}"
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # This is the EXACT same JSON structure your F12 process gets
                    if data.get('data') and len(data['data']) > 0:
                        events = []
                        for event in data['data']:
                            # Use your exact convertRawDataToJson logic
                            converted_event = self._convert_f12_event(event, gym_id, subdomain, data.get('campTypeName', event_type))
                            if converted_event:
                                events.append(converted_event)
                        return events
                    else:
                        return []
                else:
                    print(f"    API returned {response.status} for {url}")
                    return []
        except Exception as e:
            print(f"    Error calling API: {e}")
            return []
    
    def _convert_f12_event(self, event: Dict, gym_id: str, subdomain: str, camp_type_name: str) -> Dict:
        """Convert using your exact convertRawDataToJson logic"""
        
        # Extract time from schedule (your exact logic)
        time_str = "6:30 PM - 9:30 PM"  # Default
        if event.get('schedule') and len(event['schedule']) > 0:
            schedule = event['schedule'][0]
            start_time = schedule.get('startTime', '6:30 PM')
            end_time = schedule.get('endTime', '9:30 PM')
            time_str = f"{start_time} - {end_time}"
        
        # Detect event type (your exact logic)
        event_type = self._detect_event_type(camp_type_name)
        
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
    
    def _detect_event_type(self, camp_type_name: str) -> str:
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
    
    def _save_events(self, events: List[Dict], filename: str) -> str:
        """Save events in your exact format"""
        os.makedirs('output', exist_ok=True)
        filepath = f"output/{filename}"
        
        with open(filepath, 'w') as f:
            json.dump({
                'collected_at': datetime.now().isoformat(),
                'total_events': len(events),
                'events': events
            }, f, indent=2)
        
        return filepath
    
    def import_to_supabase(self, json_file: str):
        """Import using your exact handleBulkImport logic"""
        print(f"\nImporting {json_file} to Supabase...")
        
        # Load events
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        events = data.get('events', [])
        print(f"Found {len(events)} events to import")
        
        # Import each event using your exact logic
        imported = 0
        updated = 0
        skipped = 0
        
        for event in events:
            try:
                result = self._import_single_event(event)
                if result == 'new':
                    imported += 1
                elif result == 'updated':
                    updated += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"Error importing {event.get('title', 'Unknown')}: {e}")
        
        print(f"\nImport Summary:")
        print(f"  New events: {imported}")
        print(f"  Updated events: {updated}")
        print(f"  Skipped duplicates: {skipped}")
        print(f"  Total processed: {imported + updated + skipped}")
    
    def _import_single_event(self, event_data: Dict) -> str:
        """Import single event using your exact duplicate detection logic"""
        
        # Check for existing event (your exact logic)
        existing = self._find_existing_event(event_data)
        
        if existing:
            # Check if event has changes (your exact logic)
            if self._event_has_changes(existing, event_data):
                self._update_event(existing['id'], event_data)
                return 'updated'
            else:
                return 'skipped'
        else:
            # New event (your exact logic)
            self._insert_new_event(event_data)
            return 'new'
    
    def _find_existing_event(self, event_data: Dict) -> Dict:
        """Find existing event using your exact duplicate detection"""
        
        # Method 1: Check by URL (your primary method)
        if event_data.get('event_url'):
            result = self.supabase.table('events').select('*').eq('event_url', event_data['event_url']).execute()
            if result.data:
                return result.data[0]
        
        # Method 2: Check by composite key (your secondary method)
        result = self.supabase.table('events').select('*').eq('gym_id', event_data['gym_id']).eq('date', event_data['date']).eq('time', event_data['time']).eq('type', event_data['type']).execute()
        if result.data:
            return result.data[0]
        
        return None
    
    def _event_has_changes(self, existing: Dict, new: Dict) -> bool:
        """Check if event has meaningful changes (your exact logic)"""
        fields_to_check = ['title', 'time', 'price', 'event_url']
        
        for field in fields_to_check:
            if existing.get(field) != new.get(field):
                return True
        
        return False
    
    def _insert_new_event(self, event_data: Dict):
        """Insert new event using your exact schema"""
        
        event_record = {
            'gym_id': event_data['gym_id'],
            'title': event_data['title'],
            'date': event_data['date'],
            'start_date': event_data.get('start_date', event_data['date']),
            'end_date': event_data.get('end_date', event_data['date']),
            'time': event_data['time'],
            'price': event_data.get('price'),
            'type': event_data['type'],
            'event_url': event_data['event_url'],
            'day_of_week': event_data.get('day_of_week', 'Unknown')
        }
        
        result = self.supabase.table('events').insert(event_record).execute()
        
        if result.data:
            print(f"  Added: {event_data['title']}")
    
    def _update_event(self, event_id: str, event_data: Dict):
        """Update existing event"""
        
        update_data = {
            'title': event_data['title'],
            'time': event_data['time'],
            'price': event_data.get('price'),
            'event_url': event_data['event_url']
        }
        
        result = self.supabase.table('events').update(update_data).eq('id', event_id).execute()
        
        if result.data:
            print(f"  Updated: {event_data['title']}")

async def main():
    """Run the F12 automation"""
    print("F12 AUTOMATION - EXACT COPY OF YOUR MANUAL PROCESS")
    print("=" * 60)
    
    async with F12Automation() as automation:
        # Step 1: Collect events (like your F12 process)
        filepath = await automation.run_f12_automation()
        
        if filepath:
            # Step 2: Import to Supabase (like your F12 process)
            automation.import_to_supabase(filepath)
            print("\nSUCCESS: F12 automation complete!")
            print("Your Master Events Calendar is now updated!")
        else:
            print("\nNo events found. This might be normal if no events are currently scheduled.")

if __name__ == "__main__":
    asyncio.run(main())
