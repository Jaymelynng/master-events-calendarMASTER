# 🔧 Troubleshooting Local API Server

## Error: "Failed to connect to local API"

### Step 1: Check if server is running

Open a terminal and run:
```bash
cd automation
python local_api_server.py
```

**You should see:**
```
============================================================
🚀 LOCAL F12 API SERVER
============================================================
Starting server on http://localhost:5000
...
 * Running on http://127.0.0.1:5000
```

**If you see an error**, check:

1. **Python is installed:**
   ```bash
   python --version
   ```
   Should show Python 3.x

2. **Dependencies installed:**
   ```bash
   pip install flask flask-cors playwright
   playwright install chromium
   ```

3. **Port 5000 is available:**
   - Close any other apps using port 5000
   - Or change the port in `local_api_server.py` (line 145)

### Step 2: Test the API directly

Open a NEW terminal and test:
```bash
curl http://localhost:5000/health
```

**Should return:**
```json
{"status":"ok","message":"Local F12 API server is running"}
```

If this works, the server is running correctly.

### Step 3: Check browser console

1. Open your React app
2. Press F12 → Console tab
3. Look for CORS errors or connection errors
4. Share what you see

### Step 4: Common fixes

**Fix 1: CORS issue**
- The server should have `CORS(app)` - check line 21 of `local_api_server.py`

**Fix 2: Wrong URL**
- Make sure SyncModal.js is calling `http://localhost:5000`
- Not `https://localhost:5000` (no https for local)

**Fix 3: Firewall blocking**
- Windows Firewall might block localhost connections
- Try temporarily disabling firewall to test

**Fix 4: React app on different port**
- If React runs on port 3000, it should still be able to call localhost:5000
- But check browser console for errors

### Quick Test Script

Save this as `test_server.py` in automation folder:
```python
import requests

try:
    response = requests.get('http://localhost:5000/health')
    print(f"✅ Server is running! Status: {response.status_code}")
    print(f"Response: {response.json()}")
except requests.exceptions.ConnectionError:
    print("❌ Server is NOT running. Start it with: python local_api_server.py")
except Exception as e:
    print(f"❌ Error: {e}")
```

Run: `python test_server.py`







