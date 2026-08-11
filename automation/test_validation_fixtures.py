"""
Smoke tests for validation pricing path — no Supabase required.
Run: python test_validation_fixtures.py
"""

from __future__ import annotations

import inspect
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation_engine import (  # noqa: E402
    ValidationContext,
    check_camp_price,
    check_event_price,
    CHECK_REGISTRY,
)


def _fixture(name: str) -> dict:
    path = os.path.join(os.path.dirname(__file__), "fixtures", "validation", name)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_no_schedule_matching_in_price_checks() -> None:
    src_camp = inspect.getsource(check_camp_price)
    src_evt = inspect.getsource(check_event_price)
    assert "find_matching_schedule" not in src_camp
    assert "find_matching_schedule" not in src_evt


def test_event_price_with_mock_pricing() -> None:
    ev = _fixture("sample_event_kno.json")

    def get_rules(_gym, _prog):
        return {"price": [], "time": [], "program_synonym": []}

    def get_camp():
        return {}

    def get_event():
        return {"OAS": {"KIDS NIGHT OUT": [45.0]}}

    ctx = ValidationContext(
        event_dict=ev,
        gym_id=ev["gym_id"],
        event_type="KIDS NIGHT OUT",
        title=ev["title"],
        description=ev["description"],
        start_date=ev["start_date"],
        end_date_str=ev["end_date"],
        time_str=ev.get("time") or "",
        age_min=ev.get("age_min"),
        day_of_week=ev.get("day_of_week") or "",
        get_rules_for_gym_fn=get_rules,
        get_camp_pricing_fn=get_camp,
        get_event_pricing_fn=get_event,
    )
    errs = check_event_price(ctx)
    assert errs == [], errs


def test_registry_has_expected_checks() -> None:
    required = {
        "check_date_mismatch",
        "check_camp_price",
        "check_event_price",
        "check_price_mismatch",
    }
    missing = required - set(CHECK_REGISTRY.keys())
    assert not missing, f"Missing registry keys: {missing}"


def main() -> None:
    test_no_schedule_matching_in_price_checks()
    test_event_price_with_mock_pricing()
    test_registry_has_expected_checks()
    print("test_validation_fixtures: OK")


if __name__ == "__main__":
    main()
