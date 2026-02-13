"use client";

import { useEffect } from "react";

/** Adds .visible to .page-section elements as they scroll into view */
export function ScrollAnimator() {
  useEffect(() => {
    const sections = document.querySelectorAll(".page-section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return null;
}
