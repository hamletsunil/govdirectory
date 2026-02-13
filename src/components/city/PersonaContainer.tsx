"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

interface PersonaContainerProps {
  children: ReactNode;
}

function Container({ children }: PersonaContainerProps) {
  const searchParams = useSearchParams();
  const active = searchParams.get("view") ?? "citizen";

  return (
    <div data-persona-container="" data-active={active}>
      {children}
    </div>
  );
}

export function PersonaContainer({ children }: PersonaContainerProps) {
  return (
    <Suspense
      fallback={
        <div data-persona-container="" data-active="citizen">
          {children}
        </div>
      }
    >
      <Container>{children}</Container>
    </Suspense>
  );
}
