# Data Provenance Constitution

**govdirectory Project -- Authoritative Data Governance Policy**

| Metadata | Value |
|---|---|
| Version | 1.0.0 |
| Effective Date | 2026-02-13 |
| Last Revised | 2026-02-13 |
| Status | ACTIVE |
| Governing Body | govdirectory Maintainers |
| Review Cadence | Quarterly |

---

## Preamble

This Constitution establishes the binding principles, standards, and enforcement mechanisms that govern the provenance, quality, accuracy, and sourcing of all data within the govdirectory project. Every data point presented to citizens must be traceable, verifiable, and sourced from an authoritative entity. This document is a living policy: amendments follow the process defined in Section 12.

The govdirectory project exists to provide citizens with trustworthy, accurate civic data. Trust is our foundational asset. A single inaccurate data point -- a wrong meeting time, a stale phone number, an estimated statistic presented as fact -- erodes that trust irreparably. This Constitution exists to prevent that erosion.

---

## Table of Contents

1. [Foundational Principles](#1-foundational-principles)
2. [Source Authority Classification](#2-source-authority-classification)
3. [Approved Source Registry](#3-approved-source-registry)
4. [Prohibited Sources](#4-prohibited-sources)
5. [Provenance Tracking Requirements](#5-provenance-tracking-requirements)
6. [Accuracy Standards](#6-accuracy-standards)
7. [Data Freshness Tiers and Update Cadence](#7-data-freshness-tiers-and-update-cadence)
8. [Staleness Detection and Enforcement](#8-staleness-detection-and-enforcement)
9. [Cross-Validation Protocol](#9-cross-validation-protocol)
10. [Data Intake Process](#10-data-intake-process)
11. [Incident Response: Data Quality Failures](#11-incident-response-data-quality-failures)
12. [Amendment Process](#12-amendment-process)
13. [Appendices](#13-appendices)

---

## 1. Foundational Principles

### 1.1 Official Sources Only

All data included in govdirectory **must** originate from official government sources, authoritative federal agencies, or verified government platform providers. There are no exceptions.

- **Government sources** include federal agencies (e.g., U.S. Census Bureau, Bureau of Labor Statistics), state agencies (e.g., state departments of health, education, labor), and local government official portals (e.g., city clerk websites, municipal open data portals).
- **Government platform providers** are commercial entities that operate under contract with government bodies to publish official government data (e.g., Legistar for legislative management, PrimeGov for meeting management, CivicPlus for government websites).

### 1.2 No Inference, No Estimation, No Guessing

Data that could be looked up from an authoritative source **must never** be inferred, estimated, interpolated, or extrapolated. If a data point is not available from an official source, it **must** be marked as `UNAVAILABLE` with the reason recorded. Presenting estimated data as factual data is a violation of this Constitution.

Specifically prohibited practices:
- Estimating population figures between Census releases
- Inferring meeting schedules from historical patterns
- Interpolating economic indicators between reporting periods
- Extrapolating crime statistics from partial-year data
- Using machine learning models to predict or fill in missing government data
- Rounding or transforming data in ways that lose precision

### 1.3 Traceability Over Convenience

Every data point must have a complete provenance chain. If provenance cannot be established, the data cannot be included -- regardless of how accurate it appears or how valuable it would be to users.

### 1.4 Freshness Is a Feature

Stale data is misleading data. Data that has exceeded its defined update cadence without refresh must be flagged to users with a staleness warning, not silently presented as current.

### 1.5 Transparency to Citizens

Citizens must be able to inspect the source, vintage, and retrieval date of any data point in the system. Provenance metadata is not internal bookkeeping -- it is a user-facing feature.

---

## 2. Source Authority Classification

All data sources are classified into one of four authority tiers. The tier determines the level of trust, the validation requirements, and the permissible use cases.

### Tier 1 (T1): Federal Agency

**Definition:** A data product published directly by a United States federal agency under statutory authority.

| Attribute | Requirement |
|---|---|
| Publisher | Named federal agency (e.g., U.S. Census Bureau, BLS, FBI, EPA, CDC, HUD, FEMA) |
| Data URL | Must be on a `.gov` domain or an officially documented API endpoint |
| Legal Basis | Data collection authorized by federal statute or executive order |
| Validation | Data accepted at face value; cross-validation encouraged but not required |
| Examples | Census ACS, BLS LAUS, FBI UCR, EPA AQS, NCES CCD, HUD FMR, FEMA disaster declarations, CDC PLACES, IRS SOI |

### Tier 2 (T2): State Agency

**Definition:** A data product published directly by a U.S. state government agency.

| Attribute | Requirement |
|---|---|
| Publisher | Named state agency (e.g., California Department of Education, New York Department of Health) |
| Data URL | Must be on a `.gov` or official state domain |
| Legal Basis | Data collection authorized by state statute or regulation |
| Validation | Cross-validate with federal data where overlap exists |
| Examples | State health departments, state education agencies, state environmental agencies |

### Tier 3 (T3): Local Government Official Portal

**Definition:** A data product published directly by a city, county, or municipal government through an official channel.

| Attribute | Requirement |
|---|---|
| Publisher | Named local government entity (e.g., City of Boston, Cook County) |
| Data URL | Must be on an official government domain or an officially linked open data portal |
| Legal Basis | Data published as part of official government operations |
| Validation | Cross-validate with state or federal data where overlap exists |
| Examples | City open data portals (Socrata-hosted), county GIS portals (ArcGIS Hub), municipal clerk websites |

### Tier 4 (T4): Government-Contracted Platform Provider

**Definition:** A commercial platform that operates under contract with a government entity to publish or manage official government data.

| Attribute | Requirement |
|---|---|
| Publisher | Named platform provider with a documented government contract |
| Data URL | Platform-specific domain (e.g., legistar.com, primegov.com, civicplus.com) |
| Contract Verification | The government entity must be identifiable as a client of the platform |
| Validation | Cross-validate with the government entity's own publications where possible |
| Examples | Legistar (legislation/meetings), PrimeGov (meeting video), CivicPlus (news/agendas), Swagit (video archives), Accela (permits), SeeClickFix (civic issues), GreatSchools (school ratings with NCES data) |

### Untiered / Rejected

Any source that does not fit into Tiers 1-4 is **not permitted** in the govdirectory project. See Section 4 for the explicit prohibited sources list.

---

## 3. Approved Source Registry

The following sources are approved for use in the govdirectory project. New sources must go through the Data Intake Process (Section 10) before being added to this registry.

### 3.1 Currently Integrated Sources

| Source | Authority | Tier | Data Domain | Update Cadence | Geographic Granularity |
|---|---|---|---|---|---|
| Legistar (Granicus) | Government-contracted | T4 | Meetings, legislation, officials | Real-time | City |
| PrimeGov | Government-contracted | T4 | Video meetings | Real-time | City |
| CivicPlus | Government-contracted | T4 | News, agendas | Real-time | City |
| Swagit | Government-contracted | T4 | Video archives | Real-time | City |
| U.S. Census Bureau ACS | Federal agency | T1 | Demographics | Annual | City, county, tract |
| Bureau of Labor Statistics LAUS | Federal agency | T1 | Employment/unemployment | Monthly | City, county, metro |
| FBI UCR/NIBRS | Federal agency | T1 | Crime statistics | Annual | City, county |
| EPA AQS | Federal agency | T1 | Air quality | Daily | County, monitor site |
| NCES CCD | Federal agency | T1 | School data | Annual | School, district, city |
| HUD FMR | Federal agency | T1 | Fair market rents | Annual | County, metro |
| FEMA | Federal agency | T1 | Disaster declarations | Real-time | County, state |
| GreatSchools | Government-contracted | T4 | School ratings | Annual | School |
| SeeClickFix | Government-contracted | T4 | Civic issues | Real-time | City |
| Accela | Government-contracted | T4 | Permits | Varies | City |
| Socrata | Government-contracted | T4 | Open data hosting | Varies | City |

### 3.2 Approved But Not Yet Integrated

Sources that have passed the Data Intake Process but are pending integration are tracked in `docs/new-data-sources-research.md`.

---

## 4. Prohibited Sources

The following source categories are **unconditionally prohibited** from use in the govdirectory project. No exception process exists for these categories.

### 4.1 Absolutely Prohibited

| Source Category | Reason |
|---|---|
| **Social media** (Twitter/X, Facebook, Instagram, Reddit, Nextdoor) | Unverified, user-generated, ephemeral, not authoritative |
| **News articles** (newspapers, TV news, online news) | Secondary source; may contain errors, bias, or outdated information |
| **Wikipedia** | Crowdsourced, editable by anyone, not authoritative |
| **Crowdsourced platforms** (Yelp, Google Reviews, Glassdoor) | User-generated, unverified, subject to manipulation |
| **Unofficial APIs** (reverse-engineered, undocumented, or terms-violating) | Legally risky, unstable, no data quality guarantees |
| **Web scraping of non-government sites** | No provenance guarantee, legally ambiguous, fragile |
| **Personal blogs or opinion sites** | Not authoritative |
| **AI-generated or LLM-generated data** | Not a primary source; may hallucinate |
| **Data brokers or aggregators** without government sourcing | Cannot verify provenance chain |
| **Academic papers** as a primary data source | Secondary analysis; use the underlying government data instead |

### 4.2 Conditionally Prohibited (Requires Explicit Waiver)

| Source Category | Condition for Waiver |
|---|---|
| Non-profit research organizations (e.g., Brookings, Urban Institute) | Only if they publish government-sourced data with full provenance and no transformation |
| International government data | Only for border cities where relevant and no U.S. source exists |
| Historical archives (pre-digital) | Only if digitized by an official government archive |

---

## 5. Provenance Tracking Requirements

### 5.1 Required Metadata for Every Data Point

Every data point in the govdirectory system must carry the following provenance metadata, stored in a structured format (JSON or database columns):

```json
{
  "provenance": {
    "source_authority_name": "U.S. Census Bureau",
    "authority_tier": "T1",
    "data_product_name": "American Community Survey 5-Year Estimates",
    "api_or_data_url": "https://api.census.gov/data/2023/acs/acs5",
    "dataset_identifier": "B01001",
    "retrieval_timestamp": "2026-02-13T08:30:00Z",
    "retrieval_method": "API",
    "geographic_precision": "city",
    "geographic_identifier": {
      "type": "FIPS_place",
      "value": "0644000"
    },
    "data_vintage": {
      "period_start": "2019-01-01",
      "period_end": "2023-12-31",
      "release_date": "2024-12-01"
    },
    "update_cadence": "annual",
    "next_expected_update": "2025-12-01",
    "margin_of_error": {
      "value": 1234,
      "confidence_level": "90%"
    },
    "license": "Public Domain",
    "integrity_hash": "sha256:abcdef1234567890..."
  }
}
```

### 5.2 Mandatory Fields

The following fields are **required** for every data point. A data point missing any of these fields **must not** be served to users.

| Field | Description | Example |
|---|---|---|
| `source_authority_name` | Full legal name of the publishing authority | "U.S. Census Bureau" |
| `authority_tier` | T1, T2, T3, or T4 per Section 2 | "T1" |
| `api_or_data_url` | The exact URL from which the data was retrieved | "https://api.census.gov/data/2023/acs/acs5" |
| `retrieval_timestamp` | ISO 8601 timestamp of when the data was fetched | "2026-02-13T08:30:00Z" |
| `geographic_precision` | The geographic level of the data | "city", "county", "tract", "zip", "state" |
| `data_vintage` | The time period the data represents | `{"period_start": "2023-01-01", "period_end": "2023-12-31"}` |
| `update_cadence` | How often the source publishes updates | "real-time", "daily", "weekly", "monthly", "quarterly", "annual" |

### 5.3 Recommended Fields

| Field | Description |
|---|---|
| `dataset_identifier` | Source-specific dataset or table identifier |
| `data_product_name` | Official name of the data product |
| `next_expected_update` | When the next release is anticipated |
| `margin_of_error` | Statistical margin of error with confidence level |
| `license` | Data license or terms of use |
| `integrity_hash` | SHA-256 hash of the raw retrieved data for tamper detection |
| `retrieval_method` | "API", "bulk_download", "manual_entry" |
| `geographic_identifier` | Structured geographic code (FIPS, CBSA, ZCTA, etc.) |

### 5.4 Provenance Chain for Derived Data

If a data point is computed from multiple sources (e.g., a per-capita calculation using Census population and BLS employment), **all** contributing sources must be listed in the provenance metadata, along with the transformation applied.

```json
{
  "provenance": {
    "derived": true,
    "transformation": "employment_count / population_estimate",
    "contributing_sources": [
      {
        "source_authority_name": "Bureau of Labor Statistics",
        "field": "employment_count",
        "api_or_data_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        "retrieval_timestamp": "2026-02-13T08:30:00Z"
      },
      {
        "source_authority_name": "U.S. Census Bureau",
        "field": "population_estimate",
        "api_or_data_url": "https://api.census.gov/data/2023/acs/acs5",
        "retrieval_timestamp": "2026-02-13T08:32:00Z"
      }
    ]
  }
}
```

---

## 6. Accuracy Standards

### 6.1 Factual Data: Zero-Tolerance Standard

For factual (non-statistical) data -- names, email addresses, phone numbers, physical addresses, URLs, dates, meeting times, legislative bill numbers -- the accuracy requirement is **100%**.

- Factual data must be reproduced exactly as published by the source authority.
- No abbreviation, reformatting, or normalization that could alter meaning.
- Names must match official records exactly (including capitalization, diacritics, suffixes).
- URLs must be tested for validity at retrieval time.
- Email addresses must match the format published by the authority.
- Dates and times must preserve the timezone as published by the source.

### 6.2 Statistical Data: Precision Preservation Standard

For statistical data (population estimates, economic indicators, crime rates, health metrics):

- **No rounding** unless the source itself provides rounded figures, in which case the rounding must be documented.
- **No transformation** that loses precision (e.g., converting a 5-digit population figure to "about 50,000").
- **Margin of error** must be included wherever the source provides it.
- **Confidence level** must accompany any margin of error.
- **Denominators and base populations** must be preserved for rate calculations.
- **Suppressed data** (values withheld by the source for privacy or reliability) must be marked as `SUPPRESSED`, not as zero or null.

### 6.3 Temporal Accuracy

- Meeting dates and times must reflect the latest known schedule, including cancellations and reschedulings.
- Legislation status must reflect the most recent action.
- Economic indicators must display the data vintage, not imply currency (e.g., "2023 ACS 5-Year Estimates" not just "Population: 50,234").

### 6.4 Geographic Accuracy

- Data must not be applied to a geography it does not represent. County-level data must not be presented as city-level data without explicit documentation.
- When city boundaries do not align with Census geographies (places, tracts, ZCTAs), the mismatch must be documented.
- Metropolitan statistical area (MSA) data must not be labeled as city data.

### 6.5 Display Requirements

When presenting data to users, the following must always be visible or accessible within one click:

- The source authority name
- The data vintage (time period)
- The date the data was last retrieved
- Any applicable margin of error
- A link to the original source

---

## 7. Data Freshness Tiers and Update Cadence

### 7.1 Tier Definitions

Data freshness requirements are organized into four tiers based on the nature of the data and user expectations.

#### Real-Time Tier (update within 24 hours of source publication)

| Data Category | Source | Maximum Staleness |
|---|---|---|
| Council/board meetings | Legistar, PrimeGov | 24 hours |
| Meeting agendas | Legistar, CivicPlus | 24 hours |
| Legislation actions | Legistar | 24 hours |
| Disaster declarations | FEMA | 24 hours |
| Civic issue reports | SeeClickFix | 24 hours |
| Meeting videos | PrimeGov, Swagit | 48 hours |

#### Weekly Tier (update within 7 days of source publication)

| Data Category | Source | Maximum Staleness |
|---|---|---|
| Permits issued | Accela, Socrata | 7 days |
| Government news/press releases | CivicPlus | 7 days |
| Civic issue status updates | SeeClickFix | 7 days |
| Air quality index | EPA AQS | 7 days |

#### Monthly Tier (update within 30 days of source publication)

| Data Category | Source | Maximum Staleness |
|---|---|---|
| Employment/unemployment | BLS LAUS | 30 days after release |
| Crime statistics (preliminary) | FBI UCR/NIBRS | 30 days after release |
| Health metrics | CDC PLACES | 30 days after release |
| Housing vacancy data | HUD/USPS | 30 days after quarterly release |

#### Annual Tier (update within 60 days of source publication)

| Data Category | Source | Maximum Staleness |
|---|---|---|
| Demographics (population, income, education) | Census ACS | 60 days after release |
| School enrollment and performance | NCES CCD | 60 days after release |
| School ratings | GreatSchools | 60 days after release |
| Fair market rents | HUD FMR | 60 days after release |
| Tax return statistics | IRS SOI | 60 days after release |
| Food access indicators | USDA ERS | 60 days after release |
| Crime statistics (final) | FBI UCR | 60 days after release |
| Environmental data (annual summaries) | EPA | 60 days after release |

### 7.2 Staleness Thresholds

Each data point has three staleness states:

| State | Definition | User-Facing Treatment |
|---|---|---|
| **CURRENT** | Within the defined maximum staleness window | Displayed normally |
| **STALE** | Exceeds maximum staleness but is less than 2x the window | Displayed with a warning: "This data was last updated on [date]. A newer version may be available." |
| **EXPIRED** | Exceeds 2x the maximum staleness window | Displayed with a prominent warning, or hidden with an explanation |

---

## 8. Staleness Detection and Enforcement

### 8.1 Automated Monitoring

The system must implement automated staleness detection that:

1. Tracks the `retrieval_timestamp` and `update_cadence` for every data source.
2. Computes the expected next update date.
3. Flags data that enters `STALE` status.
4. Escalates data that enters `EXPIRED` status.
5. Runs daily staleness checks as a scheduled job.

### 8.2 Staleness Alerts

| Severity | Trigger | Action |
|---|---|---|
| INFO | Data approaches staleness (within 20% of window) | Log event; attempt refresh |
| WARNING | Data enters STALE status | Add user-facing staleness indicator; notify maintainers |
| CRITICAL | Data enters EXPIRED status | Add prominent warning or suppress data; create incident |

### 8.3 Source Health Dashboard

A source health dashboard must track:

- Last successful retrieval per source
- Number of consecutive failed retrievals
- Average response time per source
- Data staleness state per source
- Historical uptime percentage per source

---

## 9. Cross-Validation Protocol

### 9.1 When Cross-Validation Is Required

Cross-validation is required when:

- Multiple authoritative sources provide overlapping data (e.g., Census population vs. state population estimates).
- A T4 source publishes data that is also available from a T1, T2, or T3 source.
- Data is used in a derived calculation.

### 9.2 Cross-Validation Rules

1. **Higher-tier sources take precedence.** If Census (T1) and a city portal (T3) disagree on population, Census is authoritative.
2. **Discrepancies must be logged.** When two sources disagree, both values and both sources must be recorded, along with the resolution rationale.
3. **Discrepancy thresholds.** For statistical data, a discrepancy greater than 5% between sources of the same tier triggers a manual review.
4. **Temporal alignment.** Cross-validation must compare data from the same vintage. Comparing 2022 ACS data with 2024 city estimates is not valid cross-validation.

### 9.3 Cross-Validation Matrix

| Data Domain | Primary Source | Cross-Validation Source | Discrepancy Threshold |
|---|---|---|---|
| Population | Census ACS (T1) | State population estimates (T2) | 2% |
| Employment | BLS LAUS (T1) | Census ACS (T1) | 5% |
| Crime | FBI UCR (T1) | City police department (T3) | 10% (due to reporting differences) |
| Schools | NCES CCD (T1) | State education agency (T2) | 1% |
| Air quality | EPA AQS (T1) | State environmental agency (T2) | Direct measurement; no threshold |

---

## 10. Data Intake Process

### 10.1 Proposing a New Data Source

Any contributor may propose a new data source by completing the Data Source Proposal Form (Appendix A). The proposal must include:

1. Source authority name and URL
2. Proposed authority tier (T1-T4) with justification
3. Data domain and fields to be ingested
4. Geographic granularity
5. Update cadence and freshness tier
6. API documentation or data access method
7. Data format (JSON, CSV, XML, GeoJSON, etc.)
8. License and terms of use
9. Coverage assessment (how many of the 290 cities are covered)
10. Sample data retrieval demonstrating accessibility

### 10.2 Review Process

1. **Technical Review:** Verify that the API or data source is accessible, stable, and returns data in the documented format.
2. **Authority Review:** Confirm the authority tier classification. For T4 sources, verify the government contract relationship.
3. **Coverage Assessment:** Test data retrieval for a sample of at least 10 cities spanning different regions and population sizes.
4. **Quality Assessment:** Verify data accuracy against known ground truth for at least 5 cities.
5. **Provenance Compliance:** Confirm that all mandatory provenance fields (Section 5.2) can be populated.
6. **Approval or Rejection:** Two maintainers must approve. Rejection must include specific reasons and, where possible, alternative source suggestions.

### 10.3 Ongoing Source Monitoring

Approved sources are subject to ongoing monitoring:

- Quarterly review of API stability and uptime
- Annual review of data quality and accuracy
- Immediate review if a source changes its API, terms of use, or data format
- Removal from the approved registry if a source fails to meet quality standards for two consecutive quarters

---

## 11. Incident Response: Data Quality Failures

### 11.1 Severity Classification

| Severity | Definition | Examples |
|---|---|---|
| **SEV-1** | Factual data is demonstrably wrong and user-facing | Wrong meeting time displayed; incorrect official name |
| **SEV-2** | Statistical data is significantly wrong (>10% error) | Population shown as 10x actual; crime rate inverted |
| **SEV-3** | Data is stale beyond EXPIRED threshold | Census data from 2019 shown without vintage label |
| **SEV-4** | Minor discrepancy or metadata issue | Missing margin of error; slightly stale data |

### 11.2 Response Requirements

| Severity | Response Time | Resolution Time | Post-Incident Review |
|---|---|---|---|
| SEV-1 | 1 hour | 4 hours | Required within 48 hours |
| SEV-2 | 4 hours | 24 hours | Required within 1 week |
| SEV-3 | 24 hours | 1 week | Optional |
| SEV-4 | 1 week | 1 month | Not required |

### 11.3 Incident Response Steps

1. **Identify:** Detect or receive report of data quality issue.
2. **Contain:** If user-facing, immediately add a data quality warning or remove the affected data.
3. **Diagnose:** Determine root cause (source error, ingestion bug, transformation bug, staleness).
4. **Remediate:** Fix the data, fix the pipeline, or update the source.
5. **Verify:** Confirm the fix through cross-validation or manual inspection.
6. **Document:** Record the incident, root cause, resolution, and prevention measures.

---

## 12. Amendment Process

### 12.1 Proposing Amendments

Any contributor may propose an amendment to this Constitution by:

1. Opening a pull request with the proposed change.
2. Including a rationale section explaining why the amendment is needed.
3. Identifying which sections are affected.

### 12.2 Approval Requirements

| Amendment Type | Approval Requirement |
|---|---|
| Adding a new approved source | Two maintainer approvals |
| Changing accuracy standards | Three maintainer approvals + 7-day comment period |
| Changing prohibited sources | Three maintainer approvals + 14-day comment period |
| Modifying foundational principles | Unanimous maintainer approval + 30-day comment period |
| Editorial/typo fixes | One maintainer approval |

### 12.3 Version History

All amendments must be recorded in the version history table in Appendix B.

---

## 13. Appendices

### Appendix A: Data Source Proposal Form Template

```markdown
## Data Source Proposal

**Proposed by:** [Name]
**Date:** [YYYY-MM-DD]

### Source Information
- **Source Authority Name:**
- **Authority URL:**
- **Proposed Tier:** T1 / T2 / T3 / T4
- **Tier Justification:**

### Data Description
- **Data Domain:**
- **Key Fields/Measures:**
- **Geographic Granularity:** city / county / tract / zip / state
- **Temporal Granularity:** real-time / daily / weekly / monthly / quarterly / annual
- **Data Vintage (current release):**

### Technical Access
- **Access Method:** API / Bulk Download / Manual
- **API Endpoint (if applicable):**
- **Data Format:** JSON / CSV / XML / GeoJSON / Other
- **Authentication Required:** Yes / No
- **Rate Limits:**
- **API Documentation URL:**

### Coverage and Quality
- **Estimated City Coverage (out of 290):**
- **Sample Cities Tested:**
- **Accuracy Verification Method:**
- **License / Terms of Use:**

### Integration Estimate
- **Estimated Development Effort:** Low / Medium / High
- **Dependencies on Other Sources:**
- **Citizen Value:** High / Medium / Low
- **Value Justification:**
```

### Appendix B: Version History

| Version | Date | Author | Change Description |
|---|---|---|---|
| 1.0.0 | 2026-02-13 | govdirectory Maintainers | Initial ratification of the Data Provenance Constitution |

### Appendix C: Authority Tier Decision Tree

```
Is the publisher a U.S. federal agency?
  YES -> T1 (Federal Agency)
  NO  -> Is the publisher a U.S. state government agency?
           YES -> T2 (State Agency)
           NO  -> Is the publisher a city, county, or municipal government?
                    YES -> Is the data on an official .gov domain or officially linked portal?
                             YES -> T3 (Local Government Official Portal)
                             NO  -> INVESTIGATE FURTHER
                    NO  -> Does the publisher operate under contract with a government entity?
                             YES -> Can the government contract be verified?
                                      YES -> T4 (Government-Contracted Platform Provider)
                                      NO  -> REJECTED
                             NO  -> REJECTED
```

### Appendix D: Geographic Identifier Standards

All geographic identifiers must use one of the following standard coding systems:

| Identifier Type | Standard | Example | Use Case |
|---|---|---|---|
| FIPS State Code | ANSI FIPS 5-2 | "06" (California) | State-level data |
| FIPS County Code | ANSI FIPS 6-4 | "06037" (Los Angeles County) | County-level data |
| FIPS Place Code | Census Place FIPS | "0644000" (Los Angeles city) | City-level data |
| Census Tract | Census GEOID | "06037201000" | Tract-level data |
| ZCTA | Census ZCTA | "90210" | ZIP-code-level data |
| CBSA Code | OMB CBSA | "31080" (Los Angeles MSA) | Metro-level data |

### Appendix E: Data Format Standards

- **Dates:** ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`)
- **Currency:** Integer cents (avoid floating-point for currency)
- **Percentages:** Decimal (0.0 to 100.0), not fractional (0.0 to 1.0)
- **Geographic coordinates:** WGS 84 (EPSG:4326), decimal degrees
- **Character encoding:** UTF-8
- **Null values:** Explicit `null` in JSON; empty string in CSV with a separate flag column indicating reason (`UNAVAILABLE`, `SUPPRESSED`, `NOT_APPLICABLE`)

---

*This Constitution is effective as of the date listed above and applies to all data within the govdirectory project. Compliance is not optional.*
