import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from './config/config.module.js';

/** HTTP setup shared by main.ts and the e2e tests, so tests exercise the real pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY') ? 1 : false);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // Lets the web app (same site, different port or subdomain) show signed files.
      crossOriginResourcePolicy: { policy: 'same-site' },
      // Swagger UI needs inline scripts; it is only served when SWAGGER_ENABLED.
      contentSecurityPolicy: config.get('SWAGGER_ENABLED') ? false : undefined,
      strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_URL'),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('BreastScan AI API')
        .setDescription('Patient-facing breast screening aid. Results are screening aids, not diagnoses.')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
