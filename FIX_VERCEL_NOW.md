# 🚨 FIX VERCEL - ADD RAILWAY URL

## The Problem:
Your React app on Vercel is trying to connect to `localhost:5000` (which doesn't exist on Vercel).
It needs to connect to Railway instead.

## The Fix (5 minutes):

### Step 1: Go to Vercel
1. Open: https://vercel.com/dashboard
2. Sign in if needed

### Step 2: Find Your Project
1. Look for "master-events-calendar" or similar project name
2. Click on it

### Step 3: Add Environment Variable
1. Click **"Settings"** (top menu)
2. Click **"Environment Variables"** (left sidebar)
3. Click **"Add New"** button
4. Fill in:
   - **Key:** `REACT_APP_API_URL`
   - **Value:** `https://master-events-calendarmaster-production.up.railway.app`
   - **Environment:** Check ALL boxes (Production, Preview, Development)
5. Click **"Save"**

### Step 4: Redeploy
1. Go to **"Deployments"** (top menu)
2. Find the latest deployment
3. Click the **three dots** (...) next to it
4. Click **"Redeploy"**
5. Wait 2-3 minutes for it to finish

### Step 5: Test
1. Open your live Vercel URL (the one your boss uses)
2. Try the sync feature
3. It should work now

---

**That's it. After redeploy, your live site will use Railway and work for everyone.**









