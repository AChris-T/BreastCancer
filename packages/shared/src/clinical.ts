import { z } from 'zod';

export const RECEPTOR_STATUSES = ['POSITIVE', 'NEGATIVE', 'UNKNOWN'] as const;
export type ReceptorStatus = (typeof RECEPTOR_STATUSES)[number];

/** IHC score categories; EQUIVOCAL (2+) needs an ISH result to settle. */
export const HER2_STATUSES = ['NEGATIVE', 'LOW', 'EQUIVOCAL', 'POSITIVE', 'UNKNOWN'] as const;
export type Her2Status = (typeof HER2_STATUSES)[number];

export const RECEPTOR_LABELS: Record<ReceptorStatus, string> = {
  POSITIVE: 'Positive',
  NEGATIVE: 'Negative',
  UNKNOWN: 'Not tested / unknown',
};

export const HER2_LABELS: Record<Her2Status, string> = {
  NEGATIVE: 'Negative (IHC 0)',
  LOW: 'Low (IHC 1+)',
  EQUIVOCAL: 'Equivocal (IHC 2+, ISH pending)',
  POSITIVE: 'Positive (IHC 3+ or ISH amplified)',
  UNKNOWN: 'Not tested / unknown',
};

export const SUBTYPES = [
  'LUMINAL_A',
  'LUMINAL_B_HER2_NEGATIVE',
  'LUMINAL_B_HER2_POSITIVE',
  'HER2_ENRICHED',
  'TRIPLE_NEGATIVE',
  'LUMINAL_A_OR_B',
  'UNDETERMINED',
] as const;
export type Subtype = (typeof SUBTYPES)[number];

export const SUBTYPE_LABELS: Record<Subtype, string> = {
  LUMINAL_A: 'Luminal A',
  LUMINAL_B_HER2_NEGATIVE: 'Luminal B (HER2-negative)',
  LUMINAL_B_HER2_POSITIVE: 'Luminal B (HER2-positive)',
  HER2_ENRICHED: 'HER2-enriched',
  TRIPLE_NEGATIVE: 'Triple-negative',
  LUMINAL_A_OR_B: 'Luminal (A or B: needs Ki-67)',
  UNDETERMINED: 'Cannot classify yet',
};

/** Which stain a pathology image shows. Nuclear stains (ER, PR, Ki-67) look alike, so the AI needs telling. */
export const IMAGE_STAINS = ['HE', 'ER', 'PR', 'HER2', 'KI67', 'OTHER'] as const;
export type ImageStain = (typeof IMAGE_STAINS)[number];

export const IMAGE_STAIN_LABELS: Record<ImageStain, string> = {
  HE: 'H&E (no receptor stain)',
  ER: 'ER (oestrogen receptor)',
  PR: 'PR (progesterone receptor)',
  HER2: 'HER2',
  KI67: 'Ki-67',
  OTHER: 'Other / several stains',
};

export const LOCATION_SUGGESTIONS = ['Left breast', 'Right breast', 'Bilateral', 'Left axilla', 'Right axilla'];

const optionalInt = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message).nullable();

export const clinicalDetailsSchema = z
  .object({
    patientRef: z.string().trim().max(60).nullable(),
    diagnosisYear: optionalInt(1950, 2100, 'Enter a year such as 2025'),
    patientAge: optionalInt(0, 120, 'Enter an age from 0 to 120'),
    location: z.string().trim().max(80).nullable(),
    grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    gradeScore: optionalInt(3, 9, 'Nottingham score is 3 to 9'),
    erStatus: z.enum(RECEPTOR_STATUSES),
    erPercent: optionalInt(0, 100, 'Enter 0 to 100'),
    prStatus: z.enum(RECEPTOR_STATUSES),
    prPercent: optionalInt(0, 100, 'Enter 0 to 100'),
    her2Status: z.enum(HER2_STATUSES),
    ki67Percent: optionalInt(0, 100, 'Enter 0 to 100'),
    diagnosis: z.string().trim().max(200).nullable(),
    imageStain: z.enum(IMAGE_STAINS).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    const check = (status: ReceptorStatus, percent: number | null, name: 'er' | 'pr') => {
      if (percent === null) return;
      const path = [`${name}Percent`];
      const label = name.toUpperCase();
      if (status === 'NEGATIVE' && percent >= 1) {
        ctx.addIssue({ code: 'custom', path, message: `${label} is marked negative but ${percent}% is 1% or more` });
      }
      if (status === 'POSITIVE' && percent < 1) {
        ctx.addIssue({ code: 'custom', path, message: `${label} is marked positive but under 1% is negative` });
      }
    };
    check(d.erStatus, d.erPercent, 'er');
    check(d.prStatus, d.prPercent, 'pr');
  });
export type ClinicalDetails = z.infer<typeof clinicalDetailsSchema>;

export interface Classification {
  subtype: Subtype;
  /** One sentence explaining which rule applied. */
  reason: string;
  /** Results that would let the case be classified (or classified more precisely). */
  missing: string[];
  notes: string[];
}

/** St Gallen 2013 surrogate thresholds. */
export const KI67_CUTOFF = 20;
export const PR_CUTOFF = 20;

/**
 * Surrogate intrinsic subtype from ER, PR, HER2 and Ki-67 (St Gallen 2013).
 * ER/PR positive means ≥1% staining. Luminal A needs PR ≥20% and Ki-67 <20%.
 */
export function classify(d: Pick<ClinicalDetails, 'erStatus' | 'erPercent' | 'prStatus' | 'prPercent' | 'her2Status' | 'ki67Percent'>): Classification {
  const missing: string[] = [];
  const notes: string[] = [];
  if (d.erStatus === 'UNKNOWN') missing.push('ER status');
  if (d.prStatus === 'UNKNOWN') missing.push('PR status');
  if (d.her2Status === 'UNKNOWN') missing.push('HER2 status');
  if (d.her2Status === 'EQUIVOCAL') missing.push('HER2 ISH result (IHC 2+ is equivocal)');

  const result = (subtype: Subtype, reason: string): Classification => ({ subtype, reason, missing, notes });

  const hrPositive = d.erStatus === 'POSITIVE' || d.prStatus === 'POSITIVE';
  const hrNegative = d.erStatus === 'NEGATIVE' && d.prStatus === 'NEGATIVE';
  const her2Positive = d.her2Status === 'POSITIVE';
  const her2Negative = d.her2Status === 'NEGATIVE' || d.her2Status === 'LOW';
  if (d.her2Status === 'LOW') notes.push('HER2-low (IHC 1+) counts as HER2-negative for subtyping.');
  if (d.erStatus === 'POSITIVE' && d.erPercent !== null && d.erPercent < 10) {
    notes.push(`ER-low (${d.erPercent}%): these tumours often behave like ER-negative disease.`);
  }

  if (!her2Positive && !her2Negative) {
    return result('UNDETERMINED', 'HER2 status is needed to classify.');
  }

  if (her2Positive) {
    if (hrPositive) return result('LUMINAL_B_HER2_POSITIVE', 'Hormone receptor positive and HER2-positive.');
    if (hrNegative) return result('HER2_ENRICHED', 'ER and PR negative, HER2-positive.');
    return result('UNDETERMINED', 'HER2-positive, but ER and PR are both needed to tell HER2-enriched from Luminal B.');
  }

  // HER2-negative from here.
  if (hrNegative) return result('TRIPLE_NEGATIVE', 'ER, PR and HER2 are all negative.');
  if (!hrPositive) return result('UNDETERMINED', 'ER and PR results are needed to classify.');

  if (d.erStatus !== 'POSITIVE') {
    notes.push('PR-positive with ER-negative or unknown is uncommon; consider re-testing ER.');
  }

  const prLow = d.prStatus === 'NEGATIVE' || (d.prPercent !== null && d.prPercent < PR_CUTOFF);
  if (prLow) {
    return result('LUMINAL_B_HER2_NEGATIVE', `Hormone receptor positive, HER2-negative, PR below ${PR_CUTOFF}%.`);
  }
  if (d.ki67Percent !== null && d.ki67Percent >= KI67_CUTOFF) {
    return result('LUMINAL_B_HER2_NEGATIVE', `Hormone receptor positive, HER2-negative, Ki-67 ${d.ki67Percent}% (≥${KI67_CUTOFF}%).`);
  }
  if (d.prStatus === 'UNKNOWN') {
    return result('LUMINAL_A_OR_B', 'ER-positive, HER2-negative; PR result is needed to separate Luminal A from B.');
  }
  if (d.ki67Percent === null) {
    missing.push('Ki-67 %');
    return result('LUMINAL_A_OR_B', 'ER-positive, HER2-negative with PR ≥20%; Ki-67 is needed to separate Luminal A from B.');
  }
  if (d.prPercent === null) notes.push(`PR percentage not given; Luminal A assumes PR ≥${PR_CUTOFF}%.`);
  return result('LUMINAL_A', `Hormone receptor positive, HER2-negative, PR high and Ki-67 ${d.ki67Percent}% (<${KI67_CUTOFF}%).`);
}

/** True when the AI's suggestion is compatible with the rule-based class. */
export function subtypesAgree(rule: Subtype, ai: Subtype): boolean | null {
  if (rule === 'UNDETERMINED' || ai === 'UNDETERMINED') return null;
  if (rule === ai) return true;
  if (rule === 'LUMINAL_A_OR_B') return ai === 'LUMINAL_A' || ai === 'LUMINAL_B_HER2_NEGATIVE';
  if (ai === 'LUMINAL_A_OR_B') return rule === 'LUMINAL_A' || rule === 'LUMINAL_B_HER2_NEGATIVE';
  return false;
}

export function describeReceptor(status: ReceptorStatus, percent: number | null): string {
  if (status === 'UNKNOWN') return 'Unknown';
  return percent === null ? RECEPTOR_LABELS[status] : `${RECEPTOR_LABELS[status]} (${percent}%)`;
}

/** Nottingham total score (3–9) to grade: 3–5 → I, 6–7 → II, 8–9 → III. */
export function nottinghamGrade(score: number): 1 | 2 | 3 {
  return score <= 5 ? 1 : score <= 7 ? 2 : 3;
}

export const GRADE_LABELS: Record<1 | 2 | 3, string> = { 1: 'Grade I', 2: 'Grade II', 3: 'Grade III' };
