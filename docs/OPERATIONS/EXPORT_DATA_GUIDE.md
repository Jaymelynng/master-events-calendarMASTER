# 📤 EXPORT DATA GUIDE
## Comprehensive Export & Reporting System

**Last Updated:** December 28, 2025  
**Status:** ✅ Fully Functional (10/10 Complete)  
**File:** `src/components/EventsDashboard/ExportModal.js`

---

## 📋 OVERVIEW

The Export feature is a **comprehensive reporting system** that allows you to:
- Download event data in multiple formats (CSV, JSON, HTML)
- Generate print-ready reports for management
- Track monthly compliance across all gyms
- Identify data quality issues
- Monitor sync history
- Create email-ready summaries

---

## 🚀 HOW TO ACCESS

1. On the main calendar view, click the **📤 Export** button (next to 🪄 Admin)
2. The Export modal will open with all options

---

## ⚡ QUICK PRESETS (NEW!)

One-click export configurations for common tasks:

| Preset | Description | Format | Includes |
|--------|-------------|--------|----------|
| **📊 Monthly Compliance** | Standard monthly report | CSV | Analytics + Missing Requirements |
| **👔 Boss Report** | Printable HTML report with email summary | HTML | Analytics + Visual charts + Email template |
| **💾 Full Backup** | Complete data export | JSON | Everything (Events, Analytics, Data Quality, Sync History) |
| **🔍 Data Quality** | Events with issues | CSV | Validation errors, missing descriptions, sold out events |
| **🔄 Sync History** | Sync log data | CSV | Last 100 sync records |

### How to Use Presets:
1. Click a preset button
2. All options are auto-configured
3. Adjust date range if needed
4. Click Export

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
- Gym name (and ID)
- Event title
- Event type (CLINIC, KNO, etc.)
- Date and Day of Week
- Time
- Price
- Age range (formatted as "5-12" or "6+")
- Description status (full, flyer_only, none)
- Has Openings (Available/SOLD OUT)
- Registration URL

**Use case:** Full data backup, sharing event list, cross-checking with iClassPro

---

### **2. 📊 Analytics Dashboard**
Summary counts per gym for the selected date range.

**Includes per gym:**
- Clinic count (with requirement)
- KNO count (with requirement)
- Open Gym count (with requirement)
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
- Current counts for each type

**Use case:** Compliance tracking, quick identification of gaps, action items

---

### **4. 🔍 Data Quality Issues (NEW!)**
Events that have validation problems or missing information.

**Detects:**
- Date mismatches (event date doesn't match description)
- Time mismatches
- Age mismatches
- Program type mismatches (e.g., KNO event with Clinic description)
- Skill mismatches (for clinics)
- Missing descriptions
- Flyer-only events (image but no text)
- SOLD OUT events

**Includes per issue:**
- Gym name
- Event title
- Date
- Type
- List of issues
- Event URL (for quick fixing)

**Use case:** Quality control, identifying events that need attention

---

### **5. 🔄 Sync History (NEW!)**
Track when each gym/event type was last synced.

**Shows:**
- Gym ID
- Event Type
- Last Synced timestamp
- Events Found
- Events Imported

**Use case:** Monitoring sync coverage, identifying stale data

---

## 📄 EXPORT FORMATS

### **📊 CSV (Excel, Google Sheets)**
- Opens directly in Excel or Google Sheets
- Sections separated by headers
- Easy to filter and sort
- Best for: Spreadsheet users, sharing with others

**File name:** `export-YYYY-MM-DD.csv`

**CSV Structure:**
```
EVENTS - 2025-12-01 to 2025-12-31
Gym,Gym ID,Title,Type,Date,Day,Time,Price,Ages,Description Status,Has Openings,URL
"Capital Gymnastics Cedar Park",CCP,"Vault Clinic",CLINIC,2025-12-07,Saturday,1:00 PM,35,6+,full,Available,https://...

ANALYTICS - 2025-12-01 to 2025-12-31
Gym,Gym ID,Clinics,Clinics Req,KNO,KNO Req,Open Gym,Open Gym Req,Camps,Special Events,Total,Meets Requirements,Missing
"Capital Gymnastics Cedar Park",CCP,7,1,3,2,2,1,0,0,12,YES,""

DATA QUALITY ISSUES - 2025-12-01 to 2025-12-31
Gym,Title,Date,Type,Issues,URL
"Houston Gymnastics",Old Description Event,2025-12-15,CLINIC,"warning: Time mismatch",https://...

SYNC HISTORY - Last 100 Syncs
Gym ID,Event Type,Last Synced,Events Found,Events Imported
CCP,CLINIC,12/28/2025 10:30:00 AM,5,3
```

---

### **📋 JSON**
- Machine-readable format
- Full data structure preserved
- Includes summary statistics
- Best for: Developers, data processing, backups

**File name:** `export-YYYY-MM-DD.json`

**JSON Structure:**
```json
{
  "exportDate": "2025-12-28T15:30:00.000Z",
  "dateRange": "2025-12-01 to 2025-12-31",
  "filters": {
    "gyms": ["CCP", "CPF", "CRR", ...],
    "eventTypes": ["CLINIC", "KIDS NIGHT OUT", ...]
  },
  "summary": {
    "totalEvents": 156,
    "totalGyms": 10,
    "gymsMeetingRequirements": 8,
    "gymsWithIssues": 2,
    "dataQualityIssues": 5
  },
  "events": [...],
  "eventCount": 156,
  "analytics": [...],
  "missingRequirements": [...],
  "dataQualityIssues": [...],
  "syncHistory": [...]
}
```

---

### **🖨️ HTML Report (NEW!)**
Print-ready report with beautiful formatting.

**Features:**
- **📧 Email Summary Box:** Copy-paste text for quick emails
- **Visual Summary Cards:** Total events, compliance %, gyms compliant, action needed
- **Progress Bar:** Visual compliance meter
- **Color-coded Table:** Green for compliant, red for missing
- **Action Required Section:** Highlights gyms needing attention
- **Print Button:** One-click browser print

**Opens in:** New browser tab

**Use case:** 
- Sending to management/boss
- Printing for meetings
- Email attachments (print to PDF)

**Email Summary Example:**
```
Monthly Events Report (2025-12-01 to 2025-12-31)

✅ Compliance: 8/10 gyms meeting requirements (80%)
📊 Total Events: 156

⚠️ Gyms Needing Attention:
   • Houston Gymnastics Academy: needs 1 KNO
   • Oasis Gymnastics: needs 1 CLINIC, 1 OPEN GYM
```

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

## 📊 EXAMPLE USE CASES

### **Monthly Compliance Report (for Management)**
1. Click **📊 Monthly Compliance** preset
2. Set date range to the reporting month
3. Click **Export CSV**
4. Open in Excel, format as needed, send to stakeholders

### **Boss Report (Printable/Email)**
1. Click **👔 Boss Report** preset
2. Set date range as needed
3. Click **Export HTML**
4. New tab opens with formatted report
5. Copy the email summary text for quick communication
6. Click Print button for PDF or paper copy

### **Full Data Backup**
1. Click **💾 Full Backup** preset
2. Keep date range wide
3. Click **Export JSON**
4. Store safely for disaster recovery

### **Find Events with Problems**
1. Click **🔍 Data Quality** preset
2. Review the issues list
3. Export to CSV to work through fixes
4. Use the URLs to navigate directly to problem events

### **Check Sync Coverage**
1. Click **🔄 Sync History** preset
2. Export to CSV
3. Look for gyms with old sync dates or low event counts

### **Quick Compliance Check (No Export)**
The modal shows you instantly:
- Which gyms are missing requirements
- How many data quality issues exist
- No need to export — just look at the preview!

---

## 🔧 TECHNICAL DETAILS

### **Data Source**
The export uses the `events_with_gym` view which includes:
- Active events from `events` table
- Archived events from `events_archive` table

This means **past events that have been archived are still included in exports!**

### **Sync History Source**
Fetched from `sync_log` table, limited to last 100 records.

### **Data Quality Detection**
Scans events for:
```javascript
// Issues detected:
- validation_errors (from sync) - excludes acknowledged
- description_status === 'none'
- description_status === 'flyer_only'
- has_openings === false (SOLD OUT)
```

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
- CSV/JSON: Files download directly to your browser's download folder
- HTML: Opens in new tab (can be printed/saved as PDF)
- No server-side processing — all done in browser
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

**Q: What if I need a PDF?**
A: Use the HTML Report format, then print to PDF from your browser.

**Q: How do I email the report?**
A: Use the Boss Report preset. The HTML report includes a copy-paste email summary box.

**Q: What's the difference between presets and manual options?**
A: Presets are just shortcuts. You can always adjust any option after selecting a preset.

**Q: Can I see sync history without exporting?**
A: Not currently. The sync history is exported from the database on demand.

---

## 📝 CHANGELOG

| Date | Change |
|------|--------|
| Dec 28, 2025 | **MAJOR UPDATE** - Added Quick Presets (5 one-click configurations) |
| Dec 28, 2025 | Added HTML Report format with visual charts and email summary |
| Dec 28, 2025 | Added Data Quality Issues export |
| Dec 28, 2025 | Added Sync History export |
| Dec 28, 2025 | Enhanced CSV with Gym ID, Day of Week, Description Status, Has Openings |
| Dec 28, 2025 | Enhanced JSON with summary statistics |
| Dec 28, 2025 | Improved UI with preset buttons and hover states |
| Dec 28, 2025 | Documentation comprehensive rewrite |
| Dec 9, 2025 | Export feature created |
| Dec 9, 2025 | Added date range picker |
| Dec 9, 2025 | Added missing requirements preview in modal |

---

## 🎯 EXPORT FEATURE RATING: 10/10

| Capability | Status |
|------------|--------|
| Multiple formats (CSV, JSON, HTML) | ✅ |
| Custom date ranges | ✅ |
| Gym filtering | ✅ |
| Event type filtering | ✅ |
| Quick presets | ✅ |
| Print-ready reports | ✅ |
| Email-ready summaries | ✅ |
| Data quality reporting | ✅ |
| Sync history tracking | ✅ |
| Compliance calculation | ✅ |
| Visual charts (HTML) | ✅ |
| Works with archived events | ✅ |

---

**The Export system now covers every reporting need! 📊✨**
