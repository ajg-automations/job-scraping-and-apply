import { describe, it, expect } from "vitest";
import { fetchGreenhouse } from "./greenhouse";

function mockFetch(body: unknown, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
}

describe("fetchGreenhouse", () => {
  it("returns postings whose title matches the query, tagged with the board", async () => {
    const fetch = mockFetch({
      jobs: [
        { id: 1, title: "Data Scientist", absolute_url: "https://x/1", location: { name: "Remote" }, updated_at: "2026-01-01" },
        { id: 2, title: "Barista", absolute_url: "https://x/2", location: { name: "NYC" }, updated_at: "2026-01-02" },
      ],
    });
    const result = await fetchGreenhouse(
      { query: "data", greenhouseBoards: ["acme"] },
      { fetch },
    );
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("greenhouse");
    expect((result[0].raw as any).title).toBe("Data Scientist");
    expect((result[0].raw as any)._org).toBe("acme");
  });

  it("throws when no boards are configured", async () => {
    await expect(
      fetchGreenhouse({ query: "data" }, { fetch: mockFetch({}) }),
    ).rejects.toThrow(/board/i);
  });

  it("throws when the API responds non-ok", async () => {
    await expect(
      fetchGreenhouse({ query: "data", greenhouseBoards: ["acme"] }, { fetch: mockFetch({}, false) }),
    ).rejects.toThrow(/greenhouse/i);
  });
});
