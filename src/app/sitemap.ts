import fs from "fs";
import path from "path";
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://directory.myhamlet.com";
  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];

  const dir = path.join(process.cwd(), "public", "data", "cities");
  if (fs.existsSync(dir)) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json") && f !== "_index.json");
    for (const file of files) {
      entries.push({
        url: `${base}/${file.replace(".json", "")}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
