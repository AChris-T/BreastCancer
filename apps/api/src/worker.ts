import './instrument.js';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module.js';

// Standalone analysis worker: consumes the queue and runs scheduled jobs.
// Run it with RUN_WORKER=false on the API so jobs are not processed twice.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Analysis worker started');
}
await bootstrap();
