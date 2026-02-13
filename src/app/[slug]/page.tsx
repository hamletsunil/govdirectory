import React from "react";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { CityProfile } from "@/components/city/types";
import { DataSourceGrid } from "@/components/city/DataSourceGrid";
import { ScrollAnimator } from "@/components/city/ScrollAnimator";
import { SubscribeForm } from "@/components/city/SubscribeForm";
import {
  generateCityStory,
  generateGovernmentIntro,
  generateActivitySummary,
  generateCityHealth,
  generateChallenges,
  generateTransparency,
} from "@/lib/narrative";

/* ── Helpers ── */

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h) + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 12;
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtPop(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `${n.toFixed(1)}%`;
}

function countSources(ds: Record<string, string>): number {
  return Object.values(ds).filter((s) => s === "available").length;
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function stateSlug(state: string): string {
  return state.toLowerCase().replace(/\s+/g, "-");
}

interface ResidentResource {
  title: string;
  description: string;
  url: string;
  icon: "vote" | "calendar" | "gavel" | "people" | "search" | "video" | "alert" | "building";
  external?: boolean;
}

function getResidentResources(p: CityProfile): ResidentResource[] {
  const resources: ResidentResource[] = [];
  const name = p.identity.name;
  const st = p.identity.state;

  // Official city website (first — most useful)
  if (p.city_website) {
    resources.push({
      title: "Official Website",
      description: `${name}'s official government website`,
      url: p.city_website,
      icon: "building",
      external: true,
    });
  }

  // Register to vote (universal)
  if (st) {
    resources.push({
      title: "Register to Vote",
      description: `Check your registration or register in ${st}`,
      url: `https://vote.org/register-to-vote/${stateSlug(st)}/`,
      icon: "vote",
      external: true,
    });
  }

  // Meeting calendar (Legistar)
  if (p.legistar_url) {
    resources.push({
      title: "Meeting Calendar",
      description: `Upcoming ${name} council and committee meetings`,
      url: `${p.legistar_url}/Calendar.aspx`,
      icon: "calendar",
      external: true,
    });
  }

  // Contact officials (anchor or Legistar)
  if ((p.officials?.members?.length || 0) > 0) {
    resources.push({
      title: "Contact Officials",
      description: `Email your ${p.officials?.body_name?.replace(/^\*\s*/, "") || "council"} members`,
      url: "#representatives",
      icon: "people",
    });
  } else if (p.legistar_url) {
    resources.push({
      title: "Find Officials",
      description: `${name} elected officials and staff`,
      url: `${p.legistar_url}/People`,
      icon: "people",
      external: true,
    });
  }

  // Browse legislation (Legistar)
  if (p.legistar_url) {
    resources.push({
      title: "Browse Legislation",
      description: "Ordinances, resolutions, and pending items",
      url: `${p.legistar_url}/Legislation`,
      icon: "gavel",
      external: true,
    });
  }

  // Search meeting records (Hamlet)
  resources.push({
    title: "Search Meetings",
    description: `Search transcripts and agendas from ${name}`,
    url: `https://myhamlet.com/search?q=${encodeURIComponent(name)}`,
    icon: "search",
    external: true,
  });

  // Watch meetings (if video available)
  if ((p.video_meetings?.length || 0) > 0) {
    resources.push({
      title: "Watch Meetings",
      description: "Recorded council and committee sessions",
      url: "#watch",
      icon: "video",
    });
  }

  // Report an issue (SeeClickFix)
  if (p.civic_issues?.has_civic_issue_tracking) {
    resources.push({
      title: "Report an Issue",
      description: "Potholes, streetlights, noise — report to the city",
      url: `https://seeclickfix.com/web_portal/search?keyword=${encodeURIComponent(name + " " + (st || ""))}`,
      icon: "alert",
      external: true,
    });
  }

  return resources;
}

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  vote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  gavel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><line x1="8" y1="6" x2="8" y2="6.01" /><line x1="16" y1="6" x2="16" y2="6.01" /><line x1="12" y1="6" x2="12" y2="6.01" /><line x1="8" y1="10" x2="8" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="12" y1="10" x2="12" y2="10.01" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" />
    </svg>
  ),
};

/* ── Data Loading ── */

function loadProfile(slug: string): CityProfile | null {
  const fp = path.join(process.cwd(), "public", "data", "cities", `${slug}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), "public", "data", "cities");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => ({ slug: f.replace(".json", "") }));
}

/* ── Page ── */

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = loadProfile(slug);
  if (!p) notFound();

  const accentClass = `accent-${hashSlug(slug)}`;
  const srcCount = countSources(p.data_sources || {});

  // Generate narratives
  const cityStory = generateCityStory(p);
  const govIntro = generateGovernmentIntro(p);
  const activitySummary = generateActivitySummary(p);
  const health = generateCityHealth(p);
  const challenges = generateChallenges(p);
  const transparency = generateTransparency(p);

  // Derived data
  const allOfficials = p.officials?.members || [];
  const hasOfficials = allOfficials.length > 0;
  const MAX_OFFICIALS = 12;
  const showAllOfficials = allOfficials.length <= MAX_OFFICIALS;
  const displayedOfficials = showAllOfficials ? allOfficials : allOfficials.slice(0, MAX_OFFICIALS);
  const hasMeetings = (p.recent_meetings?.length || 0) > 0;
  // Filter out test/bogus legislation (dates in far future)
  const validLegislation = (p.recent_legislation || []).filter(l => {
    if (!l.intro_date) return true;
    const year = parseInt(l.intro_date.substring(0, 4), 10);
    return year <= new Date().getFullYear() + 1;
  });
  const hasLegislation = validLegislation.length > 0;
  const hasVideo = (p.video_meetings?.length || 0) > 0;
  const hasNews = (p.government_news?.length || 0) > 0;
  const hasCivicIssues = p.civic_issues?.has_civic_issue_tracking && (p.civic_issues.total_issues || 0) > 0;
  const hasPermits = (p.development?.permits_12mo || 0) > 0;
  const hasActivity = hasMeetings || hasLegislation || hasNews;

  const upcoming = p.recent_meetings?.filter(m => m.upcoming) || [];
  const recent = p.recent_meetings?.filter(m => !m.upcoming) || [];

  // First video with YouTube URL
  const primaryVideo = p.video_meetings?.find(v => v.is_youtube && v.video_url);
  const primaryVideoId = primaryVideo?.video_url ? extractYouTubeId(primaryVideo.video_url) : null;
  const otherVideos = p.video_meetings?.filter(v => v !== primaryVideo && v.is_youtube).slice(0, 4) || [];

  // Next upcoming meeting
  const nextMeeting = upcoming[0];

  // Resident resources
  const resources = getResidentResources(p);

  return (
    <div className={accentClass}>
      <ScrollAnimator />

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: HERO — The Living Letterhead (100vh)
          ═══════════════════════════════════════════════════════════ */}
      <section className="hero-editorial">
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="hero-glow" />
        </div>

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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cta-icon">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Contact Your Council
              </a>
            )}
            {hasVideo && (
              <a href="#watch" className="cta-secondary">
                <svg viewBox="0 0 24 24" fill="currentColor" className="cta-icon">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Watch Latest Meeting
              </a>
            )}
            {!hasVideo && hasActivity && (
              <a href="#activity" className="cta-secondary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cta-icon">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
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

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2: RESIDENT RESOURCES — Quick Actions (light)
          ═══════════════════════════════════════════════════════════ */}
      {resources.length > 0 && (
        <section className="page-section section-light" id="resources">
          <div className="section-inner">
            <span className="section-label">Quick Links</span>
            <h2 className="section-heading">What Can You Do in {p.identity.name}?</h2>
            <p className="section-prose section-prose-dark">
              Your starting point for civic participation — register to vote, attend a meeting, browse legislation, or contact your representatives.
            </p>

            <div className="resource-grid">
              {resources.map((r) => {
                const isExternal = r.external;
                return (
                  <a
                    key={r.title}
                    href={r.url}
                    className="resource-card"
                    {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <div className="resource-icon">
                      {RESOURCE_ICONS[r.icon]}
                    </div>
                    <div className="resource-content">
                      <div className="resource-title">
                        {r.title}
                        {isExternal && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="resource-external-icon">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        )}
                      </div>
                      <div className="resource-desc">{r.description}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: YOUR REPRESENTATIVES (dark)
          ═══════════════════════════════════════════════════════════ */}
      {hasOfficials && (
        <section className="page-section section-dark" id="representatives">
          <div className="section-inner">
            <span className="section-label">Your Government</span>
            <h2 className="section-heading">Meet Your Representatives</h2>
            <p className="section-prose">{govIntro}</p>

            <div className="officials-grid">
              {displayedOfficials.map((m) => (
                <div key={m.name} className="official-card-v2">
                  <div className="official-monogram">{monogram(m.name)}</div>
                  <div className="official-info">
                    <div className="official-name-v2">{m.name}</div>
                    {m.title && <div className="official-role">{m.title}</div>}
                    {m.start_date && (
                      <div className="official-tenure">
                        Since {new Date(m.start_date + "T12:00:00").getFullYear()}
                      </div>
                    )}
                  </div>
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className="official-email-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Email
                    </a>
                  ) : (
                    <span className="official-no-email">No public email</span>
                  )}
                </div>
              ))}
            </div>

            {!showAllOfficials && p.legistar_url && (
              <div className="section-link-row">
                <a href={`${p.legistar_url}/People`} target="_blank" rel="noopener noreferrer" className="section-action-link">
                  View all {allOfficials.length} members &rarr;
                </a>
              </div>
            )}

            {p.legistar_url && (
              <div className="section-link-row">
                <a href={p.legistar_url} target="_blank" rel="noopener noreferrer" className="section-action-link">
                  View full records on Legistar &rarr;
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: WHAT'S HAPPENING (light)
          ═══════════════════════════════════════════════════════════ */}
      {hasActivity && (
        <section className="page-section section-light" id="activity">
          <div className="section-inner">
            <span className="section-label">Activity</span>
            <h2 className="section-heading">What&apos;s Happening in {p.identity.name}</h2>
            <p className="section-prose section-prose-dark">{activitySummary}</p>

            {/* Upcoming meetings */}
            {upcoming.length > 0 && (
              <div className="activity-group">
                <h3 className="activity-group-title">Upcoming Meetings</h3>
                <div className="activity-list">
                  {upcoming.slice(0, 3).map((m, i) => (
                    <div key={`up-${i}`} className="activity-item activity-upcoming">
                      <div className="activity-date-badge">
                        {m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                      </div>
                      <div className="activity-details">
                        <div className="activity-title">{m.body}</div>
                        {m.location && <div className="activity-meta">{m.location}</div>}
                      </div>
                      <div className="activity-actions">
                        {m.has_agenda && m.agenda_url && (
                          <a href={m.agenda_url} target="_blank" rel="noopener noreferrer" className="activity-action-btn">View Agenda</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent meetings */}
            {recent.length > 0 && (
              <div className="activity-group">
                <h3 className="activity-group-title">Recent Meetings</h3>
                <div className="activity-list">
                  {recent.slice(0, 3).map((m, i) => (
                    <div key={`rec-${i}`} className="activity-item">
                      <div className="activity-date-badge">
                        {m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                      </div>
                      <div className="activity-details">
                        <div className="activity-title">{m.body}</div>
                      </div>
                      <div className="activity-badges">
                        {m.has_agenda && <span className="activity-badge badge-agenda">Agenda</span>}
                        {m.has_minutes && <span className="activity-badge badge-minutes">Minutes</span>}
                        {m.has_video && <span className="activity-badge badge-video">Video</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legislation */}
            {hasLegislation && (
              <div className="activity-group">
                <h3 className="activity-group-title">Recent Legislation</h3>
                <div className="activity-list">
                  {validLegislation.slice(0, 4).map((l, i) => (
                    <div key={`leg-${i}`} className="activity-item legislation-item-v2">
                      <span className={`legis-status-badge status-${l.status?.toLowerCase().replace(/[^a-z]/g, "-").replace(/-+/g, "-")}`}>
                        {l.status?.includes("Passed") || l.status?.includes("Adopted") ? "Passed"
                          : l.status?.includes("Committee") ? "In Committee"
                          : l.status?.includes("Ready") ? "Pending"
                          : l.status || "Filed"}
                      </span>
                      <div className="activity-details">
                        <div className="legislation-title-v2">{l.title}</div>
                        <div className="activity-meta">
                          {l.type}
                          {l.file_number && <> &middot; {l.file_number}</>}
                          {l.intro_date && (
                            <> &middot; {new Date(l.intro_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {p.legistar_url && (
                  <div className="section-link-row">
                    <a href={`${p.legistar_url}/Legislation`} target="_blank" rel="noopener noreferrer" className="section-action-link section-action-link-dark">
                      Browse all legislation &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* News */}
            {hasNews && (
              <div className="activity-group">
                <h3 className="activity-group-title">City Hall News</h3>
                <div className="activity-list">
                  {p.government_news!.slice(0, 3).map((n, i) => (
                    <a key={`news-${i}`} href={n.url || "#"} target="_blank" rel="noopener noreferrer" className="activity-item news-item-v2">
                      <div className="activity-details">
                        <div className="activity-title">{n.title}</div>
                        {n.date && (
                          <div className="activity-meta">
                            {new Date(n.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: WATCH YOUR GOVERNMENT (dark, embedded video)
          ═══════════════════════════════════════════════════════════ */}
      {hasVideo && primaryVideoId && (
        <section className="page-section section-dark video-section" id="watch">
          <div className="section-inner">
            <span className="section-label">Watch</span>
            <h2 className="section-heading">Watch Your Government in Action</h2>

            <div className="video-embed">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${primaryVideoId}?rel=0&modestbranding=1`}
                title={primaryVideo!.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="video-caption">
              <strong>{primaryVideo!.title}</strong>
              {primaryVideo!.date && (
                <span> &middot; {new Date(primaryVideo!.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              )}
            </div>

            {otherVideos.length > 0 && (
              <div className="video-thumbnail-row">
                {otherVideos.map((v, i) => {
                  const vid = v.video_url ? extractYouTubeId(v.video_url) : null;
                  return (
                    <a key={i} href={v.video_url || "#"} target="_blank" rel="noopener noreferrer" className="video-thumb">
                      {vid && (
                        <img
                          src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
                          alt={v.title}
                          className="video-thumb-img"
                          loading="lazy"
                        />
                      )}
                      <div className="video-thumb-info">
                        <div className="video-thumb-title">{v.title}</div>
                        {v.date && (
                          <div className="video-thumb-date">
                            {new Date(v.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5: CITY AT A GLANCE — Narrative Data (light)
          ═══════════════════════════════════════════════════════════ */}
      <section className="page-section section-light" id="data">
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

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6: TRANSPARENCY SCORECARD (light, different tone)
          ═══════════════════════════════════════════════════════════ */}
      {/* Only show transparency section if at least one metric > 0 */}
      {transparency && p.governance && (
        (p.governance.agenda_availability_pct || 0) > 0 ||
        (p.governance.minutes_availability_pct || 0) > 0 ||
        (p.governance.video_availability_pct || 0) > 0
      ) && (
        <section className="page-section section-light-alt" id="transparency">
          <div className="section-inner">
            <span className="section-label">Transparency</span>
            <h2 className="section-heading">How Open Is {p.identity.name}&apos;s Government?</h2>
            <p className="section-prose section-prose-dark">{transparency}</p>

            <div className="transparency-bars">
              {(p.governance.agenda_availability_pct || 0) > 0 && (
                <div className="transparency-row">
                  <span className="transparency-label">Agendas Published</span>
                  <div className="transparency-track">
                    <div className="transparency-fill" style={{ width: `${Math.min(100, p.governance.agenda_availability_pct!)}%` }} />
                  </div>
                  <span className="transparency-value">{p.governance.agenda_availability_pct!.toFixed(0)}%</span>
                </div>
              )}
              {(p.governance.minutes_availability_pct || 0) > 0 && (
                <div className="transparency-row">
                  <span className="transparency-label">Minutes Available</span>
                  <div className="transparency-track">
                    <div className="transparency-fill" style={{ width: `${Math.min(100, p.governance.minutes_availability_pct!)}%` }} />
                  </div>
                  <span className="transparency-value">{p.governance.minutes_availability_pct!.toFixed(0)}%</span>
                </div>
              )}
              {(p.governance.video_availability_pct || 0) > 0 && (
                <div className="transparency-row">
                  <span className="transparency-label">Video Recordings</span>
                  <div className="transparency-track">
                    <div className="transparency-fill" style={{ width: `${Math.min(100, p.governance.video_availability_pct!)}%` }} />
                  </div>
                  <span className="transparency-value">{p.governance.video_availability_pct!.toFixed(0)}%</span>
                </div>
              )}
            </div>

            {p.legistar_url && (
              <div className="section-link-row">
                <a href={p.legistar_url} target="_blank" rel="noopener noreferrer" className="section-action-link section-action-link-dark">
                  Explore {p.identity.name} on Legistar &rarr;
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 7: DATA SOURCES + SUBSCRIBE (dark)
          ═══════════════════════════════════════════════════════════ */}
      <section className="page-section section-dark">
        <div className="section-inner">
          <span className="section-label">Sources</span>
          <h2 className="section-heading">Data Sources</h2>
          <p className="section-prose">
            This profile draws from <strong>{srcCount}</strong> verified government data sources. All data is publicly accessible and updated regularly.
          </p>
          <DataSourceGrid dataSources={p.data_sources || {}} provenance={p.provenance} />
        </div>
      </section>

      {/* Subscribe CTA */}
      <div className="subscribe-cta">
        <div className="subscribe-cta-inner">
          <h3>Stay Updated on {p.identity.name}</h3>
          <p>Get notified when new data is available for this city.</p>
          <SubscribeForm cityName={p.identity.name} />
        </div>
      </div>
    </div>
  );
}
