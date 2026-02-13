#!/usr/bin/env npx tsx
/**
 * Copies SimCity Inventory city profiles into public/data/cities/
 * Generates _index.json for the browse page and _benchmarks.json for comparisons.
 *
 * Usage: npx tsx scripts/sync-city-data.ts
 */

import { readdirSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const SOURCE_DIR = join(__dirname, "../../simcity-inventory/output/profiles");
const DEST_DIR = join(__dirname, "../public/data/cities");

if (!existsSync(SOURCE_DIR)) {
  console.error(`Source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".json"));
let copied = 0;

interface IndexEntry {
  slug: string;
  name: string;
  state: string;
  population: number | null;
  sourceCount: number;
}

const index: IndexEntry[] = [];

// Collect values for benchmarks
const benchmarkCollectors: Record<string, number[]> = {
  median_household_income: [],
  median_home_value: [],
  unemployment_rate: [],
  poverty_rate: [],
  homeownership_rate: [],
  rent_to_income_ratio: [],
  home_value_to_income_ratio: [],
  violent_crime_rate: [],
  property_crime_rate: [],
  avg_school_rating: [],
  median_rent: [],
  cost_burdened_pct: [],
  rent_burden_ratio: [],
  pm25_mean: [],
  population: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collect(data: any) {
  const push = (key: string, val: number | null | undefined) => {
    if (val != null && isFinite(val)) benchmarkCollectors[key].push(val);
  };
  push("population", data.identity?.population);
  push("median_household_income", data.economy?.median_household_income);
  push("median_home_value", data.economy?.median_home_value);
  push("unemployment_rate", data.economy?.unemployment_rate);
  push("poverty_rate", data.economy?.poverty_rate);
  push("homeownership_rate", data.economy?.homeownership_rate);
  push("rent_to_income_ratio", data.economy?.rent_to_income_ratio);
  push("home_value_to_income_ratio", data.economy?.home_value_to_income_ratio);
  push("violent_crime_rate", data.safety?.violent_crime_rate);
  push("property_crime_rate", data.safety?.property_crime_rate);
  push("avg_school_rating", data.education?.avg_school_rating);
  push("median_rent", data.housing?.median_rent);
  push("cost_burdened_pct", data.housing?.cost_burdened_pct);
  push("rent_burden_ratio", data.housing?.rent_burden_ratio);
  push("pm25_mean", data.environment?.pm25_mean);
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

for (const file of files) {
  copyFileSync(join(SOURCE_DIR, file), join(DEST_DIR, file));
  copied++;

  try {
    const data = JSON.parse(readFileSync(join(SOURCE_DIR, file), "utf-8"));
    const slug = file.replace(".json", "");
    const sourceCount = Object.values(data.data_sources || {}).filter(
      (s) => s === "available"
    ).length;

    index.push({
      slug,
      name: data.identity?.name || slug,
      state: data.identity?.state || "",
      population: data.identity?.population || null,
      sourceCount,
    });

    collect(data);
  } catch {
    // Skip malformed files
  }
}

// Sort by population (largest first), nulls at end
index.sort((a, b) => {
  if (a.population == null && b.population == null) return a.name.localeCompare(b.name);
  if (a.population == null) return 1;
  if (b.population == null) return -1;
  return b.population - a.population;
});

writeFileSync(join(DEST_DIR, "_index.json"), JSON.stringify(index));

// Compute benchmarks
const benchmarks: Record<string, { median: number; p25: number; p75: number; min: number; max: number; count: number }> = {};
for (const [key, values] of Object.entries(benchmarkCollectors)) {
  if (values.length < 5) continue;
  benchmarks[key] = {
    median: Math.round(percentile(values, 50) * 100) / 100,
    p25: Math.round(percentile(values, 25) * 100) / 100,
    p75: Math.round(percentile(values, 75) * 100) / 100,
    min: Math.round(Math.min(...values) * 100) / 100,
    max: Math.round(Math.max(...values) * 100) / 100,
    count: values.length,
  };
}

writeFileSync(join(DEST_DIR, "_benchmarks.json"), JSON.stringify(benchmarks, null, 2));

console.log(`Synced ${copied} city profiles to ${DEST_DIR}`);
console.log(`Generated _index.json with ${index.length} entries`);
console.log(`Generated _benchmarks.json with ${Object.keys(benchmarks).length} metrics`);
