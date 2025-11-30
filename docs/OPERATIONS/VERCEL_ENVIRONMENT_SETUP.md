# Vercel Environment Variables Setup

## Add Railway API URL to Vercel

To connect your React app (on Vercel) to the Railway API server, you need to add an environment variable.

### Steps:

1. Go to your Vercel project dashboard
2. Click on **Settings**
3. Click on **Environment Variables**
4. Click **Add New**
5. Add this variable:
   - **Name:** `REACT_APP_API_URL`
   - **Value:** `https://master-events-calendarmaster-production.up.railway.app`
   - **Environment:** Select all (Production, Preview, Development)
6. Click **Save**
7. **Redeploy your app** (Vercel will automatically redeploy, or you can trigger it manually)

### After Adding:

- Your React app will now call the Railway API instead of localhost
- The sync feature will work for anyone using your calendar app
- No need to run the local API server anymore (for production)

### For Local Development:

If you want to test locally, update your `.env.local` file:
```
REACT_APP_API_URL=http://localhost:5000
```

Or use the Railway URL to test the live API:
```
REACT_APP_API_URL=https://master-events-calendarmaster-production.up.railway.app
```








