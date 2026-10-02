"""
Smoke test: pricing validation must stay removed — no Supabase required.

Pricing was removed on 2026-10-02 (Jayme's decision): there is no verified
source to compare prices against, so the engine must not carry any price check
and the sync must not set a price. Re-adding either needs her explicit go.

Run from repo: python automation/test_validation_fixtures.py
"""
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import validation_engine
from validation_engine import CHECK_REGISTRY, ValidationContext


def test_no_price_checks_in_engine() -> None:
    for name in CHECK_REGISTRY:
        assert "price" not in name.lower(), f"price check is back in the registry: {name}"
    for name, _ in inspect.getmembers(validation_engine, inspect.isfunction):
        assert "price" not in name.lower(), f"price function is back in the engine: {name}"


def test_context_takes_no_pricing_lookups() -> None:
    params = inspect.signature(ValidationContext.__init__).parameters
    for p in params:
        assert "pric" not in p.lower(), f"ValidationContext takes a pricing argument again: {p}"


def test_sync_sets_no_price() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "f12_collect_and_import.py"), encoding="utf-8") as f:
        src = f.read()
    assert '"price":' not in src, "the sync writes a price field again"
    assert "pricing_supabase" not in src, "the sync imports the pricing lookup again"


if __name__ == "__main__":
    test_no_price_checks_in_engine()
    test_context_takes_no_pricing_lookups()
    test_sync_sets_no_price()
    print("OK - pricing is still removed")
