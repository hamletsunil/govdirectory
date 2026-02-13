import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { CityProfile } from "@/components/city/types";
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

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
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

/* ── Benchmarks ── */

type BenchmarkEntry = { median: number; p25: number; p75: number; min: number; max: number; count: number };
type Benchmarks = Record<string, BenchmarkEntry>;

function loadBenchmarks(): Benchmarks {
  const fp = path.join(process.cwd(), "public", "data", "cities", "_benchmarks.json");
  if (!fs.existsSync(fp)) return {};
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

/** Position of a value on min-max scale (0-100%) for the comparison bar */
function barPosition(val: number, b: BenchmarkEntry): number {
  if (b.max === b.min) return 50;
  return Math.max(0, Math.min(100, ((val - b.min) / (b.max - b.min)) * 100));
}

/** Position of the median reference mark */
function medianPosition(b: BenchmarkEntry): number {
  if (b.max === b.min) return 50;
  return ((b.median - b.min) / (b.max - b.min)) * 100;
}

/** Whether value is above/below median, with "higher is better" flag */
function vsMedian(val: number, median: number, higherIsBetter: boolean): "good" | "bad" | "" {
  const diff = val - median;
  const pctDiff = Math.abs(diff / median) * 100;
  if (pctDiff < 5) return ""; // within 5% of median = neutral
  if (higherIsBetter) return diff > 0 ? "good" : "bad";
  return diff < 0 ? "good" : "bad";
}

/** Comparison bar component rendered inline */
function ComparisonBar({ value, benchmark, label }: { value: number; benchmark: BenchmarkEntry; label: string }) {
  const pos = barPosition(value, benchmark);
  const medPos = medianPosition(benchmark);
  return (
    <div className="comparison-bar">
      <div className="comparison-bar-track">
        <div className="comparison-bar-fill" style={{ width: `${pos}%` }} />
        <div className="comparison-bar-marker" style={{ left: `${pos}%` }} />
        <div className="comparison-bar-ref" style={{ left: `${medPos}%` }}>
          <span className="comparison-bar-ref-label">{label}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sparkline sorting helper ── */

function sortedTimeSeries<T extends { year: number }>(data: T[]): T[] {
  return [...data].sort((a, b) => a.year - b.year);
}

/* ── Letter Grades ── */

type GradeInfo = { letter: string; cssClass: string };

/** Compute percentile of a value within its benchmark distribution.
 *  Returns 0-100 where 50 = median. */
function percentileRank(val: number, b: BenchmarkEntry): number {
  // Approximate using p25, median, p75
  if (val <= b.min) return 0;
  if (val >= b.max) return 100;
  if (val <= b.p25) return 25 * ((val - b.min) / (b.p25 - b.min));
  if (val <= b.median) return 25 + 25 * ((val - b.p25) / (b.median - b.p25));
  if (val <= b.p75) return 50 + 25 * ((val - b.median) / (b.p75 - b.median));
  return 75 + 25 * ((val - b.p75) / (b.max - b.p75));
}

/** Convert percentile (0-100) to letter grade */
function percentileToGrade(pct: number): GradeInfo {
  if (pct >= 90) return { letter: "A+", cssClass: "grade-a" };
  if (pct >= 80) return { letter: "A", cssClass: "grade-a" };
  if (pct >= 70) return { letter: "B+", cssClass: "grade-b" };
  if (pct >= 60) return { letter: "B", cssClass: "grade-b" };
  if (pct >= 50) return { letter: "C+", cssClass: "grade-c" };
  if (pct >= 40) return { letter: "C", cssClass: "grade-c" };
  if (pct >= 30) return { letter: "D+", cssClass: "grade-d" };
  if (pct >= 20) return { letter: "D", cssClass: "grade-d" };
  return { letter: "F", cssClass: "grade-f" };
}

/** Compute category grades for report card.
 *  higherIsBetter=false means lower values are better (crime, poverty, etc.) */
function computeGrades(p: CityProfile, bm: Benchmarks) {
  const grades: { category: string; grade: GradeInfo | null }[] = [];

  // Affordability — composite of income (higher=better) + rent burden (lower=better) + housing ratio (lower=better)
  const affScores: number[] = [];
  if (p.economy?.median_household_income && bm.median_household_income)
    affScores.push(percentileRank(p.economy.median_household_income, bm.median_household_income));
  if (p.economy?.rent_to_income_ratio && bm.rent_to_income_ratio)
    affScores.push(100 - percentileRank(p.economy.rent_to_income_ratio, bm.rent_to_income_ratio));
  if (p.economy?.home_value_to_income_ratio && bm.home_value_to_income_ratio)
    affScores.push(100 - percentileRank(p.economy.home_value_to_income_ratio, bm.home_value_to_income_ratio));
  grades.push({
    category: "Affordability",
    grade: affScores.length > 0 ? percentileToGrade(affScores.reduce((a, b) => a + b, 0) / affScores.length) : null,
  });

  // Safety
  if (p.safety?.violent_crime_rate && bm.violent_crime_rate) {
    const pct = 100 - percentileRank(p.safety.violent_crime_rate, bm.violent_crime_rate);
    grades.push({ category: "Safety", grade: percentileToGrade(pct) });
  } else {
    grades.push({ category: "Safety", grade: null });
  }

  // Schools
  if (p.education?.avg_school_rating && bm.avg_school_rating) {
    grades.push({ category: "Schools", grade: percentileToGrade(percentileRank(p.education.avg_school_rating, bm.avg_school_rating)) });
  } else {
    grades.push({ category: "Schools", grade: null });
  }

  // Jobs
  const jobScores: number[] = [];
  if (p.economy?.unemployment_rate && bm.unemployment_rate)
    jobScores.push(100 - percentileRank(p.economy.unemployment_rate, bm.unemployment_rate));
  if (p.economy?.median_household_income && bm.median_household_income)
    jobScores.push(percentileRank(p.economy.median_household_income, bm.median_household_income));
  grades.push({
    category: "Jobs",
    grade: jobScores.length > 0 ? percentileToGrade(jobScores.reduce((a, b) => a + b, 0) / jobScores.length) : null,
  });

  // Housing
  if (p.housing?.median_rent && bm.median_rent) {
    const pct = 100 - percentileRank(p.housing.median_rent, bm.median_rent);
    grades.push({ category: "Housing", grade: percentileToGrade(pct) });
  } else {
    grades.push({ category: "Housing", grade: null });
  }

  // Environment
  if (p.environment?.pm25_mean && bm.pm25_mean) {
    const pct = 100 - percentileRank(p.environment.pm25_mean, bm.pm25_mean);
    grades.push({ category: "Air Quality", grade: percentileToGrade(pct) });
  } else {
    grades.push({ category: "Air Quality", grade: null });
  }

  return grades;
}

/** Compute composite score (average of available grades, 0-100) */
function compositeScore(grades: { grade: GradeInfo | null }[]): number | null {
  const gradeToScore: Record<string, number> = {
    "A+": 97, "A": 85, "B+": 75, "B": 65, "C+": 55, "C": 45, "D+": 35, "D": 25, "F": 10,
  };
  const scores = grades.filter((g) => g.grade != null).map((g) => gradeToScore[g.grade!.letter] || 50);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/* ── At-a-Glance Stats ── */

function pickGlanceStats(p: CityProfile) {
  type GS = { value: string; label: string; priority: number };
  const stats: GS[] = [];
  if (p.economy?.median_household_income)
    stats.push({ value: fmtDollar(p.economy.median_household_income), label: "Median Income", priority: 1 });
  if (p.safety?.violent_crime_rate != null)
    stats.push({ value: fmt(p.safety.violent_crime_rate, { decimals: 0 }), label: "Violent Crime / 100K", priority: 2 });
  if (p.education?.avg_school_rating)
    stats.push({ value: `${fmt(p.education.avg_school_rating, { decimals: 1 })}/10`, label: "School Rating", priority: 3 });
  if (p.housing?.median_rent)
    stats.push({ value: fmtDollar(p.housing.median_rent), label: "Median Rent", priority: 4 });
  if (p.economy?.unemployment_rate != null)
    stats.push({ value: fmtPct(p.economy.unemployment_rate), label: "Unemployment", priority: 5 });
  if (p.environment?.pm25_mean)
    stats.push({ value: fmt(p.environment.pm25_mean, { decimals: 1 }), label: "PM2.5 (\u03BCg/m\u00B3)", priority: 6 });
  if (p.governance?.committee_count)
    stats.push({ value: String(p.governance.committee_count), label: "Committees", priority: 7 });
  if (p.governance?.legislative_volume)
    stats.push({ value: p.governance.legislative_volume.toLocaleString(), label: "Legislative Matters", priority: 8 });
  return stats.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

/* ── Finding generator ── */

function generateFinding(p: CityProfile, b: Benchmarks): string {
  const name = p.identity.name;
  const parts: string[] = [];

  if (p.economy?.median_household_income) {
    const inc = p.economy.median_household_income;
    const bm = b.median_household_income;
    if (bm) {
      const rel = inc > bm.median * 1.05 ? "above" : inc < bm.median * 0.95 ? "below" : "near";
      parts.push(`a median household income of ${fmtDollar(inc)} (${rel} the ${fmtCompact(bm.median)} national median)`);
    } else {
      parts.push(`a median household income of ${fmtDollar(inc)}`);
    }
  }

  if (p.safety?.violent_crime_rate != null) {
    const r = p.safety.violent_crime_rate;
    const level = r < 200 ? "low" : r < 400 ? "moderate" : r < 700 ? "elevated" : "high";
    parts.push(`${level} violent crime`);
  }

  if (p.education?.school_quality_tier)
    parts.push(`${p.education.school_quality_tier}-rated schools`);

  if (p.housing?.median_rent) {
    const rent = p.housing.median_rent;
    const bm = b.median_rent;
    if (bm) {
      const rel = rent > bm.median * 1.05 ? "above" : rent < bm.median * 0.95 ? "below" : "near";
      parts.push(`a median rent of ${fmtDollar(rent)}/mo (${rel} the ${fmtCompact(bm.median)} median)`);
    } else {
      parts.push(`a median rent of ${fmtDollar(rent)}/mo`);
    }
  }

  if (parts.length >= 2) return `${name} has ${parts.slice(0, 3).join(", ")}.`;
  if (p.governance?.legislative_volume)
    return `${name} has ${p.governance.legislative_volume.toLocaleString()} legislative matters tracked across ${p.governance.committee_count || "multiple"} committees.`;
  return `${name} is one of 290 local governments profiled with open data.`;
}

/* ── Story Starters — auto-detect the most newsworthy facts ── */

type StoryStarter = {
  text: string;        // Plain-English quotable sentence
  source: string;      // e.g. "Census ACS 2022"
  tag: "anomaly" | "trend" | "comparison" | "governance";
  magnitude: number;   // sort key — higher = more interesting
};

/** IQR-based deviation: how many interquartile ranges from the median */
function iqrDeviation(val: number, bm: BenchmarkEntry): number {
  const iqr = bm.p75 - bm.p25;
  if (iqr === 0) return 0;
  return (val - bm.median) / iqr;
}

function generateStoryStarters(p: CityProfile, bm: Benchmarks): StoryStarter[] {
  const name = p.identity.name;
  const starters: StoryStarter[] = [];

  // — Economy anomalies —
  if (p.economy?.median_household_income && bm.median_household_income) {
    const v = p.economy.median_household_income;
    const dev = iqrDeviation(v, bm.median_household_income);
    if (Math.abs(dev) > 1) {
      const pctDiff = Math.round(((v - bm.median_household_income.median) / bm.median_household_income.median) * 100);
      const dir = pctDiff > 0 ? "above" : "below";
      starters.push({
        text: `${name}'s median household income of ${fmtDollar(v)} is ${Math.abs(pctDiff)}% ${dir} the national median of ${fmtCompact(bm.median_household_income.median)}.`,
        source: "Census ACS 5-year",
        tag: "anomaly",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.economy?.poverty_rate != null && bm.poverty_rate) {
    const v = p.economy.poverty_rate;
    const dev = iqrDeviation(v, bm.poverty_rate);
    if (Math.abs(dev) > 1.2) {
      const rel = v > bm.poverty_rate.median ? "above" : "below";
      starters.push({
        text: `${fmtPct(v)} of ${name} residents live below the poverty line — ${rel} the ${fmtPct(bm.poverty_rate.median)} national median.`,
        source: "Census ACS 5-year",
        tag: "anomaly",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.economy?.unemployment_rate != null && bm.unemployment_rate) {
    const v = p.economy.unemployment_rate;
    const dev = iqrDeviation(v, bm.unemployment_rate);
    if (Math.abs(dev) > 1.2) {
      starters.push({
        text: `Unemployment in ${name} stands at ${fmtPct(v)}${p.economy.unemployment_data_level && p.economy.unemployment_data_level !== "city" ? ` (${p.economy.unemployment_data_level}-level)` : ""}, compared to a ${fmtPct(bm.unemployment_rate.median)} national median.`,
        source: "BLS LAUS",
        tag: "anomaly",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.economy?.home_value_to_income_ratio != null && bm.home_value_to_income_ratio) {
    const v = p.economy.home_value_to_income_ratio;
    const dev = iqrDeviation(v, bm.home_value_to_income_ratio);
    if (dev > 1.5) {
      starters.push({
        text: `Home prices in ${name} run ${v.toFixed(1)}x median income — well above the ${bm.home_value_to_income_ratio.median.toFixed(1)}x national median, signaling a significant affordability gap.`,
        source: "Census ACS 5-year",
        tag: "anomaly",
        magnitude: dev,
      });
    }
  }

  // — Safety anomalies —
  if (p.safety?.violent_crime_rate != null && bm.violent_crime_rate) {
    const v = p.safety.violent_crime_rate;
    const dev = iqrDeviation(v, bm.violent_crime_rate);
    if (Math.abs(dev) > 0.8) {
      const level = v < 200 ? "remarkably low" : v > 700 ? "among the highest in the dataset" : v > 400 ? "elevated" : "moderate";
      starters.push({
        text: `${name}'s violent crime rate of ${fmt(v, { decimals: 0 })} per 100,000 is ${level}${p.safety.crime_data_level && p.safety.crime_data_level !== "city" ? ` (${p.safety.crime_data_level}-level data)` : ""}.`,
        source: p.safety.crime_data_level === "city" ? "City open data portal" : "FBI/Socrata",
        tag: "anomaly",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.safety?.crime_trend != null && Math.abs(p.safety.crime_trend) > 10) {
    const dir = p.safety.crime_trend < 0 ? "declined" : "increased";
    starters.push({
      text: `Crime in ${name} has ${dir} ${fmt(Math.abs(p.safety.crime_trend), { suffix: "%", decimals: 1 })} year over year.`,
      source: "FBI/Socrata",
      tag: "trend",
      magnitude: Math.abs(p.safety.crime_trend) / 10,
    });
  }

  // — Housing anomalies —
  if (p.housing?.median_rent != null && bm.median_rent) {
    const v = p.housing.median_rent;
    const dev = iqrDeviation(v, bm.median_rent);
    if (Math.abs(dev) > 1.2) {
      const pctDiff = Math.round(((v - bm.median_rent.median) / bm.median_rent.median) * 100);
      const dir = pctDiff > 0 ? "above" : "below";
      starters.push({
        text: `Median rent in ${name} is ${fmtDollar(v)}/month — ${Math.abs(pctDiff)}% ${dir} the national median of ${fmtCompact(bm.median_rent.median)}.`,
        source: "Census ACS 5-year",
        tag: "anomaly",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.housing?.cost_burdened_pct != null && bm.cost_burdened_pct) {
    const v = p.housing.cost_burdened_pct;
    const dev = iqrDeviation(v, bm.cost_burdened_pct);
    if (dev > 1.2) {
      starters.push({
        text: `${fmtPct(v)} of ${name} households are cost-burdened, spending 30% or more of income on housing — well above the ${fmtPct(bm.cost_burdened_pct.median)} national median.`,
        source: "Census ACS 5-year",
        tag: "anomaly",
        magnitude: dev,
      });
    }
  }

  // — Education anomalies —
  if (p.education?.avg_school_rating != null && bm.avg_school_rating) {
    const v = p.education.avg_school_rating;
    const dev = iqrDeviation(v, bm.avg_school_rating);
    if (Math.abs(dev) > 1) {
      const quality = v >= 7 ? "well above average" : v <= 4 ? "well below average" : v > bm.avg_school_rating.median ? "above average" : "below average";
      starters.push({
        text: `Schools in ${name} average a ${fmt(v, { decimals: 1 })}/10 rating — ${quality} (national median: ${fmt(bm.avg_school_rating.median, { decimals: 1 })}/10).`,
        source: "GreatSchools",
        tag: "comparison",
        magnitude: Math.abs(dev),
      });
    }
  }

  // — Environment anomalies —
  if (p.environment?.pm25_mean != null && bm.pm25_mean) {
    const v = p.environment.pm25_mean;
    const dev = iqrDeviation(v, bm.pm25_mean);
    if (Math.abs(dev) > 1) {
      const quality = v <= 5.0 ? "meets the WHO guideline of 5.0" : v <= 10 ? "is moderate" : "exceeds EPA standards";
      starters.push({
        text: `Air quality in ${name} (PM2.5: ${fmt(v, { decimals: 1 })} \u03BCg/m\u00B3) ${quality}. The national median is ${fmt(bm.pm25_mean.median, { decimals: 1 })}.`,
        source: "EPA AQS",
        tag: "comparison",
        magnitude: Math.abs(dev),
      });
    }
  }

  if (p.environment?.total_disasters != null && p.environment.total_disasters > 20) {
    starters.push({
      text: `${name}'s area has experienced ${p.environment.total_disasters} federally declared disasters${p.environment.most_recent_disaster_type ? `, most recently a ${p.environment.most_recent_disaster_type.toLowerCase()}` : ""}.`,
      source: "FEMA",
      tag: "comparison",
      magnitude: p.environment.total_disasters / 15,
    });
  }

  // — Governance insights —
  if (p.governance?.agenda_availability_pct != null && p.governance.agenda_availability_pct < 5 &&
      p.governance?.minutes_availability_pct != null && p.governance.minutes_availability_pct < 5) {
    starters.push({
      text: `${name} publishes virtually no meeting agendas or minutes on its legislative platform — a significant transparency gap.`,
      source: "Legistar",
      tag: "governance",
      magnitude: 2.0,
    });
  } else if (p.governance?.agenda_availability_pct != null && p.governance.agenda_availability_pct > 90) {
    starters.push({
      text: `${name} publishes agendas for ${fmtPct(p.governance.agenda_availability_pct)} of its meetings, indicating strong transparency.`,
      source: "Legistar",
      tag: "governance",
      magnitude: 1.2,
    });
  }

  if (p.civic_issues?.resolution_rate != null) {
    if (p.civic_issues.resolution_rate > 90) {
      starters.push({
        text: `${name} resolves ${fmtPct(p.civic_issues.resolution_rate)} of reported civic issues — an unusually high resolution rate.`,
        source: "SeeClickFix",
        tag: "governance",
        magnitude: 1.5,
      });
    } else if (p.civic_issues.resolution_rate < 40) {
      starters.push({
        text: `Only ${fmtPct(p.civic_issues.resolution_rate)} of civic issues reported in ${name} get resolved.`,
        source: "SeeClickFix",
        tag: "governance",
        magnitude: 1.8,
      });
    }
  }

  if (p.civic_issues?.top_issue_type && (p.civic_issues.total_issues || 0) > 100) {
    starters.push({
      text: `The most common civic complaint in ${name}? ${p.civic_issues.top_issue_type} — out of ${(p.civic_issues.total_issues || 0).toLocaleString()} total reported issues.`,
      source: "SeeClickFix",
      tag: "governance",
      magnitude: 1.0,
    });
  }

  // — Time series trends —
  const econH = sortedTimeSeries(p.time_series?.economy_history || []);
  if (econH.length >= 5) {
    const uRates = econH.map((e) => (e as Record<string, number>).unemployment_rate).filter((v): v is number => v != null);
    if (uRates.length >= 5) {
      const first = uRates[0];
      const last = uRates[uRates.length - 1];
      const change = last - first;
      if (Math.abs(change) > 2) {
        const dir = change < 0 ? "fallen" : "risen";
        starters.push({
          text: `Unemployment in ${name} has ${dir} from ${first.toFixed(1)}% to ${last.toFixed(1)}% over the past ${uRates.length} years.`,
          source: "BLS LAUS",
          tag: "trend",
          magnitude: Math.abs(change) / 2,
        });
      }
    }
  }

  // Sort by magnitude (most interesting first) and take top 5
  return starters.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
}


/* ── Report Card Row Builder ── */

type ReportRow = {
  category: string;
  grade: GradeInfo | null;
  metric: string;
  label: string;
  context: string;
  barPct: number | null;
  medPct: number | null;
  sentiment: "" | "good" | "bad" | "caution";
};

function buildReportRows(
  p: CityProfile,
  b: Benchmarks,
  grades: { category: string; grade: GradeInfo | null }[],
): ReportRow[] {
  const rows: ReportRow[] = [];
  const gradeMap = new Map(grades.map((g) => [g.category, g.grade]));

  if (p.economy?.median_household_income != null) {
    const v = p.economy.median_household_income;
    const bm = b.median_household_income;
    const pctDiff = bm ? Math.round(((v - bm.median) / bm.median) * 100) : 0;
    const rel = pctDiff > 5 ? "above" : pctDiff < -5 ? "below" : "near";
    rows.push({
      category: "Affordability",
      grade: gradeMap.get("Affordability") || null,
      metric: fmtDollar(v),
      label: "Median Income",
      context: bm ? `${Math.abs(pctDiff)}% ${rel} median` : "",
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: bm ? vsMedian(v, bm.median, true) : "",
    });
  }

  if (p.safety?.violent_crime_rate != null) {
    const v = p.safety.violent_crime_rate;
    const bm = b.violent_crime_rate;
    const level = v < 200 ? "Low" : v < 400 ? "Moderate" : v < 700 ? "Elevated" : "High";
    rows.push({
      category: "Safety",
      grade: gradeMap.get("Safety") || null,
      metric: fmt(v, { decimals: 0 }),
      label: "per 100K",
      context: `${level} violent crime`,
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: v < 200 ? "good" : v < 400 ? "" : v < 700 ? "caution" : "bad",
    });
  }

  if (p.education?.avg_school_rating != null) {
    const v = p.education.avg_school_rating;
    const bm = b.avg_school_rating;
    const tier = p.education.school_quality_tier;
    rows.push({
      category: "Schools",
      grade: gradeMap.get("Schools") || null,
      metric: `${fmt(v, { decimals: 1 })}/10`,
      label: "Avg Rating",
      context: tier ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} quality` : "",
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: v >= 7 ? "good" : v >= 5 ? "" : v >= 3 ? "caution" : "bad",
    });
  }

  if (p.economy?.unemployment_rate != null) {
    const v = p.economy.unemployment_rate;
    const bm = b.unemployment_rate;
    rows.push({
      category: "Jobs",
      grade: gradeMap.get("Jobs") || null,
      metric: fmtPct(v),
      label: "Unemployment",
      context: bm ? `vs ${fmtPct(bm.median)} median` : "",
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: bm ? vsMedian(v, bm.median, false) : "",
    });
  }

  if (p.housing?.median_rent != null) {
    const v = p.housing.median_rent;
    const bm = b.median_rent;
    const pctDiff = bm ? Math.round(((v - bm.median) / bm.median) * 100) : 0;
    const rel = pctDiff > 5 ? "above" : pctDiff < -5 ? "below" : "near";
    rows.push({
      category: "Housing",
      grade: gradeMap.get("Housing") || null,
      metric: `${fmtDollar(v)}/mo`,
      label: "Median Rent",
      context: bm ? `${Math.abs(pctDiff)}% ${rel} median` : "",
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: bm ? vsMedian(v, bm.median, false) : "",
    });
  }

  if (p.environment?.pm25_mean != null) {
    const v = p.environment.pm25_mean;
    const bm = b.pm25_mean;
    const level = v <= 5.0 ? "Meets WHO guideline" : v <= 12 ? "Moderate" : "Above EPA standard";
    rows.push({
      category: "Air Quality",
      grade: gradeMap.get("Air Quality") || null,
      metric: fmt(v, { decimals: 1 }),
      label: "PM2.5 \u03BCg/m\u00B3",
      context: level,
      barPct: bm ? barPosition(v, bm) : null,
      medPct: bm ? medianPosition(bm) : null,
      sentiment: v <= 5.0 ? "good" : v <= 12 ? "" : "bad",
    });
  }

  return rows;
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
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
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
  const b = loadBenchmarks();

  const accentClass = `accent-${hashSlug(slug)}`;
  const finding = generateFinding(p, b);
  const dims = countDimensions(p);
  const srcCount = countSources(p.data_sources || {});

  const grades = computeGrades(p, b);
  const composite = compositeScore(grades);
  const compositeGrade = composite != null ? percentileToGrade(composite) : null;

  const storyStarters = generateStoryStarters(p, b);
  const reportRows = buildReportRows(p, b, grades);
  const hasCivicIssues = (p.civic_issues?.total_issues || 0) > 0;

  return (
    <div className={accentClass}>
      <ScrollAnimator />

      {/* ── HERO (compact, editorial) ── */}
      <section className="hero hero-compact">
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="hero-glow" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            {srcCount} Data Sources &middot; {dims.available} of {dims.total} Dimensions
          </div>
          <h1 className="hero-name">{p.identity.name}</h1>
          <p className="hero-state">{p.identity.state}</p>

          <div className="hero-verdict">
            {p.identity.population != null && (
              <div className="hero-pop-inline">
                <span className="hero-pop-number">{fmtPop(p.identity.population)}</span>
                <span className="hero-pop-label-sm">residents</span>
              </div>
            )}
            {compositeGrade && (
              <div className="hero-grade-inline">
                <span className={`hero-grade-letter ${compositeGrade.cssClass}`}>
                  {compositeGrade.letter}
                </span>
                <span className="hero-pop-label-sm">Overall Grade</span>
              </div>
            )}
          </div>

          {compositeGrade && (
            <div className="hero-grades-strip">
              {grades.map((g) => (
                <div key={g.category} className="hero-grade-chip">
                  <span className={`hero-chip-grade ${g.grade?.cssClass || "grade-na"}`}>
                    {g.grade?.letter || "\u2014"}
                  </span>
                  <span className="hero-chip-label">{g.category}</span>
                </div>
              ))}
            </div>
          )}

          <p className="hero-finding">{finding}</p>
        </div>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <nav className="quick-actions">
        <div className="quick-actions-inner">
          {p.officials?.members && p.officials.members.length > 0 && (
            <a href="#your-government" className="qa-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Contact Your Government
            </a>
          )}
          {(p.recent_meetings?.length || p.recent_legislation?.length) ? (
            <a href="#whats-happening" className="qa-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Meetings &amp; Decisions
            </a>
          ) : null}
          <a href="#report-card" className="qa-pill">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            City Data
          </a>
          {hasCivicIssues && (
            <a href="#civic-issues" className="qa-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Report a Problem
            </a>
          )}
        </div>
      </nav>

      {/* ── SECTIONS ── */}
      <div className="sections">

        {/* ═══ YOUR GOVERNMENT (officials + contact — FIRST) ═══ */}
        {p.officials?.members && p.officials.members.length > 0 && (
          <div className="section" id="your-government">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h2 className="section-title">Your Government</h2>
            </div>

            <p className="section-narrative">
              {p.officials.body_name
                ? <>The <strong>{p.officials.body_name.replace(/^\*\s*/, "")}</strong> has <strong>{p.officials.members.length}</strong> current members on record.</>
                : <><strong>{p.officials.members.length}</strong> elected officials on record.</>}
              {p.legistar_url && <> View full records on <a href={p.legistar_url} target="_blank" rel="noopener noreferrer" className="inline-link">Legistar</a>.</>}
            </p>

            <div className="officials-grid">
              {p.officials.members.map((m) => (
                <div key={m.name} className="official-card">
                  <div className="official-name">{m.name}</div>
                  {m.title && <div className="official-title">{m.title}</div>}
                  <div className="official-contact">
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="official-email">{m.email}</a>
                    )}
                    {m.phone && (
                      <span className="official-phone">{m.phone}</span>
                    )}
                  </div>
                  {m.committees && m.committees.length > 0 && (
                    <div className="official-committees">
                      {m.committees.map((c) => (
                        <span key={c} className="committee-tag">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ WHAT'S HAPPENING (meetings + legislation + video + news) ═══ */}
        {(p.recent_meetings?.length || p.recent_legislation?.length || p.video_meetings?.length || p.government_news?.length) ? (
          <div className="section" id="whats-happening">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h2 className="section-title">What&apos;s Happening</h2>
            </div>

            {/* Upcoming Meetings */}
            {p.recent_meetings && p.recent_meetings.length > 0 && (() => {
              const upcoming = p.recent_meetings!.filter((m) => m.upcoming);
              const recent = p.recent_meetings!.filter((m) => !m.upcoming);
              return (
                <>
                  {upcoming.length > 0 && (
                    <>
                      <h3 className="section-subtitle">Upcoming Meetings</h3>
                      <div className="meetings-list">
                        {upcoming.slice(0, 3).map((m, i) => (
                          <div key={`up-${i}`} className="meeting-item upcoming">
                            <div className="meeting-date">
                              {m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                            </div>
                            <div className="meeting-details">
                              <div className="meeting-body">{m.body}</div>
                              {m.location && <div className="meeting-location">{m.location}</div>}
                              <div className="meeting-badges">
                                {m.has_agenda && <span className="meeting-badge badge-agenda">Agenda</span>}
                                {m.has_video && <span className="meeting-badge badge-video">Video</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {recent.length > 0 && (
                    <>
                      <h3 className="section-subtitle">Recent Meetings</h3>
                      <div className="meetings-list">
                        {recent.slice(0, 2).map((m, i) => (
                          <div key={`rec-${i}`} className="meeting-item">
                            <div className="meeting-date">
                              {m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                            </div>
                            <div className="meeting-details">
                              <div className="meeting-body">{m.body}</div>
                              <div className="meeting-badges">
                                {m.has_agenda && <span className="meeting-badge badge-agenda">Agenda</span>}
                                {m.has_minutes && <span className="meeting-badge badge-minutes">Minutes</span>}
                                {m.has_video && <span className="meeting-badge badge-video">Video</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* Recent Legislation */}
            {p.recent_legislation && p.recent_legislation.length > 0 && (
              <>
                <h3 className="section-subtitle">Latest Legislation</h3>
                <div className="legislation-list">
                  {p.recent_legislation.slice(0, 3).map((l, i) => (
                    <div key={i} className="legislation-item">
                      <div className="legislation-meta">
                        <span className="legislation-type">{l.type}</span>
                        <span className={`legislation-status status-${l.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                          {l.status}
                        </span>
                        {l.file_number && <span className="legislation-file">{l.file_number}</span>}
                      </div>
                      <div className="legislation-title">{l.title}</div>
                      {l.intro_date && (
                        <div className="legislation-date">
                          Introduced {new Date(l.intro_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {p.legistar_url && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <a href={`${p.legistar_url}/Legislation`} target="_blank" rel="noopener noreferrer" className="inline-link">
                      Browse all legislation &rarr;
                    </a>
                  </div>
                )}
              </>
            )}

            {/* Video Meetings */}
            {p.video_meetings && p.video_meetings.length > 0 && (
              <>
                <h3 className="section-subtitle">Watch Government</h3>
                <div className="video-meetings-list">
                  {p.video_meetings.slice(0, 2).map((v, i) => (
                    <a
                      key={i}
                      href={v.video_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-meeting-item"
                    >
                      <div className="video-meeting-play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                      <div className="video-meeting-details">
                        <div className="video-meeting-title">{v.title}</div>
                        {v.date && (
                          <div className="video-meeting-date">
                            {new Date(v.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        )}
                      </div>
                      <div className="video-meeting-badge">
                        {v.is_youtube ? "YouTube" : "Video"}
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}

            {/* Government News */}
            {p.government_news && p.government_news.length > 0 && (
              <>
                <h3 className="section-subtitle">City Hall News</h3>
                <div className="news-list">
                  {p.government_news.slice(0, 2).map((n, i) => (
                    <a
                      key={i}
                      href={n.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-item"
                    >
                      <div className="news-title">{n.title}</div>
                      {n.description && <div className="news-description">{n.description}</div>}
                      {n.date && (
                        <div className="news-date">
                          {new Date(n.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* ═══ CIVIC ISSUES (Report a Problem) ═══ */}
        {hasCivicIssues && (
          <div className="section" id="civic-issues">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2 className="section-title">Does the City Listen?</h2>
            </div>

            <p className="section-narrative">
              {p.identity.name} has <strong>{(p.civic_issues.total_issues || 0).toLocaleString()}</strong> civic issues tracked
              {p.civic_issues.resolution_rate != null && (
                <> with a{" "}
                  <span className={p.civic_issues.resolution_rate > 70 ? "good" : p.civic_issues.resolution_rate > 50 ? "" : "bad"}>
                    {fmtPct(p.civic_issues.resolution_rate)} resolution rate
                  </span>
                </>
              )}
              {p.civic_issues.top_issue_type && (
                <>. The most common issue is <strong>{p.civic_issues.top_issue_type}</strong></>
              )}
              .
            </p>

            <div className="stat-grid">
              {p.civic_issues.resolution_rate != null && (
                <div className="stat">
                  <div className={`stat-value ${p.civic_issues.resolution_rate > 70 ? "good" : p.civic_issues.resolution_rate < 50 ? "bad" : ""}`}>
                    {fmtPct(p.civic_issues.resolution_rate)}
                  </div>
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
                  items={Object.entries(p.civic_issues.type_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([k, v]) => ({ label: k, value: v }))}
                />
              </>
            )}
          </div>
        )}

        {/* ═══ CITY REPORT CARD (compact — replaces 5 sprawling data sections) ═══ */}
        {reportRows.length > 0 && (
          <div className="section" id="report-card">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2 className="section-title">City Report Card</h2>
            </div>

            <p className="section-narrative">
              How {p.identity.name} compares to 290 cities across key quality-of-life metrics.
              Grades are based on percentile rank — an A means top 20%, an F means bottom 20%.
            </p>

            <div className="rc-grid">
              {reportRows.map((row) => (
                <div key={row.category} className="rc-row">
                  <div className={`rc-grade ${row.grade?.cssClass || "grade-na"}`}>
                    {row.grade?.letter || "\u2014"}
                  </div>
                  <div className="rc-info">
                    <div className="rc-category">{row.category}</div>
                    <div className="rc-metric-line">
                      <span className={`rc-value ${row.sentiment}`}>{row.metric}</span>
                      <span className="rc-label">{row.label}</span>
                    </div>
                    {row.context && <div className="rc-context">{row.context}</div>}
                  </div>
                  {row.barPct != null && (
                    <div className="rc-bar-wrap">
                      <div className="rc-bar-track">
                        <div className="rc-bar-fill" style={{ width: `${row.barPct}%` }} />
                        <div className="rc-bar-dot" style={{ left: `${row.barPct}%` }} />
                        {row.medPct != null && (
                          <div className="rc-bar-median" style={{ left: `${row.medPct}%` }} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Governance summary */}
            {p.governance && (
              <div className="rc-governance">
                <h3 className="section-subtitle">Governance &amp; Transparency</h3>
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
                  {p.governance.agenda_availability_pct != null && (
                    <div className="stat">
                      <div className={`stat-value ${p.governance.agenda_availability_pct > 80 ? "good" : p.governance.agenda_availability_pct < 20 ? "caution" : ""}`}>
                        {fmtPct(p.governance.agenda_availability_pct)}
                      </div>
                      <div className="stat-label">Agendas Published</div>
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
                      <div className="stat-value">{fmt(p.governance.years_of_legislative_data, { decimals: 0 })}</div>
                      <div className="stat-label">Years of Data</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ WHAT YOU SHOULD KNOW (story starters) ═══ */}
        {storyStarters.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h2 className="section-title">What You Should Know</h2>
            </div>

            <ul className="story-starters-list">
              {storyStarters.map((s, i) => (
                <li key={i} className="story-starter">
                  <span className={`story-starter-tag tag-${s.tag}`}>{s.tag}</span>
                  <span className="story-starter-text">{s.text}</span>
                  <span className="story-starter-source">{s.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ═══ DATA SOURCES (always shown) ═══ */}
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

          <p className="section-narrative">
            This profile draws from <strong>{srcCount}</strong> verified government data sources. All data is publicly accessible.
          </p>

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
