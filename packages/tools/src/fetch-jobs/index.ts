import type { FetchRawResult, RawPosting, SearchInput, SkippedSource } from "@job/shared";
import { fetchGreenhouse, type FetchFn } from "./greenhouse";
import { fetchAdzuna } from "./adzuna";

export async function fetchJobs(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<FetchRawResult> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const sources = input.sources ?? ["greenhouse", "adzuna"];
  const raw: RawPosting[] = [];
  const skippedSources: SkippedSource[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        if (source === "greenhouse") {
          raw.push(...(await fetchGreenhouse(input, { fetch: fetchImpl })));
        } else if (source === "adzuna") {
          raw.push(...(await fetchAdzuna(input, { fetch: fetchImpl })));
        }
      } catch (err) {
        skippedSources.push({
          source,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  return { raw, skippedSources };
}

export { fetchGreenhouse, fetchAdzuna };
export type { FetchFn };
