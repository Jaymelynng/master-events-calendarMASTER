#!/usr/bin/env python3
"""
Local API Server for F12 Event Collection
Runs your working Playwright script and exposes it as an API endpoint
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import sys
import os
import asyncio
from pathlib import Path
from datetime import date, datetime
from typing import Optional

try:
    from supabase import create_client, Client  # type: ignore
except ImportError:
    create_client = None
    Client = None

# Import your working script functions
sys.path.insert(0, str(Path(__file__).parent))

# We'll need to import the functions from your working script
# For now, let's create a wrapper that calls it

app = Flask(__name__)
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', 'https://teamcalendar.mygymtools.com').split(',')
if not os.environ.get('PORT'):
    ALLOWED_ORIGINS.append('http://localhost:3000')
CORS(app, origins=ALLOWED_ORIGINS)

# API Key authentication
API_KEY = os.environ.get('API_KEY', '')  # Get from environment variable

# Supabase client configuration (used for imports)
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = (
    os.environ.get('SUPABASE_SERVICE_KEY')
    or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    or os.environ.get('SUPABASE_ANON_KEY')
)

supabase_client: Optional[Client] = None
if create_client and SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as supabase_err:  # pragma: no cover - defensive logging
        print(f"⚠️  Failed to initialize Supabase client: {supabase_err}")

def check_api_key():
    """Check if request has valid API key"""
    if not API_KEY:
        return True  # No API key set = allow all (for local dev)
    
    provided_key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if provided_key == API_KEY:
        return True
    
    return False

def get_supabase_client():
    """Ensure we have a Supabase client configured."""
    if not create_client:
        raise RuntimeError("Supabase client library not installed. Run: pip install supabase")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_KEY) are not configured.")
    if supabase_client is None:
        raise RuntimeError("Supabase client failed to initialize. Check server logs for details.")
    return supabase_client

def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip()
    return value

COMPARISON_FIELDS = [
    'title',
    'date',
    'start_date',
    'end_date',
    'time',
    'price',
    'day_of_week',
    'type',
    'age_min',
    'age_max',
    'description',
    'availability_status',
    # Data quality validation fields
    'has_flyer',
    'flyer_url',
    'description_status',
    'validation_errors',
    # Availability tracking from iClassPro
    'has_openings',
    'registration_start_date',
    'registration_end_date'
]

ALLOWED_EVENT_FIELDS = {
    'gym_id',
    'event_type_id',
    'title',
    'date',
    'time',
    'price',
    'day_of_week',
    'type',
    'event_url',
    'start_date',
    'end_date',
    'availability_status',
    'age_min',
    'age_max',
    'description',
    'event_type',
    'event_id',
    'gym_code',
    'age',
    'age_range',
    'capacity',
    'spots_remaining',
    'location',
    'registration_url',
    # Data quality validation fields
    'has_flyer',
    'flyer_url',
    'description_status',
    'validation_errors',
    # Availability tracking from iClassPro
    'has_openings',
    'registration_start_date',
    'registration_end_date'
}

def sanitize_event_payload(event: dict, gym_id: str, event_type: str) -> dict:
    """Prepare an event record for insertion/updating in Supabase."""
    sanitized = {}
    for field in ALLOWED_EVENT_FIELDS:
        if field in event:
            value = event[field]
            sanitized[field] = None if value in ['', None] else value
    sanitized['gym_id'] = gym_id
    sanitized['type'] = event_type
    sanitized.setdefault('event_type', event.get('event_type') or event_type)
    sanitized.setdefault('start_date', event.get('start_date') or event.get('date'))
    sanitized.setdefault('end_date', event.get('end_date') or sanitized.get('start_date') or event.get('date'))
    sanitized.setdefault('event_url', event.get('event_url'))
    sanitized.setdefault('day_of_week', event.get('day_of_week'))
    sanitized['deleted_at'] = None
    return sanitized

def events_differ(existing: dict, incoming: dict, force_update: bool = False) -> bool:
    """Compare key fields to determine if an update is required."""
    # Force update always returns True - useful for re-applying validation
    if force_update:
        return True
    
    for field in COMPARISON_FIELDS:
        existing_val = normalize_value(existing.get(field))
        incoming_val = normalize_value(incoming.get(field))
        
        # Special handling for validation_errors (JSON arrays)
        if field == 'validation_errors':
            import json
            existing_json = json.dumps(existing_val, sort_keys=True) if existing_val else '[]'
            incoming_json = json.dumps(incoming_val, sort_keys=True) if incoming_val else '[]'
            if existing_json != incoming_json:
                return True
        elif existing_val != incoming_val:
            return True
    
    # Restore if previously deleted
    if existing.get('deleted_at') is not None:
        return True
    return False

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({"status": "ok", "message": "F12 API server is running", "endpoints": ["/health", "/sync-events"]})

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint (no auth required)"""
    return jsonify({"status": "ok", "message": "Local F12 API server is running"})

@app.route('/sync-events', methods=['POST'])
def sync_events():
    """
    Sync events for a specific gym and event type
    Expects JSON: { "gymId": "RBA", "eventType": "KIDS NIGHT OUT" }
    For ALL programs: { "gymId": "RBA", "eventType": "ALL" }
    Requires API key in header: X-API-Key or query param: api_key
    """
    # Check API key
    if not check_api_key():
        return jsonify({
            "success": False,
            "error": "Invalid or missing API key"
        }), 401
    
    try:
        data = request.get_json()
        gym_id = data.get('gymId')
        event_type = data.get('eventType')
        
        if not gym_id or not event_type:
            return jsonify({
                "success": False,
                "error": "Missing gymId or eventType"
            }), 400
        
        # Import your working script
        from f12_collect_and_import import (
            collect_events_via_f12,
            convert_event_dicts_to_flat,
            GYMS
        )
        
        if gym_id not in GYMS:
            return jsonify({
                "success": False,
                "error": f"Unknown gym ID: {gym_id}"
            }), 400
        
        print(f"\n{'='*60}")
        print(f"SYNC REQUEST: {gym_id} - {event_type}")
        print(f"{'='*60}\n")
        
        slug = GYMS[gym_id]["slug"]
        
        # Special handling for "ALL" - sync all program types
        if event_type == "ALL":
            result_data = asyncio.run(collect_events_via_f12(gym_id=gym_id, camp_type="ALL"))
            
            # Handle new return format: {'events': {...}, 'checked_types': [...]}
            if isinstance(result_data, dict) and 'events' in result_data:
                results = result_data.get('events', {})
                checked_types = result_data.get('checked_types', [])
            else:
                # Fallback for old format
                results = result_data if result_data else {}
                checked_types = list(results.keys()) if results else []
            
            if not results:
                return jsonify({
                    "success": True,
                    "noEvents": True,
                    "gymId": gym_id,
                    "eventType": "ALL",
                    "eventsFound": 0,
                    "eventsByType": {},
                    "checkedTypes": checked_types,
                    "message": "No events currently scheduled for this gym."
                }), 200
            
            # Convert each event type to flat format
            events_by_type = {}
            total_events = 0
            
            for et, events_raw in results.items():
                events_flat = convert_event_dicts_to_flat(
                    events=events_raw,
                    gym_id=gym_id,
                    portal_slug=slug,
                    camp_type_label=et,
                )
                events_by_type[et] = events_flat
                total_events += len(events_flat)
            
            print(f"\n✅ Collected {total_events} total events across {len(events_by_type)} types")
            print(f"✅ Checked types: {checked_types}")
            
            return jsonify({
                "success": True,
                "gymId": gym_id,
                "eventType": "ALL",
                "eventsFound": total_events,
                "eventsByType": events_by_type,
                "checkedTypes": checked_types,
                "message": f"Successfully collected {total_events} events across {len(events_by_type)} program types"
            })
        
        # Standard single event type handling
        events_raw = asyncio.run(collect_events_via_f12(gym_id=gym_id, camp_type=event_type))
        
        if not events_raw:
            return jsonify({
                "success": True,
                "noEvents": True,
                "gymId": gym_id,
                "eventType": event_type,
                "eventsFound": 0,
                "events": [],
                "message": f"No {event_type} events currently scheduled for this gym."
            }), 200
        
        # Step 2: Convert to flat format (your existing function)
        events_flat = convert_event_dicts_to_flat(
            events=events_raw,
            gym_id=gym_id,
            portal_slug=slug,
            camp_type_label=event_type,
        )
        
        print(f"\n✅ Collected {len(events_flat)} events")
        
        return jsonify({
            "success": True,
            "gymId": gym_id,
            "eventType": event_type,
            "eventsFound": len(events_flat),
            "events": events_flat,
            "message": f"Successfully collected {len(events_flat)} events"
        })
        
    except ImportError as e:
        return jsonify({
            "success": False,
            "error": f"Could not import f12_collect_and_import script: {str(e)}"
        }), 500
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        # Don't crash the server - return error response
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500

@app.route('/import-events', methods=['POST'])
def import_events():
    """
    Import collected events into Supabase.
    Body: {
      "gymId": "EST",
      "eventType": "CLINIC",
      "events": [...],
      "forceUpdate": false  // Optional: force update all events even if unchanged
    }
    """
    if not check_api_key():
        return jsonify({
            "success": False,
            "error": "Invalid or missing API key"
        }), 401

    try:
        client = get_supabase_client()
    except RuntimeError as err:
        return jsonify({
            "success": False,
            "error": str(err)
        }), 500

    try:
        payload = request.get_json() or {}
        events = payload.get('events') or []
        gym_id = payload.get('gymId')
        event_type = payload.get('eventType')
        force_update = payload.get('forceUpdate', False)  # Force re-import even if "same"

        if not gym_id or not event_type:
            return jsonify({
                "success": False,
                "error": "Missing gymId or eventType"
            }), 400

        if not events:
            return jsonify({
                "success": False,
                "error": "No events provided for import"
            }), 400

        today_str = date.today().isoformat()
        existing_response = client.table('events') \
            .select('*') \
            .eq('gym_id', gym_id) \
            .eq('type', event_type) \
            .gte('date', today_str) \
            .execute()

        if getattr(existing_response, 'error', None):
            raise RuntimeError(existing_response.error.message)

        existing_events = existing_response.data or []
        existing_by_url = {
            ev['event_url']: ev
            for ev in existing_events
            if ev.get('event_url')
        }

        new_records = []
        updates = []
        skipped = 0
        restored = 0

        for event in events:
            event_url = event.get('event_url')
            if not event_url:
                skipped += 1
                continue

            sanitized = sanitize_event_payload(event, gym_id, event_type)
            if not sanitized.get('event_url'):
                skipped += 1
                continue

            existing_event = existing_by_url.get(event_url)
            if not existing_event:
                new_records.append(sanitized)
            else:
                if events_differ(existing_event, sanitized, force_update=force_update):
                    update_payload = sanitized.copy()
                    update_payload.pop('event_url', None)
                    update_payload.pop('created_at', None)
                    update_payload.pop('id', None)
                    updates.append((existing_event['id'], update_payload))
                    if existing_event.get('deleted_at') is not None:
                        restored += 1

        inserted_count = 0
        if new_records:
            insert_response = client.table('events').insert(new_records).execute()
            if getattr(insert_response, 'error', None):
                raise RuntimeError(insert_response.error.message)
            inserted_count = len(insert_response.data or [])

        updated_count = 0
        for record_id, update_payload in updates:
            update_response = client.table('events').update(update_payload).eq('id', record_id).execute()
            if getattr(update_response, 'error', None):
                raise RuntimeError(update_response.error.message)
            updated_count += len(update_response.data or [])

        # Soft-delete: mark events that are in Supabase but NOT in scraped results
        deleted_count = 0
        scraped_urls = set(ev.get('event_url') for ev in events if ev.get('event_url'))
        if scraped_urls:  # Only delete if we actually got events (prevents wiping on scraper failure)
            stale_events = [
                ev for ev in existing_events
                if ev.get('event_url')
                and ev['event_url'] not in scraped_urls
                and not ev.get('deleted_at')  # Don't re-delete
            ]
            if stale_events:
                stale_ids = [ev['id'] for ev in stale_events]
                now_str = datetime.utcnow().isoformat()
                for stale_id in stale_ids:
                    client.table('events').update({
                        'deleted_at': now_str
                    }).eq('id', stale_id).execute()
                deleted_count = len(stale_ids)
                for ev in stale_events:
                    print(f"  [SOFT-DELETE] {ev.get('title', 'unknown')} (URL: {ev.get('event_url')})")

        return jsonify({
            "success": True,
            "imported": inserted_count,
            "updated": updated_count,
            "restored": restored,
            "deleted": deleted_count,
            "skipped": skipped,
            "totalProcessed": len(events),
            "message": f"Imported {inserted_count} new / updated {updated_count} / deleted {deleted_count} events"
        })

    except Exception as e:
        print(f"IMPORT ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Import error: {str(e)}"
        }), 500

@app.route('/gyms', methods=['GET'])
def get_gyms():
    """Get list of available gyms"""
    try:
        from f12_collect_and_import import GYMS
        gyms = [{"id": k, "name": v["name"], "slug": v["slug"]} for k, v in GYMS.items()]
        return jsonify({"success": True, "gyms": gyms})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/event-types', methods=['GET'])
def get_event_types():
    """Get list of available event types for a gym"""
    try:
        from f12_collect_and_import import EVENT_TYPE_URLS
        gym_id = request.args.get('gymId')
        
        if gym_id:
            # Return event types available for this gym
            available = [et for et, gyms in EVENT_TYPE_URLS.items() if gym_id in gyms]
            return jsonify({"success": True, "eventTypes": available})
        else:
            # Return all event types
            all_types = list(EVENT_TYPE_URLS.keys())
            return jsonify({"success": True, "eventTypes": all_types})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    import os
    
    # Railway provides PORT environment variable, default to 5000 for local
    port = int(os.environ.get('PORT', 5000))
    host = '0.0.0.0' if os.environ.get('PORT') else '127.0.0.1'  # 0.0.0.0 for Railway, 127.0.0.1 for local
    debug = not bool(os.environ.get('PORT'))  # Debug only in local development
    
    print("\n" + "="*60)
    print("🚀 F12 API SERVER")
    print("="*60)
    if os.environ.get('PORT'):
        print(f"Starting server on port {port} (Railway)")
    else:
        print("Starting server on http://localhost:5000 (Local)")
    print("Make sure Playwright is installed: pip install playwright")
    print("And browsers are installed: playwright install chromium")
    print("="*60 + "\n")
    
    app.run(host=host, port=port, debug=debug)

