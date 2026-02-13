import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { CityProfile } from "@/components/city/types";
import { MiniSparkline } from "@/components/city/MiniSparkline";
import { MiniBarChart } from "@/components/city/MiniBarChart";
import { DataSourceGrid } from "@/components/city/DataSourceGrid";
import { ScrollAnimator } from "@/components/city/ScrollAnimator";
import { SubscribeForm } from "@/components/city/SubscribeForm";

/* ── Helpers ── */

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h) + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 12;
}

function fmt(
  n: number | null | undefined,
  opts?: { prefix?: string; suffix?: string; decimals?: number },
): string {
  if (n == null) return "\u2014";
  const { prefix = "", suffix = "", decimals } = opts || {};
  const d = decimals ?? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 1 ? 1 : 2);
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `${n.toFixed(1)}%`;
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtPop(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function countDimensions(p: CityProfile) {
  const dims = [
    p.economy?.median_household_income != null,
    p.safety?.violent_crime_rate != null,
    p.education?.total_schools != null || p.education?.avg_school_rating != null,
    p.housing?.median_rent != null,
    p.environment?.pm25_mean != null,
    p.governance?.legislative_volume != null,
    (p.civic_issues?.total_issues || 0) > 0,
    p.development?.permits_12mo != null,
    (p.meetings?.meetings_indexed || 0) > 0,
  ];
  return { available: dims.filter(Boolean).length, total: dims.length };
}

function countSources(ds: Record<string, string>): number {
  return Object.values(ds).filter((s) => s === "available").length;
}

function pickGlanceStats(p: CityProfile) {
  type GS = { value: string; label: string; priority: number };
  const stats: GS[] = [];
  if (p.economy?.median_household_income)
    stats.push({ value: fmtDollar(p.economy.median_household_income), label: "Median Income", priority: 1 });
  if (p.safety?.violent_crime_rate != null)
    stats.push({ value: fmt(p.safety.violent_crime_rate, { decimals: 1 }), label: "Violent Crime / 100K", priority: 2 });
  if (p.education?.avg_school_rating)
    stats.push({ value: `${fmt(p.education.avg_school_rating, { decimals: 1 })}/10`, label: "School Rating", priority: 3 });
  if (p.housing?.median_rent)
    stats.push({ value: fmtDollar(p.housing.median_rent), label: "Median Rent", priority: 4 });
  if (p.economy?.unemployment_rate != null)
    stats.push({ value: fmtPct(p.economy.unemployment_rate), label: "Unemployment", priority: 5 });
  if (p.environment?.pm25_mean)
    stats.push({ value: fmt(p.environment.pm25_mean, { decimals: 1 }), label: "PM2.5 (\u03bcg/m\u00b3)", priority: 6 });
  if (p.governance?.committee_count)
    stats.push({ value: String(p.governance.committee_count), label: "Committees", priority: 7 });
  if (p.governance?.legislative_volume)
    stats.push({ value: p.governance.legislative_volume.toLocaleString(), label: "Legislative Matters", priority: 8 });
  return stats.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function generateFinding(p: CityProfile): string {
  const name = p.identity.name;
  const parts: string[] = [];
  if (p.economy?.median_household_income)
    parts.push(`a median household income of ${fmtDollar(p.economy.median_household_income)}`);
  if (p.safety?.violent_crime_rate != null) {
    const r = p.safety.violent_crime_rate;
    const level = r < 200 ? "low" : r < 400 ? "moderate" : r < 700 ? "elevated" : "high";
    parts.push(`${level} violent crime`);
  }
  if (p.education?.school_quality_tier)
    parts.push(`${p.education.school_quality_tier}-rated schools`);
  if (p.housing?.median_rent)
    parts.push(`a median rent of ${fmtDollar(p.housing.median_rent)}/mo`);
  if (parts.length >= 2) return `${name} has ${parts.slice(0, 3).join(", ")}.`;
  if (p.governance?.legislative_volume)
    return `${name} has ${p.governance.legislative_volume.toLocaleString()} legislative matters tracked across ${p.governance.committee_count || "multiple"} committees.`;
  return `${name} is one of 290 local governments profiled with open data.`;
}

/* ── Data Loading ── */

function loadProfile(slug: string): CityProfile | null {
  const fp = path.join(process.cwd(), "public", "data", "cities", `${slug}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), "public", "data", "cities");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_index.json")
    .map((f) => ({ slug: f.replace(".json", "") }));
}

/* ── Page ── */

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = loadProfile(slug);
  if (!p) notFound();

  const accentClass = `accent-${hashSlug(slug)}`;
  const glanceStats = pickGlanceStats(p);
  const finding = generateFinding(p);
  const dims = countDimensions(p);
  const srcCount = countSources(p.data_sources || {});

  const hasEconomy = p.economy?.median_household_income != null;
  const hasSafety = p.safety?.violent_crime_rate != null;
  const hasEducation = p.education?.total_schools != null || p.education?.avg_school_rating != null;
  const hasHousing = p.housing?.median_rent != null;
  const hasEnvironment = p.environment?.pm25_mean != null;
  const hasCivicIssues = (p.civic_issues?.total_issues || 0) > 0;
  const hasDevelopment = p.development?.permits_12mo != null;
  const hasMeetings = (p.meetings?.meetings_indexed || 0) > 0;

  const econHistory = p.time_series?.economy_history || [];
  const safetyHistory = p.time_series?.safety_history || [];
  const envHistory = p.time_series?.environment_history || [];

  return (
    <div className={accentClass}>
      <ScrollAnimator />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="hero-glow" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            {srcCount} Data Sources
          </div>
          <h1 className="hero-name">{p.identity.name}</h1>
          <p className="hero-state">{p.identity.state}</p>
          {p.identity.population != null && (
            <>
              <div className="hero-population">{fmtPop(p.identity.population)}</div>
              <div className="hero-pop-label">Population</div>
            </>
          )}
        </div>
        <div className="hero-scroll">
          <span>Scroll</span>
          <div className="hero-scroll-line" />
        </div>
      </section>

      {/* ── AT A GLANCE ── */}
      {glanceStats.length > 0 && (
        <div className="glance">
          {glanceStats.map((s) => (
            <div key={s.label} className="glance-stat">
              <div className="glance-stat-value">{s.value}</div>
              <div className="glance-stat-label">{s.label}</div>
            </div>
          ))}
          <div className="glance-finding">
            <div className="glance-finding-label">Key Finding</div>
            <div className="glance-finding-text">{finding}</div>
          </div>
        </div>
      )}

      {/* ── COMPLETENESS ── */}
      <div className="completeness">
        <div className="completeness-track">
          <div
            className="completeness-fill"
            style={{ width: `${(dims.available / dims.total) * 100}%` }}
          />
        </div>
        <span className="completeness-text">
          {dims.available} of {dims.total} data dimensions available
        </span>
      </div>

      {/* ── SECTIONS ── */}
      <div className="sections">

        {/* ─── Economy ─── */}
        {hasEconomy && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h2 className="section-title">Economy</h2>
            </div>
            <div className="stat-grid">
              {p.economy.median_household_income != null && (
                <div className="stat">
                  <div className="stat-value">{fmtDollar(p.economy.median_household_income)}</div>
                  <div className="stat-label">Median Household Income</div>
                </div>
              )}
              {p.economy.median_home_value != null && (
                <div className="stat">
                  <div className="stat-value">{fmtDollar(p.economy.median_home_value)}</div>
                  <div className="stat-label">Median Home Value</div>
                </div>
              )}
              {p.economy.unemployment_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.economy.unemployment_rate)}</div>
                  <div className="stat-label">Unemployment Rate</div>
                  {p.economy.unemployment_data_level && p.economy.unemployment_data_level !== "city" && (
                    <div className="stat-context">{p.economy.unemployment_data_level}-level data</div>
                  )}
                </div>
              )}
              {p.economy.poverty_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.economy.poverty_rate)}</div>
                  <div className="stat-label">Poverty Rate</div>
                </div>
              )}
              {p.economy.rent_to_income_ratio != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.economy.rent_to_income_ratio)}</div>
                  <div className="stat-label">Rent-to-Income</div>
                </div>
              )}
              {p.economy.home_value_to_income_ratio != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.economy.home_value_to_income_ratio, { decimals: 1 })}x</div>
                  <div className="stat-label">Home Value / Income</div>
                </div>
              )}
              {p.economy.homeownership_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.economy.homeownership_rate)}</div>
                  <div className="stat-label">Homeownership</div>
                </div>
              )}
              {p.economy.gini_index != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.economy.gini_index, { decimals: 3 })}</div>
                  <div className="stat-label">Gini Index</div>
                  <div className="stat-context">0 = perfect equality</div>
                </div>
              )}
            </div>
            {econHistory.length > 1 && (
              <>
                <h3 className="section-subtitle">Unemployment Trend</h3>
                <MiniSparkline
                  data={econHistory
                    .map((e) => (e as Record<string, number>).unemployment_rate)
                    .filter((v): v is number => v != null)}
                  labels={
                    econHistory.length >= 2
                      ? { first: String(econHistory[0].year), last: String(econHistory[econHistory.length - 1].year) }
                      : undefined
                  }
                />
              </>
            )}
          </div>
        )}

        {/* ─── Safety ─── */}
        {hasSafety && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h2 className="section-title">Public Safety</h2>
            </div>
            <div className="stat-grid">
              {p.safety.violent_crime_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.safety.violent_crime_rate, { decimals: 1 })}</div>
                  <div className="stat-label">Violent Crime / 100K</div>
                  {p.safety.crime_data_level && p.safety.crime_data_level !== "city" && (
                    <div className="stat-context">{p.safety.crime_data_level}-level data</div>
                  )}
                </div>
              )}
              {p.safety.property_crime_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.safety.property_crime_rate, { decimals: 1 })}</div>
                  <div className="stat-label">Property Crime / 100K</div>
                </div>
              )}
              {p.safety.murder_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.safety.murder_rate, { decimals: 2 })}</div>
                  <div className="stat-label">Murder Rate / 100K</div>
                </div>
              )}
              {p.safety.crime_trend != null && (
                <div className="stat">
                  <div className="stat-value">
                    <span className={`trend ${p.safety.crime_trend < 0 ? "down" : p.safety.crime_trend > 0 ? "up" : "flat"}`}>
                      {p.safety.crime_trend > 0 ? "\u2191" : p.safety.crime_trend < 0 ? "\u2193" : "\u2192"}{" "}
                      {fmt(Math.abs(p.safety.crime_trend), { suffix: "%", decimals: 1 })}
                    </span>
                  </div>
                  <div className="stat-label">Crime Trend</div>
                </div>
              )}
            </div>
            {safetyHistory.length > 1 && (
              <>
                <h3 className="section-subtitle">Crime Rate Trend</h3>
                <MiniSparkline
                  data={safetyHistory
                    .map((e) => e.violent_crime_rate)
                    .filter((v): v is number => v != null)}
                  labels={{
                    first: String(safetyHistory[0].year),
                    last: String(safetyHistory[safetyHistory.length - 1].year),
                  }}
                  color="#ef4444"
                />
              </>
            )}
          </div>
        )}

        {/* ─── Education ─── */}
        {hasEducation && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 10 3 12 0v-5" />
                </svg>
              </div>
              <h2 className="section-title">Education</h2>
            </div>
            {p.education.school_quality_tier && (
              <div style={{ marginBottom: "1.25rem" }}>
                <span className={`tier-badge ${p.education.school_quality_tier}`}>
                  {p.education.school_quality_tier}
                </span>
              </div>
            )}
            <div className="stat-grid">
              {p.education.avg_school_rating != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.education.avg_school_rating, { decimals: 1 })}/10</div>
                  <div className="stat-label">Avg School Rating</div>
                  {p.education.rated_schools != null && (
                    <div className="stat-context">from {p.education.rated_schools} rated schools</div>
                  )}
                </div>
              )}
              {p.education.total_schools != null && (
                <div className="stat">
                  <div className="stat-value">{p.education.total_schools}</div>
                  <div className="stat-label">Total Schools</div>
                </div>
              )}
              {p.education.total_enrollment != null && (
                <div className="stat">
                  <div className="stat-value">{p.education.total_enrollment.toLocaleString()}</div>
                  <div className="stat-label">Enrollment</div>
                </div>
              )}
              {p.education.pupil_teacher_ratio != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.education.pupil_teacher_ratio, { decimals: 1 })}:1</div>
                  <div className="stat-label">Pupil-Teacher Ratio</div>
                </div>
              )}
              {p.education.charter_pct != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.education.charter_pct)}</div>
                  <div className="stat-label">Charter Schools</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Housing ─── */}
        {hasHousing && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="section-title">Housing</h2>
            </div>
            <div className="stat-grid">
              {p.housing.median_rent != null && (
                <div className="stat">
                  <div className="stat-value">{fmtDollar(p.housing.median_rent)}</div>
                  <div className="stat-label">Median Rent / mo</div>
                </div>
              )}
              {p.housing.housing_units != null && (
                <div className="stat">
                  <div className="stat-value">{p.housing.housing_units.toLocaleString()}</div>
                  <div className="stat-label">Housing Units</div>
                </div>
              )}
              {p.housing.rent_burden_ratio != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.housing.rent_burden_ratio)}</div>
                  <div className="stat-label">Rent Burden</div>
                  <div className="stat-context">% of income spent on rent</div>
                </div>
              )}
              {p.housing.cost_burdened_pct != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.housing.cost_burdened_pct)}</div>
                  <div className="stat-label">Cost-Burdened</div>
                  <div className="stat-context">Spending 30%+ on housing</div>
                </div>
              )}
            </div>
            {(p.housing.fmr_0br != null || p.housing.fmr_1br != null) && (
              <>
                <h3 className="section-subtitle">Fair Market Rents (HUD)</h3>
                <div className="fmr-table">
                  {[
                    { label: "Studio", val: p.housing.fmr_0br },
                    { label: "1 BR", val: p.housing.fmr_1br },
                    { label: "2 BR", val: p.housing.fmr_2br },
                    { label: "3 BR", val: p.housing.fmr_3br },
                    { label: "4 BR", val: p.housing.fmr_4br },
                  ]
                    .filter((r) => r.val != null)
                    .map((r) => (
                      <div key={r.label} className="fmr-cell">
                        <div className="fmr-cell-label">{r.label}</div>
                        <div className="fmr-cell-value">{fmtDollar(r.val)}</div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Environment ─── */}
        {hasEnvironment && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 8c.7-1 1-2.2 1-3.5 0-2-1.5-3.5-3.5-3.5-1 0-2 .5-2.5 1.3C11.5 1.5 10.5 1 9.5 1 7.5 1 6 2.5 6 4.5c0 1.3.4 2.5 1 3.5" />
                  <path d="M12 22V8" />
                  <path d="M8 22h8" />
                </svg>
              </div>
              <h2 className="section-title">Environment</h2>
            </div>
            <div className="stat-grid">
              {p.environment.pm25_mean != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.environment.pm25_mean, { decimals: 1 })}</div>
                  <div className="stat-label">PM2.5 (\u03bcg/m\u00b3)</div>
                  <div className="stat-context">WHO guideline: 5.0</div>
                </div>
              )}
              {p.environment.ozone_mean != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.environment.ozone_mean, { decimals: 4 })}</div>
                  <div className="stat-label">Ozone (ppm)</div>
                </div>
              )}
              {p.environment.total_disasters != null && (
                <div className="stat">
                  <div className="stat-value">{p.environment.total_disasters}</div>
                  <div className="stat-label">Total Disasters</div>
                </div>
              )}
              {p.environment.most_recent_disaster && (
                <div className="stat">
                  <div className="stat-value" style={{ fontSize: "var(--text-small)" }}>
                    {p.environment.most_recent_disaster_type || "\u2014"}
                  </div>
                  <div className="stat-label">Most Recent</div>
                  <div className="stat-context">{p.environment.most_recent_disaster}</div>
                </div>
              )}
            </div>
            {p.environment.disasters_by_type && Object.keys(p.environment.disasters_by_type).length > 0 && (
              <>
                <h3 className="section-subtitle">Disaster Types</h3>
                <MiniBarChart
                  items={Object.entries(p.environment.disasters_by_type).map(([k, v]) => ({
                    label: k,
                    value: v,
                  }))}
                />
              </>
            )}
            {envHistory.length > 1 && (
              <>
                <h3 className="section-subtitle">PM2.5 Trend</h3>
                <MiniSparkline
                  data={envHistory
                    .map((e) => (e as Record<string, number>).pm25_mean)
                    .filter((v): v is number => v != null)}
                  labels={{
                    first: String(envHistory[0].year),
                    last: String(envHistory[envHistory.length - 1].year),
                  }}
                  color="#f59e0b"
                />
              </>
            )}
          </div>
        )}

        {/* ─── Governance (always shown) ─── */}
        {p.governance && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="22" x2="21" y2="22" />
                  <line x1="6" y1="18" x2="6" y2="11" />
                  <line x1="10" y1="18" x2="10" y2="11" />
                  <line x1="14" y1="18" x2="14" y2="11" />
                  <line x1="18" y1="18" x2="18" y2="11" />
                  <polygon points="12 2 20 7 4 7" />
                </svg>
              </div>
              <h2 className="section-title">Governance</h2>
            </div>
            <div className="stat-grid">
              {p.governance.legislative_volume != null && (
                <div className="stat">
                  <div className="stat-value">{p.governance.legislative_volume.toLocaleString()}</div>
                  <div className="stat-label">Legislative Matters</div>
                </div>
              )}
              {p.governance.committee_count != null && (
                <div className="stat">
                  <div className="stat-value">{p.governance.committee_count}</div>
                  <div className="stat-label">Committees</div>
                </div>
              )}
              {p.governance.pass_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.governance.pass_rate)}</div>
                  <div className="stat-label">Pass Rate</div>
                </div>
              )}
              {p.governance.active_council_members != null && (
                <div className="stat">
                  <div className="stat-value">{p.governance.active_council_members}</div>
                  <div className="stat-label">Council Members</div>
                </div>
              )}
              {p.governance.avg_meetings_per_month != null && (
                <div className="stat">
                  <div className="stat-value">{fmt(p.governance.avg_meetings_per_month, { decimals: 1 })}</div>
                  <div className="stat-label">Meetings / Month</div>
                </div>
              )}
              {p.governance.years_of_legislative_data != null && (
                <div className="stat">
                  <div className="stat-value">{p.governance.years_of_legislative_data}</div>
                  <div className="stat-label">Years of Data</div>
                </div>
              )}
            </div>

            {(p.governance.agenda_availability_pct != null ||
              p.governance.minutes_availability_pct != null ||
              p.governance.video_availability_pct != null) && (
              <>
                <h3 className="section-subtitle">Transparency</h3>
                <div className="stat-grid">
                  {p.governance.agenda_availability_pct != null && (
                    <div className="stat">
                      <div className="stat-value">{fmtPct(p.governance.agenda_availability_pct)}</div>
                      <div className="stat-label">Agendas Available</div>
                    </div>
                  )}
                  {p.governance.minutes_availability_pct != null && (
                    <div className="stat">
                      <div className="stat-value">{fmtPct(p.governance.minutes_availability_pct)}</div>
                      <div className="stat-label">Minutes Available</div>
                    </div>
                  )}
                  {p.governance.video_availability_pct != null && (
                    <div className="stat">
                      <div className="stat-value">{fmtPct(p.governance.video_availability_pct)}</div>
                      <div className="stat-label">Video Available</div>
                    </div>
                  )}
                </div>
              </>
            )}

            {p.governance.matter_types && Object.keys(p.governance.matter_types).length > 0 && (
              <>
                <h3 className="section-subtitle">Matter Types</h3>
                <MiniBarChart
                  items={Object.entries(p.governance.matter_types).map(([k, v]) => ({
                    label: k,
                    value: v,
                  }))}
                />
              </>
            )}
          </div>
        )}

        {/* ─── Civic Issues ─── */}
        {hasCivicIssues && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2 className="section-title">Civic Issues (311)</h2>
            </div>
            <div className="stat-grid">
              {p.civic_issues.total_issues != null && (
                <div className="stat">
                  <div className="stat-value">{p.civic_issues.total_issues.toLocaleString()}</div>
                  <div className="stat-label">Total Issues</div>
                </div>
              )}
              {p.civic_issues.resolution_rate != null && (
                <div className="stat">
                  <div className="stat-value">{fmtPct(p.civic_issues.resolution_rate)}</div>
                  <div className="stat-label">Resolution Rate</div>
                </div>
              )}
              {p.civic_issues.issues_last_30d != null && (
                <div className="stat">
                  <div className="stat-value">{p.civic_issues.issues_last_30d.toLocaleString()}</div>
                  <div className="stat-label">Last 30 Days</div>
                </div>
              )}
              {p.civic_issues.issues_last_365d != null && (
                <div className="stat">
                  <div className="stat-value">{p.civic_issues.issues_last_365d.toLocaleString()}</div>
                  <div className="stat-label">Last 12 Months</div>
                </div>
              )}
            </div>
            {p.civic_issues.type_distribution && Object.keys(p.civic_issues.type_distribution).length > 0 && (
              <>
                <h3 className="section-subtitle">Issue Types</h3>
                <MiniBarChart
                  items={Object.entries(p.civic_issues.type_distribution).map(([k, v]) => ({
                    label: k,
                    value: v,
                  }))}
                />
              </>
            )}
          </div>
        )}

        {/* ─── Development ─── */}
        {hasDevelopment && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h2 className="section-title">Development</h2>
            </div>
            <div className="stat-grid">
              {p.development.permits_12mo != null && (
                <div className="stat">
                  <div className="stat-value">{p.development.permits_12mo.toLocaleString()}</div>
                  <div className="stat-label">Permits (12 mo)</div>
                </div>
              )}
              {p.development.yoy_trend_pct != null && (
                <div className="stat">
                  <div className="stat-value">
                    <span
                      className={`trend ${p.development.yoy_trend_pct > 0 ? "up" : p.development.yoy_trend_pct < 0 ? "down" : "flat"}`}
                    >
                      {p.development.yoy_trend_pct > 0 ? "\u2191" : p.development.yoy_trend_pct < 0 ? "\u2193" : "\u2192"}{" "}
                      {fmt(Math.abs(p.development.yoy_trend_pct), { suffix: "%", decimals: 1 })}
                    </span>
                  </div>
                  <div className="stat-label">Year over Year</div>
                </div>
              )}
              {p.development.avg_permit_value != null && (
                <div className="stat">
                  <div className="stat-value">{fmtDollar(p.development.avg_permit_value)}</div>
                  <div className="stat-label">Avg Permit Value</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Public Meetings ─── */}
        {hasMeetings && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h2 className="section-title">Public Meetings</h2>
            </div>
            <div className="stat-grid">
              {p.meetings.meetings_indexed != null && (
                <div className="stat">
                  <div className="stat-value">{p.meetings.meetings_indexed.toLocaleString()}</div>
                  <div className="stat-label">Meetings Indexed</div>
                </div>
              )}
              {p.meetings.official_channels != null && (
                <div className="stat">
                  <div className="stat-value">{p.meetings.official_channels}</div>
                  <div className="stat-label">YouTube Channels</div>
                </div>
              )}
              {p.meetings.transcripts_available != null && (
                <div className="stat">
                  <div className="stat-value">{p.meetings.transcripts_available.toLocaleString()}</div>
                  <div className="stat-label">Transcripts</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Data Sources (always shown) ─── */}
        <div className="section">
          <div className="section-header">
            <div className="section-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <h2 className="section-title">Data Sources</h2>
          </div>
          <DataSourceGrid dataSources={p.data_sources || {}} provenance={p.provenance} />
        </div>
      </div>

      {/* ── SUBSCRIBE CTA ── */}
      <div className="subscribe-cta">
        <div className="subscribe-cta-inner">
          <h3>Stay Updated on {p.identity.name}</h3>
          <p>Get notified when new data is available for this city.</p>
          <SubscribeForm cityName={p.identity.name} />
        </div>
      </div>
    </div>
  );
}
