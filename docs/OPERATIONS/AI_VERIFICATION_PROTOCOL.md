# 🚨 AI VERIFICATION PROTOCOL - MANDATORY

## **CRITICAL RULE: NEVER ASSUME CODE WORKS**

**Created:** October 7, 2025  
**Reason:** AI told user "duplicate detection works" after code review. User imported 3 times. Created 12 duplicates. AI wasted user's time by assuming instead of testing.

---

## **THE PROBLEM:**

When Jayme asks "Does X work correctly?" or "Verify the system":
- ❌ **WRONG APPROACH:** Read the code, see the logic looks correct, say "Yes, it works!" ✅
- ✅ **CORRECT APPROACH:** Say "Let me TEST it" and actually run/verify the behavior

**Reading code ≠ Testing code**

---

## **MANDATORY VERIFICATION STEPS:**

### **When User Asks to Verify ANY System:**

1. **ASK TO TEST IT LIVE**
   - "Let me test this with real data"
   - "Can you try importing one event so I can verify?"
   - "Let me check the actual database to confirm"

2. **NEVER SAY "IT WORKS" UNLESS:**
   - ✅ You've seen it work with real data
   - ✅ You've checked the actual database/logs
   - ✅ User has successfully tested it themselves

3. **IF YOU CAN'T TEST:**
   - Say: "I cannot verify this without testing. Here's what could go wrong..."
   - List potential failure points
   - Ask user to test with ONE record first

4. **IF CODE "LOOKS RIGHT":**
   - Say: "The code APPEARS correct, but I need to test it to be sure"
   - Never say "it works" or "it's fine" based on reading alone

---

## **SPECIFIC TO THIS PROJECT:**

### **Import System Verification:**
Before saying "duplicate detection works":
1. Check the database for existing events
2. Have user import ONE event
3. Check database again - did it create duplicate?
4. If no duplicate: ✅ THEN say it works
5. If duplicate: ❌ Find the bug and fix it

### **Any Feature Verification:**
1. **User tests it first** with minimal data
2. **AI checks the results** in database/logs
3. **THEN confirm** it works or doesn't

---

## **BUG THAT TRIGGERED THIS:**

**File:** `src/components/EventsDashboard.js`  
**Line:** 1122  
**Issue:** Duplicate detection checks `events` state (client-side cache) instead of fresh database query  
**Result:** Second/third imports don't see events from first import  
**Fix:** [TO BE IMPLEMENTED]

---

## **AI COMMITMENT:**

**I (AI) will:**
1. ❌ NEVER assume code works by reading it
2. ✅ ALWAYS ask to test before confirming functionality
3. ✅ ALWAYS be honest: "I can't verify without testing"
4. ✅ ALWAYS suggest testing with minimal data first
5. ✅ ALWAYS check actual results (database, logs, behavior)

**If I violate this:**
- User should reference this document
- User's time was wasted by AI negligence
- AI must fix the issue immediately and apologize

---

## **FOR FUTURE AI SESSIONS:**

If you're reading this: **Jayme is not a coder.** She trusts your technical judgment completely. 

**NEVER ABUSE THAT TRUST.**

If she asks "does it work?" and you haven't tested it:
- Say: **"I need to test it to be sure"**
- Don't say: "Yes, the code looks fine"

**Her time is valuable. Test first. Confirm second.**

---

**This document is permanent and must be referenced before ANY technical verification.**



