"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const TABS = [
  { value: "citizen", label: "Citizen", subtitle: "What can I do?" },
  { value: "researcher", label: "Researcher", subtitle: "Show me the data" },
  { value: "builder", label: "Builder", subtitle: "Development data" },
] as const;

function TabBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const active = searchParams.get("view") ?? "citizen";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "citizen") {
      params.delete("view");
    } else {
      params.set("view", value);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <nav className="persona-tab-bar" role="tablist" aria-label="View mode">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          className="persona-tab"
          data-active={active === tab.value ? "true" : "false"}
          aria-selected={active === tab.value}
          onClick={() => handleClick(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function PersonaTabBar() {
  return (
    <Suspense
      fallback={
        <nav className="persona-tab-bar" role="tablist" aria-label="View mode">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              className="persona-tab"
              data-active={tab.value === "citizen" ? "true" : "false"}
              aria-selected={tab.value === "citizen"}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      }
    >
      <TabBar />
    </Suspense>
  );
}
