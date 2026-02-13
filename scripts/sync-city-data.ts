#!/usr/bin/env npx tsx
/**
 * Copies SimCity Inventory city profiles into public/data/cities/
 * and generates an _index.json for the browse page.
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

console.log(`Synced ${copied} city profiles to ${DEST_DIR}`);
console.log(`Generated _index.json with ${index.length} entries`);
