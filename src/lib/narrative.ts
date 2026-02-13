/**
 * City Narrative Generator
 *
 * Transforms structured CityProfile data into editorial prose.
 * Every number should live inside a sentence, not a stat grid.
 */

import type { CityProfile } from "@/components/city/types";

/* ── National medians for comparison context ── */

const NATIONAL = {
  medianIncome: 75_149,
  medianRent: 1_163,
  medianHomeValue: 281_900,
  homeValueToIncomeRatio: 3.75,
  unemploymentRate: 4.0,
  povertyRate: 12.4,
  homeownershipRate: 65.4,
  pm25Safe: 5.0, // WHO guideline
  pm25EpaStandard: 12.0,
};

/* ── Helpers ── */

function fmtPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (n >= 10_000) return `${Math.round(n / 1_000).toLocaleString()},000`;
  return n.toLocaleString();
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)} million`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n}`;
}

function fmtMoneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function compare(val: number, national: number, threshold = 0.08): "above" | "below" | "close" {
  const diff = (val - national) / national;
  if (diff > threshold) return "above";
  if (diff < -threshold) return "below";
  return "close";
}

function relativePhrase(val: number, national: number, opts: { higher: string; lower: string; close: string }): string {
  const rel = compare(val, national);
  if (rel === "above") return opts.higher;
  if (rel === "below") return opts.lower;
  return opts.close;
}

function tenure(startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) return "since " + start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return `since ${start.getFullYear()}`;
}

/* ── Section 1: City Story (hero subtitle) ── */

export function generateCityStory(p: CityProfile): string {
  const name = p.identity.name;
  const parts: string[] = [];

  // Population + governance structure
  if (p.identity.population && p.governance) {
    const pop = fmtPop(p.identity.population);
    const council = p.governance.active_council_members;
    const committees = p.governance.committee_count;

    let govPhrase = "";
    if (council) {
      // Find mayor if available
      const mayor = p.officials?.members?.find(m =>
        m.title?.toLowerCase().includes("mayor") && !m.title?.toLowerCase().includes("vice")
      );
      if (mayor) {
        govPhrase = `led by Mayor ${mayor.name.split(" ").pop()}`;
      } else {
        govPhrase = `governed by a ${council}-member council`;
      }
    }

    let sentence = `A city of ${pop} residents`;
    if (govPhrase) sentence += ` ${govPhrase}`;
    if (committees && committees > 5) {
      sentence += `, with ${committees} active committees`;
    }
    if (p.governance.legislative_velocity && p.governance.legislative_velocity > 100) {
      sentence += ` processing roughly ${Math.round(p.governance.legislative_velocity).toLocaleString()} legislative items per year`;
    }
    sentence += ".";
    parts.push(sentence);
  } else if (p.identity.population) {
    parts.push(`A city of ${fmtPop(p.identity.population)} residents in ${p.identity.state}.`);
  }

  // Economic snapshot
  if (p.economy?.median_household_income) {
    const income = p.economy.median_household_income;
    const rel = relativePhrase(income, NATIONAL.medianIncome, {
      higher: "above the national median",
      lower: "below the national median",
      close: "near the national median",
    });
    parts.push(`Median household income is ${fmtMoney(income)}, ${rel}.`);
  }

  // Keep it to 2-3 sentences
  return parts.slice(0, 3).join(" ");
}

/* ── Section 2: Meet Your Government ── */

export function generateGovernmentIntro(p: CityProfile): string {
  if (!p.officials?.members?.length) {
    return `${p.identity.name} is tracked on the Legistar legislative platform.`;
  }

  const members = p.officials.members;
  const count = members.length;
  const bodyName = p.officials.body_name?.replace(/^\*\s*/, "");

  const mayor = members.find(m =>
    m.title?.toLowerCase().includes("mayor") && !m.title?.toLowerCase().includes("vice")
  );

  const parts: string[] = [];

  if (bodyName && mayor) {
    parts.push(`${p.identity.name}'s ${bodyName} has ${count} members, led by Mayor ${mayor.name}${mayor.start_date ? `, serving ${tenure(mayor.start_date)}` : ""}.`);
  } else if (bodyName) {
    parts.push(`The ${bodyName} has ${count} current members on record.`);
  } else {
    parts.push(`${p.identity.name} has ${count} elected officials on record.`);
  }

  // Meeting frequency
  if (p.governance?.avg_meetings_per_month) {
    const freq = p.governance.avg_meetings_per_month;
    if (freq >= 8) {
      parts.push(`The council meets about ${Math.round(freq)} times a month — a highly active government.`);
    } else if (freq >= 4) {
      parts.push(`The council meets about ${Math.round(freq)} times a month.`);
    } else {
      parts.push(`Meetings happen roughly ${Math.round(freq)} times a month.`);
    }
  }

  // Email availability
  const withEmail = members.filter(m => m.email).length;
  if (withEmail > 0 && withEmail === count) {
    parts.push("All members have public email addresses available below.");
  } else if (withEmail > 0) {
    parts.push(`${withEmail} of ${count} members have public email addresses.`);
  }

  return parts.join(" ");
}

/* ── Section 3: What's Being Decided ── */

export function generateActivitySummary(p: CityProfile): string {
  const parts: string[] = [];
  const name = p.identity.name;

  // Legislation topics
  if (p.recent_legislation?.length) {
    const items = p.recent_legislation;
    const topics: string[] = [];

    for (const item of items.slice(0, 10)) {
      const t = item.title.toLowerCase();
      if (/rezone|rezoning|zoning/.test(t) && !topics.includes("rezoning")) topics.push("rezoning");
      if (/liquor|license/.test(t) && !topics.includes("licensing")) topics.push("licensing");
      if (/budget|expenditure|appropriat/.test(t) && !topics.includes("budget matters")) topics.push("budget matters");
      if (/appoint/.test(t) && !topics.includes("appointments")) topics.push("appointments");
      if (/ordinance/.test(t) && !topics.includes("ordinances")) topics.push("ordinances");
      if (/transparen|community/.test(t) && !topics.includes("community initiatives")) topics.push("community initiatives");
      if (/settlement|claim/.test(t) && !topics.includes("legal settlements")) topics.push("legal settlements");
      if (/permit|construction|stormwater/.test(t) && !topics.includes("infrastructure")) topics.push("infrastructure");
    }

    if (topics.length > 0) {
      const topicList = topics.slice(0, 4).join(", ");
      parts.push(`Recent agenda items in ${name} include ${topicList}.`);
    } else {
      parts.push(`${name}'s legislative body has ${items.length} recent items on its agenda.`);
    }
  }

  // Meeting bodies
  if (p.recent_meetings?.length) {
    const bodies = [...new Set(
      p.recent_meetings
        .map(m => m.body)
        .filter((b): b is string => b != null && !/general information|packet/i.test(b))
    )];
    if (bodies.length > 1) {
      parts.push(`Recent sessions include the ${bodies.slice(0, 3).join(", the ")}.`);
    }
  }

  if (parts.length === 0) {
    return `${name} tracks its legislative activity through the Legistar platform.`;
  }

  return parts.join(" ");
}

/* ── Section 5: City Health (narrative data) ── */

export function generateCityHealth(p: CityProfile): {
  economy: string | null;
  safety: string | null;
  schools: string | null;
  civic: string | null;
  permits: string | null;
} {
  const name = p.identity.name;

  // Economy
  let economy: string | null = null;
  if (p.economy?.median_household_income) {
    const parts: string[] = [];
    const income = p.economy.median_household_income;
    const rel = relativePhrase(income, NATIONAL.medianIncome, {
      higher: "more than",
      lower: "less than",
      close: "close to",
    });

    let affordSentence = `For a family earning the median ${fmtMoney(income)} — ${rel} the national median`;
    if (p.economy.median_home_value && p.economy.home_value_to_income_ratio) {
      const ratio = p.economy.home_value_to_income_ratio;
      const ratioRel = ratio > NATIONAL.homeValueToIncomeRatio + 1.5
        ? "a significant stretch"
        : ratio > NATIONAL.homeValueToIncomeRatio + 0.5
        ? "slightly above the national norm"
        : ratio < NATIONAL.homeValueToIncomeRatio - 0.5
        ? "more affordable than average"
        : "roughly in line with national norms";
      affordSentence += ` — a typical home costs about ${fmtMoney(p.economy.median_home_value)}, or ${ratio.toFixed(1)}x annual income. That's ${ratioRel}.`;
    } else {
      affordSentence += ".";
    }
    parts.push(affordSentence);

    if (p.housing?.median_rent) {
      let rentLine = `Rents run about ${fmtMoney(p.housing.median_rent)} a month`;
      if (p.housing.cost_burdened_pct && p.housing.cost_burdened_pct > 40) {
        rentLine += `, with ${Math.round(p.housing.cost_burdened_pct)}% of households spending more than 30% of income on housing`;
      }
      rentLine += ".";
      parts.push(rentLine);
    }

    if (p.economy.unemployment_rate != null) {
      const rate = p.economy.unemployment_rate;
      const level = p.economy.unemployment_data_level;
      const rel2 = relativePhrase(rate, NATIONAL.unemploymentRate, {
        higher: "higher than",
        lower: "lower than",
        close: "close to",
      });
      let jobLine = `Unemployment sits at ${fmtPct(rate)}${level && level !== "city" ? ` (${level}-level data)` : ""}, ${rel2} the national average`;
      if (p.economy.poverty_rate != null) {
        jobLine += `, while ${fmtPct(p.economy.poverty_rate)} of residents live below the poverty line`;
      }
      jobLine += ".";
      parts.push(jobLine);
    }

    economy = parts.join(" ");
  }

  // Safety
  let safety: string | null = null;
  if (p.safety?.violent_crime_rate != null) {
    const v = p.safety.violent_crime_rate;
    const level = v < 200 ? "low" : v < 400 ? "moderate" : v < 700 ? "elevated" : "high";
    let safetyLine = `${name}'s violent crime rate is ${Math.round(v)} per 100,000 residents — considered ${level}`;
    if (p.safety.crime_data_level && p.safety.crime_data_level !== "city") {
      safetyLine += ` (based on ${p.safety.crime_data_level}-level data)`;
    }
    safetyLine += ".";
    if (p.safety.crime_trend != null && Math.abs(p.safety.crime_trend) > 5) {
      const dir = p.safety.crime_trend < 0 ? "declined" : "increased";
      safetyLine += ` Crime has ${dir} ${Math.abs(p.safety.crime_trend).toFixed(1)}% year over year.`;
    }
    safety = safetyLine;
  } else {
    safety = `${name} lacks city-level crime data on publicly accessible portals — a transparency gap worth noting${p.identity.population && p.identity.population > 200_000 ? ` for a city of ${fmtPop(p.identity.population)}` : ""}.`;
  }

  // Schools
  let schools: string | null = null;
  if (p.education?.avg_school_rating != null) {
    const rating = p.education.avg_school_rating;
    const tier = p.education.school_quality_tier;
    const desc = tier === "excellent" ? "well above average"
      : tier === "good" ? "above average"
      : tier === "fair" ? "middling"
      : "below average";
    let schoolLine = `Public schools average a ${rating.toFixed(1)}/10 GreatSchools rating — generally considered ${desc}`;
    if (p.education.pupil_teacher_ratio) {
      schoolLine += `, with a ${p.education.pupil_teacher_ratio.toFixed(1)}:1 student-to-teacher ratio`;
    }
    schoolLine += ".";
    schools = schoolLine;
  }

  // Civic responsiveness
  let civic: string | null = null;
  if (p.civic_issues?.has_civic_issue_tracking && p.civic_issues.resolution_rate != null) {
    const rate = p.civic_issues.resolution_rate;
    const total = p.civic_issues.total_issues || 0;
    if (rate > 85) {
      civic = `When residents report issues, ${name} resolves ${rate.toFixed(0)}% of them — a strong responsiveness record.`;
    } else if (rate > 60) {
      civic = `The city resolves about ${rate.toFixed(0)}% of the ${total.toLocaleString()} issues reported through its civic tracking system.`;
    } else {
      civic = `Of ${total.toLocaleString()} issues reported, only ${rate.toFixed(0)}% get resolved — there's room to improve.`;
    }
    if (p.civic_issues.top_issue_type && p.civic_issues.top_issue_type !== "Unknown") {
      civic += ` The most common complaint: ${p.civic_issues.top_issue_type}.`;
    }
  }

  // Permits
  let permits: string | null = null;
  if (p.development?.permits_12mo != null && p.development.permits_12mo > 0) {
    let permitLine = `${p.development.permits_12mo.toLocaleString()} building permits were issued in the past 12 months`;
    if (p.development.avg_permit_value) {
      permitLine += `, averaging ${fmtMoney(p.development.avg_permit_value)} per permit`;
    }
    permitLine += ".";
    if (p.development.yoy_trend_pct != null && Math.abs(p.development.yoy_trend_pct) > 5) {
      const dir = p.development.yoy_trend_pct > 0 ? "up" : "down";
      permitLine += ` That's ${dir} ${Math.abs(p.development.yoy_trend_pct).toFixed(1)}% from the prior year.`;
    }
    permits = permitLine;
  }

  return { economy, safety, schools, civic, permits };
}

/* ── Section 5b: Challenges ── */

export function generateChallenges(p: CityProfile): string[] {
  const challenges: string[] = [];
  const name = p.identity.name;

  if (p.housing?.cost_burdened_pct && p.housing.cost_burdened_pct > 45) {
    challenges.push(
      `Nearly ${Math.round(p.housing.cost_burdened_pct)}% of ${name} households spend more than 30% of income on housing — a sign of serious affordability pressure.`
    );
  }

  if (p.safety?.violent_crime_rate == null && p.safety?.total_crime_rate == null) {
    challenges.push(
      `${name} lacks city-level crime data on public portals, making it harder for residents to assess safety.`
    );
  }

  if (p.economy?.poverty_rate != null && p.economy.poverty_rate > NATIONAL.povertyRate * 1.3) {
    challenges.push(
      `At ${fmtPct(p.economy.poverty_rate)}, the poverty rate is notably above the national average of ${fmtPct(NATIONAL.povertyRate)}.`
    );
  }

  if (p.environment?.pm25_mean != null && p.environment.pm25_mean > NATIONAL.pm25EpaStandard) {
    challenges.push(
      `Fine particulate pollution (PM2.5) at ${p.environment.pm25_mean.toFixed(1)} µg/m³ exceeds EPA standards.`
    );
  }

  if (p.education?.avg_school_rating != null && p.education.avg_school_rating < 4) {
    challenges.push(
      `Public schools average ${p.education.avg_school_rating.toFixed(1)}/10 — below the threshold most families consider adequate.`
    );
  }

  if (p.governance?.agenda_availability_pct != null && p.governance.agenda_availability_pct < 10
    && p.governance.agenda_availability_pct > 0) {
    challenges.push(
      `Only ${p.governance.agenda_availability_pct.toFixed(1)}% of meetings have published agendas — a significant transparency gap.`
    );
  }

  return challenges;
}

/* ── Transparency narrative ── */

export function generateTransparency(p: CityProfile): string | null {
  if (!p.governance) return null;

  const g = p.governance;
  const parts: string[] = [];

  if (g.agenda_availability_pct != null) {
    const level = g.agenda_availability_pct > 80 ? "strong" : g.agenda_availability_pct > 40 ? "moderate" : "limited";
    parts.push(`${p.identity.name} publishes agendas for ${g.agenda_availability_pct.toFixed(0)}% of its meetings — ${level} transparency.`);
  }

  if (g.video_availability_pct != null && g.video_availability_pct > 0) {
    parts.push(`Video is available for ${g.video_availability_pct.toFixed(0)}% of meetings.`);
  }

  if (g.years_of_legislative_data != null) {
    parts.push(`We have ${g.years_of_legislative_data.toFixed(0)} years of legislative data on record.`);
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

/* ── Builder Narrative (real estate development) ── */

export function generateBuilderNarrative(p: CityProfile): {
  market: string | null;
  rental: string | null;
  building: string | null;
  risk: string | null;
  quality: string | null;
} {
  const name = p.identity.name;

  // Market Overview
  let market: string | null = null;
  if (p.economy?.median_home_value) {
    const parts: string[] = [];
    const val = p.economy.median_home_value;
    const ratio = p.economy.home_value_to_income_ratio;

    if (ratio != null) {
      const affordability = ratio < 3 ? "highly affordable"
        : ratio < 4 ? "moderately affordable"
        : ratio < 5.5 ? "moderately priced"
        : ratio < 8 ? "expensive"
        : "very expensive";
      parts.push(`${name}'s median home value of ${fmtMoney(val)} with a ${ratio.toFixed(1)}\u00d7 income ratio makes it ${affordability} for development.`);
    } else {
      parts.push(`${name}'s median home value sits at ${fmtMoney(val)}.`);
    }

    if (p.economy.homeownership_rate != null) {
      const rate = p.economy.homeownership_rate;
      const rental = 100 - rate;
      if (rental > 60) {
        parts.push(`With ${rental.toFixed(0)}% of households renting, there's strong demand for rental housing.`);
      } else if (rental > 45) {
        parts.push(`About ${rental.toFixed(0)}% of households rent, suggesting a balanced ownership-rental market.`);
      } else {
        parts.push(`At ${rate.toFixed(0)}% homeownership, this is primarily an owner-occupied market.`);
      }
    }

    if (p.economy.population_growth_cagr != null) {
      const growth = p.economy.population_growth_cagr;
      if (growth > 1) {
        parts.push(`Population is growing at ${growth.toFixed(1)}% annually \u2014 a strong signal for new housing demand.`);
      } else if (growth > 0.3) {
        parts.push(`Population growth of ${growth.toFixed(1)}% per year supports steady development.`);
      } else if (growth > 0) {
        parts.push(`Population growth is modest at ${growth.toFixed(2)}% annually.`);
      } else {
        parts.push(`Population is declining at ${Math.abs(growth).toFixed(1)}% per year \u2014 watch for oversupply risks.`);
      }
    }

    if (p.economy.median_real_estate_taxes != null) {
      parts.push(`Median annual real estate taxes run ${fmtMoney(p.economy.median_real_estate_taxes)}.`);
    }

    market = parts.join(" ");
  }

  // Rental Market
  let rental: string | null = null;
  if (p.housing?.median_rent != null) {
    const parts: string[] = [];
    parts.push(`Median rent in ${name} is ${fmtMoney(p.housing.median_rent)} per month.`);

    if (p.housing.rent_burden_ratio != null) {
      const burden = p.housing.rent_burden_ratio;
      if (burden > 30) {
        parts.push(`Tenants spend ${burden.toFixed(1)}% of income on rent \u2014 above the 30% affordability threshold.`);
      } else {
        parts.push(`Rent-to-income ratio of ${burden.toFixed(1)}% is within the affordable range.`);
      }
    }

    if (p.housing.cost_burdened_pct != null && p.housing.cost_burdened_pct > 30) {
      parts.push(`${Math.round(p.housing.cost_burdened_pct)}% of households are cost-burdened, suggesting unmet demand for affordable housing.`);
    }

    if (p.housing.housing_units != null) {
      parts.push(`The city has ${p.housing.housing_units.toLocaleString()} total housing units.`);
    }

    rental = parts.join(" ");
  }

  // Building Activity
  let building: string | null = null;
  if (p.development?.permits_12mo != null && p.development.permits_12mo > 0) {
    const parts: string[] = [];
    parts.push(`${p.development.permits_12mo.toLocaleString()} building permits were issued in the past 12 months.`);

    if (p.development.avg_permit_value) {
      parts.push(`Average permit value: ${fmtMoney(p.development.avg_permit_value)}.`);
    }
    if (p.development.yoy_trend_pct != null && Math.abs(p.development.yoy_trend_pct) > 3) {
      const dir = p.development.yoy_trend_pct > 0 ? "up" : "down";
      parts.push(`Permit activity is ${dir} ${Math.abs(p.development.yoy_trend_pct).toFixed(1)}% year-over-year.`);
    }
    building = parts.join(" ");
  }

  // Risk Factors
  let risk: string | null = null;
  {
    const parts: string[] = [];
    if (p.environment?.total_disasters != null && p.environment.total_disasters > 0) {
      parts.push(`${name} has experienced ${p.environment.total_disasters} federally declared disasters.`);
      if (p.environment.avg_disasters_per_decade != null) {
        parts.push(`That averages ${p.environment.avg_disasters_per_decade.toFixed(1)} per decade.`);
      }
      if (p.environment.most_recent_disaster_type) {
        parts.push(`The most recent was a ${p.environment.most_recent_disaster_type.toLowerCase()}.`);
      }
    }
    if (p.safety?.property_crime_rate != null) {
      const rate = p.safety.property_crime_rate;
      const level = rate < 2000 ? "low" : rate < 3500 ? "moderate" : rate < 5000 ? "elevated" : "high";
      parts.push(`Property crime rate is ${Math.round(rate).toLocaleString()} per 100K residents \u2014 considered ${level} for development risk.`);
    }
    if (p.environment?.pm25_mean != null && p.environment.pm25_mean > 10) {
      parts.push(`Air quality (PM2.5: ${p.environment.pm25_mean.toFixed(1)} \u00b5g/m\u00b3) may affect residential desirability.`);
    }
    if (parts.length > 0) risk = parts.join(" ");
  }

  // Quality of Life
  let quality: string | null = null;
  {
    const parts: string[] = [];
    if (p.education?.avg_school_rating != null) {
      const rating = p.education.avg_school_rating;
      const impact = rating >= 7 ? "a strong driver of family-housing demand"
        : rating >= 5 ? "adequate for most families"
        : "a factor that may limit family-housing demand";
      parts.push(`Schools average ${rating.toFixed(1)}/10 \u2014 ${impact}.`);
    }
    if (p.safety?.violent_crime_rate != null) {
      const rate = p.safety.violent_crime_rate;
      if (rate > 500) {
        parts.push(`Violent crime at ${Math.round(rate).toLocaleString()} per 100K is elevated and may impact property values.`);
      } else if (rate < 200) {
        parts.push(`Low violent crime (${Math.round(rate).toLocaleString()} per 100K) supports premium pricing.`);
      }
    }
    if (p.governance?.has_accela) {
      parts.push(`The city uses Accela for building permits, enabling online permit tracking and applications.`);
    }
    if (parts.length > 0) quality = parts.join(" ");
  }

  return { market, rental, building, risk, quality };
}
