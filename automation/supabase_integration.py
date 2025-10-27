#!/usr/bin/env python3
"""
🔗 SUPABASE INTEGRATION FOR MASTER EVENTS CALENDAR
Connects the automation system to your existing Supabase database

This script:
1. Imports collected events into your Supabase database
2. Handles duplicate detection using your existing logic
3. Maintains audit trails and change tracking
4. Integrates with your existing F12 import system
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import logging
from dataclasses import dataclass

# Supabase integration
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ Supabase not installed. Run: pip install supabase")

logger = logging.getLogger(__name__)

@dataclass
class SupabaseConfig:
    """Supabase configuration"""
    url: str
    key: str
    
    @classmethod
    def from_env(cls):
        """Load from environment variables"""
        return cls(
            url=os.getenv('SUPABASE_URL', 'https://xftiwouxpefchwoxxgpf.supabase.co'),
            key=os.getenv('SUPABASE_ANON_KEY', '')
        )

class SupabaseEventImporter:
    """Handles importing events into Supabase database"""
    
    def __init__(self, config: SupabaseConfig):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase package not available. Install with: pip install supabase")
        
        self.supabase: Client = create_client(config.url, config.key)
        self.config = config
        self.import_stats = {
            'total_processed': 0,
            'new_events': 0,
            'updated_events': 0,
            'skipped_duplicates': 0,
            'errors': 0
        }
    
    async def import_events_from_file(self, json_file: str) -> Dict:
        """Import events from collected JSON file"""
        logger.info(f"📥 Importing events from: {json_file}")
        
        # Load events from file
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        events = data.get('events', [])
        logger.info(f"Found {len(events)} events to process")
        
        # Process events in batches
        batch_size = 50
        for i in range(0, len(events), batch_size):
            batch = events[i:i + batch_size]
            await self._process_event_batch(batch)
        
        logger.info("✅ Import complete!")
        return self.import_stats
    
    async def _process_event_batch(self, events: List[Dict]):
        """Process a batch of events"""
        for event_data in events:
            try:
                await self._import_single_event(event_data)
                self.import_stats['total_processed'] += 1
            except Exception as e:
                logger.error(f"Error importing event {event_data.get('title', 'Unknown')}: {e}")
                self.import_stats['errors'] += 1
    
    async def _import_single_event(self, event_data: Dict):
        """Import a single event with duplicate detection"""
        
        # Check for existing event using your existing logic
        existing_event = await self._find_existing_event(event_data)
        
        if existing_event:
            # Check if event has changed
            if self._event_has_changes(existing_event, event_data):
                await self._update_event(existing_event['id'], event_data)
                self.import_stats['updated_events'] += 1
                logger.info(f"🔄 Updated: {event_data['title']}")
            else:
                self.import_stats['skipped_duplicates'] += 1
                logger.debug(f"⏭️ Skipped duplicate: {event_data['title']}")
        else:
            # New event - insert it
            await self._insert_new_event(event_data)
            self.import_stats['new_events'] += 1
            logger.info(f"🆕 New: {event_data['title']}")
    
    async def _find_existing_event(self, event_data: Dict) -> Optional[Dict]:
        """Find existing event using your duplicate detection logic"""
        
        # Method 1: Check by URL (primary method from your F12 system)
        if event_data.get('event_url'):
            url_base = event_data['event_url'].split('?')[0]  # Remove query params
            
            result = self.supabase.table('events').select('*').eq('event_url', event_data['event_url']).execute()
            
            if result.data:
                return result.data[0]
        
        # Method 2: Check by composite key (secondary method)
        composite_key = f"{event_data['gym_id']}-{event_data['date']}-{event_data['time']}-{event_data['type']}"
        
        result = self.supabase.table('events').select('*').eq('gym_id', event_data['gym_id']).eq('date', event_data['date']).eq('time', event_data['time']).eq('type', event_data['type']).execute()
        
        if result.data:
            return result.data[0]
        
        return None
    
    def _event_has_changes(self, existing: Dict, new: Dict) -> bool:
        """Check if event has meaningful changes"""
        # Compare key fields that matter for updates
        fields_to_check = ['title', 'time', 'price', 'event_url']
        
        for field in fields_to_check:
            if existing.get(field) != new.get(field):
                return True
        
        return False
    
    async def _insert_new_event(self, event_data: Dict):
        """Insert a new event into the database using your exact schema"""
        
        # Calculate day of week
        try:
            event_date = datetime.strptime(event_data['date'], '%Y-%m-%d')
            day_of_week = event_date.strftime('%A')
        except:
            day_of_week = 'Unknown'
        
        # Prepare event for insertion using your EXACT Supabase schema
        event_record = {
            'gym_id': event_data['gym_id'],  # TEXT - your short codes (CCP, CPF, etc.)
            'title': event_data['title'],    # TEXT - Event name
            'date': event_data['date'],      # DATE - Event date
            'start_date': event_data.get('start_date', event_data['date']),  # DATE
            'end_date': event_data.get('end_date', event_data['date']),      # DATE
            'time': event_data['time'],      # TEXT - "6:30 PM - 9:30 PM"
            'price': event_data.get('price'), # DECIMAL - Cost
            'type': event_data['type'],      # TEXT - Event category (CLINIC, KIDS NIGHT OUT, etc.)
            'event_url': event_data['event_url'],  # TEXT - Registration link
            'day_of_week': day_of_week       # TEXT - Computed field
            # Note: id is UUID PRIMARY KEY (auto-generated)
            # Note: event_type_id is UUID FK to event_types (nullable)
            # Note: created_at/updated_at are auto-generated
        }
        
        # Insert into database
        result = self.supabase.table('events').insert(event_record).execute()
        
        if result.data:
            # Log to audit system
            await self._log_event_change(
                result.data[0]['id'],
                event_data['gym_id'],
                'CREATE',
                'all',
                None,
                None,
                'Auto-Import',
                event_data['title'],
                event_data['date']
            )
    
    async def _update_event(self, event_id: str, event_data: Dict):
        """Update an existing event"""
        
        # Prepare update data
        update_data = {
            'title': event_data['title'],
            'time': event_data['time'],
            'price': event_data.get('price'),
            'event_url': event_data['event_url'],
            'age_min': event_data.get('age_min'),
            'age_max': event_data.get('age_max')
        }
        
        # Update in database
        result = self.supabase.table('events').update(update_data).eq('id', event_id).execute()
        
        if result.data:
            # Log to audit system
            await self._log_event_change(
                event_id,
                event_data['gym_id'],
                'UPDATE',
                'auto_import',
                'Updated via automation',
                'Auto-Import',
                'Auto-Import',
                event_data['title'],
                event_data['date']
            )
    
    async def _log_event_change(self, event_id: str, gym_id: str, action: str, 
                               field_changed: str, old_value: str, new_value: str,
                               changed_by: str, event_title: str, event_date: str):
        """Log event changes to audit table"""
        try:
            audit_record = {
                'event_id': event_id,
                'gym_id': gym_id,
                'action': action,
                'field_changed': field_changed,
                'old_value': old_value,
                'new_value': new_value,
                'changed_by': changed_by,
                'event_title': event_title,
                'event_date': event_date
            }
            
            self.supabase.table('event_audit_log').insert(audit_record).execute()
            
        except Exception as e:
            logger.warning(f"Failed to log audit record: {e}")
    
    def print_import_summary(self):
        """Print import statistics"""
        print("\n" + "="*60)
        print("📊 SUPABASE IMPORT SUMMARY")
        print("="*60)
        print(f"📥 Total Processed: {self.import_stats['total_processed']}")
        print(f"🆕 New Events: {self.import_stats['new_events']}")
        print(f"🔄 Updated Events: {self.import_stats['updated_events']}")
        print(f"⏭️ Skipped Duplicates: {self.import_stats['skipped_duplicates']}")
        print(f"❌ Errors: {self.import_stats['errors']}")
        print("="*60)

async def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Supabase Event Importer')
    parser.add_argument('json_file', help='JSON file with collected events')
    parser.add_argument('--url', help='Supabase URL')
    parser.add_argument('--key', help='Supabase anon key')
    
    args = parser.parse_args()
    
    # Load Supabase config
    config = SupabaseConfig.from_env()
    if args.url:
        config.url = args.url
    if args.key:
        config.key = args.key
    
    if not config.key:
        print("❌ Supabase key not provided. Set SUPABASE_ANON_KEY environment variable.")
        return
    
    # Initialize importer
    importer = SupabaseEventImporter(config)
    
    # Import events
    stats = await importer.import_events_from_file(args.json_file)
    
    # Print summary
    importer.print_import_summary()
    
    print(f"\n✅ Import complete! Check your Master Events Calendar for new events.")

if __name__ == "__main__":
    asyncio.run(main())
