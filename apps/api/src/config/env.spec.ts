import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'j'.repeat(32),
  TOKEN_HASH_SECRET: 'h'.repeat(32),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('validateEnv', () => {
  it('defaults to the mock AI and in-process worker in development', () => {
    const env = validateEnv(base);
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.RUN_WORKER).toBe(true);
  });

  it('picks Gemini when a key is present', () => {
    expect(validateEnv({ ...base, GEMINI_API_KEY: 'k' }).AI_PROVIDER).toBe('gemini');
  });

  it('drops trailing slashes from public URLs so the CORS origin matches', () => {
    const env = validateEnv({ ...base, FRONTEND_URL: 'https://app.example.com/', API_PUBLIC_URL: 'https://api.example.com//' });
    expect(env.FRONTEND_URL).toBe('https://app.example.com');
    expect(env.API_PUBLIC_URL).toBe('https://api.example.com');
  });

  it('rejects a key of the wrong length', () => {
    expect(() => validateEnv({ ...base, FIELD_ENCRYPTION_KEY: 'c2hvcnQ=' })).toThrow(/32 bytes/);
  });

  it('refuses unsafe production settings', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/AI_PROVIDER=mock[\s\S]*STORAGE_DRIVER=s3/);
  });

  it('accepts a production configuration without optional scan/email settings', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'k',
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'scans',
    });
    expect(env.RUN_WORKER).toBe(false);
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.CLAMAV_HOST).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it('accepts a complete production configuration', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'k',
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'scans',
      CLAMAV_HOST: 'clamav',
      RESEND_API_KEY: 're_x',
    });
    expect(env.RUN_WORKER).toBe(false);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });
});
