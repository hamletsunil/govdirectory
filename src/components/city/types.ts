/** Universal city profile schema — matches SimCity Inventory output */

export interface CityProfile {
  schema_version: string;
  normalized_at: string;
  identity: {
    name: string;
    state: string;
    fips_state: string | null;
    fips_place: string | null;
    population: number | null;
  };
  economy: {
    median_household_income: number | null;
    median_home_value: number | null;
    unemployment_rate: number | null;
    unemployment_data_level: string | null;
    labor_force: number | null;
    employed: number | null;
    unemployed: number | null;
    gini_index: number | null;
    poverty_rate: number | null;
    homeownership_rate: number | null;
    rent_to_income_ratio: number | null;
    home_value_to_income_ratio: number | null;
    price_to_rent_ratio: number | null;
    effective_tax_rate: number | null;
    population_growth_cagr: number | null;
    median_real_estate_taxes: number | null;
  };
  safety: {
    violent_crime_rate: number | null;
    property_crime_rate: number | null;
    murder_rate: number | null;
    robbery_rate: number | null;
    burglary_rate: number | null;
    vehicle_theft_rate: number | null;
    total_crime_rate: number | null;
    crime_trend: number | null;
    crime_data_level: string | null;
  };
  education: {
    total_schools: number | null;
    total_enrollment: number | null;
    pupil_teacher_ratio: number | null;
    title1_pct: number | null;
    charter_pct: number | null;
    regular_schools: number | null;
    avg_school_rating: number | null;
    rated_schools: number | null;
    school_quality_tier: string | null;
  };
  environment: {
    pm25_mean: number | null;
    ozone_mean: number | null;
    total_disasters: number | null;
    avg_disasters_per_decade: number | null;
    most_recent_disaster: string | null;
    most_recent_disaster_type: string | null;
    disasters_by_type: Record<string, number>;
  };
  housing: {
    median_rent: number | null;
    housing_units: number | null;
    fmr_0br: number | null;
    fmr_1br: number | null;
    fmr_2br: number | null;
    fmr_3br: number | null;
    fmr_4br: number | null;
    rent_burden_ratio: number | null;
    cost_burdened_pct: number | null;
    severely_burdened_pct: number | null;
  };
  governance: {
    legislative_volume: number | null;
    legislative_velocity: number | null;
    committee_count: number | null;
    years_of_legislative_data: number | null;
    has_public_meetings: boolean;
    api_accessible: boolean;
    matter_types: Record<string, number>;
    top_matter_type: string | null;
    matter_statuses: Record<string, number>;
    pass_rate: number | null;
    passed_count: number | null;
    active_council_members: number | null;
    avg_tenure_years: number | null;
    vote_coverage_pct: number | null;
    video_availability_pct: number | null;
    agenda_availability_pct: number | null;
    minutes_availability_pct: number | null;
    avg_meetings_per_month: number | null;
    meetings_by_year: Record<string, number>;
    avg_sponsors_per_matter: number | null;
    avg_attachments_per_matter: number | null;
    pct_with_text_versions: number | null;
    index_categories: string[];
    has_accela: boolean;
    accela_agency_id: string | null;
  };
  development: {
    permits_12mo: number | null;
    yoy_trend_pct: number | null;
    avg_permit_value: number | null;
    permit_types: Record<string, number>;
    datasets_count: number;
  };
  meetings: {
    official_channels: number | null;
    meetings_indexed: number | null;
    avg_meetings_per_month: number | null;
    has_video_archive: boolean;
    meeting_types: Record<string, number>;
    transcripts_available: number | null;
  };
  civic_issues: {
    total_issues: number | null;
    issues_last_30d: number | null;
    issues_last_365d: number | null;
    resolution_rate: number | null;
    top_issue_type: string | null;
    type_distribution: Record<string, number>;
    has_civic_issue_tracking: boolean;
  };
  demographics: {
    population: number | null;
    poverty_universe: number | null;
    employment_universe: number | null;
  };
  time_series: {
    economy_history: TimeSeriesEntry[];
    safety_history: SafetyTimeSeriesEntry[];
    environment_history: TimeSeriesEntry[];
  };
  data_sources: Record<string, string>;
  provenance: {
    last_full_probe: string;
    sources: Record<string, ProvenanceSource>;
  };
}

export interface TimeSeriesEntry {
  year: number;
  [key: string]: number | string | boolean | null;
}

export interface SafetyTimeSeriesEntry extends TimeSeriesEntry {
  violent_crime_rate: number | null;
  property_crime_rate: number | null;
  murder_rate: number | null;
}

export interface ProvenanceSource {
  authority: string;
  authority_tier: number;
  api_url: string | null;
  probed_at: string;
  data_vintage: string | null;
  geographic_level: string;
  status: string;
}
