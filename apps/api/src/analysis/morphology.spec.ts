import { nottinghamGrade } from '@breastscan/shared';
import { toMorphologyView } from './analysis.view.js';

const base = {
  tumour_present: 'YES' as const,
  tumour_percent: 30,
  histological_type: 'Invasive carcinoma NST',
  comment: 'Low power only.',
};
const clinical = (grade: 1 | 2 | 3 | null) =>
  ({
    patientRef: null, diagnosisYear: null, patientAge: null, location: null, grade, gradeScore: null,
    erStatus: 'UNKNOWN', erPercent: null, prStatus: 'UNKNOWN', prPercent: null, her2Status: 'UNKNOWN', ki67Percent: null, diagnosis: null,
  }) as const;

describe('nottinghamGrade', () => {
  it.each([
    [3, 1],
    [5, 1],
    [6, 2],
    [7, 2],
    [8, 3],
    [9, 3],
  ])('score %i -> grade %i', (score, grade) => {
    expect(nottinghamGrade(score)).toBe(grade);
  });
});

describe('toMorphologyView', () => {
  it('sums the components and flags a grade that differs from the one entered', () => {
    const v = toMorphologyView({ ...base, tubule_score: 3, pleomorphism_score: 2, mitotic_score: 2 }, clinical(1));
    expect(v).toMatchObject({ estimatedScore: 7, estimatedGrade: 2, gradeDiffers: true });
  });

  it('agrees when the grades match', () => {
    expect(toMorphologyView({ ...base, tubule_score: 3, pleomorphism_score: 2, mitotic_score: 1 }, clinical(2))?.gradeDiffers).toBe(false);
  });

  it('gives a grade range when mitoses could not be counted', () => {
    // 3 + 2 = 5 so far; mitoses 1-3 makes 6-8, i.e. grade II-III.
    const v = toMorphologyView({ ...base, tubule_score: 3, pleomorphism_score: 2, mitotic_score: null }, clinical(2));
    expect(v).toMatchObject({ estimatedScore: null, estimatedGrade: null, gradeRange: { low: 2, high: 3 }, gradeDiffers: null });
  });

  it('flags an entered grade outside the possible range', () => {
    const v = toMorphologyView({ ...base, tubule_score: 3, pleomorphism_score: 3, mitotic_score: null }, clinical(1));
    expect(v).toMatchObject({ gradeRange: { low: 2, high: 3 }, gradeDiffers: true });
  });

  it('gives no range when two components are missing', () => {
    const v = toMorphologyView({ ...base, tubule_score: 3, pleomorphism_score: null, mitotic_score: null }, clinical(2));
    expect(v).toMatchObject({ gradeRange: null, gradeDiffers: null });
  });

  it('returns null without morphology', () => {
    expect(toMorphologyView(null, clinical(2))).toBeNull();
  });
});
