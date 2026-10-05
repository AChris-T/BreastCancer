import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  classify,
  ErrorCode,
  type AnalysisView,
  type ClinicalDetails,
  type Paginated,
  type ScanDetail,
  type ScanSummary,
  type Subtype,
} from '@breastscan/shared';
import { toAnalysisView } from '../analysis/analysis.view.js';
import { AuditService } from '../audit/audit.service.js';
import { CryptoService } from '../common/crypto.service.js';
import { CodedException } from '../common/errors.js';
import type { RequestContext } from '../common/request-context.js';
import { AppConfig } from '../config/config.module.js';
import { ConsentType, ScanStatus, type Prisma, type Scan } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { detectMime, isEncryptedPdf, sanitise, sha256, UploadRejection } from './file-processing.js';
import { MalwareScanner } from './malware-scanner.js';
import { toClinicalDetails, type FeedbackDto, type ListScansQuery, type UploadScanDto } from './scans.dto.js';

type ScanWithAnalysis = Scan & { analysis: { createdAt: Date } | null };

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly crypto: CryptoService,
    private readonly scanner: MalwareScanner,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async upload(userId: string, file: Express.Multer.File | undefined, dto: UploadScanDto, context: RequestContext): Promise<ScanDetail> {
    if (!file) throw new BadRequestException('Choose a file to upload');
    await this.assertCanUpload(userId);

    let mime;
    try {
      mime = await detectMime(file.buffer);
      if (mime === 'application/pdf' && isEncryptedPdf(file.buffer)) {
        throw new UploadRejection('This PDF is password-protected. Remove the password and upload it again.');
      }
    } catch (error) {
      if (error instanceof UploadRejection) throw new UnprocessableEntityException(error.message);
      throw error;
    }

    const hash = sha256(file.buffer);
    const verdict = await this.scanner.scan(file.buffer);
    if (!verdict.clean) {
      // The file is discarded; only a record of the rejection is kept.
      const rejected = await this.prisma.scan.create({
        data: {
          userId,
          declaredType: dto.declaredType,
          storageKey: '',
          mimeType: mime,
          sizeBytes: file.size,
          sha256: hash,
          status: ScanStatus.REJECTED,
          failureReason: 'The file failed the virus check and was deleted',
        },
      });
      await this.audit.log({
        action: 'SCAN_REJECTED',
        userId,
        entityType: 'Scan',
        entityId: rejected.id,
        context,
        metadata: { signature: verdict.signature },
      });
      throw new UnprocessableEntityException('This file failed our virus check and was deleted.');
    }

    let clean;
    try {
      clean = await sanitise(file.buffer, mime);
    } catch (error) {
      if (error instanceof UploadRejection) throw new UnprocessableEntityException(error.message);
      throw error;
    }

    const clinical = toClinicalDetails(dto);
    const id = randomUUID();
    const storageKey = `scans/${userId}/${id}.${clean.extension}`;
    await this.storage.put(storageKey, clean.buffer, clean.mimeType);
    let scan = await this.prisma.scan.create({
      data: {
        id,
        userId,
        declaredType: dto.declaredType,
        examDate: dto.examDate ? new Date(`${dto.examDate.slice(0, 10)}T00:00:00Z`) : null,
        notes: this.crypto.encryptNullable(dto.notes ?? null),
        clinicalDetails: this.crypto.encryptJson(clinical),
        classification: classify(clinical).subtype,
        patientRefHash: clinical.patientRef ? this.patientRefHash(clinical.patientRef) : null,
        storageKey,
        mimeType: clean.mimeType,
        sizeBytes: clean.buffer.length,
        sha256: hash,
        status: ScanStatus.UPLOADED,
      },
    });
    await this.audit.log({
      action: 'SCAN_UPLOADED',
      userId,
      entityType: 'Scan',
      entityId: id,
      context,
      metadata: { declaredType: dto.declaredType, mimeType: clean.mimeType, sizeBytes: clean.buffer.length },
    });
    scan = await this.enqueue(scan);
    return this.toDetail({ ...scan, analysis: null });
  }

  async list(userId: string, query: ListScansQuery): Promise<Paginated<ScanSummary>> {
    const where: Prisma.ScanWhereInput = {
      userId,
      status: { not: ScanStatus.REJECTED },
      ...(query.type ? { declaredType: query.type } : {}),
      ...(query.classification ? { classification: query.classification } : {}),
      ...(query.search ? { patientRefHash: this.patientRefHash(query.search) } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: endOfDay(query.to) } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.scan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { analysis: { select: { createdAt: true } } },
      }),
      this.prisma.scan.count({ where }),
    ]);
    return { items: items.map((s) => this.toSummary(s)), page: query.page, pageSize: query.pageSize, total };
  }

  async get(userId: string, scanId: string): Promise<ScanDetail> {
    const scan = await this.findOwned(userId, scanId, { analysis: { select: { createdAt: true } } });
    return this.toDetail(scan);
  }

  async fileUrl(userId: string, scanId: string, context: RequestContext) {
    const scan = await this.findOwned(userId, scanId);
    if (!scan.storageKey) throw new NotFoundException('The original file is no longer available');
    await this.audit.log({ action: 'SCAN_FILE_VIEWED', userId, entityType: 'Scan', entityId: scanId, context });
    return { ...(await this.storage.signedUrl(scan.storageKey, scan.mimeType)), mimeType: scan.mimeType };
  }

  async delete(userId: string, scanId: string, context: RequestContext): Promise<void> {
    const scan = await this.findOwned(userId, scanId);
    await this.prisma.scan.delete({ where: { id: scan.id } });
    await this.storage.delete(scan.storageKey).catch((err: unknown) => this.logger.error({ err, scanId }, 'Failed to delete file'));
    await this.audit.log({ action: 'SCAN_DELETED', userId, entityType: 'Scan', entityId: scanId, context });
  }

  async getAnalysis(userId: string, scanId: string, context: RequestContext): Promise<AnalysisView> {
    const scan = await this.findOwned(userId, scanId, { analysis: { include: { feedback: true } } });
    if (!scan.analysis) throw new NotFoundException('The analysis is not ready yet');
    await this.audit.log({ action: 'RESULT_VIEWED', userId, entityType: 'Analysis', entityId: scan.analysis.id, context });
    return toAnalysisView(scan.analysis, this.clinicalOf(scan));
  }

  async retry(userId: string, scanId: string, context: RequestContext): Promise<ScanDetail> {
    const scan = await this.findOwned(userId, scanId, { analysis: { select: { id: true } } });
    if (scan.status !== ScanStatus.FAILED) throw new ConflictException('Only a failed analysis can be retried');
    await this.assertHealthConsent(userId);
    await this.audit.log({ action: 'ANALYSIS_RETRIED', userId, entityType: 'Scan', entityId: scanId, context });
    const updated = await this.enqueue(scan);
    return this.toDetail({ ...updated, analysis: null });
  }

  async feedback(userId: string, analysisId: string, dto: FeedbackDto, context: RequestContext) {
    const analysis = await this.prisma.analysis.findFirst({ where: { id: analysisId, scan: { userId } } });
    if (!analysis) throw new NotFoundException('Result not found');
    const data = { helpful: dto.helpful, doctorAgreed: dto.doctorAgreed ?? null, comment: dto.comment?.trim() || null };
    const feedback = await this.prisma.feedback.upsert({
      where: { analysisId },
      create: { analysisId, ...data },
      update: data,
    });
    await this.audit.log({ action: 'FEEDBACK_SUBMITTED', userId, entityType: 'Analysis', entityId: analysisId, context });
    return { helpful: feedback.helpful, doctorAgreed: feedback.doctorAgreed, comment: feedback.comment };
  }

  /** The worker (AnalysisProcessor) picks up QUEUED scans from the database. */
  private enqueue(scan: Scan): Promise<Scan> {
    return this.prisma.scan.update({
      where: { id: scan.id },
      data: { status: ScanStatus.QUEUED, failureReason: null },
    });
  }

  private async assertCanUpload(userId: string) {
    await this.assertHealthConsent(userId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.scan.count({ where: { userId, createdAt: { gte: since } } });
    const limit = this.config.get('UPLOADS_PER_DAY');
    if (recent >= limit) {
      throw new CodedException(
        HttpStatus.TOO_MANY_REQUESTS,
        `You can upload up to ${limit} files in 24 hours. Please try again later.`,
        ErrorCode.UPLOAD_LIMIT_REACHED,
      );
    }
  }

  private async assertHealthConsent(userId: string) {
    const consent = await this.prisma.consent.findFirst({
      where: { userId, type: ConsentType.HEALTH_DATA },
      orderBy: { createdAt: 'desc' },
    });
    if (!consent?.granted) {
      throw new CodedException(
        HttpStatus.FORBIDDEN,
        'You have withdrawn consent to process health data. Turn it back on in Settings to analyse scans.',
        ErrorCode.HEALTH_CONSENT_REQUIRED,
      );
    }
  }

  /** Every read goes through here, so a scan is only ever returned to its owner. */
  private async findOwned<I extends Prisma.ScanInclude>(userId: string, scanId: string, include?: I) {
    const scan = await this.prisma.scan.findFirst({ where: { id: scanId, userId }, include: include as I });
    if (!scan) throw new NotFoundException('Scan not found');
    return scan as Prisma.ScanGetPayload<{ include: I }>;
  }

  /** Decrypted clinical details; null for cases created before they were collected. */
  clinicalOf(scan: Pick<Scan, 'clinicalDetails'>): ClinicalDetails | null {
    return this.crypto.decryptJson<ClinicalDetails>(scan.clinicalDetails);
  }

  private patientRefHash(ref: string): string {
    return this.crypto.hash(`patient-ref:${ref.trim().toUpperCase().replace(/s+/g, '')}`);
  }

  private toSummary(scan: ScanWithAnalysis): ScanSummary {
    return {
      id: scan.id,
      declaredType: scan.declaredType,
      examDate: scan.examDate?.toISOString().slice(0, 10) ?? null,
      status: scan.status,
      failureReason: scan.failureReason,
      mimeType: scan.mimeType,
      sizeBytes: scan.sizeBytes,
      createdAt: scan.createdAt.toISOString(),
      patientRef: this.clinicalOf(scan)?.patientRef ?? null,
      classification: scan.classification as Subtype,
      analysedAt: scan.analysis?.createdAt.toISOString() ?? null,
    };
  }

  private toDetail(scan: ScanWithAnalysis): ScanDetail {
    return {
      ...this.toSummary(scan),
      notes: this.crypto.decryptNullable(scan.notes),
      clinical: this.clinicalOf(scan),
    };
  }
}

function endOfDay(date: string) {
  const d = new Date(date);
  if (date.length <= 10) d.setUTCHours(23, 59, 59, 999);
  return d;
}
