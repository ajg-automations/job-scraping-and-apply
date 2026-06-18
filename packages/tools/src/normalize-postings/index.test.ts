import { describe, it, expect } from "vitest";
import { normalizePostings } from "./index";

describe("normalizePostings", () => {
  it("normalizes a Greenhouse raw posting", () => {
    const out = normalizePostings([
      {
        source: "greenhouse",
        raw: { id: 1, title: "Data Scientist", absolute_url: "https://x/1", location: { name: "Remote" }, updated_at: "2026-01-01", _org: "acme" },
      },
    ]);
    expect(out[0]).toEqual({
      id: "greenhouse:1",
      source: "greenhouse",
      title: "Data Scientist",
      org: "acme",
      location: "Remote",
      applyUrl: "https://x/1",
      postedAt: "2026-01-01",
    });
  });

  it("normalizes an Adzuna raw posting", () => {
    const out = normalizePostings([
      {
        source: "adzuna",
        raw: { id: "9", title: "ML Engineer", redirect_url: "https://a/9", company: { display_name: "Acme" }, location: { display_name: "NYC" }, created: "2026-01-02", description: "do ml" },
      },
    ]);
    expect(out[0]).toEqual({
      id: "adzuna:9",
      source: "adzuna",
      title: "ML Engineer",
      org: "Acme",
      location: "NYC",
      summary: "do ml",
      applyUrl: "https://a/9",
      postedAt: "2026-01-02",
    });
  });
});
