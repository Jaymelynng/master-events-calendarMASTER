# 🚀 Self-Serve Implementation Plan

**Goal:** Transform Master Events Calendar into a self-serve SaaS add-on for iClassPro (and Jackrabbit) users  
**Target:** Users can sign up, connect their gyms, and start using it without any manual intervention  
**Status:** Planning Phase

---

## ✅ YES, THIS IS POSSIBLE!

Your current tool already does the hard part (scraping iClassPro portals). We just need to add:
1. User accounts (so each customer sees only their gyms)
2. Self-service gym connection (they add their portal URLs)
3. Payment/subscription (Stripe, Paddle, or similar)
4. Simple onboarding flow

---

## 🏗️ WHAT NEEDS TO BE BUILT

### 1. User Authentication & Accounts ⭐ CRITICAL

**What it does:**
- Users create accounts (email/password or OAuth)
- Each account is isolated (multi-tenant)
- Users can only see/manage their own gyms

**How to build:**
- Use Supabase Auth (you're already on Supabase!)
- Add `user_id` column to `gyms` table
- Filter all queries by `user_id`

**Effort:** Medium (2-3 days)

---

### 2. Self-Service Gym Connection ⭐ CRITICAL

**What it does:**
- User enters their iClassPro portal URLs
- System validates the URLs work
- System automatically starts syncing those gyms
- User can add/remove gyms anytime

**Current state:**
- You manually add gyms in the database
- Need: UI where users add their own gyms

**How to build:**
- Add "Add Gym" form in UI
- User enters: Gym name, Portal URL, Event types (Classes/Camps/OpenGym)
- Backend validates URL is accessible
- Creates gym record linked to their `user_id`
- Sync starts automatically

**Effort:** Medium (3-4 days)

---

### 3. Payment/Subscription System ⭐ CRITICAL

**What it does:**
- Users choose a plan (e.g., $29/month, $99/month)
- Enter credit card
- Automatic monthly billing
- Cancel anytime

**Options:**
- **Stripe** (recommended) - Most popular, great docs
- **Paddle** - Handles taxes automatically
- **LemonSqueezy** - Simple, good for indie makers

**How to build:**
- Add Stripe to your backend
- Create subscription plans
- Add "Subscribe" button in UI
- Webhook to handle payment events
- Show subscription status in dashboard

**Effort:** Medium (4-5 days)

---

### 4. Onboarding Flow ⭐ IMPORTANT

**What it does:**
- Guides new users through setup
- Step 1: Create account
- Step 2: Add payment
- Step 3: Add first gym
- Step 4: See your calendar!

**How to build:**
- Multi-step wizard component
- Progress indicator
- Help text at each step
- Skip option for returning users

**Effort:** Low-Medium (2-3 days)

---

### 5. Multi-Tenant Data Isolation ⭐ CRITICAL

**What it does:**
- Each user only sees their gyms
- Events filtered by user's gyms
- Admin features scoped to user's account

**Current state:**
- All gyms are global (anyone can see all)
- Need: Filter everything by `user_id`

**How to build:**
- Add `user_id` to `gyms` table
- Add `user_id` to `events` table (via gym relationship)
- Update all queries to filter by `user_id`
- Update sync API to require authentication

**Effort:** Medium (3-4 days)

---

### 6. Settings/Account Management ⭐ IMPORTANT

**What it does:**
- Users manage their account
- Update email, password
- View subscription, billing history
- Cancel subscription
- Manage gyms (add/remove)

**How to build:**
- Settings page in UI
- Account section
- Billing section (powered by Stripe)
- Gym management section

**Effort:** Low-Medium (2-3 days)

---

### 7. Documentation/Help ⭐ IMPORTANT

**What it does:**
- Help users understand how to use it
- How to find their iClassPro portal URLs
- Troubleshooting common issues

**How to build:**
- Simple help center page
- Video walkthrough (optional)
- FAQ section
- Contact support link

**Effort:** Low (1-2 days)

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up Supabase Auth
- [ ] Add `user_id` to database tables
- [ ] Create login/signup pages
- [ ] Add authentication to API endpoints
- [ ] Test multi-tenant isolation

### Phase 2: Self-Service Features (Week 2-3)
- [ ] Build "Add Gym" form
- [ ] Add gym validation logic
- [ ] Create gym management UI (list, edit, delete)
- [ ] Update sync to work per-user
- [ ] Test end-to-end gym connection

### Phase 3: Payment Integration (Week 3-4)
- [ ] Set up Stripe account
- [ ] Create subscription plans
- [ ] Build payment form
- [ ] Add subscription status to UI
- [ ] Handle webhooks (payment success, cancellation)
- [ ] Test billing flow

### Phase 4: Onboarding & Polish (Week 4-5)
- [ ] Build onboarding wizard
- [ ] Add help documentation
- [ ] Create settings page
- [ ] Add account management
- [ ] Test complete user journey

### Phase 5: Launch Prep (Week 5-6)
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test with real iClassPro portals
- [ ] Set up monitoring/logging
- [ ] Create landing page
- [ ] Launch! 🚀

---

## 🗄️ DATABASE CHANGES NEEDED

### Add to `gyms` table:
```sql
ALTER TABLE gyms 
ADD COLUMN user_id UUID REFERENCES auth.users(id),
ADD COLUMN created_at TIMESTAMP DEFAULT NOW();

-- Make user_id required for new gyms
ALTER TABLE gyms 
ALTER COLUMN user_id SET NOT NULL;
```

### Add to `events` table:
```sql
-- Events already linked via gym_id, which will have user_id
-- No direct change needed, but queries need to join through gyms
```

### Create subscription table:
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL, -- active, canceled, past_due
  plan_id TEXT NOT NULL, -- basic, pro, etc.
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 💰 PRICING SUGGESTIONS

| Plan | Price | What's Included |
|------|-------|----------------|
| **Starter** | $29/month | Up to 3 gyms |
| **Pro** | $49/month | Up to 10 gyms |
| **Business** | $99/month | Unlimited gyms |

**Or simpler:**
- **Single Plan:** $39/month for unlimited gyms (easier to start)

---

## 🎨 UI/UX FLOW

### New User Journey:
```
1. Landing Page
   └─> "Sign Up" button
   
2. Sign Up Page
   └─> Email, Password
   └─> "Create Account"
   
3. Choose Plan
   └─> Select plan
   └─> Enter payment (Stripe)
   └─> "Subscribe"
   
4. Add Your First Gym
   └─> Gym name
   └─> iClassPro portal URL
   └─> Select event types
   └─> "Add Gym"
   
5. Dashboard
   └─> See your calendar!
   └─> Add more gyms
   └─> Settings
```

### Existing User:
```
1. Login
2. Dashboard (see all their gyms)
3. Can add/remove gyms anytime
```

---

## 🔧 TECHNICAL CONSIDERATIONS

### Security
- ✅ Supabase Auth handles authentication securely
- ✅ Row-level security (RLS) policies to isolate data
- ✅ API endpoints require authentication
- ✅ Validate gym URLs before adding (prevent abuse)

### Performance
- Each user's sync runs independently
- Consider rate limiting per user
- Cache per-user data appropriately

### Error Handling
- What if portal URL is wrong? → Show clear error
- What if sync fails? → Retry logic, show status
- What if payment fails? → Grace period, then disable

### Support
- Email support (start simple)
- Help docs in-app
- Status page for system health

---

## 🚦 JACKRABBIT SUPPORT

**Yes, you can add Jackrabbit too!**

The same pattern works:
1. User adds Jackrabbit portal URL
2. System detects it's Jackrabbit (different URL pattern)
3. Use Jackrabbit-specific scraper
4. Same calendar view, different data source

**To add later:**
- Create `gym_type` field (iclasspro, jackrabbit, etc.)
- Different scraping logic per type
- Same UI/UX for users

---

## 📊 ESTIMATED EFFORT

| Component | Time | Priority |
|-----------|------|----------|
| Auth & Multi-tenant | 3 days | Critical |
| Self-service gym add | 4 days | Critical |
| Payment integration | 5 days | Critical |
| Onboarding flow | 3 days | Important |
| Settings/Account | 2 days | Important |
| Documentation | 2 days | Important |
| Testing & Polish | 5 days | Critical |
| **TOTAL** | **~4-6 weeks** | |

*Assuming part-time work (evenings/weekends)*

---

## 🎯 MINIMUM VIABLE PRODUCT (MVP)

**What you need to launch:**

1. ✅ User signup/login
2. ✅ Payment (one plan is fine)
3. ✅ Add gym form
4. ✅ Calendar view (filtered to user's gyms)
5. ✅ Basic settings (manage gyms, account)

**Can add later:**
- Multiple plans
- Advanced settings
- Analytics/reporting
- Mobile app
- Jackrabbit support

---

## 💡 QUICK WINS

**To validate before building everything:**

1. **Week 1:** Add simple auth, let 1-2 beta users test
2. **Week 2:** Add payment, see if they'll pay
3. **Week 3:** If validated, build full self-serve

**Or:**
- Build MVP in 2-3 weeks
- Launch to 5-10 beta customers
- Iterate based on feedback

---

## ✅ NEXT STEPS

1. **Decide on pricing** - What's your plan? ($29? $39? $49?)
2. **Choose payment provider** - Stripe is recommended
3. **Start with Phase 1** - Auth and multi-tenant
4. **Test with yourself** - Create account, add your gyms
5. **Get first paying customer** - Validate the model!

---

## 🎉 BOTTOM LINE

**YES, this is 100% possible!**

You've already built the hard part (the scraping). Now it's just:
- Adding user accounts (Supabase makes this easy)
- Letting users add their own gyms (simple form)
- Taking payments (Stripe handles it)
- Filtering data by user (database query change)

**Estimated time:** 4-6 weeks part-time to launch MVP

**Revenue potential:** 
- 10 customers × $39/month = $390/month
- 50 customers × $39/month = $1,950/month
- 100 customers × $39/month = $3,900/month

**This is a solid side business opportunity!** 🚀

---

*Want me to start building any of these components? I can help with the code!*




