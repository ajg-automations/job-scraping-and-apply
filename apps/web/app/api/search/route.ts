import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import type { FetchResult, SearchInput } from "@job/shared";

export async function POST(request: Request) {
  const input = (await request.json()) as SearchInput;
  // triggerAndWait triggers the task by id and waits for its result.
  // Requires TRIGGER_SECRET_KEY in env at runtime.
  const result = await tasks.triggerAndWait("search-jobs", input);
  if (!result.ok) {
    return NextResponse.json({ error: "task failed" }, { status: 502 });
  }
  return NextResponse.json(result.output as FetchResult);
}
