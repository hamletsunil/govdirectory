# New Data Sources Research

**govdirectory Project -- High-Value Data Source Assessment**

| Metadata | Value |
|---|---|
| Research Date | 2026-02-13 |
| Researcher | govdirectory Research Agent |
| Scope | 15 potential data sources for 290 city profiles |
| Status | Complete |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Prioritized Source Rankings](#2-prioritized-source-rankings)
3. [Top 5 Sources: Detailed API Specifications](#3-top-5-sources-detailed-api-specifications)
4. [Full Source Assessments](#4-full-source-assessments)
5. [Phased Integration Roadmap](#5-phased-integration-roadmap)
6. [Coverage Gap Analysis](#6-coverage-gap-analysis)

---

## 1. Executive Summary

This research evaluates 15 potential new data sources for integration into the govdirectory 290-city profile system. Each source is assessed on four dimensions:

- **Coverage**: What percentage of the 290 cities can be served by this source?
- **Accuracy**: How authoritative and precise is the data?
- **Citizen Value**: How useful is this data to residents making civic decisions?
- **Integration Effort**: How difficult is it to build and maintain the integration?

### Key Findings

1. **CDC PLACES** is the highest-value addition -- it covers all 290 cities with place-level health data via a well-documented Socrata SODA API. Integration effort is low because the project already uses Socrata-based APIs.

2. **HUD/USPS Vacancy Data** provides quarterly vacancy rate data accessible through a documented REST API with ZIP-to-tract crosswalk files. High citizen value for understanding neighborhood change.

3. **IRS SOI ZIP Code Data** provides income and tax data at the ZIP code level that can be mapped to cities. Annual release, CSV/Excel download format.

4. **USDA Food Access Research Atlas** provides food desert and food access indicators at the census tract level. GIS API available.

5. **FCC Broadband Data Collection** provides broadband availability data at the census tract level. Available through ArcGIS Living Atlas.

6. **Socrata Discovery API** is a meta-source that can enumerate all open datasets for any city with a Socrata portal, dramatically expanding per-city data coverage.

### Sources Not Recommended at This Time

- **DOE/EIA Energy Data**: State-level only; no city-level API granularity available.
- **FFIEC CRA Data**: Flat file downloads only, no API; high integration effort for moderate value.
- **BJS Crime Data**: Overlaps heavily with existing FBI UCR data; the LEARCAT tool is useful but adds marginal value over what we have.

---

## 2. Prioritized Source Rankings

Sources are ranked by a composite score: `(Coverage x Accuracy x Citizen_Value) / Integration_Effort`

Each factor is scored 1-5:
- **Coverage**: 1 = <20% of cities, 2 = 20-40%, 3 = 40-60%, 4 = 60-80%, 5 = 80-100%
- **Accuracy**: 1 = estimates only, 2 = modeled, 3 = survey-based, 4 = administrative records, 5 = direct measurement/census
- **Citizen Value**: 1 = niche interest, 2 = some utility, 3 = moderately useful, 4 = highly useful, 5 = essential civic info
- **Integration Effort**: 1 = trivial (API, JSON, documented), 2 = easy, 3 = moderate, 4 = difficult, 5 = very difficult

| Rank | Source | Tier | Coverage | Accuracy | Citizen Value | Effort | Score | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 1 | **CDC PLACES** | T1 | 5 | 4 | 5 | 1 | 100.0 | **INTEGRATE NOW** |
| 2 | **HUD/USPS Vacancy** | T1 | 5 | 5 | 4 | 2 | 50.0 | **INTEGRATE NOW** |
| 3 | **USDA Food Access** | T1 | 5 | 4 | 4 | 2 | 40.0 | **INTEGRATE NOW** |
| 4 | **Socrata Discovery** | T4 | 3 | 4 | 5 | 2 | 30.0 | **INTEGRATE NOW** |
| 5 | **IRS SOI** | T1 | 5 | 5 | 4 | 3 | 33.3 | **PHASE 2** |
| 6 | **FCC Broadband** | T1 | 5 | 4 | 4 | 3 | 26.7 | **PHASE 2** |
| 7 | **HRSA HPSA** | T1 | 4 | 5 | 4 | 2 | 40.0 | **PHASE 2** |
| 8 | **OpenStates** | T4 | 5 | 4 | 3 | 2 | 30.0 | **PHASE 2** |
| 9 | **ArcGIS Hub** | T3/T4 | 3 | 4 | 4 | 3 | 16.0 | **PHASE 2** |
| 10 | **data.gov Catalog** | T1 | 5 | 3 | 3 | 2 | 22.5 | **PHASE 2** |
| 11 | **Municode/Am. Legal** | T4 | 4 | 5 | 3 | 3 | 20.0 | **PHASE 3** |
| 12 | **DOT/FHWA** | T1 | 3 | 4 | 3 | 4 | 9.0 | **PHASE 3** |
| 13 | **BJS/LEARCAT** | T1 | 4 | 4 | 3 | 3 | 16.0 | **PHASE 3** |
| 14 | **FFIEC CRA** | T1 | 4 | 5 | 3 | 4 | 15.0 | **PHASE 3** |
| 15 | **DOE/EIA** | T1 | 1 | 4 | 3 | 4 | 3.0 | **NOT RECOMMENDED** |

---

## 3. Top 5 Sources: Detailed API Specifications

### 3.1 CDC PLACES -- Local Data for Better Health

**Authority:** Centers for Disease Control and Prevention (CDC)
**Tier:** T1 (Federal Agency)
**Data Domain:** City-level health outcomes, prevention, risk behaviors, disabilities, social determinants

#### What Data Does It Provide?

CDC PLACES provides modeled estimates for 36+ health measures across multiple categories:

- **Health Outcomes:** Arthritis, asthma, cancer, chronic kidney disease, COPD, coronary heart disease, diabetes, high blood pressure, high cholesterol, mental health, obesity, stroke, tooth loss
- **Prevention:** Cholesterol screening, colorectal cancer screening, dental visits, health insurance coverage, mammography, routine checkups, flu vaccinations
- **Risk Behaviors:** Binge drinking, current smoking, physical inactivity, short sleep duration
- **Disabilities:** Cognitive, hearing, mobility, vision, self-care, independent living
- **Health Status:** Fair or poor self-rated health, frequent mental distress, frequent physical distress
- **Social Determinants:** Selected ACS-derived indicators

#### Geographic Granularity

- **Place level** (incorporated places and census-designated places) -- covers all 290 cities
- Also available at county, census tract, and ZCTA levels

#### API Details

**Platform:** Socrata Open Data API (SODA)
**Authentication:** Optional (app token recommended for higher rate limits)
**Rate Limits:** 1,000 requests/hour without token; higher with token

**Endpoint (2025 release, Place-level data):**
```
https://data.cdc.gov/resource/eav7-hnsx.json
```

**Alternative CSV Download:**
```
https://data.cdc.gov/api/views/eav7-hnsx/rows.csv?accessType=DOWNLOAD
```

**Sample SODA Query -- Get all health measures for Los Angeles, CA:**
```
https://data.cdc.gov/resource/eav7-hnsx.json?$where=StateAbbr='CA' AND PlaceName='Los Angeles'
```

**Sample SODA Query -- Get obesity rates for all places in Texas:**
```
https://data.cdc.gov/resource/eav7-hnsx.json?$where=StateAbbr='TX' AND MeasureId='OBESITY'&$select=PlaceName,Data_Value,Low_Confidence_Limit,High_Confidence_Limit
```

**Sample SODA Query -- Get all measures for a specific FIPS place code:**
```
https://data.cdc.gov/resource/eav7-hnsx.json?PlaceFIPS=0644000
```

**Response Format (JSON example):**
```json
{
  "StateAbbr": "CA",
  "StateDesc": "California",
  "PlaceName": "Los Angeles",
  "PlaceFIPS": "0644000",
  "TotalPopulation": "3898747",
  "Data_Value": "29.1",
  "Low_Confidence_Limit": "28.2",
  "High_Confidence_Limit": "30.0",
  "Data_Value_Type": "Age-adjusted prevalence",
  "Category": "Health Outcomes",
  "Measure": "Obesity among adults aged >=18 years",
  "MeasureId": "OBESITY",
  "DataSource": "BRFSS",
  "Data_Value_Unit": "%",
  "Year": "2023",
  "Geolocation": {"latitude": "34.0194", "longitude": "-118.4108"}
}
```

**Key Fields for Provenance:**
- `DataSource` = "BRFSS" (Behavioral Risk Factor Surveillance System)
- `Data_Value_Type` = "Age-adjusted prevalence" (methodological note)
- `Low_Confidence_Limit` / `High_Confidence_Limit` = margin of error
- `Year` = data vintage

#### Update Frequency
Annual release (typically in late fall). The 2025 release is currently the latest.

#### Estimated Integration Effort: LOW
- Socrata SODA API is well-documented and REST-based
- JSON response format matches existing data pipeline patterns
- Place FIPS codes align with Census identifiers already in use
- No authentication required (but app token recommended)
- Rate limits are generous for 290-city batch retrieval

#### Citizen Value: HIGH
Health data is among the most frequently sought civic information. Obesity rates, insurance coverage, mental health indicators, and preventive care utilization directly inform residents' understanding of community health.

---

### 3.2 HUD/USPS Vacancy Data

**Authority:** U.S. Department of Housing and Urban Development (HUD) + U.S. Postal Service (USPS)
**Tier:** T1 (Federal Agency)
**Data Domain:** Residential and business address vacancy rates, no-stat addresses

#### What Data Does It Provide?

- **Residential vacancy rates** by geography (addresses classified as vacant by USPS mail carriers)
- **Business vacancy rates** by geography
- **No-stat addresses** (addresses receiving no mail for 90+ days)
- **Total deliverable addresses** (denominator for vacancy rate calculation)
- Quarterly time series enabling trend analysis

#### Geographic Granularity

- Census Tract level (primary)
- County level
- ZIP code level (via crosswalk)
- City-level data can be computed by aggregating tracts within city boundaries

#### API Details

**Platform:** HUD User API
**Authentication:** Required (free API token from HUD User registration)
**Registration URL:** `https://www.huduser.gov/hudapi/public/register`

**USPS Vacancy Data API Endpoint:**
```
https://www.huduser.gov/hudapi/public/usps?type=1&query=06037
```
- `type=1` = ZIP-to-Tract crosswalk
- `type=2` = ZIP-to-County
- `type=3` = ZIP-to-CBSA
- `type=4` = ZIP-to-CD (Congressional District)
- `query` = state FIPS, county FIPS, or ZIP code

**Crosswalk API Endpoint:**
```
https://www.huduser.gov/hudapi/public/usps?type=1&query=90210
```

**Headers Required:**
```
Authorization: Bearer {your_token}
```

**Bulk Data Download:**
```
https://www.huduser.gov/portal/datasets/usps.html
```
Quarterly data files available in CSV format for all geographies.

**Sample API Query -- Get vacancy data for a ZIP code:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://www.huduser.gov/hudapi/public/usps?type=1&query=90210"
```

**Response Format (JSON):**
```json
{
  "data": {
    "results": [
      {
        "geoid": "06037701000",
        "zip": "90210",
        "year": 2025,
        "quarter": 4,
        "tot_ratio": 0.85,
        "res_ratio": 0.90,
        "bus_ratio": 0.10
      }
    ]
  }
}
```

#### Update Frequency
Quarterly (data reflects USPS carrier observations; posted ~2 months after quarter end).

#### Estimated Integration Effort: LOW-MEDIUM
- Documented REST API with JSON responses
- Requires free API token registration
- Need ZIP-to-city mapping (can use the HUD crosswalk API itself)
- Tract-to-city aggregation needed for city-level figures
- Quarterly updates are manageable

#### Citizen Value: HIGH
Vacancy rates are a leading indicator of neighborhood health, blight, economic distress, and housing market conditions. This data is valuable for residents, community organizations, and local policymakers.

---

### 3.3 USDA Food Access Research Atlas

**Authority:** U.S. Department of Agriculture, Economic Research Service (USDA ERS)
**Tier:** T1 (Federal Agency)
**Data Domain:** Food access indicators, food deserts, supermarket accessibility

#### What Data Does It Provide?

- **Low-income, low-access (LILA) indicators** at the census tract level
- **Distance to nearest supermarket** by population subgroup
- **Vehicle access** indicators (households without vehicles and far from stores)
- **SNAP participation** rates
- **Food desert classifications** using multiple distance thresholds (1 mile urban / 10 miles rural, 0.5 mile urban / 10 miles rural)
- **Population counts** by access category (low income, low access, children, seniors)

#### Geographic Granularity

- Census tract level (all ~73,000 tracts nationwide)
- Can be aggregated to city level using tract-to-place crosswalks
- Covers all 290 cities (tracts within city boundaries)

#### API Details

**GIS API Endpoint (ArcGIS REST Service):**
```
https://gis.ers.usda.gov/arcgis/rest/services/FoodAccess/FoodAccessResearchAtlas/MapServer
```

**Query a specific layer (e.g., food desert tracts):**
```
https://gis.ers.usda.gov/arcgis/rest/services/FoodAccess/FoodAccessResearchAtlas/MapServer/0/query?where=State='06' AND County='037'&outFields=*&f=json
```

**Bulk Data Download (Excel/CSV):**
```
https://www.ers.usda.gov/data-products/food-access-research-atlas/download-the-data/
```

The download provides a single Excel file with all census tracts and all indicators.

**Data.gov Catalog Entry:**
```
https://catalog.data.gov/dataset/food-access-research-atlas
```

**Sample GIS Query -- Get food access data for tracts in Los Angeles County:**
```
https://gis.ers.usda.gov/arcgis/rest/services/FoodAccess/FoodAccessResearchAtlas/MapServer/0/query?where=County='06037'&outFields=CensusTract,State,County,LILATracts_1And10,lapop1_10,lalowi1_10,lakids1_10,laseniors1_10,lawhite1_10,lablack1_10,lahisp1_10&f=json
```

**Key Data Fields:**
| Field | Description |
|---|---|
| `LILATracts_1And10` | Flag: Low income and low access tract (1mi urban/10mi rural) |
| `LILATracts_halfAnd10` | Flag: Low income and low access tract (0.5mi urban/10mi rural) |
| `lapop1_10` | Population count, low access at 1mi/10mi threshold |
| `lalowi1_10` | Low income population count, low access |
| `lakids1_10` | Children (age 0-17), low access |
| `laseniors1_10` | Seniors (age 65+), low access |
| `TractSNAP` | SNAP participants in tract |
| `GroupQuartersFlag` | Flag for group quarters (colleges, prisons, etc.) |

#### Update Frequency
Approximately every 3-5 years (based on Census/ACS updates). Current data uses 2019 ACS. Next update expected after 2020 Census tract boundaries are fully incorporated.

#### Estimated Integration Effort: LOW-MEDIUM
- ArcGIS REST API is well-documented and standard
- GeoJSON output available
- Bulk download option as fallback
- Census tract to city mapping required (same infrastructure as USPS vacancy)
- Infrequent updates reduce maintenance burden

#### Citizen Value: HIGH
Food access is a critical equity and public health issue. "Food desert" status directly affects where residents shop, what they eat, and their health outcomes. This data is especially valuable for low-income communities.

---

### 3.4 Socrata Discovery API

**Authority:** Various (meta-source that indexes government open data portals)
**Tier:** T4 (Government-Contracted Platform Provider, indexing T3 sources)
**Data Domain:** Catalog of all datasets published on Socrata-powered open data portals

#### What Data Does It Provide?

The Socrata Discovery API is not a data source itself but a **meta-source** that enables:

- **Enumeration of all datasets** published by a city's open data portal
- **Search across all Socrata portals** (hundreds of government domains)
- **Dataset metadata** including name, description, update frequency, column definitions, row count, and API endpoint
- Automatic discovery of city-specific datasets that could be integrated

This is extremely valuable for expanding per-city data coverage because many of the 290 cities operate Socrata open data portals.

#### Geographic Granularity

Varies by dataset discovered; typically city-level since portals are operated by city governments.

#### API Details

**Discovery API Endpoint:**
```
https://api.us.socrata.com/api/catalog/v1
```

**List all domains (portals) and their dataset counts:**
```
https://api.us.socrata.com/api/catalog/v1/domains
```

**Search datasets for a specific city domain:**
```
https://api.us.socrata.com/api/catalog/v1?domains=data.cityofchicago.org
```

**Search datasets by keyword across all portals:**
```
https://api.us.socrata.com/api/catalog/v1?q=building+permits&only=datasets
```

**Filter by category:**
```
https://api.us.socrata.com/api/catalog/v1?domains=data.cityofchicago.org&categories=Public+Safety
```

**Sample Response (JSON):**
```json
{
  "results": [
    {
      "resource": {
        "name": "Building Permits",
        "id": "ydr8-5enu",
        "parent_fxf": [],
        "description": "All building permits issued from January 2006 to present.",
        "attribution": "City of Chicago",
        "type": "dataset",
        "updatedAt": "2026-02-10T12:00:00Z",
        "createdAt": "2011-09-30T00:00:00Z",
        "columns_field_name": ["id", "permit_", "permit_type", "application_start_date", ...],
        "page_views": {"page_views_total": 123456},
        "download_count": 78901
      },
      "classification": {
        "categories": ["Buildings"],
        "tags": ["permits", "buildings"]
      },
      "metadata": {
        "domain": "data.cityofchicago.org"
      },
      "permalink": "https://data.cityofchicago.org/d/ydr8-5enu",
      "link": "https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu"
    }
  ],
  "resultSetSize": 567
}
```

**Workflow for Expanding City Coverage:**
1. Query `api/catalog/v1/domains` to find which of the 290 cities have Socrata portals.
2. For each city portal domain, enumerate datasets.
3. Classify datasets by category (permits, crime, transportation, budget, etc.).
4. Add the most valuable/universal datasets to the per-city profile.

#### Update Frequency
The Discovery API itself is always current. Individual datasets have their own update schedules.

#### Estimated Integration Effort: LOW-MEDIUM
- Well-documented REST API, no authentication required
- The effort is in building the discovery/classification pipeline
- Individual dataset integrations vary in effort
- Not all 290 cities have Socrata portals (estimated ~60-80 do)

#### Citizen Value: HIGH
This is the single best way to dramatically expand per-city data without adding a single new federal source. Permits, budgets, 311 requests, crime incidents, transportation data, and more are already published by cities on Socrata.

---

### 3.5 IRS Statistics of Income (SOI) -- ZIP Code Data

**Authority:** Internal Revenue Service (IRS), Statistics of Income Division
**Tier:** T1 (Federal Agency)
**Data Domain:** Individual income tax return statistics by ZIP code

#### What Data Does It Provide?

- **Number of tax returns** by adjusted gross income (AGI) bracket
- **Total income** amounts (salaries/wages, dividends, interest, business income, capital gains)
- **Deductions** (mortgage interest, charitable contributions, state/local taxes)
- **Tax liability** (total tax, earned income credit, child tax credit)
- **Filing status** (single, married filing jointly, head of household)
- **Dependents** claimed
- Data is classified by state, ZIP code, and AGI size class

This provides a rich economic profile of a city's residents that goes well beyond Census income data.

#### Geographic Granularity

- **ZIP code level** -- can be mapped to cities using ZIP-to-place crosswalks
- Some small ZIP codes may have data suppressed for privacy
- Covers all 290 cities (ZIP codes exist for every city)

#### Data Access

**There is no REST API.** Data is available as bulk CSV/Excel downloads from the IRS website.

**Download URL (2022 tax year, most recent):**
```
https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-statistics-2022-zip-code-data-soi
```

**Data.gov Catalog Entry:**
```
https://catalog.data.gov/dataset/zip-code-data/resource/242fc4b2-85d8-495b-bfc1-04402ac16dfc
```

**File Formats:**
- CSV (comma-separated values) -- one file per state, plus a national file
- Excel (.xlsx) -- one file per state

**Key Data Fields:**
| Field | Description |
|---|---|
| `STATEFIPS` | State FIPS code |
| `STATE` | State abbreviation |
| `ZIPCODE` | 5-digit ZIP code |
| `AGI_STUB` | AGI size class (1-6, from under $25K to $200K+) |
| `N1` | Number of returns |
| `A00100` | Adjusted gross income (thousands of dollars) |
| `A00200` | Salaries and wages amount |
| `A00300` | Taxable interest amount |
| `A00600` | Ordinary dividends amount |
| `A00900` | Business or professional net income |
| `A01000` | Net capital gain (less loss) |
| `A04470` | Total itemized deductions amount |
| `A18425` | State and local income taxes amount |
| `A18450` | State and local general sales tax amount |
| `A18500` | Real estate taxes amount |
| `A19300` | Charitable contributions amount |
| `A06500` | Total income tax amount |
| `A59660` | Earned income credit amount |
| `N2` | Number of exemptions |

**Sample Workflow:**
1. Download the national CSV file (~80MB).
2. Filter rows by ZIP codes that fall within each of the 290 cities.
3. Aggregate across AGI size classes to produce city-level totals.
4. Compute derived indicators (median AGI bracket, total charitable giving, % of returns with mortgage interest deduction).

#### Update Frequency
Annual. Data for tax year N is typically released in approximately N+2 (e.g., tax year 2022 data released in 2024). There is a significant lag.

#### Estimated Integration Effort: MEDIUM
- No API; requires bulk file download and parsing
- ZIP-to-city mapping infrastructure needed
- AGI bracket aggregation logic must be built
- Annual update cadence simplifies maintenance
- File format is stable year-to-year

#### Citizen Value: HIGH
Income distribution, tax liability patterns, charitable giving, and economic participation data at the neighborhood level provides insights that Census income data alone cannot. This is especially valuable for understanding economic inequality within cities.

---

## 4. Full Source Assessments

### 4.1 CDC PLACES
*(See Section 3.1 for full details)*

**Summary:** Best single addition to the project. Covers all cities, strong API, low effort.

---

### 4.2 HUD/USPS Vacancy Data
*(See Section 3.2 for full details)*

**Summary:** Quarterly vacancy rates provide a unique economic health indicator not available from any other source.

---

### 4.3 USDA Food Access Research Atlas
*(See Section 3.3 for full details)*

**Summary:** Food desert data is a high-value equity indicator. GIS API available. Updated infrequently but data remains relevant.

---

### 4.4 Socrata Discovery API
*(See Section 3.4 for full details)*

**Summary:** Meta-source that unlocks per-city open data discovery. High strategic value.

---

### 4.5 IRS SOI ZIP Code Data
*(See Section 3.5 for full details)*

**Summary:** Rich economic data, no API (bulk download only), medium effort.

---

### 4.6 FCC Broadband Data Collection

**Authority:** Federal Communications Commission (FCC)
**Tier:** T1
**Data Domain:** Fixed and mobile broadband availability by geography

**What It Provides:**
- Broadband service availability by provider, technology type, and speed tier
- Broadband Serviceable Location (BSL) counts per geography
- Service tier coverage percentages (25/3 Mbps, 100/20 Mbps, etc.)

**Geographic Granularity:** Census block, census tract (aggregated), H3 hexagonal grid. Can be aggregated to city level.

**API/Access:**
- Primary access through ArcGIS Living Atlas feature layers:
  `https://www.arcgis.com/home/item.html?id=22ca3a8bb2ff46c1983fb45414157b08`
- FCC BDC API for filers: `https://github.com/FCC/bdcapi`
- National Broadband Map: `https://broadbandmap.fcc.gov`
- Bulk data available through FCC data downloads

**Data Format:** ArcGIS Feature Service (GeoJSON, Shapefile), CSV downloads

**Update Frequency:** Semi-annual (June and December filings, published ~3-6 months after filing deadline)

**Estimated Effort:** MEDIUM -- ArcGIS feature service queries are well-understood but spatial aggregation to city boundaries is needed. No simple REST API for non-spatial queries.

**Citizen Value:** HIGH -- Broadband access is increasingly recognized as essential infrastructure. The digital divide is a top civic concern. Data on which neighborhoods lack broadband access is actionable.

---

### 4.7 HHS HRSA Health Professional Shortage Areas (HPSA)

**Authority:** Health Resources and Services Administration (HRSA), U.S. Department of Health and Human Services
**Tier:** T1
**Data Domain:** Healthcare provider shortage area designations

**What It Provides:**
- HPSA designations for primary care, dental health, and mental health
- HPSA scores (0-25 scale indicating severity of shortage)
- Designation type (geographic, population-based, facility-based)
- Underserved population counts
- Provider-to-population ratios

**Geographic Granularity:** County, service area, and address-level lookups. City-level data can be determined by address or by cross-referencing with county/service area boundaries.

**API/Access:**
- HPSA Find Tool: `https://data.hrsa.gov/tools/shortage-area/hpsa-find`
- Address-based lookup: `https://data.hrsa.gov/topics/health-workforce/shortage-areas/by-address`
- Bulk data download: `https://data.hrsa.gov/data/download` (select "Health Workforce" > "Shortage Areas")
- Data current as of February 2026

**Data Format:** CSV downloads, interactive web tools. No fully documented public REST API for programmatic bulk queries, but the download files are comprehensive.

**Update Frequency:** Continuous (designations are reviewed and updated on an ongoing basis)

**Estimated Effort:** MEDIUM -- Bulk download is straightforward; mapping HPSA service areas to city boundaries requires spatial analysis.

**Citizen Value:** HIGH -- Knowing whether your city has a shortage of primary care doctors, dentists, or mental health providers is directly actionable health information.

---

### 4.8 OpenStates

**Authority:** Plural Policy (formerly Open States)
**Tier:** T4 (non-profit aggregator of official state legislature data)
**Data Domain:** State legislature bills, votes, legislators, committees

**What It Provides:**
- State legislators (names, districts, party, contact info)
- Bills and resolutions (full text, sponsors, actions, votes)
- Committee memberships
- Legislative sessions and calendars
- District-level geographic data

**Geographic Granularity:** State legislative district level. Can be mapped to cities by determining which districts overlap with city boundaries.

**API/Access:**
- API v3 root: `https://v3.openstates.org/`
- API documentation: `https://docs.openstates.org/api-v3/`
- Bulk data: `https://open.pluralpolicy.com/data/`
- API key required (free registration)

**Sample Query -- Get legislators for a location:**
```
https://v3.openstates.org/people.geo?lat=34.05&lng=-118.24&apikey=YOUR_KEY
```

**Sample Query -- Search bills:**
```
https://v3.openstates.org/bills?jurisdiction=California&q=housing&apikey=YOUR_KEY
```

**Data Format:** JSON

**Update Frequency:** Daily (typically 1-2 days behind official sources)

**Estimated Effort:** LOW-MEDIUM -- Well-documented API. The challenge is mapping legislative districts to cities and determining which bills are relevant to specific cities.

**Citizen Value:** MEDIUM -- State legislation affects cities profoundly (e.g., housing laws, tax policy, education funding). Knowing your state legislators and relevant bills adds value to city profiles.

---

### 4.9 ArcGIS Hub

**Authority:** Various local governments (T3) hosting data on Esri's ArcGIS platform
**Tier:** T3/T4
**Data Domain:** GIS datasets (parcels, zoning, infrastructure, boundaries, facilities)

**What It Provides:**
- Zoning maps and land use data
- Parcel boundaries and property information
- Infrastructure layers (roads, utilities, parks)
- Facility locations (fire stations, police stations, libraries, hospitals)
- Demographic overlays
- Environmental layers (floodplains, wetlands)

**Geographic Granularity:** Varies; typically very precise (parcel level, point locations).

**API/Access:**
- Hub search: `https://hub.arcgis.com/search`
- Each dataset exposes GeoServices REST API, WMS, and WFS endpoints
- Download formats: CSV, KML, GeoJSON, Shapefile, GeoTIFF

**Update Frequency:** Varies by publisher; some real-time, some annual.

**Estimated Effort:** MEDIUM-HIGH -- Highly heterogeneous. Each city's ArcGIS Hub has different datasets with different schemas. No standardized way to query across all hubs.

**Citizen Value:** HIGH for cities that have it; zero for cities that do not.

---

### 4.10 data.gov Federal Dataset Catalog

**Authority:** U.S. General Services Administration (GSA)
**Tier:** T1 (meta-catalog)
**Data Domain:** Metadata catalog of all federal open datasets

**What It Provides:**
- Metadata (titles, descriptions, URLs, formats, publishers) for 300,000+ federal datasets
- Not the data itself -- links to the data on agency websites
- Search by keyword, geography, publisher, format

**API/Access:**
- CKAN API: `https://catalog.data.gov/api/3/`
- Package search: `https://catalog.data.gov/api/3/action/package_search?q=city+permits`
- Bulk metadata download: available in JSON Lines format

**Data Format:** JSON (CKAN standard)

**Update Frequency:** Metadata updated monthly

**Estimated Effort:** LOW-MEDIUM -- Easy to query, but results are metadata only. Useful for discovering new federal sources but does not replace direct source integration.

**Citizen Value:** MEDIUM -- Primarily useful as a discovery mechanism for the project team, not directly user-facing.

---

### 4.11 Municode / American Legal Publishing

**Authority:** CivicPlus (Municode) and American Legal Publishing
**Tier:** T4
**Data Domain:** Municipal codes, ordinances, and charter documents

**What It Provides:**
- Full text of municipal codes (zoning, building, business licenses, traffic, etc.)
- Ordinances (legislative history)
- City charters
- Searchable, browsable code libraries

**Geographic Granularity:** City level (each code is specific to one municipality).

**API/Access:**
- Municode Library: `https://library.municode.com/`
- American Legal Code Library: `https://codelibrary.amlegal.com/`
- No documented public API for either platform
- URLs are stable and predictable (e.g., `https://library.municode.com/{state}/{city}/codes/code_of_ordinances`)

**Coverage:** Municode hosts 3,300+ codes; American Legal hosts hundreds more. Estimated coverage of the 290 cities: ~80%.

**Update Frequency:** Continuous (as ordinances are adopted and codified).

**Estimated Effort:** MEDIUM -- No API means URLs must be cataloged manually or discovered programmatically. But the effort is one-time per city (just linking to the correct URL).

**Citizen Value:** MEDIUM -- Having a direct link to the city's municipal code is useful but not frequently accessed by average residents.

---

### 4.12 DOT/FHWA Transportation Data

**Authority:** U.S. Department of Transportation, Federal Highway Administration
**Tier:** T1
**Data Domain:** Highway statistics, bridge conditions, traffic volumes, pavement quality

**What It Provides:**
- Annual Average Daily Traffic (AADT) counts
- Bridge condition ratings (National Bridge Inventory)
- Pavement condition (IRI - International Roughness Index)
- Functional system classification of roads
- Highway Performance Monitoring System (HPMS) data

**Geographic Granularity:** Highway link/segment level; state-level aggregations. City-level data requires spatial analysis to extract segments within city boundaries.

**API/Access:**
- DOT Developer Portal: `https://www.transportation.gov/developer`
- Data Portal: `https://data.transportation.gov`
- HPMS data: `https://www.fhwa.dot.gov/policyinformation/hpms.cfm`
- National Bridge Inventory: downloadable datasets

**Update Frequency:** Annual (Highway Statistics published annually)

**Estimated Effort:** HIGH -- Data is link/segment-level, requiring GIS analysis to aggregate to city level. Multiple datasets with different formats. No simple city-level API.

**Citizen Value:** MEDIUM -- Bridge conditions and road quality are important but niche interests for most residents.

---

### 4.13 Bureau of Justice Statistics (BJS) / LEARCAT

**Authority:** Bureau of Justice Statistics, U.S. Department of Justice
**Tier:** T1
**Data Domain:** Crime victimization, incident-based crime reporting, law enforcement data

**What It Provides:**
- NIBRS incident-based crime data (more detailed than FBI UCR summary data)
- Victim demographics, offender characteristics, weapon types
- Crime by location type
- Law enforcement agency profiles
- LEARCAT tool for city-level crime analysis

**Geographic Granularity:** Law enforcement agency level (typically maps to city or county).

**API/Access:**
- NIBRS API: `https://bjs.ojp.gov/national-incident-based-reporting-system-nibrs-national-estimates-api`
- NCVS API: `https://bjs.ojp.gov/national-crime-victimization-survey-ncvs-api`
- LEARCAT: `https://bjs.ojp.gov/data/data-analysis-tools` (interactive tool, data available 2016-2024)
- FBI Crime Data Explorer (complements BJS): `https://cde.ucr.cjis.gov/`

**Update Frequency:** Annual (with ~1-2 year lag)

**Estimated Effort:** MEDIUM -- APIs exist but overlap significantly with already-integrated FBI UCR data. Marginal value may not justify separate integration.

**Citizen Value:** MEDIUM -- Adds granularity beyond UCR but core crime statistics are already covered.

---

### 4.14 FFIEC CRA (Community Reinvestment Act) Lending Data

**Authority:** Federal Financial Institutions Examination Council (FFIEC)
**Tier:** T1
**Data Domain:** Small business and small farm lending by geography

**What It Provides:**
- Number and dollar amounts of small business loans by census tract
- Lending patterns by income level of census tract
- Bank-by-bank lending disclosure reports
- Aggregate lending activity by geography

**Geographic Granularity:** Census tract, county, MSA

**API/Access:**
- Data Products page: `https://www.ffiec.gov/data/cra/data-products`
- Bulk flat file downloads (no REST API)
- Software for processing: `https://www.ffiec.gov/data/cra/software-downloads`

**Data Format:** Flat files (fixed-width text), CSV conversions available

**Update Frequency:** Annual (data for year N available ~September of year N+1)

**Estimated Effort:** HIGH -- No API, flat file format requires custom parsing, tract-to-city aggregation needed.

**Citizen Value:** MEDIUM -- Lending patterns reveal economic investment (or disinvestment) in neighborhoods. Valuable for understanding redlining and equitable development.

---

### 4.15 DOE/EIA Energy Data

**Authority:** U.S. Energy Information Administration (EIA), Department of Energy
**Tier:** T1
**Data Domain:** Energy production, consumption, prices

**What It Provides:**
- Electricity consumption by state and sector (residential, commercial, industrial)
- Natural gas consumption by state
- Energy prices by state
- Utility-level data (electricity sales, revenue, customers by utility service territory)

**Geographic Granularity:** State level for most data. Utility-level for electricity (EIA-861 survey data). **City-level data is not directly available.**

**API/Access:**
- EIA Open Data API: `https://api.eia.gov/v2/`
- API registration: `https://www.eia.gov/opendata/register.php`
- API documentation: `https://www.eia.gov/opendata/documentation.php`
- Dashboard: `https://www.eia.gov/opendata/browser/`

**Sample Query:**
```
https://api.eia.gov/v2/electricity/retail-sales/data?api_key=YOUR_KEY&frequency=monthly&data[0]=revenue&facets[stateid][]=CA
```

**Update Frequency:** Monthly (state electricity data), annual (utility-level data)

**Estimated Effort:** HIGH -- State-level data requires apportionment to cities (unreliable). Utility-level data requires mapping utility service territories to city boundaries (complex and incomplete).

**Citizen Value:** MEDIUM -- Energy costs affect all residents, but state-level data is not precise enough for city profiles.

**Recommendation:** NOT RECOMMENDED at this time due to lack of city-level granularity. Revisit if EIA introduces city-level data products.

---

## 5. Phased Integration Roadmap

### Phase 1: Quick Wins (Target: 4-6 weeks)

These sources have documented APIs, well-structured data, and low integration complexity.

| Source | Action | Estimated Dev Time | Outcome |
|---|---|---|---|
| **CDC PLACES** | Integrate SODA API for 36+ health measures across all 290 cities | 1-2 weeks | Health outcomes, prevention, risk behaviors for every city profile |
| **HUD/USPS Vacancy** | Integrate HUD API for quarterly vacancy rates | 1-2 weeks | Residential and business vacancy rates for every city |
| **Socrata Discovery** | Build discovery pipeline to enumerate datasets per city | 1-2 weeks | Inventory of available open data for each city portal |
| **USDA Food Access** | Download bulk data and integrate via GIS API | 1 week | Food desert indicators for every city |

**Phase 1 Deliverables:**
- 36+ health measures per city (CDC PLACES)
- Quarterly vacancy rate trends per city (HUD/USPS)
- Food access/food desert status per city (USDA)
- Catalog of available open datasets per city (Socrata Discovery)
- Provenance metadata for all new data points per the Data Provenance Constitution

---

### Phase 2: Medium Effort (Target: 2-3 months after Phase 1)

These sources require more complex data processing, spatial analysis, or mapping infrastructure.

| Source | Action | Estimated Dev Time | Outcome |
|---|---|---|---|
| **IRS SOI** | Build bulk download pipeline, ZIP-to-city mapping, AGI aggregation | 2-3 weeks | Income distribution, tax data for every city |
| **FCC Broadband** | Integrate ArcGIS feature service, spatial aggregation to city boundaries | 2-3 weeks | Broadband availability by speed tier for every city |
| **HRSA HPSA** | Download HPSA data, map service areas to cities | 1-2 weeks | Healthcare shortage designations for every city |
| **OpenStates** | Integrate API, map districts to cities | 2-3 weeks | State legislators and relevant bills per city |
| **ArcGIS Hub** | Catalog city-specific ArcGIS Hub portals, integrate top datasets | 2-4 weeks | GIS datasets (zoning, parcels, facilities) for cities with hubs |
| **data.gov Catalog** | Build discovery pipeline for federal datasets with city-level data | 1-2 weeks | Expanded federal data inventory per city |

**Phase 2 Deliverables:**
- Income and tax profile per city (IRS SOI)
- Broadband coverage metrics per city (FCC)
- Healthcare shortage status per city (HRSA)
- State legislative representation per city (OpenStates)
- Expanded GIS data for cities with ArcGIS hubs
- Federal dataset discovery layer

---

### Phase 3: Aspirational (Target: 6-12 months after Phase 2)

These sources are high-effort or provide moderate incremental value over existing sources.

| Source | Action | Estimated Dev Time | Outcome |
|---|---|---|---|
| **Municode/Am. Legal** | Catalog municipal code URLs for all 290 cities | 2-4 weeks | Direct links to municipal code for every city |
| **DOT/FHWA** | Extract city-level infrastructure metrics from segment data | 4-6 weeks | Bridge conditions, road quality for cities |
| **BJS/LEARCAT** | Integrate NIBRS API for enhanced crime detail | 2-3 weeks | Incident-level crime detail beyond UCR |
| **FFIEC CRA** | Parse flat files, map tracts to cities | 3-4 weeks | Lending patterns and economic investment data |
| **USPS Occupancy Trends** | Direct USPS product integration (beyond HUD aggregate) | 3-4 weeks | More granular vacancy data |

**Phase 3 Deliverables:**
- Municipal code access for every city
- Infrastructure quality metrics
- Enhanced crime analytics
- Community lending patterns

---

## 6. Coverage Gap Analysis

### Data Domains After Full Integration

| Domain | Current Sources | New Sources (Phases 1-3) | Gap After Integration |
|---|---|---|---|
| **Demographics** | Census ACS | IRS SOI (income detail) | Minimal |
| **Economy/Employment** | BLS LAUS | IRS SOI (tax data), FFIEC CRA (lending) | Minimal |
| **Health** | None | CDC PLACES, HRSA HPSA | **Closed** |
| **Housing** | HUD FMR | HUD/USPS Vacancy | Minimal |
| **Education** | NCES CCD, GreatSchools | -- | Already strong |
| **Public Safety** | FBI UCR | BJS/LEARCAT | Minimal |
| **Environment** | EPA AQS | USDA Food Access | Minimal |
| **Infrastructure** | None | FCC Broadband, DOT/FHWA | **Closed** |
| **Governance** | Legistar, PrimeGov, CivicPlus, Swagit | OpenStates, Municode | Enhanced |
| **Civic Engagement** | SeeClickFix | Socrata Discovery (311, etc.) | Enhanced |
| **Permits/Development** | Accela/Socrata (limited) | ArcGIS Hub, Socrata Discovery | Enhanced |
| **Economic Equity** | None | IRS SOI, USDA Food Access, FFIEC CRA | **Closed** |

### Remaining Gaps (Future Research Needed)

| Gap Area | Potential Future Sources | Notes |
|---|---|---|
| **Utility costs** (water, electric, gas) | Local utility companies, PUC filings | Highly fragmented; no national source |
| **Public transit** | GTFS feeds (General Transit Feed Specification) | Available for transit agencies, not a federal source |
| **Property tax rates** | County assessor offices | Highly fragmented; no standard API |
| **Local budget/spending** | City open data portals (Socrata, ArcGIS) | Partially addressed by Socrata Discovery |
| **Voter turnout/elections** | State secretary of state offices | Fragmented across 50 states |
| **Internet speed tests** | Ookla/M-Lab | Not government sources (prohibited per Constitution) |

---

## References

### Federal Agency Sources
- [IRS SOI ZIP Code Data](https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-statistics-zip-code-data-soi)
- [CDC PLACES](https://www.cdc.gov/places/index.html)
- [CDC PLACES Place Data 2025 Release (Socrata)](https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-Place-Data-202/eav7-hnsx)
- [FCC Broadband Data Collection](https://www.fcc.gov/BroadbandData)
- [FCC BDC in ArcGIS Living Atlas](https://www.arcgis.com/home/item.html?id=22ca3a8bb2ff46c1983fb45414157b08)
- [USDA Food Access Research Atlas](https://www.ers.usda.gov/data-products/food-access-research-atlas)
- [HHS HRSA Shortage Areas](https://data.hrsa.gov/topics/health-workforce/shortage-areas/)
- [HRSA Data Downloads](https://data.hrsa.gov/data/download)
- [DOE EIA Open Data](https://www.eia.gov/opendata/)
- [HUD USPS Vacancy Data](https://www.huduser.gov/portal/datasets/usps.html)
- [HUD USPS API Documentation](https://www.huduser.gov/portal/dataset/uspszip-api.html)
- [FFIEC CRA Data Products](https://www.ffiec.gov/data/cra/data-products)
- [BJS NIBRS API](https://bjs.ojp.gov/national-incident-based-reporting-system-nibrs-national-estimates-api)
- [BJS NCVS API](https://bjs.ojp.gov/national-crime-victimization-survey-ncvs-api)
- [DOT Developer Portal](https://www.transportation.gov/developer)
- [DOT Data Portal](https://data.transportation.gov)
- [data.gov CKAN API](https://catalog.data.gov/dataset/data-gov-ckan-api)
- [data.gov APIs](https://data.gov/developers/apis/)

### Platform-Based Sources
- [Socrata Developer Portal](https://dev.socrata.com/)
- [Socrata Discovery API](https://api.us.socrata.com/api/catalog/v1)
- [ArcGIS Hub](https://hub.arcgis.com/search)
- [Municode Library](https://library.municode.com/)
- [American Legal Code Library](https://codelibrary.amlegal.com/)
- [OpenStates API v3 Documentation](https://docs.openstates.org/api-v3/)
- [OpenStates Bulk Data](https://open.pluralpolicy.com/data/)
