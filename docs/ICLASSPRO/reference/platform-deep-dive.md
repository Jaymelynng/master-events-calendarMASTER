# iClassPro Platform Deep Dive

Detailed feature documentation for when the SKILL.md quick map isn't enough.

## Class Management — Full Details

### Class Types
- **Monthly** — Ongoing enrollment, billed monthly
- **Session-based** — Fixed start/end dates, billed per session
- **Rolling Session** — Continuous enrollment with rolling billing cycles

### Billing Methods
- **Hourly** — Charged by hours of instruction
- **Flat Rate** — Fixed price regardless of duration
- **Time Slot** — Charged per scheduled time block

### Class Configuration Options
- Min/max age restrictions
- Capacity limits
- Custom pricing per class
- Registration mode (auto-approve, request-only, priority)
- Enrollment type restrictions
- Prorated billing for mid-cycle starts
- Blackout dates with prorated billing for holidays/closures
- Calendar integration for visual scheduling

### Mass Operations
- Bulk create classes from templates
- Bulk edit existing classes
- Copy class configurations across locations (manual — no cross-account sync)

## Enrollment System — Full Details

### Enrollment Types Explained

| Type | Behavior | Billing | Notes |
|------|----------|---------|-------|
| **ACTIVE** | Standard ongoing enrollment | Regular tuition | Default enrollment type |
| **TRIAL** | Trial class, configurable duration | Configurable (free or reduced) | Settings control trial behavior |
| **MAKEUP** | Makeup from missed session | No additional charge (uses token) | Requires staff approval via portal |
| **SINGLE DAY** | One-off attendance | Per-visit fee | Can use Punch Pass credits |
| **WAIT** | Waitlist position | No charge until activated | Does NOT take an active class spot |

### Punch Passes
- Pre-purchased visit bundles
- Redeemed for Single Day enrollments
- Track remaining balance per family
- Configurable pass sizes and pricing

### Waitlist Management
- Automated waitlist offers via Autopilot
- When spot opens → system sends enrollment offer to next in line
- Configurable offer expiration
- Staff can manually manage waitlist order

### Registration Modes
- **Auto-approve** — Enrollment confirmed immediately
- **Request-only** — Staff must approve each enrollment
- **Priority** — Early access for specific groups before general registration opens

## Attendance System — Full Details

### Check-In Methods

**Staff Portal (Phone/Tablet)**
- Instructors mark each student: Present, Absent, Tardy, Left Early
- Real-time evaluation from attendance screen (skills tracking)
- Fastest method for class-by-class attendance

**Check-In Kiosk**
- Standalone computer or iPad (iClassPro Kiosk app from App Store)
- Parents check in via phone number or QR code
- Self-check-in mode available (students check themselves in one at a time)
- iPad-only for the native kiosk app

**Hardware Support**
- USB barcode scanners for POS operations
- iPad for kiosk app
- Any browser-capable device for Staff Portal

### Attendance Tracking Features
- Per-enrollment attendance statistics
- Future/expected absences can be recorded in advance
- Tardy and Absent indicators
- Excused vs. Unexcused differentiation
- When first student checks in, remaining students auto-marked "Absent"
- Attendance history per student

## Billing & Payment Processing — Full Details

### Autopilot Billing (Automated Monthly Tuition)

**Process Flow:**
1. Tuition charges generated
2. Credits applied automatically
3. Payments processed against stored payment methods
4. Receipt sent to family (email)
5. Staff notified of results (email + SMS alerts)

**Setup:** One-time configuration in account settings. Once activated, runs automatically cycle-by-cycle.

**Automatic Adjustments:**
- Discounts applied if configured
- Anniversary fees applied if configured
- Prorated amounts calculated

**Staff Notifications:** Email and SMS alerts throughout the billing cycle so staff stays informed without manual management.

### Manual Billing
- Billing Operations Checklist available for manual processes
- Process payments from stored payment information
- Multiple payment methods per family supported
- TRANSACTIONS page for viewing all payment activity

### Transaction Management
- View all payment activity on TRANSACTIONS page
- Refunds, credits, adjustments supported
- Configurable charge categories
- Export: CSV, PDF, HTML, XLS/XLSX

### Session-Based Billing
**Current Status:** Automation still being developed. Manual processes required for session billing.

## Skills Tracking — Full Architecture

### Skill Tree Hierarchy
```
Discipline (e.g., Gymnastics, Dance, Swimming)
  └── Level (e.g., Level 1-4, Beginner-Advanced)
       └── Event (optional grouping, e.g., Bars, Beam, Vault)
            └── Skill (individual abilities evaluated)
```

### Skill Bank
- Master list of all skills in your curriculum
- Skills can be attached to multiple Events/Levels/Disciplines simultaneously
- Evaluating a skill once records it across ALL attached locations in the tree
- Created under: Skill Bank Tab → Create New Skill

### Evaluation Process
- Staff evaluate via Staff Portal app (phone/tablet — fastest method)
- Individual ratings per skill
- Optional comments (toggle in SETTINGS > SETUP > GENERAL SETTINGS > SKILL TRACKING)
- URLs and media can be attached to evaluations
- Real-time evaluation directly from attendance screen

### Certificates
- Certificate Designer tab (per Skill Level)
- Custom layout and branding
- Automatic delivery with skill progress emails
- PDF download for any Events/Levels marked as passed
- Bulk generation supported

### Parent Visibility
- Evaluations visible in Customer Portal and Mobile App
- Comments visible if admin enables them
- Progress tracking visible
- Certificates included in emails if enabled

## Customer Portal — Full Capabilities

**Access:** `https://portal.iclasspro.com/[account_name]`

### What Parents Can Do
- Create and manage family accounts
- Add children/sibling profiles
- Enroll in classes, camps, events, private lessons
- "Find the Right Class" wizard (filters: age, gender, day, type, availability)
- Request drops, transfers, report upcoming absences
- View class schedules (up to 15 events within next 30 days including cancellations)
- Shop ProShop merchandise 24/7
- View payments, charges, credits, refund history (full ledger)
- Manage stored payment methods
- View organizational news and announcements
- View skill evaluations and progress tracking
- Redeem punch passes
- Request makeup enrollments
- Responsive design (phones, tablets, desktops)

### Mobile App vs. Branded App

| Feature | iClassPro Mobile App | Branded App |
|---------|---------------------|-------------|
| Included in | All plans | Premium/Enterprise only |
| Branding | iClassPro branding | YOUR brand name, logo, colors |
| App Store listing | Under "iClassPro" | Under YOUR organization name |
| Push notifications | ✅ | ✅ |
| Functionality | Same as Customer Portal | Same as Customer Portal |
| Cost | Free (included) | $499 setup + $150/mo per app |
| Build time | N/A | 2-4 weeks after branding submitted |
| Maintenance | iClassPro | iClassPro |

## Camps, Events & Party Booking — Full Details

### Camp/Event Configuration
- Payment options: No payment at registration, deposit required, or full payment
- Priority registration support
- Real-time occupancy display
- Waitlists with automated offers
- Full camp registration OR let customers pick specific blocks
- User Defined Questions (UDQ) per event for custom data collection

### Party Booking Configuration (Elite+ only)

**Settings Path:** SETTINGS > PARTIES

**Components (must be configured in order):**
1. **Stations** — Physical spaces where parties occur (create these first)
2. **Time Slots** — When parties can be scheduled, assigned to one or multiple weekdays
3. **Packages** — Party experiences with base pricing and descriptions
4. **Add-Ons** — Additional options customers can select
5. **Financial Settings** — Payment and pricing configuration
6. **General Preferences** — Other settings

**Activation Path:** SETTINGS > CUSTOMER PORTAL > OTHER SETTINGS > GENERAL SETTINGS → "Show Parties and Allow Parents to Register for Them"

**Customer Flow:** Select package → Choose date/time → Select station → Add add-ons → Complete payment

## Appointments / Private Lessons (Elite+ only)

### What It Manages
- Private lessons, semi-private sessions
- Individual choreography sessions
- Small group lessons
- Student evaluations

### Configuration
- Office Portal → Appointments section
- Create appointment types with specific settings
- Set coaches' availability per instructor
- One-time and recurring appointments supported

### Booking Flow
- Appointment timeslots define available dates/times
- Customers book through Customer Portal
- Automated email reminders for upcoming appointments
- Follow-up communications after visits

## Point of Sale / ProShop — Full Details

### Product Management
- Visibility rules per product
- Inventory tracking across multiple locations
- Tax settings per product
- Product variations (size, color, etc.)
- UPC barcode support (manual entry or USB scanner)
- Cost of goods tracking at variation/location level
- Categories and subcategories

### Inventory Management
- Real-time sync with POS
- Increase/decrease item counts
- Clear inventory entirely
- Bulk updates via CSV file upload
- Inventory on Hand reporting

### Pricing & Promotions
- Schedule start/end date pricing for items
- Set promotional pricing in advance

### Key Report: Inventory on Hand (FIN-20)
Fields: Product, location, variation, SKU, vendor, stock on hand, cost per item, total cost, selling price, tax rate, profit margin, estimated profits

## Key Settings Paths

Quick reference for finding things in the Office Portal:

| Setting | Path |
|---------|------|
| General Settings | SETTINGS > SETUP > GENERAL SETTINGS |
| Class Settings | SETTINGS > SETUP > CLASS SETTINGS |
| Customer Portal | SETTINGS > CUSTOMER PORTAL |
| Class Registration | SETTINGS > OTHER SETTINGS > CLASS REGISTRATION |
| Marketing/Branding | SETTINGS > OTHER SETTINGS > MARKETING AND BRANDING |
| Parties | SETTINGS > PARTIES |
| Skill Tracking | SETTINGS > SETUP > GENERAL SETTINGS > SKILL TRACKING |
| Autopilot Workflows | AUTOPILOT > WORKFLOWS |
| Locations | SETTINGS > SETUP > LOCATIONS |
| Party Activation | SETTINGS > CUSTOMER PORTAL > OTHER SETTINGS > GENERAL SETTINGS |
