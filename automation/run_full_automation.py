#!/usr/bin/env python3
"""
🚀 COMPLETE AUTOMATION WORKFLOW
Master Events Calendar - Full Automation System

This script runs the complete automation process:
1. Collects events from all 10 gyms automatically
2. Imports them into your Supabase database
3. Handles duplicates and updates
4. Maintains audit trails
5. Can be scheduled to run daily/weekly

Usage:
    python run_full_automation.py
    python run_full_automation.py --schedule daily
    python run_full_automation.py --gym CCP --dry-run
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
import logging
import argparse

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from auto_collect_events import MasterEventsCollector
from supabase_integration import SupabaseEventImporter, SupabaseConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('automation/full_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class FullAutomationWorkflow:
    """Complete automation workflow for Master Events Calendar"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.workflow_stats = {
            'start_time': datetime.now(),
            'collection_time': 0,
            'import_time': 0,
            'total_events': 0,
            'new_events': 0,
            'updated_events': 0,
            'errors': 0
        }
    
    async def run_complete_workflow(self, specific_gym: str = None):
        """Run the complete automation workflow"""
        logger.info("🚀 Starting Master Events Calendar Full Automation")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE IMPORT'}")
        
        try:
            # Step 1: Collect events from gyms
            logger.info("📥 Step 1: Collecting events from gyms...")
            collection_start = datetime.now()
            
            async with MasterEventsCollector() as collector:
                if specific_gym:
                    events = await collector.collect_gym_events(specific_gym.upper())
                else:
                    events = await collector.collect_all_gyms()
            
            collection_time = (datetime.now() - collection_start).total_seconds()
            self.workflow_stats['collection_time'] = collection_time
            self.workflow_stats['total_events'] = len(events)
            
            logger.info(f"✅ Collection complete: {len(events)} events in {collection_time:.1f}s")
            
            if not events:
                logger.warning("⚠️ No events collected. Check gym configurations.")
                return
            
            # Step 2: Save events to JSON file
            logger.info("💾 Step 2: Saving events to JSON...")
            json_file = collector.save_events_json()
            
            if self.dry_run:
                logger.info("🔍 DRY RUN: Would import events but skipping database operations")
                collector.print_summary()
                return
            
            # Step 3: Import into Supabase database
            logger.info("🔗 Step 3: Importing into Supabase database...")
            import_start = datetime.now()
            
            # Load Supabase configuration
            config = SupabaseConfig.from_env()
            if not config.key:
                logger.error("❌ Supabase key not found. Set SUPABASE_ANON_KEY environment variable.")
                return
            
            # Import events
            importer = SupabaseEventImporter(config)
            import_stats = await importer.import_events_from_file(json_file)
            
            import_time = (datetime.now() - import_start).total_seconds()
            self.workflow_stats['import_time'] = import_time
            self.workflow_stats['new_events'] = import_stats['new_events']
            self.workflow_stats['updated_events'] = import_stats['updated_events']
            self.workflow_stats['errors'] = import_stats['errors']
            
            logger.info(f"✅ Import complete: {import_stats['new_events']} new, {import_stats['updated_events']} updated in {import_time:.1f}s")
            
            # Step 4: Print final summary
            self._print_final_summary()
            
        except Exception as e:
            logger.error(f"❌ Automation workflow failed: {e}")
            self.workflow_stats['errors'] += 1
            raise
    
    def _print_final_summary(self):
        """Print final workflow summary"""
        total_time = (datetime.now() - self.workflow_stats['start_time']).total_seconds()
        
        print("\n" + "="*70)
        print("🎯 MASTER EVENTS CALENDAR - AUTOMATION COMPLETE")
        print("="*70)
        print(f"⏱️ Total Time: {total_time:.1f} seconds")
        print(f"📥 Collection Time: {self.workflow_stats['collection_time']:.1f}s")
        print(f"🔗 Import Time: {self.workflow_stats['import_time']:.1f}s")
        print(f"📊 Total Events: {self.workflow_stats['total_events']}")
        print(f"🆕 New Events: {self.workflow_stats['new_events']}")
        print(f"🔄 Updated Events: {self.workflow_stats['updated_events']}")
        print(f"❌ Errors: {self.workflow_stats['errors']}")
        
        if self.workflow_stats['errors'] == 0:
            print("✅ SUCCESS: All events processed without errors!")
        else:
            print(f"⚠️ WARNING: {self.workflow_stats['errors']} errors occurred")
        
        print("="*70)
        print("🚀 Your Master Events Calendar is now updated!")
        print("🌐 Check your app at: https://master-events-calendar.vercel.app")

async def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description='Master Events Calendar Full Automation')
    parser.add_argument('--dry-run', action='store_true', help='Run without importing to database')
    parser.add_argument('--gym', help='Run for specific gym only (CCP, CPF, etc.)')
    parser.add_argument('--schedule', choices=['daily', 'weekly'], help='Schedule mode')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize workflow
    workflow = FullAutomationWorkflow(dry_run=args.dry_run)
    
    # Run automation
    await workflow.run_complete_workflow(specific_gym=args.gym)
    
    # Schedule mode
    if args.schedule:
        logger.info(f"📅 Schedule mode: {args.schedule}")
        if args.schedule == 'daily':
            logger.info("🔄 Would run daily at 6:00 AM")
        elif args.schedule == 'weekly':
            logger.info("🔄 Would run weekly on Mondays at 6:00 AM")

if __name__ == "__main__":
    asyncio.run(main())

