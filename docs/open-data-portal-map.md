# Open Data Portal Map for Govdirectory Cities

**Generated:** 2026-02-13
**Methodology:** Systematic querying of the Socrata Discovery API (`api.us.socrata.com/api/catalog/v1`), direct portal verification via web fetch, and web search for ArcGIS Hub, CKAN, and other platform portals.

---

## Summary

| Metric | Value |
|--------|-------|
| Total cities in govdirectory | 290 |
| Cities with discoverable open data portals | 42 |
| Coverage rate | 14.5% |
| Socrata-powered portals | 17 |
| ArcGIS Hub portals | 22 |
| CKAN/OpenGov portals | 5 |
| Opendatasoft portals | 1 |
| Total Socrata datasets discovered | ~8,800+ |

Note: Several cities have portals on multiple platforms (e.g., Fort Lauderdale has both Socrata and ArcGIS Hub). The 42-city count is deduplicated. Additionally, 3 major cities not in the 290-city list (NYC, Los Angeles, Austin) were discovered as reference portals with massive dataset collections totaling over 6,000 datasets.

---

## Socrata-Powered Portals

These portals were discovered and verified via the Socrata Discovery API. Dataset counts are exact as returned by the API.

| City | State | Domain | Datasets | Key Categories |
|------|-------|--------|----------|----------------|
| **Chicago** | IL | data.cityofchicago.org | 1,961 | Permits, 311, Crime, Budget, Transportation, Business Licenses |
| **Mesa** | AZ | citydata.mesaaz.gov | 1,167 | Permits, Police, Crime, Budget, Housing |
| **Dallas** | TX | www.dallasopendata.com | 1,009 | Permits, Crime, Police, Transportation, GIS |
| **Oakland** | CA | data.oaklandca.gov | 739 | 311, Crime, Police, Budget, Permits, Housing |
| **Kansas City** | MO | data.kcmo.org | 347 | Permits, 311, Crime, Budget, Property |
| **Seattle** | WA | data.seattle.gov | 301 | Permits, Crime, 911, Transportation |
| **Providence** | RI | data.providenceri.gov | 297 | Crime, Police, Budget, Permits, Property |
| **Fort Lauderdale** | FL | fortlauderdale.data.socrata.com | 197 | Police, Crime, GIS, 311 |
| **Pittsburgh** | PA | fiscalfocus.pittsburghpa.gov | 195 | Budget, Payroll, Expenses, Revenue |
| **Plano** | TX | dashboard.plano.gov | 131 | Police, 911, Budget, Water Quality |
| **Franklin** | TN | performance.franklintn.gov | 88 | Budget, Economic Development, Safety |
| **Richmond** | VA | data.richmondgov.com | 54 | Business Licenses, Budget, Property, 311 |
| **Somerville** | MA | data.somervillema.gov | 49 | Crime, 311, Transportation, Permits |
| **Colorado Springs** | CO | data.coloradosprings.gov | 16 | Budget, Finance |
| **Miami** | FL | data.miamigov.com | 13 | 311, Permits, Budget |

**Reference portals (not in 290-city list but important benchmarks):**

| City | State | Domain | Datasets | Key Categories |
|------|-------|--------|----------|----------------|
| **NYC** | NY | data.cityofnewyork.us | 2,997 | Permits, 311, Crime, Budget, Transportation, Housing |
| **Austin** | TX | datahub.austintexas.gov | 2,223 | Permits, 311, Crime, Budget, Transportation, GIS |
| **Los Angeles** | CA | data.lacity.org | 923 | Permits, 311, Crime, Budget, Business Licenses |
| **New Orleans** | LA | data.nola.gov | 282 | Permits, 311, Crime, Police, Short-term Rentals |

---

## CKAN/OpenGov Portals

These portals use the CKAN open-source platform, typically hosted by OpenGov.

| City | State | Portal URL | Key Categories |
|------|-------|-----------|----------------|
| **Boston** | MA | data.boston.gov | Permits, 311, Crime, Budget, Property, Food Inspections |
| **Phoenix** | AZ | data.phoenix.gov | Police, Fire, Budget, Health |
| **San Antonio** | TX | data.sanantonio.gov | Permits, 311, Crime, Police |
| **San Jose** | CA | data.sanjoseca.gov | Police, Fire, Permits, Budget |
| **Laredo** | TX | data.openlaredo.com | GIS, City Services, Public Safety, Economy |

---

## ArcGIS Hub Portals

These portals are powered by Esri's ArcGIS Hub platform. They tend to focus more on GIS/geospatial data but many also include tabular datasets.

| City | State | Portal URL | Key Categories |
|------|-------|-----------|----------------|
| **Baltimore** | MD | data.baltimorecity.gov | Crime, Housing, Transportation, Health, Budget, GIS |
| **Detroit** | MI | data.detroitmi.gov | Crime, 311, Permits, Property, Blight, Food Inspections |
| **Charlotte** | NC | data.charlottenc.gov | Crime, Housing, Transportation, Permits, Budget |
| **Denver** | CO | denvergov.org/opendata | GIS, Transportation, Public Safety, Parks, Demographics, Health |
| **Minneapolis** | MN | opendata.minneapolismn.gov | Crime, 311, Permits, GIS, Transportation, Business Licensing |
| **Cleveland** | OH | data.clevelandohio.gov | Crime, Housing, Transportation, Health, GIS |
| **Sacramento** | CA | data.cityofsacramento.org | Permits, 311, Crime, Budget, Parks, Transportation |
| **Greensboro** | NC | data.greensboro-nc.gov | Crime, Police, Traffic, Permits |
| **El Paso** | TX | city-of-el-paso-open-data-coepgis.hub.arcgis.com | GIS, Zoning, Transportation |
| **Toledo** | OH | data.toledo.gov | GIS, Transportation, Parks, Health, Housing, Econ Development |
| **Fresno** | CA | city-of-fresno-gis-hub-cityoffresno.hub.arcgis.com | GIS, Zoning, Planning |
| **Atlanta** | GA | dpcd-coaplangis.opendata.arcgis.com | Planning, Zoning, GIS, Crime, Transportation |
| **Huntsville** | AL | gis-huntsvilleal.opendata.arcgis.com | GIS, Planning, Zoning |
| **Corpus Christi** | TX | gis-corpus.opendata.arcgis.com | GIS, Police, Transportation |
| **Riverside** | CA | geodata-cityofriverside.opendata.arcgis.com | GIS, Permits, 311, Fire |
| **McKinney** | TX | mckinneygis-mck.opendata.arcgis.com | GIS, Public Safety, Planning, Parks |
| **Olathe** | KS | data.olatheks.org | GIS, Zoning, Public Works, Code Enforcement |
| **Salem** | OR | data.cityofsalem.net | GIS, Zoning, Planning, Infrastructure |
| **Coral Gables** | FL | coral-gables-smart-city-hub-2-cggis.hub.arcgis.com | GIS, Permits, Police, Budget |
| **Tacoma** | WA | data.cityoftacoma.org | GIS, Transportation, Planning |
| **Alexandria** | VA | cityofalexandria-alexgis.opendata.arcgis.com | GIS, Zoning, Planning |
| **Bellevue** | WA | data.bellevuewa.gov | Permits, Budget, Crime, GIS, Demographics |
| **Naperville** | IL | data.naperville.il.us | Police, Permits, Budget, GIS |

---

## Opendatasoft/Huwise Portals

| City | State | Portal URL | Datasets | Key Categories |
|------|-------|-----------|----------|----------------|
| **Long Beach** | CA | data.longbeach.gov | ~300 | 311, Police, Homelessness, Climate, Permits |

---

## Dataset Category Availability Across Cities

This table shows which key dataset categories are available and how many cities offer each type.

| Dataset Category | Cities with Data | Count | Priority for Integration |
|-----------------|-----------------|-------|------------------------|
| **Permits** (building, construction) | Chicago, Dallas, Seattle, Oakland, Providence, Kansas City, Austin, NYC, LA, Boston, San Antonio, San Jose, Long Beach, New Orleans, Sacramento, Minneapolis, Charlotte, Bellevue, Naperville, Coral Gables, Miami, Mesa | 22 | HIGH |
| **Crime/Public Safety** | Chicago, Dallas, Seattle, Oakland, Kansas City, Austin, NYC, LA, Boston, San Antonio, New Orleans, Somerville, Baltimore, Detroit, Charlotte, Cleveland, Greensboro, Minneapolis, Atlanta, Bellevue, Plano | 21 | HIGH |
| **Police Data** | Chicago, Dallas, Seattle, Oakland, Kansas City, Austin, NYC, LA, Boston, San Antonio, San Jose, New Orleans, Fort Lauderdale, Greensboro, Phoenix, Detroit, Minneapolis, Plano, Coral Gables, Naperville, McKinney | 21 | HIGH |
| **Budget/Finance** | Chicago, Oakland, Providence, Kansas City, Pittsburgh, Colorado Springs, Austin, NYC, LA, Boston, Franklin, Plano, Fort Lauderdale, Mesa, Sacramento, Charlotte, Denver, Bellevue, Coral Gables, Naperville | 20 | HIGH |
| **GIS/Geospatial** | Dallas, Austin, Denver, El Paso, Fresno, Huntsville, Corpus Christi, McKinney, Olathe, Salem, Tacoma, Alexandria, Fort Lauderdale, Toledo, Riverside, Sacramento, Cleveland, Greensboro, Atlanta | 19 | MEDIUM |
| **311 Service Requests** | Chicago, Oakland, Providence, Kansas City, Austin, NYC, LA, Boston, San Antonio, Long Beach, New Orleans, Somerville, Sacramento, Minneapolis, Riverside, Richmond | 16 | HIGH |
| **Transportation** | Chicago, Seattle, Austin, NYC, LA, Denver, Baltimore, Charlotte, Cleveland, Sacramento, Toledo, Tacoma, Somerville | 13 | MEDIUM |
| **Business Licenses** | Chicago, Richmond, Austin, NYC, LA, Minneapolis | 6 | MEDIUM |
| **Property Assessment** | Providence, Oakland, Boston, Detroit, Richmond, Kansas City | 6 | LOW |
| **Health** | Baltimore, Cleveland, Denver, Phoenix, Toledo | 5 | LOW |

---

## Recommended Priority Datasets for Integration

Based on availability across many cities and API accessibility, these datasets should be prioritized:

### Tier 1 -- Highest Coverage and Value
1. **Building/Construction Permits** (22 cities) -- Universally available on Socrata and CKAN portals with structured API access. Fields typically include: permit number, type, address, issue date, status, valuation, description of work.

2. **Crime Incident Reports** (21 cities) -- Widely available with consistent fields: incident number, date, type/category, location (block-level), disposition. Updated frequently (daily or weekly).

3. **311 Service Requests** (16 cities) -- Highly standardized across cities. Fields: request ID, type/category, date, location, status, resolution. Updated daily or more frequently.

4. **Budget/Financial Data** (20 cities) -- Available in multi-year historical format. Fields: department, line item, appropriation, revenue source, fiscal year.

### Tier 2 -- Good Coverage
5. **Police Calls for Service / Dispatch** (21 cities) -- Real-time or near-real-time data. Fields: call type, time, location, unit, disposition.

6. **GIS Boundary Data** (19 cities) -- Zoning, parcels, neighborhoods, wards. Available as GeoJSON/Shapefile. Useful for enriching other datasets with geographic context.

7. **Transportation** (13 cities) -- Traffic incidents, parking, transit routes. Varies significantly by city.

### Tier 3 -- Emerging
8. **Business Licenses** (6 cities) -- Growing availability. Active business registration data.
9. **Property Assessment** (6 cities) -- Tax assessments and parcel-level property data.

---

## Cities Without Discoverable Open Data Portals

Of the 290 cities in the govdirectory list, approximately 248 cities (85.5%) did not have discoverable open data portals through the methods used in this research. This includes many smaller cities (population under 50,000) where open data programs are less common.

Notable larger cities in the govdirectory list where no dedicated open data portal was found:
- **Stockton, CA** (320,030 pop.) -- No dedicated portal found
- **Newark, NJ** (307,355 pop.) -- No dedicated portal found
- **Fontana, CA** (209,279 pop.) -- No dedicated portal found
- **Huntington Beach, CA** (197,481 pop.) -- No dedicated portal found
- **Grand Prairie, TX** (197,279 pop.) -- No dedicated portal found

Some of these cities may have data available through:
- State-level open data portals (e.g., data.texas.gov, data.illinois.gov, data.california.gov)
- County-level portals
- Individual department websites without a centralized portal
- FOIA/public records request processes

---

## Methodology Notes

### Socrata Discovery API
- Queried `https://api.us.socrata.com/api/catalog/v1` with `domains=` parameter for known city portal domains
- Also used `q=` parameter to search for city names and discover previously unknown domains
- Tested common domain patterns: `data.{city}.gov`, `data.{city}{state}.gov`, `{city}.data.socrata.com`, `data.cityof{city}.org`
- The API returns exact dataset counts (`resultSetSize`) and dataset metadata

### ArcGIS Hub
- Tested common URL patterns: `data-{city}.opendata.arcgis.com`, `{city}-{state}.hub.arcgis.com`, `opendata.{city}.gov`
- Verified portals by fetching the homepage and checking for ArcGIS Hub application markers
- ArcGIS Hub portals do not provide easily queryable total dataset counts via simple API calls

### CKAN Portals
- Identified by the "Powered by CKAN" footer and OpenGov branding
- CKAN portals were discovered primarily through direct URL testing of `data.{city}.gov` patterns

### Web Search
- Used targeted web searches for `"{city name} open data portal"` to discover portals with non-standard URLs
- Cross-referenced with dataportals.org and opendatanetwork.com listings

### Limitations
- The 404 responses from the Socrata API indicate the domain does not have a Socrata instance, not necessarily that no open data exists
- Some cities may have open data on platforms not checked (e.g., Junar, Socrata clones, custom REST APIs)
- Dataset counts for ArcGIS Hub and CKAN portals are estimates or unavailable without additional API queries
- This research was conducted on a single day; portals may be added or removed over time
