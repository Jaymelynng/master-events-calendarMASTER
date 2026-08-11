"""
One-shot validation runner. Reads events from a JSON dump, runs the validation
engine in-process, emits SQL UPDATE statements to populate validation_errors.

Usage:
  python _run_validation_now.py <events_json_path> > updates.sql
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from validation_engine import ValidationContext, run_validation


# ── Pricing + rules data fetched from Supabase on 2026-04-26 ─────────────
ACTIVE_CHECKS = [
    {"id": "83dca8d5-ce10-4658-b805-39494f56dcad", "rule_type": "check_date_mismatch",       "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "7a72c653-abc1-4ee2-9caa-4b580266eaba", "rule_type": "check_year_mismatch",       "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "4b04f37b-8c4d-4641-b2b2-19dee30ed8d6", "rule_type": "check_time_mismatch",       "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "9abc5fae-7b94-44fd-9b02-2624b0a004e4", "rule_type": "check_age_mismatch",        "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "33dda81c-d0e2-4dbe-83e2-32d2488a0561", "rule_type": "check_program_mismatch",    "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "87185cf9-8b00-4748-aff8-e307d82cf6da", "rule_type": "check_title_desc_mismatch", "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "e4239e01-398c-4a71-9826-de5385ad565c", "rule_type": "check_impossible_date",    "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "7258d3d0-21c7-435f-a0c6-db8cf5516cdc", "rule_type": "check_price_mismatch",      "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "1f9851ed-0701-41a5-b4c1-e8a3ff37b276", "rule_type": "check_day_mismatch",        "gym_ids": ["ALL"], "program": "ALL"},
    {"id": "78ab7c23-112c-4bd6-9444-c2ec587dd77e", "rule_type": "check_camp_price",          "gym_ids": ["ALL"], "program": "CAMP"},
    {"id": "6ca35f5a-9421-4b05-897e-c17d4c66cd3f", "rule_type": "check_event_price",         "gym_ids": ["ALL"], "program": "ALL"},
]

CAMP_PRICING = {
    "CCP": {"full_day_daily": 75, "full_day_weekly": 345, "half_day_daily": 65,  "half_day_weekly": 270},
    "CPF": {"full_day_daily": 70, "full_day_weekly": 315, "half_day_daily": 60,  "half_day_weekly": 240},
    "CRR": {"full_day_daily": 70, "full_day_weekly": 315, "half_day_daily": 60,  "half_day_weekly": 240},
    "RBA": {"full_day_daily": 62, "full_day_weekly": 250, "half_day_daily": None,"half_day_weekly": None},
    "RBK": {"full_day_daily": 62, "full_day_weekly": 250, "half_day_daily": None,"half_day_weekly": None},
    "HGA": {"full_day_daily": 90, "full_day_weekly": 400, "half_day_daily": None,"half_day_weekly": None},
    "EST": {"full_day_daily": 65, "full_day_weekly": 270, "half_day_daily": 50,  "half_day_weekly": 205},
    "OAS": {"full_day_daily": 70, "full_day_weekly": 315, "half_day_daily": 60,  "half_day_weekly": 240},
    "SGT": {"full_day_daily": 90, "full_day_weekly": 390, "half_day_daily": 70,  "half_day_weekly": 315},
    "TIG": {"full_day_daily": 80, "full_day_weekly": 335, "half_day_daily": None,"half_day_weekly": None},
}

EVENT_PRICING = {
    "CCP": {"CLINIC": [35], "KIDS NIGHT OUT": [40], "OPEN GYM": [10]},
    "RBK": {"OPEN GYM": [15], "KIDS NIGHT OUT": [40], "CLINIC": [30]},
    "SGT": {"KIDS NIGHT OUT": [45], "CLINIC": [30], "OPEN GYM": [30]},
    "CPF": {"CLINIC": [30], "OPEN GYM": [10], "KIDS NIGHT OUT": [40]},
    "OAS": {"OPEN GYM": [20], "KIDS NIGHT OUT": [45], "CLINIC": [30]},
    "EST": {"KIDS NIGHT OUT": [40], "OPEN GYM": [35], "CLINIC": [30]},
    "HGA": {"KIDS NIGHT OUT": [45], "CLINIC": [30], "OPEN GYM": [20]},
    "CRR": {"CLINIC": [30], "KIDS NIGHT OUT": [40], "OPEN GYM": [10]},
    "RBA": {"OPEN GYM": [20], "KIDS NIGHT OUT": [40], "CLINIC": [30]},
    "TIG": {"OPEN GYM": [20], "CLINIC": [30], "KIDS NIGHT OUT": [40]},
}


def get_rules_for_gym(gym_id, event_type):
    # rules table only has check_* rules right now (no user-created price/time/synonym rules yet)
    return {}


def get_camp_pricing():
    return CAMP_PRICING


def get_event_pricing():
    return EVENT_PRICING


def sql_escape(s):
    return s.replace("'", "''")


def main(events_json_path):
    with open(events_json_path, "r", encoding="utf-8") as f:
        raw = f.read()
    # File is {"result": "...inner string with untrusted-data tags wrapping JSON array..."}
    outer = json.loads(raw)
    inner_str = outer["result"]
    # Inside inner_str, find the JSON array between the untrusted-data tags
    start = inner_str.find("[", inner_str.find("<untrusted-data"))
    end = inner_str.rfind("]") + 1
    parsed = json.loads(inner_str[start:end])
    events = parsed[0]["events_json"]

    print(f"-- Validating {len(events)} events", file=sys.stderr)

    total_errors = 0
    events_with_errors = 0
    update_lines = []

    for ev in events:
        ctx = ValidationContext(
            event_dict=ev,
            gym_id=ev["gym_id"],
            event_type=ev["type"],
            title=ev.get("title", "") or "",
            description=ev.get("description", "") or "",
            start_date=ev["start_date"],
            end_date_str=ev.get("end_date") or ev["start_date"],
            time_str=ev.get("time"),
            age_min=ev.get("age_min"),
            day_of_week=ev.get("day_of_week"),
            get_rules_for_gym_fn=get_rules_for_gym,
            get_camp_pricing_fn=get_camp_pricing,
            get_event_pricing_fn=get_event_pricing,
        )
        errors, _hits = run_validation(ctx, ACTIVE_CHECKS)
        if errors:
            total_errors += len(errors)
            events_with_errors += 1
            errors_json_str = json.dumps(errors)
            update_lines.append(
                f"({sql_quote_uuid(ev['id'])}, '{sql_escape(errors_json_str)}'::jsonb)"
            )
        else:
            update_lines.append(
                f"({sql_quote_uuid(ev['id'])}, '[]'::jsonb)"
            )

    print(f"-- {events_with_errors} of {len(events)} events have errors. {total_errors} errors total.", file=sys.stderr)

    # Emit one big UPDATE using a VALUES list
    print("UPDATE events AS e SET validation_errors = v.errs")
    print("FROM (VALUES")
    print(",\n".join(update_lines))
    print(") AS v(id, errs)")
    print("WHERE e.id = v.id;")


def sql_quote_uuid(u):
    return f"'{u}'::uuid"


if __name__ == "__main__":
    main(sys.argv[1])
