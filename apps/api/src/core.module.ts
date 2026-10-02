import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.service.js';
import { CryptoModule } from './common/crypto.service.js';
import { AppConfig, AppConfigModule } from './config/config.module.js';
import { redactUrl } from './instrument.js';
import { MailModule } from './mail/mail.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.service.js';

export function redisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

/** Infrastructure shared by the API and the worker. */
@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          transport: config.isProduction ? undefined : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-share-pin"]', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          serializers: {
            req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: redactUrl(req.url) }),
          },
          autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/v1/health' },
        },
      }),
    }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    MailModule,
    StorageModule,
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: redisConnection(config.get('REDIS_URL')),
        prefix: config.get('QUEUE_PREFIX'),
      }),
    }),
  ],
})
export class CoreModule {}
