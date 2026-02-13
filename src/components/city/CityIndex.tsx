"use client";

import { useState } from "react";
import Link from "next/link";

interface CityEntry {
  slug: string;
  name: string;
  state: string;
  population: number | null;
}

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function CityIndex({ cities }: { cities: CityEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? cities.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.slug.includes(q)
        );
      })
    : cities;

  return (
    <>
      <div className="index-search">
        <input
          type="text"
          placeholder="Search cities by name or state..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="index-count">
        {filtered.length} {filtered.length === 1 ? "city" : "cities"}
        {query && " found"}
      </div>
      <div className="index-grid">
        {filtered.map((c) => (
          <Link key={c.slug} href={`/${c.slug}`} className="index-card">
            <div className="index-card-name">{c.name}</div>
            <div className="index-card-state">{c.state}</div>
            {c.population != null && (
              <div className="index-card-meta">Pop. {fmtPop(c.population)}</div>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
