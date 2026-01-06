#!/usr/bin/env python3
"""
Count audit errors by month for Cedar Park.
"""

import json
from collections import defaultdict

def main():
    new_path = r'c:\Users\Jayme\Downloads\events_rows - 2026-01-05T191448.414.json'
    
    with open(new_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Filter to Cedar Park only
    ccp = [e for e in data if e.get('gym_id') == 'CCP']
    
    print("=" * 80)
    print("CEDAR PARK (CCP) - AUDIT ERRORS BY MONTH")
    print("=" * 80)
    
    # Group by month
    jan_events = []
    feb_events = []
    
    for e in ccp:
        date = e.get('date', '')
        if date.startswith('2026-01'):
            jan_events.append(e)
        elif date.startswith('2026-02'):
            feb_events.append(e)
    
    def count_audit_issues(events, month_name):
        """Count events that should show in audit check."""
        issues = []
        
        for e in events:
            title = e.get('title', '')[:50]
            date = e.get('date', '')
            etype = e.get('type', '')
            desc_status = e.get('description_status', '')
            
            # Parse validation_errors
            errors = e.get('validation_errors') or []
            if isinstance(errors, str):
                try:
                    errors = json.loads(errors)
                except:
                    errors = []
            
            # Check for audit issues
            has_validation_error = len(errors) > 0
            no_description = desc_status == 'none'
            flyer_only = desc_status == 'flyer_only'
            
            # Get error types
            error_types = [err.get('type') for err in errors if isinstance(err, dict)]
            
            if has_validation_error or no_description or flyer_only:
                issue_reasons = []
                if no_description:
                    issue_reasons.append('no_description')
                if flyer_only:
                    issue_reasons.append('flyer_only')
                issue_reasons.extend(error_types)
                
                issues.append({
                    'date': date,
                    'type': etype,
                    'title': title,
                    'reasons': issue_reasons
                })
        
        print(f"\n{month_name} 2026: {len(events)} total events, {len(issues)} with audit issues")
        print("-" * 60)
        
        if issues:
            # Sort by date
            issues.sort(key=lambda x: x['date'])
            for i, issue in enumerate(issues, 1):
                print(f"{i}. [{issue['type']}] {issue['date']} - {issue['title']}...")
                print(f"   Reasons: {', '.join(issue['reasons'])}")
        
        return len(issues)
    
    jan_count = count_audit_issues(jan_events, "JANUARY")
    feb_count = count_audit_issues(feb_events, "FEBRUARY")
    
    print()
    print("=" * 80)
    print("SUMMARY - CEDAR PARK AUDIT ERRORS")
    print("=" * 80)
    print(f"January 2026: {jan_count} events with audit issues")
    print(f"February 2026: {feb_count} events with audit issues")
    print(f"TOTAL: {jan_count + feb_count}")

if __name__ == "__main__":
    main()

