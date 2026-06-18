import { NextResponse } from "next/server";
import { tasks, runs } from "@trigger.dev/sdk";
import type { FetchResult, SearchInput } from "@job/shared";

export async function POST(request: Request) {
  const input = (await request.json()) as SearchInput;
  // tasks.trigger fires the task without blocking (valid from any backend context).
  // Requires TRIGGER_SECRET_KEY in env at runtime.
  const handle = await tasks.trigger("search-jobs", input as any);
  // runs.poll blocks until the run reaches a terminal state.
  const run = await runs.poll(handle.id, { pollIntervalMs: 1500 });
  if (run.status !== "COMPLETED" || run.output == null) {
    return NextResponse.json({ error: `task ${run.status}` }, { status: 502 });
  }
  return NextResponse.json(run.output as FetchResult);
}
