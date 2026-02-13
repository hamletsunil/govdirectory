import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENTS = [
  "#6366f1", "#10997F", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6",
  "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16", "#e879f9",
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h) + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 12;
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fp = path.join(process.cwd(), "public", "data", "cities", `${slug}.json`);

  let name = slug;
  let state = "";
  let pop: string | null = null;

  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    name = data.identity?.name || slug;
    state = data.identity?.state || "";
    if (data.identity?.population) {
      const p = data.identity.population;
      pop =
        p >= 1_000_000
          ? `${(p / 1_000_000).toFixed(1)}M`
          : p >= 1_000
            ? `${Math.round(p / 1_000)}K`
            : String(p);
    }
  }

  const accent = ACCENTS[hashSlug(slug)];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0b0e14",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 14,
            color: accent,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            marginBottom: 24,
          }}
        >
          Gov Directory
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            color: "#eef0f4",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {name}
        </div>
        {state && (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#8b919e",
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              marginBottom: 32,
            }}
          >
            {state}
          </div>
        )}
        {pop && (
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 600,
              color: accent,
            }}
          >
            {pop} residents
          </div>
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 40,
            fontSize: 16,
            color: "#5a6070",
          }}
        >
          directory.myhamlet.com
        </div>
      </div>
    ),
    { ...size },
  );
}
