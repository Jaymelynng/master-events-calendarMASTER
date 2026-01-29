#!/usr/bin/env python3
"""
VERIFY PRICE FIELD - Run this to see for yourself!

This script will:
1. Connect to your actual iClassPro gym
2. Capture real event data
3. Show you EVERY SINGLE FIELD in the response
4. Let you see with your own eyes if there's a price field

Usage:
    python3 verify_price_field.py

Requirements:
    - You must have Railway or local environment set up
    - Or run this where Playwright is installed
"""

import asyncio
import json
import sys
from pathlib import Path

# Check if we can import playwright
try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("⚠️  Playwright not installed. This will show you what to look for manually.")

# Import your existing gym config
sys.path.insert(0, str(Path(__file__).parent))
try:
    from f12_collect_and_import import GYMS
except:
    GYMS = {
        'RBK': {'name': 'Rowland Ballard Kingwood', 'slug': 'rbkingwood'},
        'CCP': {'name': 'Capital Gymnastics Cedar Park', 'slug': 'capgymavery'},
    }


async def capture_and_analyze_real_data(gym_id='RBK'):
    """
    Capture REAL data from iClassPro and show ALL fields
    """
    if gym_id not in GYMS:
        print(f"❌ Unknown gym: {gym_id}")
        print(f"Available: {list(GYMS.keys())}")
        return
    
    gym = GYMS[gym_id]
    url = f"https://app.iclasspro.com/{gym['slug']}/calendar?sortBy=time"
    
    print("="*80)
    print("🔍 CAPTURING REAL DATA FROM YOUR SYSTEM")
    print("="*80)
    print(f"\nGym: {gym['name']}")
    print(f"URL: {url}")
    print("\nThis will show you EVERY field in the actual data...")
    print()
    
    captured_events = []
    
    async def handle_response(response):
        nonlocal captured_events
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
        except:
            return
        
        if "application/json" not in content_type:
            return
        
        # Look for event detail calls
        if "/camps/" in response_url and "?" not in response_url:
            try:
                body = await response.json()
                if isinstance(body, dict) and "data" in body:
                    event_data = body.get("data", {})
                    if isinstance(event_data, dict) and event_data.get("id"):
                        captured_events.append(event_data)
                        print(f"✅ Captured event: {event_data.get('name', 'Unknown')[:50]}...")
            except Exception as e:
                pass
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on("response", handle_response)
        
        print("🌐 Loading iClassPro portal...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.reload(wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)
        
        await browser.close()
    
    print(f"\n✅ Captured {len(captured_events)} events")
    
    if not captured_events:
        print("\n❌ No events captured. Try a different gym or check URL.")
        return
    
    # Analyze the data
    analyze_captured_data(captured_events)


def analyze_captured_data(events):
    """
    Show detailed analysis of captured event data
    """
    print("\n" + "="*80)
    print("📊 ANALYSIS OF REAL EVENT DATA")
    print("="*80)
    
    # Get all unique field names across all events
    all_fields = set()
    for event in events:
        all_fields.update(event.keys())
    
    print(f"\n📋 FOUND {len(all_fields)} UNIQUE FIELDS:")
    print("-" * 80)
    
    for field in sorted(all_fields):
        print(f"  • {field}")
    
    # Check for price-related fields
    print("\n" + "="*80)
    print("💰 CHECKING FOR PRICE-RELATED FIELDS:")
    print("="*80)
    
    price_keywords = ['price', 'cost', 'fee', 'amount', 'tuition', 'charge', 'rate', 'payment']
    price_fields_found = []
    
    for field in all_fields:
        if any(keyword in field.lower() for keyword in price_keywords):
            price_fields_found.append(field)
    
    if price_fields_found:
        print("\n✅ FOUND PRICE-RELATED FIELDS:")
        for field in price_fields_found:
            # Show sample values
            print(f"\n  Field: {field}")
            for i, event in enumerate(events[:3]):
                if field in event:
                    value = event[field]
                    print(f"    Event {i+1}: {value}")
    else:
        print("\n❌ NO PRICE-RELATED FIELDS FOUND")
        print("\nFields checked for:")
        for keyword in price_keywords:
            print(f"  • {keyword}")
    
    # Show where prices actually are
    print("\n" + "="*80)
    print("🔍 WHERE PRICES ACTUALLY APPEAR:")
    print("="*80)
    
    for i, event in enumerate(events[:3]):
        print(f"\n📄 EVENT {i+1}: {event.get('name', 'Unknown')[:60]}")
        print("-" * 80)
        
        # Check title
        title = event.get('name', '')
        if '$' in str(title):
            print(f"  💰 PRICE IN TITLE: {title}")
        else:
            print(f"  ❌ No price in title: {title}")
        
        # Check description
        desc = event.get('description', '')
        if '$' in str(desc):
            # Extract just the part with price
            import re
            matches = re.findall(r'.{0,30}\$\d+(?:\.\d{2})?.{0,30}', str(desc))
            if matches:
                print(f"  💰 PRICE IN DESCRIPTION:")
                for match in matches[:2]:
                    clean = match.replace('\n', ' ').replace('\r', ' ')
                    print(f"      ...{clean}...")
        else:
            print(f"  ❌ No price in description")
    
    # Save to file for detailed inspection
    output_file = "real_event_data_sample.json"
    with open(output_file, 'w') as f:
        json.dump({
            'total_events': len(events),
            'all_fields': sorted(list(all_fields)),
            'price_fields_found': price_fields_found,
            'sample_events': events[:2]  # Save first 2 complete events
        }, f, indent=2)
    
    print(f"\n💾 Saved detailed data to: {output_file}")
    print("   Open this file to inspect the complete event structure")
    
    # Final verdict
    print("\n" + "="*80)
    print("🎯 VERDICT:")
    print("="*80)
    
    if price_fields_found:
        print("\n✅ PRICE FIELDS EXIST!")
        print(f"\nFound: {', '.join(price_fields_found)}")
        print("\n➡️  We should update the code to use these fields!")
    else:
        print("\n❌ NO DEDICATED PRICE FIELD EXISTS")
        print("\nPrice information is ONLY available as text in:")
        print("  • name (title)")
        print("  • description")
        print("\n💡 This is why text extraction is necessary.")


def show_manual_instructions():
    """
    Show how to check manually in browser
    """
    print("="*80)
    print("🔍 HOW TO VERIFY THIS YOURSELF IN YOUR BROWSER")
    print("="*80)
    print()
    print("1. Open iClassPro in Chrome/Edge")
    print("2. Press F12 to open Developer Tools")
    print("3. Go to Network tab")
    print("4. Click on any event")
    print("5. Find the network request (looks like /camps/2106)")
    print("6. Click on it → Response tab")
    print("7. Look at the JSON")
    print()
    print("WHAT TO LOOK FOR:")
    print("  • Search for 'price'")
    print("  • Search for 'cost'")
    print("  • Search for 'fee'")
    print("  • Search for '$'")
    print()
    print("If you see a field like 'price: 45' → WE MISSED IT!")
    print("If you only see '$45' in 'name' or 'description' → TEXT EXTRACTION IS CORRECT")
    print()


async def main():
    """
    Main function - run the verification
    """
    print("\n" + "="*80)
    print("🔍 PRICE FIELD VERIFICATION TOOL")
    print("="*80)
    print()
    print("This will capture REAL data from your iClassPro and show you")
    print("EVERY field that exists, so you can see for yourself if there's")
    print("a price field or not.")
    print()
    
    if not HAS_PLAYWRIGHT:
        print("⚠️  Playwright not installed locally.")
        print()
        print("OPTIONS:")
        print("1. Run this on Railway where Playwright is installed")
        print("2. Install Playwright: pip install playwright && playwright install chromium")
        print("3. Check manually in browser (instructions below)")
        print()
        show_manual_instructions()
        return
    
    # Ask which gym
    print("Which gym should we check?")
    print()
    for gym_id, gym_info in GYMS.items():
        print(f"  {gym_id}: {gym_info['name']}")
    print()
    
    # Default to first gym
    gym_id = list(GYMS.keys())[0]
    print(f"Checking: {gym_id} (to change, edit the script)")
    print()
    
    try:
        await capture_and_analyze_real_data(gym_id)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTry checking manually in browser:")
        show_manual_instructions()


if __name__ == "__main__":
    if HAS_PLAYWRIGHT:
        asyncio.run(main())
    else:
        asyncio.run(main())  # Will show manual instructions
