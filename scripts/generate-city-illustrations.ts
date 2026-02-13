/**
 * generate-city-illustrations.ts
 *
 * Generates city-specific SVG illustrations with terrain, water, landmarks,
 * vegetation, and atmospheric layers driven by city-visual-features.json.
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
// Visual features types
// ---------------------------------------------------------------------------

type Terrain = "coastal" | "mountain" | "desert" | "plains" | "lake" | "river";
type Vegetation = "palm" | "pine" | "deciduous" | "cactus" | "mixed";
type Climate = "warm" | "cold" | "temperate" | "arid" | "tropical";
type WaterFeature = "ocean" | "bay" | "lake" | "river" | "none";

interface VisualFeatures {
  stateDefaults: Record<string, {
    terrain: Terrain;
    vegetation: Vegetation;
    climate: Climate;
  }>;
  cityOverrides: Record<string, {
    terrain?: Terrain;
    vegetation?: Vegetation;
    climate?: Climate;
    waterFeature?: WaterFeature;
    landmarks?: string[];
  }>;
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

  // Resolve visual features: city override > state default > fallback
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
    vegetation: (cityOverride.vegetation ?? stateDefault.vegetation) as Vegetation,
    climate: (cityOverride.climate ?? stateDefault.climate) as Climate,
    waterFeature: (cityOverride.waterFeature ?? "none") as WaterFeature,
    landmarks: (cityOverride.landmarks ?? []) as string[],
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

// ---- Layer 1: Sky gradient ----
function drawSkyGradient(climate: Climate): string {
  let topColor: string;
  let bottomColor: string;

  switch (climate) {
    case "warm":
      topColor = "#e8f0f8";
      bottomColor = "#f5e6d8";
      break;
    case "cold":
      topColor = "#e0eaf4";
      bottomColor = "#f0f2f5";
      break;
    case "arid":
      topColor = "#f5ede0";
      bottomColor = "#ede0cc";
      break;
    case "tropical":
      topColor = "#ddf0f0";
      bottomColor = "#f0e8d8";
      break;
    case "temperate":
    default:
      topColor = "#e6ecf2";
      bottomColor = "#f0eeec";
      break;
  }

  return (
    `<defs><linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${topColor}"/>` +
    `<stop offset="100%" stop-color="${bottomColor}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#skyGrad)"/>`
  );
}

// ---- Layer 2: Far terrain ----
function drawFarTerrain(
  terrain: Terrain,
  buildingColor: string,
  rng: () => number
): string {
  const parts: string[] = [];
  const hillColor = lighten(buildingColor, 0.6);

  if (terrain === "mountain") {
    // 2-3 triangular peaks with softened vertices
    const numPeaks = 2 + Math.round(rng());
    for (let i = 0; i < numPeaks; i++) {
      const peakX = W * (0.1 + rng() * 0.8);
      const peakY = H * (0.2 + rng() * 0.25);
      const baseWidth = 200 + rng() * 300;
      const leftX = peakX - baseWidth / 2;
      const rightX = peakX + baseWidth / 2;
      const baseY = H * 0.7;
      // Bezier-softened peak
      const cpLeftX = peakX - baseWidth * 0.15;
      const cpRightX = peakX + baseWidth * 0.15;
      parts.push(
        `<path d="M${leftX.toFixed(1)} ${baseY.toFixed(1)} ` +
        `Q${cpLeftX.toFixed(1)} ${peakY.toFixed(1)} ${peakX.toFixed(1)} ${peakY.toFixed(1)} ` +
        `Q${cpRightX.toFixed(1)} ${peakY.toFixed(1)} ${rightX.toFixed(1)} ${baseY.toFixed(1)} Z" ` +
        `fill="${lighten(hillColor, 0.15)}" opacity="0.5"/>`
      );
    }
  } else if (terrain === "desert") {
    // Low sine-wave dune silhouettes
    const duneY = H * (0.55 + rng() * 0.1);
    let d = `M0 ${H}`;
    const segments = 6;
    for (let i = 0; i <= segments; i++) {
      const sx = (W / segments) * i;
      const sy = duneY + Math.sin(i * 1.2 + rng() * 3) * (15 + rng() * 20);
      if (i === 0) {
        d += ` L${sx.toFixed(1)} ${sy.toFixed(1)}`;
      } else {
        const cpx = sx - W / segments / 2;
        const cpy = sy - (8 + rng() * 15);
        d += ` Q${cpx.toFixed(1)} ${cpy.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      }
    }
    d += ` L${W} ${H} Z`;
    const sandColor = mixColor("#d4b896", hillColor, 0.3);
    parts.push(`<path d="${d}" fill="${sandColor}" opacity="0.35"/>`);
  } else if (terrain === "plains") {
    // Very gentle rolling bezier hills
    const hillBaseY = H * 0.65 + rng() * H * 0.05;
    let d = `M0 ${H} L0 ${hillBaseY.toFixed(1)}`;
    const cp1x = W * (0.2 + rng() * 0.15);
    const cp1y = hillBaseY - (10 + rng() * 15);
    const cp2x = W * (0.65 + rng() * 0.2);
    const cp2y = hillBaseY - (5 + rng() * 12);
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${W} ${hillBaseY.toFixed(1)}`;
    d += ` L${W} ${H} Z`;
    parts.push(`<path d="${d}" fill="${hillColor}" opacity="0.25"/>`);
  } else if (terrain === "river") {
    // Minimal gentle hills for river terrain
    const hillBaseY = H * 0.68 + rng() * H * 0.04;
    let d = `M0 ${H} L0 ${hillBaseY.toFixed(1)}`;
    const cp1x = W * (0.25 + rng() * 0.2);
    const cp1y = hillBaseY - (8 + rng() * 10);
    const cp2x = W * (0.6 + rng() * 0.2);
    const cp2y = hillBaseY - (5 + rng() * 8);
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${W} ${hillBaseY.toFixed(1)}`;
    d += ` L${W} ${H} Z`;
    parts.push(`<path d="${d}" fill="${hillColor}" opacity="0.2"/>`);
  }
  // coastal, lake: skip far terrain

  return parts.join("\n");
}

// ---- Layer 3: Water features ----
function drawWaterFeature(
  waterFeature: WaterFeature,
  buildingColor: string,
  rng: () => number
): string {
  if (waterFeature === "none") return "";
  const parts: string[] = [];
  const waterColor = mixColor(buildingColor, "#4a90c4", 0.6);
  const waterLight = lighten(waterColor, 0.35);

  if (waterFeature === "ocean" || waterFeature === "bay") {
    // Horizontal water band at bottom
    const waterTop = H * (0.72 + rng() * 0.06);
    const waterHeight = H - waterTop;
    parts.push(
      `<rect x="0" y="${waterTop.toFixed(1)}" width="${W}" height="${waterHeight.toFixed(1)}" fill="${waterLight}" opacity="0.6"/>`
    );
    // 2-3 subtle wave lines
    const numWaves = 2 + Math.round(rng());
    for (let i = 0; i < numWaves; i++) {
      const waveY = waterTop + (i + 1) * (waterHeight / (numWaves + 1));
      let d = `M0 ${waveY.toFixed(1)}`;
      const segs = 8;
      for (let s = 1; s <= segs; s++) {
        const sx = (W / segs) * s;
        const sy = waveY + (rng() - 0.5) * 4;
        const cpx = sx - W / segs / 2;
        const cpy = waveY + (rng() - 0.5) * 6;
        d += ` Q${cpx.toFixed(1)} ${cpy.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      }
      parts.push(
        `<path d="${d}" fill="none" stroke="${lighten(waterColor, 0.5)}" stroke-width="1" opacity="0.4"/>`
      );
    }
  } else if (waterFeature === "lake") {
    // Oval water body on one side
    const side = rng() > 0.5 ? "left" : "right";
    const lakeWidth = 200 + rng() * 150;
    const lakeHeight = 60 + rng() * 40;
    const cx = side === "left" ? 80 + rng() * 120 : W - 80 - rng() * 120;
    const cy = H * (0.72 + rng() * 0.08);
    parts.push(
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(lakeWidth / 2).toFixed(1)}" ry="${(lakeHeight / 2).toFixed(1)}" fill="${waterLight}" opacity="0.55"/>`
    );
    // One subtle wave line
    const waveY = cy;
    const startX = cx - lakeWidth / 2 + 20;
    const endX = cx + lakeWidth / 2 - 20;
    const midX = (startX + endX) / 2;
    parts.push(
      `<path d="M${startX.toFixed(1)} ${waveY.toFixed(1)} Q${midX.toFixed(1)} ${(waveY - 3).toFixed(1)} ${endX.toFixed(1)} ${waveY.toFixed(1)}" fill="none" stroke="${lighten(waterColor, 0.5)}" stroke-width="1" opacity="0.35"/>`
    );
  } else if (waterFeature === "river") {
    // Curved bezier path flowing through the scene
    const riverWidth = 30 + rng() * 20;
    const entryY = H * (0.5 + rng() * 0.3);
    const exitY = H * (0.6 + rng() * 0.25);
    const cp1x = W * (0.25 + rng() * 0.15);
    const cp1y = H * (0.45 + rng() * 0.2);
    const cp2x = W * (0.6 + rng() * 0.15);
    const cp2y = H * (0.55 + rng() * 0.2);
    // Draw as a thick path
    const d = `M0 ${entryY.toFixed(1)} C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${W} ${exitY.toFixed(1)}`;
    parts.push(
      `<path d="${d}" fill="none" stroke="${waterLight}" stroke-width="${riverWidth.toFixed(1)}" stroke-linecap="round" opacity="0.5"/>`
    );
  }

  return parts.join("\n");
}

// ---- Layer 4: Buildings ----
function drawBuildings(
  p: CityParams,
  rng: () => number
): { svg: string; buildings: Building[] } {
  const parts: string[] = [];
  const { building: buildingColor } = p.palette;

  // Population tier drives building count and max height
  let numBuildings: number;
  let maxHeightPct: number;
  const pop = p.population;

  if (pop < 10000) {
    numBuildings = 4 + Math.round(rng() * 2);
    maxHeightPct = 0.35;
  } else if (pop < 50000) {
    numBuildings = 6 + Math.round(rng() * 4);
    maxHeightPct = 0.5;
  } else if (pop < 200000) {
    numBuildings = 10 + Math.round(rng() * 5);
    maxHeightPct = 0.65;
  } else if (pop < 1000000) {
    numBuildings = 14 + Math.round(rng() * 6);
    maxHeightPct = 0.8;
  } else {
    numBuildings = 18 + Math.round(rng() * 7);
    maxHeightPct = 0.9;
  }

  // Color shades for depth layers
  const backColor = lighten(buildingColor, 0.45);
  const midColor = lighten(buildingColor, 0.2);
  const frontColor = buildingColor;

  const buildings: Building[] = [];

  // Terrain and climate modifiers for building shape
  const isDesert = p.terrain === "desert";
  const isMountainOrCold = p.terrain === "mountain" || p.climate === "cold";
  const widthMult = isDesert ? 1.3 : isMountainOrCold ? 0.8 : 1.0;
  const heightMult = isDesert ? 0.7 : isMountainOrCold ? 1.15 : 1.0;

  // Distribute buildings across rows
  const backCount = Math.max(1, Math.round(numBuildings * 0.3));
  const midCount = Math.max(1, Math.round(numBuildings * 0.35));
  const frontCount = Math.max(1, numBuildings - backCount - midCount);

  function generateRow(
    count: number,
    row: number,
    minWidthBase: number,
    maxWidthBase: number,
    minHeightPct: number,
    maxHeightPctRow: number
  ) {
    if (count === 0) return;
    const padding = 30;
    const availableWidth = W - padding * 2;
    const slotWidth = availableWidth / count;

    for (let i = 0; i < count; i++) {
      const bw = (minWidthBase + rng() * (maxWidthBase - minWidthBase)) * widthMult;
      const slotCenter = padding + slotWidth * i + slotWidth / 2;
      const offset = (rng() - 0.5) * slotWidth * 0.3;
      const bx = slotCenter - bw / 2 + offset;

      const heightPct = minHeightPct + rng() * (maxHeightPctRow - minHeightPct);
      const bh = H * heightPct * heightMult;

      buildings.push({ x: bx, width: bw, height: bh, row });
    }
  }

  generateRow(backCount, 0, 40, 90, maxHeightPct * 0.3, maxHeightPct * 0.65);
  generateRow(midCount, 1, 35, 80, maxHeightPct * 0.4, maxHeightPct * 0.85);
  generateRow(frontCount, 2, 30, 75, maxHeightPct * 0.25, maxHeightPct);

  // Sort by row (back first) so front renders on top
  buildings.sort((a, b) => a.row - b.row);

  const isBigCity = pop >= 200000;

  for (const b of buildings) {
    const color = b.row === 0 ? backColor : b.row === 1 ? midColor : frontColor;
    const bx = Math.max(0, b.x);
    const by = H - b.height;
    const roofRoll = rng();

    if (roofRoll < 0.3) {
      // Triangular rooftop
      parts.push(
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${b.width.toFixed(1)}" height="${b.height.toFixed(1)}" fill="${color}"/>`
      );
      const peakX = bx + b.width / 2;
      const peakY = by - b.width * 0.25;
      parts.push(
        `<polygon points="${bx.toFixed(1)},${by.toFixed(1)} ${peakX.toFixed(1)},${peakY.toFixed(1)} ${(bx + b.width).toFixed(1)},${by.toFixed(1)}" fill="${darken(color, 0.08)}"/>`
      );
    } else if (roofRoll < 0.5) {
      // Stepped top: two stacked rects
      const stepHeight = b.height * 0.15;
      const stepWidth = b.width * 0.65;
      const stepX = bx + (b.width - stepWidth) / 2;
      parts.push(
        `<rect x="${bx.toFixed(1)}" y="${(by + stepHeight).toFixed(1)}" width="${b.width.toFixed(1)}" height="${(b.height - stepHeight).toFixed(1)}" fill="${color}"/>`
      );
      parts.push(
        `<rect x="${stepX.toFixed(1)}" y="${by.toFixed(1)}" width="${stepWidth.toFixed(1)}" height="${stepHeight.toFixed(1)}" fill="${darken(color, 0.05)}"/>`
      );
    } else {
      // Flat top
      parts.push(
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${b.width.toFixed(1)}" height="${b.height.toFixed(1)}" fill="${color}"/>`
      );
    }

    // Window patterns on front and mid row buildings taller than 60px
    if (b.row >= 1 && b.height > 60) {
      const windowColor = lighten(color, 0.35);
      const windowW = 6;
      const windowH = 8;
      const windowGapX = 14;
      const windowGapY = 16;
      const marginX = 8;
      const marginTopY = 12;

      const cols = Math.max(1, Math.floor((b.width - marginX * 2) / windowGapX));
      const rows = Math.max(1, Math.floor((b.height - marginTopY - 10) / windowGapY));
      const maxWinRows = Math.min(rows, 6);
      const maxWinCols = Math.min(cols, 3);

      const totalWindowsWidth = maxWinCols * windowGapX - (windowGapX - windowW);
      const startX = bx + (b.width - totalWindowsWidth) / 2;

      for (let wr = 0; wr < maxWinRows; wr++) {
        for (let wc = 0; wc < maxWinCols; wc++) {
          if (rng() < 0.35) continue;
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

  return { svg: parts.join("\n"), buildings };
}

// ---- Layer 5: Landmarks ----
function drawLandmarks(
  landmarks: string[],
  waterFeature: WaterFeature,
  buildingColor: string,
  maxBuildingHeight: number,
  rng: () => number
): string {
  if (landmarks.length === 0) return "";
  const parts: string[] = [];
  const color = buildingColor;
  const lightColor = lighten(color, 0.15);

  for (const lm of landmarks) {
    switch (lm) {
      case "bridge": {
        // Two towers + catenary curve
        const bridgeX = W * (0.4 + rng() * 0.2);
        const bridgeSpan = 150 + rng() * 100;
        const towerH = 50 + rng() * 30;
        const towerY = H - towerH - 15;
        const leftX = bridgeX - bridgeSpan / 2;
        const rightX = bridgeX + bridgeSpan / 2;
        // Towers
        parts.push(
          `<rect x="${(leftX - 4).toFixed(1)}" y="${towerY.toFixed(1)}" width="8" height="${towerH.toFixed(1)}" fill="${color}"/>`
        );
        parts.push(
          `<rect x="${(rightX - 4).toFixed(1)}" y="${towerY.toFixed(1)}" width="8" height="${towerH.toFixed(1)}" fill="${color}"/>`
        );
        // Deck
        const deckY = towerY + towerH * 0.6;
        parts.push(
          `<line x1="${leftX.toFixed(1)}" y1="${deckY.toFixed(1)}" x2="${rightX.toFixed(1)}" y2="${deckY.toFixed(1)}" stroke="${color}" stroke-width="3"/>`
        );
        // Cables (catenary)
        const cableY = towerY + 5;
        const sagY = deckY - 5;
        parts.push(
          `<path d="M${leftX.toFixed(1)} ${cableY.toFixed(1)} Q${bridgeX.toFixed(1)} ${sagY.toFixed(1)} ${rightX.toFixed(1)} ${cableY.toFixed(1)}" fill="none" stroke="${lightColor}" stroke-width="1.5"/>`
        );
        break;
      }
      case "dome": {
        // Semicircle on a wide rectangle
        const domeX = W * (0.45 + rng() * 0.1);
        const domeBaseW = 50 + rng() * 20;
        const domeH = maxBuildingHeight * 0.6;
        const domeBaseH = domeH * 0.6;
        const domeTopH = domeH * 0.4;
        const domeY = H - domeBaseH - 15;
        // Base rectangle
        parts.push(
          `<rect x="${(domeX - domeBaseW / 2).toFixed(1)}" y="${domeY.toFixed(1)}" width="${domeBaseW.toFixed(1)}" height="${domeBaseH.toFixed(1)}" fill="${lightColor}"/>`
        );
        // Dome semicircle
        const domeR = domeBaseW * 0.4;
        const domeCY = domeY;
        parts.push(
          `<path d="M${(domeX - domeR).toFixed(1)} ${domeCY.toFixed(1)} A${domeR.toFixed(1)} ${domeTopH.toFixed(1)} 0 0 1 ${(domeX + domeR).toFixed(1)} ${domeCY.toFixed(1)}" fill="${darken(lightColor, 0.1)}"/>`
        );
        break;
      }
      case "port_crane": {
        // Crane near water edge
        const craneX = W * (0.15 + rng() * 0.15);
        const craneBaseY = H - 20;
        const craneH = 60 + rng() * 30;
        const armLen = 40 + rng() * 20;
        // Vertical support
        parts.push(
          `<line x1="${craneX.toFixed(1)}" y1="${craneBaseY.toFixed(1)}" x2="${craneX.toFixed(1)}" y2="${(craneBaseY - craneH).toFixed(1)}" stroke="${color}" stroke-width="3"/>`
        );
        // Arm
        parts.push(
          `<line x1="${craneX.toFixed(1)}" y1="${(craneBaseY - craneH).toFixed(1)}" x2="${(craneX + armLen).toFixed(1)}" y2="${(craneBaseY - craneH + 10).toFixed(1)}" stroke="${color}" stroke-width="2.5"/>`
        );
        // Counter-arm
        parts.push(
          `<line x1="${craneX.toFixed(1)}" y1="${(craneBaseY - craneH).toFixed(1)}" x2="${(craneX - armLen * 0.4).toFixed(1)}" y2="${(craneBaseY - craneH + 6).toFixed(1)}" stroke="${color}" stroke-width="2"/>`
        );
        break;
      }
      case "skyscraper_cluster": {
        // 3-5 very tall narrow rects grouped in center
        const numTowers = 3 + Math.round(rng() * 2);
        const clusterCenter = W * (0.45 + rng() * 0.1);
        for (let i = 0; i < numTowers; i++) {
          const tw = 15 + rng() * 10;
          const th = H * (0.7 + rng() * 0.2);
          const tx = clusterCenter - 50 + i * (100 / numTowers) + rng() * 10;
          const ty = H - th;
          parts.push(
            `<rect x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" width="${tw.toFixed(1)}" height="${th.toFixed(1)}" fill="${lighten(color, 0.1)}" opacity="0.7"/>`
          );
        }
        break;
      }
      case "mountain_backdrop": {
        // 2-3 prominent peaks behind buildings
        const numPeaks = 2 + Math.round(rng());
        for (let i = 0; i < numPeaks; i++) {
          const peakX = W * (0.15 + rng() * 0.7);
          const peakY = H * (0.08 + rng() * 0.15);
          const baseW = 250 + rng() * 250;
          const leftX = peakX - baseW / 2;
          const rightX = peakX + baseW / 2;
          const baseY = H * 0.6;
          const cpL = peakX - baseW * 0.12;
          const cpR = peakX + baseW * 0.12;
          parts.push(
            `<path d="M${leftX.toFixed(1)} ${baseY.toFixed(1)} Q${cpL.toFixed(1)} ${peakY.toFixed(1)} ${peakX.toFixed(1)} ${peakY.toFixed(1)} Q${cpR.toFixed(1)} ${peakY.toFixed(1)} ${rightX.toFixed(1)} ${baseY.toFixed(1)} Z" fill="${lighten(color, 0.55)}" opacity="0.35"/>`
          );
        }
        break;
      }
      case "hills": {
        // Multiple overlapping bezier rolling hills behind buildings
        const numHills = 3 + Math.round(rng() * 2);
        for (let i = 0; i < numHills; i++) {
          const hillCx = W * rng();
          const hillW = 200 + rng() * 300;
          const hillH = 30 + rng() * 50;
          const hillBaseY = H * 0.6 + rng() * H * 0.1;
          parts.push(
            `<ellipse cx="${hillCx.toFixed(1)}" cy="${hillBaseY.toFixed(1)}" rx="${(hillW / 2).toFixed(1)}" ry="${hillH.toFixed(1)}" fill="${lighten(color, 0.5)}" opacity="0.25"/>`
          );
        }
        break;
      }
      case "church_spire": {
        // Narrow triangle on a rectangular base, placed among buildings
        const spireX = W * (0.35 + rng() * 0.3);
        const baseW = 20 + rng() * 10;
        const baseH = 50 + rng() * 30;
        const spireW = 8;
        const spireH = 30 + rng() * 15;
        const baseY = H - baseH - 15;
        // Base rectangle
        parts.push(
          `<rect x="${(spireX - baseW / 2).toFixed(1)}" y="${baseY.toFixed(1)}" width="${baseW.toFixed(1)}" height="${baseH.toFixed(1)}" fill="${lightColor}"/>`
        );
        // Spire triangle
        const spireTopY = baseY - spireH;
        parts.push(
          `<polygon points="${(spireX - spireW / 2).toFixed(1)},${baseY.toFixed(1)} ${spireX.toFixed(1)},${spireTopY.toFixed(1)} ${(spireX + spireW / 2).toFixed(1)},${baseY.toFixed(1)}" fill="${darken(lightColor, 0.15)}"/>`
        );
        break;
      }
      case "water_tower": {
        // Circle on tripod legs
        const wtX = W * (0.6 + rng() * 0.25);
        const tankR = 10 + rng() * 5;
        const legH = 30 + rng() * 15;
        const tankCY = H - legH - tankR - 15;
        // Tank
        parts.push(
          `<circle cx="${wtX.toFixed(1)}" cy="${tankCY.toFixed(1)}" r="${tankR.toFixed(1)}" fill="${lightColor}"/>`
        );
        // Legs (tripod)
        const legBase = H - 15;
        parts.push(
          `<line x1="${wtX.toFixed(1)}" y1="${(tankCY + tankR).toFixed(1)}" x2="${(wtX - tankR).toFixed(1)}" y2="${legBase.toFixed(1)}" stroke="${color}" stroke-width="2"/>`
        );
        parts.push(
          `<line x1="${wtX.toFixed(1)}" y1="${(tankCY + tankR).toFixed(1)}" x2="${wtX.toFixed(1)}" y2="${legBase.toFixed(1)}" stroke="${color}" stroke-width="2"/>`
        );
        parts.push(
          `<line x1="${wtX.toFixed(1)}" y1="${(tankCY + tankR).toFixed(1)}" x2="${(wtX + tankR).toFixed(1)}" y2="${legBase.toFixed(1)}" stroke="${color}" stroke-width="2"/>`
        );
        break;
      }
    }
  }

  return parts.join("\n");
}

// ---- Layer 6: Vegetation ----
function drawVegetation(
  vegetation: Vegetation,
  population: number,
  buildingColor: string,
  buildings: Building[],
  rng: () => number
): string {
  const parts: string[] = [];

  // Number of trees inversely proportional to population
  let numTrees: number;
  if (population > 500000) {
    numTrees = 2 + Math.round(rng());
  } else if (population > 50000) {
    numTrees = 4 + Math.round(rng() * 2);
  } else {
    numTrees = 6 + Math.round(rng() * 2);
  }

  // Find gaps between front-row buildings for tree placement
  const frontBuildings = buildings.filter((b) => b.row === 2).sort((a, b) => a.x - b.x);
  const treePositions: number[] = [];

  if (frontBuildings.length > 1) {
    for (let i = 0; i < frontBuildings.length - 1 && treePositions.length < numTrees; i++) {
      const gap = frontBuildings[i + 1].x - (frontBuildings[i].x + frontBuildings[i].width);
      if (gap > 15) {
        treePositions.push(frontBuildings[i].x + frontBuildings[i].width + gap / 2);
      }
    }
  }
  // Fill remaining with random positions
  while (treePositions.length < numTrees) {
    treePositions.push(50 + rng() * (W - 100));
  }

  const groundY = H - 15;

  for (let i = 0; i < numTrees; i++) {
    const tx = treePositions[i];
    const vegType = vegetation === "mixed"
      ? (["palm", "pine", "deciduous", "cactus"] as Vegetation[])[Math.floor(rng() * 4)]
      : vegetation;

    switch (vegType) {
      case "palm": {
        // Curved trunk + fronds
        const trunkH = 40 + rng() * 20;
        const curve = 15 + rng() * 15;
        const topY = groundY - trunkH;
        const trunkColor = darken("#8B7355", rng() * 0.15);
        // Trunk as quadratic bezier
        parts.push(
          `<path d="M${tx.toFixed(1)} ${groundY.toFixed(1)} Q${(tx + curve).toFixed(1)} ${(groundY - trunkH / 2).toFixed(1)} ${(tx + curve * 0.7).toFixed(1)} ${topY.toFixed(1)}" fill="none" stroke="${trunkColor}" stroke-width="3"/>`
        );
        // Fronds
        const frondColor = darken("#4a8c3f", rng() * 0.1);
        const topX = tx + curve * 0.7;
        for (let f = 0; f < 5; f++) {
          const angle = -Math.PI * 0.8 + (f / 4) * Math.PI * 1.6;
          const frondLen = 18 + rng() * 12;
          const endX = topX + Math.cos(angle) * frondLen;
          const endY = topY + Math.sin(angle) * frondLen * 0.6;
          const cpfx = topX + Math.cos(angle) * frondLen * 0.6;
          const cpfy = topY + Math.sin(angle) * frondLen * 0.3 - 5;
          parts.push(
            `<path d="M${topX.toFixed(1)} ${topY.toFixed(1)} Q${cpfx.toFixed(1)} ${cpfy.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}" fill="none" stroke="${frondColor}" stroke-width="2.5"/>`
          );
        }
        break;
      }
      case "pine": {
        // Triangle on thin trunk
        const treeH = 30 + rng() * 15;
        const trunkH = 8 + rng() * 4;
        const treeW = 15 + rng() * 5;
        const topY = groundY - trunkH - treeH;
        const pineColor = darken("#2d5a27", rng() * 0.15);
        // Trunk
        parts.push(
          `<line x1="${tx.toFixed(1)}" y1="${groundY.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(groundY - trunkH).toFixed(1)}" stroke="#5c4a32" stroke-width="3"/>`
        );
        // Triangle canopy
        parts.push(
          `<polygon points="${(tx - treeW / 2).toFixed(1)},${(groundY - trunkH).toFixed(1)} ${tx.toFixed(1)},${topY.toFixed(1)} ${(tx + treeW / 2).toFixed(1)},${(groundY - trunkH).toFixed(1)}" fill="${pineColor}"/>`
        );
        break;
      }
      case "deciduous": {
        // Circle on thin trunk
        const trunkH = 10 + rng() * 6;
        const canopyR = 12 + rng() * 6;
        const canopyCY = groundY - trunkH - canopyR;
        const leafColor = darken("#5a8c4a", rng() * 0.12);
        // Trunk
        parts.push(
          `<line x1="${tx.toFixed(1)}" y1="${groundY.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(groundY - trunkH).toFixed(1)}" stroke="#6b5a42" stroke-width="3"/>`
        );
        // Canopy
        parts.push(
          `<circle cx="${tx.toFixed(1)}" cy="${canopyCY.toFixed(1)}" r="${canopyR.toFixed(1)}" fill="${leafColor}"/>`
        );
        break;
      }
      case "cactus": {
        // Vertical line with arm stubs
        const cactusH = 25 + rng() * 15;
        const topY = groundY - cactusH;
        const cactusColor = "#5a7a4a";
        parts.push(
          `<line x1="${tx.toFixed(1)}" y1="${groundY.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${topY.toFixed(1)}" stroke="${cactusColor}" stroke-width="4" stroke-linecap="round"/>`
        );
        // 1-2 arms
        const numArms = 1 + Math.round(rng());
        for (let a = 0; a < numArms; a++) {
          const armY = topY + cactusH * (0.3 + rng() * 0.3);
          const armDir = rng() > 0.5 ? 1 : -1;
          const armLen = 8 + rng() * 8;
          const armUp = 6 + rng() * 6;
          // Horizontal part
          parts.push(
            `<line x1="${tx.toFixed(1)}" y1="${armY.toFixed(1)}" x2="${(tx + armDir * armLen).toFixed(1)}" y2="${armY.toFixed(1)}" stroke="${cactusColor}" stroke-width="3" stroke-linecap="round"/>`
          );
          // Upward part
          parts.push(
            `<line x1="${(tx + armDir * armLen).toFixed(1)}" y1="${armY.toFixed(1)}" x2="${(tx + armDir * armLen).toFixed(1)}" y2="${(armY - armUp).toFixed(1)}" stroke="${cactusColor}" stroke-width="3" stroke-linecap="round"/>`
          );
        }
        break;
      }
    }
  }

  return parts.join("\n");
}

// ---- Layer 7: Ground band ----
function drawGroundBand(terrain: Terrain, waterFeature: WaterFeature): string {
  let groundColor: string;

  if (waterFeature === "ocean" || waterFeature === "bay" || terrain === "coastal") {
    groundColor = "#d4c5a9"; // sandy tan
  } else if (terrain === "desert") {
    groundColor = "#d9c4a0"; // warm sand
  } else if (terrain === "mountain") {
    groundColor = "#8a7e72"; // gray-brown
  } else if (terrain === "lake") {
    groundColor = "#8a9a82"; // gray with green tint
  } else {
    // plains, river
    groundColor = "#9aaa85"; // muted green
  }

  return `<rect x="0" y="${H - 15}" width="${W}" height="15" fill="${groundColor}" opacity="0.4"/>`;
}

// ---- Layer 8: Atmospheric details ----
function drawAtmosphere(
  climate: Climate,
  pm25Mean: number | null,
  rng: () => number
): string {
  const parts: string[] = [];

  if (climate === "cold") {
    // 1-2 light gray cloud ellipses
    const numClouds = 1 + Math.round(rng());
    for (let i = 0; i < numClouds; i++) {
      const cx = W * (0.2 + rng() * 0.6);
      const cy = H * (0.08 + rng() * 0.12);
      const rx = 60 + rng() * 80;
      const ry = 12 + rng() * 10;
      parts.push(
        `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#c8c8c8" opacity="0.15"/>`
      );
    }
  }

  if (climate === "warm" || climate === "tropical") {
    // Pale sun circle in upper-right
    const sunX = W * (0.82 + rng() * 0.1);
    const sunY = H * (0.08 + rng() * 0.08);
    const sunR = 25 + rng() * 15;
    parts.push(
      `<circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="#f5e6a0" opacity="0.1"/>`
    );
  }

  if (pm25Mean !== null && pm25Mean > 12) {
    // Haze overlay
    const opacity = Math.min(0.1, 0.05 + (pm25Mean - 12) * 0.003);
    parts.push(
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#a0a0a0" opacity="${opacity.toFixed(3)}"/>`
    );
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Main SVG assembly
// ---------------------------------------------------------------------------

function generateSvg(p: CityParams): string {
  const rng = createRng(p.slug);
  const parts: string[] = [];
  const { building: buildingColor } = p.palette;

  // Layer 1: Sky gradient
  parts.push(drawSkyGradient(p.climate));

  // Layer 2: Far terrain
  parts.push(drawFarTerrain(p.terrain, buildingColor, rng));

  // Layer 5 (early): mountain_backdrop and hills landmarks go behind buildings
  const behindLandmarks = p.landmarks.filter(
    (l) => l === "mountain_backdrop" || l === "hills"
  );
  const frontLandmarks = p.landmarks.filter(
    (l) => l !== "mountain_backdrop" && l !== "hills"
  );

  if (behindLandmarks.length > 0) {
    parts.push(
      drawLandmarks(
        behindLandmarks,
        p.waterFeature,
        buildingColor,
        H * 0.8,
        rng
      )
    );
  }

  // Layer 3: Water features (behind buildings)
  parts.push(drawWaterFeature(p.waterFeature, buildingColor, rng));

  // Layer 4: Buildings
  const { svg: buildingSvg, buildings } = drawBuildings(p, rng);
  parts.push(buildingSvg);

  // Layer 5 (front): Remaining landmarks on top of buildings
  const maxBuildingH = buildings.reduce(
    (m, b) => Math.max(m, b.height),
    0
  );
  if (frontLandmarks.length > 0) {
    parts.push(
      drawLandmarks(
        frontLandmarks,
        p.waterFeature,
        buildingColor,
        maxBuildingH,
        rng
      )
    );
  }

  // Layer 6: Vegetation
  parts.push(drawVegetation(p.vegetation, p.population, buildingColor, buildings, rng));

  // Layer 7: Ground band
  parts.push(drawGroundBand(p.terrain, p.waterFeature));

  // Layer 8: Atmosphere
  parts.push(drawAtmosphere(p.climate, p.pm25Mean, rng));

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
