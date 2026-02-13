/**
 * generate-city-illustrations.ts
 *
 * Reads each city JSON from public/data/cities/ and generates a deterministic,
 * data-driven SVG illustration written to public/illustrations/{slug}.svg.
 *
 * Usage:  npx tsx scripts/generate-city-illustrations.ts
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Region / palette definitions
// ---------------------------------------------------------------------------

type Region =
  | "northeast"
  | "southeast"
  | "midwest"
  | "southwest"
  | "westcoast"
  | "mountain";

const STATE_REGION: Record<string, Region> = {
  // Northeast
  MA: "northeast",
  NY: "northeast",
  NJ: "northeast",
  PA: "northeast",
  CT: "northeast",
  RI: "northeast",
  NH: "northeast",
  MD: "northeast",
  VA: "northeast",
  DE: "northeast",
  ME: "northeast",
  VT: "northeast",
  // Southeast
  FL: "southeast",
  GA: "southeast",
  AL: "southeast",
  NC: "southeast",
  SC: "southeast",
  TN: "southeast",
  AR: "southeast",
  MS: "southeast",
  LA: "southeast",
  KY: "southeast",
  WV: "southeast",
  // Midwest
  IL: "midwest",
  MI: "midwest",
  OH: "midwest",
  MN: "midwest",
  WI: "midwest",
  IN: "midwest",
  MO: "midwest",
  KS: "midwest",
  IA: "midwest",
  NE: "midwest",
  ND: "midwest",
  SD: "midwest",
  // Southwest
  AZ: "southwest",
  TX: "southwest",
  NV: "southwest",
  NM: "southwest",
  UT: "southwest",
  OK: "southwest",
  // West Coast
  CA: "westcoast",
  WA: "westcoast",
  OR: "westcoast",
  HI: "westcoast",
  // Mountain
  CO: "mountain",
  ID: "mountain",
  WY: "mountain",
  MT: "mountain",
  AK: "mountain",
};

interface Palette {
  primary: string;
  secondary: string;
  accent: string;
}

const REGION_PALETTES: Record<Region, Palette> = {
  northeast: { primary: "#475569", secondary: "#9a3412", accent: "#f5f0e8" },
  southeast: { primary: "#ea580c", secondary: "#0891b2", accent: "#d4a76a" },
  midwest: { primary: "#3b82f6", secondary: "#ca8a04", accent: "#166534" },
  southwest: { primary: "#c2410c", secondary: "#65a30d", accent: "#a16207" },
  westcoast: { primary: "#0369a1", secondary: "#059669", accent: "#94a3b8" },
  mountain: { primary: "#1d4ed8", secondary: "#f1f5f9", accent: "#15803d" },
};

// Motif shapes per region
const REGION_MOTIF: Record<Region, "circle" | "triangle" | "line"> = {
  northeast: "circle",
  southeast: "circle",
  midwest: "line",
  southwest: "triangle",
  westcoast: "circle",
  mountain: "triangle",
};

// ---------------------------------------------------------------------------
// Deterministic PRNG
// ---------------------------------------------------------------------------

function createRng(slug: string): () => number {
  let seed = 0;
  for (let i = 0; i < slug.length; i++) {
    seed = ((seed << 5) - seed + slug.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed);
  return () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Mix two hex colours by factor t (0 = a, 1 = b) */
function mixColor(a: string, b: string, t: number): string {
  const parse = (c: string) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Data extraction with fallback defaults
// ---------------------------------------------------------------------------

interface CityParams {
  slug: string;
  state: string;
  region: Region;
  palette: Palette;
  population: number;
  medianIncome: number;
  medianHomeValue: number;
  totalCrimeRate: number;
  pm25Mean: number;
  committeeCount: number;
}

function extractParams(slug: string, data: Record<string, unknown>): CityParams {
  const identity = (data.identity ?? {}) as Record<string, unknown>;
  const economy = (data.economy ?? {}) as Record<string, unknown>;
  const safety = (data.safety ?? {}) as Record<string, unknown>;
  const environment = (data.environment ?? {}) as Record<string, unknown>;
  const governance = (data.governance ?? {}) as Record<string, unknown>;

  const state = (identity.state as string) ?? "CA";
  const region = STATE_REGION[state] ?? "westcoast";
  const palette = REGION_PALETTES[region];

  return {
    slug,
    state,
    region,
    palette,
    population: (identity.population as number) ?? 50000,
    medianIncome: (economy.median_household_income as number) ?? 60000,
    medianHomeValue: (economy.median_home_value as number) ?? 300000,
    totalCrimeRate: (safety.total_crime_rate as number) ?? 3000,
    pm25Mean: (environment.pm25_mean as number) ?? 8,
    committeeCount: (governance.committee_count as number) ?? 5,
  };
}

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

const W = 1200;
const H = 400;

function generateSvg(p: CityParams): string {
  const rng = createRng(p.slug);
  const parts: string[] = [];

  // --- Population tier: 0 (tiny) to 1 (huge) ---
  const popT = clamp(Math.log10(Math.max(p.population, 100)) / 7, 0, 1); // log10(10M)=7

  // --- Income warmth: 0 (cool) to 1 (warm) ---
  const incomeT = clamp(p.medianIncome / 150000, 0, 1);

  // --- Crime angularity: 0 (round) to 1 (angular) ---
  const crimeT = clamp(p.totalCrimeRate / 10000, 0, 1);

  // --- Air quality haze: higher pm25 = more haze ---
  const hazeOpacity = clamp(p.pm25Mean / 20, 0.05, 0.45);

  // --- Committee subdivisions ---
  const subdivisions = clamp(Math.round(p.committeeCount / 4), 2, 12);

  // ===== DEFS =====
  const warmOverlay = mixColor("#3b82f6", "#f59e0b", incomeT);
  parts.push(`<defs>`);
  parts.push(
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${p.palette.accent}"/>` +
      `<stop offset="100%" stop-color="${p.palette.primary}"/>` +
      `</linearGradient>`
  );
  parts.push(
    `<linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="${warmOverlay}" stop-opacity="0.18"/>` +
      `<stop offset="100%" stop-color="${warmOverlay}" stop-opacity="0.06"/>` +
      `</linearGradient>`
  );
  parts.push(`</defs>`);

  // ===== LAYER 1: Background =====
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // ===== LAYER 2: Terrain (bezier horizon) =====
  const horizonBase = lerp(220, 280, 1 - popT); // big city → lower horizon (more skyline room)
  const segments = 8;
  const segW = W / segments;
  let pathD = `M0 ${H}`;
  // Build terrain from left to right
  const terrainPts: Array<{ x: number; y: number }> = [{ x: 0, y: horizonBase + (rng() - 0.5) * 30 }];
  for (let i = 1; i <= segments; i++) {
    const jag = popT * 40 + 10; // bigger cities = more jagged
    const y = horizonBase + (rng() - 0.5) * jag;
    terrainPts.push({ x: i * segW, y });
  }
  // Start path at bottom-left, go up to first point
  pathD = `M0 ${H} L0 ${terrainPts[0].y}`;
  for (let i = 1; i < terrainPts.length; i++) {
    const prev = terrainPts[i - 1];
    const cur = terrainPts[i];
    const cpx1 = prev.x + segW * 0.4;
    const cpy1 = prev.y + (rng() - 0.5) * 20;
    const cpx2 = cur.x - segW * 0.4;
    const cpy2 = cur.y + (rng() - 0.5) * 20;
    pathD += ` C${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
  }
  pathD += ` L${W} ${H} Z`;
  const terrainColor = mixColor(p.palette.primary, p.palette.accent, 0.35);
  parts.push(`<path d="${pathD}" fill="${terrainColor}" opacity="0.45"/>`);

  // Second terrain layer (slightly different)
  const horizon2 = horizonBase + 30;
  const terrainPts2: Array<{ x: number; y: number }> = [{ x: 0, y: horizon2 + (rng() - 0.5) * 20 }];
  for (let i = 1; i <= segments; i++) {
    terrainPts2.push({ x: i * segW, y: horizon2 + (rng() - 0.5) * 25 });
  }
  let pathD2 = `M0 ${H} L0 ${terrainPts2[0].y}`;
  for (let i = 1; i < terrainPts2.length; i++) {
    const prev = terrainPts2[i - 1];
    const cur = terrainPts2[i];
    const cpx1 = prev.x + segW * 0.35;
    const cpy1 = prev.y + (rng() - 0.5) * 15;
    const cpx2 = cur.x - segW * 0.35;
    const cpy2 = cur.y + (rng() - 0.5) * 15;
    pathD2 += ` C${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
  }
  pathD2 += ` L${W} ${H} Z`;
  parts.push(`<path d="${pathD2}" fill="${p.palette.primary}" opacity="0.3"/>`);

  // ===== LAYER 3: Architecture (rectangular blocks) =====
  const numBlocks = Math.round(lerp(3, 18, popT)); // small town = few, big city = many
  const maxBlockH = lerp(40, 180, popT); // tall blocks for big cities
  const minBlockH = lerp(15, 35, popT);
  const blockZone = W * 0.8;
  const blockStart = W * 0.1;

  for (let i = 0; i < numBlocks; i++) {
    const bw = lerp(12, 50, rng());
    const bh = lerp(minBlockH, maxBlockH, rng());
    const bx = blockStart + rng() * blockZone;
    const by = H - bh;

    // Decide corner radius based on crime (low crime = rounded, high crime = sharp)
    const cornerR = crimeT < 0.4 ? lerp(3, 8, rng()) : lerp(0, 2, rng());

    // Building colour: mix of palette secondary and primary
    const colorT = rng();
    const blockColor = mixColor(p.palette.secondary, p.palette.primary, colorT * 0.6);
    const blockOpacity = lerp(0.5, 0.85, rng());

    parts.push(
      `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${cornerR.toFixed(1)}" fill="${blockColor}" opacity="${blockOpacity.toFixed(2)}"/>`
    );

    // Occasional window dots on taller buildings (sparse to keep size down)
    if (bh > 80 && rng() > 0.55) {
      const windowRows = Math.min(4, Math.floor(bh / 25));
      const windowCols = Math.min(2, Math.max(1, Math.floor(bw / 16)));
      for (let wr = 0; wr < windowRows; wr++) {
        for (let wc = 0; wc < windowCols; wc++) {
          const wx = bx + 5 + wc * (bw / (windowCols + 1));
          const wy = by + 10 + wr * 22;
          if (wy < H - 6 && rng() > 0.4) {
            parts.push(
              `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="4" height="5" rx="0.5" fill="${p.palette.accent}" opacity="0.6"/>`
            );
          }
        }
      }
    }
  }

  // ===== LAYER 4: Detail motifs (geometric elements based on region) =====
  const motif = REGION_MOTIF[p.region];
  const numMotifs = subdivisions;

  for (let i = 0; i < numMotifs; i++) {
    const mx = rng() * W;
    const my = rng() * H * 0.6; // mostly in upper portion
    const size = lerp(3, 12, rng());
    const motifOpacity = lerp(0.15, 0.45, rng());
    const motifColor = rng() > 0.5 ? p.palette.accent : p.palette.secondary;

    if (motif === "circle") {
      parts.push(
        `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${size.toFixed(1)}" fill="${motifColor}" opacity="${motifOpacity.toFixed(2)}"/>`
      );
    } else if (motif === "triangle") {
      const x1 = mx;
      const y1 = my - size;
      const x2 = mx - size * 0.866;
      const y2 = my + size * 0.5;
      const x3 = mx + size * 0.866;
      const y3 = my + size * 0.5;
      parts.push(
        `<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}" fill="${motifColor}" opacity="${motifOpacity.toFixed(2)}"/>`
      );
    } else {
      // horizontal lines
      const lw = lerp(20, 80, rng());
      parts.push(
        `<line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${(mx + lw).toFixed(1)}" y2="${my.toFixed(1)}" stroke="${motifColor}" stroke-width="${lerp(1, 3, rng()).toFixed(1)}" opacity="${motifOpacity.toFixed(2)}"/>`
      );
    }
  }

  // ===== LAYER 5: Warm gradient overlay =====
  parts.push(`<rect width="${W}" height="${H}" fill="url(#warm)"/>`);

  // ===== LAYER 6: Haze overlay (air quality) =====
  parts.push(
    `<rect width="${W}" height="${H}" fill="${p.palette.accent}" opacity="${hazeOpacity.toFixed(2)}"/>`
  );

  // ===== Assemble =====
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    ...parts,
    `</svg>`,
  ].join("\n");

  return svg;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const citiesDir = path.resolve(__dirname, "../public/data/cities");
  const outDir = path.resolve(__dirname, "../public/illustrations");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const files = fs
    .readdirSync(citiesDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const filePath = path.join(citiesDir, file);

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      const params = extractParams(slug, data);
      const svg = generateSvg(params);
      const outPath = path.join(outDir, `${slug}.svg`);
      fs.writeFileSync(outPath, svg, "utf-8");
      generated++;
    } catch (err) {
      console.error(`[SKIP] ${slug}: ${(err as Error).message}`);
      skipped++;
    }
  }

  console.log(
    `Done. Generated ${generated} SVGs, skipped ${skipped}. Output: ${outDir}`
  );
}

main();
