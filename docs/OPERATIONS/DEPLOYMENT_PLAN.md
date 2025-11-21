# 🚀 Deployment Plan: Live API Server

**Goal:** Deploy the Flask API server (with Playwright) so your boss can access the automated sync feature via URL.

**Current Status:**
- ✅ React app: Deployed on Vercel
- ❌ Flask API: Local only (localhost:5000)
- ❌ React app hardcoded to `localhost:5000`

---

## 🎯 Recommended Solution: Railway

**Why Railway?**
- ✅ Supports Playwright (browser automation)
- ✅ Free tier available ($5/month after)
- ✅ Easy deployment (connect GitHub, auto-deploy)
- ✅ Automatic HTTPS
- ✅ Environment variables support

**Cost:** Free for first $5/month, then ~$5-10/month

---

## 📋 Step-by-Step Deployment

### Step 1: Prepare Flask API for Railway

**File to create:** `automation/railway.json` (or `Procfile`)

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python local_api_server.py",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
}
```

**File to create:** `automation/Procfile`
```
web: python local_api_server.py
```

**Update:** `automation/local_api_server.py` (change host/port for Railway)
```python
if __name__ == '__main__':
    # Railway provides PORT environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)  # debug=False for production
```

### Step 2: Create Railway Account & Deploy

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Python
6. Set root directory: `automation/`
7. Add environment variables (if needed):
   - `PORT` (auto-set by Railway)
   - Any other config

### Step 3: Install Playwright on Railway

**File to create:** `automation/railway_setup.sh`
```bash
#!/bin/bash
# Install Playwright browsers
pip install -r requirements.txt
playwright install chromium
playwright install-deps
```

**Update:** `automation/requirements.txt` (ensure it includes):
```
playwright>=1.40.0
flask>=2.3.0
flask-cors>=4.0.0
```

### Step 4: Update React App to Use Live API

**File to update:** `src/lib/syncApi.js` (or wherever API URL is)

**Current:**
```javascript
const API_URL = 'http://localhost:5000';
```

**New (with environment variable):**
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

**Update:** `.env.local` (for local development)
```
REACT_APP_API_URL=http://localhost:5000
```

**Update:** Vercel environment variables (for production)
```
REACT_APP_API_URL=https://your-railway-app.railway.app
```

### Step 5: Test

1. Railway will give you a URL like: `https://your-app.railway.app`
2. Update Vercel environment variable
3. Test the sync feature in production

---

## 🔄 Alternative Options

### Option 2: Render.com
- Similar to Railway
- Free tier (with limitations)
- Supports Playwright

### Option 3: DigitalOcean App Platform
- $5/month minimum
- More control
- Supports Playwright

### Option 4: AWS EC2 / VPS
- Full control
- Requires more setup
- ~$5-10/month

---

## ⚠️ Important Notes

1. **Playwright Browsers:** Railway needs to install Chromium (~200MB)
2. **Timeout:** Sync operations might take 30-60 seconds (Railway allows up to 5 minutes)
3. **CORS:** Already configured in Flask (`CORS(app)`)
4. **Environment Variables:** Keep API URL in environment variables (not hardcoded)

---

## 🧪 Testing Checklist

- [ ] Railway deployment successful
- [ ] Health check endpoint works: `https://your-app.railway.app/health`
- [ ] React app can connect to Railway API
- [ ] Sync feature works end-to-end
- [ ] Error handling works (if API is down)

---

## 📞 Next Steps

1. **I'll create the Railway config files** (Procfile, railway.json)
2. **You create Railway account** and deploy
3. **I'll update React app** to use environment variable
4. **You add environment variable** to Vercel
5. **Test together!**

---

**Estimated Time:** 30-60 minutes  
**Difficulty:** Medium (mostly copy-paste configs)






