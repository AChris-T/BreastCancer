import {
  createTestApp,
  modelResult,
  PASSWORD,
  randomIp,
  signUp,
  testJpeg,
  type TestApp,
  unique,
  waitForStatus,
} from './helpers.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function upload(token: string, status = 201, patientRef = 'HT094/25') {
  const file = await testJpeg();
  return t.http
    .post('/api/v1/scans')
    .set(auth(token))
    .set('X-Forwarded-For', randomIp())
    .field('declaredType', 'PATHOLOGY')
    .field('acknowledged', 'true')
    .field('patientRef', patientRef)
    .field('diagnosisYear', '2025')
    .field('patientAge', '39')
    .field('location', 'Left breast')
    .field('grade', '2')
    .field('gradeScore', '6')
    .field('erStatus', 'POSITIVE')
    .field('erPercent', '30')
    .field('prStatus', 'NEGATIVE')
    .field('her2Status', 'NEGATIVE')
    .field('ki67Percent', '')
    .field('diagnosis', 'Invasive mammary carcinoma')
    .attach('file', file, { filename: 'scan.jpg', contentType: 'image/jpeg' })
    .expect(status);
}

describe('health', () => {
  it('reports the database is up', async () => {
    await t.http.get('/api/v1/health').expect(200, { status: 'ok', db: 'up' });
  });
});

describe('auth', () => {
  it('signs up straight in and refreshes with a rotating cookie', async () => {
    const email = unique('auth');
    const res = await t.http
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'Ada', lastName: 'Okafor' })
      .expect(201);
    expect(res.body.user).toMatchObject({ email, firstName: 'Ada', lastName: 'Okafor' });

    const consents = await t.prisma.consent.findMany({ where: { user: { email } } });
    expect(consents.map((c) => c.type).sort()).toEqual(['HEALTH_DATA', 'PRIVACY', 'TERMS']);

    const cookie = res.get('Set-Cookie')!.find((c) => c.startsWith('bs_refresh='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const refreshed = await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie.split(';')[0]!).expect(200);
    const rotated = refreshed.get('Set-Cookie')!.find((c) => c.startsWith('bs_refresh='))!;
    expect(rotated.split(';')[0]).not.toBe(cookie.split(';')[0]);

    // Re-using the old refresh token is treated as theft: every session is revoked.
    await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie.split(';')[0]!).expect(401);
    await t.http.post('/api/v1/auth/refresh').set('Cookie', rotated.split(';')[0]!).expect(401);
  });

  it('refuses a second account with the same email', async () => {
    const email = unique('dupe');
    await signUp(t, email);
    await t.http
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'A', lastName: 'B' })
      .expect(409);
  });

  it('rejects weak passwords', async () => {
    await t.http
      .post('/api/v1/auth/register')
      .send({ email: unique('weak'), password: 'short', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('locks the account after 5 failed logins', async () => {
    const email = unique('lock');
    await signUp(t, email);
    const ip = randomIp();
    for (let i = 0; i < 5; i++) {
      await t.http.post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password: 'Wrong-Passw0rd' }).expect(401);
    }
    const locked = await t.http.post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password: PASSWORD }).expect(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('resets a password by emailed link and signs out other sessions', async () => {
    const email = unique('reset');
    await signUp(t, email);
    await t.http.post('/api/v1/auth/forgot-password').send({ email }).expect(200);
    const link = t.mail.filter((m) => m.to === email).at(-1)!.text;
    const resetToken = decodeURIComponent(/token=(\S+)/.exec(link)![1]!);
    await t.http.post('/api/v1/auth/reset-password').send({ token: resetToken, password: 'New-Passw0rd-456' }).expect(200);
    await t.http.post('/api/v1/auth/reset-password').send({ token: resetToken, password: 'New-Passw0rd-789' }).expect(400);
    await t.http.post('/api/v1/auth/login').send({ email, password: 'New-Passw0rd-456' }).expect(200);
    expect(await t.prisma.session.count({ where: { user: { email }, revokedAt: null } })).toBe(1);
  });
});

describe('scans and analysis', () => {
  it('classifies from the entered receptors and stores the AI suggestion', async () => {
    const token = await signUp(t, unique('scan'));
    t.ai.replies.push(JSON.stringify(modelResult({ suggested_subtype: 'TRIPLE_NEGATIVE', subtype_reasoning: 'Stains read as negative.' })));
    const res = await upload(token);
    expect(res.body.status).toBe('QUEUED');
    expect(res.body.classification).toBe('LUMINAL_B_HER2_NEGATIVE'); // ER+, PR-, HER2-
    expect(res.body.clinical).toMatchObject({ patientRef: 'HT094/25', patientAge: 39, grade: 2, erPercent: 30, ki67Percent: null });

    const done = await waitForStatus(t, token, res.body.id, ['COMPLETED', 'FAILED']);
    expect(done.status).toBe('COMPLETED');

    const analysis = await t.http.get(`/api/v1/scans/${res.body.id}/analysis`).set(auth(token)).expect(200);
    expect(analysis.body.classification.subtype).toBe('LUMINAL_B_HER2_NEGATIVE');
    expect(analysis.body.aiSubtype).toBe('TRIPLE_NEGATIVE');
    expect(analysis.body.agreement).toBe(false);
    expect(analysis.body.disclaimer).toMatch(/decision support/);

    // The model got the receptor results but never the patient ID or the doctor's details.
    const sent = t.ai.calls.at(-1)!;
    expect(sent.context.clinical?.erStatus).toBe('POSITIVE');
    const prompt = (await import('../src/analysis/prompts/v2.js')).buildUserPrompt(sent.context);
    expect(prompt).not.toMatch(/HT094|Ada|Okafor|@/);

    const stored = await t.prisma.scan.findUnique({ where: { id: res.body.id } });
    expect(stored!.clinicalDetails!.startsWith('v1.')).toBe(true); // encrypted at rest

    const found = await t.http.get('/api/v1/scans?search=ht094/25').set(auth(token)).expect(200);
    expect(found.body.items.map((s: { id: string }) => s.id)).toContain(res.body.id);
    const notFound = await t.http.get('/api/v1/scans?search=OTHER-1').set(auth(token)).expect(200);
    expect(notFound.body.total).toBe(0);
  });

  it('turns an AI-reported contradiction into a disagreement', async () => {
    const token = await signUp(t, unique('conflict'));
    t.ai.replies.push(
      JSON.stringify(modelResult({ suggested_subtype: 'UNDETERMINED', conflict_with_entered_details: true, subtype_reasoning: 'Image shows HER2 3+.' })),
    );
    const res = await upload(token);
    await waitForStatus(t, token, res.body.id, ['COMPLETED']);
    const analysis = await t.http.get(`/api/v1/scans/${res.body.id}/analysis`).set(auth(token)).expect(200);
    expect(analysis.body.aiConflict).toBe(true);
    expect(analysis.body.agreement).toBe(false);
  });

  it('estimates the Nottingham grade from H&E morphology and compares it with the grade entered', async () => {
    const token = await signUp(t, unique('he'));
    t.ai.replies.push(
      JSON.stringify(
        modelResult({
          morphology: {
            tumour_present: 'YES',
            tumour_percent: 35,
            histological_type: 'Invasive carcinoma NST',
            tubule_score: 3,
            pleomorphism_score: 3,
            mitotic_score: 2,
            comment: 'High-power fields limited.',
          },
        }),
      ),
    );
    const res = await upload(token); // grade 2 is entered by the helper
    await waitForStatus(t, token, res.body.id, ['COMPLETED']);
    const analysis = await t.http.get(`/api/v1/scans/${res.body.id}/analysis`).set(auth(token)).expect(200);
    expect(analysis.body.morphology).toMatchObject({ estimatedScore: 8, estimatedGrade: 3, gradeDiffers: true, tumourPercent: 35 });
  });

  it('rejects contradictory receptor input', async () => {
    const token = await signUp(t, unique('bad'));
    await t.http
      .post('/api/v1/scans')
      .set(auth(token))
      .field('declaredType', 'PATHOLOGY')
      .field('acknowledged', 'true')
      .field('erStatus', 'MAYBE')
      .field('prStatus', 'NEGATIVE')
      .field('her2Status', 'NEGATIVE')
      .attach('file', await testJpeg(), { filename: 'scan.jpg', contentType: 'image/jpeg' })
      .expect(400);
  });

  it('asks the model to repair invalid JSON once, then fails cleanly', async () => {
    const token = await signUp(t, unique('repair'));
    t.ai.replies.push('{"oops": true}', JSON.stringify(modelResult()));
    const ok = await upload(token);
    expect((await waitForStatus(t, token, ok.body.id, ['COMPLETED', 'FAILED'])).status).toBe('COMPLETED');

    t.ai.replies.push('not json', 'still not json');
    const bad = await upload(token);
    const failed = await waitForStatus(t, token, bad.body.id, ['COMPLETED', 'FAILED']);
    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toMatch(/invalid result/);

    t.ai.replies.push(JSON.stringify(modelResult()));
    await t.http.post(`/api/v1/scans/${bad.body.id}/analysis/retry`).set(auth(token)).expect(200);
    expect((await waitForStatus(t, token, bad.body.id, ['COMPLETED', 'FAILED'])).status).toBe('COMPLETED');
  });

  it('enforces the daily upload cap', async () => {
    const token = await signUp(t, unique('cap'));
    for (let i = 0; i < 3; i++) await upload(token);
    const capped = await upload(token, 429);
    expect(capped.body.code).toBe('UPLOAD_LIMIT_REACHED');
  });

  it('never returns another doctor’s case', async () => {
    const owner = await signUp(t, unique('owner'));
    const other = await signUp(t, unique('other'));
    const res = await upload(owner);
    await t.http.get(`/api/v1/scans/${res.body.id}`).set(auth(other)).expect(404);
    await t.http.get(`/api/v1/scans/${res.body.id}/file`).set(auth(other)).expect(404);
    await t.http.delete(`/api/v1/scans/${res.body.id}`).set(auth(other)).expect(404);
  });
});

describe('sharing', () => {
  it('serves a PIN-protected doctor view and turns it off after 10 wrong PINs', async () => {
    const token = await signUp(t, unique('share'));
    const scan = await upload(token);
    await waitForStatus(t, token, scan.body.id, ['COMPLETED']);

    const link = await t.http
      .post(`/api/v1/scans/${scan.body.id}/share`)
      .set(auth(token))
      .send({ expiresInHours: 24, pin: '2468' })
      .expect(201);
    const shareToken = link.body.url.split('/s/')[1];

    await t.http.get(`/api/v1/public/share/${shareToken}`).expect(401);
    const view = await t.http.get(`/api/v1/public/share/${shareToken}`).set('X-Share-Pin', '2468').expect(200);
    expect(view.body.analysis.disclaimer).toMatch(/decision support/);
    expect(view.body.clinical.patientRef).toBe('HT094/25');
    expect(view.body.sharedBy).toBe('Dr Ada Okafor');
    expect(view.body.analysis.feedback).toBeNull();

    const pdf = await t.http.get(`/api/v1/public/share/${shareToken}/report.pdf`).set('X-Share-Pin', '2468').expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');

    const stored = await t.prisma.shareLink.findUnique({ where: { id: link.body.id } });
    expect(stored!.tokenHash).not.toContain(shareToken);

    // Each guess from a different IP, so only the per-link PIN lockout can stop it.
    for (let i = 0; i < 10; i++) {
      await t.http.get(`/api/v1/public/share/${shareToken}`).set('X-Forwarded-For', randomIp()).set('X-Share-Pin', '0000').expect(401);
    }
    await t.http.get(`/api/v1/public/share/${shareToken}`).set('X-Share-Pin', '2468').expect(404);
  });
});

describe('account', () => {
  it('schedules deletion and blocks further sign-in', async () => {
    const email = unique('delete');
    const token = await signUp(t, email);
    await t.http.delete('/api/v1/account').set(auth(token)).send({ password: 'wrong' }).expect(400);
    await t.http.delete('/api/v1/account').set(auth(token)).send({ password: PASSWORD }).expect(200);
    await t.http.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
  });

});
