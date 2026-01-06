#!/usr/bin/env python3
"""
Export pricing audit report to CSV for sharing with gyms.
"""

import json
import re
import csv
from collections import defaultdict

def extract_prices_from_text(text):
    """Extract all dollar amounts from text."""
    if not text:
        return []
    prices = re.findall(r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    return [float(p.replace(',', '')) for p in prices]

# Gym name mapping
GYM_NAMES = {
    'CCP': 'Capital Gymnastics - Cedar Park',
    'CPF': 'Capital Gymnastics - Pflugerville', 
    'CRR': 'Capital Gymnastics - Round Rock',
    'EST': 'Estrella Gymnastics',
    'HGA': 'Houston Gymnastics Academy',
    'OAS': 'Oasis Gymnastics',
    'RBA': 'Rowland Ballard - Atascocita',
    'RBK': 'Rowland Ballard - Kingwood',
    'SGT': 'Scottsdale Gymnastics',
    'TIG': 'TIGAR Gymnastics'
}

def main():
    json_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T164936.423.json'
    output_path = r'C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar\exports\price_audit_report.csv'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to special events only
    special_events = [e for e in data if e.get('type') in ['CAMP', 'CLINIC', 'KIDS NIGHT OUT', 'OPEN GYM']]
    
    # Collect all events with issues
    rows = []
    
    for e in special_events:
        gym_code = e.get('gym_id', 'unknown')
        gym_name = GYM_NAMES.get(gym_code, gym_code)
        title = e.get('title', '')
        date = e.get('date', '')
        etype = e.get('type', '')
        desc = e.get('description', '') or ''
        price_field = e.get('price')
        time_field = e.get('time', '')
        url = e.get('event_url', '')
        
        # Clean title for CSV
        clean_title = title.encode('ascii', 'ignore').decode('ascii')
        
        # Determine issue type
        issue = None
        if not desc or len(desc.strip()) < 10:
            issue = "NO DESCRIPTION"
        else:
            desc_prices = extract_prices_from_text(desc)
            if not desc_prices:
                issue = "MISSING PRICE IN DESCRIPTION"
        
        if issue:
            rows.append({
                'Gym': gym_name,
                'Gym Code': gym_code,
                'Issue': issue,
                'Event Type': etype,
                'Date': date,
                'Time': time_field,
                'Title': clean_title,
                'Price in System': f"${price_field}" if price_field else "None",
                'iClassPro URL': url
            })
    
    # Sort by gym, then by issue type, then by date
    rows.sort(key=lambda x: (x['Gym'], x['Issue'], x['Date']))
    
    # Write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'Gym', 'Gym Code', 'Issue', 'Event Type', 'Date', 'Time', 'Title', 'Price in System', 'iClassPro URL'
        ])
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"CSV exported to: {output_path}")
    print(f"Total events with issues: {len(rows)}")
    
    # Summary by gym
    print("\nSummary by Gym:")
    gym_counts = defaultdict(lambda: {'NO DESCRIPTION': 0, 'MISSING PRICE IN DESCRIPTION': 0})
    for row in rows:
        gym_counts[row['Gym']][row['Issue']] += 1
    
    for gym in sorted(gym_counts.keys()):
        counts = gym_counts[gym]
        total = counts['NO DESCRIPTION'] + counts['MISSING PRICE IN DESCRIPTION']
        print(f"  {gym}: {total} issues ({counts['NO DESCRIPTION']} no desc, {counts['MISSING PRICE IN DESCRIPTION']} missing price)")

if __name__ == "__main__":
    main()

