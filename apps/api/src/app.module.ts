import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards.js';
import { validateEnv } from './config/env.js';
import { CoreModule } from './core.module.js';
import { HealthController } from './health/health.controller.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ScansModule } from './scans/scans.module.js';
import { ShareModule } from './share/share.module.js';
import { FilesController } from './storage/files.controller.js';
import { WorkerFeaturesModule } from './worker.module.js';

@Module({})
export class AppModule {
  /**
   * With RUN_WORKER (the default outside production) the analysis worker and
   * scheduled jobs run in this process too, so `npm run dev` is one command.
   */
  static forRoot(): DynamicModule {
    const env = validateEnv(process.env);
    return {
      module: AppModule,
      imports: [
        SentryModule.forRoot(),
        CoreModule,
        // Default limit for every route; sensitive routes set stricter ones with @Throttle.
        ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
        AuthModule,
        NotificationsModule,
        ScansModule,
        ShareModule,
        AccountModule,
        ...(env.RUN_WORKER ? [WorkerFeaturesModule] : []),
      ],
      controllers: [HealthController, FilesController],
      providers: [
        { provide: APP_FILTER, useClass: SentryGlobalFilter },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    };
  }
}
