# 🔍 WHAT IS "DATA QUALITY"? - Simple Explanation

## 📋 QUICK ANSWER

**"Data Quality"** finds events that have **mistakes or problems** by comparing what the system knows about an event (date, time, age, etc.) against what the description text says.

It catches things like:
- ✅ Wrong dates copied in descriptions
- ✅ Wrong times mentioned
- ✅ Missing descriptions
- ✅ Events with only images (no text)
- ✅ Sold out events

---

## 🎯 REAL-WORLD EXAMPLES

### Example 1: Date Mismatch
```
Event Date: January 24, 2025
Description Says: "Join us on December 27th..."
```
**🚨 Problem:** The event is in January, but the description says December!
**Why this happens:** Gym copied an old description and forgot to update the date.

---

### Example 2: Wrong Event Type
```
Event Type: Kids Night Out
Description Says: "Cartwheel Clinic at..."
```
**🚨 Problem:** This is a KNO event, but the description says it's a Clinic!
**Why this happens:** Wrong description copied from another event.

---

### Example 3: Missing Description
```
Event has: Image/Flyer only
Event has: No text description
```
**❌ Problem:** Users can't read what the event is about - only see an image.
**Why this matters:** Not accessible, can't be searched, poor user experience.

---

### Example 4: Skill Mismatch (Clinics)
```
Title: "Back Handspring Clinic"
Description: "Cartwheel Clinic at Rowland Ballard..."
```
**🚨 Problem:** Title says "Back Handspring" but description says "Cartwheel" - wrong clinic!
**Why this happens:** Copied description from wrong clinic event.

---

## 📊 WHAT GETS CHECKED

| Check | What It Finds | Example |
|-------|---------------|---------|
| **Date** | Date in description doesn't match event date | "January 24" event with "December 27" in description |
| **Time** | Time in description doesn't match event time | "2:30 PM" event with "6:30 PM" in description |
| **Age** | Age range in description doesn't match | "Ages 5-12" event with "Ages 7-17" in description |
| **Program Type** | Wrong event type in description | "Open Gym" with "Clinic" description |
| **Skill (Clinics)** | Wrong skill mentioned | "Back Handspring Clinic" with "Cartwheel" description |
| **Missing Description** | No description text at all | Empty or NULL description |
| **Flyer Only** | Has image but no readable text | Only an `<img>` tag, no text content |
| **Sold Out** | Event has no openings | `has_openings = false` |

---

## 🎯 WHY IT MATTERS

### For Users:
- ❌ **Confusing:** Wrong date/time means users show up wrong day/time
- ❌ **Frustrating:** Missing descriptions mean users can't learn about events
- ❌ **Wasteful:** Sold out events shouldn't be prominently displayed

### For You:
- ✅ **Catch mistakes early** before they confuse customers
- ✅ **Maintain quality** across all gyms
- ✅ **Find copy/paste errors** from old descriptions
- ✅ **Ensure consistency** in event information

---

## 📤 HOW TO USE IT IN EXPORTS

When you click **"🔍 Data Quality Issues"** in the Export modal, you get a CSV with:

```
Gym | Title | Date | Type | Issues | URL
----|-------|------|------|--------|-----
EST | Back Handspring Clinic | 2025-01-24 | CLINIC | Date mismatch: description says December | [link]
RBA | Kids Night Out | 2025-02-15 | KNO | Missing description | [link]
```

**Use this to:**
1. Fix events with problems
2. Contact gyms about mistakes
3. Track quality over time
4. Find patterns (which gyms make most mistakes?)

---

## 🔄 WHEN DATA QUALITY IS CHECKED

**Automatically during sync:**
- Every time you sync events from iClassPro
- System compares structured data vs description text
- Flags issues immediately
- Stores results in `validation_errors` field

**Not checked:**
- CAMP events (too complex, many false positives)
- Events you manually add (no description to compare)

---

## ✅ UNDERSTANDING THE STATUS MESSAGE

When you see:
> ✅ "No data quality issues found! All 85 events have complete descriptions and no validation errors."

**This means:**
- All events have text descriptions (not just images)
- No date/time/age mismatches found
- No program type mismatches
- All validation checks passed

**It does NOT mean:**
- Events are perfect (just no technical errors)
- Descriptions are well-written (just present and matching)
- Events are interesting (just data quality is good)

---

## 🚨 VALIDATION ERROR ICONS ON CALENDAR

When viewing events on the calendar, you'll see icons:

| Icon | Meaning |
|------|---------|
| 🚨 | Error - Serious mismatch (wrong date, wrong program type) |
| ⚠️ | Warning - Minor issue (wrong time, wrong age) |
| ❌ | Error - Missing description entirely |
| 🖼️ | Info - Has flyer image (not a problem, just informational) |

Click on an event to see the specific errors in the side panel.

---

## 📚 MORE INFORMATION

For technical details, see: `docs/OPERATIONS/DATA_QUALITY_VALIDATION.md`

---

**In Summary:** Data Quality = "Does the event information make sense and match reality?"

