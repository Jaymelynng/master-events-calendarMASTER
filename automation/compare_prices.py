#!/usr/bin/env python3
"""Compare Supabase event data against known pricing mismatches."""

import json
import sys

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("=== CHECKING KNOWN PRICE MISMATCHES ===")
    print()
    
    # Known mismatches to check:
    mismatches_to_check = [
        ("CPF", "OPEN GYM", "Pflugerville", "desc says $25, iClass $20"),
        ("RBA", "OPEN GYM", "Atascocita", "inconsistent $25/$20"),
        ("SGT", "OPEN GYM", "Scottsdale", "desc says $30, iClass $20"),
        ("CCP", "CLINIC", "Cedar Park", "desc says $30, iClass $25"),
        ("SGT", "CLINIC", "Scottsdale", "desc says $20, iClass $25"),
    ]
    
    for gym_id, event_type, gym_name, issue in mismatches_to_check:
        print(f"--- {gym_id} ({gym_name}) {event_type} ---")
        print(f"Known issue: {issue}")
        print()
        
        events = [e for e in data if e.get('gym_id') == gym_id and e.get('type') == event_type]
        
        if not events:
            print("  No events found in database!")
        else:
            for e in events:
                title = e.get('title', 'No title')
                if len(title) > 70:
                    title = title[:70] + "..."
                price = e.get('price', 'N/A')
                date = e.get('date', 'N/A')
                desc = e.get('description', '')
                
                # Try to find price mentioned in description
                import re
                desc_prices = re.findall(r'\$(\d+)', desc[:500] if desc else '')
                
                print(f"  Title: {title}")
                print(f"  Date: {date}")
                print(f"  Price field: ${price}")
                print(f"  Prices in description: {desc_prices[:5] if desc_prices else 'None found'}")
                print()
        
        print("-" * 60)
        print()

if __name__ == "__main__":
    main()

