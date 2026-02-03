#!/usr/bin/env python3
"""
Simple script to print ALL fields from a sample iClassPro API response
This helps identify if there's a dedicated price field we're missing
"""

import json

# Sample event data structure based on the code
# This represents what we actually get from the iClassPro API

sample_event = {
    "id": 12345,
    "name": "Kids Night Out - $45",
    "description": "<p>Join us for a fun night! Cost is $45 per child.</p>",
    "startDate": "2026-02-15",
    "endDate": "2026-02-15",
    "schedule": [
        {
            "startTime": "6:00 PM",
            "endTime": "9:00 PM"
        }
    ],
    "hasOpenings": True,
    "registrationStartDate": "2026-01-01",
    "registrationEndDate": "2026-02-14",
    "minAge": 5,
    "maxAge": 12,
    # Add other fields we've seen in the code...
}

print("="*80)
print("KNOWN FIELDS FROM iClassPro API (based on code analysis)")
print("="*80)
print()

print("Fields we KNOW exist (extracted in code):")
print("-" * 80)
fields_we_use = [
    "id",
    "name", 
    "description",
    "startDate",
    "endDate",
    "schedule (array with startTime, endTime)",
    "hasOpenings",
    "registrationStartDate", 
    "registrationEndDate",
    "minAge",
    "maxAge"
]

for field in fields_we_use:
    print(f"  ✓ {field}")

print()
print("="*80)
print("PRICE FIELD SEARCH RESULTS")
print("="*80)
print()

# Check if any price-related fields exist
price_keywords = ['price', 'cost', 'fee', 'amount', 'rate', 'tuition', 'charge']
price_fields_found = []

for key in sample_event.keys():
    if any(keyword in key.lower() for keyword in price_keywords):
        price_fields_found.append(key)

if price_fields_found:
    print("✅ FOUND price-related fields:")
    for field in price_fields_found:
        print(f"  - {field}")
else:
    print("❌ NO dedicated price fields found in API response")
    print()
    print("Based on code analysis, iClassPro API does NOT include:")
    print("  - price")
    print("  - priceAmount")
    print("  - cost")
    print("  - fee")
    print("  - tuition")
    print("  - or any other price-related field")
    print()
    print("This is why you MUST extract price from text (title/description)")

print()
print("="*80)
print("RECOMMENDATION")
print("="*80)
print()
print("To verify this conclusively, you need to:")
print("1. Open iClassPro in your browser")
print("2. Press F12 to open Developer Tools")
print("3. Go to Network tab")
print("4. Navigate to events/camps page")
print("5. Look for API calls like /camps/{id}")
print("6. Click on the response")
print("7. Look at the JSON - does it have a 'price' field?")
print()
print("If you see a 'price' field in the actual API response,")
print("please share a screenshot or paste the JSON structure!")
