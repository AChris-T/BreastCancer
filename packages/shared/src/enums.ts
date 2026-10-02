// Mirrors the Prisma enums in apps/api/prisma/schema.prisma.

export const Role = { PATIENT: 'PATIENT', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ScanType = {
  MAMMOGRAM: 'MAMMOGRAM',
  ULTRASOUND: 'ULTRASOUND',
  PATHOLOGY: 'PATHOLOGY',
  LAB_REPORT: 'LAB_REPORT',
  UNKNOWN: 'UNKNOWN',
} as const;
export type ScanType = (typeof ScanType)[keyof typeof ScanType];
export const SCAN_TYPES = Object.values(ScanType);

export const ScanStatus = {
  UPLOADED: 'UPLOADED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const RiskLevel = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  UNABLE_TO_ASSESS: 'UNABLE_TO_ASSESS',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];
export const RISK_LEVELS = Object.values(RiskLevel);

export const ConsentType = {
  TERMS: 'TERMS',
  PRIVACY: 'PRIVACY',
  HEALTH_DATA: 'HEALTH_DATA',
  MARKETING: 'MARKETING',
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];
export const CONSENT_TYPES = Object.values(ConsentType);

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  MAMMOGRAM: 'Mammogram',
  ULTRASOUND: 'Breast ultrasound',
  PATHOLOGY: 'Pathology / IHC slide image',
  LAB_REPORT: 'Pathology or radiology report',
  UNKNOWN: 'Not sure',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  UNABLE_TO_ASSESS: 'Unable to assess',
};

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  UPLOADED: 'Uploaded',
  QUEUED: 'Waiting in queue',
  PROCESSING: 'Analysing',
  COMPLETED: 'Complete',
  FAILED: 'Analysis failed',
  REJECTED: 'File rejected',
};

export const CONSENT_LABELS: Record<ConsentType, string> = {
  TERMS: 'Terms of use',
  PRIVACY: 'Privacy notice',
  HEALTH_DATA: 'Processing of my health data',
  MARKETING: 'Product news and health tips by email',
};
