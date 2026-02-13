/**
 * generate-city-illustrations.ts
 *
 * Generates Hamlet-style flat-design cityscape SVG illustrations for each city,
 * driven by city-visual-features.json. Produces warm, colorful "golden hour"
 * cityscapes with multi-color buildings, glowing windows, bezier hills, and
 * lush rounded trees.
 *
 * Usage:  npx tsx scripts/generate-city-illustrations.ts
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Region / palette definitions (kept for data extraction compatibility)
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
  northeast: { building: "#3d5a80", sky: "#e8edf2" },
  southeast: { building: "#6b705c", sky: "#ede8e0" },
  midwest: { building: "#457b9d", sky: "#e6eef4" },
  southwest: { building: "#bc6c25", sky: "#f0e6d8" },
  westcoast: { building: "#2b6777", sky: "#e0eff2" },
  mountain: { building: "#386641", sky: "#e4ede4" },
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

function mixColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function lighten(color: string, t: number): string {
  return mixColor(color, "#ffffff", t);
}

function darken(color: string, t: number): string {
  return mixColor(color, "#000000", t);
}

// ---------------------------------------------------------------------------
// Visual features types
// ---------------------------------------------------------------------------

type Terrain = "coastal" | "mountain" | "desert" | "plains" | "lake" | "river";
type Vegetation = "palm" | "pine" | "deciduous" | "cactus" | "mixed";
type Climate = "warm" | "cold" | "temperate" | "arid" | "tropical";
type WaterFeature = "ocean" | "bay" | "lake" | "river" | "none";

interface VisualFeatures {
  stateDefaults: Record<
    string,
    {
      terrain: Terrain;
      vegetation: Vegetation;
      climate: Climate;
    }
  >;
  cityOverrides: Record<
    string,
    {
      terrain?: Terrain;
      vegetation?: Vegetation;
      climate?: Climate;
      waterFeature?: WaterFeature;
      landmarks?: string[];
    }
  >;
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
  medianHomeValue: number | null;
  pm25Mean: number | null;
  terrain: Terrain;
  vegetation: Vegetation;
  climate: Climate;
  waterFeature: WaterFeature;
  landmarks: string[];
}

function extractParams(
  slug: string,
  data: Record<string, unknown>,
  features: VisualFeatures
): CityParams {
  const identity = (data.identity ?? {}) as Record<string, unknown>;
  const economy = (data.economy ?? {}) as Record<string, unknown>;
  const environment = (data.environment ?? {}) as Record<string, unknown>;
  const state = (identity.state as string) ?? "CA";
  const region = STATE_REGION[state] ?? "westcoast";
  const palette = REGION_PALETTES[region];

  const stateDefault = features.stateDefaults[state] ?? {
    terrain: "plains" as Terrain,
    vegetation: "deciduous" as Vegetation,
    climate: "temperate" as Climate,
  };
  const cityOverride = features.cityOverrides[slug] ?? {};

  return {
    slug,
    state,
    region,
    palette,
    population: (identity.population as number) ?? 50000,
    medianHomeValue: (economy.median_home_value as number) ?? null,
    pm25Mean: (environment.pm25_mean as number) ?? null,
    terrain: (cityOverride.terrain ?? stateDefault.terrain) as Terrain,
    vegetation: (cityOverride.vegetation ??
      stateDefault.vegetation) as Vegetation,
    climate: (cityOverride.climate ?? stateDefault.climate) as Climate,
    waterFeature: (cityOverride.waterFeature ?? "none") as WaterFeature,
    landmarks: (cityOverride.landmarks ?? []) as string[],
  };
}

// ---------------------------------------------------------------------------
// Hamlet-style color palettes
// ---------------------------------------------------------------------------

// Building body colors (light, cheerful Tailwind-palette colors)
const BUILDING_COLORS = [
  { id: "coral", from: "#fecaca", to: "#fca5a5" },
  { id: "teal", from: "#99f6e4", to: "#5eead4" },
  { id: "amber", from: "#fde68a", to: "#fcd34d" },
  { id: "lavender", from: "#ddd6fe", to: "#c4b5fd" },
  { id: "blue", from: "#bfdbfe", to: "#93c5fd" },
  { id: "mint", from: "#a7f3d0", to: "#6ee7b7" },
  { id: "rose", from: "#fecdd3", to: "#fda4af" },
  { id: "sky", from: "#bae6fd", to: "#7dd3fc" },
];

// Roof colors (darker, contrasting)
const ROOF_COLORS = [
  { id: "navyRoof", from: "#4338ca", to: "#3730a3" },
  { id: "coralRoof", from: "#f87171", to: "#ef4444" },
  { id: "tealRoof", from: "#2dd4bf", to: "#14b8a6" },
];

// ---------------------------------------------------------------------------
// SVG generation constants
// ---------------------------------------------------------------------------

const W = 1200;
const H = 300;

// ---------------------------------------------------------------------------
// Gradient defs builder
// ---------------------------------------------------------------------------

function buildDefs(climate: Climate, rng: () => number): string {
  const parts: string[] = [];
  parts.push("<defs>");

  // --- Sky gradient (multi-stop, climate-varied) ---
  // Base stops: indigo -> violet -> rose -> amber -> yellow -> cream
  // Shift hues based on climate
  let skyStops: { offset: string; color: string; opacity?: number }[];

  switch (climate) {
    case "warm":
    case "tropical":
      // Warmer: more rose/amber, less indigo
      skyStops = [
        { offset: "0%", color: "#a78bfa" },
        { offset: "18%", color: "#ddb4f0" },
        { offset: "35%", color: "#fda4af" },
        { offset: "52%", color: "#fdba74" },
        { offset: "72%", color: "#fef08a" },
        { offset: "100%", color: "#fef9c3" },
      ];
      break;
    case "cold":
      // Cooler: more blue/indigo, less amber
      skyStops = [
        { offset: "0%", color: "#818cf8" },
        { offset: "22%", color: "#a5b4fc" },
        { offset: "42%", color: "#c4b5fd" },
        { offset: "60%", color: "#e0c3fc" },
        { offset: "80%", color: "#fde68a" },
        { offset: "100%", color: "#fef9c3" },
      ];
      break;
    case "arid":
      // Desert sunset: more amber/gold tones
      skyStops = [
        { offset: "0%", color: "#a78bfa" },
        { offset: "15%", color: "#c4b5fd" },
        { offset: "30%", color: "#fda4af" },
        { offset: "48%", color: "#fdba74" },
        { offset: "65%", color: "#fcd34d" },
        { offset: "85%", color: "#fef08a" },
        { offset: "100%", color: "#fef9c3" },
      ];
      break;
    case "temperate":
    default:
      // Balanced golden hour
      skyStops = [
        { offset: "0%", color: "#818cf8" },
        { offset: "20%", color: "#c4b5fd" },
        { offset: "38%", color: "#fda4af" },
        { offset: "55%", color: "#fdba74" },
        { offset: "75%", color: "#fef08a" },
        { offset: "100%", color: "#fef9c3" },
      ];
      break;
  }

  parts.push(
    `<linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">`
  );
  for (const s of skyStops) {
    parts.push(
      `<stop offset="${s.offset}" stop-color="${s.color}"${s.opacity !== undefined ? ` stop-opacity="${s.opacity}"` : ""}/>`
    );
  }
  parts.push("</linearGradient>");

  // --- Building color gradients ---
  for (const bc of BUILDING_COLORS) {
    parts.push(
      `<linearGradient id="bldg_${bc.id}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${bc.from}"/>` +
        `<stop offset="100%" stop-color="${bc.to}"/>` +
        `</linearGradient>`
    );
  }

  // --- Roof color gradients ---
  for (const rc of ROOF_COLORS) {
    parts.push(
      `<linearGradient id="roof_${rc.id}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${rc.from}"/>` +
        `<stop offset="100%" stop-color="${rc.to}"/>` +
        `</linearGradient>`
    );
  }

  // --- Window glow radialGradient ---
  parts.push(
    `<radialGradient id="windowGlow" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#fef08a"/>` +
      `<stop offset="60%" stop-color="#fbbf24"/>` +
      `<stop offset="100%" stop-color="#f59e0b"/>` +
      `</radialGradient>`
  );

  // --- Hill gradients ---
  // Far hills: lavender
  parts.push(
    `<linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#c4b5fd"/>` +
      `<stop offset="100%" stop-color="#a5b4fc"/>` +
      `</linearGradient>`
  );
  // Mid hills: sage green
  parts.push(
    `<linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#86efac"/>` +
      `<stop offset="100%" stop-color="#4ade80"/>` +
      `</linearGradient>`
  );
  // Near hills: emerald
  parts.push(
    `<linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#34d399"/>` +
      `<stop offset="100%" stop-color="#10b981"/>` +
      `</linearGradient>`
  );

  // Desert hill variants (sandy)
  parts.push(
    `<linearGradient id="hillDesertFar" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#fde68a"/>` +
      `<stop offset="100%" stop-color="#fcd34d"/>` +
      `</linearGradient>`
  );
  parts.push(
    `<linearGradient id="hillDesertMid" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#fcd34d"/>` +
      `<stop offset="100%" stop-color="#fbbf24"/>` +
      `</linearGradient>`
  );
  parts.push(
    `<linearGradient id="hillDesertNear" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#fbbf24"/>` +
      `<stop offset="100%" stop-color="#f59e0b"/>` +
      `</linearGradient>`
  );

  // --- Ground gradient ---
  parts.push(
    `<linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#fef3c7"/>` +
      `<stop offset="100%" stop-color="#fde68a"/>` +
      `</linearGradient>`
  );

  // --- Water gradient ---
  parts.push(
    `<linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#bfdbfe"/>` +
      `<stop offset="100%" stop-color="#93c5fd"/>` +
      `</linearGradient>`
  );

  // --- Soft glow filter for sun ---
  parts.push(
    `<filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="12"/>` +
      `</filter>`
  );

  parts.push("</defs>");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 1: Sky
// ---------------------------------------------------------------------------

function drawSky(): string {
  return `<rect width="${W}" height="${H}" fill="url(#skyGrad)"/>`;
}

// ---------------------------------------------------------------------------
// Layer 2: Sun
// ---------------------------------------------------------------------------

function drawSun(rng: () => number): string {
  const parts: string[] = [];
  const sunX = W * (0.75 + rng() * 0.15);
  const sunY = H * (0.12 + rng() * 0.08);

  // 3 concentric circles with soft glow
  parts.push(
    `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="45" fill="#fef08a" opacity="0.12" filter="url(#softGlow)"/>`
  );
  parts.push(
    `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="30" fill="#fde68a" opacity="0.18" filter="url(#softGlow)"/>`
  );
  parts.push(
    `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="16" fill="#fef9c3" opacity="0.25" filter="url(#softGlow)"/>`
  );

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 3: Clouds
// ---------------------------------------------------------------------------

function drawClouds(climate: Climate, rng: () => number): string {
  // Only for temperate and cold climates
  if (climate !== "temperate" && climate !== "cold") return "";

  const parts: string[] = [];
  const numClouds = 2 + Math.round(rng());

  for (let i = 0; i < numClouds; i++) {
    const cx = W * (0.1 + rng() * 0.8);
    const cy = H * (0.06 + rng() * 0.12);
    const opacity = 0.4 + rng() * 0.3;
    const scale = 0.7 + rng() * 0.6;

    // Cloud = cluster of 3 overlapping ellipses
    parts.push(
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(40 * scale)}" ry="${f(14 * scale)}" fill="white" opacity="${f(opacity)}"/>`
    );
    parts.push(
      `<ellipse cx="${f(cx - 25 * scale)}" cy="${f(cy + 4 * scale)}" rx="${f(28 * scale)}" ry="${f(11 * scale)}" fill="white" opacity="${f(opacity * 0.9)}"/>`
    );
    parts.push(
      `<ellipse cx="${f(cx + 22 * scale)}" cy="${f(cy + 3 * scale)}" rx="${f(32 * scale)}" ry="${f(12 * scale)}" fill="white" opacity="${f(opacity * 0.85)}"/>`
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 4-6: Hills (3 layers)
// ---------------------------------------------------------------------------

function drawHills(
  terrain: Terrain,
  rng: () => number
): string {
  const parts: string[] = [];
  const isDesert = terrain === "desert";
  const isMountain = terrain === "mountain";

  // Helper: generate a smooth bezier hill path across the canvas
  function hillPath(
    baseY: number,
    amplitude: number,
    numPeaks: number,
    sharpness: number
  ): string {
    const points: { x: number; y: number }[] = [];
    // Start at left edge
    points.push({ x: 0, y: baseY - amplitude * (0.3 + rng() * 0.4) });

    // Generate peak points
    for (let i = 0; i < numPeaks; i++) {
      const px = (W / (numPeaks + 1)) * (i + 1) + (rng() - 0.5) * (W / (numPeaks + 1)) * 0.5;
      const py = baseY - amplitude * (0.5 + rng() * 0.5) * sharpness;
      points.push({ x: px, y: py });
    }

    // End at right edge
    points.push({ x: W, y: baseY - amplitude * (0.2 + rng() * 0.4) });

    // Build smooth cubic bezier path through points
    let d = `M0 ${H} L${f(points[0].x)} ${f(points[0].y)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpx1 = p0.x + (p1.x - p0.x) * 0.5;
      const cpy1 = p0.y;
      const cpx2 = p0.x + (p1.x - p0.x) * 0.5;
      const cpy2 = p1.y;
      d += ` C${f(cpx1)} ${f(cpy1)}, ${f(cpx2)} ${f(cpy2)}, ${f(p1.x)} ${f(p1.y)}`;
    }

    d += ` L${W} ${H} Z`;
    return d;
  }

  if (isMountain) {
    // Mountains: taller far hills with sharper peaks
    // Far: tall lavender peaks
    const farPath = hillPath(H * 0.72, H * 0.45, 3 + Math.round(rng()), 1.2);
    parts.push(
      `<path d="${farPath}" fill="url(#hillFar)" opacity="0.5"/>`
    );

    // Mid: sage green, medium height
    const midPath = hillPath(H * 0.78, H * 0.25, 2 + Math.round(rng()), 0.9);
    parts.push(
      `<path d="${midPath}" fill="url(#hillMid)" opacity="0.7"/>`
    );

    // Near: emerald, lower
    const nearPath = hillPath(H * 0.82, H * 0.15, 3 + Math.round(rng()), 0.8);
    parts.push(
      `<path d="${nearPath}" fill="url(#hillNear)" opacity="1"/>`
    );
  } else if (isDesert) {
    // Desert: gentle sandy dunes
    const farPath = hillPath(H * 0.72, H * 0.12, 3 + Math.round(rng()), 0.6);
    parts.push(
      `<path d="${farPath}" fill="url(#hillDesertFar)" opacity="0.45"/>`
    );

    const midPath = hillPath(H * 0.77, H * 0.1, 2 + Math.round(rng()), 0.5);
    parts.push(
      `<path d="${midPath}" fill="url(#hillDesertMid)" opacity="0.6"/>`
    );

    const nearPath = hillPath(H * 0.82, H * 0.08, 3 + Math.round(rng()), 0.5);
    parts.push(
      `<path d="${nearPath}" fill="url(#hillDesertNear)" opacity="0.85"/>`
    );
  } else if (terrain === "coastal") {
    // Coastal: hills on one side, tapering off
    const farPath = hillPath(H * 0.72, H * 0.18, 2 + Math.round(rng()), 0.8);
    parts.push(
      `<path d="${farPath}" fill="url(#hillFar)" opacity="0.5"/>`
    );

    const midPath = hillPath(H * 0.77, H * 0.14, 2, 0.7);
    parts.push(
      `<path d="${midPath}" fill="url(#hillMid)" opacity="0.7"/>`
    );

    const nearPath = hillPath(H * 0.82, H * 0.1, 2, 0.6);
    parts.push(
      `<path d="${nearPath}" fill="url(#hillNear)" opacity="1"/>`
    );
  } else {
    // Plains, river, lake: gentle rolling hills
    const farPath = hillPath(H * 0.7, H * 0.15, 3 + Math.round(rng()), 0.7);
    parts.push(
      `<path d="${farPath}" fill="url(#hillFar)" opacity="0.5"/>`
    );

    const midPath = hillPath(H * 0.76, H * 0.12, 2 + Math.round(rng()), 0.7);
    parts.push(
      `<path d="${midPath}" fill="url(#hillMid)" opacity="0.7"/>`
    );

    const nearPath = hillPath(H * 0.82, H * 0.09, 3 + Math.round(rng()), 0.6);
    parts.push(
      `<path d="${nearPath}" fill="url(#hillNear)" opacity="1"/>`
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 7: Water features
// ---------------------------------------------------------------------------

function drawWater(
  waterFeature: WaterFeature,
  rng: () => number
): string {
  if (waterFeature === "none") return "";
  const parts: string[] = [];

  if (waterFeature === "ocean" || waterFeature === "bay") {
    const waterTop = H * (0.7 + rng() * 0.06);
    const waterHeight = H - waterTop;
    parts.push(
      `<rect x="0" y="${f(waterTop)}" width="${W}" height="${f(waterHeight)}" fill="url(#waterGrad)" opacity="0.6"/>`
    );
    // Subtle wave lines
    const numWaves = 2 + Math.round(rng());
    for (let i = 0; i < numWaves; i++) {
      const waveY = waterTop + (i + 1) * (waterHeight / (numWaves + 1));
      let d = `M0 ${f(waveY)}`;
      const segs = 10;
      for (let s = 1; s <= segs; s++) {
        const sx = (W / segs) * s;
        const sy = waveY + (rng() - 0.5) * 3;
        const cpx = sx - W / segs / 2;
        const cpy = waveY + (rng() - 0.5) * 5;
        d += ` Q${f(cpx)} ${f(cpy)} ${f(sx)} ${f(sy)}`;
      }
      parts.push(
        `<path d="${d}" fill="none" stroke="#bfdbfe" stroke-width="1" opacity="0.5"/>`
      );
    }
  } else if (waterFeature === "lake") {
    const side = rng() > 0.5 ? "left" : "right";
    const lakeW = 220 + rng() * 160;
    const lakeH = 55 + rng() * 35;
    const cx = side === "left" ? 90 + rng() * 130 : W - 90 - rng() * 130;
    const cy = H * (0.74 + rng() * 0.06);
    parts.push(
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(lakeW / 2)}" ry="${f(lakeH / 2)}" fill="url(#waterGrad)" opacity="0.55"/>`
    );
    // Wave line
    const startX = cx - lakeW / 2 + 25;
    const endX = cx + lakeW / 2 - 25;
    const midX = (startX + endX) / 2;
    parts.push(
      `<path d="M${f(startX)} ${f(cy)} Q${f(midX)} ${f(cy - 3)} ${f(endX)} ${f(cy)}" fill="none" stroke="#bfdbfe" stroke-width="1" opacity="0.4"/>`
    );
  } else if (waterFeature === "river") {
    const riverWidth = 28 + rng() * 18;
    const entryY = H * (0.5 + rng() * 0.25);
    const exitY = H * (0.55 + rng() * 0.3);
    const cp1x = W * (0.25 + rng() * 0.15);
    const cp1y = H * (0.45 + rng() * 0.2);
    const cp2x = W * (0.6 + rng() * 0.15);
    const cp2y = H * (0.55 + rng() * 0.2);
    const d = `M0 ${f(entryY)} C${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${W} ${f(exitY)}`;
    parts.push(
      `<path d="${d}" fill="none" stroke="url(#waterGrad)" stroke-width="${f(riverWidth)}" stroke-linecap="round" opacity="0.5"/>`
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 8: Buildings (THE KEY LAYER)
// ---------------------------------------------------------------------------

interface BuildingInfo {
  x: number;
  width: number;
  height: number;
  row: number;
}

function drawBuildings(
  p: CityParams,
  rng: () => number
): { svg: string; buildings: BuildingInfo[] } {
  const parts: string[] = [];
  const pop = p.population;

  // Population tier drives building count
  let numBuildings: number;
  let maxHeightPct: number;

  if (pop < 10000) {
    numBuildings = 3 + Math.round(rng() * 2);
    maxHeightPct = 0.4;
  } else if (pop < 50000) {
    numBuildings = 5 + Math.round(rng() * 3);
    maxHeightPct = 0.5;
  } else if (pop < 200000) {
    numBuildings = 8 + Math.round(rng() * 4);
    maxHeightPct = 0.6;
  } else if (pop < 1000000) {
    numBuildings = 12 + Math.round(rng() * 6);
    maxHeightPct = 0.75;
  } else {
    numBuildings = 18 + Math.round(rng() * 7);
    maxHeightPct = 0.85;
  }

  // Terrain adjustments
  const isDesert = p.terrain === "desert";
  const isMountain = p.terrain === "mountain" || p.climate === "cold";
  const widthMult = isDesert ? 1.25 : isMountain ? 0.85 : 1.0;
  const heightMult = isDesert ? 0.75 : isMountain ? 1.1 : 1.0;

  const buildings: BuildingInfo[] = [];

  // Split into rows
  const backCount = Math.max(1, Math.round(numBuildings * 0.3));
  const midCount = Math.max(1, Math.round(numBuildings * 0.35));
  const frontCount = Math.max(1, numBuildings - backCount - midCount);

  function generateRow(
    count: number,
    row: number,
    minW: number,
    maxW: number,
    minHPct: number,
    maxHPct: number
  ) {
    const padding = 40;
    const availW = W - padding * 2;
    const slotW = availW / count;

    for (let i = 0; i < count; i++) {
      const bw = (minW + rng() * (maxW - minW)) * widthMult;
      const slotCenter = padding + slotW * i + slotW / 2;
      const offset = (rng() - 0.5) * slotW * 0.25;
      const bx = slotCenter - bw / 2 + offset;
      const heightPct = minHPct + rng() * (maxHPct - minHPct);
      const bh = H * heightPct * heightMult;

      buildings.push({ x: bx, width: bw, height: bh, row });
    }
  }

  generateRow(backCount, 0, 45, 90, maxHeightPct * 0.3, maxHeightPct * 0.6);
  generateRow(midCount, 1, 40, 80, maxHeightPct * 0.35, maxHeightPct * 0.8);
  generateRow(frontCount, 2, 35, 75, maxHeightPct * 0.3, maxHeightPct);

  // Sort back-to-front so front draws on top
  buildings.sort((a, b) => a.row - b.row);

  // Color index for cycling through building colors
  let colorIdx = Math.floor(rng() * BUILDING_COLORS.length);
  let roofColorIdx = Math.floor(rng() * ROOF_COLORS.length);

  for (const b of buildings) {
    const bx = Math.max(0, b.x);
    const by = H - b.height;
    const bw = b.width;
    const bh = b.height;

    // Pick building color (cycle so every building is different)
    const bldgColor = BUILDING_COLORS[colorIdx % BUILDING_COLORS.length];
    colorIdx++;

    // Pick roof color (different from body)
    const roofColor = ROOF_COLORS[roofColorIdx % ROOF_COLORS.length];
    roofColorIdx++;

    // Opacity varies by row for depth
    const rowOpacity = b.row === 0 ? 0.7 : b.row === 1 ? 0.85 : 1.0;

    // --- Building body ---
    parts.push(
      `<rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" rx="3" fill="url(#bldg_${bldgColor.id})" opacity="${rowOpacity}"/>`
    );

    // --- Roof ---
    const roofRoll = rng();
    if (roofRoll < 0.45) {
      // Peaked roof (triangle)
      const roofH = bw * (0.2 + rng() * 0.15);
      parts.push(
        `<polygon points="${f(bx)},${f(by)} ${f(bx + bw / 2)},${f(by - roofH)} ${f(bx + bw)},${f(by)}" fill="url(#roof_${roofColor.id})" opacity="${rowOpacity}"/>`
      );
    } else if (roofRoll < 0.65) {
      // Stepped roof
      const stepH = bh * 0.12;
      const stepW = bw * 0.6;
      const stepX = bx + (bw - stepW) / 2;
      parts.push(
        `<rect x="${f(stepX)}" y="${f(by - stepH)}" width="${f(stepW)}" height="${f(stepH)}" rx="2" fill="url(#roof_${roofColor.id})" opacity="${rowOpacity}"/>`
      );
    } else {
      // Flat roof - just a thin line on top
      parts.push(
        `<rect x="${f(bx)}" y="${f(by - 3)}" width="${f(bw)}" height="3" rx="1" fill="url(#roof_${roofColor.id})" opacity="${rowOpacity}"/>`
      );
    }

    // --- Windows (warm glow grid) ---
    if (bh > 40) {
      const winW = 6;
      const winH = 8;
      const gapX = 14;
      const gapY = 15;
      const marginX = 8;
      const marginTop = 10;

      const cols = Math.max(1, Math.min(4, Math.floor((bw - marginX * 2) / gapX)));
      const rows = Math.max(
        1,
        Math.min(8, Math.floor((bh - marginTop - 24) / gapY))
      );

      const totalWinW = cols * gapX - (gapX - winW);
      const startX = bx + (bw - totalWinW) / 2;

      for (let wr = 0; wr < rows; wr++) {
        for (let wc = 0; wc < cols; wc++) {
          // Random skip for character
          if (rng() < 0.2) continue;
          const wx = startX + wc * gapX;
          const wy = by + marginTop + wr * gapY;
          if (wy + winH < H - 22) {
            parts.push(
              `<rect x="${f(wx)}" y="${f(wy)}" width="${winW}" height="${winH}" rx="1" fill="url(#windowGlow)" opacity="${0.7 + rng() * 0.3}"/>`
            );
          }
        }
      }
    }

    // --- Door (on front row buildings) ---
    if (b.row === 2 && bh > 50) {
      const doorW = 10;
      const doorH = 16;
      const doorX = bx + bw / 2 - doorW / 2;
      const doorY = H - doorH;
      parts.push(
        `<rect x="${f(doorX)}" y="${f(doorY)}" width="${doorW}" height="${doorH}" rx="2" fill="url(#roof_navyRoof)" opacity="0.8"/>`
      );
      parts.push(
        `<rect x="${f(doorX + 2)}" y="${f(doorY + 3)}" width="${doorW - 4}" height="${doorH - 6}" rx="1" fill="url(#windowGlow)" opacity="0.45"/>`
      );
    }

    // --- Optional details on front row ---
    if (b.row >= 1 && rng() > 0.6) {
      // Awning (small trapezoid)
      const awningW = bw * 0.4;
      const awningH = 6;
      const awningX = bx + (rng() > 0.5 ? bw * 0.1 : bw * 0.5);
      const awningY = by + bh * 0.35;
      if (awningY + awningH < H - 20) {
        parts.push(
          `<path d="M${f(awningX)} ${f(awningY)} L${f(awningX + awningW)} ${f(awningY)} L${f(awningX + awningW - 3)} ${f(awningY + awningH)} L${f(awningX + 3)} ${f(awningY + awningH)} Z" fill="url(#roof_${ROOF_COLORS[(roofColorIdx + 1) % ROOF_COLORS.length].id})" opacity="${rowOpacity * 0.8}"/>`
        );
      }
    }

    if (b.row === 2 && rng() > 0.7 && bh > 60) {
      // Flower box (small rect with tiny colored circles)
      const fbW = bw * 0.35;
      const fbH = 5;
      const winRow = by + 10 + Math.floor(rng() * 2) * 15 + 8;
      const fbX = bx + bw / 2 - fbW / 2;
      if (winRow + fbH + 8 < H - 20) {
        parts.push(
          `<rect x="${f(fbX)}" y="${f(winRow + 8)}" width="${f(fbW)}" height="${fbH}" rx="1" fill="#15803d" opacity="0.7"/>`
        );
        // Tiny flowers
        const flowerColors = ["#f87171", "#fbbf24", "#a78bfa", "#fb923c"];
        for (let fl = 0; fl < 3; fl++) {
          const flx = fbX + 3 + fl * (fbW / 3);
          parts.push(
            `<circle cx="${f(flx)}" cy="${f(winRow + 7)}" r="2.5" fill="${flowerColors[Math.floor(rng() * flowerColors.length)]}" opacity="0.85"/>`
          );
        }
      }
    }
  }

  return { svg: parts.join("\n"), buildings };
}

// ---------------------------------------------------------------------------
// Layer 9: Landmarks
// ---------------------------------------------------------------------------

function drawLandmarks(
  landmarks: string[],
  waterFeature: WaterFeature,
  maxBuildingHeight: number,
  rng: () => number,
  behindBuildings: boolean
): string {
  if (landmarks.length === 0) return "";
  const parts: string[] = [];

  for (const lm of landmarks) {
    // mountain_backdrop and hills go behind buildings
    const isBehindType = lm === "mountain_backdrop" || lm === "hills";
    if (behindBuildings !== isBehindType) continue;

    switch (lm) {
      case "dome": {
        // Capitol/town-hall with dome, columns, pediment, steps
        const domeX = W * (0.43 + rng() * 0.14);
        const baseW = 60 + rng() * 20;
        const baseH = maxBuildingHeight * 0.55;
        const baseY = H - baseH;

        // Main building body
        parts.push(
          `<rect x="${f(domeX - baseW / 2)}" y="${f(baseY)}" width="${f(baseW)}" height="${f(baseH)}" rx="2" fill="#c7d2fe" opacity="0.95"/>`
        );

        // Columns (4-6 thin rects)
        const numCols = 4 + Math.round(rng() * 2);
        const colGap = (baseW - 8) / (numCols - 1);
        for (let c = 0; c < numCols; c++) {
          const cx = domeX - baseW / 2 + 4 + c * colGap;
          parts.push(
            `<rect x="${f(cx)}" y="${f(baseY + 8)}" width="3" height="${f(baseH - 16)}" fill="#818cf8" opacity="0.5"/>`
          );
        }

        // Pediment (triangle)
        const pedH = 12;
        parts.push(
          `<polygon points="${f(domeX - baseW / 2 - 3)},${f(baseY)} ${f(domeX)},${f(baseY - pedH)} ${f(domeX + baseW / 2 + 3)},${f(baseY)}" fill="#a5b4fc"/>`
        );

        // Dome (semicircle)
        const domeR = baseW * 0.3;
        const domeTopH = domeR * 0.8;
        parts.push(
          `<path d="M${f(domeX - domeR)} ${f(baseY - pedH)} A${f(domeR)} ${f(domeTopH)} 0 0 1 ${f(domeX + domeR)} ${f(baseY - pedH)}" fill="#818cf8" opacity="0.85"/>`
        );

        // Small finial on top
        parts.push(
          `<circle cx="${f(domeX)}" cy="${f(baseY - pedH - domeTopH + 2)}" r="3" fill="#fef08a" opacity="0.7"/>`
        );

        // Steps
        for (let s = 0; s < 3; s++) {
          const sw = baseW + s * 8;
          const sh = 3;
          const sy = H - s * sh;
          parts.push(
            `<rect x="${f(domeX - sw / 2)}" y="${f(sy - sh)}" width="${f(sw)}" height="${sh}" rx="1" fill="#e0e7ff" opacity="0.7"/>`
          );
        }
        break;
      }

      case "bridge": {
        // Arched bridge with cables
        const bridgeX = W * (0.38 + rng() * 0.24);
        const span = 160 + rng() * 100;
        const towerH = 55 + rng() * 30;
        const leftX = bridgeX - span / 2;
        const rightX = bridgeX + span / 2;
        const deckY = H - 30;
        const towerY = deckY - towerH;

        // Towers
        parts.push(
          `<rect x="${f(leftX - 5)}" y="${f(towerY)}" width="10" height="${f(towerH)}" rx="2" fill="url(#roof_coralRoof)"/>`
        );
        parts.push(
          `<rect x="${f(rightX - 5)}" y="${f(towerY)}" width="10" height="${f(towerH)}" rx="2" fill="url(#roof_coralRoof)"/>`
        );

        // Deck
        parts.push(
          `<line x1="${f(leftX - 15)}" y1="${f(deckY)}" x2="${f(rightX + 15)}" y2="${f(deckY)}" stroke="#f87171" stroke-width="4"/>`
        );

        // Main cables (catenary)
        const cableTopY = towerY + 5;
        const cableSagY = deckY - 8;
        parts.push(
          `<path d="M${f(leftX)} ${f(cableTopY)} Q${f(bridgeX)} ${f(cableSagY)} ${f(rightX)} ${f(cableTopY)}" fill="none" stroke="#fda4af" stroke-width="2"/>`
        );

        // Suspension cables (vertical lines from main cable to deck)
        const numCables = 6;
        for (let c = 0; c < numCables; c++) {
          const t = (c + 1) / (numCables + 1);
          const cx = leftX + t * span;
          // Approximate parabola for cable y
          const cableY = cableTopY + 4 * (cableSagY - cableTopY) * t * (1 - t) + (cableSagY - cableTopY) * (2 * t * (1 - t));
          parts.push(
            `<line x1="${f(cx)}" y1="${f(cableY + 5)}" x2="${f(cx)}" y2="${f(deckY)}" stroke="#fda4af" stroke-width="1" opacity="0.6"/>`
          );
        }
        break;
      }

      case "church_spire": {
        const spireX = W * (0.3 + rng() * 0.4);
        const baseW = 25 + rng() * 12;
        const baseH = 55 + rng() * 25;
        const baseY = H - baseH;

        // Body
        parts.push(
          `<rect x="${f(spireX - baseW / 2)}" y="${f(baseY)}" width="${f(baseW)}" height="${f(baseH)}" rx="2" fill="url(#bldg_lavender)" opacity="0.95"/>`
        );

        // Spire
        const spireH = 35 + rng() * 20;
        parts.push(
          `<polygon points="${f(spireX - 5)},${f(baseY)} ${f(spireX)},${f(baseY - spireH)} ${f(spireX + 5)},${f(baseY)}" fill="url(#roof_navyRoof)"/>`
        );

        // Cross/finial
        parts.push(
          `<line x1="${f(spireX)}" y1="${f(baseY - spireH)}" x2="${f(spireX)}" y2="${f(baseY - spireH - 8)}" stroke="#fef08a" stroke-width="2"/>`
        );
        parts.push(
          `<line x1="${f(spireX - 4)}" y1="${f(baseY - spireH - 5)}" x2="${f(spireX + 4)}" y2="${f(baseY - spireH - 5)}" stroke="#fef08a" stroke-width="2"/>`
        );

        // Window (rose window)
        parts.push(
          `<circle cx="${f(spireX)}" cy="${f(baseY + baseH * 0.25)}" r="6" fill="url(#windowGlow)" opacity="0.7"/>`
        );

        // Door
        parts.push(
          `<rect x="${f(spireX - 6)}" y="${f(H - 18)}" width="12" height="18" rx="6" fill="url(#roof_navyRoof)" opacity="0.8"/>`
        );
        break;
      }

      case "skyscraper_cluster": {
        const clusterCenter = W * (0.42 + rng() * 0.16);
        const numTowers = 3 + Math.round(rng() * 2);
        const towerColors = ["bldg_blue", "bldg_sky", "bldg_lavender", "bldg_teal", "bldg_mint"];

        for (let i = 0; i < numTowers; i++) {
          const tw = 18 + rng() * 14;
          const th = H * (0.6 + rng() * 0.3);
          const tx = clusterCenter - 60 + i * (120 / numTowers) + (rng() - 0.5) * 15;
          const ty = H - th;
          const tColor = towerColors[i % towerColors.length];

          // Tower body
          parts.push(
            `<rect x="${f(tx)}" y="${f(ty)}" width="${f(tw)}" height="${f(th)}" rx="2" fill="url(#${tColor})" opacity="0.85"/>`
          );

          // Glass windows (horizontal bands)
          const bandCount = Math.floor(th / 12);
          for (let b = 0; b < bandCount; b++) {
            const bandY = ty + 6 + b * 12;
            if (bandY + 4 < H - 10) {
              parts.push(
                `<rect x="${f(tx + 3)}" y="${f(bandY)}" width="${f(tw - 6)}" height="4" rx="0.5" fill="url(#windowGlow)" opacity="${0.4 + rng() * 0.3}"/>`
              );
            }
          }

          // Antenna on tallest
          if (i === Math.floor(numTowers / 2)) {
            parts.push(
              `<line x1="${f(tx + tw / 2)}" y1="${f(ty)}" x2="${f(tx + tw / 2)}" y2="${f(ty - 15)}" stroke="#818cf8" stroke-width="1.5"/>`
            );
            parts.push(
              `<circle cx="${f(tx + tw / 2)}" cy="${f(ty - 15)}" r="2" fill="#f87171" opacity="0.7"/>`
            );
          }
        }
        break;
      }

      case "port_crane": {
        const craneX = W * (0.12 + rng() * 0.18);
        const craneBaseY = H - 18;
        const craneH = 65 + rng() * 25;
        const armLen = 45 + rng() * 25;

        // Support structure
        parts.push(
          `<line x1="${f(craneX)}" y1="${f(craneBaseY)}" x2="${f(craneX)}" y2="${f(craneBaseY - craneH)}" stroke="#f87171" stroke-width="4"/>`
        );
        // Arm
        parts.push(
          `<line x1="${f(craneX)}" y1="${f(craneBaseY - craneH)}" x2="${f(craneX + armLen)}" y2="${f(craneBaseY - craneH + 12)}" stroke="#f87171" stroke-width="3"/>`
        );
        // Counter arm
        parts.push(
          `<line x1="${f(craneX)}" y1="${f(craneBaseY - craneH)}" x2="${f(craneX - armLen * 0.35)}" y2="${f(craneBaseY - craneH + 8)}" stroke="#f87171" stroke-width="2.5"/>`
        );
        // Counterweight
        parts.push(
          `<rect x="${f(craneX - armLen * 0.35 - 6)}" y="${f(craneBaseY - craneH + 8)}" width="12" height="8" fill="#ef4444" opacity="0.8"/>`
        );
        // Cable from arm tip
        parts.push(
          `<line x1="${f(craneX + armLen)}" y1="${f(craneBaseY - craneH + 12)}" x2="${f(craneX + armLen)}" y2="${f(craneBaseY - 10)}" stroke="#fda4af" stroke-width="1" opacity="0.6"/>`
        );
        break;
      }

      case "mountain_backdrop": {
        // Prominent peaks behind everything
        const numPeaks = 2 + Math.round(rng());
        for (let i = 0; i < numPeaks; i++) {
          const peakX = W * (0.12 + rng() * 0.76);
          const peakY = H * (0.06 + rng() * 0.14);
          const baseW = 280 + rng() * 280;
          const leftX = peakX - baseW / 2;
          const rightX = peakX + baseW / 2;
          const baseY = H * 0.6;
          const cpL = peakX - baseW * 0.13;
          const cpR = peakX + baseW * 0.13;

          // Mountain body
          parts.push(
            `<path d="M${f(leftX)} ${f(baseY)} Q${f(cpL)} ${f(peakY)} ${f(peakX)} ${f(peakY)} Q${f(cpR)} ${f(peakY)} ${f(rightX)} ${f(baseY)} Z" fill="#c4b5fd" opacity="0.35"/>`
          );

          // Snow cap
          if (rng() > 0.3) {
            const snowY = peakY + (baseY - peakY) * 0.15;
            const snowW = baseW * 0.2;
            parts.push(
              `<path d="M${f(peakX - snowW / 2)} ${f(snowY)} Q${f(peakX - snowW * 0.15)} ${f(peakY - 2)} ${f(peakX)} ${f(peakY)} Q${f(peakX + snowW * 0.15)} ${f(peakY - 2)} ${f(peakX + snowW / 2)} ${f(snowY)} Z" fill="white" opacity="0.5"/>`
            );
          }
        }
        break;
      }

      case "hills": {
        // Rolling hills behind buildings
        const numHills = 3 + Math.round(rng() * 2);
        for (let i = 0; i < numHills; i++) {
          const hillCx = W * rng();
          const hillRx = 150 + rng() * 200;
          const hillRy = 25 + rng() * 40;
          const hillCy = H * 0.6 + rng() * H * 0.08;
          parts.push(
            `<ellipse cx="${f(hillCx)}" cy="${f(hillCy)}" rx="${f(hillRx)}" ry="${f(hillRy)}" fill="url(#hillMid)" opacity="0.3"/>`
          );
        }
        break;
      }

      case "water_tower": {
        const wtX = W * (0.6 + rng() * 0.25);
        const tankR = 12 + rng() * 6;
        const legH = 35 + rng() * 15;
        const tankCY = H - legH - tankR - 15;
        const legBase = H - 15;

        // Tank
        parts.push(
          `<circle cx="${f(wtX)}" cy="${f(tankCY)}" r="${f(tankR)}" fill="url(#bldg_blue)" opacity="0.9"/>`
        );

        // Tank rim
        parts.push(
          `<ellipse cx="${f(wtX)}" cy="${f(tankCY + tankR - 2)}" rx="${f(tankR + 2)}" ry="3" fill="#93c5fd" opacity="0.6"/>`
        );

        // Legs (tripod)
        parts.push(
          `<line x1="${f(wtX - tankR * 0.6)}" y1="${f(tankCY + tankR)}" x2="${f(wtX - tankR * 1.2)}" y2="${f(legBase)}" stroke="#818cf8" stroke-width="2.5"/>`
        );
        parts.push(
          `<line x1="${f(wtX)}" y1="${f(tankCY + tankR)}" x2="${f(wtX)}" y2="${f(legBase)}" stroke="#818cf8" stroke-width="2.5"/>`
        );
        parts.push(
          `<line x1="${f(wtX + tankR * 0.6)}" y1="${f(tankCY + tankR)}" x2="${f(wtX + tankR * 1.2)}" y2="${f(legBase)}" stroke="#818cf8" stroke-width="2.5"/>`
        );
        break;
      }
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 10: Trees
// ---------------------------------------------------------------------------

function drawTrees(
  vegetation: Vegetation,
  population: number,
  buildings: BuildingInfo[],
  climate: Climate,
  rng: () => number
): string {
  const parts: string[] = [];

  // Tree count inversely proportional to population
  let numTrees: number;
  if (population > 500000) {
    numTrees = 2 + Math.round(rng());
  } else if (population > 100000) {
    numTrees = 3 + Math.round(rng() * 2);
  } else if (population > 50000) {
    numTrees = 5 + Math.round(rng() * 2);
  } else {
    numTrees = 7 + Math.round(rng() * 3);
  }

  // Find gaps between front-row buildings
  const frontBuildings = buildings
    .filter((b) => b.row === 2)
    .sort((a, b) => a.x - b.x);
  const treePositions: number[] = [];

  // Add positions in gaps between buildings
  if (frontBuildings.length > 1) {
    for (
      let i = 0;
      i < frontBuildings.length - 1 && treePositions.length < numTrees;
      i++
    ) {
      const gap =
        frontBuildings[i + 1].x -
        (frontBuildings[i].x + frontBuildings[i].width);
      if (gap > 20) {
        treePositions.push(
          frontBuildings[i].x + frontBuildings[i].width + gap / 2
        );
      }
    }
  }

  // Add edges
  if (treePositions.length < numTrees && frontBuildings.length > 0) {
    treePositions.push(frontBuildings[0].x - 20 - rng() * 30);
    const last = frontBuildings[frontBuildings.length - 1];
    treePositions.push(last.x + last.width + 20 + rng() * 30);
  }

  // Fill remaining with random positions
  while (treePositions.length < numTrees) {
    treePositions.push(40 + rng() * (W - 80));
  }

  const groundY = H - 15;
  const isWarm = climate === "warm" || climate === "tropical";
  const isArid = climate === "arid";

  for (let i = 0; i < numTrees; i++) {
    const tx = treePositions[i];
    let vegType = vegetation;
    if (vegetation === "mixed") {
      const types: Vegetation[] = ["palm", "pine", "deciduous"];
      vegType = types[Math.floor(rng() * types.length)];
    }

    switch (vegType) {
      case "palm": {
        // Curved trunk + frond arcs
        const trunkH = 42 + rng() * 22;
        const curve = 12 + rng() * 18;
        const topX = tx + curve * 0.6;
        const topY = groundY - trunkH;

        // Curved trunk (quadratic bezier)
        parts.push(
          `<path d="M${f(tx)} ${f(groundY)} Q${f(tx + curve)} ${f(groundY - trunkH / 2)} ${f(topX)} ${f(topY)}" stroke="#92400e" stroke-width="4" fill="none" stroke-linecap="round"/>`
        );

        // 5 frond arcs radiating from top
        const frondColors = ["#16a34a", "#22c55e", "#15803d", "#4ade80", "#16a34a"];
        for (let fr = 0; fr < 5; fr++) {
          const angle = -Math.PI * 0.75 + (fr / 4) * Math.PI * 1.5;
          const frondLen = 20 + rng() * 14;
          const endX = topX + Math.cos(angle) * frondLen;
          const endY = topY + Math.sin(angle) * frondLen * 0.55;
          const cpfx = topX + Math.cos(angle) * frondLen * 0.6;
          const cpfy = topY + Math.sin(angle) * frondLen * 0.25 - 6;
          parts.push(
            `<path d="M${f(topX)} ${f(topY)} Q${f(cpfx)} ${f(cpfy)} ${f(endX)} ${f(endY)}" stroke="${frondColors[fr]}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
          );
        }
        break;
      }

      case "cactus": {
        // Rounded cactus body + arms
        const cactusH = 28 + rng() * 18;
        const cactusW = 6;

        // Main trunk
        parts.push(
          `<rect x="${f(tx - cactusW / 2)}" y="${f(groundY - cactusH)}" width="${cactusW}" height="${f(cactusH)}" rx="3" fill="#16a34a"/>`
        );

        // 1-2 arms
        const numArms = 1 + Math.round(rng());
        for (let a = 0; a < numArms; a++) {
          const armY = groundY - cactusH * (0.4 + rng() * 0.3);
          const armDir = a === 0 ? -1 : 1;
          const armLen = 8 + rng() * 7;
          const armUp = 8 + rng() * 8;

          // Horizontal part
          parts.push(
            `<rect x="${f(armDir > 0 ? tx + cactusW / 2 : tx - cactusW / 2 - armLen)}" y="${f(armY - 2.5)}" width="${f(armLen)}" height="5" rx="2.5" fill="#22c55e"/>`
          );
          // Upward part
          parts.push(
            `<rect x="${f(armDir > 0 ? tx + cactusW / 2 + armLen - 2.5 : tx - cactusW / 2 - armLen)}" y="${f(armY - armUp)}" width="5" height="${f(armUp)}" rx="2.5" fill="#22c55e"/>`
          );
        }
        break;
      }

      case "pine": {
        // 2-3 stacked triangles + trunk
        const treeH = 32 + rng() * 16;
        const trunkH = 10;
        const baseW = 18 + rng() * 6;
        const topY = groundY - trunkH - treeH;

        // Trunk
        parts.push(
          `<rect x="${f(tx - 3)}" y="${f(groundY - trunkH)}" width="6" height="${f(trunkH)}" rx="2" fill="#92400e"/>`
        );

        // 3 layered triangles
        const layers = 3;
        for (let l = 0; l < layers; l++) {
          const layerY = topY + (treeH / layers) * l;
          const layerBaseY = topY + (treeH / layers) * (l + 1) + 5;
          const layerW = baseW * (0.5 + (l / layers) * 0.6);
          const color = ["#15803d", "#16a34a", "#22c55e"][l];
          parts.push(
            `<polygon points="${f(tx)},${f(layerY)} ${f(tx - layerW / 2)},${f(layerBaseY)} ${f(tx + layerW / 2)},${f(layerBaseY)}" fill="${color}" opacity="0.9"/>`
          );
        }
        break;
      }

      case "deciduous":
      default: {
        // ROUNDED tree: 2-3 overlapping circles + rect trunk
        const trunkH = 16 + rng() * 6;
        const trunkW = 6;

        // Trunk
        parts.push(
          `<rect x="${f(tx - trunkW / 2)}" y="${f(groundY - trunkH)}" width="${trunkW}" height="${f(trunkH)}" rx="2" fill="#15803d"/>`
        );

        // 3 overlapping canopy circles
        const mainR = 13 + rng() * 5;
        parts.push(
          `<circle cx="${f(tx)}" cy="${f(groundY - trunkH - mainR + 4)}" r="${f(mainR)}" fill="#22c55e" opacity="0.9"/>`
        );
        parts.push(
          `<circle cx="${f(tx - 6 - rng() * 3)}" cy="${f(groundY - trunkH - mainR + 7)}" r="${f(mainR * 0.75)}" fill="#16a34a" opacity="0.8"/>`
        );
        parts.push(
          `<circle cx="${f(tx + 5 + rng() * 3)}" cy="${f(groundY - trunkH - mainR + 8)}" r="${f(mainR * 0.7)}" fill="#15803d" opacity="0.7"/>`
        );
        break;
      }
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layer 11: Ground
// ---------------------------------------------------------------------------

function drawGround(): string {
  const groundH = 18;
  return `<rect x="0" y="${H - groundH}" width="${W}" height="${groundH}" fill="url(#groundGrad)"/>`;
}

// ---------------------------------------------------------------------------
// Layer 12: Street details
// ---------------------------------------------------------------------------

function drawStreetDetails(
  population: number,
  rng: () => number
): string {
  if (population < 50000) return "";

  const parts: string[] = [];
  const numLamps = 1 + Math.round(rng());

  for (let i = 0; i < numLamps; i++) {
    const lx = 80 + rng() * (W - 160);
    const lampBaseY = H - 18;
    const lampH = 30 + rng() * 12;
    const lampTopY = lampBaseY - lampH;

    // Pole
    parts.push(
      `<line x1="${f(lx)}" y1="${f(lampBaseY)}" x2="${f(lx)}" y2="${f(lampTopY)}" stroke="#92400e" stroke-width="2"/>`
    );

    // Lamp head
    parts.push(
      `<circle cx="${f(lx)}" cy="${f(lampTopY)}" r="4" fill="#fef08a" opacity="0.6"/>`
    );
    parts.push(
      `<circle cx="${f(lx)}" cy="${f(lampTopY)}" r="8" fill="#fef08a" opacity="0.15" filter="url(#softGlow)"/>`
    );
  }

  // Small bushes
  const numBushes = 2 + Math.round(rng() * 2);
  for (let i = 0; i < numBushes; i++) {
    const bx = 30 + rng() * (W - 60);
    const by = H - 18;
    const br = 4 + rng() * 3;
    parts.push(
      `<ellipse cx="${f(bx)}" cy="${f(by)}" rx="${f(br)}" ry="${f(br * 0.7)}" fill="#22c55e" opacity="0.6"/>`
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Helper: format number to 1 decimal
// ---------------------------------------------------------------------------

function f(n: number): string {
  return n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Main SVG assembly
// ---------------------------------------------------------------------------

function generateSvg(p: CityParams): string {
  const rng = createRng(p.slug);
  const parts: string[] = [];

  // Defs (gradients, filters)
  parts.push(buildDefs(p.climate, rng));

  // Layer 1: Sky
  parts.push(drawSky());

  // Layer 2: Sun
  parts.push(drawSun(rng));

  // Layer 3: Clouds
  parts.push(drawClouds(p.climate, rng));

  // Layer 4-6: Hills (3 layers built-in)
  parts.push(drawHills(p.terrain, rng));

  // Layer 7: Water
  parts.push(drawWater(p.waterFeature, rng));

  // Layer 9 (early): Behind-building landmarks (mountain_backdrop, hills)
  parts.push(
    drawLandmarks(p.landmarks, p.waterFeature, H * 0.7, rng, true)
  );

  // Layer 8: Buildings
  const { svg: buildingSvg, buildings } = drawBuildings(p, rng);
  parts.push(buildingSvg);

  // Layer 9 (late): Front landmarks
  const maxBH = buildings.reduce((m, b) => Math.max(m, b.height), 60);
  parts.push(
    drawLandmarks(p.landmarks, p.waterFeature, maxBH, rng, false)
  );

  // Layer 10: Trees
  parts.push(drawTrees(p.vegetation, p.population, buildings, p.climate, rng));

  // Layer 11: Ground
  parts.push(drawGround());

  // Layer 12: Street details
  parts.push(drawStreetDetails(p.population, rng));

  // Assemble
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    ...parts.filter((p) => p.length > 0),
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

  // Load visual features
  const features: VisualFeatures = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "city-visual-features.json"),
      "utf-8"
    )
  );

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
      const params = extractParams(slug, data, features);
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
