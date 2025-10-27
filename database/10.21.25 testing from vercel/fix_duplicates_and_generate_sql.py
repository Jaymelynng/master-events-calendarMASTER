#!/usr/bin/env python3
"""
Fix Duplicates and Generate Clean SQL
=====================================

This script:
1. Reads the consolidated_events.json file
2. Removes any remaining duplicate URLs
3. Generates a clean SQL INSERT script with proper ON CONFLICT handling
4. Ensures no duplicate key violations
"""

import json
import re
from urllib.parse import urlparse, parse_qs
from collections import defaultdict

def clean_url(url):
    """Clean URL by removing query parameters for duplicate detection"""
    if not url:
        return ""
    # Remove query parameters for duplicate detection
    base_url = url.split('?')[0]
    return base_url

def load_events_data():
    """Load the consolidated events JSON data"""
    try:
        with open('consolidated_events.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ consolidated_events.json not found!")
        return []
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        return []

def remove_duplicates(events):
    """Remove duplicate events based on URL and other criteria"""
    seen_urls = set()
    seen_combinations = set()
    unique_events = []
    duplicates_removed = 0
    
    for event in events:
        # Clean the URL for comparison
        clean_url_val = clean_url(event.get('url', ''))
        
        # Create a unique combination for more thorough duplicate detection
        combination_key = (
            event.get('title', '').strip().lower(),
            event.get('date', ''),
            event.get('time', ''),
            clean_url_val
        )
        
        # Check for URL duplicates first
        if clean_url_val and clean_url_val in seen_urls:
            print(f"Removing duplicate URL: {clean_url_val}")
            duplicates_removed += 1
            continue
            
        # Check for combination duplicates
        if combination_key in seen_combinations:
            print(f"Removing duplicate combination: {event.get('title', '')[:50]}...")
            duplicates_removed += 1
            continue
        
        # Add to seen sets
        if clean_url_val:
            seen_urls.add(clean_url_val)
        seen_combinations.add(combination_key)
        unique_events.append(event)
    
    print(f"Removed {duplicates_removed} duplicate events")
    print(f"{len(unique_events)} unique events remaining")
    return unique_events

def escape_sql_string(value):
    """Escape SQL string values"""
    if value is None:
        return 'NULL'
    if isinstance(value, str):
        # Escape single quotes and backslashes
        escaped = value.replace("'", "''").replace("\\", "\\\\")
        return f"'{escaped}'"
    return str(value)

def generate_sql_insert(events):
    """Generate SQL INSERT statements with ON CONFLICT handling"""
    
    sql_lines = [
        "-- Clean SQL INSERT for consolidated events",
        "-- Generated with duplicate handling",
        "",
        "-- First, let's check for existing events with the same URLs",
        "DO $$",
        "DECLARE",
        "    existing_count INTEGER;",
        "BEGIN",
        "    -- Count existing events that might conflict",
        "    SELECT COUNT(*) INTO existing_count",
        "    FROM events",
        "    WHERE event_url IN (",
    ]
    
    # Add all URLs to the WHERE clause
    urls = [event.get('url', '') for event in events if event.get('url')]
    if urls:
        url_list = ",\n        ".join([f"'{url}'" for url in urls])
        sql_lines.append(f"        {url_list}")
    
    sql_lines.extend([
        "    );",
        "    ",
        "    IF existing_count > 0 THEN",
        "        RAISE NOTICE 'Found % existing events with matching URLs', existing_count;",
        "        RAISE NOTICE 'These will be skipped to avoid duplicates';",
        "    END IF;",
        "END $$;",
        "",
        "-- Insert new events, skipping duplicates",
        "INSERT INTO events (gym_id, title, date, time, price, day_of_week, type, event_url, start_date, end_date, availability_status)",
        "VALUES"
    ])
    
    # Generate VALUES clauses
    value_clauses = []
    for i, event in enumerate(events):
        # Clean and prepare values
        gym_id = escape_sql_string(event.get('gym_id', ''))
        title = escape_sql_string(event.get('title', ''))
        date = escape_sql_string(event.get('date', ''))
        time = escape_sql_string(event.get('time', ''))
        price = event.get('price', '')
        if price and price != '':
            try:
                price = float(price)
                price = f"{price:.2f}" if price > 0 else 'NULL'
            except (ValueError, TypeError):
                price = 'NULL'
        else:
            price = 'NULL'
        
        day_of_week = escape_sql_string(event.get('day_of_week', ''))
        event_type = escape_sql_string(event.get('type', ''))
        event_url = escape_sql_string(event.get('url', ''))
        start_date = escape_sql_string(event.get('start_date', event.get('date', '')))
        end_date = escape_sql_string(event.get('end_date', event.get('date', '')))
        availability_status = escape_sql_string(event.get('availability_status', 'available'))
        
        # Create VALUES clause
        value_clause = f"    ({gym_id}, {title}, {date}, {time}, {price}, {day_of_week}, {event_type}, {event_url}, {start_date}, {end_date}, {availability_status})"
        
        # Add comma except for last item
        if i < len(events) - 1:
            value_clause += ","
        else:
            value_clause += ";"
            
        value_clauses.append(value_clause)
    
    sql_lines.extend(value_clauses)
    
    # Add ON CONFLICT handling
    sql_lines.extend([
        "",
        "-- Handle conflicts by skipping duplicates",
        "ON CONFLICT (event_url) DO NOTHING;",
        "",
        "-- Show results",
        "SELECT COUNT(*) as total_events_inserted FROM events;",
        "",
        "-- Check for any remaining duplicates",
        "SELECT event_url, COUNT(*) as duplicate_count",
        "FROM events",
        "GROUP BY event_url",
        "HAVING COUNT(*) > 1;"
    ])
    
    return "\n".join(sql_lines)

def main():
    print("Fixing Duplicates and Generating Clean SQL")
    print("=" * 50)
    
    # Load events data
    events = load_events_data()
    if not events:
        print("ERROR: No events data found!")
        return
    
    print(f"Loaded {len(events)} events from JSON")
    
    # Remove duplicates
    unique_events = remove_duplicates(events)
    
    # Save cleaned data
    with open('consolidated_events_no_duplicates.json', 'w', encoding='utf-8') as f:
        json.dump(unique_events, f, indent=2, ensure_ascii=False)
    print("Saved cleaned data to consolidated_events_no_duplicates.json")
    
    # Generate SQL
    sql_content = generate_sql_insert(unique_events)
    
    # Save SQL file
    with open('consolidated_events_clean_insert.sql', 'w', encoding='utf-8') as f:
        f.write(sql_content)
    print("Generated consolidated_events_clean_insert.sql")
    
    # Show summary
    print("\nSUMMARY:")
    print(f"   Original events: {len(events)}")
    print(f"   Unique events: {len(unique_events)}")
    print(f"   Duplicates removed: {len(events) - len(unique_events)}")
    print(f"   SQL file: consolidated_events_clean_insert.sql")
    print(f"   Clean JSON: consolidated_events_no_duplicates.json")
    
    print("\nReady to run the SQL file in your database!")

if __name__ == "__main__":
    main()
