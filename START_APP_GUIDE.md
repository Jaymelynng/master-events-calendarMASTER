# 🚀 HOW TO START YOUR MASTER EVENTS APP
## Simple Steps - No Tech Knowledge Required

---

## ⚡ QUICK START (Do This Every Time)

### **Step 1: Open Command Prompt**
1. Press `Windows Key + R`
2. Type: `cmd`
3. Press Enter

### **Step 2: Copy-Paste This ONE Command**
Copy this entire line and paste into the black window, then press Enter:
```
cd "C:\JAYME PROJECTS\ACTIVE - master-events-calendar" && npm start
```

**That's it!** One command does everything.

### **Step 4: Wait**
- You'll see text scrolling (that's normal!)
- Wait about 20 seconds
- Your web browser should automatically open to: `http://localhost:3000`

### **Step 5: You're Done!**
The app is now running. Keep that terminal window open while you use the app.

---

## 🛑 HOW TO STOP THE APP

When you're finished:
1. Go back to the terminal window
2. Press: `Ctrl + C`
3. Type: `Y` and press Enter
4. Close the terminal window

---

## ❓ TROUBLESHOOTING

### **Problem: "npm is not recognized"**
**What it means:** Your computer doesn't have Node.js installed

**Solution:**
1. Go to: https://nodejs.org
2. Download the "LTS" version (big green button)
3. Install it (keep clicking "Next")
4. Restart your computer
5. Try again from Step 1

---

### **Problem: Browser doesn't open automatically**
**What it means:** The app is running but didn't auto-open

**Solution:**
1. Open your web browser manually
2. Type in the address bar: `localhost:3000`
3. Press Enter

---

### **Problem: "Port 3000 is already in use"**
**What it means:** The app is already running somewhere

**Solution:**
1. Look for other browser tabs with `localhost:3000`
2. Close them
3. Go back to terminal
4. Press `Ctrl + C`
5. Try `npm start` again

---

### **Problem: Blank white screen or errors**
**What it means:** Something needs to be reinstalled

**Solution:**
1. Stop the app (`Ctrl + C`)
2. Type this command:
   ```
   npm install
   ```
3. Wait for it to finish (might take 2-3 minutes)
4. Try `npm start` again

---

## 📱 ACCESSING FROM OTHER DEVICES

Want to open the calendar on your phone/tablet while connected to the same WiFi?

1. In the terminal, look for a line that says:
   ```
   On Your Network: http://192.168.X.X:3000
   ```
2. Type that address into your phone's browser
3. The calendar will work on any device!

---

## 🎯 WHAT THOSE TERMINAL MESSAGES MEAN

When you start the app, you'll see messages like:

**✅ GOOD MESSAGES (Everything's Fine):**
- `"Compiled successfully!"`
- `"webpack compiled"`
- `"Local: http://localhost:3000"`
- These mean: **App is working!**

**⚠️ WARNING MESSAGES (Annoying but Harmless):**
- Yellow text warnings
- `"Deprecation warning"`
- These mean: **Ignore these, app still works**

**❌ BAD MESSAGES (Something's Wrong):**
- Red text with "ERROR"
- `"Failed to compile"`
- `"Module not found"`
- These mean: **Screenshot it and ask for help**

---

## 💾 WHERE IS YOUR DATA?

Your calendar data is stored in:
- **Supabase** (online database in the cloud)
- It's NOT on your computer
- So you can access it from anywhere
- Your data is safe even if your computer breaks

**Database Address:** `https://xftiwouxpefchwoxxgpf.supabase.co`

---

## 🔐 IMPORTANT SECURITY NOTE

The `.env.local` file contains your database password.

**DO NOT:**
- ❌ Share this file with anyone
- ❌ Post screenshots showing it
- ❌ Upload it to GitHub
- ❌ Email it to yourself

**If you accidentally expose it:**
1. Go to Supabase dashboard
2. Generate a new API key
3. Update your `.env.local` file
4. Tell me - I'll help you update it

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

## 🎓 UNDERSTANDING THE TERMINAL

Think of the terminal like this:
- **Terminal** = A way to give your computer typed instructions
- **npm** = A tool that manages your app's pieces
- **start** = The command to run your app
- **localhost** = Your computer's "address" for running apps locally
- **3000** = The specific "door number" your app uses

You don't need to memorize any of this - just follow the steps!

---

**Next Steps After Starting:**
Once your app loads, check out: `MONTHLY_WORKFLOW_GUIDE.md` (I'll create this next) for how to actually USE your calendar system.

---

**Created:** October 6, 2025  
**Version:** 1.0  
**For:** Jayme - Master Events Calendar Owner

