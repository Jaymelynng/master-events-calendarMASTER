#!/usr/bin/env python3
"""
Test script to check iClassPro API endpoints
"""

import asyncio
import aiohttp
import json

async def test_gym_api(gym_id, subdomain):
    """Test API endpoints for a specific gym"""
    print(f"\nTesting {gym_id} ({subdomain})...")
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Locations endpoint
        locations_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/locations"
        print(f"  Testing locations: {locations_url}")
        
        try:
            async with session.get(locations_url) as response:
                print(f"  Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"  Response: {json.dumps(data, indent=2)[:200]}...")
                else:
                    print(f"  Error: {response.status}")
        except Exception as e:
            print(f"  Exception: {e}")
        
        # Test 2: Direct camps endpoint
        camps_url = f"https://app.iclasspro.com/api/open/v1/{subdomain}/camps"
        print(f"  Testing camps: {camps_url}")
        
        try:
            async with session.get(camps_url) as response:
                print(f"  Status: {response.status}")
                if response.status == 200:
                    data = await response.json()
                    print(f"  Response: {json.dumps(data, indent=2)[:200]}...")
                else:
                    print(f"  Error: {response.status}")
        except Exception as e:
            print(f"  Exception: {e}")

async def main():
    """Test API endpoints for all gyms"""
    print("Testing iClassPro API endpoints...")
    
    gyms = {
        'CCP': 'capgymavery',
        'CPF': 'capgymhp', 
        'CRR': 'capgymroundrock',
        'HGA': 'houstongymnastics',
        'RBA': 'rbatascocita',
        'RBK': 'rbkingwood',
        'EST': 'estrellagymnastics',
        'OAS': 'oasisgymnastics',
        'SGT': 'scottsdalegymnastics',
        'TIG': 'tigar'
    }
    
    for gym_id, subdomain in gyms.items():
        await test_gym_api(gym_id, subdomain)

if __name__ == "__main__":
    asyncio.run(main())










