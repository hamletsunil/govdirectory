import React from "react";
import type { Official } from "@/components/city/types";
import { monogram } from "@/components/city/helpers";
import { MailIcon } from "@/components/city/icons";

interface OfficialsGridProps {
  officials: Official[];
  govIntro: string;
  legistarUrl?: string;
  maxOfficials?: number;
}

export function OfficialsGrid({
  officials,
  govIntro,
  legistarUrl,
  maxOfficials = 12,
}: OfficialsGridProps) {
  if (officials.length === 0) return null;

  const showAll = officials.length <= maxOfficials;
  const displayed = showAll ? officials : officials.slice(0, maxOfficials);

  return (
    <section className="page-section section-alt" id="representatives">
      <div className="section-inner">
        <span className="section-label">Your Government</span>
        <h2 className="section-heading">Meet Your Representatives</h2>
        <p className="section-prose">{govIntro}</p>

        <div className="officials-grid">
          {displayed.map((m) => (
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
                  <MailIcon style={{ width: 14, height: 14 }} />
                  Email
                </a>
              ) : (
                <span className="official-no-email">No public email</span>
              )}
            </div>
          ))}
        </div>

        {!showAll && legistarUrl && (
          <div className="section-link-row">
            <a href={`${legistarUrl}/People`} target="_blank" rel="noopener noreferrer" className="section-action-link">
              View all {officials.length} members &rarr;
            </a>
          </div>
        )}

        {legistarUrl && (
          <div className="section-link-row">
            <a href={legistarUrl} target="_blank" rel="noopener noreferrer" className="section-action-link">
              View full records on Legistar &rarr;
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
