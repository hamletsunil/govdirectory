#!/usr/bin/env python3
"""
data_inventory.py - Comprehensive per-city data inventory for govdirectory.

Reads all 290+ city JSON profiles and produces:
  1. docs/city-data-inventory.json  (machine-readable)
  2. docs/city-data-inventory.md    (human-readable report)

Usage:
  cd ~/govdirectory && python scripts/data_inventory.py
"""

import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean, median

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CITY_DIR = Path(__file__).resolve().parent.parent / "public" / "data" / "cities"
DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"

# The 17 canonical data-source keys (order matters for display)
CANONICAL_SOURCES = [
    "legistar",
    "socrata",
    "census_acs",
    "arcgis",
    "fbi_ucr",
    "socrata_crime",
    "bls_laus",
    "ca_edd",
    "epa_aqs",
    "nces_ccd",
    "hud_fmr",
    "fema_openfema",
    "greatschools",
    "permits",
    "youtube_meetings",
    "seeclickfix",
    "accela",
]

# Human-friendly labels for each source
SOURCE_LABELS = {
    "legistar": "Legistar (Granicus)",
    "socrata": "Socrata / Open Data",
    "census_acs": "Census ACS",
    "arcgis": "ArcGIS Open Data",
    "fbi_ucr": "FBI UCR Crime",
    "socrata_crime": "Socrata Crime",
    "bls_laus": "BLS LAUS (Employment)",
    "ca_edd": "CA EDD (CA only)",
    "epa_aqs": "EPA AQS (Air Quality)",
    "nces_ccd": "NCES CCD (Schools)",
    "hud_fmr": "HUD FMR (Housing)",
    "fema_openfema": "FEMA OpenFEMA",
    "greatschools": "GreatSchools",
    "permits": "Permits / Accela",
    "youtube_meetings": "YouTube Meetings",
    "seeclickfix": "SeeClickFix",
    "accela": "Accela",
}

# Thematic data sections we check for non-empty content
THEMATIC_SECTIONS = [
    "economy",
    "safety",
    "education",
    "environment",
    "housing",
    "governance",
    "development",
    "civic_issues",
    "demographics",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_section_populated(data: dict, section: str) -> bool:
    """Return True if a thematic section has at least one non-null value."""
    val = data.get(section)
    if not val or not isinstance(val, dict):
        return False
    # Check if at least one value is truthy (non-null, non-zero, non-empty)
    for v in val.values():
        if v is not None and v != "" and v != [] and v != {} and v != 0:
            return True
    return False


def safe_len(obj) -> int:
    """Return length if list/dict, else 0."""
    if isinstance(obj, (list, dict)):
        return len(obj)
    return 0


def meeting_date_range(meetings: list) -> tuple:
    """Return (earliest_date, latest_date) strings from meetings list."""
    dates = []
    for m in meetings:
        d = m.get("date")
        if d:
            dates.append(d)
    if not dates:
        return (None, None)
    dates.sort()
    return (dates[0], dates[-1])


def count_available(data_sources: dict) -> int:
    """Count how many sources are 'available'."""
    return sum(1 for v in data_sources.values() if v == "available")


def count_error(data_sources: dict) -> int:
    return sum(1 for v in data_sources.values() if v == "error")


def count_skipped(data_sources: dict) -> int:
    return sum(1 for v in data_sources.values() if v == "skipped")


# ---------------------------------------------------------------------------
# Main analysis
# ---------------------------------------------------------------------------

def analyze_city(filepath: Path) -> dict:
    """Analyze a single city JSON and return a summary dict."""
    with open(filepath) as f:
        data = json.load(f)

    slug = filepath.stem
    identity = data.get("identity", {})
    ds = data.get("data_sources", {})
    platforms = data.get("data_platforms", [])
    officials = data.get("officials", {})
    recent_meetings = data.get("recent_meetings", [])
    recent_legislation = data.get("recent_legislation", [])
    gov_news = data.get("government_news", [])
    video_meetings = data.get("video_meetings", [])
    dq = data.get("data_quality", {})
    meetings_section = data.get("meetings", {})

    # Officials count
    if isinstance(officials, dict):
        members = officials.get("members", [])
        official_count = len(members) if isinstance(members, list) else 0
        body_name = officials.get("body_name", "")
    elif isinstance(officials, list):
        official_count = len(officials)
        body_name = ""
    else:
        official_count = 0
        body_name = ""

    # Meetings date range
    meet_earliest, meet_latest = meeting_date_range(
        recent_meetings if isinstance(recent_meetings, list) else []
    )

    # Video meeting sources
    video_sources = set()
    for vm in (video_meetings if isinstance(video_meetings, list) else []):
        src = vm.get("source", "unknown")
        video_sources.add(src)

    # Thematic section availability
    sections_available = {}
    for sec in THEMATIC_SECTIONS:
        sections_available[sec] = is_section_populated(data, sec)

    # Source status breakdown
    source_statuses = {}
    for src in CANONICAL_SOURCES:
        source_statuses[src] = ds.get(src, "missing")

    # Provenance info
    provenance = data.get("provenance", {})
    last_probe = provenance.get("last_full_probe")

    result = {
        "slug": slug,
        "name": identity.get("name", slug),
        "state": identity.get("state", ""),
        "population": identity.get("population"),
        "city_website": data.get("city_website"),
        "enriched_at": data.get("enriched_at"),
        "last_full_probe": last_probe,
        "data_platforms": platforms,
        "source_statuses": source_statuses,
        "available_count": count_available(ds),
        "error_count": count_error(ds),
        "skipped_count": count_skipped(ds),
        "total_sources_checked": len(ds),
        "officials_count": official_count,
        "body_name": body_name,
        "recent_meetings_count": safe_len(recent_meetings),
        "meetings_earliest": meet_earliest,
        "meetings_latest": meet_latest,
        "recent_legislation_count": safe_len(recent_legislation),
        "government_news_count": safe_len(gov_news),
        "video_meetings_count": safe_len(video_meetings),
        "video_sources": sorted(video_sources),
        "has_city_website": bool(data.get("city_website")),
        "sections": sections_available,
        "sections_populated_count": sum(1 for v in sections_available.values() if v),
        "quality_score": dq.get("quality_score"),
        "quality_grade": dq.get("grade"),
        "completeness_pct": dq.get("completeness_pct"),
        "meetings_indexed": meetings_section.get("meetings_indexed", 0) if isinstance(meetings_section, dict) else 0,
        "has_video_archive": meetings_section.get("has_video_archive", False) if isinstance(meetings_section, dict) else False,
    }
    return result


def compute_overlap_analysis(cities: list) -> dict:
    """Identify cities that get the same data type from multiple sources."""
    overlaps = {
        "meetings_multi_source": [],
        "video_multi_source": [],
        "crime_multi_source": [],
    }

    for c in cities:
        ss = c["source_statuses"]

        # Meetings overlap: legistar meetings + primegov meetings
        has_legistar_meetings = c["recent_meetings_count"] > 0 and "legistar" in c["data_platforms"]
        has_primegov_meetings = "primegov" in c["data_platforms"]
        if has_legistar_meetings and has_primegov_meetings:
            overlaps["meetings_multi_source"].append({
                "slug": c["slug"],
                "name": c["name"],
                "legistar_meetings": c["recent_meetings_count"],
                "primegov_video": c["video_meetings_count"],
            })

        # Video overlap: youtube + primegov/swagit
        has_youtube = ss.get("youtube_meetings") == "available"
        has_primegov_video = c["video_meetings_count"] > 0 and any(
            s in c["video_sources"] for s in ["primegov", "swagit"]
        )
        if has_youtube and has_primegov_video:
            overlaps["video_multi_source"].append({
                "slug": c["slug"],
                "name": c["name"],
                "video_count": c["video_meetings_count"],
                "video_sources": c["video_sources"],
            })

        # Crime data overlap: fbi_ucr + socrata_crime both available
        if ss.get("fbi_ucr") == "available" and ss.get("socrata_crime") == "available":
            overlaps["crime_multi_source"].append({
                "slug": c["slug"],
                "name": c["name"],
            })

    return overlaps


def compute_platform_matrix(cities: list) -> dict:
    """Map each platform to list of cities."""
    platform_cities = defaultdict(list)
    for c in cities:
        for p in c["data_platforms"]:
            platform_cities[p].append({"slug": c["slug"], "name": c["name"], "state": c["state"]})
    return dict(platform_cities)


def compute_freshness_summary(cities: list) -> dict:
    """Analyze enrichment timestamps."""
    now = datetime.utcnow()
    timestamps = []
    buckets = {"last_24h": 0, "last_7d": 0, "last_30d": 0, "older_30d": 0, "no_timestamp": 0}

    for c in cities:
        ts_str = c.get("enriched_at")
        if not ts_str:
            buckets["no_timestamp"] += 1
            continue
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00").replace("+00:00", ""))
            timestamps.append(ts)
            age = now - ts
            if age < timedelta(hours=24):
                buckets["last_24h"] += 1
            elif age < timedelta(days=7):
                buckets["last_7d"] += 1
            elif age < timedelta(days=30):
                buckets["last_30d"] += 1
            else:
                buckets["older_30d"] += 1
        except (ValueError, TypeError):
            buckets["no_timestamp"] += 1

    oldest = min(timestamps).isoformat() if timestamps else None
    newest = max(timestamps).isoformat() if timestamps else None

    return {
        "buckets": buckets,
        "oldest_enrichment": oldest,
        "newest_enrichment": newest,
        "total_with_timestamp": len(timestamps),
    }


def compute_gaps_analysis(cities: list) -> dict:
    """Identify systemic gaps and missing data patterns."""
    gaps = {
        "no_population": [],
        "no_officials": [],
        "no_meetings": [],
        "no_legislation": [],
        "no_city_website": [],
        "zero_sections_populated": [],
        "low_quality_cities": [],  # grade D or below
        "no_economy_data": [],
        "no_safety_data": [],
        "no_education_data": [],
        "no_housing_data": [],
    }

    for c in cities:
        if c["population"] is None:
            gaps["no_population"].append({"slug": c["slug"], "name": c["name"]})
        if c["officials_count"] == 0:
            gaps["no_officials"].append({"slug": c["slug"], "name": c["name"]})
        if c["recent_meetings_count"] == 0 and c["video_meetings_count"] == 0:
            gaps["no_meetings"].append({"slug": c["slug"], "name": c["name"]})
        if c["recent_legislation_count"] == 0:
            gaps["no_legislation"].append({"slug": c["slug"], "name": c["name"]})
        if not c["has_city_website"]:
            gaps["no_city_website"].append({"slug": c["slug"], "name": c["name"]})
        if c["sections_populated_count"] == 0:
            gaps["zero_sections_populated"].append({"slug": c["slug"], "name": c["name"]})
        if c.get("quality_grade") in ("D", "F"):
            gaps["low_quality_cities"].append({
                "slug": c["slug"],
                "name": c["name"],
                "grade": c["quality_grade"],
                "score": c["quality_score"],
            })
        if not c["sections"].get("economy"):
            gaps["no_economy_data"].append({"slug": c["slug"], "name": c["name"]})
        if not c["sections"].get("safety"):
            gaps["no_safety_data"].append({"slug": c["slug"], "name": c["name"]})
        if not c["sections"].get("education"):
            gaps["no_education_data"].append({"slug": c["slug"], "name": c["name"]})
        if not c["sections"].get("housing"):
            gaps["no_housing_data"].append({"slug": c["slug"], "name": c["name"]})

    # Add counts for summary
    gaps_summary = {}
    for k, v in gaps.items():
        gaps_summary[k] = {"count": len(v), "cities": v}

    return gaps_summary


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_json_report(cities: list, overlaps: dict, platform_matrix: dict,
                         freshness: dict, gaps: dict, source_coverage: dict) -> dict:
    """Build the full JSON report structure."""
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_cities": len(cities),
        "summary": {
            "source_coverage": source_coverage,
            "platform_coverage": {k: len(v) for k, v in platform_matrix.items()},
            "freshness": freshness,
            "thematic_coverage": {
                sec: sum(1 for c in cities if c["sections"].get(sec))
                for sec in THEMATIC_SECTIONS
            },
            "avg_available_sources": round(mean(c["available_count"] for c in cities), 2),
            "median_available_sources": median(c["available_count"] for c in cities),
            "avg_quality_score": round(
                mean(c["quality_score"] for c in cities if c["quality_score"] is not None), 2
            ),
            "cities_with_officials": sum(1 for c in cities if c["officials_count"] > 0),
            "cities_with_meetings": sum(
                1 for c in cities if c["recent_meetings_count"] > 0 or c["video_meetings_count"] > 0
            ),
            "cities_with_legislation": sum(1 for c in cities if c["recent_legislation_count"] > 0),
            "cities_with_news": sum(1 for c in cities if c["government_news_count"] > 0),
            "cities_with_video": sum(1 for c in cities if c["video_meetings_count"] > 0),
            "cities_with_website": sum(1 for c in cities if c["has_city_website"]),
        },
        "cities": cities,
        "overlap_analysis": overlaps,
        "platform_matrix": platform_matrix,
        "gaps_analysis": {k: v for k, v in gaps.items()},
    }


def generate_markdown_report(cities: list, overlaps: dict, platform_matrix: dict,
                              freshness: dict, gaps: dict, source_coverage: dict) -> str:
    """Build a comprehensive Markdown report."""
    lines = []

    def add(text=""):
        lines.append(text)

    total = len(cities)
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # -- Header --
    add("# City Data Inventory Report")
    add()
    add(f"> Generated: {now_str}  ")
    add(f"> Total cities analyzed: **{total}**")
    add()

    # -- 1. Summary Statistics --
    add("## 1. Summary Statistics")
    add()

    # Source coverage table
    add("### Data Source Coverage")
    add()
    add("| Source | Available | Error | Skipped | Coverage % |")
    add("|--------|-----------|-------|---------|------------|")
    for src in CANONICAL_SOURCES:
        sc = source_coverage[src]
        pct = round(sc["available"] / total * 100, 1) if total else 0
        label = SOURCE_LABELS.get(src, src)
        add(f"| {label} | {sc['available']} | {sc['error']} | {sc['skipped']} | {pct}% |")
    add()

    # Overall stats
    avg_avail = round(mean(c["available_count"] for c in cities), 1)
    med_avail = median(c["available_count"] for c in cities)
    quality_scores = [c["quality_score"] for c in cities if c["quality_score"] is not None]
    avg_quality = round(mean(quality_scores), 1) if quality_scores else 0

    cities_w_officials = sum(1 for c in cities if c["officials_count"] > 0)
    cities_w_meetings = sum(
        1 for c in cities if c["recent_meetings_count"] > 0 or c["video_meetings_count"] > 0
    )
    cities_w_legislation = sum(1 for c in cities if c["recent_legislation_count"] > 0)
    cities_w_video = sum(1 for c in cities if c["video_meetings_count"] > 0)
    cities_w_news = sum(1 for c in cities if c["government_news_count"] > 0)
    cities_w_website = sum(1 for c in cities if c["has_city_website"])

    add("### Key Metrics")
    add()
    add("| Metric | Value |")
    add("|--------|-------|")
    add(f"| Average available sources per city | {avg_avail} |")
    add(f"| Median available sources per city | {med_avail} |")
    add(f"| Average quality score | {avg_quality} |")
    add(f"| Cities with elected officials data | {cities_w_officials} ({round(cities_w_officials/total*100,1)}%) |")
    add(f"| Cities with meeting records | {cities_w_meetings} ({round(cities_w_meetings/total*100,1)}%) |")
    add(f"| Cities with legislation data | {cities_w_legislation} ({round(cities_w_legislation/total*100,1)}%) |")
    add(f"| Cities with video meetings | {cities_w_video} ({round(cities_w_video/total*100,1)}%) |")
    add(f"| Cities with government news | {cities_w_news} ({round(cities_w_news/total*100,1)}%) |")
    add(f"| Cities with website URL | {cities_w_website} ({round(cities_w_website/total*100,1)}%) |")
    add()

    # Thematic section coverage
    add("### Thematic Section Coverage")
    add()
    add("| Section | Cities with Data | Coverage % |")
    add("|---------|-----------------|------------|")
    for sec in THEMATIC_SECTIONS:
        cnt = sum(1 for c in cities if c["sections"].get(sec))
        pct = round(cnt / total * 100, 1) if total else 0
        add(f"| {sec.title()} | {cnt} | {pct}% |")
    add()

    # Grade distribution
    grade_dist = Counter(c.get("quality_grade", "N/A") for c in cities)
    add("### Quality Grade Distribution")
    add()
    add("| Grade | Count | % |")
    add("|-------|-------|---|")
    for grade in ["A", "B", "C", "D", "F", "N/A"]:
        cnt = grade_dist.get(grade, 0)
        if cnt > 0:
            add(f"| {grade} | {cnt} | {round(cnt/total*100,1)}% |")
    add()

    # -- 2. Top 20 Best-Covered Cities --
    add("## 2. Top 20 Best-Covered Cities")
    add()
    add("Ranked by number of available data sources, then by quality score.")
    add()

    sorted_best = sorted(
        cities,
        key=lambda c: (c["available_count"], c.get("quality_score") or 0, c["sections_populated_count"]),
        reverse=True,
    )

    add("| Rank | City | State | Pop. | Sources Avail. | Quality | Sections | Officials | Meetings | Legislation |")
    add("|------|------|-------|------|----------------|---------|----------|-----------|----------|-------------|")
    for i, c in enumerate(sorted_best[:20], 1):
        pop = f"{c['population']:,}" if c["population"] else "N/A"
        qs = f"{c['quality_score']}" if c["quality_score"] is not None else "N/A"
        meets = c["recent_meetings_count"] + c["video_meetings_count"]
        add(
            f"| {i} | {c['name']} | {c['state']} | {pop} | {c['available_count']}/{c['total_sources_checked']} "
            f"| {qs} ({c.get('quality_grade','?')}) | {c['sections_populated_count']}/{len(THEMATIC_SECTIONS)} "
            f"| {c['officials_count']} | {meets} | {c['recent_legislation_count']} |"
        )
    add()

    # -- 3. Bottom 20 Worst-Covered Cities --
    add("## 3. Bottom 20 Worst-Covered Cities")
    add()
    add("Ranked by fewest available data sources.")
    add()

    sorted_worst = sorted(
        cities,
        key=lambda c: (c["available_count"], c.get("quality_score") or 0, c["sections_populated_count"]),
    )

    add("| Rank | City | State | Pop. | Sources Avail. | Quality | Sections | Platforms |")
    add("|------|------|-------|------|----------------|---------|----------|-----------|")
    for i, c in enumerate(sorted_worst[:20], 1):
        pop = f"{c['population']:,}" if c["population"] else "N/A"
        qs = f"{c['quality_score']}" if c["quality_score"] is not None else "N/A"
        add(
            f"| {i} | {c['name']} | {c['state']} | {pop} | {c['available_count']}/{c['total_sources_checked']} "
            f"| {qs} ({c.get('quality_grade','?')}) | {c['sections_populated_count']}/{len(THEMATIC_SECTIONS)} "
            f"| {', '.join(c['data_platforms']) or 'none'} |"
        )
    add()

    # -- 4. Data Overlap Analysis --
    add("## 4. Data Overlap Analysis")
    add()
    add("Cities that receive the same data type from multiple sources.")
    add()

    # Meetings multi-source
    add("### Meetings from Multiple Sources (Legistar + PrimeGov)")
    add()
    mm = overlaps["meetings_multi_source"]
    if mm:
        add(f"**{len(mm)} cities** have meeting data from both Legistar and PrimeGov:")
        add()
        add("| City | Legistar Meetings | PrimeGov Videos |")
        add("|------|-------------------|-----------------|")
        for o in mm:
            add(f"| {o['name']} | {o['legistar_meetings']} | {o['primegov_video']} |")
    else:
        add("No cities have meetings from both Legistar and PrimeGov with actual meeting records.")
    add()

    # Video multi-source
    add("### Video from Multiple Sources (YouTube + PrimeGov/Swagit)")
    add()
    vm = overlaps["video_multi_source"]
    if vm:
        add(f"**{len(vm)} cities** have video from both YouTube and PrimeGov/Swagit:")
        add()
        add("| City | Video Count | Sources |")
        add("|------|-------------|---------|")
        for o in vm:
            add(f"| {o['name']} | {o['video_count']} | {', '.join(o['video_sources'])} |")
    else:
        add("No cities currently have video meetings indexed from both YouTube and PrimeGov/Swagit.")
    add()

    # Crime multi-source
    add("### Crime Data from Multiple Sources (FBI UCR + Socrata Crime)")
    add()
    cm = overlaps["crime_multi_source"]
    add(f"**{len(cm)} cities** have crime data from both FBI UCR and Socrata Crime portals.")
    add()
    if len(cm) <= 30:
        # List them all
        city_names = [o["name"] for o in cm]
        add(", ".join(city_names))
    else:
        # Just show count and a sample
        city_names = [o["name"] for o in cm[:15]]
        add(f"First 15: {', '.join(city_names)} ... and {len(cm) - 15} more.")
    add()

    # -- 5. Platform Coverage Matrix --
    add("## 5. Platform Coverage Matrix")
    add()
    for platform, city_list in sorted(platform_matrix.items()):
        add(f"### {platform.title()} ({len(city_list)} cities)")
        add()
        if len(city_list) <= 50:
            # Show all
            for ci in city_list:
                add(f"- {ci['name']}, {ci['state']}")
        else:
            add(f"All {len(city_list)} cities in the dataset use this platform.")
        add()

    # -- 6. Data Freshness Summary --
    add("## 6. Data Freshness Summary")
    add()
    fb = freshness["buckets"]
    add("| Time Window | Count |")
    add("|-------------|-------|")
    add(f"| Last 24 hours | {fb['last_24h']} |")
    add(f"| Last 7 days | {fb['last_7d']} |")
    add(f"| Last 30 days | {fb['last_30d']} |")
    add(f"| Older than 30 days | {fb['older_30d']} |")
    add(f"| No timestamp | {fb['no_timestamp']} |")
    add()
    add(f"- **Oldest enrichment**: {freshness.get('oldest_enrichment', 'N/A')}")
    add(f"- **Newest enrichment**: {freshness.get('newest_enrichment', 'N/A')}")
    add()

    # -- 7. Gaps Analysis --
    add("## 7. Gaps Analysis")
    add()
    add("### Summary of Missing Data")
    add()
    add("| Gap Type | Count | % of Total |")
    add("|----------|-------|------------|")
    gap_labels = {
        "no_population": "No population data",
        "no_officials": "No elected officials",
        "no_meetings": "No meeting records (agenda or video)",
        "no_legislation": "No legislation records",
        "no_city_website": "No city website URL",
        "zero_sections_populated": "Zero thematic sections populated",
        "low_quality_cities": "Low quality (grade D or F)",
        "no_economy_data": "No economy data",
        "no_safety_data": "No safety/crime data",
        "no_education_data": "No education data",
        "no_housing_data": "No housing data",
    }
    for key, label in gap_labels.items():
        cnt = gaps[key]["count"]
        pct = round(cnt / total * 100, 1) if total else 0
        add(f"| {label} | {cnt} | {pct}% |")
    add()

    # Detail: low quality cities
    lq = gaps["low_quality_cities"]["cities"]
    if lq:
        add("### Low Quality Cities (Grade D or F)")
        add()
        add("| City | Score | Grade |")
        add("|------|-------|-------|")
        for c in sorted(lq, key=lambda x: x.get("score", 0)):
            add(f"| {c['name']} | {c['score']} | {c['grade']} |")
        add()

    # Detail: no population
    np_list = gaps["no_population"]["cities"]
    if np_list:
        add("### Cities Without Population Data")
        add()
        names = [c["name"] for c in np_list]
        add(", ".join(names))
        add()

    # Detail: zero sections
    zs = gaps["zero_sections_populated"]["cities"]
    if zs:
        add("### Cities With Zero Thematic Sections")
        add()
        names = [c["name"] for c in zs]
        add(", ".join(names))
        add()

    # -- 8. Per-Source Error Analysis --
    add("## 8. Per-Source Error Analysis")
    add()
    add("Sources that returned errors (not just skipped) for cities.")
    add()
    # Gather cities with errors per source
    error_map = defaultdict(list)
    for c in cities:
        for src, status in c["source_statuses"].items():
            if status == "error":
                error_map[src].append(c["name"])

    if error_map:
        add("| Source | Error Count | Example Cities |")
        add("|--------|------------|----------------|")
        for src in CANONICAL_SOURCES:
            errs = error_map.get(src, [])
            if errs:
                examples = ", ".join(errs[:5])
                if len(errs) > 5:
                    examples += f" ... (+{len(errs)-5} more)"
                label = SOURCE_LABELS.get(src, src)
                add(f"| {label} | {len(errs)} | {examples} |")
        add()
    else:
        add("No errors found across any sources.")
        add()

    # -- 9. Population Distribution --
    add("## 9. Population Distribution")
    add()
    pops = [c["population"] for c in cities if c["population"] is not None and c["population"] > 0]
    if pops:
        pops_sorted = sorted(pops)
        add(f"- **Cities with population data**: {len(pops)}")
        add(f"- **Min**: {min(pops):,}")
        add(f"- **Max**: {max(pops):,}")
        add(f"- **Median**: {int(median(pops)):,}")
        add(f"- **Mean**: {int(mean(pops)):,}")
        add()

        # Buckets
        buckets = {"< 10K": 0, "10K-50K": 0, "50K-100K": 0, "100K-250K": 0,
                    "250K-500K": 0, "500K-1M": 0, "> 1M": 0}
        for p in pops:
            if p < 10_000:
                buckets["< 10K"] += 1
            elif p < 50_000:
                buckets["10K-50K"] += 1
            elif p < 100_000:
                buckets["50K-100K"] += 1
            elif p < 250_000:
                buckets["100K-250K"] += 1
            elif p < 500_000:
                buckets["250K-500K"] += 1
            elif p < 1_000_000:
                buckets["500K-1M"] += 1
            else:
                buckets["> 1M"] += 1

        add("| Population Range | Count |")
        add("|-----------------|-------|")
        for label, cnt in buckets.items():
            add(f"| {label} | {cnt} |")
        add()

    # -- 10. Full City Roster --
    add("## 10. Full City Roster")
    add()
    add("All cities sorted alphabetically with key coverage indicators.")
    add()
    add("| City | State | Pop. | Sources | Grade | Officials | Meetings | Legislation | Video | Sections |")
    add("|------|-------|------|---------|-------|-----------|----------|-------------|-------|----------|")
    for c in sorted(cities, key=lambda c: c["name"].lower()):
        pop = f"{c['population']:,}" if c["population"] else "-"
        grade = c.get("quality_grade", "-")
        meets = c["recent_meetings_count"] + c["video_meetings_count"]
        add(
            f"| {c['name']} | {c['state']} | {pop} "
            f"| {c['available_count']}/{c['total_sources_checked']} "
            f"| {grade} "
            f"| {c['officials_count'] or '-'} "
            f"| {meets or '-'} "
            f"| {c['recent_legislation_count'] or '-'} "
            f"| {c['video_meetings_count'] or '-'} "
            f"| {c['sections_populated_count']}/{len(THEMATIC_SECTIONS)} |"
        )
    add()

    add("---")
    add()
    add(f"*Report generated by `scripts/data_inventory.py` on {now_str}.*")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"[data_inventory] Scanning city profiles in {CITY_DIR}")

    # Find all city JSON files
    city_files = sorted(
        p for p in CITY_DIR.glob("*.json")
        if not p.name.startswith("_")
    )
    print(f"[data_inventory] Found {len(city_files)} city files")

    # Analyze each city
    cities = []
    errors = []
    for fp in city_files:
        try:
            result = analyze_city(fp)
            cities.append(result)
        except Exception as e:
            errors.append({"file": fp.name, "error": str(e)})
            print(f"  ERROR processing {fp.name}: {e}", file=sys.stderr)

    print(f"[data_inventory] Analyzed {len(cities)} cities ({len(errors)} errors)")

    # Source coverage aggregate
    source_coverage = {}
    for src in CANONICAL_SOURCES:
        avail = sum(1 for c in cities if c["source_statuses"].get(src) == "available")
        err = sum(1 for c in cities if c["source_statuses"].get(src) == "error")
        skip = sum(1 for c in cities if c["source_statuses"].get(src) == "skipped")
        missing = sum(1 for c in cities if c["source_statuses"].get(src) == "missing")
        source_coverage[src] = {
            "available": avail,
            "error": err,
            "skipped": skip,
            "missing": missing,
        }

    # Overlap analysis
    overlaps = compute_overlap_analysis(cities)
    print(f"[data_inventory] Overlap: {len(overlaps['meetings_multi_source'])} multi-source meetings, "
          f"{len(overlaps['crime_multi_source'])} multi-source crime")

    # Platform matrix
    platform_matrix = compute_platform_matrix(cities)
    print(f"[data_inventory] Platforms: {', '.join(f'{k}({len(v)})' for k, v in platform_matrix.items())}")

    # Freshness
    freshness = compute_freshness_summary(cities)
    print(f"[data_inventory] Freshness: {freshness['buckets']}")

    # Gaps
    gaps = compute_gaps_analysis(cities)
    print(f"[data_inventory] Gaps: "
          + ", ".join(f"{k}={v['count']}" for k, v in gaps.items()))

    # -- Write JSON report --
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    json_path = DOCS_DIR / "city-data-inventory.json"
    json_report = generate_json_report(cities, overlaps, platform_matrix, freshness, gaps, source_coverage)
    with open(json_path, "w") as f:
        json.dump(json_report, f, indent=2, default=str)
    print(f"[data_inventory] Wrote {json_path} ({json_path.stat().st_size:,} bytes)")

    # -- Write Markdown report --
    md_path = DOCS_DIR / "city-data-inventory.md"
    md_report = generate_markdown_report(cities, overlaps, platform_matrix, freshness, gaps, source_coverage)
    with open(md_path, "w") as f:
        f.write(md_report)
    print(f"[data_inventory] Wrote {md_path} ({md_path.stat().st_size:,} bytes)")

    print("[data_inventory] Done.")


if __name__ == "__main__":
    main()
