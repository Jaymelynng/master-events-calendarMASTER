"""
Analyze January 2026 events for validation issues.
Following the EXACT rules:
1. iClass age_min vs Title age
2. iClass age_min vs Description age  
3. Title age vs Description age
4. Price missing in description
5. Price mismatch (title vs description)
6. Program type mismatch (title vs description)
7. No description at all
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Load the data
with open(r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T191448.414.json', 'r', encoding='utf-8') as f:
    events = json.load(f)

# Filter to January 2026 only
jan_events = [e for e in events if e.get('date', '').startswith('2026-01')]

print(f"=" * 100)
print(f"JANUARY 2026 EVENTS ANALYSIS")
print(f"Total January events: {len(jan_events)}")
print(f"=" * 100)

def extract_min_age(text, char_limit=300):
    """Extract the minimum age from text like 'Ages 5-12', 'Ages 5+', 'Age 5'"""
    if not text:
        return None
    text_lower = text.lower()[:char_limit]
    # Matches: "Ages 5-12", "Ages 5+", "Age 5", "ages 5 to 12", "5-12 years"
    age_patterns = re.findall(r'ages?\s*(\d{1,2})\s*[-–to+]|ages?\s*(\d{1,2})\b|(\d{1,2})\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?)', text_lower)
    for age_match in age_patterns:
        for group in age_match:
            if group:
                return int(group)
    return None

def extract_price(text):
    """Extract first price from text like '$35', '$69.00'"""
    if not text:
        return None
    prices = re.findall(r'\$(\d+(?:\.\d{2})?)', text)
    if prices:
        return float(prices[0])
    return None

# Track all issues
all_issues = []

for event in jan_events:
    title = event.get('title', '') or ''
    description = event.get('description', '') or ''
    event_type = event.get('type', '') or ''
    age_min = event.get('age_min')
    date = event.get('date', '')
    gym_id = event.get('gym_id', '')
    desc_status = event.get('description_status', '')
    
    issues = []
    
    # Skip CAMP for price validation
    skip_price = (event_type == 'CAMP')
    
    # ===== 1. NO DESCRIPTION =====
    if not description.strip() or desc_status == 'none':
        issues.append("NO DESCRIPTION")
    
    # ===== 2. PRICE VALIDATION (non-camp only) =====
    if not skip_price and description.strip():
        title_price = extract_price(title)
        desc_price = extract_price(description)
        
        # Rule: Price MUST be in description
        if desc_price is None:
            issues.append("NO PRICE IN DESCRIPTION")
        
        # Rule: If price in BOTH, they must match
        elif title_price is not None and desc_price is not None:
            if title_price != desc_price:
                issues.append(f"PRICE MISMATCH: Title ${title_price:.0f} vs Desc ${desc_price:.0f}")
    
    # ===== 3. AGE VALIDATION =====
    if description.strip():
        title_age = extract_min_age(title, char_limit=200)
        desc_age = extract_min_age(description, char_limit=300)
        
        # Check 1: iClass age_min vs Title
        if age_min is not None and title_age is not None:
            if age_min != title_age:
                issues.append(f"AGE MISMATCH: iClass={age_min} vs Title={title_age}")
        
        # Check 2: iClass age_min vs Description
        if age_min is not None and desc_age is not None:
            if age_min != desc_age:
                issues.append(f"AGE MISMATCH: iClass={age_min} vs Desc={desc_age}")
        
        # Check 3: Title vs Description
        if title_age is not None and desc_age is not None:
            if title_age != desc_age:
                issues.append(f"AGE MISMATCH: Title={title_age} vs Desc={desc_age}")
    
    # ===== 4. PROGRAM TYPE MISMATCH (Title vs Description) =====
    if description.strip():
        title_lower = title.lower()
        desc_lower = description.lower()[:200]  # First 200 chars
        
        # Keywords
        kno_keywords = ['kids night out', "kid's night out", 'kno', 'ninja night out']
        clinic_keywords = ['clinic']
        open_gym_keywords = ['open gym', 'gym fun', 'fun gym', 'preschool fun']
        
        title_has_kno = any(kw in title_lower for kw in kno_keywords)
        title_has_clinic = any(kw in title_lower for kw in clinic_keywords)
        title_has_open_gym = any(kw in title_lower for kw in open_gym_keywords)
        
        desc_has_kno = any(kw in desc_lower for kw in kno_keywords)
        desc_has_clinic = any(kw in desc_lower for kw in clinic_keywords)
        desc_has_open_gym = any(kw in desc_lower for kw in open_gym_keywords)
        
        # Cross-check mismatches
        if title_has_clinic and desc_has_kno:
            issues.append("PROGRAM MISMATCH: Title=Clinic, Desc=KNO")
        if title_has_kno and desc_has_clinic:
            issues.append("PROGRAM MISMATCH: Title=KNO, Desc=Clinic")
        if title_has_open_gym and desc_has_kno:
            issues.append("PROGRAM MISMATCH: Title=OpenGym, Desc=KNO")
        if title_has_kno and desc_has_open_gym:
            issues.append("PROGRAM MISMATCH: Title=KNO, Desc=OpenGym")
        if title_has_clinic and desc_has_open_gym:
            issues.append("PROGRAM MISMATCH: Title=Clinic, Desc=OpenGym")
        if title_has_open_gym and desc_has_clinic:
            issues.append("PROGRAM MISMATCH: Title=OpenGym, Desc=Clinic")
    
    # ===== 5. SKILL MISMATCH (for clinics) =====
    if 'clinic' in title.lower() and description.strip():
        title_lower = title.lower()
        desc_lower = description.lower()[:250]
        
        # List of skills
        skills = ['cartwheel', 'handstand', 'pullover', 'bridge', 'kickover', 
                  'back handspring', 'backhandspring', 'front handspring', 'roundoff',
                  'walkover', 'backwalkover', 'back walkover', 'front walkover',
                  'trampoline', 'tumbl', 'bar', 'beam', 'floor', 'vault', 'kip', 'cheer']
        
        # Find skill in title
        title_skill = None
        for skill in skills:
            if skill in title_lower:
                title_skill = skill
                break
        
        if title_skill:
            # Check if same skill is in description
            if title_skill not in desc_lower:
                # Check if a DIFFERENT skill is in description
                for skill in skills:
                    if skill in desc_lower and skill != title_skill:
                        issues.append(f"SKILL MISMATCH: Title={title_skill}, Desc={skill}")
                        break
    
    # Store if any issues found
    if issues:
        all_issues.append({
            'gym': gym_id,
            'date': date,
            'type': event_type,
            'title': title[:80] + '...' if len(title) > 80 else title,
            'issues': issues
        })

# Print results
print(f"\n{'='*100}")
print(f"EVENTS WITH ISSUES ({len(all_issues)} of {len(jan_events)} January events)")
print(f"{'='*100}\n")

for i, item in enumerate(all_issues, 1):
    print(f"{i}. [{item['gym']}] {item['date']} | {item['type']}")
    print(f"   Title: {item['title']}")
    for issue in item['issues']:
        print(f"   --> {issue}")
    print()

# Summary by issue type
print(f"\n{'='*100}")
print("SUMMARY BY ISSUE TYPE")
print(f"{'='*100}")

issue_counts = {}
for item in all_issues:
    for issue in item['issues']:
        issue_type = issue.split(':')[0]
        issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1

for issue_type, count in sorted(issue_counts.items(), key=lambda x: -x[1]):
    print(f"  {issue_type}: {count}")

print(f"\n  TOTAL EVENTS WITH ISSUES: {len(all_issues)}")
print(f"  CLEAN EVENTS: {len(jan_events) - len(all_issues)}")

