/** Delays before retries 1, 2 and 3: 10 s, 60 s, 5 min. */
export const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];

/** The first try plus one retry per delay above. */
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** Scans analysed at once by one worker process. */
export const CONCURRENCY = 2;

/** How often the worker looks for QUEUED scans in the database. */
export const POLL_INTERVAL_MS = 2_000;

export function retryDelay(attemptsMade: number): number {
  return RETRY_DELAYS_MS[Math.min(attemptsMade, RETRY_DELAYS_MS.length) - 1] ?? RETRY_DELAYS_MS.at(-1)!;
}
