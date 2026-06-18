import type { RawPosting, SearchInput } from "@job/shared";
import type { FetchFn } from "./greenhouse";

export async function fetchAdzuna(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<RawPosting[]> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna credentials missing (set ADZUNA_APP_ID and ADZUNA_APP_KEY)");
  }
  const country = "us";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: input.query,
    results_per_page: "20",
  });
  if (input.location) params.set("where", input.location);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Adzuna request failed (status ${res.status})`);
  }
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r) => ({ source: "adzuna" as const, raw: r }));
}
