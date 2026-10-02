import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import type { Response } from 'express';
import {
  ErrorCode,
  SHARE_MAX_HOURS,
  SHARE_MIN_HOURS,
  type ClinicalDetails,
  type CreatedShareLink,
  type SharedResultView,
  type ShareLinkView,
} from '@breastscan/shared';
import { toAnalysisView } from '../analysis/analysis.view.js';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { type AuthenticatedUser, CurrentUser, Public } from '../auth/decorators.js';
import { CryptoService } from '../common/crypto.service.js';
import { CodedException } from '../common/errors.js';
import { ReqContext, type RequestContext } from '../common/request-context.js';
import { AppConfig } from '../config/config.module.js';
import { ScanStatus, type Scan, type ShareLink } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { sendPdf } from '../scans/scans.controller.js';
import { ScansModule } from '../scans/scans.module.js';
import { StorageService } from '../storage/storage.service.js';

const MAX_PIN_FAILURES = 10;

export class CreateShareDto {
  @IsInt()
  @Min(SHARE_MIN_HOURS)
  @Max(SHARE_MAX_HOURS)
  expiresInHours: number;

  @IsOptional()
  @Matches(/^[0-9]{4,6}$/, { message: 'The PIN must be 4 to 6 digits' })
  pin?: string;
}

@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async create(userId: string, scanId: string, dto: CreateShareDto, context: RequestContext): Promise<CreatedShareLink> {
    const scan = await this.prisma.scan.findFirst({ where: { id: scanId, userId }, include: { analysis: { select: { id: true } } } });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.status !== ScanStatus.COMPLETED || !scan.analysis) throw new ConflictException('Only a finished result can be shared');

    const token = this.crypto.randomToken();
    const link = await this.prisma.shareLink.create({
      data: {
        scanId,
        tokenHash: this.crypto.hash(token),
        pinHash: dto.pin ? await hashPassword(dto.pin) : null,
        expiresAt: new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000),
      },
    });
    await this.audit.log({
      action: 'SHARE_CREATED',
      userId,
      entityType: 'ShareLink',
      entityId: link.id,
      context,
      metadata: { scanId, expiresInHours: dto.expiresInHours, pin: !!dto.pin },
    });
    return { ...this.toView(link, scan), url: `${this.config.get('FRONTEND_URL')}/s/${token}` };
  }

  async list(userId: string): Promise<ShareLinkView[]> {
    const links = await this.prisma.shareLink.findMany({
      where: { scan: { userId } },
      include: { scan: true },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((l) => this.toView(l, l.scan));
  }

  async revoke(userId: string, id: string, context: RequestContext): Promise<void> {
    const { count } = await this.prisma.shareLink.updateMany({
      where: { id, scan: { userId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Share link not found or already revoked');
    await this.audit.log({ action: 'SHARE_REVOKED', userId, entityType: 'ShareLink', entityId: id, context });
  }

  /** Resolves a public token and checks its PIN; counts the view only when `countView`. */
  async open(token: string, pin: string | undefined, context: RequestContext, countView: boolean) {
    const link = await this.prisma.shareLink.findUnique({
      where: { tokenHash: this.crypto.hash(token) },
      include: { scan: { include: { analysis: true, user: { include: { profile: true } } } } },
    });
    if (!link || link.revokedAt || link.expiresAt < new Date() || !link.scan.analysis || link.scan.user.deletedAt) {
      throw new NotFoundException('This link has expired or been turned off by the patient.');
    }
    if (link.pinHash) {
      if (!pin) throw new CodedException(HttpStatus.UNAUTHORIZED, 'Enter the PIN the patient gave you', ErrorCode.PIN_REQUIRED);
      if (!(await verifyPassword(link.pinHash, pin))) {
        const failures = link.pinFailedCount + 1;
        await this.prisma.shareLink.update({
          where: { id: link.id },
          data: { pinFailedCount: failures, ...(failures >= MAX_PIN_FAILURES ? { revokedAt: new Date() } : {}) },
        });
        await this.audit.log({
          action: 'SHARE_PIN_FAILED',
          userId: link.scan.userId,
          entityType: 'ShareLink',
          entityId: link.id,
          context,
          metadata: { failures, revoked: failures >= MAX_PIN_FAILURES },
        });
        throw new UnauthorizedException(
          failures >= MAX_PIN_FAILURES ? 'Too many wrong PINs. This link has been turned off.' : 'That PIN is not right',
        );
      }
    }
    if (countView) {
      await this.prisma.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 } } });
      await this.audit.log({ action: 'SHARE_VIEWED', userId: link.scan.userId, entityType: 'ShareLink', entityId: link.id, context });
    }
    return link;
  }

  private toView(link: ShareLink, scan: Scan): ShareLinkView {
    return {
      id: link.id,
      scanId: link.scanId,
      expiresAt: link.expiresAt.toISOString(),
      revokedAt: link.revokedAt?.toISOString() ?? null,
      viewCount: link.viewCount,
      hasPin: !!link.pinHash,
      createdAt: link.createdAt.toISOString(),
      active: !link.revokedAt && link.expiresAt > new Date(),
      scanType: scan.declaredType,
      patientRef: this.crypto.decryptJson<ClinicalDetails>(scan.clinicalDetails)?.patientRef ?? null,
    };
  }

  async view(token: string, pin: string | undefined, context: RequestContext): Promise<SharedResultView> {
    const link = await this.open(token, pin, context, true);
    const { scan } = link;
    const doctor = scan.user.profile;
    const clinical = this.crypto.decryptJson<ClinicalDetails>(scan.clinicalDetails);
    const file = scan.storageKey ? await this.storage.signedUrl(scan.storageKey, scan.mimeType) : null;
    return {
      sharedBy: doctor ? `Dr ${doctor.firstName} ${doctor.lastName}` : 'A BreastScan AI user',
      clinical,
      scan: {
        id: scan.id,
        declaredType: scan.declaredType,
        examDate: scan.examDate?.toISOString().slice(0, 10) ?? null,
        createdAt: scan.createdAt.toISOString(),
        mimeType: scan.mimeType,
      },
      analysis: { ...toAnalysisView(scan.analysis!, clinical), feedback: null },
      fileUrl: file?.url ?? null,
      expiresAt: link.expiresAt.toISOString(),
    };
  }
}

@ApiTags('share')
@ApiBearerAuth()
@Controller()
export class ShareController {
  constructor(private readonly shares: ShareService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('scans/:id/share')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShareDto,
    @ReqContext() ctx: RequestContext,
  ) {
    return this.shares.create(user.id, id, dto, ctx);
  }

  @Get('share')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.shares.list(user.id);
  }

  @HttpCode(204)
  @Delete('share/:id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @ReqContext() ctx: RequestContext) {
    return this.shares.revoke(user.id, id, ctx);
  }
}

/** Read-only doctor view. The PIN travels in a header so it never lands in URLs or logs. */
@ApiTags('public')
@Controller('public/share')
export class PublicShareController {
  constructor(
    private readonly shares: ShareService,
    private readonly reports: ReportsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get(':token')
  view(@Param('token') token: string, @Headers('x-share-pin') pin: string | undefined, @ReqContext() ctx: RequestContext) {
    return this.shares.view(token, pin, ctx);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get(':token/report.pdf')
  async report(
    @Param('token') token: string,
    @Headers('x-share-pin') pin: string | undefined,
    @ReqContext() ctx: RequestContext,
    @Res() res: Response,
  ) {
    const link = await this.shares.open(token, pin, ctx, false);
    const { buffer, filename } = await this.reports.render(link.scanId);
    sendPdf(res, buffer, filename);
  }
}

@Module({
  imports: [ScansModule],
  controllers: [ShareController, PublicShareController],
  providers: [ShareService],
})
export class ShareModule {}
