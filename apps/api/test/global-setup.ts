import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/**
 * Brings the test database up to the latest migration once per e2e run.
 * Non-destructive: tests use unique emails, so old rows don't interfere.
 * Create the database once with:
 *   docker compose exec postgres createdb -U breastscan breastscan_test
 */
export default function setup() {
  const url =
    process.env.DATABASE_URL_TEST ?? 'postgresql://breastscan:breastscan_dev@localhost:5433/breastscan_test?schema=public';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  rmSync('.storage-test', { recursive: true, force: true });
}
