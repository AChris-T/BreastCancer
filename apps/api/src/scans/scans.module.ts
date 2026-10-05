import { Module } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service.js';
import { MalwareScanner } from './malware-scanner.js';
import { AnalysesController, ScansController } from './scans.controller.js';
import { ScansService } from './scans.service.js';

@Module({
  controllers: [ScansController, AnalysesController],
  providers: [ScansService, MalwareScanner, ReportsService],
  exports: [ScansService, ReportsService],
})
export class ScansModule {}
