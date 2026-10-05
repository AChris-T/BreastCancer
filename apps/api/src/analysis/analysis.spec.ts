import { parseModelOutput } from './analysis.runner.js';
import { buildUserPrompt } from './prompts/v2.js';
import { MAX_ATTEMPTS, retryDelay } from './queue.js';

const valid = {
  upload_type: 'PATHOLOGY',
  image_quality: 'ADEQUATE',
  suggested_subtype: 'LUMINAL_A',
  subtype_reasoning: 'Strong ER, PR staining; low Ki-67.',
  conflict_with_entered_details: false,
  morphology: null,
  key_findings: [],
  detailed_analysis: 'IHC panel.',
  summary: 'Luminal A profile.',
  recommendations: ['Confirm with pathology.'],
  limitations: 'Single image.',
};

describe('parseModelOutput', () => {
  it('accepts valid JSON, including fenced output', () => {
    expect(parseModelOutput(JSON.stringify(valid)).ok).toBe(true);
    expect(parseModelOutput('```json\n' + JSON.stringify(valid) + '\n```').ok).toBe(true);
  });

  it('reports schema problems for the repair prompt', () => {
    const result = parseModelOutput(JSON.stringify({ ...valid, suggested_subtype: 'BASAL' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain('suggested_subtype');
  });

  it('reports invalid JSON', () => {
    expect(parseModelOutput('{ not json').ok).toBe(false);
  });
});

describe('retry schedule', () => {
  it('waits 10 s, 60 s and 5 min between attempts', () => {
    expect([1, 2, 3].map(retryDelay)).toEqual([10_000, 60_000, 300_000]);
    expect(MAX_ATTEMPTS).toBe(4);
  });
});

describe('prompt', () => {
  it('tells the model which stain an image shows', () => {
    const prompt = buildUserPrompt({
      declaredType: 'PATHOLOGY',
      clinical: {
        patientRef: null, diagnosisYear: null, patientAge: null, location: null, grade: null, gradeScore: null,
        erStatus: 'POSITIVE', erPercent: 90, prStatus: 'UNKNOWN', prPercent: null, her2Status: 'NEGATIVE', ki67Percent: 10,
        diagnosis: null, imageStain: 'PR',
      },
    });
    expect(prompt).toContain('this image shows: PR (progesterone receptor)');
  });

  it('includes receptor results but never the patient ID', () => {
    const prompt = buildUserPrompt({
      declaredType: 'PATHOLOGY',
      clinical: {
        patientRef: 'HT094/25',
        diagnosisYear: 2025,
        patientAge: 65,
        location: 'Left breast',
        grade: 2,
        gradeScore: 6,
        erStatus: 'POSITIVE',
        erPercent: 30,
        prStatus: 'NEGATIVE',
        prPercent: null,
        her2Status: 'NEGATIVE',
        ki67Percent: null,
        diagnosis: 'Invasive ductal carcinoma',
      },
    });
    expect(prompt).toContain('ER: Positive (30%)');
    expect(prompt).toContain('Grade II, Nottingham score 6');
    expect(prompt).not.toContain('HT094');
  });
});
