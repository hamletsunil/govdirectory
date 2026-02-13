"use client";

import { useState, type FormEvent } from "react";

export function SubscribeForm({ cityName }: { cityName: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (email.includes("@")) {
      setStatus("success");
    }
  }

  if (status === "success") {
    return (
      <p className="subscribe-success">
        Thanks! We&apos;ll notify you about {cityName}.
      </p>
    );
  }

  return (
    <form className="subscribe-form" onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit">Subscribe</button>
    </form>
  );
}
