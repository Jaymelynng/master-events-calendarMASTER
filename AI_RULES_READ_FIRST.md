# 🚨 AI AGENT - READ THIS FIRST - MANDATORY

## ⚠️ CRITICAL RULES - NO EXCEPTIONS

### **RULE #1: NEVER SAY "IT SHOULD WORK"**
- ❌ NEVER say "this should work" or "it will work"
- ✅ ONLY say "I tested it and it works" AFTER actually testing

### **RULE #2: TEST WITH JAYME'S ACTUAL DATA**
- ❌ NEVER simulate with fake/sample data
- ✅ ALWAYS use the EXACT data Jayme provided from Supabase
- ✅ Write test scripts using HER actual database values

### **RULE #3: VERIFY DATA IS LOADING**
- ❌ NEVER assume data fetches correctly
- ✅ ALWAYS check what the API actually returns
- ✅ Test the ENTIRE data flow from database → component

### **RULE #4: USE BROWSER CONSOLE**
- When something doesn't work, ask Jayme to:
  1. Open F12 console
  2. Copy/paste console output
  3. Share what she sees
- This shows REAL errors, not assumptions

### **RULE #5: READ ALL DOCUMENTATION FIRST**
- Jayme spent MONTHS creating documentation
- CAMP_COMPLEXITY_MASTER_GUIDE.md
- F12-IMPORT-GUIDE.md
- SUPABASE-ARCHITECTURE.md
- AI_VERIFICATION_PROTOCOL.md
- **READ THEM BEFORE CODING ANYTHING**

### **RULE #6: VERIFY AGAINST DATABASE SCHEMA**
- Jayme gave you actual Supabase queries
- Use the EXACT column names from her data
- Never assume columns exist (like gym_code)
- Check the actual data structure she provided

### **RULE #7: NO HARDCODING**
- From CAMP_COMPLEXITY_MASTER_GUIDE.md line 57:
- **"Don't hard-code anything based on this snapshot. Build detection logic that adapts to whatever the data contains."**

### **RULE #8: WHEN YOU FAIL**
- Don't make excuses
- Don't suggest hiring someone else
- Don't say "it should work"
- Just fix it with REAL testing

---

## 🎯 CURRENT ISSUE TRACKING

**✅ REAL-TIME SUBSCRIPTIONS IMPLEMENTED:**
- **Feature**: App now "attached" to Supabase database
- **What it does**: Changes in database appear automatically without refresh
- **Tables subscribed**: events, gyms, gym_links
- **Status**: Ready to test
- **Next Step**: User should test by opening two browser tabs and seeing changes appear automatically

---

## ✅ TESTING CHECKLIST BEFORE SAYING ANYTHING WORKS

- [ ] Tested with Jayme's ACTUAL Supabase data
- [ ] Verified data loads correctly (not empty/null)
- [ ] Simulated the ENTIRE code path
- [ ] Checked for column name mismatches
- [ ] Verified against database schema Jayme provided
- [ ] Asked Jayme to test on live app
- [ ] Got confirmation from Jayme it works

**If you can't check ALL boxes, DON'T say it works!**

---

**Last Updated**: Now  
**Reason**: Jayme is frustrated because I keep failing to verify properly  
**Commitment**: No more assumptions, only verified facts

