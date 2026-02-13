/**
 * Shared utility / helper functions extracted from [slug]/page.tsx.
 *
 * Pure functions only -- no React, no DOM, no side-effects.
 */

/** Deterministic hash of a slug string, mapped to 0..11. */
export function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h) + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 12;
}

/** Format a number as a US-dollar string, e.g. "$52,300". Returns em-dash for nullish. */
export function fmtDollar(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Format a population number with K/M suffix. Returns em-dash for nullish. */
export function fmtPop(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

/** Format a number as a percentage string, e.g. "4.2%". Returns em-dash for nullish. */
export function fmtPct(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `${n.toFixed(1)}%`;
}

/** Count how many data-source entries have the value "available". */
export function countSources(ds: Record<string, string>): number {
  return Object.values(ds).filter((s) => s === "available").length;
}

/** Two-letter monogram from a person's name (first + last initial). */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Extract the 11-character YouTube video ID from a URL, or null if not found. */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/** Convert a state name to a URL-safe slug, e.g. "New York" -> "new-york". */
export function stateSlug(state: string): string {
  return state.toLowerCase().replace(/\s+/g, "-");
}
