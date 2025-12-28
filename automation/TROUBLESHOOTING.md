# 🔧 Automation Troubleshooting Guide

**Last Updated:** December 28, 2025

---

## 🚨 Common Issues

### "Invalid or missing API key"

**Cause:** API key mismatch between Vercel and Railway

**Fix:**
1. Check Vercel has `REACT_APP_API_KEY` set
2. Check Railway has `API_KEY` set
3. Verify both values are **exactly the same**
4. Redeploy both services after changing

---

### "Failed to connect to API"

**Cause:** Railway service not running or wrong URL

**Fix:**
1. Check Railway dashboard - is service running?
2. Check Railway logs for errors
3. Test health endpoint: `https://[your-railway-url]/health`
4. Verify `REACT_APP_API_URL` in Vercel matches Railway URL

---

### "No events collected"

**Cause:** Playwright couldn't collect from iClassPro

**Fix:**
1. Check Railway logs for specific error
2. Verify the gym has events of that type
3. Try a different gym/event type combination
4. Check if iClassPro portal is accessible

---

### "Sync takes forever / times out"

**Cause:** Playwright is slow or stuck

**Fix:**
1. Railway has a 5-minute timeout - should be enough
2. Check Railway logs for Playwright errors
3. iClassPro portal might be slow - try again later
4. Try syncing one event type instead of ALL

---

### "Events not importing to database"

**Cause:** Supabase connection issue

**Fix:**
1. Check Railway has correct `SUPABASE_URL`
2. Check Railway has correct `SUPABASE_SERVICE_KEY`
3. Check Supabase dashboard for errors
4. Verify the service key has write permissions

---

## 🖥️ Local Development Issues

### "Connection refused" on localhost:5000

**Cause:** Local server not running

**Fix:**
```bash
cd automation
python local_api_server.py
```

---

### "Playwright not found"

**Cause:** Playwright not installed

**Fix:**
```bash
pip install playwright
playwright install chromium
```

---

### "Port 5000 already in use"

**Cause:** Another app using port 5000

**Fix:**
- Close the other app
- Or change port in `local_api_server.py` (bottom of file)

---

## 🔍 Debugging Steps

### 1. Check Railway Logs
Railway Dashboard → Your Service → Logs

Look for:
- Python errors
- Playwright errors
- Connection timeouts
- API key issues

### 2. Check Browser Console
In the React app, press F12 → Console

Look for:
- CORS errors
- Network errors
- API response errors

### 3. Test API Directly
```bash
# Health check
curl https://[your-railway-url]/health

# Sync test (replace with your API key)
curl -X POST https://[your-railway-url]/sync-events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"gymId": "RBA", "eventType": "KIDS NIGHT OUT"}'
```

---

## 📞 Still Stuck?

1. **Check the logs** - Railway and browser console
2. **Restart Railway** - Sometimes helps
3. **Redeploy** - Deployments → Redeploy
4. **Check environment variables** - All 4 must be set correctly:
   - Vercel: `REACT_APP_API_URL`, `REACT_APP_API_KEY`
   - Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `API_KEY`
