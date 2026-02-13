#!/usr/bin/env python3
"""
Scrape HUD/USPS Vacancy Data for city profiles.

Pulls quarterly residential and business vacancy rates from the HUD USPS
Vacancy Data API (https://www.huduser.gov/portal/dataset/usps-702.html)
and integrates them into city profile JSON files.

Requirements:
  - HUD_API_TOKEN env var (register free at https://www.huduser.gov/hudapi/public/register)
  - requests library (pip install requests)

Usage:
  HUD_API_TOKEN=your_token python3 scripts/scrape-hud-vacancy.py
  HUD_API_TOKEN=your_token python3 scripts/scrape-hud-vacancy.py --dry-run
  HUD_API_TOKEN=your_token python3 scripts/scrape-hud-vacancy.py --city chicago
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CITIES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "cities")
HUD_API_BASE = "https://www.huduser.gov/hudapi/public/usps"
REQUEST_DELAY = 1.0  # seconds between API calls (HUD rate-limits aggressively)
DATA_SOURCE_KEY = "hud_usps"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_api_token() -> str:
    """Get HUD API token from environment."""
    token = os.environ.get("HUD_API_TOKEN", "").strip()
    if not token:
        print("ERROR: HUD_API_TOKEN environment variable is not set.")
        print("Register for a free token at https://www.huduser.gov/hudapi/public/register")
        sys.exit(1)
    return token


def load_city_profiles(
    cities_dir: str, single_city: Optional[str] = None
) -> List[Tuple[str, dict]]:
    """Load all city profile JSON files (excluding _index.json, _benchmarks.json)."""
    pattern = os.path.join(cities_dir, "*.json")
    profiles: List[Tuple[str, dict]] = []
    for path in sorted(glob.glob(pattern)):
        basename = os.path.basename(path)
        if basename.startswith("_"):
            continue
        if single_city and basename != f"{single_city}.json":
            continue
        try:
            with open(path, "r") as f:
                data = json.load(f)
            profiles.append((path, data))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  WARN: Could not load {basename}: {e}")
    return profiles


def fetch_vacancy_data(
    fips_query: str, token: str, session
) -> Optional[dict]:
    """
    Fetch vacancy data from HUD USPS API for a FIPS place code.

    Args:
        fips_query: Concatenated FIPS state + place code (e.g. "1304000" for Atlanta, GA)
        token: HUD API Bearer token
        session: requests.Session for connection reuse

    Returns:
        Dict with the most recent quarter's data, or None on failure.
    """
    url = f"{HUD_API_BASE}?type=2&query={fips_query}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = session.get(url, headers=headers, timeout=30)
    except Exception as e:
        print(f"    Network error: {e}")
        return None

    if resp.status_code == 401:
        print("    ERROR: 401 Unauthorized - check your HUD_API_TOKEN")
        return None
    if resp.status_code == 404:
        print("    No data found (404)")
        return None
    if resp.status_code == 429:
        print("    Rate limited (429) - waiting 10s and retrying...")
        time.sleep(10)
        try:
            resp = session.get(url, headers=headers, timeout=30)
        except Exception as e:
            print(f"    Retry network error: {e}")
            return None
        if resp.status_code != 200:
            print(f"    Retry failed with status {resp.status_code}")
            return None
    if resp.status_code != 200:
        print(f"    API returned status {resp.status_code}: {resp.text[:200]}")
        return None

    try:
        payload = resp.json()
    except json.JSONDecodeError:
        print(f"    Invalid JSON response: {resp.text[:200]}")
        return None

    # The API returns a list of quarterly records, or a dict with a "data" key
    records = None
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        # Could be {"data": [...]} or an error dict
        if "data" in payload:
            records = payload["data"]
        elif "error" in payload:
            print(f"    API error: {payload['error']}")
            return None
        else:
            # Maybe the dict itself is a single record
            records = [payload]

    if not records:
        print("    Empty response from API")
        return None

    # Find the most recent quarter
    # Records have YEAR and QTR fields
    def sort_key(r):
        try:
            return (int(r.get("YEAR", 0)), int(r.get("QTR", 0)))
        except (ValueError, TypeError):
            return (0, 0)

    records_sorted = sorted(records, key=sort_key, reverse=True)
    return records_sorted[0]


def extract_vacancy_metrics(record: dict) -> Optional[dict]:
    """
    Extract and calculate vacancy metrics from a HUD USPS record.

    Returns dict with calculated fields, or None if data is insufficient.
    """
    try:
        res_vac = float(record.get("RES_VAC", 0))
        res_occ = float(record.get("RES_OCC", 0))
        bus_vac = float(record.get("BUS_VAC", 0))
        bus_occ = float(record.get("BUS_OCC", 0))
        year = record.get("YEAR", "")
        qtr = record.get("QTR", "")
    except (ValueError, TypeError) as e:
        print(f"    Could not parse numeric fields: {e}")
        return None

    res_total = res_vac + res_occ
    bus_total = bus_vac + bus_occ

    if res_total == 0 and bus_total == 0:
        print("    All vacancy counts are zero - no meaningful data")
        return None

    result: Dict[str, object] = {
        "residential_vacant": int(res_vac),
        "residential_occupied": int(res_occ),
        "vacancy_source": "HUD/USPS",
    }

    if res_total > 0:
        result["residential_vacancy_rate"] = round(res_vac / res_total * 100, 2)
    else:
        result["residential_vacancy_rate"] = None

    if bus_total > 0:
        result["business_vacancy_rate"] = round(bus_vac / bus_total * 100, 2)
    else:
        result["business_vacancy_rate"] = None

    result["business_vacant"] = int(bus_vac)
    result["business_occupied"] = int(bus_occ)

    if year and qtr:
        result["vacancy_quarter"] = f"{year}-Q{qtr}"

    # Include no-stat counts if present
    no_stat_res = record.get("NO_STAT_RES")
    no_stat_bus = record.get("NO_STAT_BUS")
    if no_stat_res is not None:
        try:
            result["no_stat_residential"] = int(float(no_stat_res))
        except (ValueError, TypeError):
            pass
    if no_stat_bus is not None:
        try:
            result["no_stat_business"] = int(float(no_stat_bus))
        except (ValueError, TypeError):
            pass

    return result


def update_city_profile(profile: dict, vacancy: dict) -> dict:
    """
    Update a city profile dict with vacancy data in the housing section.
    Preserves existing housing fields.
    """
    if "housing" not in profile:
        profile["housing"] = {}

    housing = profile["housing"]

    # Add/update vacancy fields
    for key in [
        "residential_vacancy_rate",
        "business_vacancy_rate",
        "residential_occupied",
        "residential_vacant",
        "business_occupied",
        "business_vacant",
        "vacancy_quarter",
        "vacancy_source",
        "no_stat_residential",
        "no_stat_business",
    ]:
        if key in vacancy:
            housing[key] = vacancy[key]

    # Update data_sources
    if "data_sources" not in profile:
        profile["data_sources"] = {}
    profile["data_sources"][DATA_SOURCE_KEY] = "available"

    return profile


def mark_unavailable(profile: dict) -> dict:
    """Mark HUD USPS data source as unavailable for a city."""
    if "data_sources" not in profile:
        profile["data_sources"] = {}
    profile["data_sources"][DATA_SOURCE_KEY] = "unavailable"
    return profile


def save_profile(path: str, profile: dict, dry_run: bool = False):
    """Save a city profile to disk."""
    if dry_run:
        return
    with open(path, "w") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Scrape HUD/USPS vacancy data for city profiles"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing files",
    )
    parser.add_argument(
        "--city",
        type=str,
        help="Process a single city (slug, e.g. 'chicago')",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY,
        help="Delay between API requests in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Verbose output"
    )
    args = parser.parse_args()

    # Resolve cities dir
    cities_dir = os.path.abspath(CITIES_DIR)
    if not os.path.isdir(cities_dir):
        print(f"ERROR: Cities directory not found: {cities_dir}")
        sys.exit(1)

    token = get_api_token()

    print("HUD/USPS Vacancy Data Scraper")
    print("=" * 50)
    print(f"Cities dir: {cities_dir}")
    print(f"Dry run: {args.dry_run}")
    print(f"Delay: {args.delay}s")
    if args.city:
        print(f"Single city: {args.city}")
    print()

    # Load profiles
    profiles = load_city_profiles(cities_dir, single_city=args.city)
    print(f"Loaded {len(profiles)} city profiles")

    if not profiles:
        print("No profiles to process.")
        sys.exit(0)

    # Import requests here so --help works without it
    try:
        import requests  # noqa: F811
    except ImportError:
        print(
            "ERROR: 'requests' library is required. Install with: pip install requests"
        )
        sys.exit(1)

    session = requests.Session()

    # Stats
    stats = {
        "total": len(profiles),
        "has_fips": 0,
        "no_fips": 0,
        "api_success": 0,
        "api_failure": 0,
        "updated": 0,
        "skipped": 0,
        "auth_error": False,
    }

    start_time = time.time()

    for i, (path, profile) in enumerate(profiles):
        slug = os.path.basename(path).replace(".json", "")
        identity = profile.get("identity", {})
        name = identity.get("name", slug)
        state = identity.get("state", "??")
        fips_state = identity.get("fips_state", "")
        fips_place = identity.get("fips_place", "")

        print(f"[{i+1}/{len(profiles)}] {name}, {state} ({slug})")

        if not fips_state or not fips_place:
            print("  -> No FIPS codes, marking unavailable")
            profile = mark_unavailable(profile)
            save_profile(path, profile, args.dry_run)
            stats["no_fips"] += 1
            stats["skipped"] += 1
            continue

        stats["has_fips"] += 1
        fips_query = f"{fips_state}{fips_place}"
        print(f"  FIPS query: {fips_query}")

        # Fetch from API
        record = fetch_vacancy_data(fips_query, token, session)

        if record is None:
            print("  -> No data returned, marking unavailable")
            profile = mark_unavailable(profile)
            save_profile(path, profile, args.dry_run)
            stats["api_failure"] += 1
            stats["skipped"] += 1
            time.sleep(args.delay)
            continue

        # Check if this was an auth error hidden in the response
        if isinstance(record, dict) and "error" in record:
            err = record["error"]
            if "Unauthenticated" in str(err) or "Unauthorized" in str(err):
                print(f"  -> AUTH ERROR: {err}")
                print("  Stopping - please check your HUD_API_TOKEN")
                stats["auth_error"] = True
                break

        stats["api_success"] += 1

        # Extract metrics
        vacancy = extract_vacancy_metrics(record)
        if vacancy is None:
            print("  -> Could not extract metrics, marking unavailable")
            profile = mark_unavailable(profile)
            save_profile(path, profile, args.dry_run)
            stats["skipped"] += 1
            time.sleep(args.delay)
            continue

        # Update profile
        profile = update_city_profile(profile, vacancy)
        save_profile(path, profile, args.dry_run)
        stats["updated"] += 1

        res_rate = vacancy.get("residential_vacancy_rate", "N/A")
        bus_rate = vacancy.get("business_vacancy_rate", "N/A")
        quarter = vacancy.get("vacancy_quarter", "?")
        print(f"  -> {quarter}: res_vacancy={res_rate}%, bus_vacancy={bus_rate}%")

        if args.verbose:
            print(
                f"     res_occ={vacancy.get('residential_occupied')}, "
                f"res_vac={vacancy.get('residential_vacant')}"
            )
            print(
                f"     bus_occ={vacancy.get('business_occupied')}, "
                f"bus_vac={vacancy.get('business_vacant')}"
            )

        # Rate limit
        if i < len(profiles) - 1:
            time.sleep(args.delay)

    elapsed = time.time() - start_time

    # Summary
    print()
    print("=" * 50)
    print("HUD/USPS Vacancy Scrape Summary")
    print("=" * 50)
    print(f"Total profiles:     {stats['total']}")
    print(f"With FIPS codes:    {stats['has_fips']}")
    print(f"Without FIPS codes: {stats['no_fips']}")
    print(f"API successes:      {stats['api_success']}")
    print(f"API failures:       {stats['api_failure']}")
    print(f"Profiles updated:   {stats['updated']}")
    print(f"Profiles skipped:   {stats['skipped']}")
    print(f"Elapsed time:       {elapsed:.1f}s")
    if args.dry_run:
        print("\n(DRY RUN - no files were modified)")
    if stats["auth_error"]:
        print("\nWARNING: Stopped early due to authentication error.")
        print("Register for a free HUD API token at:")
        print("  https://www.huduser.gov/hudapi/public/register")
        sys.exit(1)


if __name__ == "__main__":
    main()
