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

  const citiesWithPop = cities.filter((c) => c.population != null);
  const stateCount = new Set(cities.map((c) => c.state).filter(Boolean)).size;

  return (
    <div className="index-page">
      <section className="hero-editorial">
        <div className="hero-editorial-content">
          <span className="hero-badge">
            <span className="hero-badge-dot" />
            Public Data
          </span>
          <h1 className="hero-city-name">Gov Directory</h1>
          <p className="hero-narrative">
            Free, open data profiles for local governments across America.
            Economy, safety, education, housing, and governance — sourced
            directly from government records.
          </p>
          <div className="hero-stats-ribbon">
            <div className="ribbon-stat">
              <span className="ribbon-value">{cities.length}</span>
              <span className="ribbon-label">Governments</span>
            </div>
            <div className="ribbon-stat">
              <span className="ribbon-value">{stateCount}</span>
              <span className="ribbon-label">States</span>
            </div>
            <div className="ribbon-stat">
              <span className="ribbon-value">{citiesWithPop.length}</span>
              <span className="ribbon-label">City Profiles</span>
            </div>
          </div>
        </div>
      </section>
      <CityIndex cities={cities} />
    </div>
  );
}
