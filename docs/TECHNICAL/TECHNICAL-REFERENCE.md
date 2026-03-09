# 🎯 TEAM CALENDAR - COMPLETE TECHNICAL FORMULA 2025
## Updated Production-Ready Documentation

**Live URL:** https://teamcalendar.mygymtools.com  
**Last Updated:** February 2, 2026  
**Version:** Production 3.3
**Status:** ✅ FULLY DEPLOYED & WORKING
**Part of:** mygymtools.com suite

---

## 🚨 CRITICAL: AI VERIFICATION PROTOCOL

**Before ANY technical verification, AI MUST read:** `docs/OPERATIONS/AI_VERIFICATION_PROTOCOL.md`

**RULE:** Never assume code works without live testing. User is non-technical and trusts AI judgment completely. This trust must NEVER be abused.

**When user asks "Does X work?":**
- ❌ WRONG: Read code → "Yes, it works!"
- ✅ CORRECT: "Let me test it to be sure" → Test with real data → Verify results → Then confirm

**See full protocol:** [AI_VERIFICATION_PROTOCOL.md](../OPERATIONS/AI_VERIFICATION_PROTOCOL.md)

---

## 📚 TABLE OF CONTENTS
1. [What This App Does Now](#what-this-app-does-now)
2. [Complete Feature Set](#complete-feature-set)
3. [Database Architecture (100% Supabase)](#database-architecture)
4. [Automated Sync System](#automated-sync-system)
5. [Admin Bulk Import System](#admin-bulk-import)
6. [Export Data System](#-export-data-system)
7. [Secret Admin Mode](#secret-admin-mode)
8. [Technical Specifications](#technical-specs)
9. [Deployment Architecture](#deployment-architecture)
10. [Lessons Learned](#lessons-learned)
11. [Future Roadmap](#future-roadmap)

---

## 🎪 WHAT THIS APP DOES NOW

Your Master Events Calendar is a **production-deployed event management platform** for all 10 gymnastics locations:

### **Core Capabilities:**
1. **📅 Real-Time Calendar** - Live event tracking across all gyms and months
2. **⚡ Automated Sync** - One-click event collection from iClassPro portals
3. **📊 Sync Progress Tracker** - Visual grid showing sync status for all gyms
4. **🔐 Admin Mode** - 3-tier access system (Normal/Admin/Super Admin) with full-page Admin Dashboard
5. **📱 Responsive Design** - Works on mobile, tablet, desktop
6. **📈 Vercel Analytics** - Track visitors and page views
7. **🗄️ Auto-Archive** - Past events automatically archived at midnight

### **Business Value:**
- **📈 Time Savings** - 5 hours/month → 20 minutes/month
- **🎯 100% Accuracy** - Verified against live iClassPro data
- **📊 Real-time Visibility** - Instant sync status across all gyms
- **🚀 Scalable Architecture** - Easy to add gyms, events, features

---

## 🏗️ COMPLETE FEATURE SET

### **Manager Features (Daily Use):**
- ✅ **View All Events** - Clean calendar interface
- ✅ **Event Details** - Click to see full info (description, age, price)
- ✅ **Copy Registration URLs** - One-click sharing
- ✅ **Monthly Navigation** - Browse any month/year
- ✅ **Smart Filtering** - By gym, event type, search terms
- ✅ **Bulk Actions** - Open all clinic/KNO/open gym pages at once

### **Admin Features (Jayme - Level 2):**
- ✅ **Full-Page Admin Dashboard** - Replaces old modal with tabbed full-page interface
- ✅ **Audit & Review Tab** - See ALL validation errors across gyms, filter by category/month/program/status
- ✅ **Pricing Tab** - Event pricing (Clinic, KNO, Open Gym) + Camp pricing — base expected prices for validation
- ✅ **Gym Rules Tab** - View, add, delete per-gym validation rules
- ✅ **Quick Actions Tab** - Automated Sync, JSON Import (Super Admin required for some)

**Design:** Event-type colors, shadows, and styling — see [DESIGN_COLOR_SCHEME.md](TECHNICAL/DESIGN_COLOR_SCHEME.md)
- ✅ **JSON Import (F12)** - Bulk import via copy/paste
- ✅ **Automated Sync** - One-click iClassPro collection
- ✅ **Sync Progress Tracker** - See what's synced, what needs sync
- ✅ **Export Data** - Export events, analytics, compliance reports (CSV/JSON)

### **Super Admin Features (Jayme - Level 3):**
- ✅ **Supabase Dashboard Link** - Direct database access
- ✅ **Railway Dashboard Link** - Direct API server access
- ✅ **Audit History** - See all changes made to events

### **Advanced Features:**
- ✅ **Real-Time Sync** - Changes appear instantly everywhere
- ✅ **Event Comparison** - Detects new/changed/deleted events
- ✅ **Soft Delete** - Removed events kept in DB, hidden from calendar
- ✅ **Description Display** - Full event descriptions in details panel
- ✅ **Age Range Display** - Shows min/max ages from iClass settings
- ✅ **Vercel Analytics** - Visitor and page view tracking
- ✅ **Auto-Archive** - Past events automatically archived at midnight
- ✅ **Data Export** - Export to CSV/JSON with custom date ranges
- ✅ **Data Quality Tracking** - Flyer detection, validation errors
- ✅ **Per-Gym Validation Rules** - Prevent false positives with `gym_valid_values` table
- ✅ **Full-Page Admin Dashboard** - Tabbed interface with Audit & Review, Gym Rules, Quick Actions

---

## 🗄️ DATABASE ARCHITECTURE (100% SUPABASE)

### **Single Source of Truth:**
**Database:** `https://xftiwouxpefchwoxxgpf.supabase.co`

### **Current Stats:**
- **10 Tables** + 2 Views
- **500+ Events** (active + archived, counts change frequently)
- **~75 Gym Links** configured
- **10 Gyms** across TX, AZ, CA
- **10 Link Types** (booking, camps, clinics, etc.)
- **3 Tracked Event Types** (KNO, CLINIC, OPEN GYM)

**Full Schema:** See [DATABASE_COMPLETE_SCHEMA.md](DATABASE_COMPLETE_SCHEMA.md)

### **Core Tables:**

#### **1. `events` - All Active Event Data (30 columns)**
```sql
Key Columns:
- id: UUID primary key
- gym_id: References gyms.id (CCP, EST, etc.)
- title: Event name
- date, start_date, end_date: Event dates
- time: "6:30 PM - 9:30 PM" 
- price: Text (parsed from title/description)
- type: CLINIC/KIDS NIGHT OUT/OPEN GYM/CAMP/SPECIAL EVENTS
- event_url: Registration link (UNIQUE identifier!)
- description: Full event description
- age_min, age_max: Age range from iClass settings

Data Quality Fields:
- has_flyer: Boolean
- flyer_url: URL to promotional image
- description_status: none/flyer_only/full/unknown
- validation_errors: JSONB array of issues
- acknowledged_errors: JSONB array of dismissed issues

Availability Fields:
- has_openings: Boolean from iClassPro
- registration_start_date, registration_end_date: Date range

System Fields:
- deleted_at: Soft delete timestamp
- created_at, updated_at: Timestamps
```

#### **2. `events_archive` - Past Events**
Same structure as `events` plus `archived_at` timestamp.

#### **3. `gyms` - Gym Information**  
10 gyms with IDs: CCP, CPF, CRR, EST, HGA, OAS, RBA, RBK, SGT, TIG

#### **4. `gym_links` - Portal URLs (76 links)**
Link types: skill_clinics, kids_night_out, open_gym, booking, camps, camps_half, summer_camps, summer_camps_half

#### **5. `sync_log` - Sync Progress Tracking**
Tracks last sync time, events found/imported per gym+type combo.

### **Smart Views:**
- **`events_with_gym`** - UNION ALL of events + events_archive with gym names
- **`gym_links_detailed`** - Joins links with types

---

## ⚡ AUTOMATED SYNC SYSTEM

### **How It Works:**

```
You click "Sync" in the UI
    ↓
React app (Vercel) sends POST /sync-events
    ↓
Flask API (Railway) receives request
    ↓
Direct HTTP API calls to iClassPro (replaced Playwright Mar 2026)
    ↓
Fetches event listings + details via public API
    ↓
Extracts: title, date, time, age, description
    ↓
Returns events to React
    ↓
Frontend compares with existing database events
    ↓
Shows: NEW | CHANGED | DELETED | UNCHANGED
    ↓
You click "Import"
    ↓
Data saved to Supabase
    ↓
Sync log updated
    ↓
Calendar refreshes!
```

### **What Gets Collected:**
- ✅ Event title (exactly as shown on portal)
- ✅ Event date (parsed correctly)
- ✅ Event time (start and end)
- ✅ Age min/max (from iClass settings)
- ✅ Full description (truncated at ~1500 chars)
- ✅ Registration URL (direct link to event)
- ✅ Has openings (availability status)
- ⚠️ Price (parsed from title/description, NOT from iClass pricing API)

### **Event Comparison Logic:**
The system compares events by `event_url` (unique identifier):

| Scenario | What Happens |
|----------|--------------|
| **New Event** | URL not in database → Shows as NEW → Import creates it |
| **Changed Event** | URL exists but data different → Shows as CHANGED → Import updates it |
| **Deleted Event** | URL in database but not in portal → Shows as DELETED → Import soft-deletes it |
| **Unchanged** | URL exists and data matches → Shows as UNCHANGED → Skip import |

### **Fields Checked for Changes (Core Content Only):**
- title
- date
- start_date
- end_date
- time
- price
- type
- age_min
- age_max
- description

### **Fields NOT Checked (Saved But Won't Trigger "Changed"):**
- has_openings
- registration_start_date
- registration_end_date
- has_flyer
- flyer_url
- description_status
- validation_errors

**Why?** These "volatile" fields change frequently and were causing false "CHANGED" alerts (e.g., 39 events showing as changed when nothing actually changed).

---

## 📤 EXPORT DATA SYSTEM

### **Overview:**
Export events, analytics, and compliance reports to CSV or JSON format.

### **Component:**
`src/components/EventsDashboard/ExportModal.js`

### **Features:**

| Feature | Description |
|---------|-------------|
| **Date Range** | Custom date picker (not limited to calendar view) |
| **Gym Selection** | All, None, or individual gyms |
| **Event Types** | Filter by CLINIC, KNO, OPEN GYM, CAMP, SPECIAL EVENT |
| **Event Details** | Full event list with all fields |
| **Analytics** | Counts per gym with requirement status |
| **Missing Requirements** | Gyms not meeting monthly requirements |
| **CSV Format** | Opens in Excel/Google Sheets |
| **JSON Format** | Machine-readable backup |

### **Data Source:**
Uses `events_with_gym` view (includes both active AND archived events)

### **Monthly Requirements Checked:**
```javascript
clinic_required: 1
kno_required: 2
open_gym_required: 1
```

### **Export File Names:**
- CSV: `export-YYYY-MM-DD.csv`
- JSON: `export-YYYY-MM-DD.json`

### **See Full Guide:**
[📤 EXPORT_DATA_GUIDE.md](../OPERATIONS/EXPORT_DATA_GUIDE.md)

---

## 🔐 ADMIN MODE

### **Three-Tier Access System:**

| Level | Who | Access Method | Features |
|-------|-----|---------------|----------|
| **1 - Normal** | Everyone | Just visit URL | Calendar, event details, stats, export |
| **2 - Admin** | Jayme | Shift+Click 🪄 wand | Full-page Admin Dashboard with 3 tabs |
| **3 - Super Admin** | Jayme only | Inside Admin Dashboard, press `*` + PIN `1426` | Quick Actions: Supabase/Railway links, Audit History, Sync, Import |

### **Admin Dashboard (Full-Page):**
Shift+clicking the 🪄 wand replaces the calendar with a full-page Admin Dashboard containing:

| Tab | Purpose |
|-----|---------|
| **Audit & Review** | See all validation errors across selected gyms, filter by category (DATA/FORMAT), month, program type, status (Active/Resolved). Dismiss errors or create permanent rules. |
| **Gym Rules** | View, add, and delete per-gym validation rules (price, time, program_synonym). Rules grouped by gym. |
| **Quick Actions** | Automated Sync and JSON Import buttons. Super Admin tools (Supabase, Railway, Audit History) require PIN. |

**Architecture:** State-based view swap (no React Router). `showAdminPortal` flag triggers an early return of `<AdminDashboard>` instead of the calendar.

**Full documentation:** `docs/OPERATIONS/SECRET_ADMIN_MODE.md`

---

## 🚀 ADMIN BULK IMPORT

### **Access Method:**
Admin Dashboard → Quick Actions → "JSON Import (F12 Method)"

### **F12 Method Workflow:**
1. Open iClassPro portal in browser
2. Press F12 → Network tab
3. Navigate to events page
4. Find the API response with event data
5. Right-click → Copy Response
6. Paste into JSON Import modal
7. Click Import

### **Smart Conversion Features:**
- ✅ **Manual gym selection** via radio buttons
- ✅ **Auto-detects event TYPE** from JSON (CLINIC, CAMP, etc.)
- ✅ **Parses event data** from JSON
- ✅ **Validates completeness**
- ✅ **Deduplicates** events
- ✅ **Error prevention** with warnings

**Full Guide:** See `docs/OPERATIONS/F12-IMPORT-GUIDE.md`

---

## ⚙️ TECHNICAL SPECIFICATIONS

### **Frontend Architecture:**
- **Framework**: React 18.3.1 with hooks
- **Styling**: Tailwind CSS with custom theme
- **Icons**: Lucide React icon library
- **State Management**: React useState/useEffect
- **Analytics**: Vercel Analytics (@vercel/analytics)
- **API Integration**: Custom hooks + fetch to Railway

### **Backend Architecture:**
- **Server**: Flask (Python)
- **Automation**: Direct HTTP API to iClassPro (Playwright kept as fallback)
- **Hosting**: Railway.app
- **Database**: Supabase PostgreSQL
- **CORS**: Enabled for Vercel domain

### **Database Architecture:**
- **Provider**: Supabase
- **Tables**: 9 core tables + 2 views
- **Auth**: API key based (anon key for frontend, service key for backend)
- **Security**: Row Level Security configured
- **Real-time**: Subscriptions enabled
- **Backups**: Supabase automatic backups
- **Auto-Archive**: pg_cron job runs at midnight

### **Data Flow:**
```
User Action → React State → API Layer → Railway/Supabase → Real-time Updates
                                              ↓
                               At midnight: pg_cron archives past events
```

---

## 🌐 DEPLOYMENT ARCHITECTURE

### **Current Production Setup:**

| Component | Platform | URL |
|-----------|----------|-----|
| **Frontend** | Vercel | https://teamcalendar.mygymtools.com |
| **Backend API** | Railway | `https://master-events-calendarmaster-production.up.railway.app` |
| **Database** | Supabase | `https://xftiwouxpefchwoxxgpf.supabase.co` |

### **Environment Variables:**

**Vercel (Frontend):**
```
REACT_APP_SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_API_URL=https://master-events-calendarmaster-production.up.railway.app
REACT_APP_API_KEY=your-shared-api-key
```

**Railway (Backend):**
```
PORT=auto-assigned
SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
API_KEY=your-shared-api-key
```

> ⚠️ **CRITICAL:** `REACT_APP_API_KEY` and `API_KEY` must match!

### **Key Files:**

**Frontend (React):**
| File | Purpose |
|------|---------|
| `src/components/AdminDashboard/AdminDashboard.js` | Full-page admin dashboard shell (tabs, PIN, layout) |
| `src/components/AdminDashboard/AdminAuditReview.js` | Audit & Review tab — validation errors across gyms |
| `src/components/AdminDashboard/AdminAuditFilters.js` | Filter bar (gym checkboxes, month, program, status, category) |
| `src/components/AdminDashboard/AdminAuditErrorCard.js` | Single event error card with dismiss buttons |
| `src/components/AdminDashboard/AdminGymRules.js` | Gym Rules tab — view/add/delete rules |
| `src/components/AdminDashboard/AdminQuickActions.js` | Quick Actions tab — sync, import, Super Admin tools |
| `src/components/EventsDashboard/SyncModal.js` | Automated sync UI |
| `src/components/EventsDashboard/ExportModal.js` | Data export UI |
| `src/components/EventsDashboard/DismissRuleModal.js` | Dismiss warning / create rule modal |
| `src/lib/validationHelpers.js` | Shared validation helpers (inferErrorCategory, canAddAsRule, etc.) |
| `src/lib/api.js` | Database API functions (includes gymValidValuesApi) |
| `src/lib/eventComparison.js` | New/changed/deleted logic |
| `src/lib/gymLinksApi.js` | Gym links from Supabase |
| `src/App.js` | Main app with Analytics |

**Backend (Python):**
| File | Purpose |
|------|---------|
| `automation/local_api_server.py` | Flask API server (main entry point) |
| `automation/f12_collect_and_import.py` | Event collection via Direct API (Playwright fallback) + validation |
| `automation/requirements.txt` | Python dependencies |
| `automation/Procfile` | Railway start command |
| `automation/railway.json` | Railway configuration |

---

## 📝 LESSONS LEARNED

### **Things That Didn't Work:**

1. **Skill Clinic Link Editor in Dashboard**
   - **What:** Added a UI to manually edit gym's Skill Clinic URL
   - **Problem:** Confusing placement, not needed since links already in Supabase
   - **Resolution:** Removed from dashboard (Dec 28, 2025)

2. **Comparing Volatile Fields for "Changed" Detection**
   - **What:** `has_openings`, `registration_start_date`, etc. included in comparison
   - **Problem:** Caused 39 false "CHANGED" alerts every sync
   - **Resolution:** Removed from comparison logic (Dec 28, 2025) - fields still save, just don't trigger alerts

3. **Price from iClassPro API**
   - **What:** Assumed price would come from iClassPro's pricing settings
   - **Reality:** Price is parsed from event title/description (e.g., `($25)`)
   - **Note:** This works but isn't ideal - prices must be in title

4. **Missing `has_openings` Column**
   - **What:** Column referenced in code but not in database
   - **Problem:** Import failed with column not found error
   - **Resolution:** Run ALTER TABLE to add column

### **Things That Worked Well:**

1. **event_url as Unique Identifier** - Reliable deduplication
2. **Soft Delete Pattern** - Events can come back if re-added
3. **UNION ALL View** - Archived events still display on calendar
4. **Auto-Archive with pg_cron** - Keeps events table clean
5. **Real-time Subscriptions** - Instant UI updates

---

## 🎯 FUTURE ROADMAP

### **Completed (Dec 2025 - Feb 2026):**
- ✅ Export Data (CSV/JSON)
- ✅ Auto-archive system
- ✅ Data quality tracking
- ✅ Availability tracking
- ✅ Per-gym validation rules (gym_valid_values)
- ✅ Full-page Admin Dashboard with Audit & Review
- ✅ Program synonym rules (database-driven)

### **Immediate Enhancements:**
- **📊 Import Analytics** - Track import history
- **🧹 Data Cleanup Tools** - Bulk delete/edit
- **💾 Backup & Restore** - Manual backup option

### **Automation Goals:**
- **🔄 Daily Auto-Sync** - Scheduled sync without clicking
- **📧 Email Notifications** - Alert when sync fails
- **🚨 Stale Detection** - Warn if sync is too old

### **Integration Opportunities:**
- **💌 Email Marketing** - Event promotion campaigns
- **📞 SMS Notifications** - Event reminders
- **📊 Business Intelligence** - Advanced reporting

---

## 🏆 PRODUCTION STATUS

### **Current State: ✅ FULLY DEPLOYED & VERIFIED**

**Verified December 28, 2025:**
- ✅ All 10 gyms syncing correctly
- ✅ All 5 event types working
- ✅ 500+ total events (counts vary)
- ✅ ~75 gym links configured
- ✅ Descriptions pulling correctly
- ✅ Ages pulling from iClass settings
- ✅ Auto-archive working at midnight
- ✅ 100% accuracy on cross-check vs live iClassPro data

### **Success Metrics:**
- **🏢 10 Gyms** fully integrated
- **🔗 5 Event Types** supported
- **⚡ <2 second** load times
- **💯 100% Accuracy** verified

---

## 🚨 TROUBLESHOOTING

### **API Not Responding:**
1. Check Railway dashboard - is service running?
2. Test: `https://master-events-calendarmaster-production.up.railway.app/health`
3. Check Railway logs for errors

### **Events Not Importing:**
1. Check browser console (F12 → Console)
2. Verify Supabase is accessible
3. Check `REACT_APP_API_URL` in Vercel

### **Sync Shows No Events When There Should Be:**
1. Verify gym's iClassPro portal has events
2. Check if event type URL is correct in `gym_links` table
3. Try syncing a different gym to isolate issue

### **Description/Age Not Showing:**
1. Verify `events_with_gym` view includes all columns
2. Check if event was synced AFTER the column was added
3. Re-sync the event to pull latest data

### **All Events Show as "Changed" (False Positives):**
1. Check if volatile columns missing from database (has_openings, etc.)
2. Run ALTER TABLE to add missing columns
3. Comparison logic should exclude volatile fields

---

## 💡 FINAL NOTES

### **What Makes This Special:**
- **🎯 Built for your exact workflow** - Automated sync matches your process
- **📊 Real business value** - 5 hours → 20 minutes monthly
- **🚀 Production quality** - Deployed and verified
- **🔮 Future-ready** - Scalable architecture for growth

### **Key Success Factors:**
1. **100% Supabase-driven** - No hardcoded dependencies
2. **Automated sync** - One-click data collection
3. **Professional UX** - Intuitive for all user types  
4. **Comprehensive validation** - Prevents data issues
5. **Complete documentation** - Self-maintainable system

**Your Master Events Calendar is now a production-ready, verified, enterprise-grade application!** 🌟

---

**Last Updated:** February 2, 2026
**Version:** Production 3.3
**Status:** ✅ FULLY DEPLOYED & VERIFIED - Cross-checked against live iClassPro data

