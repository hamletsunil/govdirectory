import React from "react";
import { countSources } from "@/components/city/helpers";
import { ExternalLinkIcon } from "@/components/city/icons";

/** Top-level keys in the CityProfile schema, shown to developers. */
const SCHEMA_KEYS = [
  "identity",
  "economy",
  "safety",
  "education",
  "environment",
  "housing",
  "governance",
  "development",
  "meetings",
  "civic_issues",
  "demographics",
  "time_series",
  "data_sources",
  "provenance",
  "officials",
  "recent_meetings",
  "recent_legislation",
  "government_news",
  "video_meetings",
];

interface DeveloperPanelProps {
  slug: string;
  dataSources: Record<string, string>;
  provenanceSources: Record<string, { authority: string; probed_at: string }>;
  lastProbe?: string;
}

export function DeveloperPanel({
  slug,
  dataSources,
  provenanceSources,
  lastProbe,
}: DeveloperPanelProps) {
  const srcCount = countSources(dataSources);
  const totalKeys = Object.keys(provenanceSources).length;

  return (
    <section className="page-section" id="developer">
      <div className="section-inner">
        <span className="section-label">Developer</span>
        <h2 className="section-heading">Data Access &amp; API</h2>
        <p className="section-prose">
          All city profile data is available as static JSON. No authentication required, no rate limits. Ideal for research, civic apps, and data journalism.
        </p>

        {/* Download link */}
        <div className="narrative-card">
          <h3 className="narrative-card-title">Download JSON</h3>
          <p className="narrative-card-text">
            Full city profile with {srcCount} active data sources across {SCHEMA_KEYS.length} top-level keys.
          </p>
          <div style={{ marginTop: "0.75rem" }}>
            <a
              href={`/data/cities/${slug}.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="section-action-link"
            >
              /data/cities/{slug}.json <ExternalLinkIcon style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} />
            </a>
          </div>
        </div>

        {/* Schema overview */}
        <div className="narrative-card">
          <h3 className="narrative-card-title">Schema Overview</h3>
          <p className="narrative-card-text">
            Each city JSON file follows the <code>CityProfile</code> schema with these top-level sections:
          </p>
          <div className="permit-types" style={{ marginTop: "0.5rem" }}>
            {SCHEMA_KEYS.map((key) => (
              <div key={key} className="permit-type-row">
                <span className="permit-type-name"><code>{key}</code></span>
              </div>
            ))}
          </div>
        </div>

        {/* API info */}
        <div className="narrative-card">
          <h3 className="narrative-card-title">API Details</h3>
          <p className="narrative-card-text">
            Static JSON served from Vercel CDN. No auth needed. GET requests only.
          </p>
          <div className="permit-types" style={{ marginTop: "0.5rem" }}>
            <div className="permit-type-row">
              <span className="permit-type-name">Format</span>
              <span className="permit-type-count">JSON</span>
            </div>
            <div className="permit-type-row">
              <span className="permit-type-name">Auth</span>
              <span className="permit-type-count">None</span>
            </div>
            <div className="permit-type-row">
              <span className="permit-type-name">Rate Limit</span>
              <span className="permit-type-count">None</span>
            </div>
            <div className="permit-type-row">
              <span className="permit-type-name">Data Sources</span>
              <span className="permit-type-count">{srcCount} active</span>
            </div>
            <div className="permit-type-row">
              <span className="permit-type-name">Provenance Keys</span>
              <span className="permit-type-count">{totalKeys}</span>
            </div>
          </div>
        </div>

        {/* Provenance */}
        {lastProbe && (
          <p className="sources-updated">
            Last data probe: {new Date(lastProbe).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>
    </section>
  );
}
