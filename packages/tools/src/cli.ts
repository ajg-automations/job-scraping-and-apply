import type { FetchResult, SearchInput } from "@job/shared";
import { fetchJobs } from "./fetch-jobs/index.ts";
import { normalizePostings } from "./normalize-postings/index.ts";

async function main() {
  const [, , command, json] = process.argv;
  if (!command || !json) {
    console.error('Usage: pnpm tool <fetch-jobs|normalize-postings|search> \'<json>\'');
    process.exit(1);
  }
  const input = JSON.parse(json);

  if (command === "fetch-jobs") {
    const result = await fetchJobs(input as SearchInput);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "normalize-postings") {
    console.log(JSON.stringify(normalizePostings(input), null, 2));
  } else if (command === "search") {
    const { raw, skippedSources } = await fetchJobs(input as SearchInput);
    const result: FetchResult = { postings: normalizePostings(raw), skippedSources };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
