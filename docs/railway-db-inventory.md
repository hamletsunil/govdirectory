# Railway PostgreSQL Database Inventory

**Generated**: 2026-02-13  
**Author**: Automated infrastructure audit  
**Databases**: 4 Railway-hosted PostgreSQL instances  
**Total data**: 12,115,168 rows across 42 tables (~14.8 GB)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database 1: Legistar](#database-1-legistar)
3. [Database 2: PrimeGov](#database-2-primegov)
4. [Database 3: CivicPlus](#database-3-civicplus)
5. [Database 4: Swagit](#database-4-swagit)
6. [Cross-Database Summary](#cross-database-summary)
7. [Data Pipeline Architecture](#data-pipeline-architecture)
8. [Update Mechanisms](#update-mechanisms)
9. [Recommendations](#recommendations)

---

## Executive Summary

The govdirectory project uses 4 Railway PostgreSQL databases to store government meeting, legislative, and video data scraped from external platforms. Together they cover **290+ US cities** with **12.1 million rows** of structured data.

| Database   | Host                          | Port  | Size    | Tables | Rows       | Cities | Freshness |
|------------|-------------------------------|-------|---------|--------|------------|--------|-----------|
| Legistar   | maglev.proxy.rlwy.net         | 18553 | 13 GB   | 24     | 9,932,560  | 265    | Active (scrapers running today) |
| PrimeGov   | caboose.proxy.rlwy.net        | 56101 | 1.5 GB  | 6      | 1,856,403  | 45     | Active (scraped 2026-02-12) |
| CivicPlus  | metro.proxy.rlwy.net          | 17752 | 224 MB  | 6      | 318,818    | 1,297  | Active (scraped 2026-02-10) |
| Swagit     | crossover.proxy.rlwy.net      | 28507 | 21 MB   | 6      | 7,387      | 49     | Mostly stale (30/32 cities >1yr old) |

**Key Finding**: Legistar is by far the largest and most actively updated database. Swagit has a significant freshness problem -- only 2 of 32 cities with videos have data newer than a year.

---

## Database 1: Legistar

**Connection**: `postgresql://postgres:LdaVW...@maglev.proxy.rlwy.net:18553/railway`  
**Size**: 13 GB | **Total Rows**: 9,932,560 | **Cities**: 265

### Schema

All tables follow a consistent pattern: `id` (serial PK), `city_slug` (text), `entity_id` (integer), `data` (jsonb), with a unique constraint on `(city_slug, entity_id)`.

#### Table: `events` (479,119 rows)
| Column     | Type                     | Nullable | Notes |
|------------|--------------------------|----------|-------|
| id         | integer                  | NOT NULL | PK, serial |
| city_slug  | text                     | NOT NULL | |
| entity_id  | integer                  | NOT NULL | Legistar EventId |
| event_date | timestamp with time zone | NULL     | Indexed |
| body_name  | text                     | NULL     | |
| data       | jsonb                    | NOT NULL | Full Legistar API response |

- **Unique**: `(city_slug, entity_id)`
- **Indexes**: `idx_events_city (city_slug)`, `idx_events_date (event_date)`
- **Date Range**: 1831-01-01 to 9999-09-08 (realistic: through 2026-12-31)

#### Table: `matters` (3,863,612 rows) -- LARGEST TABLE
| Column      | Type                     | Nullable | Notes |
|-------------|--------------------------|----------|-------|
| id          | integer                  | NOT NULL | PK, serial |
| city_slug   | text                     | NOT NULL | |
| entity_id   | integer                  | NOT NULL | Legistar MatterId |
| intro_date  | timestamp with time zone | NULL     | Indexed |
| title       | text                     | NULL     | |
| type_name   | text                     | NULL     | |
| status_name | text                     | NULL     | |
| data        | jsonb                    | NOT NULL | Full Legistar API response |

- **Unique**: `(city_slug, entity_id)`
- **Indexes**: `idx_matters_city`, `idx_matters_date`
- **Date Range**: 1818-03-19 to 9859-10-01 (realistic: through 2026-02-25)

#### Table: `event_items` (1,715,031 rows)
| Column      | Type    | Nullable | Notes |
|-------------|---------|----------|-------|
| id          | integer | NOT NULL | PK |
| city_slug   | text    | NOT NULL | |
| entity_id   | integer | NOT NULL | |
| event_id    | integer | NOT NULL | FK to events |
| title       | text    | NULL     | |
| action_name | text    | NULL     | |
| matter_id   | integer | NULL     | FK to matters |
| data        | jsonb   | NOT NULL | |

- **Indexes**: `idx_event_items_city`, `idx_event_items_event (city_slug, event_id)`

#### Table: `matter_attachments` (1,142,495 rows)
| Column    | Type    | Nullable | Notes |
|-----------|---------|----------|-------|
| id        | integer | NOT NULL | PK |
| city_slug | text    | NOT NULL | |
| entity_id | integer | NOT NULL | |
| matter_id | integer | NOT NULL | FK to matters |
| name      | text    | NULL     | |
| hyperlink | text    | NULL     | |
| data      | jsonb   | NOT NULL | |

#### Table: `votes` (887,646 rows)
| Column        | Type    | Nullable | Notes |
|---------------|---------|----------|-------|
| id            | integer | NOT NULL | PK |
| city_slug     | text    | NOT NULL | |
| entity_id     | integer | NOT NULL | |
| event_item_id | integer | NOT NULL | FK to event_items |
| person_name   | text    | NULL     | |
| value_name    | text    | NULL     | Yes/No/Abstain etc. |
| data          | jsonb   | NOT NULL | |

#### Table: `matter_indexes` (674,277 rows)
Standard schema: `id, city_slug, entity_id, data (jsonb)`

#### Table: `matter_histories` (404,232 rows)
| Column       | Type                     | Nullable | Notes |
|--------------|--------------------------|----------|-------|
| id           | integer                  | NOT NULL | PK |
| city_slug    | text                     | NOT NULL | |
| entity_id    | integer                  | NOT NULL | |
| matter_id    | integer                  | NOT NULL | |
| action_name  | text                     | NULL     | |
| history_date | timestamp with time zone | NULL     | |
| data         | jsonb                    | NOT NULL | |

#### Table: `roll_calls` (205,875 rows)
Same structure as `votes` with `person_name`, `value_name`, `event_item_id`.

#### Table: `persons` (137,410 rows)
| Column    | Type    | Nullable | Notes |
|-----------|---------|----------|-------|
| id        | integer | NOT NULL | PK |
| city_slug | text    | NOT NULL | |
| entity_id | integer | NOT NULL | |
| full_name | text    | NULL     | |
| active    | boolean | NULL     | |
| data      | jsonb   | NOT NULL | Includes email, phone, website |

#### Table: `office_records` (129,995 rows)
| Column      | Type    | Nullable | Notes |
|-------------|---------|----------|-------|
| id          | integer | NOT NULL | PK |
| city_slug   | text    | NOT NULL | |
| entity_id   | integer | NOT NULL | |
| person_name | text    | NULL     | |
| body_name   | text    | NULL     | |
| title       | text    | NULL     | |
| data        | jsonb   | NOT NULL | |

#### Table: `matter_sponsors` (112,309 rows)
Standard schema with `matter_id`, `sponsor_name`.

#### Other Tables (smaller)
| Table                  | Rows    | Notes |
|------------------------|---------|-------|
| code_sections          | 49,795  | Municipal code references |
| matter_relations       | 44,855  | Links between related matters |
| indexes                | 23,085  | Legistar index entries |
| matter_requesters      | 16,220  | Who requested each matter |
| actions                | 10,244  | Action type definitions |
| bodies                 | 8,950   | Committee/body definitions |
| matter_statuses        | 6,076   | Status type definitions |
| matter_types           | 6,023   | Matter type definitions |
| scrape_progress        | 4,470   | Scraper state tracking |
| body_types             | 3,445   | Body type definitions |
| vote_types             | 2,137   | Vote type definitions |
| matter_code_sections   | 1,568   | Matter-to-code-section links |
| matter_texts           | 0       | Empty (not scraped yet) |

### Data Freshness

**Scraper Status**: Actively running as of 2026-02-13 (today). Last completed task: apachejunction nested:MatterAttachments at 18:25 UTC.

- **4,374 scrape tasks completed**, 50 in_progress, 46 pending
- **290 cities** tracked in scrape_progress (22 distinct endpoint types)
- **16,415,768 total records scraped** across all tasks

**Event Freshness by City**:
| Age Bucket | Cities |
|------------|--------|
| < 7 days   | 202    |
| 7-30 days  | 21     |
| 30-90 days | 4      |
| 90-365 days | 4     |
| > 1 year   | 34     |

**223 cities** have events from the last 30 days. **236 cities** have matters introduced in the last 30 days.

### City Coverage (Top 20 by Events)

| City Slug           | Events  | Matters   |
|---------------------|---------|-----------|
| madison             | 17,711  | 79,728    |
| kansascity          | 16,444  | --        |
| waukesha            | 9,956   | --        |
| dupage              | 9,804   | --        |
| princegeorgescountymd | 9,421 | --        |
| boston               | 9,148   | --        |
| milwaukee           | 8,912   | 60,661    |
| pinellas            | 8,808   | --        |
| louisville          | 8,295   | --        |
| kingcounty          | 8,153   | --        |

**Top cities by matters**: chicago (156,404), newark (154,764), columbus (113,314), clark (104,190), sanmateocounty (89,780)

**Smallest cities**: pbc (14 matters), philasd (16), calaverascounty (18), westsacramento (22)

---

## Database 2: PrimeGov

**Connection**: `postgresql://postgres:qnSIm...@caboose.proxy.rlwy.net:56101/railway`  
**Size**: 1.5 GB | **Total Rows**: 1,856,403 | **Cities**: 45

### Schema

#### Table: `meetings` (78,419 rows)
| Column               | Type                     | Nullable | Notes |
|----------------------|--------------------------|----------|-------|
| id                   | integer                  | NOT NULL | PK, serial |
| city_slug            | text                     | NOT NULL | |
| entity_id            | integer                  | NOT NULL | PrimeGov MeetingId |
| meeting_date         | timestamp with time zone | NULL     | Indexed |
| title                | text                     | NULL     | |
| committee_id         | integer                  | NULL     | |
| video_url            | text                     | NULL     | |
| meeting_state        | integer                  | NULL     | |
| allow_public_comment | boolean                  | NULL     | |
| data                 | jsonb                    | NOT NULL | |

- **Unique**: `(city_slug, entity_id)`
- **Indexes**: `idx_meetings_city`, `idx_meetings_date`
- **Date Range**: 2010-01-04 to 2027-01-28 (test data)

#### Table: `agenda_items` (1,334,670 rows) -- LARGEST TABLE
| Column          | Type    | Nullable | Notes |
|-----------------|---------|----------|-------|
| id              | integer | NOT NULL | PK |
| city_slug       | text    | NOT NULL | |
| item_id         | text    | NOT NULL | |
| meeting_id      | integer | NOT NULL | |
| section_id      | text    | NULL     | |
| title           | text    | NULL     | |
| has_attachments | boolean | NULL     | DEFAULT false |
| video_timestamp | text    | NULL     | |
| migration_id    | text    | NULL     | |
| data            | jsonb   | NOT NULL | |

- **Unique**: `(city_slug, item_id, meeting_id)`

#### Table: `attachments` (243,324 rows)
| Column       | Type    | Nullable | Notes |
|--------------|---------|----------|-------|
| id           | integer | NOT NULL | PK |
| city_slug    | text    | NOT NULL | |
| history_id   | text    | NOT NULL | |
| item_id      | text    | NOT NULL | |
| meeting_id   | integer | NOT NULL | |
| name         | text    | NULL     | |
| download_url | text    | NULL     | |
| data         | jsonb   | NOT NULL | |

#### Table: `documents` (199,771 rows)
| Column         | Type    | Nullable | Notes |
|----------------|---------|----------|-------|
| id             | integer | NOT NULL | PK |
| city_slug      | text    | NOT NULL | |
| entity_id      | integer | NOT NULL | |
| meeting_id     | integer | NOT NULL | |
| template_name  | text    | NULL     | |
| compile_type   | integer | NULL     | |
| publish_status | integer | NULL     | |
| template_id    | integer | NULL     | |
| data           | jsonb   | NOT NULL | |

#### Table: `clients` (45 rows)
| Column        | Type                     | Nullable | Notes |
|---------------|--------------------------|----------|-------|
| id            | integer                  | NOT NULL | PK |
| slug          | text                     | NOT NULL | Unique |
| name          | text                     | NULL     | All "Search Portal" |
| status        | text                     | NOT NULL | DEFAULT 'active' |
| api_version   | text                     | NULL     | |
| meeting_count | integer                  | NULL     | |
| earliest_year | integer                  | NULL     | All NULL |
| latest_year   | integer                  | NULL     | All NULL |
| discovered_at | timestamp with time zone | NOT NULL | |
| updated_at    | timestamp with time zone | NOT NULL | |

#### Table: `scrape_progress` (174 rows)
Standard scrape tracking table.

### Data Freshness

**Last scrape run**: 2026-02-12 (yesterday). Many attachment scrapes are failing.

**Meeting Freshness by City**:
| Age Bucket  | Cities |
|-------------|--------|
| < 7 days    | 37     |
| 7-30 days   | 1      |
| 30-90 days  | 1      |
| 90-365 days | 4      |
| > 1 year    | 2      |

**Most active cities**: lacity (9,617 meetings), okc (8,521), sanantonio (7,618), sanjoseca (4,796), worcesterma (4,523)

**Stale cities**: santafe (last meeting 2024-12-17), sanjoseca (2024-12-17)

**Note**: Multiple attachment scrape tasks are failing (longbeach, lacity, santafe, santaclaracounty, santa-ana, sanjoseca, sanantonio, etc.). This needs investigation.

---

## Database 3: CivicPlus

**Connection**: `postgresql://postgres:eqcpV...@metro.proxy.rlwy.net:17752/railway`  
**Size**: 224 MB | **Total Rows**: 318,818 | **Sites**: 1,297

### Schema

Note: CivicPlus uses `site_key` instead of `city_slug`. Site keys follow `{state}-{locality}` format (e.g., `tx-cleburne2`, `ma-concord`).

#### Table: `rss_items` (258,699 rows) -- LARGEST TABLE
| Column      | Type                     | Nullable | Notes |
|-------------|--------------------------|----------|-------|
| id          | integer                  | NOT NULL | PK |
| site_key    | text                     | NOT NULL | |
| feed_name   | text                     | NOT NULL | e.g., "All", "News Flash", "Agenda Center" |
| item_guid   | text                     | NOT NULL | |
| title       | text                     | NULL     | |
| link        | text                     | NULL     | |
| pub_date    | timestamp with time zone | NULL     | Indexed |
| description | text                     | NULL     | |
| data        | jsonb                    | NOT NULL | |

- **Unique**: `(site_key, feed_name, item_guid)`
- **Date Range**: 2013-01-09 to 2026-02-10

#### Table: `agendas` (52,268 rows)
| Column       | Type    | Nullable | Notes |
|--------------|---------|----------|-------|
| id           | integer | NOT NULL | PK |
| site_key     | text    | NOT NULL | |
| entity_id    | text    | NOT NULL | |
| category_id  | text    | NULL     | |
| meeting_date | date    | NULL     | Indexed |
| title        | text    | NULL     | |
| agenda_url   | text    | NULL     | |
| minutes_url  | text    | NULL     | |
| packet_url   | text    | NULL     | |
| data         | jsonb   | NOT NULL | |

- **Date Range**: 2002-06-11 to 2026-12-10

#### Table: `sites` (1,297 rows)
| Column               | Type                     | Nullable | Notes |
|----------------------|--------------------------|----------|-------|
| id                   | integer                  | NOT NULL | PK |
| site_key             | text                     | NOT NULL | Unique |
| url                  | text                     | NOT NULL | |
| name                 | text                     | NULL     | |
| state                | text                     | NULL     | 2-letter abbreviation |
| country              | text                     | NULL     | DEFAULT 'US' |
| civicplus_subdomain  | text                     | NULL     | |
| custom_domain        | text                     | NULL     | |
| has_api              | boolean                  | NULL     | DEFAULT false |
| has_rss              | boolean                  | NULL     | DEFAULT false |
| has_agenda_center    | boolean                  | NULL     | DEFAULT false |
| has_document_center  | boolean                  | NULL     | DEFAULT false |
| status               | text                     | NOT NULL | DEFAULT 'active' |
| discovered_at        | timestamp with time zone | NOT NULL | |
| updated_at           | timestamp with time zone | NOT NULL | |

#### Other Tables
| Table              | Rows  | Notes |
|--------------------|-------|-------|
| documents          | 1,076 | Document center files |
| agenda_categories  | 83    | Category definitions for agenda center |
| scrape_progress    | 5,395 | Scrape tracking |

### Data Freshness

**Last scrape run**: 2026-02-10

**RSS Freshness**:
| Age Bucket  | Sites |
|-------------|-------|
| < 7 days    | 1,067 |
| 7-30 days   | 196   |
| 30-90 days  | 4     |
| 90-365 days | 5     |
| > 1 year    | 3     |

**Agenda Freshness**:
| Age Bucket  | Sites |
|-------------|-------|
| < 7 days    | 65    |
| 7-30 days   | 63    |
| 30-90 days  | 27    |
| 90-365 days | 41    |
| > 1 year    | 86    |

**Coverage by state (top 10)**: TX (102), CA (96), IL (75), OH (55), FL (52), MN (51), WA (51), PA (49), MA (48), KS (46)

**Site capabilities**: 1,257 sites have RSS + Agenda + Documents. 15 have Agenda+Docs but no RSS. 15 have RSS+Docs but no Agenda.

**Top sites by RSS volume**: tx-cleburne2 (12,336), tx-balchsprings (9,595), ny-hempstead (7,794)

**Top sites by agendas**: ma-concord (508), ma-northampton (458), ma-ipswich (390)

---

## Database 4: Swagit

**Connection**: `postgresql://postgres:omqRW...@crossover.proxy.rlwy.net:28507/railway`  
**Size**: 21 MB | **Total Rows**: 7,387 | **Clients**: 49 (32 with videos)

### Schema

#### Table: `videos` (6,811 rows) -- LARGEST TABLE
| Column       | Type    | Nullable | Notes |
|--------------|---------|----------|-------|
| id           | integer | NOT NULL | PK |
| city_slug    | text    | NOT NULL | |
| video_id     | integer | NOT NULL | |
| view_id      | integer | NULL     | FK to views |
| title        | text    | NULL     | |
| video_date   | date    | NULL     | Indexed |
| duration     | text    | NULL     | |
| video_uuid   | text    | NULL     | |
| hls_url      | text    | NULL     | |
| download_url | text    | NULL     | |
| agenda_url   | text    | NULL     | |
| minutes_url  | text    | NULL     | |
| data         | jsonb   | NOT NULL | |

- **Unique**: `(city_slug, video_id)`
- **Date Range**: 2006-01-03 to 2026-02-09

#### Table: `transcripts` (328 rows)
| Column          | Type                     | Nullable | Notes |
|-----------------|--------------------------|----------|-------|
| id              | integer                  | NOT NULL | PK |
| city_slug       | text                     | NOT NULL | |
| video_id        | integer                  | NOT NULL | Unique |
| transcript_text | text                     | NOT NULL | |
| word_count      | integer                  | NULL     | |
| fetched_at      | timestamp with time zone | NOT NULL | |

- Transcripts exist for only 2 cities: kaufmancountytx (322), sanantoniotx (6)
- Total words transcribed: ~2.99M

#### Table: `clients` (49 rows)
| Column       | Type                     | Nullable | Notes |
|--------------|--------------------------|----------|-------|
| id           | integer                  | NOT NULL | PK |
| slug         | text                     | NOT NULL | Unique |
| name         | text                     | NULL     | All "SwagitAdmin" |
| platform     | text                     | NULL     | All "new" |
| status       | text                     | NOT NULL | DEFAULT 'active' |
| view_count   | integer                  | NULL     | All 0 |
| video_count  | integer                  | NULL     | All NULL |
| discovered_at | timestamp with time zone | NOT NULL | |
| updated_at   | timestamp with time zone | NOT NULL | |

#### Empty/Unused Tables
| Table         | Rows | Notes |
|---------------|------|-------|
| views         | 0    | View categories -- not populated |
| agenda_items  | 0    | Per-video agenda items -- not populated |
| scrape_progress | 199 | Scrape tracking |

### Data Freshness

**CRITICAL ISSUE**: Swagit data is severely stale for most cities.

| Age Bucket  | Cities |
|-------------|--------|
| < 7 days    | 2 (sanantoniotx, hcpsstv) |
| > 1 year    | 30     |

Only **sanantoniotx** and **hcpsstv** (Howard County Public Schools) have video data from 2026. All other 30 cities have their most recent video from September 2014, suggesting the scraper ran once in Sept 2014 for initial data and has not been re-run since (or is only running for 2 cities).

**Top cities by video count**: sanantoniotx (1,698), austintx (664), hcpsstv (653), houstontx (590), kaufmancountytx (452)

---

## Cross-Database Summary

### Total Data Volume

| Database  | Rows       | Size   | % of Total |
|-----------|------------|--------|------------|
| Legistar  | 9,932,560  | 13 GB  | 82.0%      |
| PrimeGov  | 1,856,403  | 1.5 GB | 15.3%      |
| CivicPlus | 318,818    | 224 MB | 2.6%       |
| Swagit    | 7,387      | 21 MB  | 0.1%       |
| **Total** | **12,115,168** | **~14.8 GB** | **100%** |

### City Coverage Overlap

- **Legistar**: 265 cities (focused on cities using Legistar/Granicus for legislative management)
- **PrimeGov**: 45 cities (focused on PrimeGov meeting management platform users)
- **CivicPlus**: 1,297 sites (broadest coverage -- CivicPlus powers many smaller city websites)
- **Swagit**: 49 clients, 32 with video data (focused on Swagit video streaming platform)

Some cities appear in multiple databases (e.g., sanantonio in Legistar + PrimeGov + Swagit). The `enrich-from-dbs.py` script handles cross-platform slug mapping.

### Data Types by Platform

| Data Type           | Legistar | PrimeGov | CivicPlus | Swagit |
|---------------------|----------|----------|-----------|--------|
| Meetings/Events     | Yes      | Yes      | Yes (RSS) | --     |
| Legislation/Matters | Yes      | --       | --        | --     |
| Agendas             | --       | Yes      | Yes       | --     |
| Votes/Roll Calls    | Yes      | --       | --        | --     |
| Officials/Persons   | Yes      | --       | --        | --     |
| Attachments         | Yes      | Yes      | --        | --     |
| Videos              | --       | Partial  | --        | Yes    |
| Transcripts         | --       | --       | --        | Yes    |
| RSS News            | --       | --       | Yes       | --     |
| Documents           | --       | Yes      | Yes       | --     |

---

## Data Pipeline Architecture

### Overview

```
[External APIs]  -->  [Railway Scrapers]  -->  [4 Railway PostgreSQL DBs]
                                                         |
                                                         v
                                          [enrich-from-dbs.py] (manual)
                                                         |
                                                         v
                                          [public/data/cities/*.json]
                                                         |
                                                         v
                                          [Next.js Build / Vercel Deploy]
```

### Pipeline Components

1. **Scrapers** (Railway-hosted workers):
   - Legistar scraper: runs continuously, processes 22 endpoint types per city
   - PrimeGov scraper: runs periodically, fetches meetings + agenda items + attachments
   - CivicPlus scraper: fetches RSS feeds, agendas, and documents from CivicPlus-powered sites
   - Swagit scraper: fetches video metadata and transcripts

2. **Enrichment Script** (`scripts/enrich-from-dbs.py`):
   - Reads city profiles from `~/simcity-inventory/output/profiles/`
   - Queries all 4 Railway DBs to add officials, recent meetings, legislation, videos, news
   - Handles cross-platform slug mapping (Legistar -> PrimeGov, Legistar -> CivicPlus)
   - Writes enriched JSON to `public/data/cities/`

3. **Sync Script** (`scripts/sync-city-data.ts`):
   - Copies profiles from `simcity-inventory` to `public/data/cities/`
   - Generates `_index.json` (city listing) and `_benchmarks.json` (percentiles)
   - Run via `npm run sync-cities`

4. **City Profiles**: Static JSON files committed to git, read at build time by Next.js.

### Last Pipeline Run

- **Enrichment**: 2026-02-12 (~18:51-18:55 UTC) -- all 290 cities enriched
- **Normalization**: 2026-02-10 (14:21 UTC)
- **City data files**: 292 files (290 cities + _index.json + _benchmarks.json)

---

## Update Mechanisms

### What Exists

1. **Railway-hosted scrapers**: Running on Railway projects (primegov-data, swagit-data, civicplus-data, legistar-data). These appear to run continuously or on schedules within Railway.

2. **Manual enrichment**: `python scripts/enrich-from-dbs.py` must be run locally to pull latest data from Railway DBs into city JSON files.

3. **Manual sync**: `npm run sync-cities` copies base profiles from `simcity-inventory`.

### What Does NOT Exist

- **No cron jobs** on local machine (`crontab -l` is empty)
- **No GitHub Actions** (no `.github/workflows/` directory)
- **No Vercel cron** or scheduled functions
- **No Dockerfile** or Railway deployment config in govdirectory repo
- **No automated enrichment pipeline** -- the enrichment step requires manual invocation
- **simcity-inventory** directory does not exist on this machine (profiles must have been generated elsewhere or previously)

### Railway Projects (visible but not authenticated)

Railway CLI is installed (v4.16.1) but not logged in. Known Railway projects:
- primegov-data
- swagit-data
- civicplus-data
- legistar-data
- Hamlet-Simulation
- gov-facebook-db

### Related Repositories

- `~/gov_discovery/` -- Contains 25+ Python scraper/discovery scripts (legistar_brute.py, civicplus_processor.py, multi_platform_scraper.py, etc.). Last modified 2026-01-14-15.
- `~/govdirectory/scripts/` -- 3 scripts: enrich-from-dbs.py, extract_city_websites.py, sync-city-data.ts

---

## Recommendations

### Critical Issues

1. **Swagit data is severely stale**: 30 of 32 cities have no video data newer than September 2014. The Swagit scraper appears to only be actively updating 2 cities (sanantoniotx, hcpsstv). Investigate and re-run the scraper for all 49 clients.

2. **PrimeGov attachment scraping is failing**: Multiple cities (longbeach, lacity, santafe, etc.) show "failed" status for attachment scrapes as of 2026-02-12. The scraper endpoint or API may have changed.

3. **No automated enrichment pipeline**: The enrichment step (`enrich-from-dbs.py`) must be run manually. This means city profile data on the website can become stale without anyone noticing.

4. **simcity-inventory missing**: The `sync-city-data.ts` script depends on `~/simcity-inventory/output/profiles/` which does not exist. Base profile generation/update path is unclear.

### Data Freshness Improvements

5. **Set up GitHub Actions for enrichment**: Create a scheduled GitHub Action that runs `enrich-from-dbs.py` daily, commits updated JSON files, and triggers a Vercel redeploy.

6. **Add freshness monitoring**: Create a dashboard or health check endpoint that reports how stale each database and city's data is. Alert when any platform's scraper has not updated in >48 hours.

7. **Railway scraper health checks**: Log into Railway (`railway login`) and verify each scraper project's deployment status, logs, and schedules. Ensure all 4 scrapers are running on regular schedules.

### Data Quality Improvements

8. **Clean bogus dates**: Legistar has events dated 9999-09-08 and matters dated 9859-10-01. Add date validation to filter these out during enrichment (already filtered for display, but they inflate date ranges).

9. **Populate empty tables**: Swagit `views` (0 rows) and `agenda_items` (0 rows) tables are empty. Legistar `matter_texts` (0 rows) is also empty. These may indicate incomplete scraper implementations.

10. **Expand Swagit transcript coverage**: Only 2 of 32 cities have transcripts. If the transcript extraction works for kaufmancountytx (322 transcripts), it should be extended to all cities with videos.

### Scaling Considerations

11. **Legistar DB is 13 GB and growing**: With 9.9M rows and active scraping, consider adding table partitioning by city_slug for the largest tables (matters, event_items, matter_attachments).

12. **CivicPlus has the broadest reach**: 1,297 sites across all 50 states. Consider which of these overlap with the 290 govdirectory cities and prioritize scraping for those.

13. **Archive historical data**: For cities with 10+ years of legislative history, consider archiving older data to a separate table/database to keep the active database responsive.

---

## Appendix: Connection Quick Reference

```bash
# Legistar (13 GB, 24 tables, 9.9M rows)
psql "postgresql://postgres:LdaVWImnAOIOROJYecOeqWTsvegGAVKm@maglev.proxy.rlwy.net:18553/railway"

# PrimeGov (1.5 GB, 6 tables, 1.9M rows)
psql "postgresql://postgres:qnSImUkSZkCrbWFrHHScXXuxLtXtOYqw@caboose.proxy.rlwy.net:56101/railway"

# CivicPlus (224 MB, 6 tables, 319K rows)
psql "postgresql://postgres:eqcpVOkuozlyvdFAbGsZpFMJTvoAEoqC@metro.proxy.rlwy.net:17752/railway"

# Swagit (21 MB, 6 tables, 7.4K rows)
psql "postgresql://postgres:omqRWdbiJunGjTyBpEREbySsbIxYoDkQ@crossover.proxy.rlwy.net:28507/railway"
```

## Appendix: All Legistar City Slugs (265)

```
a2gov, actransit, alachua, alameda, albanycounty, albemarle, alexandria, allentownpa,
annapolismd, apachejunction, arapahoe, atlantaga, baldwincountyal, baltimore, bart,
bellevue, bethanybeach, beverlyhills, blaine, blounttn, boerne, boston, brevardfl,
brightonco, broward, burlingameca, cabq, calaverascounty, camas, campo, canton, carson,
carrolltontx, carrboro, cathedralcity, chapelhill, charlottenc, chathamnc, chicago, chino,
chulavista, ci-ssf-ca, cityfortbragg, cityofdallas, cityofdeerpark, cityofappleton,
cityofbrookings, cityofcleveland, cityofedgewater, cityoffoley, cityofgreen, cityofkeller,
cityoflacrosse, cityoflaredo, cityoflewisville, cityofluverne, cityofmalden, cityofmerced,
cityofnorthport, cityoforange, cityofredbluff, cityofsignalhill, cityofsweetwater,
cityoftacoma, clark, clearwater, cocoa, coconutcreek, collinsville, coloradosprings,
columbus, commerce, concordnh, contra-costa, cook-county, coralgables, corona,
corpuschristi, costamesa, countyoflake, culver-city, cumberlandcounty, cupertino, dakota,
dane, dekalbcountyga, delraybeach, deltona, denver, desotobocc, detroit, douglascounty,
dublin, dupage, durhamcounty, eldorado, elpasotexas, emeryville, erie, fontana,
fortlauderdale, franklintn, fresno, fresnocounty, fullerton, fulton, fwb, gainesville,
gaston, goleta, goodyear, greensboro, groveport, guilford, hallandalebeach, hampton,
harriscountytx, hayward, hennepinmn, hercules, hernandocountyfl, hesperia, hillsboroughcounty,
hollywoodfl, houstonisd, hudson, humboldt, huntsvilleal, huntingtonbeach, idahofalls,
jonesboro, joliet, kansascity, killeen, kingcounty, lacounty, lakehavasucity, laramiecounty,
lausd, lawtonok, leaguecity, lexingtonnc, lombard, longbeach, losalamos, louisville,
lsmo, madison, manhattanbeach, manitowoc, mansfield, marcoisland, margatefl, marietta,
maricopa, martin, mauicounty, mckinney, mecklenburg, mendocino, mesa, mesquite, metro,
milwaukee, miramar, montgomerycountymd, monterey, mountainview, mountvernonny, murrieta,
mwrd, napa, napacity, naperville, nashville, newark, newbraunfels, newportbeach, nezperce,
northfield, oakland, ocala, ocsd, octa, oklahomacounty, olatheks, olympia, oregonmetro,
orlandpark, ousd, paradise valleyaz, parkland, pbc, pensacola, peoriail, petersburg,
pflugerville, philasd, phoenix, pima, pinecrest, pinellas, pinellaspark, pittsburgh,
plano, polkcountyfl, pompano, pomona, portofoakland, portofsandiego, ppines,
princegeorgescountymd, princetonnj, providenceri, psl, redmond, redondo, revere, rialto,
richmondva, riversideca, rockfordil, rockvillemd, romeoville, roswell, roundrock,
rutherfordcountync, sacramento, salem, salinas, sanbernardino, sanantonio, sanjose,
sanmarcos, sanmateocounty, sanpablo, santabarbara, santa-rosa, santaclara, sdcounty,
seattle, seminolecountyfl, sitka, snohomish, somervillema, sonoma-county, stpaul,
stockton, sunnyvaleca, temeculaca, toledo, troup, unioncountync, valdez, venice, visalia,
wake, washoe-nv, waukesha, wellington, westsacramento, westchestercountyny, westminsterca,
whatcom, wilmington, yonkersny
```

## Appendix: All PrimeGov City Slugs (45)

```
calbar, camarillo, cambridgema, ccta, cityoflancasterca, cityofoviedo, cityofpaloalto,
cityofpetaluma, cityofsancarlos, coronado, cvrd, cvwd, ebparks, fostercity, hgcity,
lacity, ladwp, lakeelsinore, laplata, longbeach, longmont, midland, nampa, nwfdaz, okc,
omnitrans, openspaceauthority, paramountcity, redlandsusd, reno, sacog, sanantonio,
sanbernardino, sanjoseca, santa-ana, santaclaracounty, santafe, shreveportla, slc,
springfieldohio, sunnyside, townofyountville, ventura, wmwd, worcesterma
```

## Appendix: All Swagit Client Slugs (49)

```
acpsd, alamedausdca, athensoh, atlanticbeachfl, auburnal, austintx, bexarcountytx,
brownsburgin, carbondaleil, chesterfieldschoolsva, cu, dallasisdtx, dallastx, decaturtx,
fcpsmd, fernandinabeachfl, flowermoundtx, fortpiercefl, friscoisdtx, friscotx,
goochlandschools, grandprairietx, harfordcountypublicschoolsmd, hcpsstv, houstontx,
huntsvilletx, huttotx, kaufmancountytx, laredotx, leaguecitytx, mckinneytx, mesquitetx,
miamibeachfl, nassaucountysd, nationalcityca, newportricheyfl, pascowa, pgsk12,
prairieviewtx, richardsontx, richlandwa, sanantoniotx, saratogaspringsny,
siouxcityschools, staugustinefl, stjohnscountyfl, taosnm, wicomicocountyps,
wilsoncountyschoolstn
```
