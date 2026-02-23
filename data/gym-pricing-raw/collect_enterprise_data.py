#!/usr/bin/env python3
"""
Collect camp types and pricing schedules from iClassPro enterprise API.

Uses the public portal API to discover account IDs, then fetches
camp-types and camp-charge-schedules from the enterprise admin API.

The enterprise API at app.iclasspro.com/api/v1/ requires authentication.
This script uses Playwright to automate the enterprise portal login
and intercept the API responses.

Usage:
    python3 collect_enterprise_data.py --email YOUR_EMAIL --password YOUR_PASSWORD

Or set environment variables:
    ICLASS_EMAIL=your@email.com ICLASS_PASSWORD=yourpass python3 collect_enterprise_data.py
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && python -m playwright install chromium")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent

GYMS = {
    'CCP': 'capgymavery',
    'CPF': 'capgymhp',
    'CRR': 'capgymroundrock',
    'EST': 'estrellagymnastics',
    'HGA': 'houstongymnastics',
    'OAS': 'oasisgymnastics',
    'RBA': 'rbatascocita',
    'RBK': 'rbkingwood',
    'SGT': 'scottsdalegymnastics',
    'TIG': 'tigar',
}

ENTERPRISE_URL = "https://enterprise.iclasspro.com"
API_BASE = "https://app.iclasspro.com/api/v1"


def get_account_ids():
    """Discover iClassPro account IDs from public portal location images."""
    ids = {}
    for gym_id, slug in sorted(GYMS.items()):
        try:
            url = f"https://app.iclasspro.com/api/open/v1/{slug}/locations"
            req = Request(url)
            req.add_header('Accept', 'application/json')
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
            locs = data.get('data', [])
            if locs:
                for field in ['logoImage', 'logo', 'headerImage', 'background', 'splash']:
                    val = locs[0].get(field, '') or ''
                    if '/' in val:
                        account_id = val.split('/')[0]
                        if account_id.isdigit():
                            ids[gym_id] = int(account_id)
                            break
        except Exception as e:
            print(f"  WARNING: Could not get account ID for {gym_id}: {e}")
    return ids


def collect_via_playwright(email, password, gym_ids_to_collect=None):
    """Log into enterprise portal and collect camp types + pricing for each gym."""
    account_ids = get_account_ids()
    print(f"Discovered account IDs: {account_ids}")

    if gym_ids_to_collect:
        gyms_to_process = {k: v for k, v in GYMS.items() if k in gym_ids_to_collect}
    else:
        gyms_to_process = dict(GYMS)

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print(f"\nLogging into {ENTERPRISE_URL}...")
        page.goto(ENTERPRISE_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # Fill login form
        try:
            page.fill('input[type="email"], input[name="email"], #email', email, timeout=10000)
            page.fill('input[type="password"], input[name="password"], #password', password, timeout=5000)
            page.click('button[type="submit"], input[type="submit"], .login-btn, .btn-primary', timeout=5000)
            page.wait_for_load_state("networkidle", timeout=15000)
            time.sleep(3)
            print("  Login successful")
        except Exception as e:
            print(f"  ERROR: Login failed: {e}")
            print("  The enterprise portal login form may have changed.")
            print("  Try logging in manually and using the cookie-based approach instead.")
            browser.close()
            return results

        for gym_id in sorted(gyms_to_process.keys()):
            acct_id = account_ids.get(gym_id)
            if not acct_id:
                print(f"\n  SKIP {gym_id}: no account ID found")
                continue

            print(f"\nCollecting {gym_id} (account {acct_id})...")
            captured = {}

            def handle_response(response):
                url = response.url
                if f'/api/' in url and response.status == 200:
                    try:
                        body = response.json()
                        if 'camp-types' in url or 'campTypes' in url:
                            captured['camp_types'] = body
                            print(f"    Captured camp types ({len(body.get('data', []))} items)")
                        elif 'camp-charge-schedules' in url or 'campChargeSchedules' in url:
                            captured['pricing_schedules'] = body
                            print(f"    Captured pricing schedules ({len(body.get('data', []))} items)")
                    except:
                        pass

            page.on("response", handle_response)

            try:
                # Navigate to account's camp settings
                page.goto(f"{ENTERPRISE_URL}/accounts/{acct_id}/settings/camps",
                         wait_until="networkidle", timeout=30000)
                time.sleep(5)

                # Also try navigating to charge schedules tab if not captured
                if 'pricing_schedules' not in captured:
                    page.goto(f"{ENTERPRISE_URL}/accounts/{acct_id}/settings/camps/charge-schedules",
                             wait_until="networkidle", timeout=30000)
                    time.sleep(3)

            except Exception as e:
                print(f"    ERROR navigating to {gym_id}: {e}")

            page.remove_listener("response", handle_response)

            if captured:
                results[gym_id] = captured
                for data_type, data in captured.items():
                    filename = f"{gym_id}_{data_type}.json"
                    filepath = SCRIPT_DIR / filename
                    with open(filepath, 'w') as f:
                        json.dump(data, f, separators=(',', ':'))
                        f.write('\n')
                    print(f"    Saved {filename}")
            else:
                print(f"    WARNING: No data captured for {gym_id}")

        browser.close()

    return results


def main():
    parser = argparse.ArgumentParser(description="Collect iClassPro enterprise pricing data")
    parser.add_argument('--email', default=os.environ.get('ICLASS_EMAIL', ''),
                       help='Enterprise portal email (or set ICLASS_EMAIL env var)')
    parser.add_argument('--password', default=os.environ.get('ICLASS_PASSWORD', ''),
                       help='Enterprise portal password (or set ICLASS_PASSWORD env var)')
    parser.add_argument('--gyms', nargs='*',
                       help='Specific gym IDs to collect (default: all)')
    parser.add_argument('--discover-only', action='store_true',
                       help='Only discover account IDs, do not collect data')
    args = parser.parse_args()

    if args.discover_only:
        print("Discovering account IDs from public API...")
        ids = get_account_ids()
        for gym_id, acct_id in sorted(ids.items()):
            print(f"  {gym_id}: account_id={acct_id} (slug={GYMS[gym_id]})")
        missing = set(GYMS.keys()) - set(ids.keys())
        if missing:
            print(f"\n  Could not determine account IDs for: {', '.join(sorted(missing))}")
        return

    if not args.email or not args.password:
        print("ERROR: Enterprise portal credentials required.")
        print("Usage: python3 collect_enterprise_data.py --email YOUR_EMAIL --password YOUR_PASSWORD")
        print("   Or: ICLASS_EMAIL=x ICLASS_PASSWORD=y python3 collect_enterprise_data.py")
        sys.exit(1)

    gym_filter = set(args.gyms) if args.gyms else None
    results = collect_via_playwright(args.email, args.password, gym_filter)

    print(f"\n{'='*50}")
    print(f"Collection complete. Got data for {len(results)} gyms:")
    for gym_id in sorted(results.keys()):
        types = results[gym_id]
        print(f"  {gym_id}: {', '.join(sorted(types.keys()))}")

    existing = {f.stem.split('_')[0] for f in SCRIPT_DIR.glob('*_camp_types.json')}
    missing = set(GYMS.keys()) - existing
    if missing:
        print(f"\nStill missing: {', '.join(sorted(missing))}")


if __name__ == '__main__':
    main()
