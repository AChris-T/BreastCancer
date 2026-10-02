import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ANALYSIS_QUEUE } from '../analysis/queue.js';
import { ReportsService } from '../reports/reports.service.js';
import { MalwareScanner } from './malware-scanner.js';
import { AnalysesController, ScansController } from './scans.controller.js';
import { ScansService } from './scans.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: ANALYSIS_QUEUE })],
  controllers: [ScansController, AnalysesController],
  providers: [ScansService, MalwareScanner, ReportsService],
  exports: [ScansService, ReportsService, BullModule],
})
export class ScansModule {}
