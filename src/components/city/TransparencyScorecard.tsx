import React from "react";
import type { CityProfile } from "@/components/city/types";

interface TransparencyScorecardProps {
  governance: CityProfile["governance"];
  transparency: string;
  legistarUrl?: string;
  cityName: string;
}

export function TransparencyScorecard({
  governance: g,
  transparency,
  legistarUrl,
  cityName,
}: TransparencyScorecardProps) {
  const hasMetrics =
    (g.agenda_availability_pct || 0) > 0 ||
    (g.minutes_availability_pct || 0) > 0 ||
    (g.video_availability_pct || 0) > 0;

  if (!hasMetrics) return null;

  return (
    <section className="page-section section-alt" id="transparency">
      <div className="section-inner">
        <span className="section-label">Transparency</span>
        <h2 className="section-heading">How Open Is {cityName}&apos;s Government?</h2>
        <p className="section-prose">{transparency}</p>

        <div className="transparency-bars">
          {(g.agenda_availability_pct || 0) > 0 && (
            <div className="transparency-row">
              <span className="transparency-label">Agendas Published</span>
              <div className="transparency-track">
                <div className="transparency-fill" style={{ width: `${Math.min(100, g.agenda_availability_pct!)}%` }} />
              </div>
              <span className="transparency-value">{g.agenda_availability_pct!.toFixed(0)}%</span>
            </div>
          )}
          {(g.minutes_availability_pct || 0) > 0 && (
            <div className="transparency-row">
              <span className="transparency-label">Minutes Available</span>
              <div className="transparency-track">
                <div className="transparency-fill" style={{ width: `${Math.min(100, g.minutes_availability_pct!)}%` }} />
              </div>
              <span className="transparency-value">{g.minutes_availability_pct!.toFixed(0)}%</span>
            </div>
          )}
          {(g.video_availability_pct || 0) > 0 && (
            <div className="transparency-row">
              <span className="transparency-label">Video Recordings</span>
              <div className="transparency-track">
                <div className="transparency-fill" style={{ width: `${Math.min(100, g.video_availability_pct!)}%` }} />
              </div>
              <span className="transparency-value">{g.video_availability_pct!.toFixed(0)}%</span>
            </div>
          )}
        </div>

        {legistarUrl && (
          <div className="section-link-row">
            <a href={legistarUrl} target="_blank" rel="noopener noreferrer" className="section-action-link">
              Explore {cityName} on Legistar &rarr;
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
