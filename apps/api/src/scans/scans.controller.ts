import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { UPLOAD_MAX_BYTES } from '@breastscan/shared';
import { AuditService } from '../audit/audit.service.js';
import { type AuthenticatedUser, CurrentUser } from '../auth/decorators.js';
import { ReqContext, type RequestContext } from '../common/request-context.js';
import { ReportsService } from '../reports/reports.service.js';
import { FeedbackDto, ListScansQuery, UploadScanDto } from './scans.dto.js';
import { ScansService } from './scans.service.js';

@ApiTags('scans')
@ApiBearerAuth()
@Controller('scans')
export class ScansController {
  constructor(
    private readonly scans: ScansService,
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD_MAX_BYTES, files: 1, fields: 20 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadScanDto,
    @ReqContext() ctx: RequestContext,
  ) {
    return this.scans.upload(user.id, file, dto, ctx);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListScansQuery) {
    return this.scans.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.scans.get(user.id, id);
  }

  @Get(':id/file')
  file(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @ReqContext() ctx: RequestContext) {
    return this.scans.fileUrl(user.id, id, ctx);
  }

  @HttpCode(204)
  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @ReqContext() ctx: RequestContext) {
    return this.scans.delete(user.id, id, ctx);
  }

  @Get(':id/analysis')
  analysis(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @ReqContext() ctx: RequestContext) {
    return this.scans.getAnalysis(user.id, id, ctx);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':id/analysis/retry')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @ReqContext() ctx: RequestContext) {
    return this.scans.retry(user.id, id, ctx);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':id/report.pdf')
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ReqContext() ctx: RequestContext,
    @Res() res: Response,
  ) {
    await this.scans.get(user.id, id); // ownership check
    const { buffer, filename } = await this.reports.render(id);
    await this.audit.log({ action: 'REPORT_DOWNLOADED', userId: user.id, entityType: 'Scan', entityId: id, context: ctx });
    sendPdf(res, buffer, filename);
  }
}

@ApiTags('scans')
@ApiBearerAuth()
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly scans: ScansService) {}

  @HttpCode(200)
  @Post(':id/feedback')
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FeedbackDto,
    @ReqContext() ctx: RequestContext,
  ) {
    return this.scans.feedback(user.id, id, dto, ctx);
  }
}

export function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
  res.send(buffer);
}
