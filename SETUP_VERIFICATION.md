# ✅ Quick Setup Verification Guide

This guide helps you verify that everything is set up correctly.

## Prerequisites Check

### 1. Node.js Installed
```bash
node --version
# Should show v14+ (e.g., v18.17.0)

npm --version
# Should show v6+ (e.g., v9.6.7)
```

If not installed, download from: https://nodejs.org

---

## Setup Steps

### Step 1: Install Dependencies ✅ DONE
```bash
npm install
```
This has already been done. All packages are installed.

### Step 2: Create Environment File ⚠️ REQUIRED
```bash
# Copy the example file
cp env.example .env.local

# Edit .env.local and add your Supabase anon key
# Use your preferred text editor:
# - Windows: notepad .env.local
# - Mac/Linux: nano .env.local
# - Or use VS Code: code .env.local
```

**Important:** Get your Supabase anon key from:
https://supabase.com/dashboard → Your Project → Settings → API → Project API keys

Your `.env.local` should look like:
```
REACT_APP_SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Verification Tests

### Test 1: Development Server
```bash
npm start
```

**Expected Result:**
- Terminal shows "Compiled successfully!"
- Browser opens to http://localhost:3000
- App loads without errors
- You see the Master Events Calendar dashboard

**If it fails:** Check that `.env.local` exists and has the correct values.

---

### Test 2: Production Build
```bash
npm run build
```

**Expected Result:**
- Terminal shows "Compiled successfully!"
- Creates `/build` folder
- Shows file sizes (main.js should be ~97 kB gzipped)

**Success Indicators:**
```
File sizes after gzip:
  97.69 kB  build/static/js/main.e03492b1.js
  6.13 kB   build/static/css/main.0299c3a0.css
```

---

### Test 3: Check for Errors
Open browser console (F12) after starting the app.

**Expected Result:**
- ✅ No RED errors
- ⚠️ Yellow warnings are OK (deprecation warnings)
- Should see successful Supabase connection

**If you see errors:**
1. Check `.env.local` credentials
2. Verify Supabase project is active
3. Check browser network tab for failed requests

---

## Common Issues & Solutions

### Issue: "Module not found"
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Missing environment variables"
**Solution:**
1. Ensure `.env.local` exists (not `env.local`)
2. Verify file has both variables set
3. Restart dev server after creating file

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :3000
taskkill /PID <process-id> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

Or use a different port:
```bash
PORT=3001 npm start
```

### Issue: White screen or blank page
**Solution:**
1. Check browser console for errors
2. Verify Supabase credentials are correct
3. Check network tab - should see successful API calls
4. Clear browser cache and reload

---

## Security Checklist

- [ ] `.env.local` file created with real credentials
- [ ] `.env.local` is NOT committed to git
- [ ] `.gitignore` includes `.env.local` (already configured ✅)
- [ ] Never share screenshots showing `.env.local` contents
- [ ] Never commit Supabase keys to GitHub

**Verify:**
```bash
git status
# Should NOT show .env.local
```

---

## Feature Verification

Once the app is running, test these features:

### Basic Features
- [ ] Calendar displays current month
- [ ] Can navigate to different months
- [ ] Events are visible on calendar
- [ ] Can filter by gym
- [ ] Can search events

### Admin Features (requires Shift+Click)
- [ ] Can add new event (Shift+Click on date/time)
- [ ] Can edit existing event (click on event)
- [ ] Can delete event
- [ ] Can access Admin Portal (Magic Control)
- [ ] Can bulk import events (F12 method)

### Data Verification
- [ ] Statistics table shows correct counts
- [ ] Gym links work when clicked
- [ ] Events persist after page reload
- [ ] Real-time updates work (try in two browser tabs)

---

## Build File Verification

After running `npm run build`, check:

```bash
ls -la build/
```

**Should contain:**
- `index.html` - Main HTML file
- `static/` folder with JS and CSS
- `favicon.png` or similar
- `manifest.json`

**File sizes should be reasonable:**
- Total build folder: < 5 MB
- Main JS bundle: < 100 KB (gzipped)
- CSS: < 10 KB (gzipped)

---

## Deployment Readiness

Before deploying to Vercel, ensure:

### Local Tests Pass
- [x] `npm install` completes without errors
- [ ] `.env.local` created with valid credentials
- [ ] `npm start` runs successfully
- [x] `npm run build` completes successfully
- [ ] App works in browser without console errors
- [ ] All features tested and working

### Vercel Prerequisites
- [ ] Vercel account created
- [ ] Supabase credentials ready
- [ ] GitHub repository connected (if deploying from GitHub)

### Environment Variables for Vercel
You'll need to add these in Vercel dashboard:
```
REACT_APP_SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-key>
```

---

## Success Criteria ✅

Your setup is complete when:

1. ✅ Dev server starts without errors
2. ✅ Production build completes successfully
3. ✅ App loads in browser
4. ✅ Can see events on calendar
5. ✅ No red errors in console
6. ✅ Database connection working
7. ✅ Can add/edit/delete events
8. ✅ Bulk import works

---

## Next Steps

After verifying setup:

1. **Read the User Guides**
   - `START_APP_GUIDE.md` - How to use the app
   - `docs/OPERATIONS/F12-IMPORT-GUIDE.md` - Bulk import workflow

2. **Review Assessment**
   - `SETUP_ASSESSMENT.md` - Detailed technical assessment

3. **Deploy to Production**
   - `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment guide

4. **Learn Advanced Features**
   - `docs/OPERATIONS/` - Operational guides
   - `docs/TECHNICAL/` - Technical documentation

---

## Quick Reference

### Essential Commands
```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run linter (if configured)
npm run lint

# Check for security issues
npm audit
```

### Important Files
- `.env.local` - Your credentials (create this!)
- `env.example` - Template for .env.local
- `package.json` - Dependencies and scripts
- `.gitignore` - Files excluded from git

### Important URLs
- Local dev: http://localhost:3000
- Supabase: https://supabase.com/dashboard
- Vercel: https://vercel.com/dashboard

---

## Getting Help

### Documentation
1. Check `SETUP_ASSESSMENT.md` for detailed analysis
2. Review `START_APP_GUIDE.md` for usage instructions
3. See `DEPLOYMENT_CHECKLIST.md` for deployment help

### Troubleshooting
1. Check browser console (F12) for errors
2. Review terminal output for error messages
3. Verify environment variables are set correctly
4. Try clearing cache and rebuilding

### Support Resources
- Create React App docs: https://create-react-app.dev
- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs

---

**Created:** October 19, 2025  
**Status:** Repository verified and ready for deployment  
**Next Action:** Create `.env.local` file and test locally

---

## Checklist Summary

Quick checklist to ensure you're ready:

**Setup**
- [x] Dependencies installed (`npm install`)
- [ ] `.env.local` created with Supabase credentials
- [ ] Dev server tested (`npm start`)
- [x] Production build tested (`npm run build`)

**Verification**
- [ ] App loads in browser
- [ ] No console errors
- [ ] Can view events
- [ ] Can add/edit events
- [ ] Database connection works

**Security**
- [ ] `.env.local` not committed to git
- [ ] Credentials kept private
- [ ] `.gitignore` properly configured

**Ready for Deployment**
- [ ] All local tests pass
- [ ] Vercel account ready
- [ ] Environment variables prepared

✅ = Done  
[ ] = Needs your action
