# Quick Start: Setting Up After Cleanup

**For:** Jayme and future developers  
**Updated:** February 11, 2026

The recent cleanup removed hardcoded credentials for security. Here's how to set up the environment variables that are now required.

---

## 🚨 IMPORTANT: Environment Variables Now Required

The Python automation script (`f12_collect_and_import.py`) now **requires** these environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_KEY`)

Without these, the script will immediately fail with a clear error message.

---

## 🏢 Railway Setup (Production API)

Your Flask API runs on Railway and needs these variables:

### How to Add Variables on Railway

1. Go to Railway Dashboard: https://railway.app
2. Select your project: `master-events-calendarmaster-production`
3. Click on your service
4. Go to **Variables** tab
5. Add these three variables:

```bash
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_ANON_KEY=[paste-your-anon-key]
API_KEY=[paste-your-api-key]
```

### Where to Find These Values

**SUPABASE_URL:**
- Already hardcoded in your frontend (check `.env.local`)
- Or get from Supabase Dashboard → Settings → API

**SUPABASE_ANON_KEY:**
- Same as `REACT_APP_SUPABASE_ANON_KEY` in your Vercel env vars
- Or get from Supabase Dashboard → Settings → API

**API_KEY:**
- Same as `REACT_APP_API_KEY` in your Vercel env vars
- This is the key that your React app uses to authenticate with Railway

### After Adding Variables

Railway will automatically redeploy with the new environment variables. Wait 1-2 minutes for the deployment to complete.

### Test It Works

```bash
curl https://master-events-calendarmaster-production.up.railway.app/health
```

Should return: `{"status":"ok","message":"API is running"}`

---

## 💻 Local Development Setup (Optional)

If you want to run the Python scripts locally:

### Option 1: Create .env File (Recommended)

In the `automation/` folder, create a `.env` file:

```bash
cd automation/
nano .env
```

Add these lines:
```bash
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
```

Then load the variables before running:
```bash
# On Mac/Linux
export $(cat .env | xargs)
python f12_collect_and_import.py

# On Windows
# Set each variable manually in Command Prompt:
set SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
set SUPABASE_ANON_KEY=your-anon-key
python f12_collect_and_import.py
```

### Option 2: Set Variables in Terminal

**Mac/Linux:**
```bash
export SUPABASE_URL="https://xftiwouxpefchwoxxgpf.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
python f12_collect_and_import.py
```

**Windows Command Prompt:**
```cmd
set SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
set SUPABASE_ANON_KEY=your-anon-key
python f12_collect_and_import.py
```

**Windows PowerShell:**
```powershell
$env:SUPABASE_URL = "https://xftiwouxpefchwoxxgpf.supabase.co"
$env:SUPABASE_ANON_KEY = "your-anon-key"
python f12_collect_and_import.py
```

---

## 🔍 Verifying Setup

### Check Railway Variables

1. Go to Railway Dashboard
2. Click on your service
3. Go to Variables tab
4. Verify all three variables are listed:
   - ✅ SUPABASE_URL
   - ✅ SUPABASE_ANON_KEY
   - ✅ API_KEY

### Check Local Setup (if applicable)

```bash
# On Mac/Linux
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# On Windows Command Prompt
echo %SUPABASE_URL%
echo %SUPABASE_ANON_KEY%

# On Windows PowerShell
echo $env:SUPABASE_URL
echo $env:SUPABASE_ANON_KEY
```

Should print the actual URL and key, not empty.

---

## ❌ Common Errors

### Error: "SUPABASE_URL environment variable must be set"
**Cause:** Environment variable not set  
**Fix:** Add `SUPABASE_URL` to Railway variables or your local environment

### Error: "SUPABASE_KEY or SUPABASE_ANON_KEY environment variable must be set"
**Cause:** Environment variable not set  
**Fix:** Add `SUPABASE_ANON_KEY` to Railway variables or your local environment

### Error: API returns 401 Unauthorized
**Cause:** `API_KEY` mismatch between Vercel and Railway  
**Fix:** Make sure `REACT_APP_API_KEY` in Vercel matches `API_KEY` in Railway

---

## 🎯 Quick Reference

| Where | Variable | Value |
|-------|----------|-------|
| **Railway** | SUPABASE_URL | `https://xftiwouxpefchwoxxgpf.supabase.co` |
| **Railway** | SUPABASE_ANON_KEY | Same as Vercel `REACT_APP_SUPABASE_ANON_KEY` |
| **Railway** | API_KEY | Same as Vercel `REACT_APP_API_KEY` |
| **Vercel** | REACT_APP_SUPABASE_URL | `https://xftiwouxpefchwoxxgpf.supabase.co` |
| **Vercel** | REACT_APP_SUPABASE_ANON_KEY | Get from Supabase Dashboard |
| **Vercel** | REACT_APP_API_URL | Railway URL |
| **Vercel** | REACT_APP_API_KEY | Must match Railway `API_KEY` |

---

## 🔐 Security Note

The `.env` file in `automation/` is already in `.gitignore`, so it won't be committed to GitHub. This is intentional - **never commit credentials to git!**

If you need to share credentials with another developer, use a secure method like:
- Password manager (1Password, LastPass)
- Secure messaging (Signal, encrypted email)
- Never in plaintext via regular email or Slack!

---

## ✅ You're Done!

Once Railway has the environment variables:
1. ✅ Production sync will work
2. ✅ Credentials are secure (not in code)
3. ✅ You can rotate keys without changing code

**Test it:** Try syncing events from the Admin Dashboard to verify everything works!

---

**Questions?** Check `TESTING_GUIDE.md` for how to test after setup.
