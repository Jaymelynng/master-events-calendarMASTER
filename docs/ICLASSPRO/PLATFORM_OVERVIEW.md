---
name: iclasspro-kb
description: Complete iClassPro platform knowledge for Rise Athletics' 10-gym operation. Covers features, limitations, pricing, billing, automation, API gaps, competitor landscape, and strategic opportunities. Use when Jayme asks about iClassPro capabilities, troubleshoots platform issues, discusses billing/pricing, plans integrations or workarounds, evaluates competitors, or builds tools that interact with iClassPro data. Also use when suggesting solutions — this skill prevents recommending things iClassPro can't do.
---

# iClassPro Master Knowledge Base

Platform knowledge for Jayme's 10-gym Rise Athletics operation running on iClassPro. This skill exists so Claude never suggests something iClassPro can't do, always knows the workaround when the platform falls short, and understands the real cost/capability picture at 10-location scale.

**Source of truth:** This skill is kept current via periodic re-scrapes of the full iClassPro support knowledge base (569 articles). See `reference/article-index.md` for the complete article index. Last KB refresh: 2026-04-30.

## The One Thing to Always Remember

**iClassPro has NO public REST API.** This is the single most important fact about the platform. It means:
- No programmatic data access
- No Zapier, no generic CRM connections, no broad marketing automation integrations
- No custom dashboards pulling live data
- No real-time sync with anything external
- The only way to get data out is manual CSV/PDF/XLS export or the Enterprise Data Warehouse (24-hour lag)
- This is WHY Jayme builds scraping/auditing tools — the platform forces it

**The narrow exceptions** (see "Native Integrations That DO Exist" below): MailChimp (email), QuickBooks Online (accounting), Stripe/iClassPro Payment Services (payments), ADP + QuickBooks payroll exports (time clock), Power BI via Data Warehouse (Enterprise only). These are point integrations — not a general API.

Every time you're about to suggest "just connect iClassPro to [tool]" or "use the API to pull [data]" — stop. Unless the tool is in the short list above, it doesn't exist.

## Platform Identity

| Field | Value |
|-------|-------|
| Company | iClassPro, Inc. — Longview, TX |
| Founded | 2008 by Chris McNabb (gymnast, gym owner, built it for his own gym) |
| Industries | Gymnastics, Cheer, Dance, Swim, Martial Arts, Tumbling, Camps |
| Market Position | Top-tier class management for children's activity industry |
| Support | Mon-Fri 9am-9pm CT, Sat 9am-6pm CT — 1-877-554-6776 |

## Portal URLs

| Portal | URL Pattern |
|--------|-------------|
| Customer (parents) | `https://portal.iclasspro.com/[account_name]` |
| Enterprise (multi-location admin) | `https://enterprise.iclasspro.com/` |
| Office (staff) | `https://app.iclasspro.com/` |
| Support KB | `https://support.iclasspro.com/hc/en-us` |
| Payment Services | `https://payments.iclasspro.com/` |

For all Rise Athletics gym-specific iClassPro URLs, see the **gym-data** skill's `reference/iclass-urls.md`.

## Customer Portal Direct-Link Patterns

Confirmed from "Website Integration" article — use these when linking from gym websites, emails, or social:

| Destination | URL Pattern |
|-------------|-------------|
| Class Schedule | `https://portal.iclasspro.com/[account_name]/classes` |
| Login | `https://portal.iclasspro.com/[account_name]/login` |
| Create Account | `https://portal.iclasspro.com/[account_name]/create-account-02-name` |
| Camps | `https://portal.iclasspro.com/[account_name]/camps` |
| Appointments | `https://portal.iclasspro.com/[account_name]/appointments` |
| Point of Sale | `https://portal.iclasspro.com/[account_name]/pos` |
| Parties | `https://portal.iclasspro.com/[account_name]/parties` |

Filters can be added to class list URLs via query string (locations, programs, levels). For filter-specific deep links, fetch the "Share a Direct Link to a Class/Camp" article.

## Pricing at 10-Gym Scale

Pricing is **per month, per location**. At 10 gyms, costs multiply fast.

| Plan | Per Location | 10 Gyms/Month | 10 Gyms/Year |
|------|-------------|---------------|--------------|
| Signature ($129) | $129 | $1,290 | $15,480 |
| Elite ($199) | $199 | $1,990 | $23,880 |
| Premium ($299) | $299 | $2,990 | $35,880 |
| Enterprise | Custom | Custom | Custom |

**Plus:** Payment processing on every transaction + SMS credits purchased separately + Branded App ($499 setup + $1,500/mo for 10 apps).

Subscription pricing is published on iclasspro.com marketing pages, not in the support KB. Verify current rates before quoting to Kim.

### What's Locked Behind Higher Tiers

| Feature | Minimum Plan |
|---------|-------------|
| Appointments / Private Lessons | Elite ($199) |
| Party Booking Management | Elite ($199) |
| Pro Insights Analytics | Premium ($299) |
| Branded App | Premium ($299) + $499 setup + $150/mo each |
| Branded Website Builder | Premium ($299) |
| Enterprise Portal | Enterprise (custom) |
| Data Warehouse / Power BI | Enterprise (custom) |
| Dedicated Support | Enterprise (custom) |

### Payment Processing Fees (iClassPro Payment Services)

| Method | Rate |
|--------|------|
| Visa/MC/Discover | 2.9% + $0.50 |
| American Express | 3.50% + $0.50 |
| eCheck/ACH | 1% + $0.50 |
| Monthly fee | $10 |
| Chargeback | $25 |
| eCheck return | $5 |
| Foreign card surcharge | +1% |

**Alternative:** Stripe is supported as a payment processor option (article: "How Do I Sign Up for Payment Processing with Stripe?"). Evaluate Stripe rates separately if considering a switch.

## Native Integrations That DO Exist

Updated from the 2026-04-21 KB scrape. These are the exceptions to the "no API" rule.

| Integration | What It Does | Article |
|-------------|-------------|---------|
| **MailChimp** | API key pasted into iClassPro pushes family/student data into a MailChimp audience. Enables external email marketing with real segmentation. | "How Do I Setup/Integrate My MailChimp Account?" |
| **QuickBooks Online** | Syncs charge/payment data. "What Information From iClassPro is Synchronized with QuickBooks Online?" lists fields. Reconciliation walkthrough: "How Can I Reconcile With QuickBooks Online Using iClassPro Reports?" | "How Can I Integrate iClassPro with QuickBooks Online?" |
| **Stripe** | Alternative to iClassPro Payment Services | "How Do I Sign Up for Payment Processing with Stripe?" |
| **ADP Payroll** | Time Clock data export to ADP | "How Do I Use Time Clock with ADP Payroll Services?" |
| **QuickBooks Payroll** | Time Clock data export to QB Payroll | "How Do I Use Time Clock with QuickBooks Payroll Services?" |
| **Generic Payroll Export** | CSV export for any payroll system | "How Do I Use Time Clock with Generic Export Files?" |
| **Power BI** | Enterprise Data Warehouse → Power BI datasets (24-hour refresh lag). Also supports embedding Power BI reports back into the Enterprise Portal. | "What is the Data Warehouse?" + "How Can I Embed a Power BI Report in the Enterprise Portal?" |
| **Gymnastics Australia** | Club roster export format | "How Do I Upload the Gymnastics Australia Club Import Report?" |

**What this changes for Rise Athletics strategy:** The MailChimp integration is the one that matters most for your work — it means there IS a sanctioned path from iClassPro family data into external email. Worth comparing vs. your current ActiveCampaign setup (MailChimp native sync vs. manual ActiveCampaign sync). Not a recommendation — just a fact to keep in play.

## Core Capabilities Quick Map

What iClassPro CAN do well — use this to know what's available before suggesting solutions.

### Class Management
- Class types: Monthly, Session-based, Rolling Session
- Billing: Hourly, Flat Rate, Time Slot
- Enrollment types: Active, Trial, Makeup (staff approval), Single Day, Wait (waitlist)
- Registration modes: Auto-approve, Request-only, Priority
- Blackout scheduling with prorated billing
- Mass creation/editing of classes (Quick Edit tool)
- Punch Passes for pre-purchased visits
- Group Transfer Tool for moving students between classes

### Attendance & Check-In
- Staff Portal app (phone/tablet)
- Check-In Kiosk (iPad app or standalone computer)
- Self-check-in mode
- QR code and phone number lookup
- Present/Absent/Tardy/Left Early tracking
- Excused vs. Unexcused differentiation
- USB barcode scanner support for POS

### Skills Tracking (a genuine strength)
- Skill Tree hierarchy: Discipline → Level → Event → Skill
- Skill Bank (master list, skills attach to multiple levels)
- Staff evaluate via Staff Portal app or Office Portal
- Comments, URLs, media attachable to evaluations
- Custom certificates per skill level (Certificate Designer)
- Parent visibility in portal and app
- Power BI skill progression reports (Enterprise)
- Auto-send email when a skill level is marked passed

### Autopilot Workflows (24 configurable workflows — confirmed from KB)

**Correction from prior skill version:** There are 24 configurable workflows, not 16. Confirmed by article count in KB as of 2026-04-21.

Channels: Email, SMS, Push. Organized by category below.

**Billing & Payments (7):**
- Automated Billing (Monthly)
- Automated Billing (Weekly)
- Automated Billing With Anniversary Charges (Monthly)
- Automated Billing – Anniversary Charges
- Automated Billing – Class Tuition Charges (Monthly)
- Automated Billing – Class Tuition Charges (Session)
- Automated Billing – Apply Credits
- Automated Billing – Capture Payments

**Follow-ups & Lifecycle (6):**
- First Class Enrollment Follow-Up
- Trial Enrollment Follow-Up
- Dropped Enrollment Follow-Up
- Party Follow-Up
- New Family Created with No Enrollments
- Send Communication Before First-Ever Active Class Enrollment

**Alerts & Reminders (7):**
- Upcoming Charge Due
- Upcoming Birthday
- Upcoming Anniversary Charge Notification
- Overdue Balance
- Payment Method Expiring
- Invalid Payment Information
- Missing Policy Acceptance

**Engagement & Compliance (4):**
- Mobile App Not Downloaded After Enrollment
- Check for Policy Acceptance Upon Enrollment
- Expire Makeup Tokens
- (Waitlist automation — "How Can I Automate the Waitlist?")

All workflows are preset — you can customize templates, timing, and on/off state but cannot create entirely new workflow types.

### Communication Tools
- Email blasts with merge fields (student names, family info)
- SMS: 160 char limit, requires pre-purchased credits
- Push notifications via mobile/branded app
- Messenger Center for consolidated message management
- Custom Communication Templates (Email/SMS/Push)
- Scheduled email blasts
- Email attachment management
- MailChimp sync (see Native Integrations)

### Camps, Events & Parties
- Full camp registration or pick-your-own blocks
- Payment options: none at registration, deposit, or full payment
- Priority registration, waitlists, real-time occupancy
- User Defined Questions (UDQ) per event
- Camp Alias feature
- Camp Enrollment Wizard
- Camps Quick Edit Tool
- Party Booking: Time Slots → Stations → Packages → Add-Ons (Elite+)
- Party Follow-Up workflow (Autopilot)

### Point of Sale / ProShop
- In-person and online (Customer Portal)
- Product variations, UPC barcodes, inventory tracking
- Promotional/scheduled pricing
- CSV bulk inventory updates
- Cost of goods and profit margin tracking
- POS Returns supported
- Inventory on Hand Report (FIN-20)
- Sales Report (FIN-19)

### Reporting (106 reports total — confirmed from KB)

Report category counts (by report code prefix):

| Prefix | Count | Domain |
|--------|-------|--------|
| FIN | 21 | Financial (deposits, tax, credits, aged accounts) |
| CLA | 18 | Class (rosters, absences, drops, retention) |
| STA | 16 | Staff (time clock, schedules, rosters) |
| FAM | 14 | Family (lists, policies, mailing, email) |
| STU | 14 | Student (lists, policies, makeups, punch passes) |
| CAM | 7 | Camps (rosters, enrollments, absences) |
| MAR | 2 | Marketing (Promo Code Report, How You Heard) |

Plus reports without a code (Custom lists, Preset Filter reports, QuickBooks entries, etc.).

**Export formats:** CSV, PDF, HTML, XLS/XLSX. Preset Filters can be saved per report.

**Data Warehouse (Enterprise):** Power BI / SQL access, 24-hour refresh lag.

**Pro Insights (Premium):** Visual dashboards, drill-down, retention, enrollment analysis. Specific metrics documented: Average Family Spend, Family Tenure, Net Family Gain, Student Enrollment Duration, Net Student Gain, Class Occupancy, Conversion Rate, Waitlisted-Only Students.

### Other Features Worth Knowing

- **Makeup Tokens** — dedicated token system (8 KB articles). Mass-create, edit/delete/reset, expire via Autopilot.
- **Policies** — Family, Student, and Transactions policies with Customer Portal acceptance enforcement.
- **Gift Certificates** — sell via Office Portal or Customer Portal.
- **Group Enroll** — both classes and camps have group enrollment tools.
- **Substitute Instructor** — feature for staff absence coverage.
- **Enterprise Portal** — cross-account family search, consolidated reporting, Power BI embedding.
- **Background Tasks** — long-running operations run async and report status.
- **Two-Factor Authentication** — available for staff accounts.
- **Audit Log** — tracks all staff actions for accountability.

## Hard Limitations — What iClassPro CANNOT Do

These are the walls. Don't suggest workarounds that assume these exist.

| Limitation | Impact on Rise Athletics |
|------------|------------------------|
| **No public REST API** | Can't programmatically read/write data. Can't connect to arbitrary marketing tools, CRMs, or automation platforms. Forces manual exports or scraping. Narrow native integrations exist (MailChimp, QBO, Stripe, Power BI via Data Warehouse) but are NOT a general API. |
| **No Zapier / generic automation platforms** | Only the sanctioned native integrations work. No Zapier, Make.com, n8n, IFTTT, etc. |
| **No true embeddable widgets** | "Website Integration" only provides pre-made HTML link buttons to the portal — not embedded registration or schedules. Customers leave your site to register. |
| **No real-time data access** | Data Warehouse refreshes every 24 hours. No live dashboards possible. |
| **No email marketing builder** | No drag-and-drop designer, no A/B testing, no advanced segmentation, no campaign analytics (MailChimp sync is the escape hatch) |
| **No custom Autopilot workflow types** | Limited to 24 preset workflows. You can edit templates and timing but cannot build entirely custom triggers. No drip sequences beyond what's preset. |
| **SMS is credit-based and capped** | 160 chars per message, credits purchased separately |
| **Branded Website is standalone only** | No integration with existing gym websites. You either use their builder or your own — not both. |
| **Makeup system is clunky** | Parents struggle to schedule makeups. Makeup Tokens help but require staff approval workflow. |
| **Party booking requires pre-set slots** | Custom party times outside configured time slots are very difficult |
| **No Google Analytics integration** | Can't natively track portal/registration conversion. Must rely on external tracking or MailChimp if synced. |
| **No general CRM integration** | Family data only syncs to MailChimp. No HubSpot, Salesforce, etc. integration. |
| **Reporting filters are confusing** | Hard to pull specific data, especially at scale. Preset Filters help. |
| **Per-location pricing** | 10 gyms = 10x the subscription cost |
| **Browser-only Office Portal** | No desktop app. Must use Chrome/Firefox; some features break on Safari. |

## Multi-Location Architecture (Critical for 10 Gyms)

### Option A: Single Account, Multiple Locations
- Shared parent/student database across locations
- Families move between gyms without new accounts
- Balances and notes visible everywhere
- Best for tightly integrated brands

### Option B: Multiple Separate Accounts (Rise Athletics setup)
- Each gym has its own iClassPro account
- Enterprise Portal provides unified oversight
- Better for independent reporting and operations
- Larger orgs generally benefit from this approach

### Enterprise Portal Capabilities
- Single login across all connected accounts
- Cross-account family search (name, email, phone)
- Cross-account reporting
- Power BI embedding
- Subgroup and user management across accounts
- Data sync every 24 hours

## Connection to Other Skills

| Skill | Relationship |
|-------|-------------|
| **gym-data** | Has all 10 gym-specific iClassPro subdomains, portal URLs, camp/event URLs, and offerings matrix. This skill provides the PLATFORM knowledge; gym-data provides the GYM-SPECIFIC data. |
| **rise-email-design-expert** | Knowing iClassPro's communication limitations explains why Jayme builds email campaigns externally. MailChimp integration is relevant if evaluating a MailChimp ↔ HTML-email hybrid. |

## Strategic Context

Jayme builds custom tools (auditors, scrapers, data pipelines) specifically because iClassPro's lack of a general API and limited automation forces it. When helping Jayme with:

- **Data auditing** — iClassPro has no built-in data consistency checking. Her auditor tools fill this gap.
- **Marketing automation** — iClassPro's 24 preset workflows and basic email tools can't serve 10 gyms with personalized campaigns. External tools (ActiveCampaign, custom scripts) are necessary. MailChimp native sync is the one platform-sanctioned middle path.
- **Cross-location analytics** — Without Enterprise Data Warehouse or with its 24-hour lag, custom solutions are the only way to get timely multi-gym insights.
- **Website integration** — Since iClassPro won't truly embed in existing sites, any registration flow on gym websites is a redirect to the portal URL.
- **Payroll integration** — ADP or QuickBooks Payroll exports work natively. Generic CSV export covers everything else.
- **Accounting** — QuickBooks Online is the only sanctioned accounting integration. Reconciliation requires comparing iClassPro reports (FIN-16, FIN-4, FIN-2) against QBO.

## Reference Files

For deep dives beyond what's needed for everyday work:

- [article-index.md](reference/article-index.md) — **Full index of all 569 iClassPro support KB articles**, organized by section, with direct URLs. Fetch article URLs via web_fetch when specific procedure text is needed. Last refresh: 2026-04-30.
- [platform-deep-dive.md](reference/platform-deep-dive.md) — Full feature details, billing mechanics, settings paths, enrollment system, attendance, skills tracking architecture
- [limitations-and-workarounds.md](reference/limitations-and-workarounds.md) — Every known pain point with context, plus strategic opportunities and product ideas
- [competitors.md](reference/competitors.md) — Competitive landscape, feature comparison matrix, dance industry opportunity
- [api-and-integrations.md](reference/api-and-integrations.md) — Technical architecture, what integration points exist, what doesn't exist, Data Warehouse details
- [support-and-urls.md](reference/support-and-urls.md) — All official iClassPro links, support KB structure, settings navigation paths
- [_full-kb-dump.md](reference/_full-kb-dump.md) — Archive of full article text from the 2026-04-30 scrape (3.3MB). Do NOT auto-load. Grep / targeted-read only when article-index.md + web_fetch cannot resolve a question.
