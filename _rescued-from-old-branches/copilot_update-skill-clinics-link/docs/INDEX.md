> SUPERSEDED BY HUB -ACTIVE - master-events-calendar/docs/INDEX.md (checked 2026-10-13) — Dec 9, 2025 copy rescued off a deleted branch (commit 6bb602b).

# 📚 Team Calendar - Documentation Index

**Live URL:** https://teamcalendar.mygymtools.com  
**Last Updated:** December 9, 2025  
**Status:** ✅ FULLY DEPLOYED & VERIFIED  
**Part of:** mygymtools.com suite  
**Maintained by:** Jayme

---

## 🚨 CRITICAL: AI VERIFICATION PROTOCOL

**Before ANY technical verification, AI MUST read:** `docs/OPERATIONS/AI_VERIFICATION_PROTOCOL.md`

**MANDATORY RULE:** Never assume code works without live testing.

[➡️ Read the Protocol](OPERATIONS/AI_VERIFICATION_PROTOCOL.md)

---

## 🗂️ How to Navigate This Documentation

This documentation is organized into three strategic categories based on your role and needs.

---

## 🆕 START HERE - November 2025 Updates

### **[SYSTEM_STATUS_NOVEMBER_2025.md](OPERATIONS/SYSTEM_STATUS_NOVEMBER_2025.md)** ⭐ **CURRENT STATUS**
**What it contains:**
- Complete system status (FULLY DEPLOYED & WORKING!)
- All 10 gyms, 5 event types, 226+ events
- Verified 100% accuracy against live iClassPro data
- Feature list with what's working NOW
- Troubleshooting guide

**Why it's valuable:** THE source of truth for what's working right now. Read this first!

---

## 🏆 BUSINESS Documents

**For:** Investors, stakeholders, executives, presentations

### **[BOSS-PRESENTATION.md](BUSINESS/BOSS-PRESENTATION.md)** ⭐ CROWN JEWEL
**What it contains:**
- ROI analysis (94% time savings, $5K-10K revenue protection)
- Before vs. After process comparison
- Business value proposition
- Success metrics and impact

**Why it's valuable:** This is your pitch deck. It proves the business value and translates features into dollars and hours saved.

**Use it for:** Selling the project, presenting to management, demonstrating ROI

---

## 🔧 TECHNICAL Documents

**For:** Developers, system architects, technical planning

### **[TECHNICAL-REFERENCE.md](TECHNICAL/TECHNICAL-REFERENCE.md)** ⭐ **UPDATED NOV 2025**
**What it contains:**
- Complete system architecture (React + Flask + Supabase)
- Database schema with NEW columns (description, age_min, age_max, deleted_at)
- Automated Sync System documentation
- Secret Admin Mode documentation
- Deployment architecture (Vercel + Railway + Supabase)
- API design and data flow

**Why it's valuable:** The "Owner's Manual" - updated with all November 2025 features.

**Use it for:** Developer onboarding, technical handoff, system understanding

---

### **[SCALABILITY-ROADMAP.md](TECHNICAL/SCALABILITY-ROADMAP.md)**
**What it contains:**
- Phase-by-phase scaling plan (10 gyms → 10,000+ users)
- Component refactoring strategy
- Performance optimizations (5-10x faster)
- Infrastructure scaling (microservices, caching, monitoring)
- Implementation timeline

**Why it's valuable:** Proves this isn't a dead end - it's a platform built for growth.

**Use it for:** Planning future development, demonstrating scalability to investors

---

### **[SUPABASE-ARCHITECTURE.md](TECHNICAL/SUPABASE-ARCHITECTURE.md)** ⭐ **UPDATED DEC 2025**
**What it contains:**
- Complete database schema (events, events_archive, gyms, etc.)
- Auto-archive system (pg_cron job)
- events_with_gym view (UNION ALL both tables)
- Table design decisions
- Data relationships

**Why it's valuable:** Shows complete database architecture including auto-archiving.

**Use it for:** Understanding database structure, auto-archive system

---

### **[SUPABASE_AUDIT_REPORT.md](TECHNICAL/SUPABASE_AUDIT_REPORT.md)**
**What it contains:**
- Complete database structure analysis
- Live data audit
- Data flow architecture
- Performance analysis

**Why it's valuable:** Complete technical audit proving your database is production-ready.

**Use it for:** Technical due diligence, developer onboarding

---

### **[MAGIC_CONTROL_FEATURES.md](TECHNICAL/MAGIC_CONTROL_FEATURES.md)**
**What it contains:**
- Secret keyboard shortcuts
- Hidden admin features
- Magic wand button functionality

**Why it's valuable:** Documents the "hidden" features only you know about.

---

## 📋 OPERATIONS Documents

**For:** Users, managers, daily operations, training

### **[SYSTEM_STATUS_NOVEMBER_2025.md](OPERATIONS/SYSTEM_STATUS_NOVEMBER_2025.md)** 🆕 **START HERE**
**What it contains:**
- Current system status (everything working!)
- All features verified
- Troubleshooting guide
- What was verified November 26, 2025

**Why it's valuable:** THE source of truth for what's working right now.

---

### **[SECRET_ADMIN_MODE.md](OPERATIONS/SECRET_ADMIN_MODE.md)** 🆕 **NEW!**
**What it contains:**
- Three-tier access system explained
- Level 1 (Normal), Level 2 (Admin), Level 3 (Super Admin)
- How to access each level
- PIN code: 1426
- What each level can see/do

**Why it's valuable:** Complete guide to the hidden admin system only you know about.

**Use it for:** Remembering how to access admin features, training future admins

---

### **[SYNC_PROGRESS_TRACKER.md](OPERATIONS/SYNC_PROGRESS_TRACKER.md)** 🆕 **NEW!**
**What it contains:**
- Visual grid showing sync status
- Color coding (green/yellow/red)
- How to never lose track of what you've synced
- sync_log table structure

**Why it's valuable:** Solves "where did I leave off?" problem.

**Use it for:** Understanding the progress tracker, debugging sync issues

---

### **[AUTO-SYNC-GUIDE.md](OPERATIONS/AUTO-SYNC-GUIDE.md)** ⭐ **MAIN WORKFLOW**
**What it contains:**
- Complete automated sync workflow
- 🚀 **NEW: SYNC ALL PROGRAMS** - One click syncs everything!
- Step-by-step instructions
- What gets collected (title, date, time, price, age, description)
- Camp sync details (all types: school year + summer)

**Why it's valuable:** THE guide for the main feature - automated sync.

**Use it for:** Daily operations, training

---

### **[SYNC-QUICK-REFERENCE.md](OPERATIONS/SYNC-QUICK-REFERENCE.md)** 🆕 **NEW! NON-TECHNICAL**
**What it contains:**
- Simple step-by-step sync instructions
- Color guide for progress tracker
- Common questions answered
- Monthly checklist

**Why it's valuable:** Quick reference for non-technical users who just need to sync.

**Use it for:** Quick reminder of how to sync, training new users

---

### **[MAINTENANCE_GUIDE.md](OPERATIONS/MAINTENANCE_GUIDE.md)** 🆕 **NEW DEC 2025**
**What it contains:**
- Weekly, monthly, quarterly maintenance tasks
- Troubleshooting guide for common issues
- Health check SQL queries
- Database backup procedures
- Checklists and templates

**Why it's valuable:** Complete guide to keeping the system running smoothly.

**Use it for:** Regular maintenance, troubleshooting, training

---

### **[GYM_LINKS_MANAGEMENT_GUIDE.md](OPERATIONS/GYM_LINKS_MANAGEMENT_GUIDE.md)** 🆕 **NEW DEC 2025**
**What it contains:**
- How to update program page URLs that bulk openers and auto-sync use
- Direct SQL update instructions
- How to find correct program IDs in iClassPro
- Link type ID reference table
- Troubleshooting bulk opener and sync issues

**Why it's valuable:** Both bulk openers and auto-sync use gym_links table - update once, fixes both!

**Use it for:** Fixing incorrect program page links, updating URLs when gyms restructure programs

---

### **[DEPLOYMENT_PLAN.md](OPERATIONS/DEPLOYMENT_PLAN.md)** ⭐ **UPDATED NOV 2025**
**What it contains:**
- Deployment architecture (Vercel + Railway + Supabase)
- Environment variables
- How to redeploy
- Troubleshooting

**Why it's valuable:** Updated from "plan" to "completed deployment guide."

**Use it for:** Understanding deployment, redeploying, troubleshooting

---

### **[AI_VERIFICATION_PROTOCOL.md](OPERATIONS/AI_VERIFICATION_PROTOCOL.md)** 🚨 **MANDATORY**
**What it contains:**
- AI testing requirements before confirming functionality
- Why "reading code" ≠ "verifying it works"
- Trust protocol for non-technical users

**Why it's critical:** Prevents AI from wasting user's time by assuming code works without testing.

**Use it for:** Before ANY technical verification or code review

---

### **[F12-IMPORT-GUIDE.md](OPERATIONS/F12-IMPORT-GUIDE.md)**
**What it contains:**
- Complete F12 import workflow
- Step-by-step instructions
- The "manual" method (still works, but automated sync is easier!)

**Why it's valuable:** Backup method if automated sync ever fails.

**Use it for:** Backup import method, understanding how data is structured

---

### **[AUTOMATED_SYNC_SYSTEM_DETAILED.md](OPERATIONS/AUTOMATED_SYNC_SYSTEM_DETAILED.md)**
**What it contains:**
- Detailed technical breakdown of sync system
- Playwright automation details
- API endpoints

**Why it's valuable:** Deep technical details for debugging.

---

### **[EVENT_COMPARISON_LOGIC.md](OPERATIONS/EVENT_COMPARISON_LOGIC.md)**
**What it contains:**
- How events are compared (by event_url)
- NEW vs CHANGED vs DELETED logic
- What fields are checked

**Why it's valuable:** Understanding why events show as "changed."

---

### **[DATA_QUALITY_VALIDATION.md](OPERATIONS/DATA_QUALITY_VALIDATION.md)** 🆕 **NEW DEC 2025**
**What it contains:**
- How validation detects copy/paste errors
- Date, time, age comparison (structured vs description)
- Program type validation (KNO, CLINIC, OPEN GYM)
- Skill mismatch detection for CLINIC events
- Flyer detection and display
- Icons: 🚨 errors, ⚠️ warnings, ❌ missing, 🖼️ flyer

**Why it's valuable:** Complete guide to the automatic data quality validation system.

**Use it for:** Understanding validation icons, troubleshooting false positives

---

### **[VERCEL_ENVIRONMENT_SETUP.md](OPERATIONS/VERCEL_ENVIRONMENT_SETUP.md)**
**What it contains:**
- Environment variables for Vercel
- How to update them

**Why it's valuable:** Quick reference for environment setup.

---

### **[AUDIT-SYSTEM.md](OPERATIONS/AUDIT-SYSTEM.md)**
**What it contains:**
- How to access audit history
- What gets tracked

**Why it's valuable:** Accountability and tracking.

---

### **[BULK-IMPORT-LEARNINGS.md](OPERATIONS/BULK-IMPORT-LEARNINGS.md)**
**What it contains:**
- Lessons learned from past imports
- Common gotchas and solutions

**Why it's valuable:** History of solved problems.

---

### **[AUTO_ARCHIVE_SYSTEM.md](OPERATIONS/AUTO_ARCHIVE_SYSTEM.md)** 🆕 **NEW DEC 2025**
**What it contains:**
- How events auto-archive at midnight
- events_archive table structure
- pg_cron scheduled job details
- Why calendar/stats are NOT affected
- Manual operations (force archive, check history)
- Troubleshooting guide

**Why it's valuable:** Complete guide to the automatic event archiving system.

**Use it for:** Understanding archiving, troubleshooting, manual operations

---

### **[EXPORT_DATA_GUIDE.md](OPERATIONS/EXPORT_DATA_GUIDE.md)** 🆕 **NEW DEC 2025**
**What it contains:**
- How to export events, analytics, and compliance reports
- Date range selection (custom ranges)
- Filtering by gym and event type
- CSV vs JSON format differences
- Missing requirements detection
- Example use cases

**Why it's valuable:** Complete guide to exporting data for reports and backups.

**Use it for:** Monthly compliance reports, data backups, sharing with management

---

### **[GYM_AUTO_DETECTION_FEATURE.md](OPERATIONS/GYM_AUTO_DETECTION_FEATURE.md)**
**What it contains:**
- Intelligent gym identification from F12 data
- 100% accurate subdomain-to-gym matching

**Why it's valuable:** Understanding auto-detection.

---

## 🎯 Quick Reference: Which Doc Should I Read?

### **I need to:**

**Understand what's working RIGHT NOW**
→ Read: `OPERATIONS/SYSTEM_STATUS_NOVEMBER_2025.md` ⭐

**Sell or present the project**
→ Read: `BUSINESS/BOSS-PRESENTATION.md`

**Understand how it works technically**
→ Read: `TECHNICAL/TECHNICAL-REFERENCE.md`

**Learn how to use automated sync**
→ Read: `OPERATIONS/AUTO-SYNC-GUIDE.md`

**Understand the secret admin system**
→ Read: `OPERATIONS/SECRET_ADMIN_MODE.md`

**See sync progress / never lose track**
→ Read: `OPERATIONS/SYNC_PROGRESS_TRACKER.md`

**Troubleshoot deployment issues**
→ Read: `OPERATIONS/DEPLOYMENT_PLAN.md`

**Onboard a new developer**
→ Read in order:
1. `OPERATIONS/SYSTEM_STATUS_NOVEMBER_2025.md`
2. `TECHNICAL/TECHNICAL-REFERENCE.md`
3. `OPERATIONS/AUTO-SYNC-GUIDE.md`

---

## 💎 The Crown Jewels (Most Valuable Docs)

1. **🆕 SYSTEM_STATUS_NOVEMBER_2025.md** - Current truth (START HERE!)
2. **🏆 BOSS-PRESENTATION.md** - More valuable than any code
3. **🚀 AUTO-SYNC-GUIDE.md** - Main workflow (includes SYNC ALL!)
4. **📋 SYNC-QUICK-REFERENCE.md** - Non-technical quick guide
5. **🔐 SECRET_ADMIN_MODE.md** - Your hidden power
6. **📊 SYNC_PROGRESS_TRACKER.md** - Never lose track
7. **🔧 TECHNICAL-REFERENCE.md** - Complete system guide
8. **🗄️ AUTO_ARCHIVE_SYSTEM.md** - Automatic cleanup
9. **📤 EXPORT_DATA_GUIDE.md** - Export & compliance reports
10. **🔍 DATA_QUALITY_VALIDATION.md** - Auto-detect copy/paste errors
11. **🔧 MAINTENANCE_GUIDE.md** - Keep it running smoothly (NEW!)

**Together, these documents elevate this from "personal project" to "valuable, transferable intellectual property."**

---

## 📊 Documentation Stats

- **Total Documents:** 18+ major documents
- **Coverage:** Business value, technical architecture, operations
- **Quality Level:** Enterprise-grade, investor-ready
- **Last Major Update:** December 9, 2025 (DATA QUALITY VALIDATION)

---

## 🔄 Keeping Docs Up to Date

**When to update:**
- Major feature additions → Update TECHNICAL-REFERENCE.md
- System status changes → Update SYSTEM_STATUS_NOVEMBER_2025.md
- Process changes → Update relevant OPERATIONS doc
- Business metrics change → Update BOSS-PRESENTATION.md

**How to update:**
- Edit markdown files directly
- Maintain the same structure and format
- Add dates to updates
- Keep examples clear and practical

---

**This documentation is your project's most valuable asset.** 

Code can be rewritten, but this knowledge is irreplaceable.

---

**Last Updated:** December 9, 2025  
**Maintained by:** Jayme

