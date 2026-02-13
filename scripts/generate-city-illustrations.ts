/**
 * generate-city-illustrations.ts
 *
 * Generates clean, minimalist city skyline SVG illustrations for each city.
 * Design: light backgrounds, prominent geometric building silhouettes,
 * flat 2-color palettes per region, population-driven density.
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
  building: string;
  sky: string;
}

const REGION_PALETTES: Record<Region, Palette> = {
  northeast: { building: "#3d5a80", sky: "#e8edf2" }, // slate blue
  southeast: { building: "#6b705c", sky: "#ede8e0" }, // sage/warm gray
  midwest: { building: "#457b9d", sky: "#e6eef4" }, // lake blue
  southwest: { building: "#bc6c25", sky: "#f0e6d8" }, // terracotta
  westcoast: { building: "#2b6777", sky: "#e0eff2" }, // ocean teal
  mountain: { building: "#386641", sky: "#e4ede4" }, // forest green
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
// Color helpers
// ---------------------------------------------------------------------------

function parseHex(c: string): [number, number, number] {
  return [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/** Mix two hex colors: t=0 returns a, t=1 returns b */
function mixColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t
  );
}

/** Lighten a hex color toward white by factor t (0=original, 1=white) */
function lighten(color: string, t: number): string {
  return mixColor(color, "#ffffff", t);
}

/** Darken a hex color toward black by factor t (0=original, 1=black) */
function darken(color: string, t: number): string {
  return mixColor(color, "#000000", t);
}

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

interface CityParams {
  slug: string;
  state: string;
  region: Region;
  palette: Palette;
  population: number;
}

function extractParams(
  slug: string,
  data: Record<string, unknown>
): CityParams {
  const identity = (data.identity ?? {}) as Record<string, unknown>;
  const state = (identity.state as string) ?? "CA";
  const region = STATE_REGION[state] ?? "westcoast";
  const palette = REGION_PALETTES[region];

  return {
    slug,
    state,
    region,
    palette,
    population: (identity.population as number) ?? 50000,
  };
}

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

const W = 1200;
const H = 300;

interface Building {
  x: number;
  width: number;
  height: number;
  row: number; // 0=back, 1=mid, 2=front
}

function generateSvg(p: CityParams): string {
  const rng = createRng(p.slug);
  const parts: string[] = [];

  const { building: buildingColor, sky: skyColor } = p.palette;

  // --- Population tier drives building count and max height ---
  let numBuildings: number;
  let maxHeightPct: number;
  const pop = p.population;

  if (pop < 10000) {
    numBuildings = 4 + Math.round(rng() * 2); // 4-6
    maxHeightPct = 0.35;
  } else if (pop < 50000) {
    numBuildings = 6 + Math.round(rng() * 4); // 6-10
    maxHeightPct = 0.5;
  } else if (pop < 200000) {
    numBuildings = 10 + Math.round(rng() * 5); // 10-15
    maxHeightPct = 0.65;
  } else if (pop < 1000000) {
    numBuildings = 15 + Math.round(rng() * 7); // 15-22
    maxHeightPct = 0.8;
  } else {
    numBuildings = 20 + Math.round(rng() * 10); // 20-30
    maxHeightPct = 0.9;
  }

  // Color shades for depth layers
  const backColor = lighten(buildingColor, 0.45); // lightest (back row)
  const midColor = lighten(buildingColor, 0.2); // medium
  const frontColor = buildingColor; // darkest (front row)
  const hillColor = lighten(buildingColor, 0.6); // very light for hills

  // ===== LAYER 1: Sky background =====
  parts.push(`<rect width="${W}" height="${H}" fill="${skyColor}"/>`);

  // ===== LAYER 2: Subtle hills (one gentle bezier curve) =====
  const hillBaseY = H * 0.7;
  const hillPeakOffset = 20 + rng() * 30;
  const hillCp1x = W * (0.15 + rng() * 0.2);
  const hillCp2x = W * (0.65 + rng() * 0.2);
  const hillPeak1 = hillBaseY - hillPeakOffset;
  const hillPeak2 = hillBaseY - (10 + rng() * 20);

  parts.push(
    `<path d="M0 ${H} L0 ${hillBaseY.toFixed(1)} ` +
      `C${hillCp1x.toFixed(1)} ${hillPeak1.toFixed(1)}, ` +
      `${hillCp2x.toFixed(1)} ${hillPeak2.toFixed(1)}, ` +
      `${W} ${hillBaseY.toFixed(1)} L${W} ${H} Z" ` +
      `fill="${hillColor}" opacity="0.3"/>`
  );

  // ===== LAYER 3: Buildings =====
  // Generate buildings in 3 rows (back, mid, front) for depth
  const buildings: Building[] = [];

  // Distribute buildings across rows: ~30% back, ~35% mid, ~35% front
  const backCount = Math.max(1, Math.round(numBuildings * 0.3));
  const midCount = Math.max(1, Math.round(numBuildings * 0.35));
  const frontCount = Math.max(
    1,
    numBuildings - backCount - midCount
  );

  // Helper: generate a row of buildings evenly spaced with variation
  function generateRow(
    count: number,
    row: number,
    minWidthBase: number,
    maxWidthBase: number,
    minHeightPct: number,
    maxHeightPctRow: number
  ) {
    if (count === 0) return;

    // Spread buildings across the canvas width with some padding
    const padding = 30;
    const availableWidth = W - padding * 2;
    const slotWidth = availableWidth / count;

    for (let i = 0; i < count; i++) {
      const bw =
        minWidthBase + rng() * (maxWidthBase - minWidthBase);
      // Center building in its slot with some random offset
      const slotCenter = padding + slotWidth * i + slotWidth / 2;
      const offset = (rng() - 0.5) * slotWidth * 0.3;
      const bx = slotCenter - bw / 2 + offset;

      const heightPct =
        minHeightPct + rng() * (maxHeightPctRow - minHeightPct);
      const bh = H * heightPct;

      buildings.push({ x: bx, width: bw, height: bh, row });
    }
  }

  // Back row: shorter, wider, lighter
  generateRow(
    backCount,
    0,
    40,
    90,
    maxHeightPct * 0.3,
    maxHeightPct * 0.65
  );

  // Mid row: medium height
  generateRow(
    midCount,
    1,
    35,
    80,
    maxHeightPct * 0.4,
    maxHeightPct * 0.85
  );

  // Front row: tallest, most prominent
  generateRow(
    frontCount,
    2,
    30,
    75,
    maxHeightPct * 0.25,
    maxHeightPct
  );

  // Sort by row (back first) so front renders on top
  buildings.sort((a, b) => a.row - b.row);

  const isBigCity = pop >= 200000;

  // Render each building
  for (const b of buildings) {
    const color =
      b.row === 0 ? backColor : b.row === 1 ? midColor : frontColor;
    const bx = Math.max(0, b.x);
    const by = H - b.height;

    parts.push(
      `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${b.width.toFixed(1)}" height="${b.height.toFixed(1)}" fill="${color}"/>`
    );

    // Window patterns on front and mid row buildings taller than 60px
    if (b.row >= 1 && b.height > 60) {
      const windowColor = lighten(color, 0.35);
      const windowW = 6;
      const windowH = 8;
      const windowGapX = 14;
      const windowGapY = 16;
      const marginX = 8;
      const marginTopY = 12;

      const cols = Math.max(
        1,
        Math.floor((b.width - marginX * 2) / windowGapX)
      );
      const rows = Math.max(
        1,
        Math.floor((b.height - marginTopY - 10) / windowGapY)
      );
      // Limit window rows to keep SVG small
      const maxWinRows = Math.min(rows, 12);
      const maxWinCols = Math.min(cols, 5);

      const totalWindowsWidth = maxWinCols * windowGapX - (windowGapX - windowW);
      const startX = bx + (b.width - totalWindowsWidth) / 2;

      for (let wr = 0; wr < maxWinRows; wr++) {
        for (let wc = 0; wc < maxWinCols; wc++) {
          // Skip some windows randomly for variety
          if (rng() < 0.25) continue;
          const wx = startX + wc * windowGapX;
          const wy = by + marginTopY + wr * windowGapY;
          if (wy + windowH < H - 4) {
            parts.push(
              `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${windowW}" height="${windowH}" fill="${windowColor}" opacity="0.5"/>`
            );
          }
        }
      }
    }

    // Spires/antennas on some tall buildings in big cities
    if (isBigCity && b.row === 2 && b.height > H * 0.5 && rng() > 0.6) {
      const spireH = 8 + rng() * 15;
      const spireX = bx + b.width / 2;
      const spireTop = by - spireH;
      parts.push(
        `<line x1="${spireX.toFixed(1)}" y1="${by.toFixed(1)}" x2="${spireX.toFixed(1)}" y2="${spireTop.toFixed(1)}" stroke="${color}" stroke-width="2"/>`
      );
    }
  }

  // ===== LAYER 4: Ground line =====
  // A thin ground line at the very bottom for polish
  parts.push(
    `<rect x="0" y="${H - 2}" width="${W}" height="2" fill="${darken(buildingColor, 0.1)}" opacity="0.15"/>`
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
