import { Module } from '@nestjs/common';
import { AppConfig } from '../config/config.module.js';
import { AiProvider, GeminiProvider, MockAiProvider } from './ai-provider.js';
import { AnalysisProcessor } from './analysis.processor.js';
import { AnalysisRunner } from './analysis.runner.js';

/** Consumer side of the analysis queue. Only this module talks to Gemini. */
@Module({
  providers: [
    {
      provide: AiProvider,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.get('AI_PROVIDER') === 'gemini' ? new GeminiProvider(config) : new MockAiProvider(),
    },
    AnalysisRunner,
    AnalysisProcessor,
  ],
  exports: [AnalysisRunner],
})
export class AnalysisWorkerModule {}
