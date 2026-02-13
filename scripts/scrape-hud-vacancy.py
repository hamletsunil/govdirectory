#!/usr/bin/env python3
"""
Scrape Census ACS housing vacancy data for city profiles.

Pulls housing occupancy/vacancy statistics from the U.S. Census Bureau's
American Community Survey (ACS) 5-Year Estimates and integrates them into
city profile JSON files.

Data source: Census Bureau ACS Table B25002 (Occupancy Status) and
B25004 (Vacancy Status).  This is a Tier 1 (Federal) data source --
no API key required.

Usage:
  python3 scripts/scrape-hud-vacancy.py
  python3 scripts/scrape-hud-vacancy.py --dry-run
  python3 scripts/scrape-hud-vacancy.py --city chicago
  python3 scripts/scrape-hud-vacancy.py --year 2022
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CITIES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "cities")
DATA_SOURCE_KEY = "census_vacancy"

# ACS 5-Year variables we pull:
#   B25002_001E  Total housing units
#   B25002_002E  Occupied housing units
#   B25002_003E  Vacant housing units
#   B25004_002E  Vacant - For rent
#   B25004_003E  Vacant - Rented, not occupied
#   B25004_004E  Vacant - For sale only
#   B25004_005E  Vacant - Sold, not occupied
#   B25004_006E  Vacant - For seasonal/recreational/occasional use
#   B25004_007E  Vacant - For migrant workers
#   B25004_008E  Vacant - Other vacant
ACS_VARIABLES = [
    "B25002_001E", "B25002_002E", "B25002_003E",
    "B25004_002E", "B25004_003E", "B25004_004E",
    "B25004_005E", "B25004_006E", "B25004_007E", "B25004_008E",
    "NAME",
]

# Try most recent ACS year first, fall back
ACS_YEARS = [2023, 2022, 2021]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


def fetch_acs_state_places(state_fips: str, year: int) -> Optional[List[List[str]]]:
    """
    Fetch ACS vacancy data for ALL places in a state in one API call.

    Returns list of rows (each row is a list of strings), or None on failure.
    First row is the header.
    """
    variables = ",".join(ACS_VARIABLES)
    url = (
        f"https://api.census.gov/data/{year}/acs/acs5"
        f"?get={variables}&for=place:*&in=state:{state_fips}"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GovDirectory/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status != 200:
                return None
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return None  # No data for this year
        print(f"    HTTP {e.code} for state {state_fips}, year {year}")
        return None
    except Exception as e:
        print(f"    Error fetching state {state_fips}: {e}")
        return None


def build_vacancy_lookup(year: int, state_fips_list: List[str]) -> Dict[str, dict]:
    """
    Build a lookup dict: (state_fips, place_fips) -> vacancy metrics
    by querying Census ACS for each state.
    """
    lookup: Dict[str, dict] = {}

    for state_fips in sorted(set(state_fips_list)):
        rows = None
        actual_year = year

        # Try each year
        for try_year in ACS_YEARS:
            rows = fetch_acs_state_places(state_fips, try_year)
            if rows and len(rows) > 1:
                actual_year = try_year
                break
            time.sleep(0.5)

        if not rows or len(rows) < 2:
            print(f"  State {state_fips}: no ACS data available")
            continue

        header = rows[0]
        print(f"  State {state_fips}: {len(rows)-1} places (ACS {actual_year})")

        # Build column index
        col = {name: i for i, name in enumerate(header)}

        for row in rows[1:]:
            place_fips = row[col.get("place", len(row) - 1)]
            st = row[col.get("state", len(row) - 2)]

            try:
                total = int(row[col["B25002_001E"]])
                occupied = int(row[col["B25002_002E"]])
                vacant = int(row[col["B25002_003E"]])
            except (ValueError, KeyError):
                continue

            if total == 0:
                continue

            metrics: Dict[str, object] = {
                "total_housing_units": total,
                "occupied_housing_units": occupied,
                "vacant_housing_units": vacant,
                "vacancy_rate": round(vacant / total * 100, 2),
                "occupancy_rate": round(occupied / total * 100, 2),
                "data_year": str(actual_year),
                "vacancy_source": "Census ACS 5-Year",
            }

            # Vacancy breakdown (B25004)
            breakdown_fields = {
                "vacant_for_rent": "B25004_002E",
                "vacant_rented_not_occupied": "B25004_003E",
                "vacant_for_sale": "B25004_004E",
                "vacant_sold_not_occupied": "B25004_005E",
                "vacant_seasonal": "B25004_006E",
                "vacant_migrant_workers": "B25004_007E",
                "vacant_other": "B25004_008E",
            }

            for field_name, var_name in breakdown_fields.items():
                if var_name in col:
                    try:
                        val = int(row[col[var_name]])
                        metrics[field_name] = val
                    except (ValueError, IndexError):
                        pass

            key = f"{st}:{place_fips}"
            lookup[key] = metrics

        time.sleep(0.3)  # Be nice to Census API

    return lookup


def update_city_profile(profile: dict, vacancy: dict) -> dict:
    """Update a city profile dict with vacancy data in the housing section."""
    if "housing" not in profile:
        profile["housing"] = {}

    housing = profile["housing"]

    for key, value in vacancy.items():
        housing[key] = value

    # Update data_sources
    if "data_sources" not in profile:
        profile["data_sources"] = {}
    profile["data_sources"][DATA_SOURCE_KEY] = "available"

    return profile


def mark_unavailable(profile: dict) -> dict:
    """Mark Census vacancy data source as unavailable for a city."""
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
        description="Scrape Census ACS housing vacancy data for city profiles"
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
        "--year",
        type=int,
        default=2023,
        help="ACS year to query (default: 2023, falls back to earlier years)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Verbose output"
    )
    args = parser.parse_args()

    cities_dir = os.path.abspath(CITIES_DIR)
    if not os.path.isdir(cities_dir):
        print(f"ERROR: Cities directory not found: {cities_dir}")
        sys.exit(1)

    print("Census ACS Housing Vacancy Scraper")
    print("=" * 50)
    print(f"Cities dir: {cities_dir}")
    print(f"Dry run: {args.dry_run}")
    print(f"Target ACS year: {args.year}")
    if args.city:
        print(f"Single city: {args.city}")
    print()

    # Load profiles
    profiles = load_city_profiles(cities_dir, single_city=args.city)
    print(f"Loaded {len(profiles)} city profiles")

    if not profiles:
        print("No profiles to process.")
        sys.exit(0)

    # Collect all state FIPS codes we need to query
    fips_map: Dict[str, Tuple[str, str]] = {}  # slug -> (state_fips, place_fips)
    state_fips_list: List[str] = []

    for path, profile in profiles:
        slug = os.path.basename(path).replace(".json", "")
        identity = profile.get("identity", {})
        fs = identity.get("fips_state", "")
        fp = identity.get("fips_place", "")
        if fs and fp:
            fips_map[slug] = (str(fs).zfill(2), str(fp).zfill(5))
            state_fips_list.append(str(fs).zfill(2))

    print(f"Cities with FIPS codes: {len(fips_map)}")
    print(f"Unique states to query: {len(set(state_fips_list))}")
    print()

    # Fetch all data from Census in batches by state
    print("Fetching ACS data by state...")
    start_time = time.time()
    lookup = build_vacancy_lookup(args.year, state_fips_list)
    fetch_time = time.time() - start_time
    print(f"\nFetched {len(lookup)} places in {fetch_time:.1f}s")
    print()

    # Match and update profiles
    stats = {
        "total": len(profiles),
        "has_fips": len(fips_map),
        "no_fips": len(profiles) - len(fips_map),
        "matched": 0,
        "unmatched": 0,
        "updated": 0,
        "skipped": 0,
    }

    for path, profile in profiles:
        slug = os.path.basename(path).replace(".json", "")
        identity = profile.get("identity", {})
        name = identity.get("name", slug)
        state = identity.get("state", "??")

        if slug not in fips_map:
            if args.verbose:
                print(f"  {name}, {state}: no FIPS codes, skipping")
            profile = mark_unavailable(profile)
            save_profile(path, profile, args.dry_run)
            stats["skipped"] += 1
            continue

        state_fips, place_fips = fips_map[slug]
        key = f"{state_fips}:{place_fips}"

        if key in lookup:
            vacancy = lookup[key]
            profile = update_city_profile(profile, vacancy)
            save_profile(path, profile, args.dry_run)
            stats["matched"] += 1
            stats["updated"] += 1

            vr = vacancy.get("vacancy_rate", "N/A")
            total = vacancy.get("total_housing_units", "?")
            yr = vacancy.get("data_year", "?")
            if args.verbose:
                print(f"  {name}, {state}: {vr}% vacancy ({total} units, ACS {yr})")
        else:
            if args.verbose:
                print(f"  {name}, {state}: FIPS {state_fips}{place_fips} not in ACS data")
            profile = mark_unavailable(profile)
            save_profile(path, profile, args.dry_run)
            stats["unmatched"] += 1
            stats["skipped"] += 1

    elapsed = time.time() - start_time

    # Summary
    print()
    print("=" * 50)
    print("Census ACS Vacancy Scrape Summary")
    print("=" * 50)
    print(f"Total profiles:     {stats['total']}")
    print(f"With FIPS codes:    {stats['has_fips']}")
    print(f"Without FIPS codes: {stats['no_fips']}")
    print(f"ACS matches:        {stats['matched']}")
    print(f"ACS unmatched:      {stats['unmatched']}")
    print(f"Profiles updated:   {stats['updated']}")
    print(f"Profiles skipped:   {stats['skipped']}")
    print(f"Elapsed time:       {elapsed:.1f}s")
    if args.dry_run:
        print("\n(DRY RUN - no files were modified)")


if __name__ == "__main__":
    main()
