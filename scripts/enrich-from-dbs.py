#!/usr/bin/env python3
"""
Enrich city profiles with live data from Legistar, PrimeGov, CivicPlus, and Swagit DBs.

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

import re

# Read and write city profiles in public/data/cities/ (the single source of truth)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "public", "data", "cities")

# --- Cross-platform slug mapping ---
# Maps our Legistar slug -> PrimeGov city_slug
LEGISTAR_TO_PRIMEGOV = {
    "longbeach": "longbeach",
    "sanantonio": "sanantonio",
    "sanbernardino": "sanbernardino",
    "sanjose": "sanjoseca",
    "santaclara": "santaclaracounty",
    "lacounty": "lacity",
}

# State abbreviation to full name for CivicPlus matching
STATE_ABBREV = {
    'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California',
    'co':'Colorado','ct':'Connecticut','de':'Delaware','fl':'Florida','ga':'Georgia',
    'hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa',
    'ks':'Kansas','ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland',
    'ma':'Massachusetts','mi':'Michigan','mn':'Minnesota','ms':'Mississippi','mo':'Missouri',
    'mt':'Montana','ne':'Nebraska','nv':'Nevada','nh':'New Hampshire','nj':'New Jersey',
    'nm':'New Mexico','ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio',
    'ok':'Oklahoma','or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina',
    'sd':'South Dakota','tn':'Tennessee','tx':'Texas','ut':'Utah','vt':'Vermont',
    'va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin','wy':'Wyoming',
    'dc':'District of Columbia',
}


def build_civicplus_mapping(our_cities):
    """Build CivicPlus slug mapping with state verification."""
    # Build lookup: normalized_name -> {slug, state}
    def normalize(name):
        name = name.lower().strip()
        for prefix in ['city of ', 'town of ', 'village of ', 'county of ', 'city and county of ']:
            if name.startswith(prefix):
                name = name[len(prefix):]
        for suffix in [' city', ' county', ' township', ' borough', ' village', ' town']:
            if name.endswith(suffix):
                name = name[:-len(suffix)]
        return re.sub(r'[^a-z0-9]', '', name)

    by_name_state = {}
    for slug, info in our_cities.items():
        key = normalize(info['name'])
        state = info['state']
        if key and state:
            by_name_state[(key, state)] = slug

    return by_name_state, normalize


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


def get_primegov_meetings(cur, pg_slug, limit=10):
    """Get recent PrimeGov meetings with video links."""
    meetings = []

    # PrimeGov meetings table: city_slug, title, meeting_date, video_url, data (JSONB)
    cur.execute("""
        SELECT title, meeting_date, video_url
        FROM meetings
        WHERE city_slug = %s
          AND meeting_date IS NOT NULL
          AND video_url IS NOT NULL
          AND video_url != ''
        ORDER BY meeting_date DESC
        LIMIT %s
    """, (pg_slug, limit))

    for row in cur.fetchall():
        title, date, video = row
        date_str = date.strftime("%Y-%m-%d") if date else None
        is_youtube = bool(video and ('youtube' in video or 'youtu.be' in video))

        meetings.append({
            "date": date_str,
            "title": (title or "").strip()[:80],
            "has_video": True,
            "video_url": video,
            "is_youtube": is_youtube,
            "source": "primegov",
        })

    return meetings


def get_civicplus_news(cur, cp_slug, limit=8):
    """Get recent CivicPlus RSS news items for a city."""
    news = []

    cur.execute("""
        SELECT title, link, pub_date, description
        FROM rss_items
        WHERE site_key = %s
          AND title IS NOT NULL
          AND LENGTH(title) > 10
        ORDER BY pub_date DESC NULLS LAST
        LIMIT %s
    """, (cp_slug, limit))

    for row in cur.fetchall():
        title, link, pub_date, description = row
        date_str = pub_date.strftime("%Y-%m-%d") if pub_date else None

        # Clean description: strip HTML tags, truncate
        desc = description or ""
        desc = re.sub(r'<[^>]+>', '', desc).strip()
        if len(desc) > 200:
            desc = desc[:197] + "..."

        news.append({
            "title": title.strip()[:150],
            "url": link,
            "date": date_str,
            "description": desc if desc else None,
        })

    return news


def get_civicplus_agendas(cur, cp_slug, limit=10):
    """Get recent CivicPlus meeting agendas."""
    agendas = []

    cur.execute("""
        SELECT title, meeting_date, agenda_url, minutes_url
        FROM agendas
        WHERE site_key = %s
          AND meeting_date IS NOT NULL
        ORDER BY meeting_date DESC
        LIMIT %s
    """, (cp_slug, limit))

    for row in cur.fetchall():
        title, date, agenda, minutes = row
        date_str = date.strftime("%Y-%m-%d") if date else None

        agendas.append({
            "date": date_str,
            "body": (title or "").strip()[:80],
            "has_agenda": bool(agenda),
            "agenda_url": agenda if agenda else None,
            "has_minutes": bool(minutes),
            "has_video": False,
            "source": "civicplus",
        })

    return agendas


def get_legistar_url(slug):
    """Construct the public Legistar URL for a city."""
    return f"https://{slug}.legistar.com"


def enrich_city(slug, dry_run=False, pg_conn=None, cp_conn=None, cp_mapping=None, cp_normalize=None, our_cities=None):
    """Enrich a single city profile with DB data from all platforms."""
    profile_path = os.path.join(DATA_DIR, f"{slug}.json")
    if not os.path.exists(profile_path):
        return None

    with open(profile_path) as f:
        profile = json.load(f)

    enrichment = {
        "officials": {"body_name": None, "members": []},
        "recent_meetings": [],
        "recent_legislation": [],
        "government_news": [],
        "video_meetings": [],
        "legistar_url": get_legistar_url(slug),
        "data_platforms": ["legistar"],
        "enriched_at": datetime.now().isoformat(),
    }

    # --- Legistar enrichment (primary) ---
    try:
        conn = get_conn("legistar")
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM events WHERE city_slug = %s", (slug,))
        if cur.fetchone()[0] > 0:
            enrichment["officials"] = get_current_officials(cur, slug)
            enrichment["recent_meetings"] = get_recent_meetings(cur, slug)
            enrichment["recent_legislation"] = get_recent_legislation(cur, slug)

        conn.close()
    except Exception as e:
        print(f"  WARNING: Legistar query failed for {slug}: {e}")

    # --- PrimeGov enrichment (video meetings) ---
    pg_slug = LEGISTAR_TO_PRIMEGOV.get(slug)
    if pg_slug and pg_conn:
        try:
            pg_cur = pg_conn.cursor()
            videos = get_primegov_meetings(pg_cur, pg_slug)
            if videos:
                enrichment["video_meetings"] = videos
                enrichment["data_platforms"].append("primegov")
        except Exception as e:
            print(f"  WARNING: PrimeGov query failed for {slug} (pg:{pg_slug}): {e}")

    # --- CivicPlus enrichment (news + agendas) ---
    if cp_conn and cp_mapping and cp_normalize and our_cities:
        city_info = our_cities.get(slug, {})
        city_name_norm = cp_normalize(city_info.get('name', ''))
        city_state = city_info.get('state', '')

        # Find matching CivicPlus slug: state-cityname format
        cp_slug = None
        for state_code, state_name in STATE_ABBREV.items():
            if state_name == city_state:
                candidate = f"{state_code}-{city_info.get('name', '').lower().replace(' ', '')}"
                # Also try with hyphens
                candidate2 = f"{state_code}-{city_info.get('name', '').lower().replace(' ', '-')}"
                for c in [candidate, candidate2]:
                    try:
                        cp_cur = cp_conn.cursor()
                        cp_cur.execute("SELECT COUNT(*) FROM rss_items WHERE site_key = %s", (c,))
                        if cp_cur.fetchone()[0] > 0:
                            cp_slug = c
                            break
                        cp_cur.execute("SELECT COUNT(*) FROM agendas WHERE site_key = %s", (c,))
                        if cp_cur.fetchone()[0] > 0:
                            cp_slug = c
                            break
                    except:
                        pass
                if cp_slug:
                    break

        if cp_slug:
            try:
                cp_cur = cp_conn.cursor()
                news = get_civicplus_news(cp_cur, cp_slug)
                if news:
                    enrichment["government_news"] = news
                    if "civicplus" not in enrichment["data_platforms"]:
                        enrichment["data_platforms"].append("civicplus")

                agendas = get_civicplus_agendas(cp_cur, cp_slug)
                if agendas and not enrichment["recent_meetings"]:
                    # Only use CivicPlus agendas if Legistar didn't have meetings
                    enrichment["recent_meetings"] = agendas
            except Exception as e:
                print(f"  WARNING: CivicPlus query failed for {slug} (cp:{cp_slug}): {e}")

    # Merge enrichment into profile
    profile["officials"] = enrichment["officials"]
    profile["recent_meetings"] = enrichment["recent_meetings"]
    profile["recent_legislation"] = enrichment["recent_legislation"]
    profile["government_news"] = enrichment["government_news"]
    profile["video_meetings"] = enrichment["video_meetings"]
    profile["legistar_url"] = enrichment["legistar_url"]
    profile["data_platforms"] = enrichment["data_platforms"]
    profile["enriched_at"] = enrichment["enriched_at"]

    if dry_run:
        return profile

    # Write enriched profile to public/data/cities/
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(profile_path, "w") as f:
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
        # List all city JSON files, excluding meta files (_index.json, _benchmarks.json)
        slugs = sorted([
            os.path.basename(f).replace(".json", "")
            for f in glob.glob(os.path.join(DATA_DIR, "*.json"))
            if not os.path.basename(f).startswith("_")
        ])

    # Load city metadata for cross-platform matching
    our_cities = {}
    for slug in slugs:
        path = os.path.join(DATA_DIR, f"{slug}.json")
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            our_cities[slug] = {
                'name': data.get('identity', {}).get('name', ''),
                'state': data.get('identity', {}).get('state', ''),
            }

    # Build CivicPlus mapping
    cp_name_state_map, cp_normalize = build_civicplus_mapping(our_cities)

    # Connect to secondary DBs
    pg_conn = None
    cp_conn = None
    try:
        pg_conn = get_conn("primegov")
        print("  Connected to PrimeGov DB")
    except Exception as e:
        print(f"  WARNING: Could not connect to PrimeGov: {e}")

    try:
        cp_conn = get_conn("civicplus")
        print("  Connected to CivicPlus DB")
    except Exception as e:
        print(f"  WARNING: Could not connect to CivicPlus: {e}")

    print(f"\nEnriching {len(slugs)} city profiles...")

    stats = {
        "total": 0, "with_officials": 0, "with_meetings": 0,
        "with_legislation": 0, "with_news": 0, "with_videos": 0,
        "errors": 0
    }

    for i, slug in enumerate(slugs):
        stats["total"] += 1
        try:
            profile = enrich_city(
                slug, dry_run=args.dry_run,
                pg_conn=pg_conn, cp_conn=cp_conn,
                cp_mapping=cp_name_state_map, cp_normalize=cp_normalize,
                our_cities=our_cities,
            )
            if not profile:
                continue

            officials = profile.get("officials", {})
            n_officials = len(officials.get("members", []))
            n_meetings = len(profile.get("recent_meetings", []))
            n_legislation = len(profile.get("recent_legislation", []))
            n_news = len(profile.get("government_news", []))
            n_videos = len(profile.get("video_meetings", []))

            if n_officials > 0:
                stats["with_officials"] += 1
            if n_meetings > 0:
                stats["with_meetings"] += 1
            if n_legislation > 0:
                stats["with_legislation"] += 1
            if n_news > 0:
                stats["with_news"] += 1
            if n_videos > 0:
                stats["with_videos"] += 1

            platforms = profile.get("data_platforms", [])
            status = f"officials={n_officials}, meetings={n_meetings}, legislation={n_legislation}, news={n_news}, videos={n_videos}, platforms={platforms}"
            if (i + 1) % 10 == 0 or args.city:
                print(f"  [{i+1}/{len(slugs)}] {slug}: {status}")

        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR: {slug}: {e}")

    # Close secondary connections
    if pg_conn:
        pg_conn.close()
    if cp_conn:
        cp_conn.close()

    print(f"\nDone! {stats['total']} cities processed:")
    print(f"  {stats['with_officials']} with current officials")
    print(f"  {stats['with_meetings']} with recent/upcoming meetings")
    print(f"  {stats['with_legislation']} with recent legislation")
    print(f"  {stats['with_news']} with government news (CivicPlus)")
    print(f"  {stats['with_videos']} with video meetings (PrimeGov)")
    print(f"  {stats['errors']} errors")


if __name__ == "__main__":
    main()
