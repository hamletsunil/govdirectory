import fs from "fs";
import path from "path";
import { CityIndex } from "@/components/city/CityIndex";

interface CityEntry {
  slug: string;
  name: string;
  state: string;
  population: number | null;
}

export default function HomePage() {
  const indexPath = path.join(process.cwd(), "public", "data", "cities", "_index.json");
  let cities: CityEntry[] = [];
  if (fs.existsSync(indexPath)) {
    cities = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }

  return (
    <div className="index-page">
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-hero)",
          fontWeight: 600,
          lineHeight: "var(--leading-tight)",
          letterSpacing: "var(--tracking-tight)",
          margin: "0 0 0.5rem",
        }}
      >
        Gov Directory
      </h1>
      <p
        style={{
          fontSize: "var(--text-subtitle)",
          color: "var(--text-secondary)",
          margin: "0 0 2rem",
          maxWidth: "600px",
        }}
      >
        Free public data profiles for {cities.length || 290} local governments.
        Economy, safety, education, housing, and governance data from government
        sources.
      </p>
      <CityIndex cities={cities} />
    </div>
  );
}
