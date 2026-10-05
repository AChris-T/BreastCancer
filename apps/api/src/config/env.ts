import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3001),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    API_PUBLIC_URL: z.url().default('http://localhost:3001'),
    TRUST_PROXY: bool.default(false),
    SWAGGER_ENABLED: bool.optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    DATABASE_URL: z.string().min(1),
    // Run the analysis worker and scheduled jobs inside the API process.
    // Handy in development; in production run `node dist/worker` separately.
    RUN_WORKER: bool.optional(),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    TOKEN_HASH_SECRET: z.string().min(32, 'TOKEN_HASH_SECRET must be at least 32 characters'),
    // base64-encoded 32-byte key for AES-256-GCM field encryption
    FIELD_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('.storage'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().default(3310),

    AI_PROVIDER: z.enum(['gemini', 'mock']).optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default('gemini-3.1-pro-preview'),
    // Used once when GEMINI_MODEL returns a server error or rate limit. Leave empty to disable.
    GEMINI_FALLBACK_MODEL: z.string().optional(),
    GEMINI_INPUT_USD_PER_MTOK: z.coerce.number().default(0),
    GEMINI_OUTPUT_USD_PER_MTOK: z.coerce.number().default(0),
    UPLOADS_PER_DAY: z.coerce.number().int().positive().default(100),

    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('BreastScan AI <no-reply@breastscan.local>'),

    SENTRY_DSN: z.string().optional(),
    ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().min(0).default(30),
  })
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    RUN_WORKER: env.RUN_WORKER ?? env.NODE_ENV !== 'production',
    AI_PROVIDER: env.AI_PROVIDER ?? (env.GEMINI_API_KEY ? 'gemini' : 'mock'),
  }))
  .superRefine((env, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) issue('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
    if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) issue('S3_BUCKET is required when STORAGE_DRIVER=s3');
    if (env.NODE_ENV === 'production') {
      if (env.AI_PROVIDER === 'mock') issue('AI_PROVIDER=mock is not allowed in production');
      if (env.STORAGE_DRIVER !== 's3') issue('Use STORAGE_DRIVER=s3 (a private bucket) in production');
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
