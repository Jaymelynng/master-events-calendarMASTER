"""
Supabase reads for camp_pricing / event_pricing used by validation and f12.
Kept separate from f12_collect_and_import.py so validation_engine can import without
executing f12 module-level URL / gym bootstrap.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from urllib.request import Request, urlopen

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "") or os.environ.get("SUPABASE_KEY", "")

EVENT_PRICING_ROWS_CACHE: list | None = None


def fetch_event_pricing_rows() -> list:
    """Load all event_pricing rows for client-side date filtering."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        url = (
            f"{SUPABASE_URL}/rest/v1/event_pricing"
            "?select=gym_id,event_type,price,effective_date,end_date"
        )
        req = Request(url)
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        with urlopen(req) as response:
            rows = json.loads(response.read().decode())
        rows = rows or []
        print(f"[INFO] Loaded {len(rows)} event_pricing rows from Supabase")
        return rows
    except Exception as e:
        print(f"[WARN] Could not fetch event_pricing: {e}")
        return []


def _event_pricing_rows() -> list:
    global EVENT_PRICING_ROWS_CACHE
    if EVENT_PRICING_ROWS_CACHE is None:
        EVENT_PRICING_ROWS_CACHE = fetch_event_pricing_rows()
    return EVENT_PRICING_ROWS_CACHE


def clear_event_pricing_cache() -> None:
    """Reset cache (e.g. tests)."""
    global EVENT_PRICING_ROWS_CACHE
    EVENT_PRICING_ROWS_CACHE = None


def distinct_gym_event_types() -> list:
    """Unique (gym_id, event_type_upper) pairs present in cached event_pricing rows."""
    seen = set()
    out = []
    for row in _event_pricing_rows():
        gid = row.get("gym_id")
        et = (row.get("event_type") or "").strip().upper()
        if not gid or not et:
            continue
        key = (gid, et)
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def build_event_pricing_for_today() -> dict:
    """{ gym_id: { event_type: [prices] } } using today's date for effective window."""
    today = date.today().isoformat()
    pricing = {}
    for gid, et in distinct_gym_event_types():
        plist = get_active_event_prices_for_validation(gid, et, today)
        if plist:
            pricing.setdefault(gid, {})[et] = plist
    return pricing


def get_active_event_prices_for_validation(gym_id: str, event_type: str, as_of_date_str: str) -> list:
    """
    Prices from event_pricing active on event date as_of_date_str (YYYY-MM-DD).
    event_type: CLINIC | KIDS NIGHT OUT | OPEN GYM (uppercase).
    """
    if not gym_id or not event_type or not as_of_date_str:
        return []
    try:
        as_of = datetime.strptime(as_of_date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return []
    prices: list = []
    seen: set = set()
    et = (event_type or "").strip().upper()
    for row in _event_pricing_rows():
        if row.get("gym_id") != gym_id:
            continue
        if (row.get("event_type") or "").strip().upper() != et:
            continue
        eff = row.get("effective_date")
        end = row.get("end_date")
        try:
            if isinstance(eff, str):
                eff_d = datetime.strptime(eff[:10], "%Y-%m-%d").date()
            else:
                continue
        except (ValueError, TypeError):
            continue
        if eff_d > as_of:
            continue
        if end:
            try:
                end_d = datetime.strptime(end[:10], "%Y-%m-%d").date()
                if end_d < as_of:
                    continue
            except (ValueError, TypeError):
                pass
        try:
            p = float(row.get("price"))
        except (TypeError, ValueError):
            continue
        if p > 0 and p not in seen:
            seen.add(p)
            prices.append(p)
    return prices
