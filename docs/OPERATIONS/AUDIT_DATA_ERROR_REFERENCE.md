# 🔍 AUDIT DATA ERROR REFERENCE
## What Gets Compared — The Complete Truth

**Last Updated:** February 11, 2026  
**Purpose:** Shows EXACTLY what each DATA error compares for the audit system  
**Audience:** Non-technical — Jayme, managers, anyone reviewing audit results

---

## 📌 THE SIMPLE VERSION

Every DATA error works the same way:

> **"The SOURCE OF TRUTH says X, but the TITLE or DESCRIPTION says Y"**

The system reads two or three different places, and if they don't match, it flags it.

---

## 🎯 COMPLETE DATA ERROR COMPARISON TABLE

This is every DATA error the audit can flag. These are things that are **WRONG** (not just missing).

| # | Error Name | What the System Reads as TRUE | What It Checks Against | Example of a Real Error |
|---|-----------|-------------------------------|----------------------|------------------------|
| 1 | **📅 Year Mismatch** | iClass API `startDate` year (e.g., **2026**) | Year found in the **TITLE** text | Title: "Clinic 01/17/**2025**" but iClass date is **2026** |
| 2 | **📅 Date/Month Mismatch** | iClass API `startDate` month (e.g., **February**) | Month found in the **DESCRIPTION** text | Event is **January** 24 but description says "**December** 27th" |
| 3 | **📅 Day of Week Mismatch** | Day calculated from iClass API `startDate` (e.g., **Saturday**) | Day of week found in the **DESCRIPTION** text | Event is on **Saturday** but description says "**Friday**" |
| 4 | **🕐 Time Mismatch** | iClass API `schedule.startTime` (e.g., **6:30 PM**) | Time found in the **TITLE** and/or **DESCRIPTION** text | iClass says **9:00 AM** but description says "**10am**" |
| 5 | **👶 Age Mismatch** | iClass API `minAge` (e.g., **5**) | Age found in the **TITLE** and/or **DESCRIPTION** text | iClass says ages **7+** but title says "Ages **5**-12" |
| 6 | **🏷️ Program Type Mismatch** | iClass API program type — which page the event is on (e.g., **KNO**) | Program keywords found in the **TITLE** and/or **DESCRIPTION** | Event is on the KNO page but title says "**Clinic**" |
| 7 | **🎯 Skill Mismatch** | Skill word found in the **TITLE** (e.g., "**Tumbling** Clinic") | Skill word found in the **DESCRIPTION** | Title says "**Tumbling** Clinic" but description says "**Bars** Clinic" |
| 8 | **💰 Price Mismatch** | Price ($XX) found in the **TITLE** (e.g., **$35**) | Price ($XX) found in the **DESCRIPTION** | Title says **$35** but description says **$40** |
| 9 | **💰 Camp Price Mismatch** | Your `camp_pricing` table in Supabase (the prices YOU entered) | Price ($XX) found in the **TITLE** or **DESCRIPTION** | Your table says Full Day Daily is **$62** but description says **$150** |
| 10 | **💰 Event Price Mismatch** | Your `event_pricing` table in Supabase (the prices YOU entered) | Price ($XX) found in the **TITLE** or **DESCRIPTION** | Your table says KNO is **$40** but description says **$30** |
| 11 | **📋 Title vs Description Conflict** | Program keywords in the **TITLE** (e.g., "**Clinic**") | Program keywords in the **DESCRIPTION** | Title says "**Clinic**" but description says "**Kids Night Out**" |

---

## 🔎 DETAILED BREAKDOWN: Where Does the "Truth" Come From?

### Errors 1–6: iClass API is the Source of Truth

These errors compare what iClass has in its system (the structured data that managers enter when they set up the event) against what they typed in the event title and description text.

```
┌──────────────────────────────────────────────────────┐
│              iClass API = THE TRUTH                  │
│                                                      │
│  When a manager creates an event in iClass, they     │
│  fill in fields like:                                │
│    • Date: 2026-02-15                                │
│    • Start Time: 6:30 PM                             │
│    • Min Age: 5                                      │
│    • Page: Kids Night Out                            │
│                                                      │
│  These fields ARE the truth. They control what       │
│  actually happens (when registration opens, who      │
│  can register, etc.)                                 │
└──────────────────────────────────────────────────────┘
                        ↓ compared against ↓
┌──────────────────────────────────────────────────────┐
│         TITLE & DESCRIPTION = What We Check          │
│                                                      │
│  Managers ALSO write a title and description:        │
│    • Title: "Tumbling Clinic | Ages 5+ | Feb 15"     │
│    • Description: "Join us Friday at 6:30pm..."      │
│                                                      │
│  This is free text they type. Sometimes they         │
│  copy/paste from an old event and forget to          │
│  update the date, time, or age.                      │
│                                                      │
│  THAT'S what we catch!                               │
└──────────────────────────────────────────────────────┘
```

**Why this matters:** If the iClass system says the event is January 24, but the description still says "December 27th" (because they copied from last month's event), a parent reading the description would be confused.

### Errors 7–8: Title vs Description Cross-Check

These errors don't use iClass at all. They compare what the **title** says against what the **description** says.

```
┌──────────────────────────────────────────────────────┐
│                  TITLE = Reference                   │
│  "Tumbling Clinic | Ages 5+ | Jan 24 | $35"         │
└──────────────────────────────────────────────────────┘
                        ↓ must match ↓
┌──────────────────────────────────────────────────────┐
│              DESCRIPTION = What We Check             │
│  "Bars Clinic... $40 per child..."                   │
│                                                      │
│  ❌ Title says "Tumbling" but description says "Bars" │
│  ❌ Title says "$35" but description says "$40"       │
└──────────────────────────────────────────────────────┘
```

### Errors 9–10: YOUR Pricing Tables = Source of Truth

iClass does NOT give us price data through their API. So we built our own pricing tables where YOU enter the correct prices for each gym.

```
┌──────────────────────────────────────────────────────┐
│        YOUR SUPABASE PRICING TABLES = TRUTH          │
│                                                      │
│  camp_pricing: (for CAMP events)                     │
│    RBA: Full Day Daily $62, Weekly $250              │
│    CCP: Full Day Daily $69, Weekly $275              │
│                                                      │
│  event_pricing: (for Clinic, KNO, Open Gym)          │
│    CCP Clinic: $35                                   │
│    CCP KNO: $40                                      │
│    HGA KNO: $45                                      │
│                                                      │
│  gym_valid_values: (exceptions)                      │
│    RBA: $20 = Before Care (valid extra price)        │
└──────────────────────────────────────────────────────┘
                        ↓ compared against ↓
┌──────────────────────────────────────────────────────┐
│       TITLE & DESCRIPTION = What We Check            │
│                                                      │
│  We look for $XX amounts in the title and            │
│  description and check if they match your tables.    │
│                                                      │
│  ❌ Description says $30 but table says $40           │
│  ✅ Description says $40 and table says $40           │
│  ✅ Description says $20 and gym rule says $20=valid  │
└──────────────────────────────────────────────────────┘
```

### Error 11: Title vs Description Program Conflict

This catches copy/paste mistakes where the title and description mention completely different program types.

```
┌──────────────────────────────────────────────────────┐
│  Title says: "Clinic | Ages 5+ | Feb 15"             │
│  Description says: "Kids Night Out... drop off..."   │
│                                                      │
│  ❌ Someone copied a KNO description and pasted it    │
│     into a Clinic event!                             │
└──────────────────────────────────────────────────────┘
```

---

## 📊 SUMMARY: Source of Truth by Error Type

| Source of Truth | Error Types It Powers | Who Maintains It |
|-----------------|----------------------|-----------------|
| **iClass API** (automatic) | Year, Date/Month, Day, Time, Age, Program Type | Gym managers (via iClass system) |
| **Title text** (parsed) | Price Mismatch, Skill Mismatch, Title/Desc Conflict | Gym managers (via iClass title field) |
| **Your `camp_pricing` table** | Camp Price Mismatch | YOU (Jayme) in Supabase |
| **Your `event_pricing` table** | Event Price Mismatch (Clinic/KNO/Open Gym) | YOU (Jayme) in Supabase |
| **Your `gym_valid_values` table** | Extra valid prices, times, program synonyms | YOU (Jayme) via Admin Dashboard |

---

## ❓ FAQ

**Q: What about FORMAT errors?**  
A: FORMAT errors are different — they check if something is MISSING, not wrong. For example: "Title doesn't have an age range." This doc only covers DATA errors (mismatches).

**Q: What if the iClass data is wrong?**  
A: The system trusts iClass as the source of truth. If a manager entered the wrong date in iClass AND the wrong date in the description, the system would NOT catch it (because they match). The system only catches when they DON'T match.

**Q: Can I turn off specific checks?**  
A: You can dismiss individual errors (one-time or permanent rule). Go to Admin Dashboard → Audit & Review tab, or click the ✓ OK button on any error in the event details panel.

**Q: Why does "open gym" in a KNO description not flag an error?**  
A: Because KNO events often list activities like "open gym, ninja, dance" as rotation stations. The system knows this and ignores "open gym" mentions in KNO descriptions.

---

## 📚 Related Docs

| Need More Detail? | Read This |
|-------------------|-----------|
| Full validation rules (technical) | `docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md` |
| How to dismiss errors | `docs/OPERATIONS/DATA_QUALITY_VALIDATION.md` → Dismissing section |
| How to manage gym rules | `docs/OPERATIONS/DATA_QUALITY_VALIDATION.md` → Program Synonym Rules |
| Current pricing by gym | `docs/TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md` → Part 3.6 |

---

**This document answers: "What does the audit compare to find DATA errors?"**

**The answer:** It compares the iClass API data (date, time, age, program type) and your pricing tables against what the manager typed in the event title and description. If they don't match, it flags it.
