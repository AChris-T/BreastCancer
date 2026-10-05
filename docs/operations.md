# Operations guide

How BreastScan AI runs in production, how to look after it, and what must be true before real patient data is entered.

## Topology

| Process | Command | Notes |
|---|---|---|
| Web (Next.js) | `npm run build -w @breastscan/web` then `next start` | Vercel or any Node host. Set `NEXT_PUBLIC_API_URL` at build time. |
| API (NestJS) | `node apps/api/dist/main` | Set `RUN_WORKER=false` so it never processes jobs. |
| Worker | `node apps/api/dist/worker` | Consumes the `analysis` queue and runs scheduled jobs. The only process that calls Gemini. Scale horizontally if the queue backs up. |
| PostgreSQL 16 | managed | Run `npm run db:deploy` on every release, before starting the new API. |
| Redis 7 | managed | Queue and job state. Not a source of truth; losing it only loses in-flight jobs (scans stuck in QUEUED are failed after 30 min and can be retried). |
| ClamAV | `clamav/clamav:stable` | Must be reachable from the API at `CLAMAV_HOST:3310`. Uploads fail closed if it is down. |
| Object storage | S3 or Cloudflare R2 | Private bucket, no public access, default encryption on. Add the bucket host to the web app's `FILE_ORIGINS`. |

**Cookies need one site.** The refresh cookie is `SameSite=Strict`, so the web app and API must share a registrable domain, e.g. `app.example.ng` and `api.example.ng`. A `*.vercel.app` web app talking to a `*.railway.app` API will not stay signed in.

## Required production settings

The API stays up in production without `CLAMAV_HOST` or `RESEND_API_KEY`, but those features degrade gracefully: malware scanning is skipped and outbound mail is logged to stdout instead of sending. The safety-critical settings remain `GEMINI_API_KEY` (paid tier only), `STORAGE_DRIVER=s3` and `S3_*`, and strong `JWT_ACCESS_SECRET`, `TOKEN_HASH_SECRET` and `FIELD_ENCRYPTION_KEY`. Keep these in the host's secrets manager, not in a committed `.env`. Also set `TRUST_PROXY=true` behind a load balancer, `FRONTEND_URL`, `API_PUBLIC_URL` and `SENTRY_DSN`.

`FIELD_ENCRYPTION_KEY` encrypts health fields at rest. **Losing it makes that data unrecoverable.** Back it up in the secrets manager with the same care as the database. Values are prefixed `v1.`, so a later key rotation can add `v2` and re-encrypt in the background.

## Changing the AI prompt or model

- The model id lives in `GEMINI_MODEL` and can be changed without a deploy. Confirm the id against Google's current model list.
- To change the prompt, copy `apps/api/src/analysis/prompts/v1.ts` to `v2.ts`, bump `PROMPT_VERSION`, and point the imports at the new file. Every `Analysis` row records `model` and `promptVersion`, so results can be compared before and after.
- The code-side rules in `safety-rules.ts` run on every result, whatever the prompt says, and are covered by unit tests. Any change to them needs a test.
- Set `GEMINI_INPUT_USD_PER_MTOK` and `GEMINI_OUTPUT_USD_PER_MTOK` from the price list so the admin spend estimate is right.

## Monitoring

- **Sentry:** set `SENTRY_DSN` on the API and worker. Request bodies, headers, cookies, query strings, AI inputs/outputs and SQL values are switched off in `instrument.ts`, and share tokens are stripped from URLs.
- **Logs:** pino JSON to stdout. Authorization headers, cookies and share PINs are redacted, and share and file tokens are removed from logged URLs.
- **Uptime:** poll `GET /api/v1/health`, which checks the database.
- **Watch these:** the share of cases where the AI disagrees with the rules, failed analyses (scans with status FAILED), and queue depth.

## Backups

- **Daily backup:** `BACKUP_PASSPHRASE=… scripts/backup-db.sh /path/to/backups` writes a `pg_dump` encrypted with AES-256. In production set `DATABASE_URL` and ship the file off the database host.
- **Monthly restore check:** `scripts/restore-check.sh <file>` restores into a throwaway database, counts rows, and drops it again. A backup that has never been restored is not a backup.
- **Uploaded files:** turn on bucket versioning, or replicate the bucket, for the same retention period as the database.
- **Deleted accounts:** they are purged 30 days after the request, by the worker's 3 a.m. job. Their data then remains only in backups until those age out, so set backup retention to a value the privacy notice can state, e.g. 35 days.

## Incident runbook (data breach)

The NDPA 2023 (s. 40) requires notifying the NDPC within **72 hours** of becoming aware of a breach likely to put people's rights at risk. Affected users must be told without undue delay when the risk to them is high.

1. **Contain.** Revoke leaked credentials and keys. To sign everyone out, run `UPDATE "Session" SET "revokedAt" = now() WHERE "revokedAt" IS NULL`. To kill all share links, set `revokedAt` on `ShareLink` rows. Rotate `JWT_ACCESS_SECRET` to invalidate access tokens.
2. **Record the time you became aware.** The 72-hour clock starts then.
3. **Scope it.** Use the `AuditLog` table to see which accounts, scans and share links were touched: `RESULT_VIEWED`, `SCAN_FILE_VIEWED`, `SHARE_VIEWED`, `DATA_EXPORTED`, `LOGIN`.
4. **Assess the risk.** Health data is sensitive personal data, so assume high risk unless the data was encrypted and the keys were not exposed.
5. **Notify the NDPC** within 72 hours with what happened, the categories and approximate numbers of people and records, likely consequences, and the measures taken.
6. **Tell affected users** in plain language: what happened, what it means for them, what we are doing, and what they can do.
7. **Review.** Write up the root cause and fixes within two weeks.

Keep the DPO's contact details and the NDPC notification channel at the top of this file once they exist.

## Launch gate

No real patient image may reach the system until every box is ticked.

**Legal and governance**
- [ ] DPIA completed (NDPA s. 28); NDPC consulted if residual risk is high
- [ ] Privacy notice, terms and disclaimer reviewed by a lawyer (`/privacy` and `/terms` are marked as drafts)
- [ ] Legal advice on medical-device status (NAFDAC); no claims of diagnostic accuracy anywhere
- [ ] DPO named; contact addresses in the privacy and about pages are real (they are placeholders now)
- [ ] Gemini billing enabled and paid-tier terms confirmed for the project that owns the key

**Platform**
- [ ] Production env passes the API's startup checks (S3, ClamAV, Resend, Gemini key, secrets)
- [ ] HTTPS everywhere; web and API on one registrable domain
- [ ] ClamAV reachable from the API, and an EICAR upload is rejected in staging
- [ ] Daily encrypted backups running and a restore check done
- [ ] Sentry receiving events from the API and worker; add `@sentry/nextjs` to the web app (not wired up yet); uptime check on `/api/v1/health`
- [ ] Rate-limit storage moved to Redis if running more than one API instance (it is in-memory per instance now)
- [ ] `npm audit` reviewed, Dependabot on, and a penetration test done
- [ ] Data processing agreement in place with each hospital whose patient data is entered
- [ ] The seeded test account removed (never run `db:seed` in production)

**Product**
- [ ] Pathologist review of the classification rules (cut-offs: ER/PR 1%, PR 20%, Ki-67 20%) and prompt v2 on de-identified cases
- [ ] A plan for reviewing `Feedback.doctorAgreed` ("did final pathology confirm the AI?") before any accuracy claim
