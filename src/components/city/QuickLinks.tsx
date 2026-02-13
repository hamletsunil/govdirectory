import React from "react";
import type { CityProfile } from "@/components/city/types";
import { stateSlug } from "@/components/city/helpers";
import { RESOURCE_ICONS, ExternalLinkIcon } from "@/components/city/icons";

/* ── Types ── */

interface ResidentResource {
  title: string;
  description: string;
  url: string;
  icon: "vote" | "calendar" | "gavel" | "people" | "search" | "video" | "alert" | "building";
  external?: boolean;
}

/* ── Resource builder ── */

function getResidentResources(p: CityProfile): ResidentResource[] {
  const resources: ResidentResource[] = [];
  const name = p.identity.name;
  const st = p.identity.state;

  if (p.city_website) {
    resources.push({
      title: "Official Website",
      description: `${name}'s official government website`,
      url: p.city_website,
      icon: "building",
      external: true,
    });
  }

  if (st) {
    resources.push({
      title: "Register to Vote",
      description: `Check your registration or register in ${st}`,
      url: `https://vote.org/register-to-vote/${stateSlug(st)}/`,
      icon: "vote",
      external: true,
    });
  }

  if (p.legistar_url) {
    resources.push({
      title: "Meeting Calendar",
      description: `Upcoming ${name} council and committee meetings`,
      url: `${p.legistar_url}/Calendar.aspx`,
      icon: "calendar",
      external: true,
    });
  }

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

  if (p.legistar_url) {
    resources.push({
      title: "Browse Legislation",
      description: "Ordinances, resolutions, and pending items",
      url: `${p.legistar_url}/Legislation`,
      icon: "gavel",
      external: true,
    });
  }

  resources.push({
    title: "Search Meetings",
    description: `Search transcripts and agendas from ${name}`,
    url: `https://myhamlet.com/search?q=${encodeURIComponent(name)}`,
    icon: "search",
    external: true,
  });

  if ((p.video_meetings?.length || 0) > 0) {
    resources.push({
      title: "Watch Meetings",
      description: "Recorded council and committee sessions",
      url: "#watch",
      icon: "video",
    });
  }

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

/* ── Component ── */

interface QuickLinksProps {
  profile: CityProfile;
}

export function QuickLinks({ profile }: QuickLinksProps) {
  const resources = getResidentResources(profile);

  if (resources.length === 0) return null;

  return (
    <section className="page-section" id="resources">
      <div className="section-inner">
        <span className="section-label">Quick Links</span>
        <h2 className="section-heading">What Can You Do in {profile.identity.name}?</h2>
        <p className="section-prose">
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
                      <ExternalLinkIcon className="resource-external-icon" />
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
  );
}
