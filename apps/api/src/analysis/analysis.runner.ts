import { Injectable, Logger } from '@nestjs/common';
import { modelResultSchema, SUBTYPE_LABELS, type ClinicalDetails, type ModelResult } from '@breastscan/shared';
import { AuditService } from '../audit/audit.service.js';
import { CryptoService } from '../common/crypto.service.js';
import { AppConfig } from '../config/config.module.js';
import { ConsentType, Prisma, ScanStatus } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AiProvider, type AnalyzeInput, PermanentAiError } from './ai-provider.js';
import { PROMPT_VERSION } from './prompts/v2.js';
import { applySafetyRules } from './safety-rules.js';

/** Thrown when retrying the job cannot help. */
export class UnrecoverableAnalysisError extends Error {}

type ParseResult = { ok: true; value: ModelResult } | { ok: false; problems: string };

export function parseModelOutput(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch (error) {
    return { ok: false, problems: `Invalid JSON: ${(error as Error).message}` };
  }
  const parsed = modelResultSchema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n') };
}

@Injectable()
export class AnalysisRunner {
  private readonly logger = new Logger(AnalysisRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly ai: AiProvider,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async run(scanId: string): Promise<void> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { user: true, analysis: { select: { id: true } } },
    });
    if (!scan || scan.analysis || scan.status === ScanStatus.COMPLETED || scan.status === ScanStatus.REJECTED) {
      this.logger.warn({ scanId }, 'Skipping analysis: scan missing or already finished');
      return;
    }
    if (scan.user.deletedAt) throw new UnrecoverableAnalysisError('Account is being deleted');
    if (!(await this.hasHealthConsent(scan.userId))) {
      throw new UnrecoverableAnalysisError('Consent to process health data has been withdrawn');
    }

    await this.prisma.scan.update({ where: { id: scanId }, data: { status: ScanStatus.PROCESSING, failureReason: null } });

    const input: AnalyzeInput = {
      file: await this.storage.get(scan.storageKey),
      mimeType: scan.mimeType,
      context: { declaredType: scan.declaredType, clinical: this.crypto.decryptJson<ClinicalDetails>(scan.clinicalDetails) },
    };

    const started = Date.now();
    let reply = await this.ai.analyze(input);
    let parsed = parseModelOutput(reply.text);
    let inputTokens = reply.inputTokens ?? 0;
    let outputTokens = reply.outputTokens ?? 0;
    if (!parsed.ok) {
      this.logger.warn({ scanId, problems: parsed.problems }, 'Model output failed validation; asking for a repair');
      reply = await this.ai.repair(input, reply.text, parsed.problems);
      inputTokens += reply.inputTokens ?? 0;
      outputTokens += reply.outputTokens ?? 0;
      parsed = parseModelOutput(reply.text);
      if (!parsed.ok) throw new UnrecoverableAnalysisError('The AI returned an invalid result twice');
    }
    const latencyMs = Date.now() - started;
    const safe = applySafetyRules(parsed.value);

    const analysis = await this.prisma.$transaction(async (tx) => {
      const created = await tx.analysis.create({
        data: {
          scanId,
          detectedType: safe.detectedType,
          imageQuality: safe.imageQuality,
          aiSubtype: safe.aiSubtype,
          aiReasoning: safe.aiReasoning,
          aiConflict: safe.aiConflict,
          morphology: safe.morphology ? (safe.morphology as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          keyFindings: safe.keyFindings as unknown as Prisma.InputJsonValue,
          detailedAnalysis: safe.detailedAnalysis,
          plainSummary: safe.summary,
          nextSteps: safe.recommendations,
          limitations: safe.limitations,
          rawResponse: this.crypto.encrypt(reply.text),
          safetyFlags: safe.flags,
          model: reply.model,
          promptVersion: PROMPT_VERSION,
          latencyMs,
          inputTokens,
          outputTokens,
        },
      });
      await tx.scan.update({ where: { id: scanId }, data: { status: ScanStatus.COMPLETED, failureReason: null } });
      return created;
    });

    this.logger.log({ scanId, aiSubtype: safe.aiSubtype, latencyMs, inputTokens, outputTokens, flags: safe.flags }, 'Analysis complete');
    await this.audit.log({
      action: 'ANALYSIS_COMPLETED',
      userId: scan.userId,
      entityType: 'Analysis',
      entityId: analysis.id,
      metadata: { model: reply.model, promptVersion: PROMPT_VERSION, latencyMs, safetyFlags: safe.flags },
    });

    const link = `${this.config.get('FRONTEND_URL')}/scans/${scanId}`;
    await this.notifications.create(scan.userId, {
      type: 'ANALYSIS_READY',
      title: 'Classification ready',
      body: `AI suggestion: ${SUBTYPE_LABELS[safe.aiSubtype]}. Open the case to compare it with the rule-based class.`,
      link: `/scans/${scanId}`,
    });
    if (scan.user.emailNotifications) this.mail.sendQuietly(mailTemplates.analysisReady(scan.user.email, link));
  }

  /** Called once the job has used its last attempt or failed permanently. */
  async markFailed(scanId: string, error: unknown): Promise<void> {
    const reason =
      error instanceof UnrecoverableAnalysisError
        ? error.message
        : error instanceof PermanentAiError
          ? 'The AI service could not process this file'
          : 'The AI service was unavailable. Please try again later.';
    const scan = await this.prisma.scan.update({
      where: { id: scanId },
      data: { status: ScanStatus.FAILED, failureReason: reason },
      include: { user: { select: { email: true, emailNotifications: true, deletedAt: true } } },
    });
    this.logger.error({ scanId, err: error }, 'Analysis failed');
    await this.audit.log({
      action: 'ANALYSIS_FAILED',
      userId: scan.userId,
      entityType: 'Scan',
      entityId: scanId,
      metadata: { reason, error: error instanceof Error ? error.message : String(error) },
    });
    if (scan.user.deletedAt) return;
    await this.notifications.create(scan.userId, {
      type: 'ANALYSIS_FAILED',
      title: 'We could not analyse your upload',
      body: 'You can try again from the scan page.',
      link: `/scans/${scanId}`,
    });
    if (scan.user.emailNotifications) {
      this.mail.sendQuietly(mailTemplates.analysisFailed(scan.user.email, `${this.config.get('FRONTEND_URL')}/scans/${scanId}`));
    }
  }

  private async hasHealthConsent(userId: string): Promise<boolean> {
    const latest = await this.prisma.consent.findFirst({
      where: { userId, type: ConsentType.HEALTH_DATA },
      orderBy: { createdAt: 'desc' },
    });
    return !!latest?.granted;
  }
}
