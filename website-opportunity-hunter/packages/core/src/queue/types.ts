export const JOB_TYPES = ['search.run', 'company.enrich', 'company.rescore'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface JobPayloads {
  'search.run': { searchRunId: string };
  'company.enrich': { companyId: string; requestedIndustryKeys?: string[] };
  'company.rescore': { companyId: string };
}

export type JobHandler<T extends JobType = JobType> = (payload: JobPayloads[T]) => Promise<void>;

export type JobHandlers = { [K in JobType]: JobHandler<K> };

export interface JobQueue {
  readonly driver: 'inline' | 'redis';
  enqueue<T extends JobType>(type: T, payload: JobPayloads[T]): Promise<string>;
  /** Best-effort health probe for the System Health page. */
  health(): Promise<{ ok: boolean; detail: string }>;
  close(): Promise<void>;
}

export const QUEUE_NAME = 'woh-jobs';
