#!/usr/bin/env python3
"""
Analyze iClassPro API Response for Price Fields
This script helps identify ALL possible fields that might contain pricing information
"""

import asyncio
import json
import re
from playwright.async_api import async_playwright

# Test with a real gym
GYMS = {
    'RBK': {'name': 'Rowland Ballard Kingwood', 'slug': 'rbkingwood'},
}

async def analyze_event_fields(gym_id='RBK', event_type='KIDS NIGHT OUT'):
    """
    Capture event data and analyze all fields for price information
    """
    captured_events = []
    
    async def handle_response(response):
        nonlocal captured_events
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
        except Exception:
            return
        
        if "application/json" not in content_type:
            return
        
        # Look for event detail API calls
        if "/camps/" in response_url and "?" not in response_url:
            try:
                body = await response.json()
                if isinstance(body, dict) and "data" in body:
                    event_data = body.get("data", {})
                    if isinstance(event_data, dict):
                        captured_events.append(event_data)
                        print(f"✅ Captured event: {event_data.get('name', 'Unknown')[:50]}")
            except Exception as e:
                print(f"Error parsing response: {e}")
    
    # Build URL (this would come from database normally)
    url = f"https://app.iclasspro.com/{GYMS[gym_id]['slug']}/calendar"
    
    print(f"\n{'='*80}")
    print(f"ANALYZING PRICE FIELDS FROM: {url}")
    print(f"{'='*80}\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on("response", handle_response)
        
        print(f"Loading page...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.reload(wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)
        
        await browser.close()
    
    print(f"\n{'='*80}")
    print(f"ANALYSIS RESULTS: {len(captured_events)} events captured")
    print(f"{'='*80}\n")
    
    if not captured_events:
        print("❌ No events captured. Check URL or network.")
        return
    
    # Analyze first few events
    for idx, event in enumerate(captured_events[:3]):
        print(f"\n{'='*80}")
        print(f"EVENT #{idx + 1}: {event.get('name', 'Unknown')[:60]}")
        print(f"{'='*80}\n")
        
        # Check ALL fields for potential price data
        print("ALL FIELDS IN API RESPONSE:")
        print("-" * 80)
        
        price_keywords = ['price', 'cost', 'fee', 'amount', 'rate', 'tuition', 'payment', 'charge']
        numeric_fields = []
        potential_price_fields = []
        
        for key, value in sorted(event.items()):
            # Track numeric fields
            if isinstance(value, (int, float)) and value > 0:
                numeric_fields.append((key, value))
            
            # Track fields with price-related keywords
            if any(keyword in key.lower() for keyword in price_keywords):
                potential_price_fields.append((key, value))
            
            # Show all fields
            value_str = str(value)
            if len(value_str) > 100:
                value_str = value_str[:100] + "..."
            print(f"  {key:30} = {value_str}")
        
        print(f"\n{'='*80}")
        print("NUMERIC FIELDS (potential prices):")
        print("-" * 80)
        if numeric_fields:
            for key, value in numeric_fields:
                print(f"  ✓ {key:30} = {value}")
        else:
            print("  ❌ No numeric fields found")
        
        print(f"\n{'='*80}")
        print("PRICE-RELATED KEYWORD FIELDS:")
        print("-" * 80)
        if potential_price_fields:
            for key, value in potential_price_fields:
                value_str = str(value)
                if len(value_str) > 200:
                    value_str = value_str[:200] + "..."
                print(f"  ✓ {key:30} = {value_str}")
        else:
            print("  ❌ No price-related fields found")
        
        print(f"\n{'='*80}")
        print("PRICE EXTRACTION FROM TEXT:")
        print("-" * 80)
        
        # Extract from title
        title = event.get('name', '')
        title_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', str(title))
        if title_prices:
            print(f"  ✓ Found in TITLE: ${', $'.join(title_prices)}")
        else:
            print(f"  ❌ No price found in title: {title[:100]}")
        
        # Extract from description
        description = event.get('description', '')
        desc_prices = re.findall(r'\$(\d+(?:\.\d{2})?)', str(description))
        if desc_prices:
            print(f"  ✓ Found in DESCRIPTION: ${', $'.join(desc_prices)}")
            # Show context
            for price in desc_prices[:3]:
                match = re.search(r'.{0,30}\$' + re.escape(price) + r'.{0,30}', str(description))
                if match:
                    context = match.group(0).replace('\n', ' ').replace('\r', '')
                    print(f"      Context: ...{context}...")
        else:
            print(f"  ❌ No price found in description (length: {len(str(description))})")
        
        # Check for common price field names
        print(f"\n{'='*80}")
        print("CHECKING COMMON PRICE FIELD NAMES:")
        print("-" * 80)
        common_fields = [
            'price', 'cost', 'fee', 'amount', 'tuition', 
            'pricing', 'priceAmount', 'costAmount', 'feeAmount',
            'tuitionAmount', 'rate', 'rateAmount', 'charge',
            'memberPrice', 'nonMemberPrice', 'regularPrice',
            'totalCost', 'totalPrice', 'sessionPrice', 'classPrice',
            'registrationFee', 'enrollmentFee'
        ]
        
        found_any = False
        for field_name in common_fields:
            if field_name in event:
                print(f"  ✓ {field_name:30} = {event[field_name]}")
                found_any = True
        
        if not found_any:
            print("  ❌ None of the common price field names exist")
    
    # Summary analysis
    print(f"\n{'='*80}")
    print("SUMMARY ACROSS ALL EVENTS:")
    print(f"{'='*80}\n")
    
    all_keys = set()
    for event in captured_events:
        all_keys.update(event.keys())
    
    # Find keys that appear in ALL events (likely standard fields)
    common_keys = set(captured_events[0].keys()) if captured_events else set()
    for event in captured_events[1:]:
        common_keys &= set(event.keys())
    
    print(f"Total unique fields across all events: {len(all_keys)}")
    print(f"Fields present in ALL events: {len(common_keys)}")
    print("\nCommon fields (in all events):")
    for key in sorted(common_keys):
        print(f"  - {key}")
    
    # Save detailed analysis to file
    output_file = "price_field_analysis.json"
    with open(output_file, 'w') as f:
        json.dump({
            'total_events_analyzed': len(captured_events),
            'all_unique_fields': sorted(list(all_keys)),
            'common_fields': sorted(list(common_keys)),
            'sample_events': captured_events[:2]  # Save first 2 for review
        }, f, indent=2)
    
    print(f"\n✅ Detailed analysis saved to: {output_file}")
    print("\nRECOMMENDATIONS:")
    print("-" * 80)
    print("1. Review the saved JSON file for complete field details")
    print("2. Check if iClassPro has a 'price' or 'cost' field we're missing")
    print("3. May need to extract from description/title as fallback")
    print("4. Consider asking gym managers to include price in title/description")

if __name__ == "__main__":
    asyncio.run(analyze_event_fields())
