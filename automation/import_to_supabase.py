#!/usr/bin/env python3
"""
🔗 IMPORT TO YOUR EXISTING SUPABASE
Uses your exact database structure and import logic

This script:
1. Takes the collected events JSON
2. Imports them using your exact F12 import logic
3. Handles duplicates the same way your system does
4. Maintains your audit trail
"""

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
    print("❌ Supabase not installed. Run: pip install supabase")

class SupabaseImporter:
    """Import events using your exact Supabase structure"""
    
    def __init__(self):
        self.supabase_url = "https://xftiwouxpefchwoxxgpf.supabase.co"
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY', '')
        
        if not self.supabase_key:
            print("❌ SUPABASE_ANON_KEY not found!")
            print("Set it with: export SUPABASE_ANON_KEY=your_key_here")
            sys.exit(1)
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.stats = {
            'total_processed': 0,
            'new_events': 0,
            'updated_events': 0,
            'skipped_duplicates': 0,
            'errors': 0
        }
    
    def import_events_from_file(self, json_file: str):
        """Import events from collected JSON file"""
        print(f"📥 Importing events from: {json_file}")
        
        # Load events
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        events = data.get('events', [])
        print(f"Found {len(events)} events to process")
        
        # Process each event
        for event in events:
            try:
                self._import_single_event(event)
                self.stats['total_processed'] += 1
            except Exception as e:
                print(f"❌ Error importing {event.get('title', 'Unknown')}: {e}")
                self.stats['errors'] += 1
        
        # Print summary
        self._print_summary()
    
    def _import_single_event(self, event_data: Dict):
        """Import single event using your exact logic"""
        
        # Check for existing event (your duplicate detection logic)
        existing = self._find_existing_event(event_data)
        
        if existing:
            # Check if event has changes
            if self._event_has_changes(existing, event_data):
                self._update_event(existing['id'], event_data)
                self.stats['updated_events'] += 1
                print(f"🔄 Updated: {event_data['title']}")
            else:
                self.stats['skipped_duplicates'] += 1
                print(f"⏭️ Skipped duplicate: {event_data['title']}")
        else:
            # New event
            self._insert_new_event(event_data)
            self.stats['new_events'] += 1
            print(f"🆕 New: {event_data['title']}")
    
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
        """Check if event has meaningful changes"""
        fields_to_check = ['title', 'time', 'price', 'event_url']
        
        for field in fields_to_check:
            if existing.get(field) != new.get(field):
                return True
        
        return False
    
    def _insert_new_event(self, event_data: Dict):
        """Insert new event using your exact schema"""
        
        # Prepare event record (your exact format)
        event_record = {
            'gym_id': event_data['gym_id'],  # CCP, CPF, etc.
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
        
        # Insert into your events table
        result = self.supabase.table('events').insert(event_record).execute()
        
        if result.data:
            # Log to your audit system
            self._log_audit(
                result.data[0]['id'],
                event_data['gym_id'],
                'CREATE',
                'Auto-Import',
                event_data['title'],
                event_data['date']
            )
    
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
            # Log to your audit system
            self._log_audit(
                event_id,
                event_data['gym_id'],
                'UPDATE',
                'Auto-Import',
                event_data['title'],
                event_data['date']
            )
    
    def _log_audit(self, event_id: str, gym_id: str, action: str, changed_by: str, event_title: str, event_date: str):
        """Log to your existing audit system"""
        try:
            audit_record = {
                'event_id': event_id,
                'gym_id': gym_id,
                'action': action,
                'field_changed': 'auto_import',
                'old_value': 'Automated import',
                'new_value': 'Auto-Import',
                'changed_by': changed_by,
                'event_title': event_title,
                'event_date': event_date
            }
            
            self.supabase.table('event_audit_log').insert(audit_record).execute()
        except Exception as e:
            print(f"⚠️ Failed to log audit: {e}")
    
    def _print_summary(self):
        """Print import summary"""
        print("\n" + "="*60)
        print("📊 SUPABASE IMPORT SUMMARY")
        print("="*60)
        print(f"📥 Total Processed: {self.stats['total_processed']}")
        print(f"🆕 New Events: {self.stats['new_events']}")
        print(f"🔄 Updated Events: {self.stats['updated_events']}")
        print(f"⏭️ Skipped Duplicates: {self.stats['skipped_duplicates']}")
        print(f"❌ Errors: {self.stats['errors']}")
        print("="*60)

def main():
    """Main execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import events to your Supabase')
    parser.add_argument('json_file', help='JSON file with collected events')
    
    args = parser.parse_args()
    
    if not SUPABASE_AVAILABLE:
        print("❌ Supabase package not available. Install with: pip install supabase")
        return
    
    # Import events
    importer = SupabaseImporter()
    importer.import_events_from_file(args.json_file)
    
    print("\n✅ Import complete! Check your Master Events Calendar for new events.")

if __name__ == "__main__":
    main()

