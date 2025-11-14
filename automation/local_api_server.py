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
from datetime import date

# Import your working script functions
sys.path.insert(0, str(Path(__file__).parent))

# We'll need to import the functions from your working script
# For now, let's create a wrapper that calls it

app = Flask(__name__)
CORS(app)  # Allow your React app to call this

# API Key authentication
API_KEY = os.environ.get('API_KEY', '')  # Get from environment variable

def check_api_key():
    """Check if request has valid API key"""
    if not API_KEY:
        return True  # No API key set = allow all (for local dev)
    
    provided_key = request.headers.get('X-API-Key') or request.args.get('api_key')
    if provided_key == API_KEY:
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
        
        # Step 1: Collect raw events using your working script (async function)
        events_raw = asyncio.run(collect_events_via_f12(gym_id=gym_id, camp_type=event_type))
        
        if not events_raw:
            return jsonify({
                "success": False,
                "error": "No events collected. Check if the gym/event type combination is correct.",
                "events": []
            }), 200
        
        # Step 2: Convert to flat format (your existing function)
        slug = GYMS[gym_id]["slug"]
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

