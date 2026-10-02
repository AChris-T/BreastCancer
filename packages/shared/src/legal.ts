import type { ConsentType } from './enums.js';

// Bump a version when the wording of that document changes; users are asked
// to accept the new version and a fresh Consent row is written.
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  TERMS: '2026-10-01',
  PRIVACY: '2026-10-01',
  HEALTH_DATA: '2026-10-01',
  MARKETING: '2026-10-01',
};

export const REQUIRED_CONSENTS: ConsentType[] = ['TERMS', 'PRIVACY', 'HEALTH_DATA'];

export const MEDICAL_DISCLAIMER =
  'Clinical decision support only. The classification uses St Gallen 2013 surrogate definitions applied to the receptor results entered, ' +
  'and the AI suggestion is generated from the uploaded file. Neither replaces formal pathology review or multidisciplinary team decisions.';

export const AI_LIMITATIONS = [
  'The rule-based class is only as accurate as the ER, PR, HER2 and Ki-67 results entered.',
  'The AI suggestion is not validated against local pathology and can be wrong.',
  'Image quality, cropping and partial reports reduce what the AI can read.',
  'Ki-67 cut-offs vary between laboratories; 20% is used here.',
];
