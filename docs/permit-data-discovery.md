# Building Permit Data Discovery Report

**Date:** 2026-02-13
**Scope:** 291 cities in the govdirectory project
**Current coverage:** 14 cities (4.8%) have `permits: "available"`
**Goal:** Identify API-accessible building permit data for all 290 cities

---

## Executive Summary

Building permit data is far more available than our current 4.8% coverage suggests. Through systematic probing of Socrata Discovery API, Accela Citizen Access portals, ArcGIS Hub, CKAN portals, and city-specific platforms, this research identified:

- **27 cities/jurisdictions** with confirmed Socrata building permit datasets (structured JSON API)
- **24+ cities** with confirmed Accela Citizen Access permit portals (via aca-prod.accela.com)
- **232 cities** in our directory already flagged as having Accela platform access
- **5+ cities** with CKAN/ArcGIS open data portals containing permit datasets
- **6+ cities** with custom permit platforms (Tyler EnerGov, Click2Gov, SmartGov, etc.)

Conservative estimate: **80-120 cities (28-41%)** have API-accessible or structured permit data today. With platform-specific integrations, coverage could reach **150-180 cities (52-62%)**.

---

## Platform Coverage Matrix

| Platform | Cities Confirmed | API Type | Data Format | Automation Feasibility |
|----------|-----------------|----------|-------------|----------------------|
| **Socrata** | 27+ | REST (SODA API) | JSON/CSV | **High** - standard API |
| **Accela (aca-prod.accela.com)** | 24+ confirmed portals | REST (Accela API v4) | JSON | **High** - standard API |
| **Accela (custom domains)** | 5+ | REST (Accela API v4) | JSON | **High** |
| **CKAN (Analyze Boston etc.)** | 3+ | REST (CKAN API) | JSON/CSV | **High** |
| **ArcGIS Hub/Open Data** | 5+ | REST (ArcGIS API) | JSON/GeoJSON | **Medium-High** |
| **Tyler EnerGov** | 3+ | Varies | HTML/JSON | **Medium** |
| **Click2Gov** | 2+ | Limited | HTML | **Low-Medium** |
| **SmartGov (Olympia etc.)** | 2+ | Limited | HTML | **Low-Medium** |
| **Custom portals** | 10+ | Varies | HTML/PDF | **Low** |
| **WPRDC (Pittsburgh)** | 1 | REST (CKAN) | JSON/CSV | **High** |

---

## Detailed Per-City Findings

### Tier 1: Confirmed Socrata Building Permit Datasets (Highest Priority)

These cities have structured, API-accessible permit data on Socrata. Integration uses the standard SODA API pattern: `https://{domain}/resource/{dataset_id}.json`

| City | Domain | Dataset ID | Dataset Name | Records |
|------|--------|-----------|--------------|---------|
| **Chicago, IL** | data.cityofchicago.org | `ydr8-5enu` | Building Permits | 800K+ |
| **Dallas, TX** | www.dallasopendata.com | `e7gq-4sah` | Building Permits | Large |
| **Los Angeles, CA** | data.lacity.org | `xnhu-aczu` | LA BUILD PERMITS | 146 datasets |
| **Seattle, WA** | cos-data.seattle.gov | `76t5-zqzr` | Building Permits | Large |
| **Miami, FL** | data.miamigov.com | `7ey5-m434` | Building Permits Issued 2014-Present | Large |
| **Mesa, AZ** | citydata.mesaaz.gov | `dzpk-hxfb` | Building Permits | Large |
| **Corona, CA** | corstat.coronaca.gov | `2agx-camz` | CorStat - Building Permits | Large |
| **Austin, TX** | datahub.austintexas.gov | `3z4i-4ta5` | Issued Building Permits | 77 datasets |
| **New York City** | data.cityofnewyork.us | `ipu4-2q9a` | DOB Permit Issuance | 60 datasets |
| **Cincinnati, OH** | data.cincinnati-oh.gov | `uhjb-xac9` | Cincinnati Building Permits | Large |
| **Kansas City, MO** | data.kcmo.org | (multiple) | Building Permits | 15 datasets |
| **Norfolk, VA** | data.norfolk.gov | `bnrb-u445` | Permits and Inspections | Large |
| **New Orleans, LA** | data.nola.gov | `nbcf-m6c2` | Building Permits (2018-present) | Large |
| **Baton Rouge, LA** | data.brla.gov | `7fq7-8j7r` | EBR Building Permits | Large |
| **Fort Worth, TX** | data.fortworthtexas.gov | `quz7-xnsy` | Development Permits | Large |
| **Cambridge, MA** | data.cambridgema.gov | `9qm7-wbdc` | Building Permits: New Construction | 47 datasets |
| **Montgomery County, MD** | data.montgomerycountymd.gov | `qxie-8qnp` | Electrical Building Permits | 77 datasets |
| **Little Rock, AR** | data.littlerock.gov | `vms9-5yvi` | Building Permits Issued | Large |
| **Framingham, MA** | data.framinghamma.gov | `2vzw-yean` | Building Permits | Large |
| **Gainesville, FL** | data.cityofgainesville.org | `p798-x3nx` | Building Permits | Large |
| **Somerville, MA** | data.somervillema.gov | `nneb-s3f7` | Applications for Permits & Licenses | Small |
| **Providence, RI** | data.providenceri.gov | `ufmm-rbej` | Permits 2009-2018 | Medium |
| **Camas, WA** | performance.cityofcamas.us | `bpag-h9vx` | Residential Building Permit Totals | Small |
| **Orlando, FL** | data.cityoforlando.net | `ax5w-8xzi` | Building Permit Applications 2018-2021 | Medium |
| **Oxnard, CA** | data.oxnard.org | `vmzx-48vx` | Building Permits | Medium |
| **Roseville, CA** | data.roseville.ca.us | `buxi-gsvq` | Building Permits Issued | Medium |
| **Urbana, IL** | data.urbanaillinois.us | `9rzq-mqbh` | Community Development Permits | Medium |

**SODA API pattern:**
```
GET https://{domain}/resource/{dataset_id}.json?$where=date_trunc_y(issue_date) = '2025'&$limit=50000
```

### Tier 1B: CKAN / ArcGIS Open Data Permit Datasets

| City | Platform | URL | Dataset Name |
|------|----------|-----|--------------|
| **Boston, MA** | CKAN (Analyze Boston) | data.boston.gov | Approved Building Permits (600K+ records) |
| **Pittsburgh, PA** | CKAN (WPRDC) | data.wprdc.org | PLI Permits (2012-present) |
| **Denver, CO** | ArcGIS Hub | opendata-geospatialdenver.hub.arcgis.com | Residential Construction Permits |
| **Sacramento, CA** | ArcGIS Hub | data.cityofsacramento.org | Applied/Issued Building Permits |
| **Naperville, IL** | ArcGIS Hub | data.naperville.il.us | Building Permits |
| **Greensboro, NC** | ArcGIS Hub | data.greensboro-nc.gov | Building Permits |
| **Cleveland, OH** | ArcGIS Hub | data.clevelandohio.gov | Issued Building Permits |

### Tier 2: Confirmed Accela Citizen Access Portals

These cities have active Accela Citizen Access portals at `https://aca-prod.accela.com/{CODE}/Default.aspx` that respond with HTTP 200. The Accela REST API (v4) can potentially be used for data extraction.

| City | Accela Code | Portal URL | Notes |
|------|-------------|-----------|-------|
| **Denver, CO** | DENVER | aca-prod.accela.com/DENVER | Also has ArcGIS open data |
| **Sacramento, CA** | SACRAMENTO | aca-prod.accela.com/SACRAMENTO | Also has ArcGIS open data |
| **Fresno, CA** | FRESNO | aca-prod.accela.com/FRESNO | Primary permit system |
| **Oakland, CA** | OAKLAND | aca-prod.accela.com/OAKLAND | agency_id: OAKLAND |
| **Charlotte, NC** | CHARLOTTE | aca-prod.accela.com/CHARLOTTE | agency_id: CHARLOTTE_EC |
| **Baltimore, MD** | BALTIMORE | aca-prod.accela.com/BALTIMORE | agency_id: BALTCO |
| **Detroit, MI** | DETROIT | aca-prod.accela.com/DETROIT | agency_id: DEMODETROIT |
| **El Paso, TX** | ELPASO | aca-prod.accela.com/ELPASO | Confirmed via search |
| **San Antonio, TX** | COSA | aca.sanantonio.gov/citizenaccess | Custom domain |
| **Atlanta, GA** | ATLANTA_GA | aca-prod.accela.com/ATLANTA_GA | agency_id: ATLANTA_EC |
| **Stockton, CA** | STOCKTON | aca-prod.accela.com/STOCKTON | Primary permit system |
| **Colorado Springs, CO** | COSPRINGS | aca-prod.accela.com/COSPRINGS | Confirmed |
| **Cleveland, OH** | COC | aca-prod.accela.com/COC | Also has ArcGIS open data |
| **Chula Vista, CA** | CHULAVISTA | permits.chulavistaca.gov/CitizenAccess | Custom domain |
| **Santa Rosa, CA** | SANTAROSA | aca-prod.accela.com/SANTAROSA | Confirmed |
| **Alameda, CA** | ALAMEDA | aca-prod.accela.com/ALAMEDA | Confirmed |
| **Visalia, CA** | VISALIA | aca-prod.accela.com/VISALIA | agency_id: VISALIA |
| **Fontana, CA** | FONTANA | aca-prod.accela.com/FONTANA | agency_id: FONTANA |
| **Tampa, FL** | TAMPA | aca-prod.accela.com/TAMPA | Confirmed |
| **Clearwater, FL** | CLEARWATER | aca-prod.accela.com/CLEARWATER | agency_id: CLEARWATER |
| **San Leandro, CA** | SANLEANDRO | aca-prod.accela.com/SANLEANDRO | Confirmed |
| **Chino, CA** | CHINO | aca-prod.accela.com/CHINO | agency_id: CHINO |
| **Cupertino, CA** | CUPERTINO | aca-prod.accela.com/CUPERTINO | agency_id: CUPERTINO |
| **Santa Clara, CA** | SANTACLARA | aca-prod.accela.com/SANTACLARA | Confirmed |
| **Rochester, NY** | ROCHESTER | aca-prod.accela.com/ROCHESTER | Confirmed |
| **Tacoma, WA** | TACOMA | aca-prod.accela.com/TACOMA | Confirmed |
| **Richmond, VA** | RICHMOND | aca-prod.accela.com/RICHMOND | Confirmed |
| **Fort Lauderdale, FL** | FTL | aca-prod.accela.com/FTL | Also "LauderBuild" branding |
| **Mesa, AZ** | MESA | aca-prod.accela.com/MESA | agency_id: MESA; also Socrata |
| **Huntington Beach, CA** | - | engage.huntingtonbeachca.gov/CitizenAccess | Custom domain |
| **Pittsburgh, CA (Pittsburg)** | PITTSBURG | aca-prod.accela.com/PITTSBURG | Note: this is Pittsburg CA, not Pittsburgh PA |

**Accela API v4 pattern:**
```
GET https://apis.accela.com/v4/records?type=Building/Permit&fields=id,type,status,openedDate&limit=1000
Authorization: Bearer {access_token}
```
Note: Accela API requires OAuth2 app credentials per agency.

### Tier 3: Custom Permit Platforms (Confirmed)

| City | Platform | URL | API Available | Notes |
|------|----------|-----|---------------|-------|
| **Phoenix, AZ** | Custom (PDD Online / SHAPE PHX) | apps-secure.phoenix.gov/PDD | Limited | New SHAPE PHX system |
| **San Jose, CA** | Custom (SJPermits) | sjpermits.org | Limited search | Custom city platform |
| **Minneapolis, MN** | Custom | opendata.minneapolismn.gov | Limited | Has historic permit dashboard |
| **Long Beach, CA** | Custom (LB Services) | permitslicenses.longbeach.gov | Limited | Address-based search |
| **Pompano Beach, FL** | Click2Gov | c2g.pompanobeachfl.gov | Limited | CentralSquare Click2Gov |
| **Olympia, WA** | SmartGov | ci-olympia-wa.smartgovcommunity.com | Limited | SmartGov portal |
| **Toledo, OH** | Custom/Accela hybrid | citizenaccess.toledo.oh.gov | Limited | Also has new portal |
| **Coral Gables, FL** | Tyler EnerGov | cityofcoralgablesfl.tylerportico.com | Limited | Tyler Portico |
| **Salem, OR** | Custom (PAC Portal) | egov.cityofsalem.net/PACPortal | Limited | City's own system |
| **Tacoma, WA** | Custom | tacomapermits.org | Limited | Dashboard + search |
| **Bellevue, WA** | Custom | bellevuewa.gov/development-activity | Some open data | 1998-present |
| **Huntsville, AL** | Custom (ePlans) | huntsvilleal.gov | Limited | ePlans Review system |
| **Naperville, IL** | ArcGIS/Custom | data.naperville.il.us | ArcGIS API | Has building permits dataset |
| **Greensboro, NC** | ArcGIS/Custom | data.greensboro-nc.gov | ArcGIS API | Interactive permit portal |

### Tier 4: State-Level Data Sources

| State | Platform | URL | Coverage | Notes |
|-------|----------|-----|----------|-------|
| **New Jersey** | Socrata (State Portal) | data.nj.gov | All NJ cities | Dataset: `w9se-dmra` - NJ Construction Permit Data |
| **Oregon** | Accela (State) | aca-oregon.accela.com | Many OR cities | Oregon ePermitting - statewide |
| **Colorado** | Socrata (State Portal) | data.colorado.gov | County-level | Building Permit Counts in Colorado |
| **Texas** | Socrata (State Portal) | data.texas.gov | Collin County etc. | Collin CAD Building Permits |
| **US (HUD)** | ArcGIS | hudgis-hud.opendata.arcgis.com | All counties | Residential Construction Permits by County |
| **US (Census)** | Census Bureau | census.gov/construction/bps | All jurisdictions | Building Permits Survey (BPS) - monthly |

---

## Cities with NO Identified Permit Data Access

The following city categories have no readily discoverable structured permit data:

1. **Very small cities** (pop < 10,000): Unlikely to have digital permit systems. Manual processes or basic record-keeping.
2. **Counties/transit agencies** (116 entries with no population): Many are not jurisdictions that issue building permits.
3. **Some mid-size cities** that use proprietary systems without public APIs or open data portals.

---

## Platform Dominance Analysis

Based on our 291-city directory:

| Platform | Estimated Cities Using | % of Directory | Data Accessibility |
|----------|----------------------|----------------|-------------------|
| Accela | 100-120 | 34-41% | Medium-High (API requires credentials) |
| Socrata | 25-35 | 9-12% | **Very High** (open SODA API) |
| Tyler EnerGov | 15-25 | 5-9% | Medium (varies by installation) |
| ArcGIS Hub | 10-15 | 3-5% | High (ArcGIS REST API) |
| CKAN | 5-10 | 2-3% | High (CKAN API) |
| Custom | 30-50 | 10-17% | Low (scraping required) |
| No digital system | 40-60 | 14-21% | None |

---

## Recommended Integration Approach

### Phase 1: Socrata (Immediate - 27+ cities)

**Effort:** Low | **Impact:** High | **Timeline:** 1-2 weeks

The Socrata SODA API is the most standardized and accessible. All 27+ confirmed datasets use the same REST API pattern.

**Implementation:**
```python
# Example: Fetch Chicago building permits
import requests
url = "https://data.cityofchicago.org/resource/ydr8-5enu.json"
params = {
    "$where": "issue_date >= '2024-01-01'",
    "$limit": 50000,
    "$select": "id, permit_, permit_type, issue_date, estimated_cost, work_description"
}
response = requests.get(url, params=params)
permits = response.json()
```

**Priority cities for Socrata integration:**
1. Chicago (ydr8-5enu) - already has data
2. Seattle (76t5-zqzr) - currently "skipped"
3. Los Angeles (xnhu-aczu) - massive dataset
4. Austin (3z4i-4ta5) - active open data program
5. New York City (ipu4-2q9a) - massive dataset
6. Dallas (e7gq-4sah) - already has data
7. Miami (7ey5-m434) - already has data
8. Cincinnati (uhjb-xac9) - structured data
9. Norfolk (bnrb-u445) - structured data
10. New Orleans (nbcf-m6c2) - structured data

### Phase 2: CKAN / ArcGIS Open Data (2-3 weeks)

**Effort:** Low-Medium | **Impact:** Medium | **Timeline:** 2-3 weeks

**Cities to add:**
- Boston (data.boston.gov - CKAN API)
- Pittsburgh (data.wprdc.org - CKAN API)
- Denver (ArcGIS Hub)
- Sacramento (ArcGIS Hub)
- Naperville (ArcGIS Hub)
- Greensboro (ArcGIS Hub)
- Cleveland (ArcGIS Hub)

### Phase 3: Accela REST API (3-6 weeks)

**Effort:** Medium | **Impact:** Very High | **Timeline:** 3-6 weeks

Accela's REST API v4 could unlock 24+ additional cities. However, it requires:
1. Registering for Accela developer credentials
2. Each agency may need separate approval
3. Rate limits apply

**High-priority Accela-only cities (no Socrata alternative):**
1. Fresno, CA
2. Oakland, CA (limited Socrata)
3. Charlotte, NC
4. El Paso, TX
5. San Antonio, TX
6. Stockton, CA
7. Colorado Springs, CO
8. Tampa, FL
9. Santa Rosa, CA
10. Fontana, CA

### Phase 4: State-Level Data (4-8 weeks)

**Effort:** Medium | **Impact:** Medium | **Timeline:** 4-8 weeks

State-level datasets can fill gaps:
- **NJ Construction Permit Data** on data.nj.gov covers Newark, Princeton, and other NJ cities
- **Oregon ePermitting** covers Salem and other OR cities
- **HUD Building Permits Survey** covers all US counties (aggregate monthly data)
- **Census Bureau BPS** provides monthly permit counts by jurisdiction

### Phase 5: Custom Platform Scrapers (8-12 weeks)

**Effort:** High | **Impact:** Medium | **Timeline:** 8-12 weeks

For cities with proprietary systems, custom scrapers would be needed:
- Phoenix (PDD Online / SHAPE PHX)
- San Jose (SJPermits)
- Long Beach (LB Services)
- Pompano Beach (Click2Gov)

---

## API Endpoint Patterns Discovered

### Socrata SODA API
```
Base: https://{domain}/resource/{4x4_id}.json
Auth: App token (optional but recommended)
Paging: $offset and $limit
Filtering: $where clause with SoQL
Example: https://data.cityofchicago.org/resource/ydr8-5enu.json?$limit=1000
```

### Accela REST API v4
```
Base: https://apis.accela.com/v4
Auth: OAuth2 Bearer token
Records: GET /v4/records?type=Building/Permit&limit=1000
Record detail: GET /v4/records/{id}
Inspections: GET /v4/records/{id}/inspections
Requires: App ID, App Secret, Agency name, Environment
```

### CKAN API
```
Base: https://{domain}/api/3/action
Search: /package_search?q=building+permit
Dataset: /package_show?id={dataset_id}
Records: /datastore_search?resource_id={resource_id}&limit=1000
```

### ArcGIS Feature Service
```
Base: https://{hub}/api/v3/datasets
Query: /query?where=1=1&outFields=*&f=json
Paging: resultOffset and resultRecordCount
```

### Socrata Discovery API (for finding new datasets)
```
Base: https://api.us.socrata.com/api/catalog/v1
Search: ?q=building+permit&domains={domain}&limit=50
Returns: Dataset metadata including 4x4 IDs
```

---

## Coverage Projection

### Current State
- 14 cities with permits = "available" (4.8%)
- Only Chicago and McKinney have actual permit data populated

### After Phase 1 (Socrata)
- +27 cities = ~41 cities (14.1%)
- High-confidence, structured data

### After Phase 2 (CKAN/ArcGIS)
- +7 cities = ~48 cities (16.5%)

### After Phase 3 (Accela API)
- +24 cities = ~72 cities (24.7%)

### After Phase 4 (State-level)
- +10 cities = ~82 cities (28.2%)

### After Phase 5 (Custom)
- +10 cities = ~92 cities (31.6%)

### Ultimate potential (with 232 Accela-flagged cities)
If Accela developer access is obtained broadly, up to **150-180 cities (52-62%)** could have permit data.

---

## Priority Implementation List

### Immediate (This Sprint)
| # | City | Platform | Dataset ID | Pop. | Status Change |
|---|------|----------|-----------|------|---------------|
| 1 | Seattle, WA | Socrata | 76t5-zqzr | 734K | skipped -> available |
| 2 | Boston, MA | CKAN | cd1ec3ff | 666K | skipped -> available |
| 3 | Los Angeles* | Socrata | xnhu-aczu | N/A | new entry needed |
| 4 | Austin, TX* | Socrata | 3z4i-4ta5 | N/A | new entry needed |
| 5 | New York City* | Socrata | ipu4-2q9a | N/A | new entry needed |
| 6 | Denver, CO | ArcGIS+Accela | DENVER | 711K | add permits |
| 7 | Cincinnati, OH* | Socrata | uhjb-xac9 | N/A | new entry needed |
| 8 | Pittsburgh, PA | CKAN (WPRDC) | pli-permits | 304K | add permits |
| 9 | Sacramento, CA | Accela+ArcGIS | SACRAMENTO | 524K | add permits |
| 10 | Norfolk, VA* | Socrata | bnrb-u445 | N/A | new entry needed |

*Cities not currently in the govdirectory 291 or without population data

### Next Sprint
| # | City | Platform | Dataset/Code |
|---|------|----------|-------------|
| 11 | Fresno, CA | Accela | FRESNO |
| 12 | Oakland, CA | Accela | OAKLAND |
| 13 | Charlotte, NC | Accela | CHARLOTTE |
| 14 | Baltimore, MD | Accela | BALTIMORE |
| 15 | El Paso, TX | Accela | ELPASO |
| 16 | Cleveland, OH | Accela+ArcGIS | COC |
| 17 | Tampa, FL | Accela | TAMPA |
| 18 | San Antonio, TX | Accela | COSA |
| 19 | Stockton, CA | Accela | STOCKTON |
| 20 | Colorado Springs, CO | Accela | COSPRINGS |

---

## Appendix A: Complete Socrata Domain-to-Dataset Mapping

| Socrata Domain | # Permit Datasets | Primary Dataset ID | Notes |
|---------------|-------------------|-------------------|-------|
| data.cityofchicago.org | 31 | ydr8-5enu | Flagship dataset |
| data.lacity.org | 146 | xnhu-aczu | Split by era (pre-2010, 2010-2019, 2020+) |
| datahub.austintexas.gov | 77 | 3z4i-4ta5 | Very active open data program |
| data.montgomerycountymd.gov | 77 | qxie-8qnp | County-level |
| data.cityofnewyork.us | 60 | ipu4-2q9a | DOB Permit Issuance |
| data.cambridgema.gov | 47 | 9qm7-wbdc | Granular permit types |
| citydata.mesaaz.gov | 31 | dzpk-hxfb | Active + retired datasets |
| cos-data.seattle.gov | 23 | 76t5-zqzr | Primary Seattle domain |
| corstat.coronaca.gov | 22 | 2agx-camz | CorStat performance system |
| data.kcmo.org | 15 | (multiple) | Historical + current |
| www.dallasopendata.com | 11 | e7gq-4sah | Active dataset |
| data.framinghamma.gov | 9 | 2vzw-yean | Active dataset |
| data.nola.gov | 9 | nbcf-m6c2 | 2018-present |
| data.cincinnati-oh.gov | 7 | uhjb-xac9 | Active dataset |
| data.cityofgainesville.org | 6 | p798-x3nx | Active dataset |
| data.littlerock.gov | 6 | vms9-5yvi | Active dataset |
| data.norfolk.gov | 5 | bnrb-u445 | Active dataset |
| data.brla.gov | 5 | 7fq7-8j7r | East Baton Rouge |
| data.somervillema.gov | 5 (permits) | nneb-s3f7 | Applications for Permits |
| performance.cityofcamas.us | 3 | bpag-h9vx | Performance metrics |
| data.miamigov.com | 2 | 7ey5-m434 | 2014-present |
| data.cityoforlando.net | 2 | ax5w-8xzi | 2018-2021 |
| data.sccgov.org | 2 | wgaw-xdpb | Processing times only |
| data.fortworthtexas.gov | 1 | quz7-xnsy | Development permits |
| data.providenceri.gov | 1 | ufmm-rbej | 2009-2018 (historical) |

## Appendix B: Accela Portal Code Reference

Verified active (HTTP 200) portals on `aca-prod.accela.com`:

```
DENVER, SACRAMENTO, FRESNO, OAKLAND, CHARLOTTE, BALTIMORE, DETROIT,
ELPASO, STOCKTON, COSPRINGS, CHULAVISTA, SANTAROSA, ALAMEDA, VISALIA,
FONTANA, TAMPA, CLEARWATER, SANLEANDRO, CHINO, CUPERTINO, SANTACLARA,
ROCHESTER, TACOMA, RICHMOND, MESA, COSA, ATLANTA_GA, COC (Cleveland), FTL
```

Custom Accela domains confirmed:
```
aca.sanantonio.gov/citizenaccess (San Antonio)
permits.chulavistaca.gov/CitizenAccess (Chula Vista)
engage.huntingtonbeachca.gov/CitizenAccess (Huntington Beach)
lmsaca.fresno.gov/CitizenAccess (Fresno - alternate)
```

## Appendix C: Methodology

### Data Sources Probed
1. **Socrata Discovery API** (`api.us.socrata.com/api/catalog/v1`) - searched `building+permit`, `permits+issued`, `construction+permits`, `development+permit` across 50+ domains
2. **Accela Citizen Access** - HTTP probed `aca-prod.accela.com/{CODE}` for 100+ city code variations
3. **Custom Accela domains** - Probed known patterns like `permits.{city}.gov`, `aca.{city}.gov`
4. **ArcGIS Hub** - Searched opendata.arcgis.com for city-specific permit data
5. **CKAN portals** - Checked Boston (data.boston.gov) and Pittsburgh (data.wprdc.org)
6. **Web searches** - Targeted searches for "{city} building permit open data portal" for 30+ cities
7. **Existing project data** - Analyzed all 291 city JSON profiles for `data_sources.accela`, `data_sources.socrata`, and `governance.accela_agency_id` fields

### Limitations
- Accela API access requires developer registration per agency; portal existence does not guarantee API access
- Some Socrata datasets may be stale or incomplete
- Custom platforms were assessed based on web research, not live API testing
- Cities may have permit data in systems not discovered through these search methods
- Population data is missing for 116 entries (counties, transit agencies, etc.)
