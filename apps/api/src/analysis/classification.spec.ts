import { classify, clinicalDetailsSchema, subtypesAgree, type ClinicalDetails } from '@breastscan/shared';

const base: ClinicalDetails = {
  patientRef: null,
  diagnosisYear: null,
  patientAge: null,
  location: null,
  grade: null,
  gradeScore: null,
  erStatus: 'UNKNOWN',
  erPercent: null,
  prStatus: 'UNKNOWN',
  prPercent: null,
  her2Status: 'UNKNOWN',
  ki67Percent: null,
  diagnosis: null,
};
const c = (o: Partial<ClinicalDetails>) => classify({ ...base, ...o });

describe('classify (St Gallen 2013 surrogate)', () => {
  it('Luminal A: ER+, PR ≥20%, HER2-, Ki-67 <20%', () => {
    expect(c({ erStatus: 'POSITIVE', prStatus: 'POSITIVE', prPercent: 50, her2Status: 'NEGATIVE', ki67Percent: 10 }).subtype).toBe('LUMINAL_A');
  });

  it('Luminal B HER2-: PR below 20% or negative', () => {
    expect(c({ erStatus: 'POSITIVE', prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }).subtype).toBe('LUMINAL_B_HER2_NEGATIVE');
    expect(c({ erStatus: 'POSITIVE', prStatus: 'POSITIVE', prPercent: 10, her2Status: 'NEGATIVE', ki67Percent: 5 }).subtype).toBe(
      'LUMINAL_B_HER2_NEGATIVE',
    );
  });

  it('Luminal B HER2-: Ki-67 ≥20%', () => {
    expect(c({ erStatus: 'POSITIVE', prStatus: 'POSITIVE', prPercent: 80, her2Status: 'NEGATIVE', ki67Percent: 30 }).subtype).toBe(
      'LUMINAL_B_HER2_NEGATIVE',
    );
  });

  it('needs Ki-67 to split A from B when PR is high', () => {
    const r = c({ erStatus: 'POSITIVE', prStatus: 'POSITIVE', prPercent: 30, her2Status: 'NEGATIVE' });
    expect(r.subtype).toBe('LUMINAL_A_OR_B');
    expect(r.missing).toContain('Ki-67 %');
  });

  it('HER2-positive subtypes', () => {
    expect(c({ erStatus: 'POSITIVE', prStatus: 'NEGATIVE', her2Status: 'POSITIVE' }).subtype).toBe('LUMINAL_B_HER2_POSITIVE');
    expect(c({ erStatus: 'NEGATIVE', prStatus: 'NEGATIVE', her2Status: 'POSITIVE' }).subtype).toBe('HER2_ENRICHED');
  });

  it('triple-negative, including HER2-low', () => {
    expect(c({ erStatus: 'NEGATIVE', prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }).subtype).toBe('TRIPLE_NEGATIVE');
    const low = c({ erStatus: 'NEGATIVE', prStatus: 'NEGATIVE', her2Status: 'LOW' });
    expect(low.subtype).toBe('TRIPLE_NEGATIVE');
    expect(low.notes.join(' ')).toMatch(/HER2-low/);
  });

  it('HER2 equivocal or unknown cannot be finalised', () => {
    const r = c({ erStatus: 'NEGATIVE', prStatus: 'NEGATIVE', her2Status: 'EQUIVOCAL' });
    expect(r.subtype).toBe('UNDETERMINED');
    expect(r.missing.join(' ')).toMatch(/ISH/);
  });

  it('flags ER-low tumours', () => {
    expect(c({ erStatus: 'POSITIVE', erPercent: 5, prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }).notes.join(' ')).toMatch(/ER-low/);
  });

  // The rows from the sample spreadsheet. Two of the labels in the sheet
  // disagree with the receptor results recorded next to them.
  it.each([
    ['HT094/25: ER+, PR+ 30%, HER2-', { erStatus: 'POSITIVE', prStatus: 'POSITIVE', prPercent: 30, her2Status: 'NEGATIVE' }, 'LUMINAL_A_OR_B'],
    ['row 2: ER+ 30%, PR-, HER2-', { erStatus: 'POSITIVE', erPercent: 30, prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }, 'LUMINAL_B_HER2_NEGATIVE'],
    ['row 3: ER+ 30%, PR-, HER2-', { erStatus: 'POSITIVE', erPercent: 30, prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }, 'LUMINAL_B_HER2_NEGATIVE'],
    ['row 4: ER-, PR-, HER2-', { erStatus: 'NEGATIVE', prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }, 'TRIPLE_NEGATIVE'],
    ['row 7: ER+ 20%, PR-, HER2-', { erStatus: 'POSITIVE', erPercent: 20, prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' }, 'LUMINAL_B_HER2_NEGATIVE'],
  ] as const)('%s', (_label, input, expected) => {
    expect(c(input as Partial<ClinicalDetails>).subtype).toBe(expected);
  });
});

describe('clinicalDetailsSchema', () => {
  it('rejects a negative status with a positive percentage', () => {
    const r = clinicalDetailsSchema.safeParse({ ...base, erStatus: 'NEGATIVE', erPercent: 30, prStatus: 'NEGATIVE', her2Status: 'NEGATIVE' });
    expect(r.success).toBe(false);
  });
});

describe('subtypesAgree', () => {
  it('treats Luminal A-or-B as compatible with A and B (HER2-)', () => {
    expect(subtypesAgree('LUMINAL_A_OR_B', 'LUMINAL_A')).toBe(true);
    expect(subtypesAgree('LUMINAL_A_OR_B', 'TRIPLE_NEGATIVE')).toBe(false);
    expect(subtypesAgree('UNDETERMINED', 'LUMINAL_A')).toBeNull();
  });
});
