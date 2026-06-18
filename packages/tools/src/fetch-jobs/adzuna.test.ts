import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fetchAdzuna } from "./adzuna";

function mockFetch(body: unknown, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
}

describe("fetchAdzuna", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "id";
    process.env.ADZUNA_APP_KEY = "key";
  });
  afterEach(() => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("returns the results array as raw postings", async () => {
    const fetch = mockFetch({
      results: [
        { id: "9", title: "ML Engineer", redirect_url: "https://a/9", company: { display_name: "Acme" }, location: { display_name: "Remote" }, created: "2026-01-01", description: "..." },
      ],
    });
    const result = await fetchAdzuna({ query: "ml" }, { fetch });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("adzuna");
    expect((result[0].raw as any).id).toBe("9");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.ADZUNA_APP_ID;
    await expect(
      fetchAdzuna({ query: "ml" }, { fetch: mockFetch({}) }),
    ).rejects.toThrow(/adzuna credentials/i);
  });
});
