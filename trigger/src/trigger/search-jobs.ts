import { task } from "@trigger.dev/sdk";
import type { FetchResult, SearchInput } from "@job/shared";
import { fetchJobs, normalizePostings } from "@job/tools";

export const searchJobs = task({
  id: "search-jobs",
  run: async (payload: SearchInput): Promise<FetchResult> => {
    const { raw, skippedSources } = await fetchJobs(payload);
    return { postings: normalizePostings(raw), skippedSources };
  },
});
