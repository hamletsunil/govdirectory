import React from "react";
import type { CityProfile } from "@/components/city/types";

interface CityGlanceProps {
  profile: CityProfile;
  health: {
    economy: string | null;
    safety: string | null;
    schools: string | null;
    civic: string | null;
    permits: string | null;
  };
  challenges: string[];
}

export function CityGlance({ profile: p, health, challenges }: CityGlanceProps) {
  const hasCivicIssues = p.civic_issues?.has_civic_issue_tracking && (p.civic_issues.total_issues || 0) > 0;
  const hasPermits = (p.development?.permits_12mo || 0) > 0;

  return (
    <section className="page-section" id="data">
      <div className="section-inner">
        <span className="section-label">City Profile</span>
        <h2 className="section-heading">{p.identity.name} at a Glance</h2>

        {health.economy && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Economy &amp; Cost of Living</h3>
            <p className="narrative-card-text">{health.economy}</p>
          </div>
        )}

        {health.safety && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Safety</h3>
            <p className="narrative-card-text">{health.safety}</p>
          </div>
        )}

        {health.schools && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Schools</h3>
            <p className="narrative-card-text">{health.schools}</p>
            {p.education?.avg_school_rating != null && (
              <div className="school-rating-bar">
                <div className="school-rating-fill" style={{ width: `${(p.education.avg_school_rating / 10) * 100}%` }} />
                <span className="school-rating-label">{p.education.avg_school_rating.toFixed(1)} / 10</span>
              </div>
            )}
          </div>
        )}

        {health.civic && hasCivicIssues && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Civic Responsiveness</h3>
            <p className="narrative-card-text">{health.civic}</p>
            {p.civic_issues!.resolution_rate != null && (
              <div className="civic-rate-bar">
                <div className="civic-rate-fill" style={{ width: `${p.civic_issues!.resolution_rate}%` }} />
                <span className="civic-rate-label">{p.civic_issues!.resolution_rate.toFixed(0)}% resolved</span>
              </div>
            )}
          </div>
        )}

        {health.permits && hasPermits && (
          <div className="narrative-card">
            <h3 className="narrative-card-title">Permits &amp; Development</h3>
            <p className="narrative-card-text">{health.permits}</p>
            {p.development?.permit_types && Object.keys(p.development.permit_types).length > 0 && (
              <div className="permit-types">
                {Object.entries(p.development.permit_types)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4)
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

        {/* Challenges */}
        {challenges.length > 0 && (
          <div className="narrative-card narrative-challenges">
            <h3 className="narrative-card-title">Worth Knowing</h3>
            {challenges.map((c, i) => (
              <p key={i} className="narrative-card-text">{c}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
