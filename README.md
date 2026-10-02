# BreastScan AI

Breast cancer subtype classification for clinicians. A doctor enters a case (patient ID, age, grade, ER, PR, HER2, Ki-67, diagnosis) and uploads a slide image or report. The app classifies the case with the St Gallen 2013 surrogate rules and shows an AI second reading of the file beside it, flagging disagreement. Results can be printed, downloaded as PDF, or shared with a colleague by PIN-protected link. It is decision support, not a diagnosis.

| Workspace | What it is |
|---|---|
| `apps/web` | Next.js 16 (App Router), Tailwind 4, TanStack Query, React Hook Form + Zod |
| `apps/api` | NestJS 12 API **and** background worker, Prisma 7 + PostgreSQL, BullMQ + Redis, Gemini |
| `packages/shared` | Types, enums, Zod schemas and legal text shared by both apps |

Turborepo runs tasks across the workspaces. `docs/operations.md` covers deployment, backups, the incident runbook and the launch gate.

## Run locally

You need Node 24 and Docker Desktop.

```sh
docker compose up -d              # Postgres (host port 5433) + Redis
npm install
cp apps/api/.env.example apps/api/.env       # then generate fresh secrets (see comments in the file)
cp apps/web/.env.example apps/web/.env.local
npm run db:deploy                 # apply migrations
npm run db:seed                   # test doctor account
npm run dev                       # web on :3000, API on :3001 (worker runs inside the API in dev)
```

- **No API keys needed locally.** Without `GEMINI_API_KEY`, a clearly labelled mock AI is used (it echoes the rule-based class). Without `RESEND_API_KEY`, emails such as password-reset links are printed in the API log.
- **API docs:** http://localhost:3001/api/docs
- **Test login:** `test@breastscan.local` / `Test-Passw0rd!` (set by `SEED_TEST_EMAIL` / `SEED_TEST_PASSWORD` in `apps/api/.env`).
- **Virus scanning:** to test it locally, run `docker compose --profile scan up -d` and set `CLAMAV_HOST=localhost`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run everything in watch mode |
| `npm run build` | Build all workspaces |
| `npm test` | Unit tests |
| `npm run test:e2e` | API end-to-end tests with a mocked Gemini. Needs Docker; uses a separate `breastscan_test` database, created once with `docker compose exec postgres createdb -U breastscan breastscan_test` |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run db:migrate` | Create a migration after editing `apps/api/prisma/schema.prisma` |
| `npm run db:studio` | Browse the database |
| `scripts/backup-db.sh`, `scripts/restore-check.sh` | Encrypted backups and restore verification |

## How an upload is handled

1. `POST /api/v1/scans`: the file type is checked by signature, encrypted PDFs are refused, and the file is virus-scanned, stripped of EXIF/GPS (HEIC is converted to JPEG) and stored privately as `scans/{userId}/{scanId}`.
2. A BullMQ job `analyze-scan` is queued: 1 try plus 3 retries at 10 s, 60 s and 5 min.
3. The rule-based class (`classify()` in `packages/shared/src/clinical.ts`) is stored at upload. The worker sends the file and the receptor results (never the patient ID) to Gemini with the versioned prompt and a JSON response schema.
4. The reply is validated with Zod. If it is invalid, the worker asks once for a repair; if that also fails, the scan is marked FAILED.
5. Code-side checks force UNDETERMINED for unrelated files and always add a pathology-confirmation step. Agreement between the rules and the AI is computed when the result is shown, and the disclaimer is always attached on the server.
6. The result is saved (clinical details and the raw model output are encrypted), and the doctor gets an in-app notification and an email. The web app polls every 3 s while the case is processing.
