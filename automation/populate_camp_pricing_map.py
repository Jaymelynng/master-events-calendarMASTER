#!/usr/bin/env python3
"""
Populate camp_pricing_map from iClassPro authenticated backend API.

Flow A — live API (per gym / JWT):
  1. GET  {ICLASSPRO_V1_BASE}/camps  (with optional query params) → collect camp ids
  2. GET  {ICLASSPRO_V1_BASE}/camps/{id} → read pricingScheduleId from JSON
  3. Upsert rows into Supabase public.camp_pricing_map

Flow B — backend JSON file you already saved (no JWT):
  python populate_camp_pricing_map.py --from-json path/to/export.json --gym-slug oasisgymnastics
  Expects the same fields as API objects: id (or campId) and pricingScheduleId when present.
  If every camp has pricingScheduleId: null, the file cannot build the map — use Flow A or a different export.

Requirements:
  - Table created via database/CREATE_CAMP_PRICING_MAP.sql
  - Staff JWT: copy from an authenticated app.iclasspro.com browser session
    (Network tab → any /api/jwt/v1/ or /api/v1/ request → Authorization: Bearer …)

Environment:
  SUPABASE_URL, SUPABASE_SERVICE_KEY  — required for writes
  (Auto-loads project root .env / .env.local if present; does not override vars already set.)
  Aliases: REACT_APP_SUPABASE_URL → SUPABASE_URL; SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SERVICE_KEY
  If no service key: REACT_APP_SUPABASE_ANON_KEY → SUPABASE_SERVICE_KEY (dev only if RLS allows writes)
  ICLASSPRO_V1_BASE                   — default https://app.iclasspro.com/api/v1
  ICLASSPRO_JWT                       — Bearer token for one org (single-gym run)
  GYM_SLUG                            — portal slug matching that org (e.g. oasisgymnastics)
  ICLASSPRO_JWTS_JSON                 — optional: {"oasisgymnastics":"eyJ...","tigar":"eyJ..."} for multi-gym
  ICLASSPRO_JWTS_FILE                 — optional path to JSON file with same shape as ICLASSPRO_JWTS_JSON
  automation/iclass_jwts.json         — auto-loaded if present (gitignored; see iclass_jwts.json.example)
  ICLASSPRO_CAMPS_LIST_QUERY          — optional: extra query string without leading ?, e.g. locationId=1
  ICLASSPRO_CAMPS_PAGE_SIZE           — optional: page size for list endpoint (default 100)
  ICLASSPRO_SLEEP_SECONDS             — optional: delay between detail calls (default 0.15)

CLI:
  python populate_camp_pricing_map.py                    # API mode, env JWTs
  python populate_camp_pricing_map.py --dry-run          # API mode, no Supabase writes
  python populate_camp_pricing_map.py --from-json X.json --gym-slug oasisgymnastics

Rules for this script:
  - No programName / description / regex-based matching
  - Does not touch validation_engine, f12_collect_and_import, or frontend
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_V1_BASE = "https://app.iclasspro.com/api/v1"
DEFAULT_PAGE_SIZE = 100
DEFAULT_SLEEP = 0.15


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.environ.get(name)
    if v is None or v.strip() == "":
        return default
    return v


def _load_dotenv(dotenv_path: Optional[str] = None) -> None:
    """Load KEY=VALUE from .env files into os.environ only for keys not already set."""
    if dotenv_path:
        candidates = [Path(dotenv_path)]
    else:
        root = Path(__file__).resolve().parent.parent
        candidates = [root / ".env", root / ".env.local"]
    for path in candidates:
        if not path.is_file():
            continue
        try:
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip()
                    if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                        val = val[1:-1]
                    if key and key not in os.environ:
                        os.environ[key] = val
        except OSError:
            pass


def _apply_env_aliases() -> None:
    """Map common names from frontend / Railway to what this script expects."""
    if not _env("SUPABASE_URL"):
        r = _env("REACT_APP_SUPABASE_URL")
        if r:
            os.environ["SUPABASE_URL"] = r.strip()
    if not _env("SUPABASE_SERVICE_KEY"):
        for alt in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"):
            v = _env(alt)
            if v:
                os.environ["SUPABASE_SERVICE_KEY"] = v.strip()
                break
    if not _env("SUPABASE_SERVICE_KEY"):
        anon = _env("REACT_APP_SUPABASE_ANON_KEY")
        if anon:
            os.environ["SUPABASE_SERVICE_KEY"] = anon.strip()


def api_get_json(url: str, bearer: str, timeout: float = 60.0) -> Optional[Any]:
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {bearer}")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "TeamCalendar-camp-pricing-map/1.0")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if not raw.strip():
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"[ERR] HTTP {e.code} GET {url}\n{body[:2000]}")
        return None
    except urllib.error.URLError as e:
        print(f"[ERR] Network GET {url}: {e.reason}")
        return None
    except json.JSONDecodeError as e:
        print(f"[ERR] Invalid JSON from {url}: {e}")
        return None


def unwrap_data(payload: Any) -> Any:
    """If API returns { data: X }, return X; else return payload."""
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def extract_total_records(payload: Any) -> Optional[int]:
    """Best-effort totalRecords from list payload (open-API-style wrappers)."""
    if isinstance(payload, dict):
        tr = payload.get("totalRecords")
        if tr is not None:
            try:
                return int(tr)
            except (TypeError, ValueError):
                pass
    data = unwrap_data(payload)
    if isinstance(data, dict):
        tr = data.get("totalRecords")
        if tr is not None:
            try:
                return int(tr)
            except (TypeError, ValueError):
                pass
    return None


def extract_camp_ids_from_list_payload(payload: Any) -> List[int]:
    """Collect integer camp ids from a list response (no regex)."""
    out: List[int] = []
    data = unwrap_data(payload)

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if isinstance(data.get("records"), list):
            items = data["records"]
        elif isinstance(data.get("items"), list):
            items = data["items"]
        elif isinstance(data.get("camps"), list):
            items = data["camps"]
        elif isinstance(data.get("all_camps"), list):
            items = data["all_camps"]
        else:
            items = []
    else:
        items = []

    for item in items:
        if not isinstance(item, dict):
            continue
        cid = item.get("id")
        if cid is None:
            cid = item.get("campId")
        if cid is None:
            cid = item.get("uid")
        if cid is None:
            continue
        try:
            out.append(int(cid))
        except (TypeError, ValueError):
            continue

    return out


def extract_pricing_schedule_id(detail_payload: Any) -> Optional[int]:
    """Read pricingScheduleId from camp detail JSON."""
    data = unwrap_data(detail_payload)
    if not isinstance(data, dict):
        return None
    psid = data.get("pricingScheduleId")
    if psid is None:
        return None
    try:
        return int(psid)
    except (TypeError, ValueError):
        return None


def camp_item_dicts_from_generic_payload(payload: Any) -> List[dict]:
    """Same shape discovery as extract_camp_ids_from_list_payload, but return dict rows."""
    if payload is None:
        return []
    data = unwrap_data(payload)
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if isinstance(data.get("records"), list):
            items = data["records"]
        elif isinstance(data.get("items"), list):
            items = data["items"]
        elif isinstance(data.get("camps"), list):
            items = data["camps"]
        elif isinstance(data.get("all_camps"), list):
            items = data["all_camps"]
        else:
            items = []
    else:
        items = []
    out = [x for x in items if isinstance(x, dict)]
    if not out and isinstance(payload, list):
        out = [x for x in payload if isinstance(x, dict)]
    return out


def _row_from_camp_item(item: dict) -> Optional[Dict[str, Any]]:
    cid = item.get("campId")
    if cid is None:
        cid = item.get("id")
    if cid is None:
        cid = item.get("uid")
    psid = item.get("pricingScheduleId")
    if psid is None:
        psid = item.get("pricing_schedule_id")
    if cid is None or psid is None:
        return None
    try:
        return {"camp_id": int(cid), "pricing_schedule_id": int(psid)}
    except (TypeError, ValueError):
        return None


def bridge_rows_from_json_file(
    path: Path,
    gym_slug_override: Optional[str],
) -> Tuple[str, List[Dict[str, Any]], Dict[str, int]]:
    """
    Parse a saved export into upsert rows for camp_pricing_map.

    Supports:
      - camp-pricing-map-v1: { "_meta": { "gym_slug": ... }, "mapping": [ { campId, pricingScheduleId, ... } ] }
      - Generic API-style list payloads (records/items/camps/all_camps) — requires --gym-slug
    """
    raw = path.read_text(encoding="utf-8")
    obj = json.loads(raw)
    stats = {"objects_seen": 0, "skipped_incomplete": 0, "rows_built": 0}

    gym_slug = (gym_slug_override or "").strip()

    if isinstance(obj, dict) and isinstance(obj.get("mapping"), list):
        meta = obj.get("_meta")
        if not gym_slug and isinstance(meta, dict):
            gs = meta.get("gym_slug")
            if isinstance(gs, str) and gs.strip():
                gym_slug = gs.strip()
        if not gym_slug:
            raise SystemExit("camp-pricing-map JSON needs _meta.gym_slug or pass --gym-slug")
        rows_map: Dict[Tuple[int, str], Dict[str, Any]] = {}
        for item in obj["mapping"]:
            stats["objects_seen"] += 1
            if not isinstance(item, dict):
                stats["skipped_incomplete"] += 1
                continue
            base = _row_from_camp_item(item)
            if not base:
                stats["skipped_incomplete"] += 1
                continue
            row = {"camp_id": base["camp_id"], "gym_slug": gym_slug, "pricing_schedule_id": base["pricing_schedule_id"]}
            rows_map[(row["camp_id"], gym_slug)] = row
        stats["rows_built"] = len(rows_map)
        ver = (meta or {}).get("version") if isinstance(meta, dict) else None
        if ver:
            print(f"[INFO] JSON format: {ver}  gym_slug={gym_slug}  unique_rows={len(rows_map)}")
        return gym_slug, list(rows_map.values()), stats

    if not gym_slug:
        raise SystemExit("Generic camp list JSON requires --gym-slug")

    items = camp_item_dicts_from_generic_payload(obj)
    if not items and isinstance(obj, dict):
        items = camp_item_dicts_from_generic_payload(obj.get("data"))
    rows_map = {}
    for item in items:
        stats["objects_seen"] += 1
        base = _row_from_camp_item(item)
        if not base:
            stats["skipped_incomplete"] += 1
            continue
        row = {"camp_id": base["camp_id"], "gym_slug": gym_slug, "pricing_schedule_id": base["pricing_schedule_id"]}
        rows_map[(row["camp_id"], gym_slug)] = row
    stats["rows_built"] = len(rows_map)
    print(f"[INFO] Generic camp list  gym_slug={gym_slug}  unique_rows={len(rows_map)}")
    return gym_slug, list(rows_map.values()), stats


def fetch_all_camp_ids(
    v1_base: str,
    bearer: str,
    list_query: Optional[str],
    page_size: int,
) -> List[int]:
    """
    Paginate GET {v1_base}/camps until a page returns no new ids.
    Query string may include locationId=… per org; set ICLASSPRO_CAMPS_LIST_QUERY.
    """
    base = v1_base.rstrip("/")
    seen: set = set()
    page = 1
    max_pages = 5000

    total_goal: Optional[int] = None

    while page <= max_pages:
        q = urllib.parse.urlencode({"page": page, "limit": page_size})
        if list_query:
            q = f"{q}&{list_query}"
        url = f"{base}/camps?{q}"
        payload = api_get_json(url, bearer)
        if payload is None:
            break

        if total_goal is None:
            total_goal = extract_total_records(payload)

        ids = extract_camp_ids_from_list_payload(payload)
        new_ids = [i for i in ids if i not in seen]
        if not new_ids:
            # First page empty → maybe wrong endpoint; still return what we have
            if page == 1 and not seen:
                print(f"[WARN] No camp ids on page 1: {url}")
            break

        for i in new_ids:
            seen.add(i)

        if total_goal is not None and len(seen) >= total_goal:
            break
        if len(ids) < page_size:
            break
        page += 1
        time.sleep(DEFAULT_SLEEP)

    return sorted(seen)


def supabase_upsert_rows(
    supabase_url: str,
    service_key: str,
    rows: List[Dict[str, Any]],
    dry_run: bool,
) -> None:
    if dry_run:
        print(f"[DRY-RUN] Would upsert {len(rows)} rows into camp_pricing_map")
        return

    if not rows:
        return

    base = supabase_url.rstrip("/")
    target = f"{base}/rest/v1/camp_pricing_map?on_conflict=camp_id,gym_slug"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(target, data=body, method="POST")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"[ERR] Supabase HTTP {e.code}: {err_body[:4000]}")
        raise


def run_for_gym(
    gym_slug: str,
    bearer: str,
    v1_base: str,
    list_query: Optional[str],
    page_size: int,
    sleep_s: float,
    supabase_url: Optional[str],
    service_key: Optional[str],
    dry_run: bool,
) -> Tuple[int, int, int]:
    """
    Returns (camp_ids_found, rows_written, rows_skipped_no_schedule)
    """
    print(f"\n=== {gym_slug} ===")
    camp_ids = fetch_all_camp_ids(v1_base, bearer, list_query, page_size)
    print(f"[INFO] {len(camp_ids)} distinct camp id(s) from list endpoint")

    rows: List[Dict[str, Any]] = []
    skipped = 0

    for cid in camp_ids:
        url = f"{v1_base.rstrip('/')}/camps/{cid}"
        detail = api_get_json(url, bearer)
        psid = extract_pricing_schedule_id(detail)
        if psid is None:
            print(f"[SKIP] camp {cid}: no pricingScheduleId in detail")
            skipped += 1
        else:
            rows.append(
                {
                    "camp_id": cid,
                    "gym_slug": gym_slug,
                    "pricing_schedule_id": psid,
                }
            )
        time.sleep(sleep_s)

    if supabase_url and service_key and rows:
        supabase_upsert_rows(supabase_url, service_key, rows, dry_run)
    elif rows and not dry_run and (not supabase_url or not service_key):
        print("[WARN] Rows fetched but SUPABASE_URL / SUPABASE_SERVICE_KEY missing — not writing")

    written = len(rows) if not dry_run else 0
    return len(camp_ids), written, skipped


def _jwts_dict_from_obj(obj: Any, source: str) -> List[Tuple[str, str]]:
    if not isinstance(obj, dict):
        raise SystemExit(f"{source} must be a JSON object: {{ \"slug\": \"jwt\", ... }}")
    pairs: List[Tuple[str, str]] = []
    for slug, token in obj.items():
        if not isinstance(slug, str) or not isinstance(token, str):
            continue
        pairs.append((slug.strip(), token.strip()))
    if not pairs:
        raise SystemExit(f"{source} has no slug/token entries")
    return pairs


def load_slug_token_pairs() -> List[Tuple[str, str]]:
    multi = _env("ICLASSPRO_JWTS_JSON")
    if multi:
        return _jwts_dict_from_obj(json.loads(multi), "ICLASSPRO_JWTS_JSON")

    jwts_file = _env("ICLASSPRO_JWTS_FILE")
    script_dir = Path(__file__).resolve().parent
    candidates: List[Path] = []
    if jwts_file:
        candidates.append(Path(jwts_file).expanduser())
    auto = script_dir / "iclass_jwts.json"
    if auto.is_file():
        candidates.append(auto)

    for path in candidates:
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError as e:
            if jwts_file and path == Path(jwts_file).expanduser():
                raise SystemExit(f"Cannot read ICLASSPRO_JWTS_FILE {path}: {e}") from e
            continue
        obj = json.loads(raw)
        print(f"[INFO] Loaded JWT map from {path}")
        return _jwts_dict_from_obj(obj, str(path))

    slug = _env("GYM_SLUG")
    token = _env("ICLASSPRO_JWT")
    if not slug or not token:
        raise SystemExit(
            "Set GYM_SLUG + ICLASSPRO_JWT, or ICLASSPRO_JWTS_JSON / ICLASSPRO_JWTS_FILE, "
            "or create automation/iclass_jwts.json (see iclass_jwts.json.example)."
        )
    return [(slug.strip(), token.strip())]


def main() -> None:
    parser = argparse.ArgumentParser(description="Populate camp_pricing_map from iClassPro /api/v1/camps")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Supabase")
    parser.add_argument(
        "--from-json",
        metavar="PATH",
        default=None,
        help="Load bridge from a saved JSON (e.g. camp-pricing-map-v1 with mapping[]). No JWT.",
    )
    parser.add_argument(
        "--gym-slug",
        default=None,
        help="Portal slug; optional if JSON has _meta.gym_slug (camp-pricing-map-v1). Overrides meta when set.",
    )
    parser.add_argument(
        "--env-file",
        default=None,
        help="Optional path to a .env file (default: project root .env then .env.local)",
    )
    args = parser.parse_args()

    _load_dotenv(args.env_file)
    _apply_env_aliases()

    supabase_url = _env("SUPABASE_URL")
    service_key = _env("SUPABASE_SERVICE_KEY") or _env("SUPABASE_KEY")
    anon = _env("REACT_APP_SUPABASE_ANON_KEY")
    if anon and service_key == anon.strip():
        print(
            "[WARN] Using REACT_APP_SUPABASE_ANON_KEY for Supabase writes. "
            "Prefer SUPABASE_SERVICE_ROLE_KEY in production and lock down RLS on camp_pricing_map."
        )

    if args.from_json:
        path = Path(args.from_json).expanduser()
        if not path.is_file():
            raise SystemExit(f"Not a file: {path}")
        gym_slug, rows, stats = bridge_rows_from_json_file(path, args.gym_slug)
        print(
            f"[INFO] Parsed objects={stats['objects_seen']}  "
            f"skipped_incomplete={stats['skipped_incomplete']}  upsert_rows={len(rows)}"
        )
        if not rows:
            raise SystemExit("No rows to write — check JSON shape and pricingScheduleId fields.")
        if args.dry_run:
            if supabase_url and service_key:
                supabase_upsert_rows(supabase_url, service_key, rows, True)
            else:
                print(f"[DRY-RUN] Would upsert {len(rows)} rows (Supabase URL/key not set — skipping REST call)")
        else:
            if not supabase_url or not service_key:
                raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_KEY (or anon alias) required for writes.")
            supabase_upsert_rows(supabase_url, service_key, rows, False)
        print(f"\n[DONE] from-json gym={gym_slug} rows={len(rows)} dry_run={args.dry_run}")
        return

    v1_base = _env("ICLASSPRO_V1_BASE", DEFAULT_V1_BASE) or DEFAULT_V1_BASE
    list_query = _env("ICLASSPRO_CAMPS_LIST_QUERY")
    page_size = int(_env("ICLASSPRO_CAMPS_PAGE_SIZE", str(DEFAULT_PAGE_SIZE)) or DEFAULT_PAGE_SIZE)
    sleep_s = float(_env("ICLASSPRO_SLEEP_SECONDS", str(DEFAULT_SLEEP)) or DEFAULT_SLEEP)

    pairs = load_slug_token_pairs()

    total_ids = 0
    total_written = 0
    total_skipped = 0

    for gym_slug, bearer in pairs:
        n_ids, n_written, n_skip = run_for_gym(
            gym_slug=gym_slug,
            bearer=bearer,
            v1_base=v1_base,
            list_query=list_query,
            page_size=page_size,
            sleep_s=sleep_s,
            supabase_url=supabase_url,
            service_key=service_key,
            dry_run=args.dry_run,
        )
        total_ids += n_ids
        total_written += n_written
        total_skipped += n_skip

    print(
        f"\n[DONE] gyms={len(pairs)} camp_ids_seen={total_ids} "
        f"rows_upserted={total_written} skipped_no_schedule={total_skipped} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
