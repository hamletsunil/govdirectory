#!/usr/bin/env python3
"""
Extract city websites from official email domains in govdirectory city JSON files.

For each city:
1. Extracts email domains from officials.members[].email
2. Finds the most common domain
3. Maps that domain to a website URL
4. Falls back to legistar slug heuristics for cities without emails
5. Updates each city JSON with a "city_website" field
6. Reports data quality issues found during processing
"""

import json
import os
import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime

CITY_DIR = "/Users/sunilrajaraman/govdirectory/public/data/cities"
REPORT_PATH = "/Users/sunilrajaraman/govdirectory/scripts/city_websites_report.json"

# Domains to skip (not city-specific)
SKIP_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "me.com", "comcast.net", "att.net", "msn.com",
    "live.com", "sbcglobal.net", "verizon.net", "mail.com",
}

# Known mappings from legistar slugs to city website domains where the slug
# doesn't obviously map to a website
SLUG_TO_WEBSITE = {
    "cabq": "https://www.cabq.gov",
    "a2gov": "https://www.a2gov.org",
    "actransit": "https://www.actransit.org",
    "bart": "https://www.bart.gov",
    "lsmo": "https://www.lsmo.org",
    "lausd": "https://www.lausd.net",
    "ousd": "https://www.ousd.org",
    "metro": "https://www.metro.net",
    "mwrd": "https://www.mwrd.org",
    "ppines": "https://www.ppines.com",
    "fwb": "https://www.fwb.org",
}


def domain_to_website(domain):
    """Convert an email domain to a plausible website URL."""
    return f"https://www.{domain}"


def extract_emails_and_domain(data):
    """Extract all official emails and find the most common non-generic domain."""
    officials = data.get("officials", {})
    if not isinstance(officials, dict):
        return [], None

    members = officials.get("members", [])
    if not members:
        return [], None

    emails = []
    domain_counts = Counter()

    for m in members:
        email = m.get("email")
        if not email or not isinstance(email, str):
            continue
        email = email.strip().lower()
        if "@" not in email:
            continue
        emails.append(email)
        domain = email.split("@")[-1]
        if domain not in SKIP_DOMAINS:
            domain_counts[domain] += 1

    if not domain_counts:
        return emails, None

    # Return the most common domain
    top_domain, _ = domain_counts.most_common(1)[0]
    return emails, top_domain


def check_data_quality(slug, data):
    """Run data quality checks and return a list of issues found."""
    issues = []

    # 1. Future legislation dates (> 2026)
    for item in data.get("recent_legislation", []):
        d = item.get("date", "")
        if d and len(d) >= 4 and d[:4].isdigit():
            year = int(d[:4])
            if year > 2026:
                issues.append({
                    "slug": slug,
                    "type": "future_legislation_date",
                    "detail": f"Date {d} on: {item.get('title', 'N/A')[:100]}",
                })

    for item in data.get("recent_meetings", []):
        d = item.get("date", "")
        if d and len(d) >= 4 and d[:4].isdigit():
            year = int(d[:4])
            if year > 2026:
                issues.append({
                    "slug": slug,
                    "type": "future_meeting_date",
                    "detail": f"Date {d} on: {item.get('body_name', 'N/A')[:100]}",
                })

    # 2. Effective tax rate > 10 (likely a formula bug)
    economy = data.get("economy", {})
    if isinstance(economy, dict):
        tax_rate = economy.get("effective_tax_rate")
        if tax_rate is not None and isinstance(tax_rate, (int, float)) and tax_rate > 10:
            issues.append({
                "slug": slug,
                "type": "suspicious_tax_rate",
                "detail": f"effective_tax_rate = {tax_rate} (should typically be 0.5-3.0%)",
            })

    # 3. active_council_members = 0 but officials.members has entries (or vice versa)
    governance = data.get("governance", {})
    if isinstance(governance, dict):
        active_count = governance.get("active_council_members")
        officials = data.get("officials", {})
        members = officials.get("members", []) if isinstance(officials, dict) else []

        if active_count == 0 and len(members) > 0:
            issues.append({
                "slug": slug,
                "type": "council_count_mismatch",
                "detail": f"active_council_members=0 but officials.members has {len(members)} entries",
            })
        elif active_count is not None and active_count > 0 and len(members) == 0:
            issues.append({
                "slug": slug,
                "type": "council_count_mismatch",
                "detail": f"active_council_members={active_count} but officials.members is empty",
            })

    # 4. Other bogus data checks
    identity = data.get("identity", {})
    if isinstance(identity, dict):
        pop = identity.get("population")
        if pop is not None and isinstance(pop, (int, float)):
            if pop < 0:
                issues.append({
                    "slug": slug,
                    "type": "negative_population",
                    "detail": f"population = {pop}",
                })
            elif pop == 0:
                issues.append({
                    "slug": slug,
                    "type": "zero_population",
                    "detail": "population = 0",
                })

    if isinstance(economy, dict):
        income = economy.get("median_household_income")
        if income is not None and isinstance(income, (int, float)):
            if income < 0:
                issues.append({
                    "slug": slug,
                    "type": "negative_income",
                    "detail": f"median_household_income = {income}",
                })
            elif income > 500000:
                issues.append({
                    "slug": slug,
                    "type": "suspicious_income",
                    "detail": f"median_household_income = {income} (unusually high)",
                })

        unemployment = economy.get("unemployment_rate")
        if unemployment is not None and isinstance(unemployment, (int, float)):
            if unemployment > 50:
                issues.append({
                    "slug": slug,
                    "type": "suspicious_unemployment",
                    "detail": f"unemployment_rate = {unemployment}%",
                })
            elif unemployment < 0:
                issues.append({
                    "slug": slug,
                    "type": "negative_unemployment",
                    "detail": f"unemployment_rate = {unemployment}",
                })

    # Check for null/empty city name
    if isinstance(identity, dict):
        name = identity.get("name")
        if not name:
            issues.append({
                "slug": slug,
                "type": "missing_city_name",
                "detail": "identity.name is empty or missing",
            })

    return issues


def insert_field_after_identity(data, key, value):
    """Return a new OrderedDict with key:value inserted after 'identity'."""
    result = OrderedDict()
    inserted = False

    for k, v in data.items():
        if k == key:
            # Skip if it already exists -- we'll re-insert at the right place
            continue
        result[k] = v
        # Insert after identity block for logical placement
        if k == "identity" and not inserted:
            result[key] = value
            inserted = True

    if not inserted:
        # If no identity key, insert near the top
        items = list(data.items())
        result = OrderedDict()
        for i, (k, v) in enumerate(items):
            if k == key:
                continue
            result[k] = v
            if i == 0 and not inserted:
                result[key] = value
                inserted = True
        if not inserted:
            result[key] = value

    return result


def main():
    print("=" * 70)
    print("City Website Extraction Script")
    print("=" * 70)

    city_files = sorted([
        f for f in os.listdir(CITY_DIR)
        if f.endswith(".json") and not f.startswith("_")
    ])

    print(f"\nProcessing {len(city_files)} city files from {CITY_DIR}\n")

    websites = {}  # slug -> website_url
    website_sources = {}  # slug -> source method
    all_issues = []
    stats = {
        "total_cities": len(city_files),
        "websites_from_email": 0,
        "websites_from_slug_map": 0,
        "websites_from_legistar_fallback": 0,
        "no_website_found": 0,
        "cities_with_emails": 0,
        "cities_without_emails": 0,
        "unique_domains": set(),
        "gmail_users": [],
    }

    for fname in city_files:
        slug = fname.replace(".json", "")
        filepath = os.path.join(CITY_DIR, fname)

        with open(filepath, "r") as f:
            data = json.load(f)

        # --- Extract website from emails ---
        emails, top_domain = extract_emails_and_domain(data)

        if emails:
            stats["cities_with_emails"] += 1
        else:
            stats["cities_without_emails"] += 1

        # Check for gmail users (officials using personal email)
        gmail_officials = [e for e in emails if e.endswith("@gmail.com")]
        if gmail_officials:
            stats["gmail_users"].append({
                "slug": slug,
                "gmail_count": len(gmail_officials),
                "total_emails": len(emails),
            })

        website = None
        source = None

        if top_domain:
            stats["unique_domains"].add(top_domain)
            website = domain_to_website(top_domain)
            source = "email_domain"
            stats["websites_from_email"] += 1
        elif slug in SLUG_TO_WEBSITE:
            website = SLUG_TO_WEBSITE[slug]
            source = "slug_map"
            stats["websites_from_slug_map"] += 1
        else:
            # Try legistar slug as a fallback
            legistar_url = data.get("legistar_url", "")
            if legistar_url:
                match = re.search(r"https?://(\w+)\.legistar\.com", legistar_url)
                if match:
                    lslug = match.group(1).lower()
                    if lslug.startswith("cityof"):
                        website = f"https://www.{lslug}.org"
                    elif any(lslug.endswith(sfx) for sfx in ("county", "countyfl", "countyal", "countymd")):
                        website = f"https://www.{lslug}.gov"
                    else:
                        website = f"https://www.{lslug}.gov"
                    source = "legistar_fallback"
                    stats["websites_from_legistar_fallback"] += 1

        if website:
            websites[slug] = website
            website_sources[slug] = source
        else:
            stats["no_website_found"] += 1

        # --- Data quality checks ---
        issues = check_data_quality(slug, data)
        all_issues.extend(issues)

        # --- Update the city JSON with city_website ---
        if website:
            updated = insert_field_after_identity(data, "city_website", website)
            with open(filepath, "w") as f:
                json.dump(updated, f, indent=2, ensure_ascii=False)
                f.write("\n")

    # --- Print Results ---
    print("-" * 70)
    print("WEBSITE EXTRACTION RESULTS")
    print("-" * 70)
    print(f"Total cities processed:          {stats['total_cities']}")
    print(f"Websites from email domains:     {stats['websites_from_email']}")
    print(f"Websites from slug map:          {stats['websites_from_slug_map']}")
    print(f"Websites from legistar fallback: {stats['websites_from_legistar_fallback']}")
    print(f"No website found:                {stats['no_website_found']}")
    print(f"Cities with official emails:     {stats['cities_with_emails']}")
    print(f"Cities without official emails:  {stats['cities_without_emails']}")
    print(f"Unique email domains found:      {len(stats['unique_domains'])}")
    print()

    # Show websites by source
    print("-" * 70)
    print("ALL EXTRACTED WEBSITES")
    print("-" * 70)
    print(f"\n  From email domains ({stats['websites_from_email']}):")
    for slug in sorted(websites):
        if website_sources.get(slug) == "email_domain":
            print(f"    {slug:35s} -> {websites[slug]}")

    print(f"\n  From slug map ({stats['websites_from_slug_map']}):")
    for slug in sorted(websites):
        if website_sources.get(slug) == "slug_map":
            print(f"    {slug:35s} -> {websites[slug]}")

    print(f"\n  From legistar fallback ({stats['websites_from_legistar_fallback']}):")
    for slug in sorted(websites):
        if website_sources.get(slug) == "legistar_fallback":
            print(f"    {slug:35s} -> {websites[slug]}")
    print()

    # Gmail users
    if stats["gmail_users"]:
        print("-" * 70)
        print(f"OFFICIALS USING GMAIL ({len(stats['gmail_users'])} cities)")
        print("-" * 70)
        for g in sorted(stats["gmail_users"], key=lambda x: -x["gmail_count"]):
            print(f"  {g['slug']:30s}  {g['gmail_count']} gmail / {g['total_emails']} total emails")
        print()

    # Data Quality Issues
    print("-" * 70)
    print(f"DATA QUALITY ISSUES ({len(all_issues)} total)")
    print("-" * 70)

    # Group by type
    by_type = {}
    for issue in all_issues:
        by_type.setdefault(issue["type"], []).append(issue)

    for issue_type, items in sorted(by_type.items()):
        print(f"\n  [{issue_type}] ({len(items)} cities)")
        for item in sorted(items, key=lambda x: x["slug"]):
            print(f"    {item['slug']:30s} {item['detail']}")

    # Tax rate analysis
    tax_issues = by_type.get("suspicious_tax_rate", [])
    if tax_issues:
        rates = [float(i["detail"].split("=")[1].split()[0]) for i in tax_issues]
        print(f"\n  Tax rate summary: min={min(rates):.1f}, max={max(rates):.1f}, "
              f"median={sorted(rates)[len(rates)//2]:.1f}, count={len(rates)}")
        print("  NOTE: These are likely stored as (taxes/home_value)*1000 instead of")
        print("  as a true percentage. A value of 25 means $25 per $1000 of value (2.5%).")

    # --- Write report JSON ---
    stats_out = dict(stats)
    stats_out["unique_domains"] = sorted(stats["unique_domains"])
    report = {
        "generated_at": datetime.now().isoformat(),
        "stats": stats_out,
        "websites": websites,
        "website_sources": website_sources,
        "data_quality_issues": all_issues,
    }

    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\n{'=' * 70}")
    print(f"Report written to: {REPORT_PATH}")
    print(f"Updated {len(websites)} city JSON files with 'city_website' field.")
    print(f"{'=' * 70}")

    # Cities with no website at all
    no_website = [
        f.replace(".json", "") for f in city_files
        if f.replace(".json", "") not in websites
    ]
    if no_website:
        print(f"\nCITIES WITH NO WEBSITE FOUND ({len(no_website)}):")
        for s in no_website:
            print(f"  {s}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
