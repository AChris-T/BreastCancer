import { Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicalDetails } from '@breastscan/shared';
import { toAnalysisView } from '../analysis/analysis.view.js';
import { CryptoService } from '../common/crypto.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { renderReport, reportNumber } from './report-pdf.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Renders the PDF for a case. Callers must already have checked access. */
  async render(scanId: string): Promise<{ buffer: Buffer; filename: string }> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { analysis: true, user: { include: { profile: true } } },
    });
    if (!scan?.analysis) throw new NotFoundException('The report is not ready yet');
    const clinical = this.crypto.decryptJson<ClinicalDetails>(scan.clinicalDetails);
    const doctor = scan.user.profile;
    const buffer = await renderReport({
      requestedBy: doctor ? `Dr ${doctor.firstName} ${doctor.lastName}` : scan.user.email,
      scan: {
        id: scan.id,
        declaredType: scan.declaredType,
        examDate: scan.examDate?.toISOString() ?? null,
        createdAt: scan.createdAt.toISOString(),
      },
      clinical,
      analysis: toAnalysisView(scan.analysis, clinical),
      generatedAt: new Date(),
    });
    const ref = clinical?.patientRef?.replace(/[^A-Za-z0-9_-]+/g, '-');
    return { buffer, filename: `${ref ? `${ref}-` : ''}${reportNumber(scan.id)}.pdf` };
  }
}
