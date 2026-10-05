import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalysisWorkerModule } from './analysis/analysis-worker.module.js';
import { CoreModule } from './core.module.js';
import { MaintenanceModule } from './maintenance/maintenance.service.js';
import { NotificationsCoreModule } from './notifications/notifications.module.js';

/** The queue consumer and scheduled jobs. */
@Module({
  imports: [ScheduleModule.forRoot(), AnalysisWorkerModule, MaintenanceModule],
})
export class WorkerFeaturesModule {}

/** Root module of the standalone worker process (`node dist/worker`). */
@Module({
  imports: [CoreModule, NotificationsCoreModule, WorkerFeaturesModule],
})
export class WorkerModule {}
