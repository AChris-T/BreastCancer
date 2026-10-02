import type { ModelResult } from '@breastscan/shared';
import { applySafetyRules } from './safety-rules.js';

function result(overrides: Partial<ModelResult> = {}): ModelResult {
  return {
    upload_type: 'PATHOLOGY',
    image_quality: 'GOOD',
    suggested_subtype: 'TRIPLE_NEGATIVE',
    subtype_reasoning: 'ER, PR and HER2 stains negative.',
    conflict_with_entered_details: false,
    morphology: null,
    key_findings: [{ finding: 'No nuclear ER staining', location: null, significance: 'ROUTINE' }],
    detailed_analysis: 'IHC panel.',
    summary: 'Triple-negative profile.',
    recommendations: ['Discuss at the breast MDT.'],
    limitations: 'Single image.',
    ...overrides,
  };
}

describe('applySafetyRules', () => {
  it('keeps a well-formed result', () => {
    const r = applySafetyRules(result());
    expect(r.aiSubtype).toBe('TRIPLE_NEGATIVE');
    expect(r.flags).toEqual([]);
  });

  it('forces UNDETERMINED for unrelated or unclear files', () => {
    const r = applySafetyRules(result({ upload_type: 'UNRELATED' }));
    expect(r.aiSubtype).toBe('UNDETERMINED');
    expect(r.detectedType).toBe('UNKNOWN');
    expect(r.flags).toContain('UNRELATED_OR_UNCLEAR_UPLOAD');
  });

  it('passes through a reported conflict, but not for unrelated files', () => {
    expect(applySafetyRules(result({ conflict_with_entered_details: true })).aiConflict).toBe(true);
    expect(applySafetyRules(result({ conflict_with_entered_details: true, upload_type: 'UNRELATED' })).aiConflict).toBe(false);
  });

  it('keeps morphology only for pathology images', () => {
    const m = { tumour_present: 'YES' as const, tumour_percent: 40, histological_type: 'NST', tubule_score: 3, pleomorphism_score: 2, mitotic_score: 1, comment: 'x' };
    expect(applySafetyRules(result({ morphology: m })).morphology).toEqual(m);
    expect(applySafetyRules(result({ morphology: m, upload_type: 'LAB_REPORT' })).morphology).toBeNull();
    expect(applySafetyRules(result({ morphology: m, upload_type: 'UNRELATED' })).morphology).toBeNull();
  });

  it('always recommends pathology confirmation', () => {
    const r = applySafetyRules(result({ recommendations: ['Repeat Ki-67.'] }));
    expect(r.recommendations.some((s) => /pathology/i.test(s))).toBe(true);
    expect(r.flags).toContain('RECOMMENDATION_ADDED');
  });
});
