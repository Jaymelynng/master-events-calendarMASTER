# 🚀 Deployment Architecture - COMPLETED
## Master Events Calendar Production Setup

**Last Updated:** November 26, 2025  
**Status:** ✅ FULLY DEPLOYED & WORKING

---

## 🎉 DEPLOYMENT COMPLETE!

This document was originally a plan. **The deployment is now complete and verified.**

---

## 🌐 CURRENT PRODUCTION SETUP

### **Three-Part Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR USERS                                │
│                    (Boss, coworkers, you)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                             │
│                                                                  │
│  React App with:                                                │
│  • Calendar UI                                                  │
│  • Admin Portal (Secret)                                        │
│  • Sync Modal                                                   │
│  • Vercel Analytics                                             │
│                                                                  │
│  URL: Your Vercel deployment URL                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────────────┐
│   RAILWAY (Backend)   │   │      SUPABASE (Database)          │
│                       │   │                                    │
│  Flask API with:      │   │  PostgreSQL with:                 │
│  • /sync-events       │   │  • events table                   │
│  • /import-events     │   │  • gyms table                     │
│  • /health            │   │  • gym_links table                │
│  • Playwright         │   │  • sync_log table                 │
│                       │   │  • events_with_gym view           │
│  URL: Railway URL     │   │                                    │
└───────────────────────┘   │  URL: Supabase URL                │
                            └───────────────────────────────────┘
```

---

## 🔗 LIVE URLS

| Service | URL | Purpose |
|---------|-----|---------|
| **Calendar App** | Your Vercel URL | What everyone sees |
| **API Server** | `https://master-events-calendarmaster-production.up.railway.app` | Backend automation |
| **Health Check** | `https://master-events-calendarmaster-production.up.railway.app/health` | Verify API is running |
| **Supabase** | `https://supabase.com/dashboard/project/xftiwouxpefchwoxxgpf` | Database management |
| **Railway** | Railway dashboard | API server management |

---

## ⚙️ ENVIRONMENT VARIABLES

### **Vercel (Frontend)**

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `REACT_APP_SUPABASE_URL` | `https://xftiwouxpefchwoxxgpf.supabase.co` | Database connection |
| `REACT_APP_SUPABASE_ANON_KEY` | Your anon key | Database auth (read) |
| `REACT_APP_API_URL` | `https://master-events-calendarmaster-production.up.railway.app` | Backend API |

### **Railway (Backend)**

Go to: Railway Dashboard → Your Service → Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | Auto-assigned by Railway | Server port |
| `SUPABASE_URL` | `https://xftiwouxpefchwoxxgpf.supabase.co` | Database connection |
| `SUPABASE_SERVICE_KEY` | Your service key | Database auth (write) |

---

## 📁 KEY DEPLOYMENT FILES

### **Railway Configuration**

**`automation/Procfile`**
```
web: python local_api_server.py
```

**`automation/requirements.txt`**
```
playwright>=1.40.0
flask>=2.3.0
flask-cors>=4.0.0
supabase>=2.0.0
python-dotenv>=1.0.0
```

**`automation/local_api_server.py`** (relevant section)
```python
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

---

## 🔄 HOW DATA FLOWS

### **When You Sync Events:**

```
1. You click "Sync" in React app (Vercel)
   │
2. React sends POST to /sync-events (Railway)
   │
3. Flask receives request
   │
4. Playwright opens iClassPro portal
   │
5. Captures event data from JSON responses
   │
6. Returns events to React
   │
7. React compares with Supabase data
   │
8. Shows you: NEW | CHANGED | DELETED
   │
9. You click "Import"
   │
10. React sends POST to /import-events (Railway)
    │
11. Flask writes to Supabase (using service key)
    │
12. Supabase real-time updates React
    │
13. Calendar refreshes!
```

### **Why Railway for Import (not direct Supabase)?**

The frontend uses the **anon key** which has limited permissions:
- ✅ Can READ data
- ❌ Cannot UPDATE existing data
- ❌ Cannot do complex operations

The Railway backend uses the **service key** which can:
- ✅ READ data
- ✅ INSERT data
- ✅ UPDATE data
- ✅ DELETE data
- ✅ Run complex operations

---

## 🛠️ HOW TO REDEPLOY

### **Frontend (Vercel)**

**Automatic:** Push to GitHub → Vercel auto-deploys

**Manual:**
1. Go to Vercel Dashboard
2. Click your project
3. Click "Deployments"
4. Click "Redeploy" on latest

### **Backend (Railway)**

**Automatic:** Push to GitHub → Railway auto-deploys

**Manual:**
1. Go to Railway Dashboard
2. Click your service
3. Click "Deploy" → "Deploy from latest commit"

---

## 🧪 HOW TO TEST DEPLOYMENT

### **Test 1: Health Check**
```
Visit: https://master-events-calendarmaster-production.up.railway.app/health
Expected: {"status": "healthy", "message": "API is running"}
```

### **Test 2: Frontend Loads**
```
Visit: Your Vercel URL
Expected: Calendar loads with events
```

### **Test 3: Sync Works**
```
1. Shift+Click magic wand
2. Click "Automated Sync"
3. Select a gym
4. Select an event type
5. Click "Sync"
Expected: Events appear in preview
```

### **Test 4: Import Works**
```
1. After sync shows events
2. Click "Import X Events"
Expected: Success message, calendar updates
```

---

## 🚨 TROUBLESHOOTING

### **"API not responding"**

1. Check Railway dashboard - is service running?
2. Check Railway logs for errors
3. Test health endpoint directly
4. Check if Railway credits are depleted

### **"Events not importing"**

1. Check browser console (F12)
2. Verify REACT_APP_API_URL is correct in Vercel
3. Check Railway logs for errors
4. Verify Supabase service key is correct in Railway

### **"Sync takes forever / times out"**

1. Railway has a 5-minute timeout - should be enough
2. Check Railway logs for Playwright errors
3. iClassPro portal might be slow - try again later

### **"Changes not showing on calendar"**

1. Hard refresh (Ctrl+Shift+R)
2. Check Supabase to see if data actually saved
3. Verify events_with_gym view is correct

---

## 💰 COSTS

### **Current Monthly Costs:**

| Service | Cost | Notes |
|---------|------|-------|
| **Vercel** | $0 | Free tier (hobby) |
| **Railway** | ~$5 | After free credits |
| **Supabase** | $0 | Free tier |
| **TOTAL** | ~$5/month | |

### **Scaling Costs:**
- Vercel Pro: $20/month (if needed)
- Railway: Pay for usage (usually $5-15)
- Supabase Pro: $25/month (if needed)

---

## 📝 DEPLOYMENT HISTORY

| Date | Change |
|------|--------|
| Nov 2025 | Initial Railway deployment |
| Nov 2025 | Added Playwright to Railway |
| Nov 2025 | Connected Vercel to Railway |
| Nov 26, 2025 | Verified full system working |
| Nov 26, 2025 | Added Vercel Analytics |

---

## ✅ DEPLOYMENT CHECKLIST

- [x] Railway account created
- [x] Railway service deployed
- [x] Playwright installed on Railway
- [x] Health endpoint working
- [x] Vercel environment variables set
- [x] React app connecting to Railway
- [x] Sync feature working end-to-end
- [x] Import feature working end-to-end
- [x] Vercel Analytics enabled
- [x] Full system verified with live data

---

**Deployment is COMPLETE and VERIFIED!** 🎉

