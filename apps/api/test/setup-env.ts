// Runs before each e2e file: point everything at test-only resources, then
// load .env for the remaining values (dotenv never overrides what is set).
const testDb = (process.env.DATABASE_URL_TEST ??
  'postgresql://breastscan:breastscan_dev@localhost:5433/breastscan_test?schema=public') as string;

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: testDb,
  QUEUE_PREFIX: 'bstest',
  RUN_WORKER: 'true',
  AI_PROVIDER: 'mock',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: '.storage-test',
  LOG_LEVEL: 'error',
  // Lets each test patient appear from its own IP via X-Forwarded-For, as behind a load balancer.
  TRUST_PROXY: 'true',
  SWAGGER_ENABLED: 'false',
  RESEND_API_KEY: '',
  CLAMAV_HOST: '',
  UPLOADS_PER_DAY: '3',
});

await import('dotenv/config');
