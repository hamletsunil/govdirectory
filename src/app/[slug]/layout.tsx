import type { Metadata } from "next";
import fs from "fs";
import path from "path";

function loadCityMeta(slug: string) {
  const fp = path.join(process.cwd(), "public", "data", "cities", `${slug}.json`);
  if (!fs.existsSync(fp)) return null;
  const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
  return {
    name: data.identity?.name || slug,
    state: data.identity?.state || "",
    population: data.identity?.population as number | null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = loadCityMeta(slug);
  if (!meta) return { title: "City Not Found" };

  const title = `${meta.name}, ${meta.state} \u2014 Free City Data Profile | Gov Directory`;
  const desc = `Free public data for ${meta.name}, ${meta.state}${meta.population ? ` (pop. ${meta.population.toLocaleString()})` : ""}. Economy, safety, education, housing, governance data from government sources.`;

  return {
    title,
    description: desc,
    openGraph: {
      title: `${meta.name}, ${meta.state} \u2014 City Data Profile`,
      description: desc,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${meta.name}, ${meta.state} \u2014 City Data`,
      description: desc,
    },
  };
}

export default async function CityLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const meta = loadCityMeta(slug);

  const jsonLd = meta
    ? {
        "@context": "https://schema.org",
        "@type": "City",
        name: meta.name,
        containedInPlace: { "@type": "State", name: meta.state },
        ...(meta.population ? { population: meta.population } : {}),
        url: `https://directory.myhamlet.com/${slug}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
