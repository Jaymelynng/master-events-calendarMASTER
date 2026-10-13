> ⚠️ STALE (checked 2026-10-13): copied off a deleted branch (commit 6bb602b) — it describes the app as of its own date, not now. Feb 11, 2026 cleanup-branch notes; the live repo has moved on (Direct API sync, REFACTORED dashboard live, `/health` returns status ok). Current: `CLAUDE.md`, `.env.example`.

# Testing Guide - After Cleanup

**Date:** February 11, 2026  
**Branch:** copilot/review-documentation-work

This guide helps you verify that all cleanup changes work correctly without breaking existing functionality.

---

## 🎯 What Changed

This cleanup focused on **non-functional improvements** - security, code quality, and error handling. All existing features should work exactly as before, but now:
- More secure (no hardcoded credentials)
- More reliable (timeout + retry logic)
- Cleaner code (no debug spam)

---

## ✅ Testing Checklist

### 1. Environment Setup (Required Before Testing)

The Python automation script now **requires** environment variables. Set these before testing:

#### On Railway (Production API)
Add these in Railway Dashboard → Variables:
```
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
API_KEY=[your-api-key]
```

#### For Local Testing (Optional)
Create a `.env` file in the `automation/` folder:
```bash
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
```

⚠️ **Important:** Without these environment variables, the Python script will fail immediately with a clear error message.

### 2. Core Functionality Tests

Test these features to ensure everything still works:

#### ✅ Test 1: Manual Sync (Admin Dashboard)
1. Open https://teamcalendar.mygymtools.com
2. Click the Admin button (🪄 magic wand with Shift+Click)
3. Click "Automated Sync" in Quick Actions
4. Select a gym (e.g., RBA)
5. Select an event type (e.g., KIDS NIGHT OUT)
6. Click "Sync Events"
7. **Expected:** Events sync successfully (or clear error if timeout)
8. **New:** If it times out, you'll see a helpful message about the 2-minute timeout

#### ✅ Test 2: Bulk Import (JSON)
1. In Admin Dashboard, go to Quick Actions
2. Click "JSON Import (F12 Method)"
3. Paste valid event JSON
4. Click "Import Events"
5. **Expected:** Events import successfully
6. **New:** Better error messages if something fails

#### ✅ Test 3: Calendar Display
1. Go to main calendar view
2. Filter by different gyms
3. Filter by different event types
4. Click on events to see details
5. **Expected:** Everything works as before
6. **New:** Console should be much cleaner (check F12 → Console)

#### ✅ Test 4: Real-time Updates
1. Open the app in two browser tabs
2. Add/edit an event in one tab
3. **Expected:** Other tab updates automatically
4. **New:** No debug logs in console (only errors if something breaks)

### 3. Error Handling Tests

These tests verify the new timeout and retry logic:

#### ✅ Test 5: Network Resilience
1. Turn off WiFi or disconnect network briefly
2. Try to sync events
3. **Expected:** Clear error message about connection failure
4. **New:** After reconnecting, the app might auto-retry (up to 2 times)

#### ✅ Test 6: Slow API Response
1. Sync a large gym with many events (e.g., ALL events for a gym)
2. **Expected:** Either succeeds or times out after 2 minutes
3. **New:** Clear timeout message if it takes too long

### 4. Console Check (Developer Tools)

Open browser console (F12) and check:

#### Before Cleanup (Old Logs)
```
🔴 Setting up real-time subscription...
🔴 Real-time event detected: INSERT
✅ Real-time subscription active!
🔍 Checking for existing events...
📊 Total events to import: 25
✅ Successfully imported 25 new events
```

#### After Cleanup (Clean Logs)
```
(empty, unless there's an actual error)
```

**Expected:** Console should be almost empty. Only `console.error()` messages appear if something actually breaks.

---

## 🐛 What To Watch For

### Potential Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Script fails immediately | Missing env vars in Railway | Add SUPABASE_URL and SUPABASE_ANON_KEY to Railway |
| Sync times out | Operation takes >2 minutes | Normal - the timeout is working! Consider smaller batches |
| Import fails after retry | Persistent server issue | Check Railway logs for root cause |
| Real-time not working | Network or Supabase issue | Check browser console for errors |

### Where to Look for Errors

1. **Browser Console (F12)** - Frontend errors
2. **Railway Logs** - Backend/API errors
3. **Supabase Logs** - Database errors

---

## 📊 Success Criteria

✅ **Pass:** All tests work the same as before  
✅ **Pass:** Console is much cleaner (no debug spam)  
✅ **Pass:** Clear error messages if something fails  
✅ **Pass:** Sync operations eventually succeed or fail gracefully  

❌ **Fail:** Features that worked before now broken  
❌ **Fail:** No error messages when things fail  
❌ **Fail:** App crashes or hangs indefinitely  

---

## 🔧 Troubleshooting

### Problem: Python script won't run
**Symptom:** Immediate error about environment variables  
**Solution:** Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your environment

### Problem: Sync takes forever
**Symptom:** Operation never completes  
**Solution:** This is what the cleanup fixed! It should now timeout after 2 minutes with a clear message.

### Problem: Too many retries
**Symptom:** Same operation tried multiple times  
**Solution:** The app retries up to 2 times. If it fails after that, check Railway logs for the root cause.

### Problem: Real-time updates stopped
**Symptom:** Changes don't appear automatically  
**Solution:** Check browser console for subscription errors. This is unrelated to cleanup (Supabase connection issue).

---

## 📞 Need Help?

If something breaks that worked before:

1. Check browser console (F12) for error messages
2. Check Railway logs for backend errors
3. Verify environment variables are set in Railway
4. Compare console output before/after to see if new errors appeared

---

## ✅ Final Checklist

Before merging this cleanup:

- [ ] Verified Railway environment variables are set
- [ ] Tested manual sync (at least one gym)
- [ ] Tested bulk import
- [ ] Checked browser console is cleaner
- [ ] Verified no new errors in production
- [ ] Real-time updates still work

If all checked, the cleanup is safe to merge! 🎉

---

**Remember:** This cleanup doesn't add new features - it makes existing features more secure and reliable. Everything should work exactly as before, just better.
