import type { JobsOptions } from 'bullmq';

export const ANALYSIS_QUEUE = 'analysis';
export const ANALYZE_SCAN_JOB = 'analyze-scan';

export interface AnalyzeScanJob {
  scanId: string;
}

/** Delays before retries 1, 2 and 3: 10 s, 60 s, 5 min. */
export const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];

export const ANALYZE_JOB_OPTIONS: JobsOptions = {
  // The first try plus one retry per delay above.
  attempts: RETRY_DELAYS_MS.length + 1,
  backoff: { type: 'custom' },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export function retryDelay(attemptsMade: number): number {
  return RETRY_DELAYS_MS[Math.min(attemptsMade, RETRY_DELAYS_MS.length) - 1] ?? RETRY_DELAYS_MS.at(-1)!;
}

export function analysisJobId(scanId: string): string {
  return `scan-${scanId}-${Date.now()}`;
}
