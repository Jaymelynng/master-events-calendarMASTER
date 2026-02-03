# 🎯 Team Calendar - Master Events Hub
## Enterprise Event Management Platform for Multi-Location Gymnastics Operations

---

## 🌐 Live URL

# **https://teamcalendar.mygymtools.com**

Part of the **mygymtools.com** suite of tools.

---

## 📊 Project Overview

**Production-ready event management system** managing 10 gymnastics facilities across Texas, Arizona, and California.

### **Business Impact:**
- ⏱️ **94% Time Reduction**: 5 hours → 20 minutes per month
- 💰 **Revenue Protection**: Zero missed events = $5K-10K annually
- ✅ **Accuracy**: <1% error rate (down from 10-15%)
- 📈 **Scalability**: Built to handle 50+ locations

### **Current Scale:**
- **10 Facilities** actively managed
- **200+ Events** in system
- **3 States** (TX, AZ, CA)
- **Real-time** compliance monitoring

---

## 🚀 Quick Start

### **Live App:**
Visit: **https://teamcalendar.mygymtools.com**

### **Local Development:**
```bash
npm install
npm start
```
App opens at: `http://localhost:3000`

### **Environment Setup:**
Create `.env.local` with:
```
REACT_APP_SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=[your-key-here]
REACT_APP_API_URL=https://master-events-calendarmaster-production.up.railway.app
REACT_APP_API_KEY=[your-api-key-here]
```

---

## 📚 Documentation

| Category | Location | Description |
|----------|----------|-------------|
| **Business** | `docs/BUSINESS/` | ROI analysis, presentations |
| **Technical** | `docs/TECHNICAL/` | Architecture, database, roadmap |
| **Operations** | `docs/OPERATIONS/` | How-to guides, sync instructions |

**Start here:** `docs/INDEX.md`

---

## ✨ Key Features

### **For Everyone:**
- 📅 Real-time calendar across all 10 gyms
- 🔍 Smart filters by gym/event type
- 📋 Click numbers to open registration pages
- ✨ Click sparkle to open ALL pages for a gym

### **For Admins:**
- 🪄 Admin Control Center (click Admin button)
- ⚡ Automated Sync from iClassPro
- 🚀 F12 JSON bulk import
- 📤 Export to CSV/JSON
- 🔐 Super Admin mode (PIN protected)

### **Data Quality:**
- 🔴 **Data Errors** - Wrong info (date/time/age mismatches) - RED indicators
- 🟠 **Formatting Issues** - Missing info (incomplete descriptions) - ORANGE indicators
- ⚠️ Flyer-only warnings
- ❌ Missing description alerts
- ✅ Dismiss warnings with notes (persists across syncs)
- 📤 Export dismissed warnings report
- Auto-archive past events

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Lucide Icons |
| **Backend API** | Flask + Playwright (Railway) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | Vercel |
| **Domain** | teamcalendar.mygymtools.com |

---

## 🌐 Deployment Architecture

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** | Vercel | teamcalendar.mygymtools.com |
| **API Server** | Railway | master-events-calendarmaster-production.up.railway.app |
| **Database** | Supabase | xftiwouxpefchwoxxgpf.supabase.co |

---

## 📁 Project Structure

```
master-events-calendar/
├── src/
│   ├── components/
│   │   ├── EventsDashboard.js (main calendar)
│   │   └── EventsDashboard/
│   │       ├── AdminPortalModal.js
│   │       ├── SyncModal.js
│   │       ├── BulkImportModal.js
│   │       └── ExportModal.js
│   └── lib/
│       ├── api.js (Supabase CRUD)
│       ├── supabase.js (connection)
│       ├── eventComparison.js (sync logic)
│       └── useRealtimeEvents.js (live updates)
├── automation/
│   ├── local_api_server.py (Flask API)
│   └── f12_collect_and_import.py (Playwright)
├── docs/
│   ├── BUSINESS/
│   ├── TECHNICAL/
│   └── OPERATIONS/
└── database/
```

---

## 🔐 Access Levels

| Level | Access | Features |
|-------|--------|----------|
| **Everyone** | Visit URL | Calendar, event details, stats |
| **Admin** | Click 🪄 Admin | Sync, Import, Export |
| **Super Admin** | 🔐 + PIN (set in Vercel) | Supabase, Railway, Audit |

---

## 🎯 mygymtools.com Suite

| Tool | URL | Purpose |
|------|-----|---------|
| **Main Hub** | mygymtools.com | Landing page |
| **Team Calendar** | teamcalendar.mygymtools.com | Event management |
| **Bulk Link Pro** | bulklinkpro.com | Link management |
| **Bio Page** | ourbiopage.com | Bio links |

---

## 📞 Support

- **Docs:** `docs/` folder
- **Issues:** Check browser console (F12)
- **Database:** Supabase dashboard
- **API:** Railway dashboard

---

**Last Updated:** January 30, 2026  
**Version:** 3.5 (Production)  
**Live URL:** https://teamcalendar.mygymtools.com  
**Jayme -
