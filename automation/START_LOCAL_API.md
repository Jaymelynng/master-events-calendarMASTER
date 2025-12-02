# 🚀 Starting the Local F12 API Server

## Quick Start

1. **Install dependencies:**
   ```bash
   cd automation
   pip install -r requirements.txt
   playwright install chromium
   ```

2. **Start the server:**
   ```bash
   python local_api_server.py
   ```

3. **You should see:**
   ```
   ============================================================
   🚀 LOCAL F12 API SERVER
   ============================================================
   Starting server on http://localhost:5000
   Make sure Playwright is installed: pip install playwright
   And browsers are installed: playwright install chromium
   ============================================================
   ```

4. **Keep this terminal open** - the server needs to stay running

5. **In your React app:**
   - Open the Admin Portal (Shift+Click Magic Control)
   - Click "⚡ Open Sync Modal"
   - Select gym and event type
   - Click "⚡ Sync" button

## Testing the API

You can test the API directly:

```bash
curl -X POST http://localhost:5000/sync-events \
  -H "Content-Type: application/json" \
  -d '{"gymId": "RBA", "eventType": "KIDS NIGHT OUT"}'
```

## Troubleshooting

**"Connection refused" error:**
- Make sure the server is running on port 5000
- Check if another app is using port 5000

**"Playwright not found" error:**
- Run: `pip install playwright`
- Run: `playwright install chromium`

**"No events collected" error:**
- Check if the gym/event type combination is correct
- Make sure the portal URL is accessible
- Check the terminal for error messages












