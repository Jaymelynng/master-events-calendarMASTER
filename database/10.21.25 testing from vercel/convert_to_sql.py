#!/usr/bin/env python3
"""
Convert consolidated_events.json to SQL INSERT statements
"""

import json
import re

def clean_string(text):
    """Clean string for SQL insertion"""
    if text is None:
        return None
    # Escape single quotes and handle None values
    return str(text).replace("'", "''")

def convert_json_to_sql():
    # Read the JSON file
    with open('consolidated_events.json', 'r', encoding='utf-8') as f:
        events = json.load(f)
    
    print(f"-- Consolidated Events SQL Insert")
    print(f"-- Total events: {len(events)}")
    print(f"-- Generated from consolidated_events.json")
    print()
    
    # Start the INSERT statement
    print("INSERT INTO \"public\".\"events\" (\"gym_id\", \"title\", \"date\", \"time\", \"price\", \"day_of_week\", \"type\", \"event_url\", \"start_date\", \"end_date\", \"availability_status\") VALUES")
    
    sql_values = []
    
    for i, event in enumerate(events):
        # Extract and clean values
        gym_id = clean_string(event.get('gym_id'))
        title = clean_string(event.get('title'))
        date = clean_string(event.get('date'))
        time = clean_string(event.get('time'))
        price = clean_string(event.get('price')) if event.get('price') and event.get('price') != "" else None
        day_of_week = clean_string(event.get('day_of_week')) if event.get('day_of_week') != "None" else None
        event_type = clean_string(event.get('type'))
        event_url = clean_string(event.get('url'))
        start_date = clean_string(event.get('start_date'))
        end_date = clean_string(event.get('end_date'))
        
        # Set default availability status
        availability_status = "available"
        
        # Create the VALUES clause
        value_clause = f"('{gym_id}', '{title}', '{date}', '{time}', {f"'{price}'" if price else 'null'}, {f"'{day_of_week}'" if day_of_week else 'null'}, '{event_type}', '{event_url}', '{start_date}', '{end_date}', '{availability_status}')"
        
        sql_values.append(value_clause)
    
    # Join all values with commas
    print(",\n".join(sql_values) + ";")
    
    print()
    print(f"-- Total events inserted: {len(events)}")

if __name__ == "__main__":
    convert_json_to_sql()










