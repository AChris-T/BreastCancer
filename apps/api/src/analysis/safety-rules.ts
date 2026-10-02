import type { KeyFinding, ModelMorphology, ModelResult, ScanType, Subtype } from '@breastscan/shared';

export type SafetyFlag = 'UNRELATED_OR_UNCLEAR_UPLOAD' | 'RECOMMENDATION_ADDED';

export interface CheckedResult {
  detectedType: ScanType;
  imageQuality: string;
  aiSubtype: Subtype;
  aiReasoning: string;
  aiConflict: boolean;
  morphology: ModelMorphology;
  keyFindings: KeyFinding[];
  detailedAnalysis: string;
  summary: string;
  recommendations: string[];
  limitations: string;
  flags: SafetyFlag[];
}

const REVIEW_STEP = 'Confirm the subtype against the formal pathology report before treatment decisions.';

/**
 * Code-side checks applied to every model result, whatever the prompt says.
 * Disagreement with the rule-based class is computed when the result is shown.
 */
export function applySafetyRules(result: ModelResult): CheckedResult {
  const flags: SafetyFlag[] = [];
  const unrelated = result.upload_type === 'UNRELATED' || result.upload_type === 'UNCLEAR';
  let aiSubtype: Subtype = result.suggested_subtype;
  if (unrelated && aiSubtype !== 'UNDETERMINED') {
    aiSubtype = 'UNDETERMINED';
    flags.push('UNRELATED_OR_UNCLEAR_UPLOAD');
  }

  const recommendations = result.recommendations.map((s) => s.trim()).filter(Boolean);
  if (!recommendations.some((s) => /patholog|MDT|multidisciplinary/i.test(s))) {
    recommendations.push(REVIEW_STEP);
    flags.push('RECOMMENDATION_ADDED');
  }

  return {
    detectedType: unrelated ? 'UNKNOWN' : (result.upload_type as ScanType),
    imageQuality: result.image_quality,
    aiSubtype,
    aiReasoning: result.subtype_reasoning.trim(),
    aiConflict: !unrelated && result.conflict_with_entered_details,
    // Morphology only makes sense for a pathology image.
    morphology: !unrelated && result.upload_type === 'PATHOLOGY' ? result.morphology : null,
    keyFindings: result.key_findings,
    detailedAnalysis: result.detailed_analysis.trim(),
    summary: result.summary.trim(),
    recommendations,
    limitations: result.limitations.trim(),
    flags,
  };
}
