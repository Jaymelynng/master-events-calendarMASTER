# 📤 EXPORT DATA GUIDE
## Exporting Events, Analytics, and Compliance Reports

**Created:** December 9, 2025  
**Status:** ✅ FULLY FUNCTIONAL

---

## 📋 OVERVIEW

The Export feature allows you to download event data, analytics, and compliance reports in CSV or JSON format. Perfect for:
- Monthly reports
- Sharing data with management
- Backup purposes
- Cross-referencing with iClassPro
- Compliance tracking

---

## 🚀 HOW TO ACCESS

1. On the main calendar view, click the **📤 Export** button in the header
2. The Export modal will open with all options

---

## 📅 DATE RANGE SELECTION

The export is **NOT** limited to the current calendar view. You can select any date range:

| Field | Description |
|-------|-------------|
| **From** | Start date for export |
| **To** | End date for export |

**Default:** Current month displayed on calendar

**Features:**
- Date pickers update live
- Shows count of events found in selected range
- Includes both **active AND archived** events

---

## 📦 WHAT YOU CAN EXPORT

### **1. 📋 Event Details**
Full list of all events in the selected date range.

**Includes:**
- Gym name
- Event title
- Event type (CLINIC, KNO, etc.)
- Date
- Time
- Price
- Age range
- Registration URL

**Use case:** Full data backup, sharing event list, cross-checking with iClassPro

---

### **2. 📊 Analytics Dashboard**
Summary counts per gym for the selected date range.

**Includes per gym:**
- Clinic count
- KNO count
- Open Gym count
- Camp count
- Special Event count
- Total events
- Meets requirements (YES/NO)
- Missing items list

**Use case:** Monthly compliance reports, performance tracking, management reports

---

### **3. ⚠️ Missing Requirements**
List of gyms that don't meet monthly requirements.

**Monthly Requirements:**
- 1 CLINIC per gym
- 2 KNO per gym
- 1 OPEN GYM per gym

**Shows:**
- Which gyms are missing requirements
- What specifically is missing (e.g., "needs 1 KNO, 1 CLINIC")

**Use case:** Compliance tracking, quick identification of gaps, action items

---

## 🎯 FILTERING OPTIONS

### **Select Gyms**
- **All:** Include all 10 gyms
- **None:** Deselect all
- **Individual:** Check/uncheck specific gyms

### **Select Event Types**
- **All:** Include all event types
- **None:** Deselect all
- **Individual:** Check/uncheck specific types

**Available types:**
- CLINIC *(required)*
- KIDS NIGHT OUT *(required)*
- OPEN GYM *(required)*
- CAMP
- SPECIAL EVENT

*Red asterisk indicates events required for monthly compliance*

---

## 📄 EXPORT FORMATS

### **CSV (Excel, Google Sheets)**
- Opens directly in Excel or Google Sheets
- Sections separated by headers
- Easy to filter and sort
- Best for: Spreadsheet users, sharing with others

**File name:** `export-YYYY-MM-DD.csv`

**CSV Structure:**
```
EVENTS - 2025-12-01 to 2025-12-31
Gym,Title,Type,Date,Time,Price,Ages,URL
Capital Gymnastics - Cedar Park,"Vault Training Clinic",CLINIC,2025-12-07,1:00 PM - 2:30 PM,35,6+,https://...

ANALYTICS - 2025-12-01 to 2025-12-31
Gym,Clinics,KNO,Open Gym,Camps,Special Events,Total,Meets Requirements,Missing
Capital Gymnastics - Cedar Park,7,3,2,0,0,12,YES,""

GYMS WITH MISSING REQUIREMENTS - 2025-12-01 to 2025-12-31
Gym,Missing Events
Houston Gymnastics Academy,"1 CLINIC, 1 OPEN GYM"
```

---

### **JSON**
- Machine-readable format
- Full data structure preserved
- Best for: Developers, data processing, backups

**File name:** `export-YYYY-MM-DD.json`

**JSON Structure:**
```json
{
  "exportDate": "2025-12-09T15:30:00.000Z",
  "month": "2025-12-01 to 2025-12-31",
  "filters": {
    "gyms": ["CCP", "CPF", "CRR", ...],
    "eventTypes": ["CLINIC", "KIDS NIGHT OUT", ...]
  },
  "events": [...],
  "eventCount": 156,
  "analytics": [...],
  "missingRequirements": [...]
}
```

---

## 📊 EXAMPLE USE CASES

### **Monthly Compliance Report**
1. Set date range to the month you're reporting on
2. Check ✅ Analytics Dashboard
3. Check ✅ Missing Requirements
4. Select all gyms
5. Export as CSV
6. Share with management

### **Full Data Backup**
1. Set wide date range (or just current month)
2. Check ✅ Event Details
3. Select all gyms and all types
4. Export as JSON
5. Store safely

### **Single Gym Report**
1. Set date range as needed
2. Select only one gym
3. Check all export options
4. Export as CSV
5. Send to gym manager

### **Quick Compliance Check**
1. Set date range to current month
2. Check ✅ Missing Requirements ONLY
3. Don't need to export - the modal shows you instantly which gyms are missing what!

---

## 🔧 TECHNICAL DETAILS

### **Data Source**
The export uses the `events_with_gym` view which includes:
- Active events from `events` table
- Archived events from `events_archive` table

This means **past events that have been archived are still included in exports!**

### **Requirements Logic**
```javascript
// Monthly requirements checked:
clinic_required: 1
kno_required: 2
open_gym_required: 1

// Gym meets requirements if:
clinic_count >= 1 AND
kno_count >= 2 AND
open_gym_count >= 1
```

### **File Download**
- Files download directly to your browser's download folder
- No server-side processing - all done in browser
- Works offline once the page is loaded

---

## ❓ FAQ

**Q: Does the export include archived events?**
A: Yes! The export uses the same view as the calendar, which includes both active and archived events.

**Q: Can I export multiple months at once?**
A: Yes! Just set a wider date range using the date pickers.

**Q: Why is a gym showing as "missing requirements"?**
A: The gym doesn't have enough events in the selected date range. Requirements are: 1 CLINIC, 2 KNO, 1 OPEN GYM.

**Q: Can I export just camps?**
A: Yes! Deselect all event types except CAMP, then export.

**Q: What if I need a different file format?**
A: Export as CSV and convert using Excel/Google Sheets, or export as JSON and process with any programming language.

---

## 📝 CHANGELOG

| Date | Change |
|------|--------|
| Dec 9, 2025 | Export feature created |
| Dec 9, 2025 | Added date range picker |
| Dec 9, 2025 | Added missing requirements preview in modal |
| Dec 9, 2025 | Simplified "Missing Requirements" label |

---

**Export makes compliance tracking effortless!** 📊

