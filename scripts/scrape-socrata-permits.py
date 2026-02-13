#!/usr/bin/env python3
"""
Scrape building permit data from Socrata open data portals for all govdirectory cities.

For each city with a known or discoverable Socrata portal, this script:
  1. Uses the Socrata Discovery API to find permit-related datasets
  2. Queries the SODA API for permit counts, types, values, and trends
  3. Updates the city JSON profile with development/permit data

Usage:
  python scripts/scrape-socrata-permits.py                    # All known Socrata cities
  python scripts/scrape-socrata-permits.py --city chicago     # Single city
  python scripts/scrape-socrata-permits.py --dry-run          # Preview without writing
  python scripts/scrape-socrata-permits.py --discover-only    # Only discover datasets
  python scripts/scrape-socrata-permits.py --all-cities       # Try ALL 290 cities

Environment:
  SOCRATA_APP_TOKEN  - Optional. Increases rate limit from 1K to 10K req/hr.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data", "cities")
PORTALS_FILE = os.path.join(PROJECT_ROOT, "docs", "open-data-portals.json")

SOCRATA_APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN", "")
REQUEST_DELAY = 0.5  # seconds between API calls

DISCOVERY_API = "https://api.us.socrata.com/api/catalog/v1"

# Date columns (priority order: more specific first)
DATE_COLUMNS = [
    "issue_date", "issued_date", "issueddate", "permit_issued_date",
    "date_issued", "permit_date", "permit_issue_date", "permit_issued",
    "issuance_date", "permit_issuance_date",
    "application_date", "applicationdate", "applieddate",
    "filing_date", "filed_date", "approved_date", "processingdate",
    "reportdate", "date", "issued",
]

# Type columns (priority order: specific first, avoid free-text 'description')
TYPE_COLUMNS = [
    "permit_type", "permittype", "permit_type_definition",
    "permit_type_description", "permit_type_name",
    "permittypemapped", "permittypedesc",
    "permitclassmapped", "permitclass", "permit_class",
    "worktype", "work_type", "workclass", "type_of_work",
    "permit_category", "permit_subtype", "permit_kind",
    "classification", "record_type", "job_type",
    "application_type", "application_subtype",
    "category", "type",
]

# Value/cost columns
VALUE_COLUMNS = [
    "reported_cost", "estimated_cost", "estprojectcost",
    "revised_cost", "construction_cost",
    "estimated_project_cost", "est_project_cost",
    "project_value", "job_value", "total_construction_cost",
    "total_project_cost", "valuation", "permit_value",
    "total_cost", "amount", "total_fee", "subtotal_paid",
]

# Column names that signal a permit dataset
PERMIT_SIGNAL_COLUMNS = [
    "permit_", "permit_number", "permit_type", "permit_no",
    "permitnumber", "permit_id", "permittype", "permitnum",
]

# Search queries for Discovery API (tried in order until results found)
DISCOVERY_QUERIES = [
    "building permit",
    "permits",
    "construction permit",
    "building",
]

# Known dataset overrides -- when Discovery API picks the wrong dataset
# city_slug -> { domain, dataset_id, name }
KNOWN_DATASETS = {
    "kansascity": {
        "domain": "data.kcmo.org",
        "dataset_id": "ntw8-aacc",
        "name": "Permits - CPD Dataset",
    },
}

# -------------------------------------------------------------------
# HTTP helpers
# -------------------------------------------------------------------

def _headers():
    h = {"Accept": "application/json", "User-Agent": "govdirectory-permit-scraper/1.0"}
    if SOCRATA_APP_TOKEN:
        h["X-App-Token"] = SOCRATA_APP_TOKEN
    return h


def api_get(url, params=None, timeout=30):
    """GET request returning parsed JSON, or None on error."""
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    RATE LIMITED. Sleeping 10s...")
            time.sleep(10)
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception:
                return None
        elif e.code in (400, 403, 404):
            return None
        else:
            print(f"    HTTP {e.code}")
            return None
    except Exception as e:
        print(f"    Error: {e}")
        return None


def throttle():
    time.sleep(REQUEST_DELAY)


# -------------------------------------------------------------------
# Socrata domain resolution
# -------------------------------------------------------------------

def load_known_portals():
    """Load Socrata portals from open-data-portals.json."""
    mapping = {}
    if not os.path.exists(PORTALS_FILE):
        return mapping
    with open(PORTALS_FILE) as f:
        data = json.load(f)
    for portal in data.get("portals", []):
        if portal.get("platform") != "socrata":
            continue
        slug = portal.get("city_slug")
        domain = portal.get("domain")
        if slug and domain:
            mapping[slug] = domain
    return mapping


EXTRA_DOMAIN_MAP = {
    "boston": "data.boston.gov",
    "sfgov": "data.sfgov.org",
    "corona": "corstat.coronaca.gov",
}


def guess_domains(slug, city_name):
    name_lower = city_name.lower().replace(" ", "").replace(".", "")
    candidates = []
    if slug in EXTRA_DOMAIN_MAP:
        candidates.append(EXTRA_DOMAIN_MAP[slug])
    candidates.extend([
        f"data.{name_lower}.gov",
        f"data.cityof{name_lower}.org",
        f"data.cityof{name_lower}.gov",
        f"data.{name_lower}.org",
        f"{name_lower}.data.socrata.com",
        f"data.{slug}.gov",
        f"data.{slug}.org",
    ])
    return candidates


def discover_datasets(domain, query="building permit"):
    """Use the Socrata Discovery API to find permit datasets on a domain."""
    params = {
        "q": query,
        "domains": domain,
        "limit": 10,
        "search_context": domain,
    }
    result = api_get(DISCOVERY_API, params)
    throttle()
    if not result:
        return []

    datasets = []
    seen_ids = set()
    for item in result.get("results", []):
        resource = item.get("resource", {})
        ds_id = resource.get("id")
        if not ds_id or ds_id in seen_ids:
            continue
        seen_ids.add(ds_id)

        name = resource.get("name", "")
        description = resource.get("description", "")
        columns = [c.lower() for c in resource.get("columns_field_name", [])]
        updated_at = resource.get("updatedAt", "")

        name_lower = name.lower()
        is_permit = any(kw in name_lower for kw in [
            "permit", "building", "construction", "development review"
        ])
        has_permit_col = any(
            any(sig in col for sig in PERMIT_SIGNAL_COLUMNS)
            for col in columns
        )

        if is_permit or has_permit_col:
            datasets.append({
                "id": ds_id,
                "name": name,
                "domain": domain,
                "columns": columns,
                "description": description[:200],
                "updated_at": updated_at,
            })

    return datasets


def discover_all(domain):
    """Try multiple search queries to find permit datasets."""
    all_datasets = []
    seen_ids = set()
    for query in DISCOVERY_QUERIES:
        datasets = discover_datasets(domain, query=query)
        for ds in datasets:
            if ds["id"] not in seen_ids:
                seen_ids.add(ds["id"])
                all_datasets.append(ds)
        if all_datasets:
            break
    return all_datasets


def find_column(available_columns, candidates):
    avail_lower = set(c.lower() for c in available_columns)
    for candidate in candidates:
        if candidate.lower() in avail_lower:
            return candidate
    return None


def pick_best_dataset(datasets):
    """Score and pick the best permit dataset."""
    if not datasets:
        return None

    scored = []
    for ds in datasets:
        score = 0
        name_lower = ds["name"].lower()
        columns = ds["columns"]

        if "building permit" in name_lower:
            score += 10
        if "retired" in name_lower or "change notice" in name_lower:
            score -= 20
        if "dashboard" in name_lower:
            score -= 5

        has_date = any(
            c in [d.lower() for d in DATE_COLUMNS] for c in columns
        )
        if has_date:
            score += 5
        elif any("date" in c for c in columns):
            score += 3

        has_type = any(
            c in [t.lower() for t in TYPE_COLUMNS] for c in columns
        )
        if has_type:
            score += 3

        updated = ds.get("updated_at", "")
        if updated >= "2026-":
            score += 6
        elif updated >= "2025-":
            score += 4
        elif updated >= "2024-":
            score += 2

        if len(columns) > 10:
            score += 2

        # Penalize narrow date ranges in name (unless "present" is mentioned)
        for y in range(2010, 2025):
            if str(y) in name_lower and "present" not in name_lower:
                score -= 10
                break

        scored.append((score, ds))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def get_columns_from_api(domain, dataset_id):
    """Fetch column names by reading one row from the dataset."""
    url = f"https://{domain}/resource/{dataset_id}.json"
    data = api_get(url, {"$limit": "1"})
    throttle()
    if data and len(data) > 0:
        return [k.lower() for k in data[0].keys()]
    return []


# -------------------------------------------------------------------
# SODA API queries
# -------------------------------------------------------------------

def query_permit_count(domain, dataset_id, date_col, start_date):
    url = f"https://{domain}/resource/{dataset_id}.json"
    where = f"{date_col} > '{start_date}'"
    params = {"$select": "count(*) as cnt", "$where": where}
    data = api_get(url, params)
    throttle()
    if data and len(data) > 0:
        try:
            return int(float(data[0].get("cnt", 0)))
        except (ValueError, TypeError):
            return 0
    return 0


def query_permit_types(domain, dataset_id, date_col, type_col, start_date, limit=15):
    url = f"https://{domain}/resource/{dataset_id}.json"
    where = f"{date_col} > '{start_date}'"
    params = {
        "$select": f"{type_col}, count(*) as cnt",
        "$where": where,
        "$group": type_col,
        "$order": "cnt DESC",
        "$limit": str(limit),
    }
    data = api_get(url, params)
    throttle()
    if not data:
        return {}
    result = {}
    for row in data:
        ptype = row.get(type_col)
        if ptype and str(ptype).strip():
            try:
                result[str(ptype).strip()] = int(float(row.get("cnt", 0)))
            except (ValueError, TypeError):
                pass
    return result


def query_avg_value(domain, dataset_id, date_col, value_col, start_date):
    url = f"https://{domain}/resource/{dataset_id}.json"
    where = f"{date_col} > '{start_date}'"
    params = {"$select": f"avg({value_col}) as avg_val", "$where": where}
    data = api_get(url, params)
    throttle()
    if data and len(data) > 0:
        try:
            val = float(data[0].get("avg_val", 0))
            return round(val, 2) if val > 0 else None
        except (ValueError, TypeError):
            return None
    return None


def query_total_count_between(domain, dataset_id, date_col, start_date, end_date):
    url = f"https://{domain}/resource/{dataset_id}.json"
    where = f"{date_col} >= '{start_date}' AND {date_col} < '{end_date}'"
    params = {"$select": "count(*) as cnt", "$where": where}
    data = api_get(url, params)
    throttle()
    if data and len(data) > 0:
        try:
            return int(float(data[0].get("cnt", 0)))
        except (ValueError, TypeError):
            return 0
    return 0


def detect_date_column(columns):
    date_col = find_column(columns, DATE_COLUMNS)
    if date_col:
        return date_col
    for col in columns:
        if "date" in col.lower():
            return col
    return None


# -------------------------------------------------------------------
# Per-city processing
# -------------------------------------------------------------------

def process_city(slug, city_name, domain, dry_run=False, discover_only=False):
    print(f"\n{'='*60}")
    print(f"Processing: {city_name} ({slug}) -> {domain}")
    print(f"{'='*60}")

    # Check for known dataset override
    override = KNOWN_DATASETS.get(slug)
    if override:
        domain = override["domain"]
        ds_id = override["dataset_id"]
        ds_name = override["name"]
        print(f"  Using known dataset override: {ds_id} ({ds_name})")

        # Fetch columns from API since overrides don't go through Discovery
        columns = get_columns_from_api(domain, ds_id)
        if not columns:
            print(f"  WARNING: Could not fetch columns for override dataset")
            return None
        print(f"  Columns ({len(columns)}): {', '.join(columns[:20])}")

        datasets = [{"id": ds_id, "name": ds_name, "domain": domain, "columns": columns}]
        best_dataset = datasets[0]
    else:
        # Step 1: Discover datasets
        datasets = discover_all(domain)

        if not datasets:
            print(f"  No permit datasets found on {domain}")
            return None

        print(f"  Found {len(datasets)} permit dataset(s):")
        for ds in datasets:
            upd = ds.get("updated_at", "")[:10]
            print(f"    - {ds['id']}: {ds['name']} (updated {upd})")

        if discover_only:
            return {"datasets": datasets}

        # Step 2: Pick best dataset
        best_dataset = pick_best_dataset(datasets)
        if not best_dataset:
            print(f"  No suitable dataset found")
            return None

        ds_id = best_dataset["id"]
        columns = best_dataset["columns"]

        # If discovery returned 0 columns, fetch from API
        if not columns:
            columns = get_columns_from_api(domain, ds_id)
            best_dataset["columns"] = columns

    print(f"  Using dataset: {ds_id} ({best_dataset['name']})")
    print(f"  Columns ({len(columns)}): {', '.join(columns[:20])}")

    # Step 3: Detect key columns
    date_col = detect_date_column(columns)
    type_col = find_column(columns, TYPE_COLUMNS)
    value_col = find_column(columns, VALUE_COLUMNS)

    print(f"  Date column: {date_col}")
    print(f"  Type column: {type_col}")
    print(f"  Value column: {value_col}")

    if not date_col:
        print(f"  WARNING: No date column found. Skipping.")
        return None

    # Step 4: Date ranges
    now = datetime.now()
    twelve_months_ago = (now - timedelta(days=365)).strftime("%Y-%m-%dT00:00:00")
    twenty_four_months_ago = (now - timedelta(days=730)).strftime("%Y-%m-%dT00:00:00")

    # Step 5: Permit count
    print(f"  Querying permit count (since {twelve_months_ago[:10]})...")
    permits_12mo = query_permit_count(domain, ds_id, date_col, twelve_months_ago)
    print(f"  -> Permits (12mo): {permits_12mo:,}")

    if permits_12mo == 0:
        print(f"  Trying alternate date columns...")
        for alt_date in DATE_COLUMNS:
            if alt_date != date_col and alt_date in [c.lower() for c in columns]:
                test_count = query_permit_count(domain, ds_id, alt_date, twelve_months_ago)
                if test_count > 0:
                    print(f"  Switched to '{alt_date}' ({test_count:,} permits)")
                    date_col = alt_date
                    permits_12mo = test_count
                    break

    if permits_12mo == 0 and not override:
        print(f"  Trying alternate datasets...")
        for ds in datasets:
            if ds["id"] == ds_id:
                continue
            alt_cols = ds["columns"]
            if not alt_cols:
                alt_cols = get_columns_from_api(domain, ds["id"])
            alt_date = detect_date_column(alt_cols)
            if not alt_date:
                continue
            alt_count = query_permit_count(domain, ds["id"], alt_date, twelve_months_ago)
            if alt_count > 0:
                print(f"  Switched to '{ds['id']}' ({ds['name']}) -> {alt_count:,}")
                ds_id = ds["id"]
                columns = alt_cols
                date_col = alt_date
                permits_12mo = alt_count
                type_col = find_column(columns, TYPE_COLUMNS)
                value_col = find_column(columns, VALUE_COLUMNS)
                best_dataset = ds
                break

    # Step 6: Permit types
    permit_types = {}
    if type_col and permits_12mo > 0:
        print(f"  Querying permit types ('{type_col}')...")
        permit_types = query_permit_types(
            domain, ds_id, date_col, type_col, twelve_months_ago
        )
        # Validate: if looks like free text or numeric codes, try alternates
        if permit_types:
            total = sum(permit_types.values())
            top_val = max(permit_types.values()) if permit_types else 0
            # Check for numeric-only keys (like SF '8', '3', '4')
            all_numeric = all(k.isdigit() for k in permit_types.keys())
            is_free_text = total > 0 and (top_val / total) < 0.02 and len(permit_types) > 10

            if all_numeric or is_free_text:
                reason = "numeric codes" if all_numeric else "free text"
                print(f"  '{type_col}' looks like {reason}. Trying alternates...")
                for alt_type in TYPE_COLUMNS:
                    if alt_type != type_col and alt_type in [c.lower() for c in columns]:
                        alt_types = query_permit_types(
                            domain, ds_id, date_col, alt_type, twelve_months_ago
                        )
                        if alt_types:
                            alt_all_numeric = all(k.isdigit() for k in alt_types.keys())
                            if not alt_all_numeric:
                                alt_total = sum(alt_types.values())
                                alt_top = max(alt_types.values())
                                if alt_total > 0 and (alt_top / alt_total) >= 0.01:
                                    print(f"  Switched to type column '{alt_type}'")
                                    type_col = alt_type
                                    permit_types = alt_types
                                    break
        if permit_types:
            print(f"  -> Top types: {dict(list(permit_types.items())[:5])}")

    # Step 7: Average value
    avg_value = None
    if value_col and permits_12mo > 0:
        print(f"  Querying average value ('{value_col}')...")
        avg_value = query_avg_value(domain, ds_id, date_col, value_col, twelve_months_ago)
        if avg_value:
            print(f"  -> Avg value: ${avg_value:,.2f}")

    # Step 8: YoY trend
    yoy_pct = None
    if permits_12mo > 0:
        print(f"  Calculating YoY trend...")
        prior_12mo = query_total_count_between(
            domain, ds_id, date_col, twenty_four_months_ago, twelve_months_ago
        )
        if prior_12mo > 0:
            yoy_pct = round(((permits_12mo - prior_12mo) / prior_12mo) * 100, 1)
            print(f"  -> Prior 12mo: {prior_12mo:,}, YoY: {yoy_pct:+.1f}%")
        else:
            print(f"  -> No prior-year data for trend")

    result = {
        "permits_12mo": permits_12mo,
        "yoy_trend_pct": yoy_pct,
        "avg_permit_value": avg_value,
        "permit_types": permit_types,
        "datasets_count": len(datasets),
        "dataset_id": ds_id,
        "dataset_name": best_dataset["name"],
        "domain": domain,
        "date_column": date_col,
    }

    if not dry_run and permits_12mo > 0:
        update_city_profile(slug, result)

    return result


def update_city_profile(slug, result):
    filepath = os.path.join(DATA_DIR, f"{slug}.json")
    if not os.path.exists(filepath):
        print(f"  WARNING: Profile not found: {filepath}")
        return

    with open(filepath) as f:
        profile = json.load(f)

    dev = profile.get("development", {})
    dev["permits_12mo"] = result["permits_12mo"]
    dev["yoy_trend_pct"] = result["yoy_trend_pct"]
    dev["avg_permit_value"] = result["avg_permit_value"]
    dev["permit_types"] = result["permit_types"]
    dev["datasets_count"] = result["datasets_count"]

    population = profile.get("identity", {}).get("population", 0)
    if population and result["permits_12mo"]:
        dev["permits_per_capita_1k"] = round(
            (result["permits_12mo"] / population) * 1000, 2
        )

    profile["development"] = dev

    ds = profile.get("data_sources", {})
    ds["permits"] = "available"
    profile["data_sources"] = ds

    prov = profile.get("provenance", {})
    sources = prov.get("sources", {})
    sources["permits"] = {
        "authority": "City Open Data Portals (Socrata)",
        "authority_tier": 1,
        "api_url": f"https://{result['domain']}/resource/{result['dataset_id']}.json",
        "probed_at": datetime.now().isoformat(),
        "data_vintage": f"Rolling 12-month window ending {datetime.now().strftime('%Y-%m-%d')}",
        "geographic_level": "place",
        "status": "available",
        "dataset_name": result["dataset_name"],
        "date_column_used": result["date_column"],
    }
    prov["sources"] = sources
    profile["provenance"] = prov

    with open(filepath, "w") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"  UPDATED: {filepath}")


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scrape Socrata building permit data")
    parser.add_argument("--city", type=str, help="Process a single city slug")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--discover-only", action="store_true",
                        help="Only discover datasets")
    parser.add_argument("--all-cities", action="store_true",
                        help="Try to discover portals for ALL cities (slow)")
    args = parser.parse_args()

    index_path = os.path.join(DATA_DIR, "_index.json")
    with open(index_path) as f:
        city_index = json.load(f)
    print(f"Loaded {len(city_index)} cities from index")

    known_portals = load_known_portals()
    print(f"Known Socrata portals: {len(known_portals)}")

    for slug, domain in EXTRA_DOMAIN_MAP.items():
        if slug not in known_portals:
            known_portals[slug] = domain

    cities_to_process = []
    for entry in city_index:
        slug = entry["slug"]
        name = entry["name"]
        if args.city and slug != args.city:
            continue
        domain = known_portals.get(slug)
        if domain:
            cities_to_process.append((slug, name, domain))
        elif args.all_cities:
            candidates = guess_domains(slug, name)
            cities_to_process.append((slug, name, candidates))

    if args.city and not cities_to_process:
        for entry in city_index:
            if entry["slug"] == args.city:
                candidates = guess_domains(entry["slug"], entry["name"])
                if args.city in known_portals:
                    candidates = [known_portals[args.city]]
                cities_to_process.append((entry["slug"], entry["name"], candidates))
                break

    print(f"\nCities to process: {len(cities_to_process)}")

    results = {}
    success_count = 0
    fail_count = 0

    for slug, name, domain_or_candidates in cities_to_process:
        if isinstance(domain_or_candidates, list):
            found = False
            for candidate in domain_or_candidates:
                print(f"\n  Trying domain: {candidate} for {name}...")
                test = discover_datasets(candidate)
                if test is not None:
                    result = process_city(slug, name, candidate, args.dry_run, args.discover_only)
                    if result and result.get("permits_12mo", 0) > 0:
                        results[slug] = result
                        success_count += 1
                        found = True
                        break
            if not found:
                fail_count += 1
        else:
            result = process_city(slug, name, domain_or_candidates, args.dry_run, args.discover_only)
            if result and (result.get("permits_12mo", 0) > 0 or result.get("datasets")):
                results[slug] = result
                success_count += 1
            else:
                fail_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Cities processed: {len(cities_to_process)}")
    print(f"Successful: {success_count}")
    print(f"Failed/No data: {fail_count}")

    if results:
        print(f"\n{'City':<25} {'Permits 12mo':>12} {'YoY %':>8} {'Avg Value':>12} {'Types':>6}")
        print(f"{'-'*25} {'-'*12} {'-'*8} {'-'*12} {'-'*6}")
        for slug, r in sorted(results.items()):
            p12 = r.get("permits_12mo", 0)
            yoy = r.get("yoy_trend_pct")
            avg_v = r.get("avg_permit_value")
            n_types = len(r.get("permit_types", {}))
            yoy_str = f"{yoy:+.1f}%" if yoy is not None else "N/A"
            avg_str = f"${avg_v:,.0f}" if avg_v else "N/A"
            p12_str = f"{p12:,}" if p12 else "0"
            print(f"{slug:<25} {p12_str:>12} {yoy_str:>8} {avg_str:>12} {n_types:>6}")

    return 0 if success_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
