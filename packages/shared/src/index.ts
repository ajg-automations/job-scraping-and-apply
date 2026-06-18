export type SourceName = "greenhouse" | "adzuna";

export interface SearchInput {
  query: string;
  location?: string;
  sources?: SourceName[];
  /** Greenhouse board tokens (company slugs) to query. */
  greenhouseBoards?: string[];
}

/** A posting as returned by a source adapter, before normalization. */
export interface RawPosting {
  source: SourceName;
  raw: unknown;
}

/** A unified posting after normalization. */
export interface JobPosting {
  id: string;
  source: SourceName;
  title: string;
  org: string;
  location?: string;
  summary?: string;
  applyUrl: string;
  postedAt?: string;
}

export interface SkippedSource {
  source: SourceName;
  reason: string;
}

/** Output of fetchJobs: raw postings plus any sources that were skipped. */
export interface FetchRawResult {
  raw: RawPosting[];
  skippedSources: SkippedSource[];
}

/** Final search output returned to the frontend. */
export interface FetchResult {
  postings: JobPosting[];
  skippedSources: SkippedSource[];
}
