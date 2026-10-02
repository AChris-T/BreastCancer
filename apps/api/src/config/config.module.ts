import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Env, validateEnv } from './env.js';

/** Typed accessor over the validated environment. */
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction() {
    return this.get('NODE_ENV') === 'production';
  }
}

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv })],
  providers: [{ provide: AppConfig, useFactory: (c: ConfigService<Env, true>) => new AppConfig(c), inject: [ConfigService] }],
  exports: [AppConfig],
})
export class AppConfigModule {}
