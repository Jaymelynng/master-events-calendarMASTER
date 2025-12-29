# 🚀 Master Events Calendar - Automation System

**Last Updated:** December 28, 2025  
**Status:** ✅ Production (Deployed on Railway)

---

## 📋 OVERVIEW

This folder contains the **Flask API server** and **Playwright script** that powers the automated event sync system. The API is deployed on Railway and called from the React frontend on Vercel.

---

## 🗂️ FILE STRUCTURE

### Core Files (Required for Production):

| File | Purpose |
|------|---------|
| `local_api_server.py` | **Flask API server** - handles /sync-events and /import-events |
| `f12_collect_and_import.py` | **Playwright script** - collects events from iClassPro portals |
| `requirements.txt` | Python dependencies |
| `Procfile` | Railway deployment command |
| `railway.json` | Railway build configuration |

### Documentation:

| File | Purpose |
|------|---------|
| `README.md` | This file |
| `START_LOCAL_API.md` | How to run locally for development |
| `TROUBLESHOOTING.md` | Common issues and fixes |

---

## 🌐 DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                         │
│                                                              │
│  React App → 🪄 Admin → Sync Modal → API Call               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (This Code)                       │
│                                                              │
│  local_api_server.py                                        │
│  ├── /health - Health check                                 │
│  ├── /sync-events - Collect events from iClassPro          │
│  ├── /import-events - Write events to Supabase             │
│  ├── /gyms - List available gyms                            │
│  └── /event-types - List event types                        │
│                                                              │
│  f12_collect_and_import.py                                  │
│  └── Uses Playwright to intercept iClassPro API calls       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database)                       │
│                                                              │
│  events, events_archive, gyms, gym_links, sync_log          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 LOCAL DEVELOPMENT

### Prerequisites:
- Python 3.8+
- Playwright

### Setup:
```bash
cd automation
pip install -r requirements.txt
playwright install chromium
```

### Run locally:
```bash
python local_api_server.py
```

Server starts at `http://localhost:5000`

### Test the API:
```bash
curl http://localhost:5000/health
```

---

## 🚀 RAILWAY DEPLOYMENT

Railway auto-deploys when you push to GitHub.

### Environment Variables (set in Railway):
```
PORT = (auto-assigned)
SUPABASE_URL = https://xftiwouxpefchwoxxgpf.supabase.co
SUPABASE_SERVICE_KEY = [your-service-key]
API_KEY = [your-api-key]
```

### Manual Redeploy:
Railway Dashboard → Deployments → Redeploy

---

## 📡 API ENDPOINTS

### GET /health
Health check endpoint.

**Response:**
```json
{"status": "healthy", "message": "API is running"}
```

### POST /sync-events
Collect events from iClassPro portal.

**Request:**
```json
{
  "gymId": "CCP",
  "eventType": "KIDS NIGHT OUT"
}
```

**Response:**
```json
{
  "success": true,
  "events": [...],
  "eventsFound": 15
}
```

### POST /import-events
Write events to Supabase database.

**Request:**
```json
{
  "events": [...],
  "gymId": "CCP"
}
```

---

## 🏢 SUPPORTED GYMS

| Code | Name | Portal Slug |
|------|------|-------------|
| CCP | Capital Gymnastics Cedar Park | capgymavery |
| CPF | Capital Gymnastics Pflugerville | capgymhp |
| CRR | Capital Gymnastics Round Rock | capgymroundrock |
| HGA | Houston Gymnastics Academy | houstongymnastics |
| RBA | Rowland Ballard Atascocita | rbatascocita |
| RBK | Rowland Ballard Kingwood | rbkingwood |
| EST | Estrella Gymnastics | estrellagymnastics |
| OAS | Oasis Gymnastics | oasisgymnastics |
| SGT | Scottsdale Gymnastics | scottsdalegymnastics |
| TIG | Tigar Gymnastics | tigar |

---

## 📝 SUPPORTED EVENT TYPES

- KIDS NIGHT OUT
- CLINIC
- OPEN GYM
- CAMP (includes all camp types)
- SPECIAL EVENT
- ALL (syncs all types at once)

---

## 🔐 AUTHENTICATION

The API uses API key authentication:
- Frontend sends `X-API-Key` header
- Backend validates against `API_KEY` environment variable
- Both Vercel and Railway must have matching keys

---

## 📜 CHANGELOG

| Date | Change |
|------|--------|
| Nov 2025 | Initial Railway deployment |
| Nov 2025 | Added Playwright event collection |
| Dec 2025 | Added API key authentication |
| Dec 2025 | Added SYNC ALL PROGRAMS feature |
| Dec 28, 2025 | Cleaned up folder, removed 40+ unused files |
| Dec 28, 2025 | **BUG FIX:** Fixed soft-deleted events not re-importing when gym adds them back |

---

## 📞 TROUBLESHOOTING

See `TROUBLESHOOTING.md` for common issues.

**Quick checks:**
1. Is Railway service running? Check dashboard.
2. Is API key set in both Vercel and Railway?
3. Check Railway logs for errors.
