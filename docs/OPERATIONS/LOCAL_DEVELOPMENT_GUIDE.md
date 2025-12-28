# 🚀 LOCAL DEVELOPMENT GUIDE
## How to Run the Master Events Calendar Locally

**Last Updated:** December 28, 2025  
**Location:** `docs/OPERATIONS/LOCAL_DEVELOPMENT_GUIDE.md`

---

## ⚡ QUICK START

### **Step 1: Open Terminal**
- **Windows:** Press `Windows Key + R`, type `cmd`, press Enter
- **Mac:** Press `Cmd + Space`, type `Terminal`, press Enter

### **Step 2: Navigate to Project**
```bash
cd "C:\JAYME PROJECTS\HUB -ACTIVE - master-events-calendar"
```

### **Step 3: Start the App**
```bash
npm start
```

**That's it!** Your browser will open to `http://localhost:3000`

---

## 🛑 HOW TO STOP THE APP

1. Go back to the terminal window
2. Press: `Ctrl + C`
3. Type: `Y` and press Enter (if prompted)
4. Close the terminal window

---

## 🔧 FIRST-TIME SETUP

If this is your first time running the app:

### **1. Install Dependencies**
```bash
npm install
```
Wait 2-3 minutes for packages to download.

### **2. Create Environment File**
```bash
# Copy the example file
cp env.example .env.local
```

Then edit `.env.local` with your actual credentials:
```
REACT_APP_SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=[your-anon-key]
REACT_APP_API_URL=https://master-events-calendarmaster-production.up.railway.app
REACT_APP_API_KEY=[your-api-key]
```

### **3. Start the App**
```bash
npm start
```

---

## ❓ TROUBLESHOOTING

### **"npm is not recognized"**
Node.js isn't installed.
1. Go to: https://nodejs.org
2. Download the "LTS" version
3. Install it
4. Restart your computer
5. Try again

### **Browser doesn't open automatically**
1. Open your web browser manually
2. Type: `localhost:3000`
3. Press Enter

### **"Port 3000 is already in use"**
1. Look for other browser tabs with `localhost:3000`
2. Close them
3. Press `Ctrl + C` in terminal
4. Try `npm start` again

### **Blank white screen or errors**
1. Stop the app (`Ctrl + C`)
2. Run: `npm install`
3. Wait for it to finish
4. Try `npm start` again

### **Data not loading**
1. Check `.env.local` exists and has correct values
2. Open browser console (F12)
3. Look for red error messages
4. Verify Supabase is accessible

---

## 📱 ACCESSING FROM OTHER DEVICES

Want to open the calendar on your phone/tablet while connected to the same WiFi?

1. In the terminal, look for:
   ```
   On Your Network: http://192.168.X.X:3000
   ```
2. Type that address into your phone's browser

---

## 🎯 TERMINAL MESSAGE GUIDE

### ✅ GOOD MESSAGES (App is Working):
- `Compiled successfully!`
- `webpack compiled`
- `Local: http://localhost:3000`

### ⚠️ WARNING MESSAGES (Ignore These):
- Yellow text warnings
- `Deprecation warning`

### ❌ BAD MESSAGES (Need Attention):
- Red text with "ERROR"
- `Failed to compile`
- `Module not found`

---

## 💾 WHERE IS YOUR DATA?

Your calendar data is stored in **Supabase** (cloud database):
- **URL:** `https://xftiwouxpefchwoxxgpf.supabase.co`
- Data is NOT on your computer
- You can access it from anywhere
- Data is safe even if your computer breaks

---

## 🔐 SECURITY NOTE

The `.env.local` file contains your credentials.

**DO NOT:**
- ❌ Share this file with anyone
- ❌ Post screenshots showing it
- ❌ Upload it to GitHub
- ❌ Email it

**If exposed:** Generate new API keys in Supabase/Railway dashboards.

---

## 🔄 ALTERNATIVE: USE THE BAT FILE

For even quicker startup, use the batch file:

1. Navigate to project folder in File Explorer
2. Double-click `start-app.bat`
3. App will start automatically

---

## 📞 WHEN TO ASK FOR HELP

**Ask immediately if:**
- The app won't start after following all steps
- You see red ERROR messages
- The calendar shows no data
- Something that worked yesterday doesn't work today

**Don't worry about:**
- Yellow warning messages
- Slow loading the first time
- Terminal text looks scary (that's normal!)

---

*Originally created: October 6, 2025*  
*Last Updated: December 28, 2025*  
*Migrated from START_APP_GUIDE.md with updated paths*

