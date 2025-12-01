#!/usr/bin/env python3
"""Quick test to see if the local API server is running"""

import requests

try:
    response = requests.get('http://localhost:5000/health')
    print(f"✅ Server is running! Status: {response.status_code}")
    print(f"Response: {response.json()}")
except requests.exceptions.ConnectionError:
    print("❌ Server is NOT running.")
    print("\n📋 To start it:")
    print("   1. Open a terminal")
    print("   2. cd automation")
    print("   3. python local_api_server.py")
    print("\n   Keep that terminal open!")
except Exception as e:
    print(f"❌ Error: {e}")











