# 🚀 DEPLOYMENT CHECKLIST
## Master Events Calendar - Production Launch

**Last Updated:** October 15, 2025  
**Status:** Ready for deployment after checklist completion

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1️⃣ Environment Setup
- [ ] **Create `.env.local` file** (DO NOT COMMIT)
  ```bash
  # Copy the example file
  cp .env.example .env.local
  
  # Edit .env.local and add your actual Supabase anon key
  ```

- [ ] **Verify `.gitignore` is working**
  ```bash
  # Make sure .env.local is NOT in git status
  git status
  # Should NOT show .env.local
  ```

- [ ] **Test local startup**
  ```bash
  npm install
  npm start
  # App should open at http://localhost:3000
  # Check console for errors
  ```

---

### 2️⃣ Database Setup

- [ ] **Verify Supabase connection**
  - Open app and check if data loads
  - Check browser console for connection errors

- [ ] **Create required database views**
  Run these SQL scripts in Supabase SQL Editor:
  - [ ] `database/CREATE_EVENTS_WITH_GYM_VIEW.sql`
  - [ ] `database/performance_indexes.sql`

- [ ] **Verify tables exist**
  Required tables in Supabase:
  - [ ] `gyms`
  - [ ] `events`
  - [ ] `event_types`
  - [ ] `gym_links`
  - [ ] `link_types`
  - [ ] `monthly_requirements`
  - [ ] `event_audit_log`

- [ ] **Test database permissions**
  - Try adding an event
  - Try bulk import
  - Check audit log is recording

---

### 3️⃣ Assets & Files

- [ ] **Create or add favicon**
  ```bash
  # Option 1: Create a simple favicon
  # Place any PNG image as public/favicon.png
  
  # Option 2: Use a favicon generator
  # Visit https://favicon.io/
  # Download and place favicon.png in public/
  ```

- [ ] **Verify all assets load**
  - [ ] Open app in browser
  - [ ] Check browser console (F12)
  - [ ] Should see NO 404 errors for files

---

### 4️⃣ Code Cleanup

- [ ] **Remove unused imports**
  ```javascript
  // In src/components/EventsDashboard.js
  // Remove this line:
  import { collectAllGymsJob } from '../lib/collectAllGyms';
  ```

- [ ] **Delete unused hook file**
  ```bash
  # This file is never used
  rm src/components/EventsDashboard/hooks/useEventData.js
  ```

- [ ] **Fix cache invalidation** (see PRE_LAUNCH_REVIEW.md section)

- [ ] **Update START_APP_GUIDE.md** with correct path

---

### 5️⃣ Vercel Deployment

- [ ] **Login to Vercel**
  - Visit https://vercel.com
  - Login with your account

- [ ] **Import project**
  - Click "Add New Project"
  - Import from Git repository
  - Or deploy from local folder

- [ ] **Configure Environment Variables**
  In Vercel Dashboard → Settings → Environment Variables:
  ```
  REACT_APP_SUPABASE_URL = https://xftiwouxpefchwoxxgpf.supabase.co
  REACT_APP_SUPABASE_ANON_KEY = [your-actual-key-here]
  ```

- [ ] **Configure Build Settings**
  - Build Command: `npm run build`
  - Output Directory: `build`
  - Install Command: `npm install`
  - Framework Preset: `Create React App`

- [ ] **Deploy**
  - Click "Deploy"
  - Wait for build to complete
  - Check for any build errors

---

### 6️⃣ Post-Deployment Testing

- [ ] **Open deployed URL**
  - Vercel will provide URL like: `https://your-project.vercel.app`

- [ ] **Test all features**
  - [ ] Calendar loads with events
  - [ ] Filters work (gym, event type, search)
  - [ ] Month navigation works
  - [ ] Add single event (Shift+Click on date/time)
  - [ ] Edit event (click on event)
  - [ ] Delete event
  - [ ] Bulk import (Magic Control → Import)
  - [ ] Statistics table shows correct data
  - [ ] Gym links work (click on stats numbers)

- [ ] **Test on different devices**
  - [ ] Desktop browser
  - [ ] Mobile phone
  - [ ] Tablet
  - [ ] Different browsers (Chrome, Firefox, Safari, Edge)

- [ ] **Check browser console**
  - Press F12 → Console tab
  - Should see NO red errors
  - Yellow warnings are OK

- [ ] **Check Network tab**
  - Press F12 → Network tab
  - Refresh page
  - All requests should return 200 (OK)
  - No 404 (Not Found) or 500 (Server Error)

---

### 7️⃣ Performance Check

- [ ] **Test load time**
  - First load should be < 3 seconds
  - Subsequent loads should be < 1 second

- [ ] **Test with slow network**
  - F12 → Network tab → Throttling → Slow 3G
  - Should still load and be usable

- [ ] **Check Vercel Analytics**
  - Dashboard → Analytics
  - Verify Web Vitals are in "Good" range

---

### 8️⃣ Security Verification

- [ ] **Environment variables NOT exposed**
  - View page source (Ctrl+U)
  - Search for "REACT_APP_SUPABASE"
  - Should NOT find any keys

- [ ] **HTTPS enabled**
  - URL should start with `https://`
  - Lock icon in browser address bar

- [ ] **Supabase RLS enabled**
  - Check Supabase Dashboard → Authentication → Policies
  - Verify Row Level Security is enabled

---

### 9️⃣ Backup & Recovery

- [ ] **Document current database state**
  - Supabase → Database → Backups
  - Note the backup timestamp

- [ ] **Know how to rollback**
  - Vercel → Deployments → Previous deployment → "Visit"
  - Can instantly revert to previous version

- [ ] **Export critical data**
  - Supabase → Table Editor
  - Export gyms, events, event_types as CSV backup

---

### 🔟 Documentation

- [ ] **Update README.md**
  - [ ] Production URL documented
  - [ ] Setup instructions accurate
  - [ ] Contact information updated

- [ ] **Share access**
  - [ ] Vercel team members invited
  - [ ] Supabase team members invited
  - [ ] Documentation shared

- [ ] **Create runbook**
  - Document common issues and fixes
  - Emergency contacts
  - Rollback procedure

---

## 🚨 EMERGENCY ROLLBACK PROCEDURE

If something goes wrong after deployment:

1. **Immediate Rollback**
   ```
   Vercel Dashboard → Deployments → Find previous working deployment → Click "Promote to Production"
   ```

2. **Database Issues**
   ```
   Supabase Dashboard → Database → Backups → Restore to previous backup
   ```

3. **Contact Support**
   - Vercel Support: https://vercel.com/support
   - Supabase Support: https://supabase.com/support

---

## ✅ LAUNCH CRITERIA

### All of these must be ✅ before going live:

1. ✅ All critical issues from PRE_LAUNCH_REVIEW.md fixed
2. ✅ Environment variables configured correctly
3. ✅ Database views and tables exist
4. ✅ All assets present (no 404 errors)
5. ✅ Vercel deployment successful
6. ✅ Post-deployment testing completed
7. ✅ Backup created
8. ✅ Team members have access

---

## 📊 SUCCESS METRICS

After deployment, monitor these:

| Metric | Target | How to Check |
|--------|--------|--------------|
| Uptime | 99.9% | Vercel dashboard |
| Load time | < 3s | Vercel Analytics |
| Error rate | < 0.1% | Browser console logs |
| User satisfaction | Positive feedback | Direct user feedback |

---

## 🎉 POST-LAUNCH

After successful deployment:

1. **Monitor for 24 hours**
   - Check for errors in Vercel logs
   - Watch for user feedback
   - Verify data is syncing correctly

2. **Celebrate!** 🎊
   - This is a major achievement
   - Document lessons learned
   - Plan next features

3. **Schedule review**
   - 1 week: Check metrics and user feedback
   - 1 month: Evaluate performance and plan improvements
   - 3 months: Major feature review

---

## 📞 SUPPORT

**Technical Issues:**
- Developer: [Your contact info]
- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support

**Business Issues:**
- Project Owner: Jayme
- Documentation: See `docs/` folder

---

**Ready to deploy?** Start with step 1️⃣ and check off each item as you go!

**Questions?** Review PRE_LAUNCH_REVIEW.md for detailed explanations of any issues.

