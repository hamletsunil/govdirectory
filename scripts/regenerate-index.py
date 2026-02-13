#!/usr/bin/env python3
"""
Regenerate _index.json and _benchmarks.json from city profile JSON files.

This is a pure-Python replacement for sync-city-data.ts that works in CI
without needing the simcity-inventory repo or Node.js.

Usage:
  python scripts/regenerate-index.py
"""

import json
import math
import os
import glob
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "public", "data", "cities")


def percentile(sorted_values, p):
    """Compute the p-th percentile of a sorted list (linear interpolation)."""
    n = len(sorted_values)
    if n == 0:
        return 0
    idx = (p / 100.0) * (n - 1)
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return sorted_values[lo]
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (idx - lo)


def main():
    if not os.path.isdir(DATA_DIR):
        print(f"ERROR: Data directory not found: {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    # Find all city JSON files (exclude _index.json, _benchmarks.json, etc.)
    files = sorted([
        f for f in glob.glob(os.path.join(DATA_DIR, "*.json"))
        if not os.path.basename(f).startswith("_")
    ])

    if not files:
        print("ERROR: No city JSON files found.", file=sys.stderr)
        sys.exit(1)

    index = []

    # Benchmark metric collectors -- mirrors sync-city-data.ts
    collectors = {
        "median_household_income": [],
        "median_home_value": [],
        "unemployment_rate": [],
        "poverty_rate": [],
        "homeownership_rate": [],
        "rent_to_income_ratio": [],
        "home_value_to_income_ratio": [],
        "violent_crime_rate": [],
        "property_crime_rate": [],
        "avg_school_rating": [],
        "median_rent": [],
        "cost_burdened_pct": [],
        "rent_burden_ratio": [],
        "pm25_mean": [],
        "population": [],
    }

    def push(key, val):
        """Add a numeric value to its collector if valid."""
        if val is not None and isinstance(val, (int, float)) and math.isfinite(val):
            collectors[key].append(val)

    for filepath in files:
        try:
            with open(filepath) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        slug = os.path.basename(filepath).replace(".json", "")
        identity = data.get("identity", {})
        data_sources = data.get("data_sources", {})

        # sourceCount = number of data sources with status "available"
        source_count = sum(1 for v in data_sources.values() if v == "available")

        population = identity.get("population")

        index.append({
            "slug": slug,
            "name": identity.get("name", slug),
            "state": identity.get("state", ""),
            "population": population,
            "sourceCount": source_count,
        })

        # Collect benchmark values
        economy = data.get("economy", {})
        safety = data.get("safety", {})
        education = data.get("education", {})
        housing = data.get("housing", {})
        environment = data.get("environment", {})

        push("population", population)
        push("median_household_income", economy.get("median_household_income"))
        push("median_home_value", economy.get("median_home_value"))
        push("unemployment_rate", economy.get("unemployment_rate"))
        push("poverty_rate", economy.get("poverty_rate"))
        push("homeownership_rate", economy.get("homeownership_rate"))
        push("rent_to_income_ratio", economy.get("rent_to_income_ratio"))
        push("home_value_to_income_ratio", economy.get("home_value_to_income_ratio"))
        push("violent_crime_rate", safety.get("violent_crime_rate"))
        push("property_crime_rate", safety.get("property_crime_rate"))
        push("avg_school_rating", education.get("avg_school_rating"))
        push("median_rent", housing.get("median_rent"))
        push("cost_burdened_pct", housing.get("cost_burdened_pct"))
        push("rent_burden_ratio", housing.get("rent_burden_ratio"))
        push("pm25_mean", environment.get("pm25_mean"))

    # Sort by population descending, nulls at end
    def sort_key(entry):
        pop = entry["population"]
        if pop is None:
            return (1, entry["name"])  # nulls sort last
        return (0, -pop)

    index.sort(key=sort_key)

    # Write _index.json (minified for production)
    index_path = os.path.join(DATA_DIR, "_index.json")
    with open(index_path, "w") as f:
        json.dump(index, f, separators=(",", ":"))

    print(f"Generated _index.json with {len(index)} entries")

    # Compute benchmarks (same logic as sync-city-data.ts)
    benchmarks = {}
    for key, values in collectors.items():
        if len(values) < 5:
            continue
        sorted_vals = sorted(values)
        benchmarks[key] = {
            "median": round(percentile(sorted_vals, 50), 2),
            "p25": round(percentile(sorted_vals, 25), 2),
            "p75": round(percentile(sorted_vals, 75), 2),
            "min": round(min(sorted_vals), 2),
            "max": round(max(sorted_vals), 2),
            "count": len(sorted_vals),
        }

    # Write _benchmarks.json (pretty-printed for readability)
    benchmarks_path = os.path.join(DATA_DIR, "_benchmarks.json")
    with open(benchmarks_path, "w") as f:
        json.dump(benchmarks, f, indent=2)

    print(f"Generated _benchmarks.json with {len(benchmarks)} metrics")


if __name__ == "__main__":
    main()
