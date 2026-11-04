"""
Smoke test: the date written in a title must match the event's real dates
(check_title_date_mismatch) — no Supabase required.

Every title below is a real title from the calendar (Nov 2026).

Run from repo: python automation/test_title_date_check.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation_engine import ValidationContext, check_title_date_mismatch, SETTINGS_CHECKS


def _errors(title, start, end=None):
    ctx = ValidationContext({}, "TEST", "CAMP", title, "", start, end or start,
                            None, None, None, lambda *a: {})
    return check_title_date_mismatch(ctx)


def test_flags_wrong_start_day() -> None:
    # EST: no Monday, so the camp really starts Tue May 25
    errs = _errors("Week 1: Treasure Island| Ninja Warrior Summer Camp Full Day | Ages 5-12 | May 24th",
                   "2027-05-25", "2027-05-28")
    assert len(errs) == 1 and "starts Tue May 25" in errs[0]["message"], errs


def test_flags_wrong_single_day() -> None:
    errs = _errors("Christmas Squishy Extravaganza |Kids Night Out | Ages 4-13 |December 12", "2026-12-11")
    assert len(errs) == 1, errs


def test_flags_wrong_range_end() -> None:
    errs = _errors("Sports Spectacular | Summer Camp | Ages 4-12 | June 7-11", "2027-06-07", "2027-06-10")
    assert len(errs) == 1 and "last day is Thu June 10" in errs[0]["message"], errs


def test_passes_matching_titles() -> None:
    ok = [
        ("Sports Spectacular | Summer Camp | Ages 4-12 | June 7-11", "2027-06-07", "2027-06-11"),
        ("Week 2: Harry Potter| Girls Gymnastics Summer Camp Full Day | Ages 5-12 | June 1st ( NO MONDAY)", "2027-06-01", "2027-06-04"),
        ("Gymnastics Camp 2026 - NCISD Spring Break| 9AM - 3PM | (March 29-April 2)", "2027-03-29", "2027-04-02"),
        ("Spring Break| Girls Gymnastics Camp Half Day | Ages 5-12 | March 8th -12th", "2027-03-08", "2027-03-12"),
        ("Swim & Gym Full Day | Monkeys | Ages 4+ | Feb. 15 - 19", "2027-02-15", "2027-02-19"),
        ("Martin Luther King| Half Day 9AM - 12PM | January, 18th", "2027-01-18", None),
        ("Winter Week | Camp | Dec 28 - Jan 1", "2026-12-28", "2027-01-01"),
    ]
    for title, start, end in ok:
        assert _errors(title, start, end) == [], (title, _errors(title, start, end))


def test_ignores_titles_without_a_day() -> None:
    for title in ["Kids Night Out! - March 2027", "Kids Night Out - 4+ - Nov. 2026",
                  "Thanksgiving Break | Ninja Warrior Camp 2026 | Half Day 9AM - 12PM",
                  "Whoville Camp 1/2 Day"]:
        assert _errors(title, "2027-03-20") == [], title


def test_runs_without_a_description() -> None:
    assert "check_title_date_mismatch" in SETTINGS_CHECKS


if __name__ == "__main__":
    test_flags_wrong_start_day()
    test_flags_wrong_single_day()
    test_flags_wrong_range_end()
    test_passes_matching_titles()
    test_ignores_titles_without_a_day()
    test_runs_without_a_description()
    print("OK - title dates are checked against the real dates")
