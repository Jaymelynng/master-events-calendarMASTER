# 🚀 Master Events Calendar - Automation System

## Overview

This automation system replaces your manual F12 import process with fully automated event collection from all 10 gyms.

## Files

### Core Automation
- **`auto_collect_events.py`** - Main automation script (local execution)
- **`api/auto_collect_events.py`** - Vercel API endpoint (cloud execution)
- **`vercel.json`** - Vercel Cron configuration (daily at 6 AM)

### Documentation
- **`F12-IMPORT-GUIDE.md`** - Your documented F12 process
- **`SUPABASE_AUDIT_REPORT.md`** - Database structure
- **`BUG_FIX_DUPLICATE_DETECTION_OCT_2025.md`** - Duplicate prevention logic

## How It Works

### 1. Event Collection
- Fetches from all 10 gyms using documented API endpoints
- Uses exact same JSON structure as your F12 process
- Handles all program types (CLINIC, KIDS NIGHT OUT, OPEN GYM, CAMP)

### 2. Data Conversion
- Uses your exact `convertRawDataToJson()` logic
- Maintains all your duplicate detection rules
- Preserves audit logging functionality

### 3. Database Integration
- Upserts to your Supabase database
- Handles duplicates using URL-based detection
- Logs all changes to `event_audit_log`

## Usage

### Local Execution
```bash
cd automation
python auto_collect_events.py
```

### Vercel Deployment
1. Deploy to Vercel with environment variables:
   - `SUPABASE_URL=https://xftiwouxpefchwoxxgpf.supabase.co`
   - `SUPABASE_ANON_KEY=your_key_here`

2. Cron job runs automatically daily at 6 AM

## Benefits

- ✅ **Fully automated** - No manual F12 work needed
- ✅ **Same accuracy** - Uses your exact documented process
- ✅ **Daily updates** - Events stay current automatically
- ✅ **Duplicate safe** - Uses your existing prevention logic
- ✅ **Audit trail** - All changes logged automatically

## Safety Features

- **Timeout protection** - 30s per request
- **Error handling** - Graceful failure for broken endpoints
- **Duplicate prevention** - Database unique index on event_url
- **Audit logging** - All changes tracked automatically

---

**This automation system is production-ready and replaces your manual F12 process completely!** 🎉










