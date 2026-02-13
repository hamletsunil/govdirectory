import React from "react";
import type { CityProfile } from "@/components/city/types";
import { fmtDollar } from "@/components/city/helpers";

interface BuilderPanelProps {
  profile: CityProfile;
  narrative: {
    market: string | null;
    rental: string | null;
    building: string | null;
    risk: string | null;
    quality: string | null;
  };
}

export function BuilderPanel({ profile: p, narrative }: BuilderPanelProps) {
  const hasRentData = p.housing && (p.housing.fmr_1br != null || p.housing.fmr_2br != null);
  const hasPermits = (p.development?.permits_12mo || 0) > 0;

  return (
    <section className="page-section" id="builder">
      <div className="section-inner">
        <span className="section-label">Builder</span>
        <h2 className="section-heading">Development Overview</h2>

        {narrative.market && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Market Overview</h3>
            <p className="narrative-card-text">{narrative.market}</p>
            {/* Key stat rows */}
            <div style={{ marginTop: "0.75rem" }}>
              {p.economy?.median_home_value != null && (
                <div className="builder-stat-row">
                  <span className="builder-stat-label">Median Home Value</span>
                  <span className="builder-stat-value">{fmtDollar(p.economy.median_home_value)}</span>
                </div>
              )}
              {p.economy?.homeownership_rate != null && (
                <div className="builder-stat-row">
                  <span className="builder-stat-label">Homeownership Rate</span>
                  <span className="builder-stat-value">{p.economy.homeownership_rate.toFixed(1)}%</span>
                </div>
              )}
              {p.economy?.effective_tax_rate != null && (
                <div className="builder-stat-row">
                  <span className="builder-stat-label">Effective Tax Rate</span>
                  <span className="builder-stat-value">{p.economy.effective_tax_rate.toFixed(1)}%</span>
                </div>
              )}
              {p.economy?.population_growth_cagr != null && (
                <div className="builder-stat-row">
                  <span className="builder-stat-label">Population Growth (CAGR)</span>
                  <span className="builder-stat-value">{p.economy.population_growth_cagr > 0 ? "+" : ""}{p.economy.population_growth_cagr.toFixed(2)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {narrative.rental && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Rental Market</h3>
            <p className="narrative-card-text">{narrative.rental}</p>
            {hasRentData && (
              <table className="builder-rent-table">
                <thead>
                  <tr>
                    <th>Unit Size</th>
                    <th>Fair Market Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {p.housing!.fmr_0br != null && (
                    <tr><td>Studio</td><td>{fmtDollar(p.housing!.fmr_0br)}/mo</td></tr>
                  )}
                  {p.housing!.fmr_1br != null && (
                    <tr><td>1 Bedroom</td><td>{fmtDollar(p.housing!.fmr_1br)}/mo</td></tr>
                  )}
                  {p.housing!.fmr_2br != null && (
                    <tr><td>2 Bedroom</td><td>{fmtDollar(p.housing!.fmr_2br)}/mo</td></tr>
                  )}
                  {p.housing!.fmr_3br != null && (
                    <tr><td>3 Bedroom</td><td>{fmtDollar(p.housing!.fmr_3br)}/mo</td></tr>
                  )}
                  {p.housing!.fmr_4br != null && (
                    <tr><td>4 Bedroom</td><td>{fmtDollar(p.housing!.fmr_4br)}/mo</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {narrative.building && hasPermits && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Building Activity</h3>
            <p className="narrative-card-text">{narrative.building}</p>
            {p.development?.permit_types && Object.keys(p.development.permit_types).length > 0 && (
              <div className="permit-types">
                {Object.entries(p.development.permit_types)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div key={type} className="permit-type-row">
                      <span className="permit-type-name">{type}</span>
                      <span className="permit-type-count">{count.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {narrative.risk && (
          <div className="narrative-card narrative-challenges">
            <h3 className="narrative-card-title">Risk Factors</h3>
            <p className="narrative-card-text">{narrative.risk}</p>
          </div>
        )}

        {narrative.quality && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Schools &amp; Quality of Life</h3>
            <p className="narrative-card-text">{narrative.quality}</p>
            {p.education?.avg_school_rating != null && (
              <div className="school-rating-bar">
                <div className="school-rating-fill" style={{ width: `${(p.education.avg_school_rating / 10) * 100}%` }} />
                <span className="school-rating-label">{p.education.avg_school_rating.toFixed(1)} / 10</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
