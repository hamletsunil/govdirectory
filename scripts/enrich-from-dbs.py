#!/usr/bin/env python3
"""
Enrich SimCity profiles with live data from Legistar, PrimeGov, CivicPlus, and Swagit DBs.

Adds to each city profile:
  - officials: current elected officials (name, email, phone, committees)
  - recent_meetings: upcoming and recent meetings with agenda links
  - recent_legislation: notable recent legislative items
  - video_archive: links to meeting videos (Swagit/YouTube)

Usage:
  python scripts/enrich-from-dbs.py                    # Enrich all cities
  python scripts/enrich-from-dbs.py --city oakland     # Enrich one city
  python scripts/enrich-from-dbs.py --dry-run          # Preview without writing
"""

import argparse
import json
import os
import glob
import sys
from datetime import datetime, timedelta

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 required. pip install psycopg2-binary")
    sys.exit(1)

# --- Database connections ---
DB_URLS = {
    "legistar": os.environ.get("LEGISTAR_DB_URL",
        "postgresql://postgres:LdaVWImnAOIOROJYecOeqWTsvegGAVKm@maglev.proxy.rlwy.net:18553/railway"),
    "primegov": os.environ.get("PRIMEGOV_DB_URL",
        "postgresql://postgres:qnSImUkSZkCrbWFrHHScXXuxLtXtOYqw@caboose.proxy.rlwy.net:56101/railway"),
    "civicplus": os.environ.get("CIVICPLUS_DB_URL",
        "postgresql://postgres:eqcpVOkuozlyvdFAbGsZpFMJTvoAEoqC@metro.proxy.rlwy.net:17752/railway"),
    "swagit": os.environ.get("SWAGIT_DB_URL",
        "postgresql://postgres:omqRWdbiJunGjTyBpEREbySsbIxYoDkQ@crossover.proxy.rlwy.net:28507/railway"),
}

PROFILE_DIR = os.path.expanduser("~/simcity-inventory/output/profiles/")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data", "cities")

# Body type patterns that indicate the main governing body
COUNCIL_BODY_TYPES = ("Primary Legislative Body", "City Council", "Legislative Body")
COUNCIL_NAME_PATTERNS = ("%city council%", "%board of supervisors%", "%board of commissioners%",
                         "%board of aldermen%", "%town council%", "%village board%",
                         "%borough council%", "%township committee%")

# Date thresholds
NOW = datetime.now().strftime("%Y-%m-%dT00:00:00")
TODAY = datetime.now().strftime("%Y-%m-%d")
THREE_MONTHS_AGO = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%dT00:00:00")
ONE_YEAR_AGO = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%dT00:00:00")


def get_conn(db_name):
    """Get a database connection."""
    return psycopg2.connect(DB_URLS[db_name])


def get_current_officials(cur, slug):
    """Extract current elected officials for a city from Legistar office_records + persons."""

    # Step 1: Find ALL council-type body IDs for this city
    cur.execute("""
        SELECT entity_id, data->>'BodyName', data->>'BodyTypeName'
        FROM bodies
        WHERE city_slug = %s
          AND data->>'BodyActiveFlag' = '1'
          AND (data->>'BodyTypeName' IN %s
               OR LOWER(data->>'BodyName') LIKE ANY(%s))
        ORDER BY CASE
            WHEN data->>'BodyTypeName' = 'Primary Legislative Body' THEN 0
            WHEN data->>'BodyTypeName' = 'City Council' THEN 1
            ELSE 2
        END
    """, (slug, COUNCIL_BODY_TYPES, list(COUNCIL_NAME_PATTERNS)))

    council_bodies = cur.fetchall()
    if not council_bodies:
        return {"body_name": None, "members": []}

    body_name = council_bodies[0][1]  # Use the primary body's name
    body_ids = tuple(r[0] for r in council_bodies)

    # Step 2: Get current members across ALL council-type bodies, deduplicate by name
    # This handles cities like Oakland where current council sits on concurrent/special meeting bodies
    cur.execute("""
        SELECT DISTINCT ON (data->>'OfficeRecordFullName')
            data->>'OfficeRecordFullName' as name,
            data->>'OfficeRecordEmail' as email,
            data->>'OfficeRecordTitle' as title,
            data->>'OfficeRecordStartDate' as start_date,
            data->>'OfficeRecordEndDate' as end_date,
            data->>'OfficeRecordPersonId' as person_id
        FROM office_records
        WHERE city_slug = %s
          AND CAST(data->>'OfficeRecordBodyId' AS INTEGER) IN %s
          AND (data->>'OfficeRecordEndDate' IS NULL
               OR data->>'OfficeRecordEndDate' > %s)
          AND data->>'OfficeRecordStartDate' IS NOT NULL
        ORDER BY data->>'OfficeRecordFullName', data->>'OfficeRecordStartDate' DESC
    """, (slug, body_ids, NOW))

    members = []
    for row in cur.fetchall():
        name, email, title, start, end, person_id = row
        if not name or not name.strip():
            continue

        member = {
            "name": name.strip(),
            "email": email if email and email.strip() else None,
            "title": title if title and title.strip() else None,
            "start_date": start[:10] if start else None,
        }

        # Enrich with person record data (phone, website)
        if person_id:
            cur.execute("""
                SELECT data->>'PersonEmail', data->>'PersonPhone', data->>'PersonWWW'
                FROM persons
                WHERE city_slug = %s AND entity_id = %s
            """, (slug, int(person_id)))
            person = cur.fetchone()
            if person:
                if not member["email"] and person[0] and person[0].strip():
                    member["email"] = person[0].strip()
                if person[1] and person[1].strip():
                    member["phone"] = person[1].strip()
                if person[2] and person[2].strip():
                    member["website"] = person[2].strip()

        members.append(member)

    # Step 3: Also find what committees each member sits on
    for member in members:
        cur.execute("""
            SELECT DISTINCT data->>'OfficeRecordBodyName'
            FROM office_records
            WHERE city_slug = %s
              AND data->>'OfficeRecordFullName' = %s
              AND (data->>'OfficeRecordEndDate' IS NULL OR data->>'OfficeRecordEndDate' > %s)
              AND data->>'OfficeRecordBodyName' != %s
              AND data->>'OfficeRecordBodyName' NOT LIKE '%%CANCEL%%'
            ORDER BY data->>'OfficeRecordBodyName'
        """, (slug, member["name"], NOW, body_name))
        committees = [r[0].strip().lstrip("* ") for r in cur.fetchall() if r[0]]
        # Filter to actual committee names (not special meetings, etc.)
        committees = [c for c in committees if len(c) < 80 and "Special" not in c and "Concurrent" not in c]
        if committees:
            member["committees"] = committees[:5]  # Max 5

    return {
        "body_name": body_name,
        "members": members,
    }


def get_recent_meetings(cur, slug, limit=10):
    """Get upcoming and recent meetings."""
    meetings = []

    # Upcoming meetings (next 30 days)
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")
    cur.execute("""
        SELECT
            data->>'EventDate' as date,
            data->>'EventBodyName' as body,
            data->>'EventLocation' as location,
            data->>'EventAgendaFile' as agenda_url,
            data->>'EventMinutesFile' as minutes_url,
            data->>'EventVideoPath' as video_url
        FROM events
        WHERE city_slug = %s
          AND data->>'EventDate' >= %s
          AND data->>'EventDate' <= %s
        ORDER BY data->>'EventDate'
        LIMIT %s
    """, (slug, TODAY, thirty_days, limit))

    for row in cur.fetchall():
        date, body, location, agenda, minutes, video = row
        meetings.append({
            "date": date[:10] if date else None,
            "body": body.strip().lstrip("* ") if body else None,
            "location": location.strip() if location and location.strip() else None,
            "has_agenda": bool(agenda),
            "agenda_url": agenda if agenda else None,
            "has_minutes": bool(minutes),
            "has_video": bool(video),
            "upcoming": True,
        })

    # Recent past meetings (last 30 days)
    thirty_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")
    cur.execute("""
        SELECT
            data->>'EventDate' as date,
            data->>'EventBodyName' as body,
            data->>'EventLocation' as location,
            data->>'EventAgendaFile' as agenda_url,
            data->>'EventMinutesFile' as minutes_url,
            data->>'EventVideoPath' as video_url
        FROM events
        WHERE city_slug = %s
          AND data->>'EventDate' >= %s
          AND data->>'EventDate' < %s
        ORDER BY data->>'EventDate' DESC
        LIMIT %s
    """, (slug, thirty_ago, TODAY, limit))

    for row in cur.fetchall():
        date, body, location, agenda, minutes, video = row
        meetings.append({
            "date": date[:10] if date else None,
            "body": body.strip().lstrip("* ") if body else None,
            "location": location.strip() if location and location.strip() else None,
            "has_agenda": bool(agenda),
            "agenda_url": agenda if agenda else None,
            "has_minutes": bool(minutes),
            "has_video": bool(video),
            "upcoming": False,
        })

    return meetings


def get_recent_legislation(cur, slug, limit=10):
    """Get recent notable legislative items."""
    # Focus on substantive types, not procedural items
    cur.execute("""
        SELECT
            data->>'MatterTitle' as title,
            data->>'MatterTypeName' as type,
            data->>'MatterStatusName' as status,
            data->>'MatterIntroDate' as intro_date,
            data->>'MatterFile' as file_num,
            data->>'MatterPassedDate' as passed_date
        FROM matters
        WHERE city_slug = %s
          AND data->>'MatterIntroDate' > %s
          AND data->>'MatterTypeName' IS NOT NULL
          AND data->>'MatterTitle' IS NOT NULL
          AND LENGTH(data->>'MatterTitle') > 20
        ORDER BY data->>'MatterIntroDate' DESC
        LIMIT %s
    """, (slug, THREE_MONTHS_AGO, limit * 3))  # Fetch extra, then filter

    legislation = []
    seen_titles = set()

    for row in cur.fetchall():
        title, mtype, status, intro, file_num, passed = row
        if not title:
            continue

        # Clean up title
        title_clean = title.strip()
        # Skip procedural items
        lower = title_clean.lower()
        if any(skip in lower for skip in [
            "approval of the draft minutes",
            "determination of schedule",
            "review of draft agendas",
            "pending list",
        ]):
            continue

        # Deduplicate
        title_key = lower[:60]
        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)

        # Clean title - remove "Subject:" prefix patterns
        for prefix in ["Subject:", "Subject: ", "Subject:\t"]:
            if title_clean.startswith(prefix):
                title_clean = title_clean[len(prefix):].strip()

        legislation.append({
            "title": title_clean[:200],
            "type": mtype,
            "status": status,
            "intro_date": intro[:10] if intro else None,
            "file_number": file_num,
            "passed_date": passed[:10] if passed else None,
        })

        if len(legislation) >= limit:
            break

    return legislation


def get_legistar_url(slug):
    """Construct the public Legistar URL for a city."""
    return f"https://{slug}.legistar.com"


def enrich_city(slug, dry_run=False):
    """Enrich a single city profile with DB data."""
    profile_path = os.path.join(PROFILE_DIR, f"{slug}.json")
    if not os.path.exists(profile_path):
        return None

    with open(profile_path) as f:
        profile = json.load(f)

    enrichment = {
        "officials": {"body_name": None, "members": []},
        "recent_meetings": [],
        "recent_legislation": [],
        "legistar_url": get_legistar_url(slug),
        "enriched_at": datetime.now().isoformat(),
    }

    try:
        conn = get_conn("legistar")
        cur = conn.cursor()

        # Check if this city exists in Legistar
        cur.execute("SELECT COUNT(*) FROM events WHERE city_slug = %s", (slug,))
        if cur.fetchone()[0] > 0:
            enrichment["officials"] = get_current_officials(cur, slug)
            enrichment["recent_meetings"] = get_recent_meetings(cur, slug)
            enrichment["recent_legislation"] = get_recent_legislation(cur, slug)

        conn.close()
    except Exception as e:
        print(f"  WARNING: Legistar query failed for {slug}: {e}")

    # Merge enrichment into profile
    profile["officials"] = enrichment["officials"]
    profile["recent_meetings"] = enrichment["recent_meetings"]
    profile["recent_legislation"] = enrichment["recent_legislation"]
    profile["legistar_url"] = enrichment["legistar_url"]
    profile["enriched_at"] = enrichment["enriched_at"]

    if dry_run:
        return profile

    # Write enriched profile back to SimCity output
    with open(profile_path, "w") as f:
        json.dump(profile, f, indent=2, default=str)

    # Also write to govdirectory public data
    output_path = os.path.join(OUTPUT_DIR, f"{slug}.json")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(profile, f, separators=(",", ":"), default=str)

    return profile


def main():
    parser = argparse.ArgumentParser(description="Enrich city profiles from government DBs")
    parser.add_argument("--city", help="Enrich a single city by slug")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    if args.city:
        slugs = [args.city]
    else:
        slugs = sorted([
            os.path.basename(f).replace(".json", "")
            for f in glob.glob(os.path.join(PROFILE_DIR, "*.json"))
        ])

    print(f"Enriching {len(slugs)} city profiles...")

    stats = {"total": 0, "with_officials": 0, "with_meetings": 0, "with_legislation": 0, "errors": 0}

    for i, slug in enumerate(slugs):
        stats["total"] += 1
        try:
            profile = enrich_city(slug, dry_run=args.dry_run)
            if not profile:
                continue

            officials = profile.get("officials", {})
            n_officials = len(officials.get("members", []))
            n_meetings = len(profile.get("recent_meetings", []))
            n_legislation = len(profile.get("recent_legislation", []))

            if n_officials > 0:
                stats["with_officials"] += 1
            if n_meetings > 0:
                stats["with_meetings"] += 1
            if n_legislation > 0:
                stats["with_legislation"] += 1

            status = f"officials={n_officials}, meetings={n_meetings}, legislation={n_legislation}"
            if (i + 1) % 10 == 0 or args.city:
                print(f"  [{i+1}/{len(slugs)}] {slug}: {status}")

        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR: {slug}: {e}")

    print(f"\nDone! {stats['total']} cities processed:")
    print(f"  {stats['with_officials']} with current officials")
    print(f"  {stats['with_meetings']} with recent/upcoming meetings")
    print(f"  {stats['with_legislation']} with recent legislation")
    print(f"  {stats['errors']} errors")


if __name__ == "__main__":
    main()
