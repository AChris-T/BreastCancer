import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { RequestContext } from '../common/request-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditAction =
  | 'USER_REGISTERED'
  | 'EMAIL_VERIFIED'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'LOGOUT'
  | 'REFRESH_TOKEN_REUSE'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'SESSION_REVOKED'
  | 'PROFILE_UPDATED'
  | 'CONSENT_CHANGED'
  | 'ONBOARDING_COMPLETED'
  | 'SCAN_UPLOADED'
  | 'SCAN_REJECTED'
  | 'SCAN_FILE_VIEWED'
  | 'SCAN_DELETED'
  | 'ANALYSIS_COMPLETED'
  | 'ANALYSIS_FAILED'
  | 'ANALYSIS_RETRIED'
  | 'RESULT_VIEWED'
  | 'REPORT_DOWNLOADED'
  | 'FEEDBACK_SUBMITTED'
  | 'SHARE_CREATED'
  | 'SHARE_REVOKED'
  | 'SHARE_VIEWED'
  | 'SHARE_PIN_FAILED'
  | 'DATA_EXPORTED'
  | 'ACCOUNT_DELETION_REQUESTED'
  | 'ACCOUNT_PURGED'
  | 'ADMIN_USER_UNLOCKED'
  | 'ADMIN_JOB_RETRIED'
  | 'ADMIN_CENTRE_CHANGED';

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  context?: RequestContext;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: a failed audit write is logged but does not fail the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          ipAddress: entry.context?.ipAddress,
          userAgent: entry.context?.userAgent,
          metadata: (entry.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
