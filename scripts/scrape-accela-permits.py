#!/usr/bin/env python3
"""
Scrape building permit data from the Accela v4 API for govdirectory cities.

For each city with a known Accela Citizen Access portal, this script:
  1. Authenticates via OAuth2 client_credentials grant
  2. Queries for building permits in the last 12 months
  3. Counts permits by type and calculates average value
  4. Computes YoY trend by comparing current 12-month window to prior 12 months
  5. Updates city JSON profiles with development/permit data

Usage:
  python scripts/scrape-accela-permits.py                     # All mapped Accela cities
  python scripts/scrape-accela-permits.py --city denver       # Single city by slug
  python scripts/scrape-accela-permits.py --agency DENVER     # Single city by agency code
  python scripts/scrape-accela-permits.py --dry-run           # Preview without writing
  python scripts/scrape-accela-permits.py --test-auth         # Only test authentication
  python scripts/scrape-accela-permits.py --limit 10          # Process first N cities
  python scripts/scrape-accela-permits.py --update-mapping    # Update agency IDs in profiles

Environment:
  ACCELA_APP_ID       - Accela developer app ID (required or uses default)
  ACCELA_APP_SECRET   - Accela developer app secret (required or uses default)
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
from collections import defaultdict

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data", "cities")

# Permit discovery data (from ~/permit_discovery)
PERMIT_DISCOVERY_DIR = os.path.expanduser("~/permit_discovery/output")
ACCELA_PORTALS_FILE = os.path.join(PERMIT_DISCOVERY_DIR, "accela_portals.json")

# Accela API configuration
ACCELA_APP_ID = os.environ.get("ACCELA_APP_ID", "639066130451571919")
ACCELA_APP_SECRET = os.environ.get("ACCELA_APP_SECRET", "22651518fbe24779aeba27646acdc5d3")
ACCELA_AUTH_URL = "https://auth.accela.com/oauth2/token"
ACCELA_API_BASE = "https://apis.accela.com/v4"

# Rate limiting
REQUEST_DELAY = 1.0  # 1 second between API calls (conservative)
AUTH_TIMEOUT = 30     # seconds
API_TIMEOUT = 30      # seconds
MAX_RECORDS_PER_QUERY = 1000  # Accela max is typically 1000

# -------------------------------------------------------------------
# Agency-to-City Mapping
# -------------------------------------------------------------------
# Manual mapping of Accela agency codes to govdirectory city slugs.
# Source: cross-reference of accela_portals.json codes, existing
# accela_agency_id values in city profiles, and manual verification.
#
# Format: "ACCELA_CODE": "govdirectory_slug"
# -------------------------------------------------------------------

AGENCY_TO_CITY = {
    # -- Direct matches (code.lower() == slug) --
    "ALAMEDA": "alameda",
    "BALTIMORE": "baltimore",
    "CHINO": "chino",
    "CHULAVISTA": "chulavista",
    "CLEARWATER": "clearwater",
    "COLUMBUS": "columbus",
    "DENVER": "denver",
    "DETROIT": "detroit",
    "FRESNO": "fresno",
    "HUMBOLDT": "humboldt",
    "MADISON": "madison",
    "MANSFIELD": "mansfield",
    "MESA": "mesa",
    "MONTEREY": "monterey",
    "OAKLAND": "oakland",
    "SACRAMENTO": "sacramento",
    "SNOHOMISH": "snohomish",
    "STOCKTON": "stockton",
    "VISALIA": "visalia",

    # -- Name matches (code maps to different slug) --
    "BREVARD": "brevardfl",
    "CHARLOTTE": "charlottenc",
    "CLARKCO": "clark",
    "CULVERCITY": "culver-city",
    "DALLASTX": "cityofdallas",
    "DOUGLAS": "douglascounty",
    "ELPASO": "elpasotexas",
    "FRANKLIN": "franklintn",
    "HOLLYWOOD": "hollywoodfl",
    "KANSAS": "kansascity",
    "KINGCO": "kingcounty",
    "LAKECO": "lakecounty",
    "MONTGOMERY": "montgomerycountymd",
    "NAPACO": "napa",
    "NORTHPORT": "cityofnorthport",
    "PITTSBURG": "pittsburgh",
    "POLKCO": "polkcountyfl",
    "RICHMOND": "richmondva",
    "ROCHESTER": "cityofrochester",
    "SANDIEGO": "sandiego",
    "SANTABARBARA": "santabarbara",
    "SANTACLARA": "santaclara",
    "SANTAROSA": "santa-rosa",
    "TACOMA": "cityoftacoma",
    "TAMPA": "tampa",
    "TORRANCE": "torrance",

    # -- County/special matches --
    "ALBANY": "albanycounty",
    "CONCORD": "concordnh",
    "MONTEREYPARK": "montereypark",
    "OAKLANDCO": "oaklandcounty",
    "OREGON": "oregonmetro",
    "WICHITA": "wichita",

    # -- Existing profile agency IDs (may be test/demo codes) --
    # These cities already have accela_agency_id set; we also map
    # the PRODUCTION code from accela_portals.json.
    "CUPERTINO": "cupertino",
    "FONTANA": "fontana",
    "SEATTLE": "seattle",
    "SCOTTSDALE": "scottsdale",
    "RENO": "reno",
    "OMAHA": "omaha",
    "CINCINNATI": "cincinnati",
    "KNOXVILLE": "knoxville",
    "CHANDLER": "chandler",
    "CHESAPEAKE": "chesapeake",
    "GRANDRAPIDS": "grandrapids",
    "LINCOLN": "lincoln",
    "PALMDALE": "palmdale",
    "SPARKS": "sparks",
    "SANTAANA": "santaana",
    "MISSOULA": "missoula",
    "BIRMINGHAM": "birmingham",
    "EVANSTON": "evanston",
    "HARTFORD": "hartford",
    "LASCRUCES": "lascruces",
    "BERKELEY": "berkeley",
    "ANAHEIM": "anaheim",
    "INGLEWOOD": "inglewood",
}

# Reverse mapping for lookup by slug
CITY_TO_AGENCY = {v: k for k, v in AGENCY_TO_CITY.items()}

# -------------------------------------------------------------------
# Permit type normalization
# -------------------------------------------------------------------

# Accela record types follow a hierarchy like "Building/Residential/New/NA"
# We normalize the second level into standard categories.
PERMIT_TYPE_MAP = {
    "residential": "Residential",
    "commercial": "Commercial",
    "industrial": "Industrial",
    "mechanical": "Mechanical",
    "electrical": "Electrical",
    "plumbing": "Plumbing",
    "demolition": "Demolition",
    "addition": "Residential",
    "alteration": "Commercial",
    "new construction": "Residential",
    "renovation": "Commercial",
    "remodel": "Residential",
    "repair": "Other",
    "sign": "Other",
    "solar": "Residential",
    "pool": "Residential",
    "fence": "Residential",
    "roof": "Residential",
    "tenant improvement": "Commercial",
    "fire": "Other",
    "grading": "Other",
}


def normalize_permit_type(record_type_str):
    """
    Normalize an Accela record type string (e.g., "Building/Residential/New/NA")
    into a standard category.
    """
    if not record_type_str:
        return "Other"

    parts = record_type_str.lower().split("/")
    # Check each part against our mapping
    for part in parts[1:]:  # Skip "Building" prefix
        part = part.strip()
        if part in PERMIT_TYPE_MAP:
            return PERMIT_TYPE_MAP[part]
        # Partial match
        for key, val in PERMIT_TYPE_MAP.items():
            if key in part or part in key:
                return val

    return "Other"


# -------------------------------------------------------------------
# HTTP helpers (stdlib only, no external deps)
# -------------------------------------------------------------------

def http_post_form(url, data, timeout=30):
    """POST form-encoded data, return (status_code, response_dict)."""
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"error": "http_error", "error_description": body[:500]}
    except urllib.error.URLError as e:
        return 0, {"error": "url_error", "error_description": str(e)[:500]}
    except Exception as e:
        return 0, {"error": "exception", "error_description": str(e)[:500]}


def http_get(url, headers=None, params=None, timeout=30):
    """GET with headers and query params, return (status_code, response_dict)."""
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"error": "http_error", "error_description": body[:500]}
    except urllib.error.URLError as e:
        return 0, {"error": "url_error", "error_description": str(e)[:500]}
    except Exception as e:
        return 0, {"error": "exception", "error_description": str(e)[:500]}


# -------------------------------------------------------------------
# Accela API client
# -------------------------------------------------------------------

class AccelaClient:
    """Thin wrapper around the Accela v4 API."""

    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self._tokens = {}  # agency_code -> (token, expiry_time)

    def authenticate(self, agency_code, environment="PROD"):
        """
        Get OAuth2 access token via client_credentials grant.
        Returns (token_string, error_string). On success error is None.
        """
        cached = self._tokens.get(agency_code)
        if cached and cached[1] > time.time():
            return cached[0], None

        status, resp = http_post_form(ACCELA_AUTH_URL, {
            "grant_type": "client_credentials",
            "client_id": self.app_id,
            "client_secret": self.app_secret,
            "scope": "records",
            "agency_name": agency_code,
            "environment": environment,
        }, timeout=AUTH_TIMEOUT)

        if status == 200 and "access_token" in resp:
            token = resp["access_token"]
            expires_in = resp.get("expires_in", 3600)
            self._tokens[agency_code] = (token, time.time() + expires_in - 60)
            return token, None
        else:
            err = resp.get("error_description", resp.get("error", f"HTTP {status}"))
            return None, err

    def get_records(self, agency_code, token, record_type="Building/*",
                    date_from=None, date_to=None, offset=0, limit=100):
        """
        Query records (permits) for an agency.
        Returns (records_list, total_count, error_string).
        """
        params = {"limit": limit, "offset": offset}
        if record_type:
            params["type"] = record_type
        if date_from:
            params["openedDateFrom"] = date_from
        if date_to:
            params["openedDateTo"] = date_to

        headers = {
            "Authorization": f"Bearer {token}",
            "x-accela-agency": agency_code,
        }

        status, resp = http_get(
            f"{ACCELA_API_BASE}/records",
            headers=headers,
            params=params,
            timeout=API_TIMEOUT,
        )

        if status == 200:
            records = resp.get("result", [])
            total = resp.get("page", {}).get("totalRows", len(records))
            return records, total, None
        else:
            err = resp.get("error_description", resp.get("error", f"HTTP {status}"))
            return [], 0, err

    def get_all_records(self, agency_code, token, record_type="Building/*",
                        date_from=None, date_to=None, max_records=5000):
        """
        Paginate through all records matching the query.
        Returns (all_records, error_string).
        """
        all_records = []
        offset = 0
        batch_size = 200

        while offset < max_records:
            records, total, err = self.get_records(
                agency_code, token, record_type,
                date_from, date_to, offset, batch_size,
            )
            if err:
                if all_records:
                    # We got some records before the error, return what we have
                    break
                return all_records, err

            all_records.extend(records)
            if len(records) < batch_size or len(all_records) >= total:
                break
            offset += batch_size
            time.sleep(REQUEST_DELAY)

        return all_records, None

    def get_record_types(self, agency_code, token):
        """Get available record types for an agency."""
        headers = {
            "Authorization": f"Bearer {token}",
            "x-accela-agency": agency_code,
        }
        status, resp = http_get(
            f"{ACCELA_API_BASE}/settings/records/types",
            headers=headers,
            timeout=API_TIMEOUT,
        )
        if status == 200:
            return resp.get("result", []), None
        else:
            err = resp.get("error_description", resp.get("error", f"HTTP {status}"))
            return [], err


# -------------------------------------------------------------------
# Data processing
# -------------------------------------------------------------------

def process_records(records):
    """
    Analyze a list of Accela records and extract permit statistics.
    Returns a dict with permit counts, types, average value, etc.
    """
    if not records:
        return {
            "permits_12mo": 0,
            "permit_types": {},
            "avg_permit_value": None,
            "record_count": 0,
        }

    type_counts = defaultdict(int)
    values = []

    for record in records:
        # Extract record type
        rtype = record.get("type", {})
        if isinstance(rtype, dict):
            # Accela returns type as {"type": "Building", "subType": "Residential", ...}
            type_str = "/".join(filter(None, [
                rtype.get("type", ""),
                rtype.get("subType", ""),
                rtype.get("category", ""),
            ]))
        elif isinstance(rtype, str):
            type_str = rtype
        else:
            type_str = ""

        category = normalize_permit_type(type_str)
        type_counts[category] += 1

        # Extract value (job value, total fee, estimated value)
        value = None
        for vfield in ["jobValue", "totalFee", "estimatedValue", "totalJobCost"]:
            v = record.get(vfield)
            if v is not None:
                try:
                    value = float(v)
                    if value > 0:
                        break
                except (ValueError, TypeError):
                    continue

        if value and value > 0:
            values.append(value)

    avg_value = round(sum(values) / len(values)) if values else None

    return {
        "permits_12mo": len(records),
        "permit_types": dict(sorted(type_counts.items(), key=lambda x: -x[1])),
        "avg_permit_value": avg_value,
        "record_count": len(records),
        "valued_count": len(values),
    }


def compute_yoy_trend(current_count, prior_count):
    """Compute year-over-year percentage change."""
    if prior_count and prior_count > 0 and current_count is not None:
        return round(((current_count - prior_count) / prior_count) * 100, 1)
    return None


# -------------------------------------------------------------------
# City profile loading/saving
# -------------------------------------------------------------------

def load_city_profile(slug):
    """Load a city profile JSON, return (data, filepath) or (None, None)."""
    filepath = os.path.join(DATA_DIR, f"{slug}.json")
    if not os.path.exists(filepath):
        return None, None
    try:
        with open(filepath, "r") as f:
            return json.load(f), filepath
    except (json.JSONDecodeError, IOError) as e:
        print(f"  ERROR: Cannot load {filepath}: {e}")
        return None, None


def save_city_profile(data, filepath):
    """Save city profile JSON with consistent formatting."""
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def update_city_profile(slug, permit_stats, yoy_trend, dry_run=False):
    """
    Update a city profile with permit data from Accela.
    Returns True if the profile was updated.
    """
    data, filepath = load_city_profile(slug)
    if data is None:
        print(f"  SKIP: No city profile found for slug '{slug}'")
        return False

    # Update development section
    dev = data.get("development", {})
    dev["permits_12mo"] = permit_stats["permits_12mo"]
    dev["permit_types"] = permit_stats["permit_types"]
    dev["avg_permit_value"] = permit_stats["avg_permit_value"]
    dev["yoy_trend_pct"] = yoy_trend
    data["development"] = dev

    # Update data_sources
    ds = data.get("data_sources", {})
    if permit_stats["permits_12mo"] and permit_stats["permits_12mo"] > 0:
        ds["permits"] = "available"
        ds["accela"] = "available"
    else:
        ds["accela"] = "available"  # Mark as available even if no records found
    data["data_sources"] = ds

    if dry_run:
        print(f"  DRY RUN: Would update {filepath}")
        print(f"    permits_12mo={permit_stats['permits_12mo']}, "
              f"types={permit_stats['permit_types']}, "
              f"avg_value={permit_stats['avg_permit_value']}, "
              f"yoy={yoy_trend}")
        return True

    save_city_profile(data, filepath)
    print(f"  SAVED: {filepath}")
    return True


def update_agency_id(slug, agency_code, dry_run=False):
    """
    Update a city profile's governance.accela_agency_id to the
    production Accela code (from accela_portals.json).
    """
    data, filepath = load_city_profile(slug)
    if data is None:
        return False

    gov = data.get("governance", {})
    current = gov.get("accela_agency_id", "")

    if current == agency_code:
        return False  # Already set

    gov["has_accela"] = True
    gov["accela_agency_id"] = agency_code
    data["governance"] = gov

    # Also ensure data_sources marks accela
    ds = data.get("data_sources", {})
    ds["accela"] = "available"
    data["data_sources"] = ds

    if dry_run:
        print(f"  DRY RUN: {slug}: accela_agency_id '{current}' -> '{agency_code}'")
        return True

    save_city_profile(data, filepath)
    print(f"  UPDATED: {slug}: accela_agency_id '{current}' -> '{agency_code}'")
    return True


# -------------------------------------------------------------------
# Portal data loading
# -------------------------------------------------------------------

def load_accela_portals():
    """Load the verified Accela portals from permit_discovery output."""
    if not os.path.exists(ACCELA_PORTALS_FILE):
        print(f"WARNING: {ACCELA_PORTALS_FILE} not found")
        return []
    with open(ACCELA_PORTALS_FILE, "r") as f:
        data = json.load(f)
    return data.get("portals", [])


def get_all_agency_mappings():
    """
    Build the complete list of (agency_code, city_slug) pairs to process.
    Combines:
      1. The hardcoded AGENCY_TO_CITY mapping
      2. Existing accela_agency_id values from city profiles
      3. Verified portals from accela_portals.json
    """
    mappings = {}  # agency_code -> city_slug

    # Start with hardcoded mapping
    mappings.update(AGENCY_TO_CITY)

    # Add from accela_portals.json
    portals = load_accela_portals()
    for portal in portals:
        code = portal.get("code", "")
        if code and code in AGENCY_TO_CITY:
            mappings[code] = AGENCY_TO_CITY[code]

    # Add from existing city profiles (for agencies not in portals)
    import glob
    for filepath in glob.glob(os.path.join(DATA_DIR, "*.json")):
        slug = os.path.basename(filepath).replace(".json", "")
        if slug.startswith("_"):
            continue
        try:
            with open(filepath) as f:
                data = json.load(f)
            agency_id = data.get("governance", {}).get("accela_agency_id", "")
            if agency_id and agency_id not in mappings:
                mappings[agency_id] = slug
        except (json.JSONDecodeError, IOError):
            continue

    return mappings


# -------------------------------------------------------------------
# Main processing
# -------------------------------------------------------------------

def test_authentication(client, agency_codes):
    """Test authentication against a list of agency codes."""
    print(f"\nTesting authentication for {len(agency_codes)} agencies...\n")

    results = {"success": [], "failed": [], "errors": defaultdict(list)}

    for code in sorted(agency_codes):
        token, err = client.authenticate(code)
        if token:
            results["success"].append(code)
            print(f"  OK    {code}")
        else:
            results["failed"].append(code)
            results["errors"][err].append(code)
            print(f"  FAIL  {code}: {err}")
        time.sleep(REQUEST_DELAY)

    print(f"\n--- Authentication Summary ---")
    print(f"  Success: {len(results['success'])}")
    print(f"  Failed:  {len(results['failed'])}")
    if results["errors"]:
        print(f"\n  Error breakdown:")
        for err, codes in sorted(results["errors"].items(), key=lambda x: -len(x[1])):
            print(f"    {len(codes):3d} x {err[:80]}")
    return results


def process_agency(client, agency_code, city_slug, dry_run=False):
    """
    Process a single agency: authenticate, fetch permits, update city profile.
    Returns a result dict.
    """
    result = {
        "agency_code": agency_code,
        "city_slug": city_slug,
        "status": "unknown",
        "permits_12mo": None,
        "yoy_trend_pct": None,
        "error": None,
    }

    # Step 1: Authenticate
    print(f"\n  [{agency_code}] Authenticating...")
    token, err = client.authenticate(agency_code)
    if not token:
        result["status"] = "auth_failed"
        result["error"] = err
        print(f"  [{agency_code}] Auth failed: {err}")
        return result

    print(f"  [{agency_code}] Auth OK, fetching permits...")
    time.sleep(REQUEST_DELAY)

    # Step 2: Fetch current 12-month window
    now = datetime.now()
    date_from = (now - timedelta(days=365)).strftime("%Y-%m-%d")
    date_to = now.strftime("%Y-%m-%d")

    records, err = client.get_all_records(
        agency_code, token,
        record_type="Building/*",
        date_from=date_from,
        date_to=date_to,
        max_records=MAX_RECORDS_PER_QUERY,
    )

    if err and not records:
        # Try without type filter (some agencies don't support Building/*)
        print(f"  [{agency_code}] Building/* failed ({err}), trying without type filter...")
        time.sleep(REQUEST_DELAY)
        records, err = client.get_all_records(
            agency_code, token,
            record_type=None,
            date_from=date_from,
            date_to=date_to,
            max_records=MAX_RECORDS_PER_QUERY,
        )

    if err and not records:
        result["status"] = "query_failed"
        result["error"] = err
        print(f"  [{agency_code}] Query failed: {err}")
        return result

    print(f"  [{agency_code}] Got {len(records)} records in current window")

    # Step 3: Process current records
    current_stats = process_records(records)

    # Step 4: Fetch prior 12-month window for YoY comparison
    prior_from = (now - timedelta(days=730)).strftime("%Y-%m-%d")
    prior_to = (now - timedelta(days=365)).strftime("%Y-%m-%d")

    time.sleep(REQUEST_DELAY)
    prior_records, prior_err = client.get_all_records(
        agency_code, token,
        record_type="Building/*",
        date_from=prior_from,
        date_to=prior_to,
        max_records=MAX_RECORDS_PER_QUERY,
    )
    if prior_err and not prior_records:
        # Try without type filter
        time.sleep(REQUEST_DELAY)
        prior_records, prior_err = client.get_all_records(
            agency_code, token,
            record_type=None,
            date_from=prior_from,
            date_to=prior_to,
            max_records=MAX_RECORDS_PER_QUERY,
        )

    prior_count = len(prior_records) if prior_records else 0
    yoy_trend = compute_yoy_trend(current_stats["permits_12mo"], prior_count)

    print(f"  [{agency_code}] Prior window: {prior_count} records, YoY: {yoy_trend}%")

    # Step 5: Update city profile
    updated = update_city_profile(city_slug, current_stats, yoy_trend, dry_run)

    result["status"] = "success" if updated else "no_profile"
    result["permits_12mo"] = current_stats["permits_12mo"]
    result["permit_types"] = current_stats["permit_types"]
    result["avg_permit_value"] = current_stats["avg_permit_value"]
    result["yoy_trend_pct"] = yoy_trend
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Accela building permit data for govdirectory cities"
    )
    parser.add_argument("--city", help="Process single city by slug")
    parser.add_argument("--agency", help="Process single agency by code")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--test-auth", action="store_true", help="Only test authentication")
    parser.add_argument("--limit", type=int, help="Process first N cities only")
    parser.add_argument("--update-mapping", action="store_true",
                        help="Update agency IDs in city profiles from accela_portals.json")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    print("=" * 70)
    print("Accela Building Permit Scraper for govdirectory")
    print("=" * 70)
    print(f"  App ID:    {ACCELA_APP_ID[:8]}...{ACCELA_APP_ID[-4:]}")
    print(f"  Data dir:  {DATA_DIR}")
    print(f"  Portals:   {ACCELA_PORTALS_FILE}")
    print(f"  Dry run:   {args.dry_run}")
    print()

    # Load all mappings
    all_mappings = get_all_agency_mappings()
    print(f"Total agency-to-city mappings: {len(all_mappings)}")

    # Mode: Update agency IDs in city profiles
    if args.update_mapping:
        print(f"\n--- Updating accela_agency_id in city profiles ---\n")
        portals = load_accela_portals()
        updated = 0
        for portal in portals:
            code = portal.get("code", "")
            if code in AGENCY_TO_CITY:
                slug = AGENCY_TO_CITY[code]
                if update_agency_id(slug, code, args.dry_run):
                    updated += 1
        print(f"\nUpdated {updated} city profiles.")
        return

    # Initialize API client
    client = AccelaClient(ACCELA_APP_ID, ACCELA_APP_SECRET)

    # Mode: Test authentication only
    if args.test_auth:
        codes = sorted(all_mappings.keys())
        if args.agency:
            codes = [args.agency.upper()]
        elif args.limit:
            codes = codes[:args.limit]
        test_authentication(client, codes)
        return

    # Determine which agencies to process
    if args.agency:
        agency_code = args.agency.upper()
        slug = all_mappings.get(agency_code)
        if not slug:
            print(f"ERROR: No city mapping for agency '{agency_code}'")
            print(f"Add it to AGENCY_TO_CITY in this script.")
            sys.exit(1)
        to_process = [(agency_code, slug)]
    elif args.city:
        slug = args.city
        agency_code = CITY_TO_AGENCY.get(slug)
        if not agency_code:
            # Check profile for existing agency ID
            data, _ = load_city_profile(slug)
            if data:
                agency_code = data.get("governance", {}).get("accela_agency_id")
            if not agency_code:
                print(f"ERROR: No agency code for city '{slug}'")
                sys.exit(1)
        to_process = [(agency_code, slug)]
    else:
        to_process = sorted(all_mappings.items())
        if args.limit:
            to_process = to_process[:args.limit]

    print(f"\nProcessing {len(to_process)} agencies...\n")

    # Process each agency
    results = []
    successes = 0
    auth_failures = 0
    query_failures = 0

    for i, (agency_code, city_slug) in enumerate(to_process, 1):
        print(f"\n[{i}/{len(to_process)}] {agency_code} -> {city_slug}")

        result = process_agency(client, agency_code, city_slug, args.dry_run)
        results.append(result)

        if result["status"] == "success":
            successes += 1
        elif result["status"] == "auth_failed":
            auth_failures += 1
        elif result["status"] == "query_failed":
            query_failures += 1

        time.sleep(REQUEST_DELAY)

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total processed:    {len(results)}")
    print(f"  Successful:         {successes}")
    print(f"  Auth failures:      {auth_failures}")
    print(f"  Query failures:     {query_failures}")
    print(f"  Other:              {len(results) - successes - auth_failures - query_failures}")

    # Show successful results
    if successes > 0:
        print(f"\n  Successful cities:")
        for r in results:
            if r["status"] == "success":
                print(f"    {r['city_slug']:25s}  permits={r['permits_12mo']:>6}  "
                      f"avg_value=${r['avg_permit_value'] or 0:>10,}  "
                      f"yoy={r['yoy_trend_pct'] or 'N/A'}")

    # Show error distribution
    if auth_failures > 0:
        error_dist = defaultdict(int)
        for r in results:
            if r["error"]:
                error_dist[r["error"][:60]] += 1
        print(f"\n  Error distribution:")
        for err, count in sorted(error_dist.items(), key=lambda x: -x[1]):
            print(f"    {count:3d} x {err}")

    # Write results log
    log_file = os.path.join(SCRIPT_DIR, "accela-permits-log.json")
    log_data = {
        "run_at": datetime.now().isoformat(),
        "total": len(results),
        "successes": successes,
        "auth_failures": auth_failures,
        "query_failures": query_failures,
        "results": results,
    }
    with open(log_file, "w") as f:
        json.dump(log_data, f, indent=2)
    print(f"\n  Log written to: {log_file}")


if __name__ == "__main__":
    main()
