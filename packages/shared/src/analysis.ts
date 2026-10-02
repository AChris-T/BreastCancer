import { z } from 'zod';
import { SUBTYPES, type Classification, type ClinicalDetails, type Subtype } from './clinical.js';

const componentScore = z.number().int().min(1).max(3).nullable();

/** Morphology the AI reads from a pathology image (mainly H&E). */
export const morphologySchema = z
  .object({
    tumour_present: z.enum(['YES', 'NO', 'UNCERTAIN']).describe('Whether invasive carcinoma is visible'),
    tumour_percent: z.number().int().min(0).max(100).nullable().describe('Approximate % of the tissue in view that is invasive tumour'),
    histological_type: z.string().nullable().describe('e.g. invasive carcinoma NST (ductal), invasive lobular carcinoma, or null if not assessable'),
    tubule_score: componentScore.describe('Nottingham tubule formation 1-3, null if not assessable'),
    pleomorphism_score: componentScore.describe('Nottingham nuclear pleomorphism 1-3, null if not assessable'),
    mitotic_score: componentScore.describe('Nottingham mitotic count 1-3, null if not assessable at this magnification'),
    comment: z.string().describe('One or two sentences on the morphology and what limited the assessment'),
  })
  .nullable()
  .describe('Fill for pathology slide images; null for reports, mammograms, ultrasound or unrelated files');
export type ModelMorphology = z.infer<typeof morphologySchema>;
import type { ScanStatus, ScanType } from './enums.js';

/**
 * Shape the model must return. Sent to Gemini as the response schema and
 * re-validated on the server before anything is stored.
 */
export const modelResultSchema = z.object({
  upload_type: z
    .enum(['MAMMOGRAM', 'ULTRASOUND', 'PATHOLOGY', 'LAB_REPORT', 'UNRELATED', 'UNCLEAR'])
    .describe('What the uploaded file actually is, regardless of what was declared'),
  image_quality: z
    .enum(['GOOD', 'ADEQUATE', 'POOR', 'NOT_APPLICABLE'])
    .describe('Diagnostic quality of the image, or NOT_APPLICABLE for text reports'),
  suggested_subtype: z.enum(SUBTYPES).describe('Surrogate intrinsic subtype the evidence supports, or UNDETERMINED'),
  subtype_reasoning: z.string().min(1).describe('Which evidence supports the suggested subtype'),
  conflict_with_entered_details: z
    .boolean()
    .describe('True if anything the file shows contradicts a receptor value the doctor entered'),
  morphology: morphologySchema,
  key_findings: z
    .array(
      z.object({
        finding: z.string().min(1),
        location: z.string().nullable(),
        significance: z.enum(['ROUTINE', 'NEEDS_FOLLOW_UP', 'NEEDS_URGENT_REVIEW']),
      }),
    )
    .max(15),
  detailed_analysis: z.string().min(1).describe('Description of the file for a clinician'),
  summary: z.string().min(1).describe('Two to four sentence clinical summary'),
  recommendations: z.array(z.string().min(1)).min(1).max(8),
  limitations: z.string().min(1),
});
export type ModelResult = z.infer<typeof modelResultSchema>;
export type KeyFinding = ModelResult['key_findings'][number];

export interface AnalysisView {
  id: string;
  scanId: string;
  detectedType: ScanType;
  imageQuality: string;
  /** Rule-based classification from the entered receptor results. */
  classification: Classification;
  aiSubtype: Subtype;
  aiReasoning: string;
  /** The AI found the file contradicts an entered receptor value. */
  aiConflict: boolean;
  /** false on disagreement or conflict; null when either side is undetermined. */
  agreement: boolean | null;
  morphology: MorphologyView | null;
  keyFindings: KeyFinding[];
  detailedAnalysis: string;
  summary: string;
  recommendations: string[];
  limitations: string;
  disclaimer: string;
  model: string;
  promptVersion: string;
  createdAt: string;
  feedback: FeedbackView | null;
}

export interface MorphologyView {
  tumourPresent: 'YES' | 'NO' | 'UNCERTAIN';
  tumourPercent: number | null;
  histologicalType: string | null;
  tubuleScore: number | null;
  pleomorphismScore: number | null;
  mitoticScore: number | null;
  /** Sum of the three components, only when all three were assessable. */
  estimatedScore: number | null;
  estimatedGrade: 1 | 2 | 3 | null;
  /**
   * Possible grades when one component (usually mitoses, which need ten
   * high-power fields) could not be scored. null if fewer than two were scored.
   */
  gradeRange: { low: 1 | 2 | 3; high: 1 | 2 | 3 } | null;
  /**
   * true: the entered grade is outside what the image supports.
   * false: it matches the full estimate. null: not assessable, or within the range.
   */
  gradeDiffers: boolean | null;
  comment: string;
}

export interface FeedbackView {
  helpful: boolean;
  /** "Did final pathology confirm the classification?" */
  doctorAgreed: boolean | null;
  comment: string | null;
}

export interface ScanSummary {
  id: string;
  declaredType: ScanType;
  examDate: string | null;
  status: ScanStatus;
  failureReason: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  patientRef: string | null;
  classification: Subtype;
  analysedAt: string | null;
}

export interface ScanDetail extends ScanSummary {
  notes: string | null;
  clinical: ClinicalDetails | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
export const UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf';

export const SHARE_DURATION_OPTIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 336, label: '14 days' },
  { hours: 720, label: '30 days' },
] as const;
export const SHARE_MIN_HOURS = 24;
export const SHARE_MAX_HOURS = 720;

export interface ShareLinkView {
  id: string;
  scanId: string;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  hasPin: boolean;
  createdAt: string;
  active: boolean;
  scanType: ScanType;
  patientRef: string | null;
}

export interface CreatedShareLink extends ShareLinkView {
  /** Only returned once, at creation. */
  url: string;
}

export interface SharedResultView {
  sharedBy: string;
  scan: { id: string; declaredType: ScanType; examDate: string | null; createdAt: string; mimeType: string };
  clinical: ClinicalDetails | null;
  analysis: AnalysisView;
  fileUrl: string | null;
  expiresAt: string;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
