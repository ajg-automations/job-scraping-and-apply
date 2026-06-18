import { describe, it, expect, afterEach } from "vitest";
import { fetchJobs } from "./index";

function mockFetch(byUrl: (url: string) => { ok: boolean; body: unknown }) {
  return (async (url: string) => {
    const { ok, body } = byUrl(String(url));
    return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
  }) as typeof fetch;
}

afterEach(() => {
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
});

describe("fetchJobs", () => {
  it("collects postings from both sources and reports none skipped", async () => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
    const fetch = mockFetch((url) =>
      url.includes("greenhouse")
        ? { ok: true, body: { jobs: [{ id: 1, title: "Data Scientist", absolute_url: "u" }] } }
        : { ok: true, body: { results: [{ id: "9", title: "ML Engineer", redirect_url: "u" }] } },
    );
    const result = await fetchJobs(
      { query: "data", sources: ["greenhouse", "adzuna"], greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result.raw).toHaveLength(2);
    expect(result.skippedSources).toHaveLength(0);
  });

  it("skips Adzuna (with a reason) when credentials are missing, still returns Greenhouse", async () => {
    const fetch = mockFetch(() => ({ ok: true, body: { jobs: [{ id: 1, title: "Data Scientist", absolute_url: "u" }] } }));
    const result = await fetchJobs(
      { query: "data", sources: ["greenhouse", "adzuna"], greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result.raw).toHaveLength(1);
    expect(result.skippedSources).toEqual([
      { source: "adzuna", reason: expect.stringMatching(/credentials/i) },
    ]);
  });
});
