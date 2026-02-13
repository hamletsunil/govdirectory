import React from "react";
import type { RecentMeeting, LegislativeItem, NewsItem } from "@/components/city/types";

interface ActivityFeedProps {
  upcoming: RecentMeeting[];
  recent: RecentMeeting[];
  legislation: LegislativeItem[];
  news: NewsItem[];
  activitySummary: string;
  cityName: string;
  legistarUrl?: string;
}

export function ActivityFeed({
  upcoming,
  recent,
  legislation,
  news,
  activitySummary,
  cityName,
  legistarUrl,
}: ActivityFeedProps) {
  const hasMeetings = recent.length > 0 || upcoming.length > 0;
  const hasLegislation = legislation.length > 0;
  const hasNews = news.length > 0;
  const hasActivity = hasMeetings || hasLegislation || hasNews;

  if (!hasActivity) return null;

  return (
    <section className="page-section" id="activity">
      <div className="section-inner">
        <span className="section-label">Activity</span>
        <h2 className="section-heading">What&apos;s Happening in {cityName}</h2>
        <p className="section-prose">{activitySummary}</p>

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
              {legislation.slice(0, 4).map((l, i) => (
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

            {legistarUrl && (
              <div className="section-link-row">
                <a href={`${legistarUrl}/Legislation`} target="_blank" rel="noopener noreferrer" className="section-action-link">
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
              {news.slice(0, 3).map((n, i) => (
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
  );
}
