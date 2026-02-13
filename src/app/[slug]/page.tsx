import React from "react";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import type { CityProfile } from "@/components/city/types";
import { countSources, extractYouTubeId } from "@/components/city/helpers";
import {
  generateCityStory,
  generateGovernmentIntro,
  generateActivitySummary,
  generateCityHealth,
  generateChallenges,
  generateTransparency,
  generateBuilderNarrative,
} from "@/lib/narrative";

/* ── Section components ── */
import { CityHero } from "@/components/city/CityHero";
import { QuickLinks } from "@/components/city/QuickLinks";
import { OfficialsGrid } from "@/components/city/OfficialsGrid";
import { ActivityFeed } from "@/components/city/ActivityFeed";
import { VideoSection } from "@/components/city/VideoSection";
import { CityGlance } from "@/components/city/CityGlance";
import { TransparencyScorecard } from "@/components/city/TransparencyScorecard";
import { BuilderPanel } from "@/components/city/BuilderPanel";
import { DataSourceGrid } from "@/components/city/DataSourceGrid";
import { ScrollAnimator } from "@/components/city/ScrollAnimator";
import { SubscribeForm } from "@/components/city/SubscribeForm";

/* ── Persona system ── */
import { PersonaContainer } from "@/components/city/PersonaContainer";
import { PersonaTabBar } from "@/components/city/PersonaTabBar";
import { PersonaSection } from "@/components/city/PersonaSection";

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

  /* Narratives */
  const cityStory = generateCityStory(p);
  const govIntro = generateGovernmentIntro(p);
  const activitySummary = generateActivitySummary(p);
  const health = generateCityHealth(p);
  const challenges = generateChallenges(p);
  const transparency = generateTransparency(p);
  const builderNarrative = generateBuilderNarrative(p);

  /* Derived data */
  const allOfficials = p.officials?.members || [];
  const upcoming = p.recent_meetings?.filter(m => m.upcoming) || [];
  const recent = p.recent_meetings?.filter(m => !m.upcoming) || [];
  const validLegislation = (p.recent_legislation || []).filter(l => {
    if (!l.intro_date) return true;
    const year = parseInt(l.intro_date.substring(0, 4), 10);
    return year <= new Date().getFullYear() + 1;
  });
  const news = p.government_news || [];

  const hasMeetings = (p.recent_meetings?.length || 0) > 0;
  const hasLegislation = validLegislation.length > 0;
  const hasNews = news.length > 0;
  const hasActivity = hasMeetings || hasLegislation || hasNews;

  const primaryVideo = p.video_meetings?.find(v => v.is_youtube && v.video_url);
  const primaryVideoId = primaryVideo?.video_url ? extractYouTubeId(primaryVideo.video_url) : null;
  const otherVideos = p.video_meetings?.filter(v => v !== primaryVideo && v.is_youtube).slice(0, 4) || [];

  const srcCount = countSources(p.data_sources || {});

  return (
    <PersonaContainer>
      <ScrollAnimator />

      {/* Hero — always visible */}
      <CityHero
        slug={slug}
        profile={p}
        cityStory={cityStory}
        hasOfficials={allOfficials.length > 0}
        hasVideo={!!primaryVideoId}
        hasActivity={hasActivity}
        nextMeeting={upcoming[0]}
      />

      <PersonaTabBar />

      <PersonaSection personas={["citizen"]}>
        <QuickLinks profile={p} />
      </PersonaSection>

      <PersonaSection personas={["citizen"]}>
        <OfficialsGrid
          officials={allOfficials}
          govIntro={govIntro}
          legistarUrl={p.legistar_url}
        />
      </PersonaSection>

      <PersonaSection personas={["citizen", "researcher"]}>
        <ActivityFeed
          upcoming={upcoming}
          recent={recent}
          legislation={validLegislation}
          news={news}
          activitySummary={activitySummary}
          cityName={p.identity.name}
          legistarUrl={p.legistar_url}
        />
      </PersonaSection>

      <PersonaSection personas={["citizen"]}>
        {primaryVideo && primaryVideoId && (
          <VideoSection
            primaryVideo={primaryVideo}
            primaryVideoId={primaryVideoId}
            otherVideos={otherVideos}
          />
        )}
      </PersonaSection>

      <PersonaSection personas={["citizen", "researcher"]}>
        <CityGlance profile={p} health={health} challenges={challenges} />
      </PersonaSection>

      <PersonaSection personas={["researcher"]}>
        {transparency && p.governance && (
          <TransparencyScorecard
            governance={p.governance}
            transparency={transparency}
            legistarUrl={p.legistar_url}
            cityName={p.identity.name}
          />
        )}
      </PersonaSection>

      <PersonaSection personas={["researcher", "builder"]}>
        <section className="page-section section-alt">
          <div className="section-inner">
            <span className="section-label">Sources</span>
            <h2 className="section-heading">Data Sources</h2>
            <p className="section-prose">
              This profile draws from <strong>{srcCount}</strong> verified government data sources. All data is publicly accessible and updated regularly.
            </p>
            <DataSourceGrid dataSources={p.data_sources || {}} provenance={p.provenance} />
          </div>
        </section>
      </PersonaSection>

      <PersonaSection personas={["builder"]}>
        <BuilderPanel
          profile={p}
          narrative={builderNarrative}
        />
      </PersonaSection>

      <PersonaSection personas={["citizen", "researcher", "builder"]}>
        <div className="subscribe-cta">
          <div className="subscribe-cta-inner">
            <h3>Stay Updated on {p.identity.name}</h3>
            <p>Get notified when new data is available for this city.</p>
            <SubscribeForm cityName={p.identity.name} />
          </div>
        </div>
      </PersonaSection>
    </PersonaContainer>
  );
}
