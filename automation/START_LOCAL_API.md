# 🚀 Starting the Local API Server

**Last Updated:** December 28, 2025

Use this guide when developing locally or testing the sync system.

---

## ⚡ Quick Start

### 1. Install dependencies:
```bash
cd automation
pip install -r requirements.txt
playwright install chromium
```

### 2. Start the server:
```bash
python local_api_server.py
```

### 3. You should see:
```
============================================================
🚀 F12 API SERVER
============================================================
Starting server on http://localhost:5000
============================================================
```

### 4. Keep this terminal open
The server needs to stay running while you use it.

---

## 🧪 Testing the API

### Health check:
```bash
curl http://localhost:5000/health
```

**Expected response:**
```json
{"status": "healthy", "message": "API is running"}
```

### Test sync (no API key needed locally):
```bash
curl -X POST http://localhost:5000/sync-events \
  -H "Content-Type: application/json" \
  -d '{"gymId": "RBA", "eventType": "KIDS NIGHT OUT"}'
```

---

## 🖥️ Using with the React App

### 1. Start the local API server (this guide)

### 2. Start the React app:
```bash
npm start
```

### 3. Open the calendar:
- Go to `http://localhost:3000`
- Click 🪄 Admin button
- Click "Open Automated Sync"
- Select a gym and sync

**Note:** For local development, the React app should connect to `http://localhost:5000`. In production, it connects to Railway.

---

## 🔧 Environment Variables (Optional for Local)

For local development, you can create a `.env` file:

```bash
# Optional - only needed if importing to database
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Optional - disable API key check for local dev
API_KEY=
```

---

## 🚨 Troubleshooting

### "Connection refused" error
- Make sure the server is running on port 5000
- Check if another app is using port 5000

### "Playwright not found" error
```bash
pip install playwright
playwright install chromium
```

### "No events collected"
- Check if the gym/event type combination is correct
- Check the terminal for error messages
- Verify the portal URL is accessible

### Port 5000 in use
Kill the process using port 5000 or change the port in `local_api_server.py`

---

## 📝 Notes

- **Local server** = for development/testing
- **Railway server** = for production (what users see)
- Both run the same code (`local_api_server.py`)
