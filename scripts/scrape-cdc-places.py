#!/usr/bin/env python3
"""
Scrape CDC PLACES city-level health data and integrate into govdirectory city profiles.

CDC PLACES provides 36+ health measures for 500+ US cities based on the
Behavioral Risk Factor Surveillance System (BRFSS).

Data source: https://data.cdc.gov/resource/eav7-hnsx.json (SODA API, no auth)
Provenance tier: T1 (federal — CDC/HHS)

Usage:
  python scripts/scrape-cdc-places.py                    # All 290 cities
  python scripts/scrape-cdc-places.py --city chicago      # Single city
  python scripts/scrape-cdc-places.py --dry-run           # Preview without writing
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from collections import OrderedDict
from datetime import datetime

# --- Configuration ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "public", "data", "cities")
CDC_API = "https://data.cdc.gov/resource/eav7-hnsx.json"
REQUEST_DELAY = 0.5  # seconds between API calls
REQUEST_TIMEOUT = 30  # seconds per request

# Measure ID -> our field name mapping
MEASURE_MAP = {
    "ACCESS2":   "uninsured_pct",
    "OBESITY":   "obesity_pct",
    "DIABETES":  "diabetes_pct",
    "DEPRESSION": "depression_pct",
    "CASTHMA":   "asthma_pct",
    "CSMOKING":  "smoking_pct",
    "LPA":       "physical_inactivity_pct",
    "MHLTH":     "mental_health_bad_days",
    "PHLTH":     "physical_health_bad_days",
    "SLEEP":     "sleep_deficit_pct",
    "BPHIGH":    "high_blood_pressure_pct",
    "HIGHCHOL":  "high_cholesterol_pct",
    "CHD":       "heart_disease_pct",
    "STROKE":    "stroke_pct",
    "CANCER":    "cancer_pct",
    "KIDNEY":    "kidney_disease_pct",
    "CHECKUP":   "checkup_pct",
}


def query_cdc_places(city_name: str, state_abbr: str) -> list[dict]:
    """Query CDC PLACES API for a single city. Returns list of measure rows."""
    where_clause = (
        f"locationname='{city_name.replace(chr(39), chr(39)+chr(39))}' AND "
        f"stateabbr='{state_abbr}' AND "
        f"data_value_type='Age-adjusted prevalence'"
    )
    params = urllib.parse.urlencode({
        "$where": where_clause,
        "$limit": "100",
    })
    url = f"{CDC_API}?{params}"

    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} for {city_name}, {state_abbr}: {e.reason}")
        return []
    except urllib.error.URLError as e:
        print(f"  URL error for {city_name}, {state_abbr}: {e.reason}")
        return []
    except Exception as e:
        print(f"  Error querying {city_name}, {state_abbr}: {e}")
        return []


def pivot_measures(rows: list[dict]) -> dict:
    """
    Convert list of CDC PLACES rows into a single health dict.
    Each row has measureid, data_value, year.
    """
    health = {}
    data_year = None

    for row in rows:
        measure_id = row.get("measureid", "")
        field_name = MEASURE_MAP.get(measure_id)
        if not field_name:
            continue

        raw_value = row.get("data_value")
        if raw_value is None:
            continue

        try:
            value = round(float(raw_value), 1)
        except (ValueError, TypeError):
            continue

        health[field_name] = value

        # Track the most recent year across all measures
        row_year = row.get("year")
        if row_year:
            if data_year is None or row_year > data_year:
                data_year = row_year

    if health and data_year:
        health["data_year"] = data_year

    return health


def build_health_section(health_data: dict) -> OrderedDict:
    """Build an ordered health section with all fields (null for missing)."""
    # Canonical field order
    fields = [
        "uninsured_pct",
        "obesity_pct",
        "diabetes_pct",
        "depression_pct",
        "asthma_pct",
        "smoking_pct",
        "physical_inactivity_pct",
        "mental_health_bad_days",
        "physical_health_bad_days",
        "sleep_deficit_pct",
        "high_blood_pressure_pct",
        "high_cholesterol_pct",
        "heart_disease_pct",
        "stroke_pct",
        "cancer_pct",
        "kidney_disease_pct",
        "checkup_pct",
        "data_year",
    ]
    result = OrderedDict()
    for f in fields:
        result[f] = health_data.get(f)
    return result


def insert_key_after(d: dict, after_key: str, new_key: str, new_value) -> OrderedDict:
    """Insert a new key into a dict after a specified key, preserving order."""
    result = OrderedDict()
    inserted = False
    for k, v in d.items():
        result[k] = v
        if k == after_key:
            result[new_key] = new_value
            inserted = True
    if not inserted:
        result[new_key] = new_value
    return result


def update_city_profile(slug: str, health: OrderedDict, dry_run: bool = False) -> bool:
    """Merge health data into an existing city JSON profile."""
    filepath = os.path.join(DATA_DIR, f"{slug}.json")
    if not os.path.exists(filepath):
        print(f"  WARNING: Profile not found: {filepath}")
        return False

    with open(filepath, "r") as f:
        profile = json.load(f, object_pairs_hook=OrderedDict)

    # Insert health section after housing (or after civic_issues if housing absent)
    insert_after = "housing" if "housing" in profile else "environment"
    if "health" in profile:
        # Replace existing health section in-place
        profile["health"] = health
    else:
        profile = insert_key_after(profile, insert_after, "health", health)

    # Update data_sources
    if "data_sources" not in profile:
        profile["data_sources"] = OrderedDict()
    has_data = health.get("data_year") is not None
    profile["data_sources"]["cdc_places"] = "available" if has_data else "unavailable"

    # Update provenance
    if "provenance" not in profile:
        profile["provenance"] = OrderedDict({"last_full_probe": None, "sources": OrderedDict()})
    if "sources" not in profile["provenance"]:
        profile["provenance"]["sources"] = OrderedDict()

    now_iso = datetime.utcnow().isoformat()
    profile["provenance"]["sources"]["cdc_places"] = OrderedDict({
        "authority": "CDC PLACES (Centers for Disease Control and Prevention)",
        "authority_tier": 1,
        "api_url": f"{CDC_API}?locationname={urllib.parse.quote(profile.get('identity', {}).get('name', slug))}",
        "probed_at": now_iso,
        "data_vintage": f"BRFSS {health.get('data_year', 'N/A')}",
        "geographic_level": "place",
        "status": "available" if has_data else "unavailable",
    })

    if dry_run:
        print(f"  [DRY RUN] Would write health data to {filepath}")
        return True

    with open(filepath, "w") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return True


def main():
    parser = argparse.ArgumentParser(description="Scrape CDC PLACES health data for city profiles")
    parser.add_argument("--city", type=str, help="Process a single city by slug (e.g., 'chicago')")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    args = parser.parse_args()

    # Load city index
    index_path = os.path.join(DATA_DIR, "_index.json")
    if not os.path.exists(index_path):
        print(f"ERROR: City index not found at {index_path}")
        sys.exit(1)

    with open(index_path, "r") as f:
        cities = json.load(f)

    print(f"Loaded {len(cities)} cities from index")

    # Filter to single city if requested
    if args.city:
        cities = [c for c in cities if c["slug"] == args.city]
        if not cities:
            print(f"ERROR: City slug '{args.city}' not found in index")
            sys.exit(1)

    # Statistics
    total = len(cities)
    found = 0
    not_found = 0
    errors = 0

    for i, city_entry in enumerate(cities):
        slug = city_entry["slug"]
        name = city_entry["name"]
        state = city_entry["state"]

        print(f"[{i+1}/{total}] {name}, {state} ({slug})...", end=" ", flush=True)

        # Load city profile to get canonical name and state
        profile_path = os.path.join(DATA_DIR, f"{slug}.json")
        if not os.path.exists(profile_path):
            print("SKIP (no profile)")
            not_found += 1
            continue

        with open(profile_path, "r") as f:
            profile = json.load(f)

        city_name = profile.get("identity", {}).get("name", name)
        state_abbr = profile.get("identity", {}).get("state", state)

        # Skip non-city entities (counties, transit agencies, etc.)
        # They won't match CDC PLACES city-level data
        if not state_abbr or len(state_abbr) != 2:
            print("SKIP (no state)")
            not_found += 1
            continue

        # Query CDC PLACES
        rows = query_cdc_places(city_name, state_abbr)

        if rows:
            health_data = pivot_measures(rows)
            health_section = build_health_section(health_data)
            has_measures = any(v is not None for k, v in health_section.items() if k != "data_year")

            if has_measures:
                update_city_profile(slug, health_section, dry_run=args.dry_run)
                measure_count = sum(1 for k, v in health_section.items() if v is not None and k != "data_year")
                print(f"OK ({measure_count} measures, year={health_section.get('data_year', '?')})")
                found += 1
            else:
                # API returned rows but none matched our measure list
                health_section = build_health_section({})
                update_city_profile(slug, health_section, dry_run=args.dry_run)
                print("NO MATCHING MEASURES")
                not_found += 1
        else:
            # No data from API — mark as unavailable
            health_section = build_health_section({})
            update_city_profile(slug, health_section, dry_run=args.dry_run)
            print("NOT IN PLACES")
            not_found += 1

        # Rate limiting
        if i < total - 1:
            time.sleep(REQUEST_DELAY)

    # Summary
    print("\n" + "=" * 60)
    print(f"CDC PLACES Integration Summary")
    print(f"=" * 60)
    print(f"Total cities processed: {total}")
    print(f"Health data found:      {found}")
    print(f"Not in PLACES:          {not_found}")
    print(f"Errors:                 {errors}")
    print(f"Coverage:               {found}/{total} ({100*found/total:.1f}%)")
    if args.dry_run:
        print("\n[DRY RUN] No files were modified.")


if __name__ == "__main__":
    main()
