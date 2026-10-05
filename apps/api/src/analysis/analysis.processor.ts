import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { ScanStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermanentAiError } from './ai-provider.js';
import { AnalysisRunner, UnrecoverableAnalysisError } from './analysis.runner.js';
import { CONCURRENCY, MAX_ATTEMPTS, POLL_INTERVAL_MS, retryDelay } from './queue.js';

/**
 * Postgres-backed analysis queue. Uploads mark a scan QUEUED; this polls for
 * them and claims each one by moving it to PROCESSING, so several worker
 * processes never pick up the same scan. Retries happen in-process; if the
 * process dies mid-job, MaintenanceService.failStuckScans marks the scan
 * failed after 30 min so it can be retried.
 */
@Injectable()
export class AnalysisProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AnalysisProcessor.name);
  private readonly active = new Set<Promise<void>>();
  private readonly shutdown = new AbortController();
  private timer?: NodeJS.Timeout;
  private polling = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AnalysisRunner,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    void this.poll();
  }

  async onApplicationShutdown() {
    this.stopped = true;
    clearInterval(this.timer);
    this.shutdown.abort();
    await Promise.allSettled(this.active);
  }

  private async poll(): Promise<void> {
    if (this.polling || this.stopped) return;
    this.polling = true;
    try {
      while (!this.stopped && this.active.size < CONCURRENCY) {
        const scanId = await this.claimNext();
        if (!scanId) break;
        const job = this.process(scanId).finally(() => this.active.delete(job));
        this.active.add(job);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Could not poll for queued scans');
    } finally {
      this.polling = false;
    }
  }

  private async claimNext(): Promise<string | null> {
    for (;;) {
      const next = await this.prisma.scan.findFirst({
        where: { status: ScanStatus.QUEUED },
        orderBy: { updatedAt: 'asc' },
        select: { id: true },
      });
      if (!next) return null;
      // Only one process can win this update; the others try the next scan.
      const { count } = await this.prisma.scan.updateMany({
        where: { id: next.id, status: ScanStatus.QUEUED },
        data: { status: ScanStatus.PROCESSING, failureReason: null },
      });
      if (count === 1) return next.id;
    }
  }

  private async process(scanId: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.runner.run(scanId);
        return;
      } catch (error) {
        const permanent = error instanceof UnrecoverableAnalysisError || error instanceof PermanentAiError;
        if (permanent || attempt >= MAX_ATTEMPTS) {
          await this.runner.markFailed(scanId, error).catch((err: unknown) => this.logger.error({ scanId, err }, 'Could not mark scan failed'));
          return;
        }
        this.logger.warn({ scanId, attempt, err: error }, 'Analysis attempt failed');
        await sleep(retryDelay(attempt), undefined, { signal: this.shutdown.signal }).catch(() => undefined);
        if (this.stopped) {
          // Hand the scan back so the next worker to start picks it up.
          await this.prisma.scan
            .updateMany({ where: { id: scanId, status: ScanStatus.PROCESSING }, data: { status: ScanStatus.QUEUED } })
            .catch((err: unknown) => this.logger.error({ scanId, err }, 'Could not requeue scan on shutdown'));
          return;
        }
      }
    }
  }
}
