import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { ModelResult } from '@breastscan/shared';
import { AiProvider, type AnalyzeInput, type ModelReply } from '../src/analysis/ai-provider.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { MailService, type MailMessage } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Stands in for Gemini: replies are queued per test; records what it was sent. */
export class FakeAi extends AiProvider {
  readonly model = 'fake-gemini';
  replies: string[] = [];
  calls: AnalyzeInput[] = [];

  analyze(input: AnalyzeInput): Promise<ModelReply> {
    this.calls.push(input);
    return Promise.resolve(this.next());
  }

  repair(input: AnalyzeInput): Promise<ModelReply> {
    this.calls.push(input);
    return Promise.resolve(this.next());
  }

  private next(): ModelReply {
    const text = this.replies.shift() ?? JSON.stringify(modelResult());
    return { text, model: this.model, inputTokens: 1000, outputTokens: 200 };
  }
}

export function modelResult(overrides: Partial<ModelResult> = {}): ModelResult {
  return {
    upload_type: 'PATHOLOGY',
    image_quality: 'GOOD',
    suggested_subtype: 'LUMINAL_B_HER2_NEGATIVE',
    subtype_reasoning: 'ER positive, PR negative, HER2 0.',
    conflict_with_entered_details: false,
    morphology: null,
    key_findings: [{ finding: 'Moderate nuclear ER staining in ~30% of cells', location: null, significance: 'ROUTINE' }],
    detailed_analysis: 'IHC panel for ER, PR and HER2.',
    summary: 'Profile consistent with Luminal B (HER2-negative).',
    recommendations: ['Discuss at the breast MDT.'],
    limitations: 'Single image.',
    ...overrides,
  };
}

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  ai: FakeAi;
  mail: MailMessage[];
  prisma: PrismaService;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const ai = new FakeAi();
  const mail: MailMessage[] = [];
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot()] })
    .overrideProvider(AiProvider)
    .useValue(ai)
    .overrideProvider(MailService)
    .useValue({
      send: (m: MailMessage) => {
        mail.push(m);
        return Promise.resolve();
      },
      sendQuietly: (m: MailMessage) => mail.push(m),
    })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  const http = request(app.getHttpServer());
  return {
    app,
    http,
    ai,
    mail,
    prisma: app.get(PrismaService),
    close: () => app.close(),
  };
}

export const PASSWORD = 'Test-Passw0rd-123';

/** Registers a patient (signed in straight away) and returns the access token. */
export async function signUp(t: TestApp, email: string): Promise<string> {
  const res = await t.http
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', randomIp())
    .send({ email, password: PASSWORD, firstName: 'Ada', lastName: 'Okafor' })
    .expect(201);
  return res.body.accessToken as string;
}

export function testJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: '#808080' } }).jpeg().toBuffer();
}

export async function waitForStatus(t: TestApp, token: string, scanId: string, statuses: string[], timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const res = await t.http.get(`/api/v1/scans/${scanId}`).auth(token, { type: 'bearer' });
    if (statuses.includes(res.body.status)) return res.body;
    if (Date.now() > until) throw new Error(`Scan ${scanId} stuck in ${res.body.status}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

export function randomIp(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 250)}`;
}

export const unique = (prefix: string) => `${prefix}+${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
