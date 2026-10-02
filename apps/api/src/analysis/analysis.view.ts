import {
  classify,
  MEDICAL_DISCLAIMER,
  nottinghamGrade,
  type ModelMorphology,
  type MorphologyView,
  subtypesAgree,
  type AnalysisView,
  type ClinicalDetails,
  type KeyFinding,
  type Subtype,
} from '@breastscan/shared';
import type { Analysis, Feedback } from '../generated/prisma/client.js';

const NO_DETAILS = {
  subtype: 'UNDETERMINED' as const,
  reason: 'No receptor results were entered for this case.',
  missing: ['ER status', 'PR status', 'HER2 status'],
  notes: [],
};

/** The clinician-facing result. The disclaimer is always attached here, server-side. */
export function toAnalysisView(analysis: Analysis & { feedback?: Feedback | null }, clinical: ClinicalDetails | null): AnalysisView {
  const classification = clinical ? classify(clinical) : NO_DETAILS;
  const aiSubtype = analysis.aiSubtype as Subtype;
  return {
    id: analysis.id,
    scanId: analysis.scanId,
    detectedType: analysis.detectedType,
    imageQuality: analysis.imageQuality,
    classification,
    aiSubtype,
    aiReasoning: analysis.aiReasoning,
    aiConflict: analysis.aiConflict,
    morphology: toMorphologyView(analysis.morphology as ModelMorphology, clinical),
    // A reported contradiction counts as disagreement even if the AI could not settle on a subtype.
    agreement: analysis.aiConflict ? false : subtypesAgree(classification.subtype, aiSubtype),
    keyFindings: analysis.keyFindings as unknown as KeyFinding[],
    detailedAnalysis: analysis.detailedAnalysis,
    summary: analysis.plainSummary,
    recommendations: analysis.nextSteps as unknown as string[],
    limitations: analysis.limitations,
    disclaimer: MEDICAL_DISCLAIMER,
    model: analysis.model,
    promptVersion: analysis.promptVersion,
    createdAt: analysis.createdAt.toISOString(),
    feedback: analysis.feedback
      ? { helpful: analysis.feedback.helpful, doctorAgreed: analysis.feedback.doctorAgreed, comment: analysis.feedback.comment }
      : null,
  };
}

/** Adds the estimated Nottingham grade and compares it with the grade the doctor entered. */
export function toMorphologyView(m: ModelMorphology | null | undefined, clinical: ClinicalDetails | null): MorphologyView | null {
  if (!m) return null;
  const parts = [m.tubule_score, m.pleomorphism_score, m.mitotic_score];
  const scored = parts.filter((p): p is number => typeof p === 'number');
  const estimatedScore = scored.length === 3 ? scored.reduce((a, b) => a + b, 0) : null;
  const estimatedGrade = estimatedScore === null ? null : nottinghamGrade(estimatedScore);
  // With one component missing, it could score anywhere from 1 to 3.
  const known = scored.reduce((a, b) => a + b, 0);
  const gradeRange =
    estimatedGrade === null && scored.length === 2
      ? { low: nottinghamGrade(known + 1), high: nottinghamGrade(known + 3) }
      : null;
  const entered = clinical?.grade ?? null;
  let gradeDiffers: boolean | null = null;
  if (entered !== null && estimatedGrade !== null) gradeDiffers = estimatedGrade !== entered;
  else if (entered !== null && gradeRange) gradeDiffers = entered < gradeRange.low || entered > gradeRange.high ? true : null;
  return {
    tumourPresent: m.tumour_present,
    tumourPercent: m.tumour_percent,
    histologicalType: m.histological_type,
    tubuleScore: m.tubule_score,
    pleomorphismScore: m.pleomorphism_score,
    mitoticScore: m.mitotic_score,
    estimatedScore,
    estimatedGrade,
    gradeRange,
    gradeDiffers,
    comment: m.comment,
  };
}
