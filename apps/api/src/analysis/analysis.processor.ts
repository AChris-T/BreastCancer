import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { PermanentAiError } from './ai-provider.js';
import { AnalysisRunner, UnrecoverableAnalysisError } from './analysis.runner.js';
import { ANALYSIS_QUEUE, type AnalyzeScanJob, retryDelay } from './queue.js';

@Processor(ANALYSIS_QUEUE, {
  concurrency: 2,
  settings: { backoffStrategy: (attemptsMade: number) => retryDelay(attemptsMade) },
})
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly runner: AnalysisRunner) {
    super();
  }

  async process(job: Job<AnalyzeScanJob>): Promise<void> {
    try {
      await this.runner.run(job.data.scanId);
    } catch (error) {
      if (error instanceof UnrecoverableAnalysisError || error instanceof PermanentAiError) {
        // Tells BullMQ not to retry; the 'failed' handler below records it.
        const permanent = new UnrecoverableError(error.message);
        permanent.cause = error;
        throw permanent;
      }
      this.logger.warn({ scanId: job.data.scanId, attempt: job.attemptsMade + 1, err: error }, 'Analysis attempt failed');
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AnalyzeScanJob> | undefined, error: Error) {
    if (!job) return;
    const finalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (error instanceof UnrecoverableError || error.name === 'UnrecoverableError' || finalAttempt) {
      await this.runner.markFailed(job.data.scanId, error.cause ?? error);
    }
  }
}
