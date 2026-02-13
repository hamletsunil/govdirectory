import React from "react";
import type { CityProfile } from "@/components/city/types";
import { fmtPop, fmtDollar, fmtPct, countSources } from "@/components/city/helpers";
import { MailIcon, PlayIcon, CalendarIcon } from "@/components/city/icons";

interface CityHeroProps {
  slug: string;
  profile: CityProfile;
  cityStory: string;
  hasOfficials: boolean;
  hasVideo: boolean;
  hasActivity: boolean;
  nextMeeting?: {
    body: string | null;
    date: string | null;
    location: string | null;
  };
}

export function CityHero({
  slug,
  profile: p,
  cityStory,
  hasOfficials,
  hasVideo,
  hasActivity,
  nextMeeting,
}: CityHeroProps) {
  const srcCount = countSources(p.data_sources || {});

  return (
    <section className="hero-editorial">
      {/* Decorative city illustration */}
      <img
        src={`/illustrations/${slug}.svg`}
        alt=""
        className="hero-illustration"
      />

      <div className="hero-editorial-content">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          {srcCount} Data Sources
        </div>

        <h1 className="hero-city-name">{p.identity.name}</h1>
        <p className="hero-state-label">{p.identity.state}</p>

        <p className="hero-narrative">{cityStory}</p>

        {/* Two CTAs */}
        <div className="hero-ctas">
          {hasOfficials && (
            <a href="#representatives" className="cta-primary">
              <MailIcon className="cta-icon" />
              Contact Your Council
            </a>
          )}
          {hasVideo && (
            <a href="#watch" className="cta-secondary">
              <PlayIcon className="cta-icon" />
              Watch Latest Meeting
            </a>
          )}
          {!hasVideo && hasActivity && (
            <a href="#activity" className="cta-secondary">
              <CalendarIcon className="cta-icon" />
              Meetings &amp; Decisions
            </a>
          )}
        </div>

        {/* Next meeting callout */}
        {nextMeeting && (
          <div className="hero-next-meeting">
            Next meeting: <strong>{nextMeeting.body}</strong>
            {nextMeeting.date && (
              <> &mdash; {new Date(nextMeeting.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</>
            )}
            {nextMeeting.location && nextMeeting.location !== "phoenix.gov" && (
              <> at {nextMeeting.location}</>
            )}
          </div>
        )}

        {/* Stat ribbon */}
        <div className="hero-stats-ribbon">
          {p.identity.population != null && (
            <div className="ribbon-stat">
              <span className="ribbon-value">{fmtPop(p.identity.population)}</span>
              <span className="ribbon-label">Population</span>
            </div>
          )}
          {p.economy?.median_household_income != null && (
            <div className="ribbon-stat">
              <span className="ribbon-value">{fmtDollar(p.economy.median_household_income)}</span>
              <span className="ribbon-label">Median Income</span>
            </div>
          )}
          {p.economy?.unemployment_rate != null && (
            <div className="ribbon-stat">
              <span className="ribbon-value">{fmtPct(p.economy.unemployment_rate)}</span>
              <span className="ribbon-label">Unemployment</span>
            </div>
          )}
          {p.education?.avg_school_rating != null && (
            <div className="ribbon-stat">
              <span className="ribbon-value">{p.education.avg_school_rating.toFixed(1)}/10</span>
              <span className="ribbon-label">Schools</span>
            </div>
          )}
        </div>
      </div>

      <div className="hero-scroll-prompt">
        <span>Scroll to explore</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}
