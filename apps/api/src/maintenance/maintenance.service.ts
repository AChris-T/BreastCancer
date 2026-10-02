import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service.js';
import { AppConfig } from '../config/config.module.js';
import { ScanStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

/** Scheduled housekeeping. Runs in the worker process. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** Permanently removes accounts whose deletion grace period has ended, including their files. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeDeletedAccounts(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.get('ACCOUNT_DELETION_GRACE_DAYS') * 86_400_000);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: { lte: cutoff } },
      select: { id: true, scans: { select: { storageKey: true } } },
    });
    for (const user of users) {
      for (const { storageKey } of user.scans) {
        await this.storage.delete(storageKey).catch((err: unknown) => this.logger.error({ err }, 'Could not delete file'));
      }
      await this.prisma.user.delete({ where: { id: user.id } });
      // The user row is gone, so the record keeps only the former id.
      await this.audit.log({ action: 'ACCOUNT_PURGED', entityType: 'User', entityId: user.id });
    }
    if (users.length) this.logger.log(`Purged ${users.length} deleted account(s)`);
    return users.length;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanUpTokens(): Promise<void> {
    const now = new Date();
    const old = new Date(Date.now() - 30 * 86_400_000);
    await this.prisma.verificationToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } });
    await this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: old } }, { revokedAt: { lt: old } }] } });
  }

  /** Scans stuck in processing (e.g. the worker died mid-job) are marked failed so they can be retried. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async failStuckScans(): Promise<void> {
    const { count } = await this.prisma.scan.updateMany({
      where: { status: ScanStatus.PROCESSING, updatedAt: { lt: new Date(Date.now() - 30 * 60_000) } },
      data: { status: ScanStatus.FAILED, failureReason: 'The analysis took too long. Please try again.' },
    });
    if (count) this.logger.warn(`Marked ${count} stuck scan(s) as failed`);
  }
}

@Module({ providers: [MaintenanceService], exports: [MaintenanceService] })
export class MaintenanceModule {}
