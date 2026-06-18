import type { RawPosting, SearchInput } from "@job/shared";

export type FetchFn = typeof fetch;

export async function fetchGreenhouse(
  input: SearchInput,
  deps: { fetch?: FetchFn } = {},
): Promise<RawPosting[]> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const boards = input.greenhouseBoards ?? [];
  if (boards.length === 0) {
    throw new Error("No Greenhouse boards configured (greenhouseBoards is empty)");
  }
  const q = input.query.toLowerCase();
  const postings: RawPosting[] = [];

  for (const board of boards) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Greenhouse request failed for board "${board}" (status ${res.status})`);
    }
    const data = (await res.json()) as { jobs?: Array<Record<string, unknown>> };
    for (const job of data.jobs ?? []) {
      const title = String(job.title ?? "");
      if (!q || title.toLowerCase().includes(q)) {
        postings.push({ source: "greenhouse", raw: { ...job, _org: board } });
      }
    }
  }
  return postings;
}
