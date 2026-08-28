# 🔍 Price Extraction Analysis & Solutions

**Date:** January 29, 2026  
**Issue:** Cannot reliably extract price data from iClassPro API responses  
**Request:** Explore ALL options to find pricing, consider Jackrabbit compatibility

---

## 📋 Problem Statement

**Current Situation:**
1. Price data is extracted using regex from title/description text: `\$(\d+(?:\.\d{2})?)`
2. This method is unreliable - prices may be missing, incorrectly formatted, or inconsistent
3. Manual manager input is required as fallback (not ideal)
4. Need to explore if there's a dedicated price field in the API
5. Want to know if system can work with Jackrabbit (another gym software)

---

## 🔬 Current Implementation Analysis

### How Prices Are Currently Extracted

**Location:** `automation/f12_collect_and_import.py` lines 584-595

```python
# Extract price from title or description
price = None
price_match = re.search(r'\$(\d+(?:\.\d{2})?)', title)
if price_match:
    price = float(price_match.group(1))
else:
    # Try description if available
    description_html = ev.get('description', '')
    if description_html:
        price_match = re.search(r'\$(\d+(?:\.\d{2})?)', description_html)
        if price_match:
            price = float(price_match.group(1))
```

### Problems with Current Approach

**1. Depends on Text Formatting:**
- ✅ Works: "Kids Night Out - $45"
- ✅ Works: "$50 per session"  
- ❌ Fails: "45 dollars" (no dollar sign)
- ❌ Fails: "Forty-five dollars" (written out)
- ❌ Fails: "Cost: 45.00" (no dollar sign)
- ❌ Fails: Multiple prices in text (takes first one)

**2. No Dedicated Price Field:**
- Currently extracting from: `ev.get('name')` and `ev.get('description')`
- Not checking for: `ev.get('price')` or similar dedicated fields
- Unknown: Does iClassPro API even provide a price field?

**3. Manual Fallback Required:**
- Managers must manually enter prices if extraction fails
- Time-consuming and error-prone
- Defeats purpose of automation

---

## 🎯 Comprehensive Solutions

### Solution 1: Analyze iClassPro API for Dedicated Price Field

**Action:** Run `analyze_price_fields.py` script to examine ALL fields in API response

**Potential Field Names to Check:**
```python
common_price_fields = [
    'price', 'cost', 'fee', 'amount', 'tuition',
    'pricing', 'priceAmount', 'costAmount', 'feeAmount',
    'tuitionAmount', 'rate', 'rateAmount', 'charge',
    'memberPrice', 'nonMemberPrice', 'regularPrice',
    'totalCost', 'totalPrice', 'sessionPrice', 'classPrice',
    'registrationFee', 'enrollmentFee', 'basePrice',
    'unitPrice', 'itemPrice', 'eventPrice', 'campPrice'
]
```

**Implementation:**
```python
def extract_price_from_api(ev):
    """Try to extract price from dedicated API fields first"""
    # Priority 1: Check for dedicated price field
    for field in ['price', 'priceAmount', 'cost', 'costAmount', 'fee', 'tuition']:
        if field in ev:
            value = ev[field]
            if isinstance(value, (int, float)) and value > 0:
                return float(value)
            # Handle string prices like "$45" or "45.00"
            if isinstance(value, str):
                # Remove currency symbols and parse
                clean_value = re.sub(r'[^\d.]', '', value)
                try:
                    return float(clean_value)
                except ValueError:
                    pass
    
    # Priority 2: Fall back to text extraction
    return extract_price_from_text(ev)
```

---

### Solution 2: Enhanced Text-Based Price Extraction

**Improve Current Regex to Handle More Cases:**

```python
def extract_price_from_text_enhanced(text):
    """
    Enhanced price extraction with multiple patterns
    """
    if not text:
        return None
    
    text_str = str(text)
    
    # Pattern 1: Standard $XX or $XX.XX format (current method)
    match = re.search(r'\$\s*(\d+(?:\.\d{2})?)', text_str)
    if match:
        return float(match.group(1))
    
    # Pattern 2: Number followed by "dollars"
    match = re.search(r'(\d+(?:\.\d{2})?)\s*dollars?', text_str, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    # Pattern 3: "Cost:" or "Price:" followed by number
    match = re.search(r'(?:cost|price|fee|tuition):\s*\$?\s*(\d+(?:\.\d{2})?)', text_str, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    # Pattern 4: Number with "/" (per week/day/session)
    match = re.search(r'\$?\s*(\d+(?:\.\d{2})?)\s*/\s*(?:week|day|session|class)', text_str, re.IGNORECASE)
    if match:
        return float(match.group(1))
    
    # Pattern 5: Standalone number in parentheses
    match = re.search(r'\(\s*\$?\s*(\d+(?:\.\d{2})?)\s*\)', text_str)
    if match:
        return float(match.group(1))
    
    return None

def extract_all_prices_from_text(text):
    """
    Extract ALL prices mentioned in text for validation
    """
    if not text:
        return []
    
    text_str = str(text)
    prices = []
    
    # Find all $XX.XX patterns
    for match in re.finditer(r'\$\s*(\d+(?:\.\d{2})?)', text_str):
        prices.append(float(match.group(1)))
    
    # Find all "XX dollars" patterns
    for match in re.finditer(r'(\d+(?:\.\d{2})?)\s*dollars?', text_str, re.IGNORECASE):
        price = float(match.group(1))
        if price not in prices:  # Avoid duplicates
            prices.append(price)
    
    return prices
```

---

### Solution 3: Multi-Source Price Validation

**Use Multiple Data Sources to Verify Prices:**

```python
def get_validated_price(ev, gym_id, event_type, title, description):
    """
    Get price from multiple sources and validate
    """
    prices_found = {}
    
    # Source 1: API field (if exists)
    api_price = extract_price_from_api(ev)
    if api_price:
        prices_found['api'] = api_price
    
    # Source 2: Title
    title_price = extract_price_from_text_enhanced(title)
    if title_price:
        prices_found['title'] = title_price
    
    # Source 3: Description
    desc_price = extract_price_from_text_enhanced(description)
    if desc_price:
        prices_found['description'] = desc_price
    
    # Source 4: Known pricing (for camps)
    if event_type == 'CAMP' and gym_id in CAMP_PRICING:
        expected_price = get_expected_camp_price(ev, gym_id, title, description)
        if expected_price:
            prices_found['expected'] = expected_price
    
    # Validation logic
    if not prices_found:
        return None, "NO_PRICE_FOUND"
    
    if len(set(prices_found.values())) == 1:
        # All sources agree
        return list(prices_found.values())[0], "VALIDATED"
    
    if 'api' in prices_found:
        # API takes precedence if available
        return prices_found['api'], "API_SOURCE"
    
    if 'expected' in prices_found and prices_found['expected'] in prices_found.values():
        # Expected price matches one source
        return prices_found['expected'], "EXPECTED_MATCH"
    
    # Multiple different prices - flag for review
    return list(prices_found.values())[0], f"CONFLICTING_PRICES: {prices_found}"
```

---

### Solution 4: Screen Scraping Registration Page

**Alternative: Load actual registration/detail page to find displayed price**

```python
async def scrape_price_from_detail_page(page, event_url):
    """
    Navigate to event detail/registration page and scrape displayed price
    """
    try:
        await page.goto(event_url, wait_until="networkidle", timeout=10000)
        
        # Look for common price selectors
        price_selectors = [
            '.price', '#price', '[data-price]',
            '.cost', '#cost', '[data-cost]',
            '.fee', '#fee', '.tuition',
            'span:has-text("$")', 'div:has-text("$")',
            'label:has-text("Price")', 'label:has-text("Cost")'
        ]
        
        for selector in price_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    price = extract_price_from_text_enhanced(text)
                    if price:
                        return price
            except:
                continue
        
        # Last resort: Get all text and find any price
        body_text = await page.inner_text('body')
        return extract_price_from_text_enhanced(body_text)
    
    except Exception as e:
        print(f"Error scraping price: {e}")
        return None
```

**Pros:** Guaranteed to get the price users see  
**Cons:** Much slower (extra page load per event), more fragile

---

### Solution 5: Database of Known Prices

**Extend CAMP_PRICING to All Event Types:**

```python
# Extended pricing database
GYM_EVENT_PRICING = {
    'CCP': {
        'CAMP': {
            'full_day_weekly': 345,
            'full_day_daily': 75,
            'half_day_weekly': 270,
            'half_day_daily': 65
        },
        'KIDS NIGHT OUT': 45,  # Standard KNO price
        'CLINIC': {
            'standard': 35,
            'specialty': 50
        },
        'OPEN GYM': 15
    },
    # ... etc for all gyms
}

def get_reference_price(gym_id, event_type, title, description):
    """
    Get reference price from database for validation
    """
    if gym_id not in GYM_EVENT_PRICING:
        return None
    
    gym_prices = GYM_EVENT_PRICING[gym_id]
    
    if event_type not in gym_prices:
        return None
    
    event_prices = gym_prices[event_type]
    
    # For simple prices (like KNO)
    if isinstance(event_prices, (int, float)):
        return event_prices
    
    # For complex pricing (like camps)
    if isinstance(event_prices, dict):
        # Use heuristics to determine which price applies
        # (e.g., based on keywords in title/description)
        return determine_price_variant(event_prices, title, description)
    
    return None
```

**Pros:** Reliable fallback, can validate scraped prices  
**Cons:** Requires manual maintenance, prices may change

---

## 🐰 Jackrabbit Compatibility Analysis

### What is Jackrabbit?

**Jackrabbit Technologies** (jackrabbitclass.com):
- Gym/studio management software (like iClassPro)
- Used by ~5% of gymnastics gyms
- Products: Jackrabbit Class, Dance, Swim, Gymnastics
- **API Status:** ❌ No public API documented

### Can Your System Work with Jackrabbit?

**Short Answer: YES, with similar approach**

Your Playwright-based approach should work because:

1. **Same Core Technology:**
   - Jackrabbit is also a web-based portal
   - Uses similar architecture (web app with API calls)
   - Can intercept their internal API calls

2. **Implementation Steps:**

```python
# Add Jackrabbit gyms to config
GYMS = {
    # ... existing gyms ...
    'JRB1': {'name': 'Example Jackrabbit Gym', 'slug': 'gymname', 'system': 'jackrabbit'},
}

async def detect_system_and_collect(gym_id, event_type):
    """
    Automatically detect which system (iClassPro vs Jackrabbit) and use appropriate method
    """
    gym = GYMS[gym_id]
    system = gym.get('system', 'iclasspro')  # Default to iClassPro
    
    if system == 'jackrabbit':
        return await collect_events_from_jackrabbit(gym_id, event_type)
    else:
        return await collect_events_via_f12(gym_id, event_type)

async def collect_events_from_jackrabbit(gym_id, event_type):
    """
    Collect events from Jackrabbit portal
    Similar to iClassPro but intercept Jackrabbit API endpoints
    """
    captured_events = []
    
    async def handle_response(response):
        # Jackrabbit may use different API endpoints
        # Examples: /api/classes, /api/sessions, /api/events
        if any(endpoint in response.url for endpoint in ['/api/classes', '/api/sessions', '/api/events']):
            try:
                body = await response.json()
                # Parse Jackrabbit API response format
                # (Will need to analyze their specific format)
                captured_events.extend(parse_jackrabbit_response(body))
            except:
                pass
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on("response", handle_response)
        
        # Navigate to Jackrabbit portal
        url = f"https://{gym['slug']}.jackrabbitclass.com/calendar"  # Example URL
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(5000)
        
        await browser.close()
    
    return captured_events
```

3. **Differences to Account For:**

| Aspect | iClassPro | Jackrabbit (Expected) |
|--------|-----------|----------------------|
| **Portal URL** | app.iclasspro.com/{slug} | {slug}.jackrabbitclass.com |
| **API Endpoint** | /camps/{id} | /api/classes or /api/sessions |
| **Response Format** | { data: {...} } | Unknown - needs analysis |
| **Price Field** | Likely in description | Unknown - needs analysis |

4. **Steps to Add Jackrabbit Support:**

   a. **Reconnaissance:**
   - Get access to a Jackrabbit portal (need real gym credentials)
   - Open browser dev tools (F12)
   - Navigate to calendar/events page
   - Identify API endpoints being called
   - Examine API response format

   b. **Implementation:**
   - Add `collect_events_from_jackrabbit()` function
   - Parse their API response format
   - Map their fields to your standard format
   - Test with real Jackrabbit gym

   c. **Price Extraction:**
   - Apply same analysis as iClassPro
   - Check if they have dedicated price field
   - Use enhanced text extraction as fallback

---

## 🎯 Recommended Implementation Plan

### Phase 1: Improve iClassPro Price Extraction (This Week)

**Step 1: Analyze API Response Fields**
```bash
cd automation
python3 analyze_price_fields.py
# Review output: price_field_analysis.json
```

**Step 2: Implement Enhanced Extraction**
```python
# In f12_collect_and_import.py

def extract_price_enhanced(ev, title, description):
    """Enhanced price extraction with multiple methods"""
    
    # Method 1: Check API fields (NEW)
    for field in ['price', 'priceAmount', 'cost', 'fee', 'tuition', 'amount']:
        if field in ev:
            value = ev[field]
            if isinstance(value, (int, float)) and value > 0:
                return float(value), f"API:{field}"
            if isinstance(value, str):
                clean = re.sub(r'[^\d.]', '', value)
                try:
                    return float(clean), f"API:{field}"
                except:
                    pass
    
    # Method 2: Enhanced regex from title (IMPROVED)
    price = extract_price_from_text_enhanced(title)
    if price:
        return price, "TITLE"
    
    # Method 3: Enhanced regex from description (IMPROVED)
    price = extract_price_from_text_enhanced(description)
    if price:
        return price, "DESCRIPTION"
    
    # Method 4: Use known pricing as fallback
    # (Already implemented in CAMP_PRICING)
    
    return None, "NOT_FOUND"
```

**Step 3: Add Validation Logging**
```python
# Track success rate
price, source = extract_price_enhanced(ev, title, description)
if price:
    print(f"    💰 Price: ${price:.2f} (source: {source})")
else:
    print(f"    ⚠️ NO PRICE FOUND - needs manual entry")
    # Log to database for tracking
```

### Phase 2: Database Reference Prices (Next Week)

**Expand known pricing database:**
```python
# Create comprehensive pricing reference
GYM_EVENT_PRICING = load_from_database()  # Store in Supabase

# Add UI for gym managers to update reference prices
# Location: Admin Portal > Pricing Reference
```

### Phase 3: Jackrabbit Support (Future)

**Only proceed if you have Jackrabbit gyms:**

1. Get Jackrabbit portal access
2. Run analysis similar to Phase 1
3. Implement `collect_events_from_jackrabbit()`
4. Test thoroughly
5. Add to production

---

## 📊 Expected Results

### Current Success Rate (Estimated)
- ✅ ~60-70% of events have price extracted automatically
- ⚠️ ~30-40% require manual price entry

### After Phase 1 (Enhanced Extraction)
- ✅ ~80-85% of events have price extracted automatically
- ⚠️ ~15-20% require manual price entry

### After Phase 2 (Reference Database)
- ✅ ~95%+ of events have price extracted or validated
- ⚠️ ~5% require manual price entry (new/special events)

---

## 🚀 Action Items

### Immediate Actions:

1. **Run Analysis Script**
   ```bash
   cd automation
   python3 analyze_price_fields.py
   ```
   - Review ALL fields in API response
   - Check if dedicated price field exists
   - Document findings

2. **Implement Enhanced Extraction**
   - Add `extract_price_enhanced()` function
   - Add multiple regex patterns
   - Test with real data

3. **Add Success Tracking**
   - Log price source for each event
   - Track extraction success rate
   - Identify patterns in failures

### Next Steps:

4. **Build Reference Database**
   - Create Supabase table for reference prices
   - Add UI for managers to update prices
   - Use as validation/fallback

5. **Jackrabbit Investigation** (if needed)
   - Get Jackrabbit portal access
   - Run same analysis
   - Implement if you have Jackrabbit gyms

---

## 📞 Questions to Answer

Before implementation, clarify:

1. **Do you currently have any Jackrabbit gyms?**
   - If NO: Focus on iClassPro improvements only
   - If YES: Prioritize Jackrabbit support

2. **What's your current price extraction success rate?**
   - Run analysis script to measure
   - This will justify enhancement effort

3. **Are gym prices stable or frequently changing?**
   - Stable: Reference database will work great
   - Changing: May need more frequent updates

4. **Can you get API documentation from iClassPro/Jackrabbit?**
   - Contact support and ask about API access
   - May reveal dedicated price fields

---

**Next Step:** Run `python3 automation/analyze_price_fields.py` to see what fields are actually available in the iClassPro API responses.

---

**Created:** January 29, 2026  
**Purpose:** Comprehensive analysis of price extraction challenges and solutions  
**Status:** Ready for implementation
