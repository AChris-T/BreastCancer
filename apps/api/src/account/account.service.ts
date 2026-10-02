import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { verifyPassword } from '../auth/password.js';
import { SessionsService } from '../auth/sessions.service.js';
import { CryptoService } from '../common/crypto.service.js';
import type { RequestContext } from '../common/request-context.js';
import { AppConfig } from '../config/config.module.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** Streams a zip with everything held about the user: data.json plus original files. */
  async export(userId: string, res: Response, context: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: true,
        consents: { orderBy: { createdAt: 'asc' } },
        scans: { include: { analysis: { include: { feedback: true } }, shareLinks: true }, orderBy: { createdAt: 'asc' } },
        notifications: { orderBy: { createdAt: 'asc' } },
        sessions: { orderBy: { createdAt: 'asc' } },
      },
    });

    const data = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
        twoFactorEnabled: !!user.twoFactorEnabledAt,
        lastLoginAt: user.lastLoginAt,
        emailNotifications: user.emailNotifications,
      },
      name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : null,
      consents: user.consents.map((c) => ({ type: c.type, granted: c.granted, version: c.version, at: c.createdAt })),
      scans: user.scans.map((s) => ({
        id: s.id,
        declaredType: s.declaredType,
        examDate: s.examDate,
        notes: this.crypto.decryptNullable(s.notes),
        clinicalDetails: this.crypto.decryptJson(s.clinicalDetails),
        ruleClassification: s.classification,
        mimeType: s.mimeType,
        sizeBytes: s.sizeBytes,
        sha256: s.sha256,
        status: s.status,
        failureReason: s.failureReason,
        uploadedAt: s.createdAt,
        file: s.storageKey ? `files/${fileName(s.storageKey)}` : null,
        analysis: s.analysis
          ? {
              detectedType: s.analysis.detectedType,
              imageQuality: s.analysis.imageQuality,
              aiSubtype: s.analysis.aiSubtype,
              aiReasoning: s.analysis.aiReasoning,
              keyFindings: s.analysis.keyFindings,
              detailedAnalysis: s.analysis.detailedAnalysis,
              summary: s.analysis.plainSummary,
              recommendations: s.analysis.nextSteps,
              limitations: s.analysis.limitations,
              model: s.analysis.model,
              promptVersion: s.analysis.promptVersion,
              analysedAt: s.analysis.createdAt,
              rawModelResponse: safeJson(this.crypto.decrypt(s.analysis.rawResponse)),
              feedback: s.analysis.feedback,
            }
          : null,
        shareLinks: s.shareLinks.map((l) => ({
          createdAt: l.createdAt,
          expiresAt: l.expiresAt,
          revokedAt: l.revokedAt,
          viewCount: l.viewCount,
          pinProtected: !!l.pinHash,
        })),
      })),
      notifications: user.notifications.map((n) => ({ type: n.type, title: n.title, body: n.body, at: n.createdAt, readAt: n.readAt })),
      sessions: user.sessions.map((s) => ({ createdAt: s.createdAt, userAgent: s.userAgent, ipAddress: s.ipAddress, revokedAt: s.revokedAt })),
    };

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('warning', (err: Error) => this.logger.warn({ err }, 'Export archive warning'));
    archive.on('error', (err: Error) => {
      this.logger.error({ err }, 'Export archive failed');
      res.destroy(err);
    });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="breastscan-export-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Cache-Control': 'private, no-store',
    });
    archive.pipe(res);
    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });
    archive.append(EXPORT_README, { name: 'README.txt' });
    for (const scan of user.scans) {
      if (!scan.storageKey) continue;
      try {
        archive.append(await this.storage.get(scan.storageKey), { name: `files/${fileName(scan.storageKey)}` });
      } catch (err) {
        this.logger.error({ err, scanId: scan.id }, 'Could not add file to export');
      }
    }
    await archive.finalize();
    await this.audit.log({ action: 'DATA_EXPORTED', userId, context });
  }

  /** Signs the user out everywhere and schedules a hard delete after the grace period. */
  async requestDeletion(userId: string, password: string, context: RequestContext): Promise<{ deleteAfter: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, password))) throw new BadRequestException('Your password is not right');
    const graceDays = this.config.get('ACCOUNT_DELETION_GRACE_DAYS');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: now } }),
      this.prisma.shareLink.updateMany({ where: { scan: { userId }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.sessions.revokeAll(userId);
    await this.audit.log({ action: 'ACCOUNT_DELETION_REQUESTED', userId, context, metadata: { graceDays } });
    this.mail.sendQuietly(mailTemplates.accountDeletion(user.email, graceDays));
    return { deleteAfter: new Date(now.getTime() + graceDays * 86_400_000).toISOString() };
  }
}

function fileName(storageKey: string) {
  return storageKey.split('/').at(-1)!;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const EXPORT_README = `BreastScan AI data export

data.json  Your account, cases (clinical details, classifications, AI results), share links, notifications and sign-in sessions.
files/     The files you uploaded, as stored after we removed location and camera metadata.

AI results are screening aids, not diagnoses. Please discuss them with a qualified clinician.
`;
