#!/usr/bin/env python3
"""
Swagit Video Re-Scraper for GovDirectory

Scrapes all Swagit client websites and updates the Railway PostgreSQL database.
Handles three site layouts:
  1. Single-view sites (old style): All videos in one page with year-based tabs
     URL: https://{slug}.new.swagit.com/views/{id}
  2. Multi-category sites (old style): Videos behind category tabs with pagination
     URL: https://{slug}.new.swagit.com/views/{id}/{category}
  3. New-style sites: Categories as top-level paths with pagination
     URL: https://{slug}.new.swagit.com/{category-name}

Usage:
    python3 scrape-swagit.py                    # Scrape all 49 clients
    python3 scrape-swagit.py --slugs austintx   # Scrape specific client(s)
    python3 scrape-swagit.py --dry-run           # Preview without DB writes
    python3 scrape-swagit.py --max-pages 10      # Limit pagination depth

Environment:
    SWAGIT_DB_URL  - PostgreSQL connection string (falls back to hardcoded Railway URL)
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Tuple, Set

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DB_URL = os.environ.get(
    "SWAGIT_DB_URL",
    "postgresql://postgres:omqRWdbiJunGjTyBpEREbySsbIxYoDkQ@crossover.proxy.rlwy.net:28507/railway",
)

REQUEST_TIMEOUT = 30
RATE_LIMIT_DELAY = 0.35
MAX_PAGES_DEFAULT = 500
MAX_RETRIES = 2
USER_AGENT = "GovDirectory-SwagitScraper/1.0 (+https://github.com/govdirectory)"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("swagit-scraper")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class VideoRecord:
    city_slug: str
    video_id: int
    title: str
    video_date: Optional[date]
    duration: str
    video_uuid: Optional[str] = None
    hls_url: Optional[str] = None
    download_url: Optional[str] = None
    agenda_url: Optional[str] = None
    data: dict = field(default_factory=dict)


@dataclass
class ScrapeResult:
    slug: str
    success: bool
    videos_found: int = 0
    videos_new: int = 0
    videos_updated: int = 0
    error: Optional[str] = None
    elapsed_seconds: float = 0.0
    categories_scraped: int = 0


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

_session: Optional[requests.Session] = None


def get_session() -> requests.Session:
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({"User-Agent": USER_AGENT})
    return _session


def fetch(url: str, retries: int = MAX_RETRIES) -> Optional[requests.Response]:
    session = get_session()
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            time.sleep(RATE_LIMIT_DELAY)
            if resp.status_code == 200:
                return resp
            if resp.status_code in (404, 410):
                return None
            log.warning("  HTTP %d for %s (attempt %d/%d)", resp.status_code, url, attempt, retries)
        except requests.RequestException as exc:
            log.warning("  Request error for %s: %s (attempt %d/%d)", url, exc, attempt, retries)
        if attempt < retries:
            time.sleep(2 * attempt)
    return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

DATE_FORMATS = ["%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]


def parse_date(text: str) -> Optional[date]:
    text = text.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

def extract_videos_from_html(html: str, city_slug: str) -> List[VideoRecord]:
    """
    Parse HTML and extract video records from tables.
    Handles two layouts:
      Old-style: <td>Title</td><td>Date</td><td>Duration</td><td>Links</td>
      New-style: <td><a>Title</a><br/>Date</td><td>Duration<br/>items</td>
    """
    soup = BeautifulSoup(html, "html.parser")
    records: List[VideoRecord] = []
    seen_ids: Set[int] = set()

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            link = row.find("a", href=re.compile(r"/videos/\d+$"))
            if not link:
                continue
            match = re.search(r"/videos/(\d+)", link["href"])
            if not match:
                continue
            video_id = int(match.group(1))
            if video_id in seen_ids:
                continue
            seen_ids.add(video_id)

            tds = row.find_all("td")
            title = ""
            date_str = ""
            duration = ""

            if len(tds) >= 3:
                # Old-style layout: separate columns for title, date, duration
                title = tds[0].get_text(strip=True)
                date_str = tds[1].get_text(strip=True)
                duration = tds[2].get_text(strip=True)
            elif len(tds) >= 1:
                # New-style layout: title+date in tds[0], duration in tds[1]
                # Title is the link text
                title = link.get_text(strip=True)
                # Date is after <br/> in tds[0]
                br = tds[0].find("br")
                if br and br.next_sibling:
                    sibling = br.next_sibling
                    date_str = sibling.strip() if isinstance(sibling, str) else sibling.get_text(strip=True)
                # Duration is in tds[1] (text before <br/>)
                if len(tds) >= 2:
                    dur_td = tds[1]
                    dur_br = dur_td.find("br")
                    if dur_br:
                        # Get text before the <br/>
                        for child in dur_td.children:
                            if child == dur_br:
                                break
                            if isinstance(child, str) and child.strip():
                                duration = child.strip()
                                break
                    else:
                        dur_text = dur_td.get_text(strip=True)
                        # Filter out non-duration text like "X items"
                        if dur_text and not dur_text.endswith("items"):
                            duration = dur_text
            else:
                title = link.get_text(strip=True)

            video_date = parse_date(date_str) if date_str else None

            agenda_url = None
            for a in row.find_all("a", href=True):
                if "/agenda" in a["href"]:
                    agenda_url = a["href"]
                    if not agenda_url.startswith("http"):
                        agenda_url = f"https://{city_slug}.new.swagit.com{agenda_url}"
                    break

            download_url = f"https://{city_slug}.new.swagit.com/videos/{video_id}/download"

            records.append(VideoRecord(
                city_slug=city_slug,
                video_id=video_id,
                title=title[:500],
                video_date=video_date,
                duration=duration,
                download_url=download_url,
                agenda_url=agenda_url,
                data={
                    "video_id": video_id,
                    "title": title[:500],
                    "date": str(video_date) if video_date else None,
                    "duration": duration,
                },
            ))

    return records


def has_next_page(html: str) -> bool:
    """Check if pagination has a 'Next' link."""
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        if a.get_text(strip=True).startswith("Next"):
            return True
    return False


# ---------------------------------------------------------------------------
# Site discovery and scraping
# ---------------------------------------------------------------------------

def discover_site(slug: str) -> Optional[Dict]:
    """
    Discover site structure. Returns a dict with:
      'type': 'old_single' | 'old_multi' | 'new_style' | 'empty'
      'base_url': str
      'view_id': int or None
      'categories': [(path, name), ...]
      'default_vids': int (video count on default page)
    """
    base_url = f"https://{slug}.new.swagit.com"

    # Try old-style /views/default/ first
    resp = fetch(f"{base_url}/views/default/")

    if resp is not None:
        final_url = resp.url
        view_match = re.search(r"/views/(\d+)", final_url)
        if view_match:
            view_id = int(view_match.group(1))
            soup = BeautifulSoup(resp.text, "html.parser")

            # Extract old-style categories (/views/{id}/{cat})
            categories = []
            for li in soup.find_all("li", role="presentation"):
                a = li.find("a", href=True)
                if a and f"/views/{view_id}/" in a["href"]:
                    categories.append((a["href"], a.get_text(strip=True)))

            # Count videos on default page
            vid_count = len(set(re.findall(r"/videos/(\d+)", resp.text)))

            if vid_count > 0 and not categories:
                return {
                    "type": "old_single",
                    "base_url": base_url,
                    "view_id": view_id,
                    "categories": [],
                    "default_vids": vid_count,
                }
            elif categories:
                return {
                    "type": "old_multi",
                    "base_url": base_url,
                    "view_id": view_id,
                    "categories": categories,
                    "default_vids": vid_count,
                }
            else:
                # No videos, no categories -- maybe empty
                return {
                    "type": "empty",
                    "base_url": base_url,
                    "view_id": view_id,
                    "categories": [],
                    "default_vids": 0,
                }

    # Try new-style root
    resp = fetch(f"{base_url}/")
    if resp is None:
        return None

    # New-style sites redirect to /{category-name}
    soup = BeautifulSoup(resp.text, "html.parser")

    # Look for the sidebar nav (nav-pills-stacked-swagit or nav-tabs-swagit)
    categories = []
    for nav in soup.find_all("ul", class_=re.compile(r"nav.*(pills|tabs).*swagit", re.I)):
        for a in nav.find_all("a", href=True):
            href = a["href"]
            name = a.get_text(strip=True)
            # Derive name from path if link text is empty (JS-rendered sites)
            if not name and href.startswith("/"):
                name = href.strip("/").split("?")[0].replace("-", " ").title()
            # Only root-level paths (not /videos/, /admin/, etc.)
            if (href.startswith("/") and
                not href.startswith("/videos/") and
                not href.startswith("/admin") and
                not href.startswith("/events") and
                "page=" not in href and
                len(href) > 1):
                categories.append((href, name or href))

    if not categories:
        # Fallback: extract from all links
        seen_paths: Set[str] = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            name = a.get_text(strip=True)
            if not name and href.startswith("/"):
                name = href.strip("/").split("?")[0].replace("-", " ").title()
            if (href.startswith("/") and
                not re.match(r"/videos/\d+", href) and
                not href.startswith("/admin") and
                not href.startswith("/events") and
                "page=" not in href and
                href != "/" and
                len(href) > 1 and
                href not in seen_paths):
                seen_paths.add(href)
                categories.append((href, name or href))

    vid_count = len(set(re.findall(r"/videos/(\d+)", resp.text)))

    if categories or vid_count > 0:
        return {
            "type": "new_style",
            "base_url": base_url,
            "view_id": None,
            "categories": categories,
            "default_vids": vid_count,
        }

    return {
        "type": "empty",
        "base_url": base_url,
        "view_id": None,
        "categories": [],
        "default_vids": 0,
    }


def scrape_paginated(slug: str, base_url: str, path: str, max_pages: int) -> List[VideoRecord]:
    """Scrape a paginated category path. Works for both old and new style sites."""
    all_records: List[VideoRecord] = []
    seen_ids: Set[int] = set()

    for page in range(1, max_pages + 1):
        if page == 1:
            url = f"{base_url}{path}"
        else:
            sep = "&" if "?" in path else "?"
            url = f"{base_url}{path}{sep}page={page}"

        resp = fetch(url)
        if resp is None:
            break

        page_records = extract_videos_from_html(resp.text, slug)

        new_on_page = 0
        for rec in page_records:
            if rec.video_id not in seen_ids:
                seen_ids.add(rec.video_id)
                all_records.append(rec)
                new_on_page += 1

        if new_on_page == 0:
            break

        if not has_next_page(resp.text):
            break

    return all_records


def scrape_client(slug: str, max_pages: int) -> Tuple[List[VideoRecord], int]:
    """Full scrape of one Swagit client."""
    site = discover_site(slug)
    if site is None:
        raise RuntimeError(f"Could not access Swagit site for {slug}")

    site_type = site["type"]
    base_url = site["base_url"]
    categories = site["categories"]
    default_vids = site["default_vids"]

    log.info("  %s: type=%s, view_id=%s, %d categories, %d default-page vids",
             slug, site_type, site["view_id"], len(categories), default_vids)

    if site_type == "empty":
        log.warning("  %s: empty site (no videos, no categories)", slug)
        return [], 0

    all_records: List[VideoRecord] = []
    seen_ids: Set[int] = set()
    categories_scraped = 0

    # For old_single: grab the default page (has everything)
    if site_type == "old_single":
        view_id = site["view_id"]
        resp = fetch(f"{base_url}/views/{view_id}")
        if resp:
            records = extract_videos_from_html(resp.text, slug)
            for rec in records:
                if rec.video_id not in seen_ids:
                    seen_ids.add(rec.video_id)
                    all_records.append(rec)
            categories_scraped = 1
        return all_records, categories_scraped

    # For old_multi: scrape default page + each category with pagination
    if site_type == "old_multi":
        # Default page may have some videos (first category)
        view_id = site["view_id"]
        resp = fetch(f"{base_url}/views/{view_id}")
        if resp:
            records = extract_videos_from_html(resp.text, slug)
            for rec in records:
                if rec.video_id not in seen_ids:
                    seen_ids.add(rec.video_id)
                    all_records.append(rec)
            if records:
                categories_scraped = 1

        # Scrape each category with pagination
        for cat_path, cat_name in categories:
            log.info("  %s: scraping category '%s'", slug, cat_name)
            cat_records = scrape_paginated(slug, base_url, cat_path, max_pages)
            new_count = 0
            for rec in cat_records:
                if rec.video_id not in seen_ids:
                    seen_ids.add(rec.video_id)
                    all_records.append(rec)
                    new_count += 1
            log.info("  %s: '%s' -> %d new (%d total on pages)",
                     slug, cat_name, new_count, len(cat_records))
            categories_scraped += 1

        return all_records, categories_scraped

    # For new_style: scrape each category (all paginated)
    if site_type == "new_style":
        # If the default page already has videos (it redirected to first category)
        # we still scrape all categories systematically
        for cat_path, cat_name in categories:
            log.info("  %s: scraping category '%s' (%s)", slug, cat_name, cat_path)
            cat_records = scrape_paginated(slug, base_url, cat_path, max_pages)
            new_count = 0
            for rec in cat_records:
                if rec.video_id not in seen_ids:
                    seen_ids.add(rec.video_id)
                    all_records.append(rec)
                    new_count += 1
            if new_count > 0:
                log.info("  %s: '%s' -> %d new (%d total on pages)",
                         slug, cat_name, new_count, len(cat_records))
            categories_scraped += 1

        return all_records, categories_scraped

    return all_records, categories_scraped


# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

def get_db_connection():
    return psycopg2.connect(DB_URL)


def get_existing_video_ids(conn, slug: str) -> Dict[int, date]:
    cur = conn.cursor()
    cur.execute("SELECT video_id, video_date FROM videos WHERE city_slug = %s", (slug,))
    result = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    return result


def upsert_videos(conn, records: List[VideoRecord]) -> Tuple[int, int]:
    if not records:
        return 0, 0

    cur = conn.cursor()
    new_count = 0
    updated_count = 0

    for rec in records:
        cur.execute("""
            INSERT INTO videos (city_slug, video_id, title, video_date, duration,
                                video_uuid, hls_url, download_url, agenda_url, data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (city_slug, video_id) DO UPDATE SET
                title = EXCLUDED.title,
                video_date = COALESCE(EXCLUDED.video_date, videos.video_date),
                duration = COALESCE(EXCLUDED.duration, videos.duration),
                video_uuid = COALESCE(EXCLUDED.video_uuid, videos.video_uuid),
                hls_url = COALESCE(EXCLUDED.hls_url, videos.hls_url),
                download_url = COALESCE(EXCLUDED.download_url, videos.download_url),
                agenda_url = COALESCE(EXCLUDED.agenda_url, videos.agenda_url),
                data = EXCLUDED.data
            RETURNING (xmax = 0) AS is_insert
        """, (
            rec.city_slug,
            rec.video_id,
            rec.title,
            rec.video_date,
            rec.duration,
            rec.video_uuid,
            rec.hls_url,
            rec.download_url,
            rec.agenda_url,
            json.dumps(rec.data),
        ))
        row = cur.fetchone()
        if row and row[0]:
            new_count += 1
        else:
            updated_count += 1

    conn.commit()
    cur.close()
    return new_count, updated_count


def update_client_video_count(conn, slug: str):
    cur = conn.cursor()
    cur.execute("""
        UPDATE clients
        SET video_count = (SELECT COUNT(*) FROM videos WHERE city_slug = %s),
            updated_at = NOW()
        WHERE slug = %s
    """, (slug, slug))
    conn.commit()
    cur.close()


def update_scrape_progress(conn, slug: str, result: ScrapeResult):
    cur = conn.cursor()
    now = datetime.now(timezone.utc)
    cur.execute("""
        INSERT INTO scrape_progress (city_slug, endpoint, status, records_scraped,
                                     error_message, started_at, completed_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (city_slug, endpoint) DO UPDATE SET
            status = EXCLUDED.status,
            records_scraped = EXCLUDED.records_scraped,
            error_message = EXCLUDED.error_message,
            completed_at = EXCLUDED.completed_at,
            updated_at = EXCLUDED.updated_at
    """, (
        slug,
        "full_rescrape",
        "completed" if result.success else "error",
        result.videos_found,
        result.error[:500] if result.error else None,
        now, now, now,
    ))
    conn.commit()
    cur.close()


def get_all_client_slugs(conn) -> List[str]:
    cur = conn.cursor()
    cur.execute("SELECT slug FROM clients ORDER BY slug")
    slugs = [row[0] for row in cur.fetchall()]
    cur.close()
    return slugs


# ---------------------------------------------------------------------------
# HLS enrichment (optional)
# ---------------------------------------------------------------------------

def enrich_video_hls(slug: str, video_id: int) -> Tuple[Optional[str], Optional[str]]:
    url = f"https://{slug}.new.swagit.com/videos/{video_id}"
    resp = fetch(url, retries=1)
    if resp is None:
        return None, None

    text = resp.text
    hls_match = re.search(
        r'(https://archive-stream\.granicus\.com/[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', text
    )
    hls_url = hls_match.group(1) if hls_match else None

    video_uuid = None
    uuid_match = re.search(
        r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', text
    )
    if uuid_match:
        video_uuid = uuid_match.group(1)

    return hls_url, video_uuid


def enrich_missing_hls(conn, slug: str, records: List[VideoRecord],
                       existing_ids: Dict[int, date], limit: int = 20):
    new_records = [r for r in records if r.video_id not in existing_ids]
    new_records.sort(key=lambda r: r.video_date or date.min, reverse=True)
    enriched = 0

    for rec in new_records[:limit]:
        hls_url, video_uuid = enrich_video_hls(slug, rec.video_id)
        if hls_url or video_uuid:
            cur = conn.cursor()
            cur.execute("""
                UPDATE videos
                SET hls_url = COALESCE(%s, hls_url),
                    video_uuid = COALESCE(%s, video_uuid)
                WHERE city_slug = %s AND video_id = %s
            """, (hls_url, video_uuid, slug, rec.video_id))
            conn.commit()
            cur.close()
            enriched += 1

    if enriched:
        log.info("  %s: enriched %d/%d new videos with HLS URLs",
                 slug, enriched, len(new_records))


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def scrape_one_client(slug: str, conn, max_pages: int, dry_run: bool,
                      enrich_hls: bool) -> ScrapeResult:
    t0 = time.time()
    result = ScrapeResult(slug=slug, success=False)

    try:
        log.info("Scraping %s ...", slug)
        existing_ids = get_existing_video_ids(conn, slug) if not dry_run else {}

        records, categories_scraped = scrape_client(slug, max_pages)
        result.videos_found = len(records)
        result.categories_scraped = categories_scraped

        if dry_run:
            result.success = True
            result.elapsed_seconds = time.time() - t0
            log.info("  %s: [DRY RUN] would upsert %d videos", slug, len(records))
            return result

        new_count, updated_count = upsert_videos(conn, records)
        result.videos_new = new_count
        result.videos_updated = updated_count
        result.success = True

        update_client_video_count(conn, slug)

        if enrich_hls and new_count > 0:
            enrich_missing_hls(conn, slug, records, existing_ids, limit=20)

        update_scrape_progress(conn, slug, result)

        result.elapsed_seconds = time.time() - t0
        log.info(
            "  %s: done in %.1fs -- %d found, %d new, %d updated, %d categories",
            slug, result.elapsed_seconds, result.videos_found,
            result.videos_new, result.videos_updated, result.categories_scraped,
        )

    except Exception as exc:
        result.error = str(exc)
        result.elapsed_seconds = time.time() - t0
        log.error("  %s: ERROR after %.1fs -- %s", slug, result.elapsed_seconds, exc)

        if not dry_run:
            try:
                update_scrape_progress(conn, slug, result)
            except Exception:
                pass

    return result


def main():
    parser = argparse.ArgumentParser(description="Swagit Video Re-Scraper")
    parser.add_argument("--slugs", nargs="*",
                        help="Specific client slugs to scrape (default: all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Scrape but don't write to DB")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES_DEFAULT,
                        help=f"Max pagination pages per category (default: {MAX_PAGES_DEFAULT})")
    parser.add_argument("--enrich-hls", action="store_true",
                        help="Fetch HLS URLs for new videos (slower)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Debug logging")
    args = parser.parse_args()

    if args.verbose:
        log.setLevel(logging.DEBUG)

    log.info("Connecting to Swagit database...")
    conn = get_db_connection()

    if args.slugs:
        slugs = args.slugs
    else:
        slugs = get_all_client_slugs(conn)

    log.info("Will scrape %d clients (max_pages=%d, dry_run=%s, enrich_hls=%s)",
             len(slugs), args.max_pages, args.dry_run, args.enrich_hls)

    results: List[ScrapeResult] = []
    t_start = time.time()

    for i, slug in enumerate(slugs, 1):
        log.info("--- [%d/%d] %s ---", i, len(slugs), slug)
        result = scrape_one_client(slug, conn, args.max_pages, args.dry_run, args.enrich_hls)
        results.append(result)

    conn.close()
    elapsed = time.time() - t_start

    # Summary
    successes = [r for r in results if r.success]
    failures = [r for r in results if not r.success]
    total_found = sum(r.videos_found for r in results)
    total_new = sum(r.videos_new for r in results)
    total_updated = sum(r.videos_updated for r in results)

    log.info("")
    log.info("=" * 70)
    log.info("SCRAPE COMPLETE in %.1f seconds", elapsed)
    log.info("  Clients: %d succeeded, %d failed out of %d total",
             len(successes), len(failures), len(results))
    log.info("  Videos:  %d found, %d new, %d updated",
             total_found, total_new, total_updated)
    log.info("=" * 70)

    if failures:
        log.info("")
        log.info("FAILURES:")
        for r in failures:
            log.info("  %s: %s", r.slug, r.error)

    log.info("")
    log.info("%-30s %8s %8s %8s %6s %s",
             "CLIENT", "FOUND", "NEW", "UPDATED", "SECS", "STATUS")
    log.info("-" * 85)
    for r in sorted(results, key=lambda x: x.videos_found, reverse=True):
        status = "OK" if r.success else f"ERR: {(r.error or '')[:30]}"
        log.info("%-30s %8d %8d %8d %6.1f %s",
                 r.slug, r.videos_found, r.videos_new, r.videos_updated,
                 r.elapsed_seconds, status)

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
