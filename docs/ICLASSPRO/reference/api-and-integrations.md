# iClassPro API, Integrations & Technical Architecture

Everything about what you CAN and CANNOT connect to iClassPro programmatically.

## The Hard Truth: No Public REST API

iClassPro does not have a public REST API. None are planned. This is confirmed, not speculation.

There is:
- No endpoint to query students, families, enrollments, or classes
- No webhook system that fires when events happen inside iClassPro
- No OAuth flow for third-party apps
- No API keys or tokens
- No developer documentation
- No sandbox/test environment for integrations

## What Integration Points DO Exist

### 1. Content Library API (iClassPro Websites Only)
- Push content to iClassPro's Content Library
- Connect to site widgets on iClassPro's own website platform
- Useful if you keep data in an external source (Salesforce, custom forms)
- **Only works with iClassPro's own website platform** — useless for external sites

### 2. Inbound Webhooks (Contact Forms Only)
- Contact form integrations via webhooks
- Custom endpoint URL support
- POST request with JSON data format
- Connect to external services
- **Direction:** External → iClassPro only. iClassPro does NOT fire webhooks outbound.

### 3. Portal Link Integration
- Simple URL redirect: `https://portal.iclasspro.com/[account_name]`
- Link from any external website
- No embedding, no iframes, no widgets — just a redirect
- This is the ONLY way to connect an existing website to iClassPro

### 4. Data Export
- Manual export from reports: CSV, PDF, HTML, XLS/XLSX
- No scheduled/automated exports
- No export API

### 5. Data Warehouse (Enterprise Only)
- Centralized data access across all accounts
- Connect via Power BI or any SQL client
- Credentials provided by iClassPro
- Combines multi-account data into single queryable system
- **Data updates every 24 hours (overnight batch refresh)**
- Not real-time — always at least a day behind

### 6. Power BI Templates (Enterprise Only)
Available pre-built report templates:
1. Skill Progression Reports
2. Enrollment Reports
3. Family Participation Reports
4. Revenue Reports
5. Student Participation Reports

Can embed Power BI reports directly in Enterprise Portal.

## What Does NOT Exist (Confirmed Absent)

| Integration | Status |
|-------------|--------|
| REST API (read/write) | ❌ Does not exist |
| GraphQL API | ❌ Does not exist |
| Zapier native integration | ❌ Does not exist |
| Make (Integromat) integration | ❌ Does not exist |
| n8n integration | ❌ Does not exist |
| Banking software integration | ❌ Does not exist |
| OAuth / API key access | ❌ Does not exist |
| Outbound webhooks (event-driven) | ❌ Does not exist |
| Google Analytics native integration | ❌ Does not exist |
| CRM integrations (Salesforce, HubSpot) | ❌ Does not exist |
| Email marketing integrations (Mailchimp, etc.) | ❌ Does not exist |
| Embeddable widgets for external sites | ❌ Does not exist |
| Real-time data sync | ❌ Does not exist (24-hour lag minimum) |
| Scheduled data exports | ❌ Does not exist |
| Custom webhook triggers from iClassPro events | ❌ Does not exist |
| SSO / SAML | ❌ Does not exist |

## Technical Architecture

| Aspect | Detail |
|--------|--------|
| Deployment | Cloud/SaaS — hosted entirely by iClassPro |
| Self-hosting | Not available |
| Office Portal | Browser-based web application |
| Customer Portal | Browser-based, responsive |
| Mobile Apps | Native iOS and Android (Customer, Staff, Kiosk) |
| Kiosk App | iPad-only native app |
| Data Storage | iClassPro-managed, no direct database access |
| Data Access | Manual exports or Data Warehouse (Enterprise) |

## Practical Integration Strategies for 10-Gym Operation

Given the constraints, here's what actually works:

### Scraping / Auditing (What Jayme Does)
- Scripts that read iClassPro portal pages
- Parse HTML to extract structured data
- Audit data quality across all 10 gyms
- No official support — relies on portal page structure remaining stable

### Manual Export Pipeline
- Export CSV/XLS from iClassPro reports
- Import into external tools (spreadsheets, databases, BI tools)
- Labor-intensive but reliable
- No automation possible without custom scripting

### ActiveCampaign (External Email Marketing)
- Separate system from iClassPro
- No live data sync — requires manual or scripted data transfer
- Provides the email marketing capabilities iClassPro lacks
- Each gym has its own AC API base (documented in gym-data skill)

### Portal URL Linking
- Gym websites link to `https://portal.iclasspro.com/[subdomain]`
- Registration, enrollment, camp signup all happen on iClassPro's portal
- No way to keep users on the gym's own website during registration

### Data Warehouse + Power BI (If on Enterprise)
- SQL access to all account data
- 24-hour refresh cycle
- Can build custom reports and dashboards
- Power BI templates available as starting points
- Can embed reports in Enterprise Portal
