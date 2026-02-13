/** Grid of data source availability badges with provenance info */

import type { ProvenanceSource } from "./types";

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  legistar: "Legistar (Meetings)",
  socrata: "Open Data Portal",
  census_acs: "US Census",
  arcgis: "ArcGIS/GIS",
  fbi_ucr: "FBI Crime",
  socrata_crime: "Crime Data",
  bls_laus: "BLS Employment",
  epa_aqs: "EPA Air Quality",
  nces_ccd: "Education (NCES)",
  hud_fmr: "HUD Housing",
  fema_openfema: "FEMA Disasters",
  greatschools: "GreatSchools",
  permits: "Building Permits",
  youtube_meetings: "YouTube Meetings",
  seeclickfix: "SeeClickFix (311)",
  accela: "Accela Permits",
};

interface DataSourceGridProps {
  dataSources: Record<string, string>;
  provenance?: {
    last_full_probe: string;
    sources: Record<string, ProvenanceSource>;
  };
}

export function DataSourceGrid({ dataSources, provenance }: DataSourceGridProps) {
  const entries = Object.entries(dataSources);

  return (
    <div>
      <div className="sources-grid">
        {entries.map(([key, status]) => {
          const prov = provenance?.sources?.[key];
          const dotClass = status === "available" ? "available" : status === "error" ? "error" : "unavailable";

          return (
            <div key={key} className="source-badge">
              <span className={`source-dot ${dotClass}`} />
              <span className="source-name">
                {SOURCE_DISPLAY_NAMES[key] || key}
              </span>
              {prov && (
                <span className="source-tier">
                  T{prov.authority_tier}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {provenance?.last_full_probe && (
        <p className="sources-updated">
          Last updated: {new Date(provenance.last_full_probe).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
