# ✅ EXPORT TERMINOLOGY - CLARIFIED

## 🎯 NAMING CONSISTENCY FIXED

**Changed:** "Data Quality Issues" → **"Audit Check"** ✅

Now matches the terminology used in the main dashboard table column "Audit Check"

---

## 📊 WHAT EACH EXPORT SECTION DOES

### **1. 📋 Event Details**
**What it is:** Raw list of all events in your selected date range

**Shows:**
- Gym name, event title, type, date, time, price, age range
- Description status, availability, URL
- One row per event

**Use when:** You want the full event list (like a spreadsheet of all events)

---

### **2. 📊 Analytics Dashboard**
**What it is:** Summary statistics for ALL gyms

**Shows:**
- **All gyms** (even if they meet requirements)
- Counts for each event type (CLINIC, KNO, OPEN GYM, CAMP, SPECIAL EVENT)
- Required counts vs actual counts
- Whether each gym meets requirements (YES/NO)
- What's missing (if anything)

**Example Output:**
```
Gym    | Clinics | KNO  | Open Gym | Meets Requirements | Missing
-------|---------|------|----------|-------------------|--------
EST    | 1/1     | 2/2  | 1/1      | YES               | 
CCP    | 1/1     | 1/2  | 1/1      | NO                | needs 1 KNO
RBA    | 0/1     | 2/2  | 1/1      | NO                | needs 1 CLINIC
```

**Use when:** You want a complete overview of all gyms' performance

---

### **3. ⚠️ Missing Requirements**
**What it is:** Filtered list - ONLY gyms that DON'T meet requirements

**Shows:**
- **Only gyms that are missing something**
- What specifically is missing
- Current counts they have

**Example Output:**
```
Gym    | Missing Events        | Clinics Have | KNO Have | Open Gym Have
-------|-----------------------|--------------|----------|---------------
CCP    | needs 1 KNO           | 1            | 1        | 1
RBA    | needs 1 CLINIC        | 0            | 2        | 1
```

**Use when:** You only care about gyms that need attention (faster to scan)

---

### **KEY DIFFERENCE:**

| Feature | Analytics Dashboard | Missing Requirements |
|---------|-------------------|---------------------|
| Shows all gyms? | ✅ Yes, ALL gyms | ❌ No, only failing gyms |
| Shows compliant gyms? | ✅ Yes | ❌ No |
| Shows non-compliant gyms? | ✅ Yes | ✅ Yes |
| Use for overview | ✅ Yes | ❌ No |
| Use for action items | ⚠️ Works but shows everything | ✅ Better - focused |

**Think of it like:**
- **Analytics Dashboard** = Full report card (all students, all grades)
- **Missing Requirements** = List of students who failed (only problem students)

---

### **4. 🔍 Audit Check** (formerly "Data Quality Issues")
**What it is:** Events that have validation errors or missing information

**Shows:**
- Events with wrong dates/times/ages in descriptions
- Events missing descriptions entirely
- Events with only images (no text)
- Sold out events
- Program type mismatches (e.g., KNO event with Clinic description)
- Skill mismatches (e.g., "Back Handspring" title but "Cartwheel" in description)

**Example Output:**
```
Gym | Title                | Date       | Issues                            | URL
----|---------------------|------------|-----------------------------------|-----
EST | Back Handspring     | 2025-01-24 | Date mismatch: description says Dec | [link]
RBA | Kids Night Out      | 2025-02-15 | Missing description                | [link]
```

**Use when:** You want to find and fix events with errors

**This matches the "Audit Check" column in the main dashboard table** ✅

---

## 🔄 RELATIONSHIPS BETWEEN SECTIONS

```
Analytics Dashboard
├─ Shows ALL gyms
│  ├─ Some meet requirements ✅
│  └─ Some don't meet requirements ❌
│
Missing Requirements
└─ Filters Analytics Dashboard
   └─ Shows ONLY gyms that don't meet requirements ❌

Event Details
└─ Raw event list (not summarized)

Audit Check
└─ Individual events with problems (not gym-level summary)
```

---

## 💡 RECOMMENDED WORKFLOWS

### **Monthly Compliance Report:**
1. ✅ Use "Analytics Dashboard" - see all gyms
2. ✅ Use "Missing Requirements" - focus on problem gyms
3. ❌ Don't need "Event Details" (unless you want the full list)

### **Find Event Problems:**
1. ✅ Use "Audit Check" - find events with errors
2. ❌ Don't need Analytics/Missing (those are about requirements, not data quality)

### **Complete Overview:**
1. ✅ Use "Event Details" - full list
2. ✅ Use "Analytics Dashboard" - gym summaries
3. ✅ Use "Audit Check" - data quality issues
4. ✅ Use "Missing Requirements" - action items

---

## ✅ SUMMARY

| Export Section | Scope | Level | Shows What |
|----------------|-------|-------|------------|
| **Event Details** | All events | Event-level | Raw event data |
| **Analytics Dashboard** | All gyms | Gym-level | All gyms with counts |
| **Missing Requirements** | Failing gyms only | Gym-level | Only gyms that need attention |
| **Audit Check** | Problem events | Event-level | Events with validation errors |

**Naming is now consistent:** "Audit Check" in both export modal and main dashboard ✅

