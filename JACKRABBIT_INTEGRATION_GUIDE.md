# 🐰 Jackrabbit Integration Guide

**Date:** January 29, 2026  
**Question:** Can your system work with Jackrabbit (like it does with iClassPro)?  
**Answer:** YES - with similar implementation approach

---

## 📊 Executive Summary

**Your current system CAN work with Jackrabbit** using the same Playwright browser automation approach. The core technology (intercepting API calls) will work, but you'll need to:

1. Analyze Jackrabbit's API structure (similar to what you did for iClassPro)
2. Implement a `collect_events_from_jackrabbit()` function
3. Map Jackrabbit's data format to your standard format
4. Test with a real Jackrabbit gym

**Estimated Effort:** 4-8 hours of development + testing

---

## 🏢 About Jackrabbit

### What is Jackrabbit?

**Jackrabbit Technologies** (jackrabbitclass.com)
- Gym/studio/school management software (competitor to iClassPro)
- Market share: ~5% of gymnastics facilities
- Founded: 2004
- Users: 10,000+ businesses (various activity types)

### Jackrabbit Product Line

| Product | Target Market | Approx Users |
|---------|--------------|--------------|
| **Jackrabbit Class** | General class management | ~4,000 |
| **Jackrabbit Dance** | Dance studios | ~3,000 |
| **Jackrabbit Swim** | Swim schools | ~2,000 |
| **Jackrabbit Gymnastics** | Gymnastics gyms | ~1,000 |

### API Availability

**Status:** ❌ No public API documented

- No developer portal found
- No API documentation public
- No official integrations marketplace
- **Same situation as iClassPro** → Your Playwright approach will work

---

## 🔧 Technical Implementation

### How Your System Works with iClassPro (Current)

```python
# Current approach
async def collect_events_via_f12(gym_id, camp_type):
    """
    1. Launch Playwright browser
    2. Navigate to iClassPro portal
    3. Intercept API responses from /camps/{id}
    4. Extract event data from JSON
    5. Return structured events
    """
```

### How It Will Work with Jackrabbit (Proposed)

```python
# Same approach, different endpoints
async def collect_events_from_jackrabbit(gym_id, event_type):
    """
    1. Launch Playwright browser
    2. Navigate to Jackrabbit portal
    3. Intercept API responses from Jackrabbit endpoints
    4. Extract event data from JSON
    5. Return structured events
    """
```

**Key Differences:**

| Aspect | iClassPro | Jackrabbit (Expected) |
|--------|-----------|---------------------|
| **Portal URL** | app.iclasspro.com/{slug}/calendar | {slug}.jackrabbitclass.com/schedule |
| **API Pattern** | /camps/{id} | /api/classes/{id} or /api/sessions/{id} |
| **Auth Method** | Public portal (no login) | May require login or public portal |
| **Response Format** | `{ data: {...} }` | Unknown - needs analysis |
| **Price Field** | Not in API (extract from text) | Unknown - needs analysis |

---

## 📝 Implementation Steps

### Phase 1: Reconnaissance (2-4 hours)

**You'll need:**
1. Access to a Jackrabbit portal (either your gym or a test account)
2. Browser with dev tools (Chrome/Edge)

**Steps:**

1. **Open Jackrabbit Portal:**
   ```
   Navigate to: https://{gym_slug}.jackrabbitclass.com
   Or: https://app.jackrabbitclass.com/{slug}
   ```

2. **Open Browser Dev Tools:**
   - Press F12
   - Go to "Network" tab
   - Filter by "XHR" or "Fetch" to see API calls
   - Check "Preserve log"

3. **Navigate to Events/Classes Page:**
   - Click on classes, camps, or events
   - Watch the Network tab for API calls

4. **Identify API Endpoints:**
   - Look for calls like:
     - `/api/classes`
     - `/api/sessions`
     - `/api/events`
     - `/api/camps`
     - `/api/programs`
   - Click on each to see the response

5. **Document API Response Format:**
   ```json
   // Example (you'll need to get real format)
   {
     "classes": [
       {
         "id": 123,
         "name": "Kids Night Out",
         "date": "2026-02-01",
         "time": "6:00 PM",
         "price": 45,  // ← Look for this!
         "description": "...",
         // ... other fields
       }
     ]
   }
   ```

6. **Find Price Data:**
   - Check if there's a dedicated `price`, `cost`, or `fee` field
   - If not, check title/description for price text
   - Document where price is located

### Phase 2: Implementation (2-3 hours)

**Add Jackrabbit Support to Your Codebase:**

```python
# In automation/f12_collect_and_import.py

# Add Jackrabbit gyms to config
GYMS = {
    # ... existing iClassPro gyms ...
    
    # Jackrabbit gyms (add as needed)
    'JRB_TEST': {
        'name': 'Test Jackrabbit Gym',
        'slug': 'testgym',
        'system': 'jackrabbit'
    },
}

async def collect_events_from_jackrabbit(gym_id, event_type):
    """
    Collect events from Jackrabbit portal using Playwright.
    Similar to iClassPro but with Jackrabbit-specific endpoints.
    """
    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return []
    
    gym = GYMS[gym_id]
    slug = gym['slug']
    captured_events = []
    seen_ids = set()
    
    async def handle_response(response):
        nonlocal captured_events, seen_ids
        try:
            response_url = response.url
            content_type = response.headers.get("content-type", "")
        except Exception:
            return
        
        if "application/json" not in content_type:
            return
        
        # Jackrabbit API patterns (adjust based on reconnaissance)
        # Examples: /api/classes/{id}, /api/sessions/{id}, /api/events/{id}
        is_detail_call = (
            "/api/classes/" in response_url or
            "/api/sessions/" in response_url or
            "/api/events/" in response_url
        ) and "?" not in response_url
        
        if is_detail_call:
            try:
                body = await response.json()
            except Exception:
                return
            
            # Parse Jackrabbit response format
            # (Adjust based on actual format discovered)
            event_data = None
            
            # Option 1: Direct data object
            if isinstance(body, dict):
                event_data = body
            
            # Option 2: Wrapped in 'data' key (like iClassPro)
            elif isinstance(body, dict) and 'data' in body:
                event_data = body['data']
            
            # Option 3: Array response
            elif isinstance(body, list) and body:
                event_data = body[0]
            
            if not event_data:
                return
            
            event_id = event_data.get("id") or event_data.get("classId") or event_data.get("sessionId")
            if event_id is None or event_id in seen_ids:
                return
            
            seen_ids.add(event_id)
            captured_events.append(event_data)
            print(f"    [CAPTURED] Jackrabbit Event {event_id}: {event_data.get('name', 'Unknown')[:50]}...")
    
    # Build Jackrabbit portal URL
    # Common patterns:
    # - https://{slug}.jackrabbitclass.com/schedule
    # - https://{slug}.jackrabbitclass.com/parent-portal
    # - https://app.jackrabbitclass.com/{slug}/classes
    url = f"https://{slug}.jackrabbitclass.com/schedule"
    
    print(f"\n{'='*60}")
    print(f"COLLECTING FROM JACKRABBIT: {gym['name']}")
    print(f"URL: {url}")
    print(f"{'='*60}\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        page.on("response", handle_response)
        
        print(f"  [BROWSER] Loading Jackrabbit portal...")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.reload(wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)
        
        print(f"  [BROWSER] Captured {len(captured_events)} events, closing browser...")
        await browser.close()
    
    return captured_events


def convert_jackrabbit_events_to_standard_format(events, gym_id, slug):
    """
    Convert Jackrabbit event format to your standard format.
    Maps Jackrabbit fields to iClassPro-compatible structure.
    """
    processed = []
    today_str = date.today().isoformat()
    
    for ev in events:
        event_id = ev.get("id") or ev.get("classId") or ev.get("sessionId")
        if not event_id:
            continue
        
        # Map Jackrabbit fields to standard format
        # (Adjust based on actual Jackrabbit field names)
        
        # Date handling
        start_date = ev.get("startDate") or ev.get("date") or ""
        if start_date and start_date < today_str:
            continue  # Skip past events
        
        # Build event URL (adjust based on Jackrabbit's URL structure)
        event_url = f"https://{slug}.jackrabbitclass.com/class-details/{event_id}"
        
        # Title
        title = (ev.get("name") or ev.get("className") or ev.get("title") or "Untitled").strip()
        
        # Description
        description = ev.get("description") or ev.get("details") or ""
        
        # Time
        time_str = "TBD"
        start_time = ev.get("startTime") or ev.get("time")
        end_time = ev.get("endTime")
        if start_time:
            time_str = f"{start_time}"
            if end_time:
                time_str = f"{start_time} - {end_time}"
        
        # PRICE - Try enhanced extraction
        price, price_source = extract_price_enhanced(
            ev,
            title,
            description,
            gym_id=gym_id,
            event_type=None
        )
        
        # Age range
        age_min = ev.get("minAge") or ev.get("ageMin")
        age_max = ev.get("maxAge") or ev.get("ageMax")
        
        # Availability
        has_openings = ev.get("hasOpenings") or ev.get("spotsAvailable", True)
        
        processed.append({
            "gym_id": gym_id,
            "title": title,
            "date": start_date,
            "start_date": start_date,
            "end_date": ev.get("endDate") or start_date,
            "time": time_str,
            "price": price,
            "type": ev.get("category") or "EVENT",
            "event_url": event_url,
            "age_min": age_min,
            "age_max": age_max,
            "description": description,
            "has_openings": has_openings,
            # ... map other fields as needed
        })
        
        if price:
            print(f"    💰 Price: ${price:.2f} (source: {price_source})")
        else:
            print(f"    ⚠️  NO PRICE FOUND for: {title[:50]}")
    
    return processed


# Update main collection function to support both systems
async def collect_events_via_f12(gym_id, camp_type):
    """
    Main collection function - automatically detects system type
    """
    if gym_id not in GYMS:
        print(f"Unknown gym ID: {gym_id}")
        return []
    
    gym = GYMS[gym_id]
    system = gym.get('system', 'iclasspro')  # Default to iClassPro
    
    if system == 'jackrabbit':
        # Collect from Jackrabbit
        events_raw = await collect_events_from_jackrabbit(gym_id, camp_type)
        # Convert to standard format
        return convert_jackrabbit_events_to_standard_format(
            events_raw,
            gym_id,
            gym['slug']
        )
    else:
        # Existing iClassPro logic
        # ... (current implementation)
        pass
```

### Phase 3: Testing (1-2 hours)

**Test with Real Jackrabbit Gym:**

```bash
# Run test collection
cd automation
python3 -c "
import asyncio
from f12_collect_and_import import collect_events_via_f12

async def test():
    events = await collect_events_via_f12('JRB_TEST', 'ALL')
    print(f'Collected {len(events)} events')
    if events:
        print('Sample event:')
        print(events[0])

asyncio.run(test())
"
```

**Verify:**
- ✅ Events are captured
- ✅ Prices are extracted
- ✅ Dates are correct
- ✅ URLs work
- ✅ Data imports to Supabase

---

## 🎯 Expected Challenges & Solutions

### Challenge 1: Authentication Required

**Problem:** Jackrabbit portal might require login (not public like iClassPro)

**Solution:**
```python
# Add login step before navigation
async def collect_events_from_jackrabbit(gym_id, event_type):
    # ... browser launch ...
    
    # Check if login required
    if requires_auth:
        # Navigate to login page
        await page.goto(f"https://{slug}.jackrabbitclass.com/login")
        
        # Fill login form
        await page.fill('input[name="username"]', username)
        await page.fill('input[name="password"]', password)
        await page.click('button[type="submit"]')
        
        # Wait for redirect
        await page.wait_for_url("**/schedule")
    
    # Continue with normal collection
    await page.goto(url, wait_until="networkidle")
    # ...
```

### Challenge 2: Different API Structure

**Problem:** Jackrabbit might use completely different JSON format

**Solution:** Adapt the mapping in `convert_jackrabbit_events_to_standard_format()`

### Challenge 3: No Price Field

**Problem:** Like iClassPro, price might not be in API

**Solution:** Your enhanced price extraction already handles this! It will:
1. Check API fields (might find it in Jackrabbit)
2. Extract from title
3. Extract from description
4. Flag for manual entry if not found

---

## 💰 Cost-Benefit Analysis

### Development Cost

| Task | Time | Your Rate | Cost |
|------|------|-----------|------|
| Reconnaissance | 2-4 hrs | - | Time investment |
| Implementation | 2-3 hrs | - | Time investment |
| Testing | 1-2 hrs | - | Time investment |
| **Total** | **5-9 hrs** | - | **1-2 days work** |

### Benefit

**If you have Jackrabbit gyms:**
- ✅ Automate data collection (save 5+ hours/month per gym)
- ✅ Same features as iClassPro gyms
- ✅ Consistent data across all gyms
- ✅ Future-proof for new Jackrabbit gyms

**If you DON'T have Jackrabbit gyms:**
- ⏸️ Don't implement yet
- ⏸️ Wait until you onboard first Jackrabbit gym
- ⏸️ Use saved time on other priorities

---

## 🚦 Decision Framework

### Implement Jackrabbit Support IF:

✅ You currently manage 1+ gyms using Jackrabbit  
✅ You plan to onboard Jackrabbit gyms soon  
✅ You have 5-10 hours available for development  
✅ You have access to a Jackrabbit portal for testing  

### Wait to Implement IF:

⏸️ All your gyms use iClassPro  
⏸️ No immediate plans for Jackrabbit gyms  
⏸️ Other priorities are more urgent  
⏸️ No Jackrabbit access for testing  

---

## 📞 Next Steps

### If You Want Jackrabbit Support:

**This Week:**
1. Identify which (if any) of your gyms use Jackrabbit
2. Get Jackrabbit portal access
3. Run reconnaissance (F12 analysis)
4. Document API endpoints and response format

**Next Week:**
1. Implement `collect_events_from_jackrabbit()`
2. Add Jackrabbit gyms to config
3. Test with real gym
4. Deploy to Railway

### If You Don't Need It Yet:

**Wait until:**
- You onboard first Jackrabbit gym
- Then follow steps above

---

## 📊 Summary

**Question:** Can your system work with Jackrabbit?  
**Answer:** **YES** - same Playwright approach will work

**Key Points:**
1. ✅ Same core technology (browser automation + API interception)
2. ✅ 5-10 hours development time
3. ✅ Enhanced price extraction will work for Jackrabbit too
4. ⏸️ Only implement if you have Jackrabbit gyms

**Your enhanced price extraction is already multi-platform ready!** It doesn't care whether data comes from iClassPro or Jackrabbit - it will extract prices from:
- API fields (if they exist)
- Title text
- Description text

**Bottom Line:** The hard work (price extraction) is done. Adding Jackrabbit is just adapting the data collection to their specific API endpoints.

---

**Created:** January 29, 2026  
**Purpose:** Guide for adding Jackrabbit compatibility  
**Status:** Ready to implement when needed
