import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { createElement as h, type ReactElement } from 'react';
import {
  describeReceptor,
  GRADE_LABELS,
  HER2_LABELS,
  IMAGE_STAIN_LABELS,
  SCAN_TYPE_LABELS,
  SUBTYPE_LABELS,
  type AnalysisView,
  type ClinicalDetails,
  type ScanType,
} from '@breastscan/shared';

export interface ReportData {
  requestedBy: string;
  scan: { id: string; declaredType: ScanType; examDate: string | null; createdAt: string };
  clinical: ClinicalDetails | null;
  analysis: AnalysisView;
  generatedAt: Date;
}

const COLORS = {
  primary900: '#0A2E52',
  text: '#1B2733',
  muted: '#5B6B7C',
  border: '#DCE3EC',
  pink: '#D6477A',
  infoBg: '#EAF3FC',
  agreeFg: '#17754A',
  agreeBg: '#E7F5EE',
  warnFg: '#975A16',
  warnBg: '#FDF4E3',
};

const SIGNIFICANCE: Record<string, string> = {
  ROUTINE: 'Routine',
  NEEDS_FOLLOW_UP: 'Needs follow-up',
  NEEDS_URGENT_REVIEW: 'Needs prompt review',
};

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontSize: 10.5, color: COLORS.text, fontFamily: 'Helvetica', lineHeight: 1.45 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.primary900 },
  ribbon: { width: 18, height: 4, backgroundColor: COLORS.pink, marginTop: 4 },
  reportTitle: { fontSize: 10, color: COLORS.muted },
  header: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 12, flexDirection: 'row', flexWrap: 'wrap' },
  headerCell: { width: '33%', marginBottom: 6 },
  label: { fontSize: 8.5, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  mono: { fontFamily: 'Courier-Bold', fontSize: 10 },
  classBox: { marginTop: 14, borderRadius: 6, padding: 12, backgroundColor: COLORS.infoBg, flexDirection: 'row' },
  classCol: { flex: 1, paddingRight: 8 },
  classTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.primary900 },
  agreement: { marginTop: 8, borderRadius: 6, padding: 8, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 16 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.primary900, marginBottom: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4 },
  rowLabel: { width: 140, color: COLORS.muted },
  rowValue: { flex: 1 },
  finding: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 5 },
  findingText: { flex: 1, paddingRight: 8 },
  findingTag: { width: 110, fontSize: 9, color: COLORS.muted, textAlign: 'right' },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  disclaimer: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, fontSize: 9, color: COLORS.muted },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8.5,
    color: COLORS.muted,
  },
});

function date(value: string | Date | null): string {
  if (!value) return 'Not given';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function cell(label: string, value: string, mono = false) {
  return h(View, { style: styles.headerCell }, h(Text, { style: styles.label }, label), h(Text, { style: mono ? styles.mono : styles.value }, value));
}

function row(label: string, value: string) {
  return h(View, { key: label, style: styles.row, wrap: false }, h(Text, { style: styles.rowLabel }, label), h(Text, { style: styles.rowValue }, value));
}

function section(title: string, ...children: ReactElement[]) {
  return h(View, { style: styles.section, wrap: true }, h(Text, { style: styles.h2 }, title), ...children);
}

function bullets(items: string[]) {
  return items.map((item, i) =>
    h(View, { key: i, style: styles.bullet }, h(Text, { style: { width: 14 } }, `${i + 1}.`), h(Text, { style: { flex: 1 } }, item)),
  );
}

export function reportNumber(scanId: string): string {
  return `BS-${scanId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export function gradeText(c: ClinicalDetails): string {
  if (!c.grade) return 'Not given';
  return `Grade ${['I', 'II', 'III'][c.grade - 1]}${c.gradeScore ? `, score ${c.gradeScore}` : ''}`;
}

export function buildReport(data: ReportData): ReactElement {
  const { analysis, scan, clinical: c } = data;
  const rule = analysis.classification;
  const agreement =
    analysis.agreement === true
      ? { text: 'AI suggestion agrees with the rule-based class.', fg: COLORS.agreeFg, bg: COLORS.agreeBg }
      : analysis.agreement === false
        ? {
            text: analysis.aiConflict
              ? 'The AI found the file CONTRADICTS the receptor results entered. Re-check them against the pathology report.'
              : 'AI suggestion DISAGREES with the rule-based class. Review the receptor results.',
            fg: COLORS.warnFg,
            bg: COLORS.warnBg,
          }
        : { text: 'Agreement cannot be assessed: one side is undetermined.', fg: COLORS.muted, bg: '#F0F2F5' };

  const findings = analysis.keyFindings.length
    ? analysis.keyFindings.map((f, i) =>
        h(
          View,
          { key: i, style: styles.finding, wrap: false },
          h(Text, { style: styles.findingText }, `${f.finding}${f.location ? ` (${f.location})` : ''}`),
          h(Text, { style: styles.findingTag }, SIGNIFICANCE[f.significance] ?? f.significance),
        ),
      )
    : [h(Text, { key: 'none' }, 'No specific findings were listed.')];

  const ruleNotes = [...rule.missing.map((m) => `Missing: ${m}`), ...rule.notes];

  return h(
    Document,
    { title: `Classification report ${reportNumber(scan.id)}`, author: 'BreastScan AI', subject: 'Breast cancer subtype classification' },
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(
        View,
        { style: styles.brandRow },
        h(View, null, h(Text, { style: styles.brand }, 'BreastScan AI'), h(View, { style: styles.ribbon })),
        h(Text, { style: styles.reportTitle }, 'Breast cancer subtype classification'),
      ),
      h(
        View,
        { style: styles.header },
        cell('Patient ID', c?.patientRef ?? 'Not given', true),
        cell('Age', c?.patientAge === null || c?.patientAge === undefined ? 'Not given' : String(c.patientAge)),
        cell('Year of diagnosis', c?.diagnosisYear ? String(c.diagnosisYear) : 'Not given'),
        cell('Report number', reportNumber(scan.id), true),
        cell('File type', SCAN_TYPE_LABELS[scan.declaredType]),
        cell('Analysed', date(analysis.createdAt)),
      ),
      h(
        View,
        { style: styles.classBox },
        h(
          View,
          { style: styles.classCol },
          h(Text, { style: styles.label }, 'Rule-based classification'),
          h(Text, { style: styles.classTitle }, SUBTYPE_LABELS[rule.subtype]),
          h(Text, { style: { marginTop: 2 } }, rule.reason),
        ),
        h(
          View,
          { style: styles.classCol },
          h(Text, { style: styles.label }, 'AI suggestion'),
          h(Text, { style: styles.classTitle }, SUBTYPE_LABELS[analysis.aiSubtype]),
          h(Text, { style: { marginTop: 2 } }, analysis.aiReasoning),
        ),
      ),
      h(Text, { style: [styles.agreement, { color: agreement.fg, backgroundColor: agreement.bg }] }, agreement.text),
      ...(ruleNotes.length ? [section('Classification notes', ...bullets(ruleNotes))] : []),
      section(
        'Clinical details entered',
        ...(c
          ? [
              row('Location', c.location ?? 'Not given'),
              row('Grade', gradeText(c)),
              row('ER', describeReceptor(c.erStatus, c.erPercent)),
              row('PR', describeReceptor(c.prStatus, c.prPercent)),
              row('HER2', HER2_LABELS[c.her2Status]),
              row('Ki-67', c.ki67Percent === null ? 'Not given' : `${c.ki67Percent}%`),
              row('Diagnosis', c.diagnosis ?? 'Not given'),
              ...(c.imageStain ? [row('Stain in image', IMAGE_STAIN_LABELS[c.imageStain])] : []),
            ]
          : [h(Text, { key: 'none' }, 'No clinical details were entered.')]),
      ),
      ...(analysis.morphology ? [morphologySection(analysis)] : []),
      section('AI summary', h(Text, null, analysis.summary)),
      section('Key findings from the file', ...findings),
      section('Detailed analysis', h(Text, null, analysis.detailedAnalysis)),
      section('Recommendations', ...bullets(analysis.recommendations)),
      section('Limitations', h(Text, null, analysis.limitations)),
      h(Text, { style: styles.disclaimer }, analysis.disclaimer),
      h(
        View,
        { style: styles.footer, fixed: true },
        h(Text, null, `${reportNumber(scan.id)} · Requested by ${data.requestedBy} · Generated ${date(data.generatedAt)} · ${analysis.model} / prompt ${analysis.promptVersion}`),
        h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
      ),
    ),
  );
}

function morphologySection(analysis: AnalysisView): ReactElement {
  const m = analysis.morphology!;
  const score = (v: number | null) => (v === null ? 'Not assessable' : String(v));
  const differs = m.gradeDiffers ? ' (DIFFERS from the grade entered)' : '';
  const grade =
    m.estimatedGrade !== null
      ? `${GRADE_LABELS[m.estimatedGrade]} (score ${m.estimatedScore}/9)${differs}`
      : m.gradeRange
        ? `${GRADE_LABELS[m.gradeRange.low]}${m.gradeRange.high !== m.gradeRange.low ? ` to ${GRADE_LABELS[m.gradeRange.high]}` : ''}, depending on mitotic count${differs}`
        : 'Not assessable from this image';
  return section(
    'Morphology from the image (AI estimate)',
    row('Invasive tumour seen', m.tumourPresent === 'YES' ? 'Yes' : m.tumourPresent === 'NO' ? 'No' : 'Uncertain'),
    row('Tumour in view', m.tumourPercent === null ? 'Not estimated' : `About ${m.tumourPercent}%`),
    row('Histological type', m.histologicalType ?? 'Not assessable'),
    row('Tubule formation', score(m.tubuleScore)),
    row('Nuclear pleomorphism', score(m.pleomorphismScore)),
    row('Mitotic count', score(m.mitoticScore)),
    row('Estimated grade', grade),
    h(Text, { key: 'comment', style: { marginTop: 4, color: COLORS.muted } }, m.comment),
  );
}

export function renderReport(data: ReportData): Promise<Buffer> {
  return renderToBuffer(buildReport(data) as Parameters<typeof renderToBuffer>[0]);
}
