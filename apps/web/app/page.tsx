"use client";
import { useState } from "react";
import type { FetchResult } from "@job/shared";

export default function Home() {
  const [query, setQuery] = useState("engineer");
  const [boards, setBoards] = useState("stripe");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        sources: ["greenhouse"],
        greenhouseBoards: boards.split(",").map((b) => b.trim()).filter(Boolean),
      }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Job Assistant — Search</h1>
      <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="query" />
        <input value={boards} onChange={(e) => setBoards(e.target.value)} placeholder="greenhouse boards (comma-sep)" />
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Find"}</button>
      </form>
      {result && (
        <>
          {result.skippedSources.length > 0 && (
            <p style={{ color: "#a60" }}>
              Skipped: {result.skippedSources.map((s) => `${s.source} (${s.reason})`).join(", ")}
            </p>
          )}
          <ul>
            {result.postings.map((p) => (
              <li key={p.id} style={{ marginBottom: 12 }}>
                <a href={p.applyUrl} target="_blank" rel="noreferrer"><strong>{p.title}</strong></a>
                {" — "}{p.org}{p.location ? ` · ${p.location}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
