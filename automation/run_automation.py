#!/usr/bin/env python3
"""
🚀 COMPLETE AUTOMATION WORKFLOW
Runs both collection and import in one command

Usage:
    python run_automation.py
    python run_automation.py --dry-run
    python run_automation.py --gym CCP
"""

import asyncio
import os
import sys
from datetime import datetime

# Import our automation modules
from quick_automation import QuickAutomation
from import_to_supabase import SupabaseImporter

async def run_complete_automation(specific_gym=None, dry_run=False):
    """Run the complete automation workflow"""
    
    print("MASTER EVENTS CALENDAR - COMPLETE AUTOMATION")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE IMPORT'}")
    if specific_gym:
        print(f"Gym: {specific_gym}")
    print("=" * 60)
    
    # Step 1: Collect events
    print("\nStep 1: Collecting events from gyms...")
    
    async with QuickAutomation() as automation:
        if specific_gym:
            # Collect from specific gym only
            gym_info = automation.GYMS.get(specific_gym.upper())
            if not gym_info:
                print(f"ERROR: Unknown gym: {specific_gym}")
                return
            
            print(f"Collecting from {gym_info['name']} ({specific_gym})...")
            events = await automation._collect_gym_events(specific_gym.upper(), gym_info['subdomain'])
            automation.collected_events = events
        else:
            # Collect from all gyms
            events = await automation.collect_all_events()
        
        if not events:
            print("ERROR: No events collected. Check gym connections.")
            return
        
        # Save events
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"automated_events_{timestamp}.json"
        filepath = automation.save_events(filename)
        
        print(f"SUCCESS: Collection complete: {len(events)} events saved to {filepath}")
    
    # Step 2: Import to Supabase (if not dry run)
    if not dry_run:
        print("\nStep 2: Importing to Supabase database...")
        
        try:
            importer = SupabaseImporter()
            importer.import_events_from_file(filepath)
            print("SUCCESS: Import complete!")
        except Exception as e:
            print(f"ERROR: Import failed: {e}")
            return
    else:
        print("\nDRY RUN: Skipping database import")
        print(f"Events saved to: {filepath}")
        print(f"To import: python import_to_supabase.py {filepath}")
    
    print("\nAUTOMATION COMPLETE!")
    print("Your Master Events Calendar is now updated!")

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Master Events Calendar Automation')
    parser.add_argument('--dry-run', action='store_true', help='Test without importing to database')
    parser.add_argument('--gym', help='Run for specific gym only (CCP, CPF, etc.)')
    
    args = parser.parse_args()
    
    # Check for Supabase key
    if not args.dry_run and not os.getenv('SUPABASE_ANON_KEY'):
        print("❌ SUPABASE_ANON_KEY not found!")
        print("Set it with: export SUPABASE_ANON_KEY=your_key_here")
        print("Or run with --dry-run to test collection only")
        return
    
    # Run automation
    asyncio.run(run_complete_automation(
        specific_gym=args.gym,
        dry_run=args.dry_run
    ))

if __name__ == "__main__":
    main()
