import './instrument.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { AppConfig } from './config/config.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(), { bufferLogs: true });
  configureApp(app);
  await app.listen(app.get(AppConfig).get('PORT'));
}
await bootstrap();
