"use client";

import type { ReactNode } from "react";

interface PersonaSectionProps {
  personas: string[];
  children: ReactNode;
}

export function PersonaSection({ personas, children }: PersonaSectionProps) {
  return (
    <div data-personas={personas.join(",")}>
      {children}
    </div>
  );
}
