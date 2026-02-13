"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

interface CityEntry {
  slug: string;
  name: string;
  state: string;
  population: number | null;
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
};

function stateName(abbr: string): string {
  return STATE_NAMES[abbr.toUpperCase()] || abbr;
}

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function groupByState(cities: CityEntry[]): Record<string, CityEntry[]> {
  const groups: Record<string, CityEntry[]> = {};
  for (const city of cities) {
    const key = city.state || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(city);
  }
  return groups;
}

export function CityIndex({ cities }: { cities: CityEntry[] }) {
  const [query, setQuery] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!query.trim()) return cities;
    const q = query.toLowerCase();
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.slug.includes(q),
    );
  }, [cities, query]);

  const isSearching = query.trim().length > 0;

  const grouped = useMemo(() => {
    if (isSearching) return null;
    return groupByState(filtered);
  }, [filtered, isSearching]);

  const sortedStateKeys = useMemo(() => {
    if (!grouped) return [];
    return Object.keys(grouped).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const handleImgError = (slug: string) => {
    setImgErrors((prev) => new Set(prev).add(slug));
  };

  const renderCard = (c: CityEntry) => (
    <Link key={c.slug} href={`/${c.slug}`} className="card-interactive index-card">
      {!imgErrors.has(c.slug) && (
        <div className="index-card-illustration">
          <Image
            src={`/illustrations/${c.slug}.svg`}
            alt=""
            width={280}
            height={120}
            className="index-card-img"
            onError={() => handleImgError(c.slug)}
          />
        </div>
      )}
      <div className="index-card-name">{c.name}</div>
      {c.state && <div className="index-card-state">{c.state}</div>}
      {c.population != null && (
        <div className="index-card-meta">Pop. {fmtPop(c.population)}</div>
      )}
    </Link>
  );

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
        {isSearching && " found"}
      </div>

      {isSearching ? (
        <div className="index-grid">
          {filtered.map(renderCard)}
        </div>
      ) : (
        <div className="index-grouped">
          {sortedStateKeys.map((state) => (
            <div key={state} className="index-state-group">
              <h2 className="index-state-heading">{stateName(state)}</h2>
              <div className="index-grid">
                {grouped![state].map(renderCard)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
