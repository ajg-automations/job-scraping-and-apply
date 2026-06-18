import type { JobPosting, RawPosting } from "@job/shared";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function normalizeGreenhouse(raw: Record<string, any>): JobPosting {
  return {
    id: `greenhouse:${raw.id}`,
    source: "greenhouse",
    title: String(raw.title ?? ""),
    org: str(raw._org) ?? "Unknown",
    location: str(raw.location?.name),
    applyUrl: String(raw.absolute_url ?? ""),
    postedAt: str(raw.updated_at),
  };
}

function normalizeAdzuna(raw: Record<string, any>): JobPosting {
  return {
    id: `adzuna:${raw.id}`,
    source: "adzuna",
    title: String(raw.title ?? ""),
    org: str(raw.company?.display_name) ?? "Unknown",
    location: str(raw.location?.display_name),
    summary: str(raw.description),
    applyUrl: String(raw.redirect_url ?? ""),
    postedAt: str(raw.created),
  };
}

export function normalizePostings(raw: RawPosting[]): JobPosting[] {
  return raw.map((p) =>
    p.source === "greenhouse"
      ? normalizeGreenhouse(p.raw as Record<string, any>)
      : normalizeAdzuna(p.raw as Record<string, any>),
  );
}
