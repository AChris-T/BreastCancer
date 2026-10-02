import {
  describeReceptor,
  GRADE_LABELS,
  HER2_LABELS,
  IMAGE_STAIN_LABELS,
  SCAN_TYPE_LABELS,
  type AnalysisView,
  type ClinicalDetails,
  type MorphologyView,
  type ScanType,
} from "@breastscan/shared";
import { Bot, Microscope, Scale, Stethoscope, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, gradeText, reportNumber } from "@/lib/utils";
import { AgreementBadge, SubtypeBadge } from "./badges";

const SIGNIFICANCE: Record<string, { label: string; className: string }> = {
  ROUTINE: { label: "Routine", className: "bg-risk-low-bg text-risk-low" },
  NEEDS_FOLLOW_UP: { label: "Needs follow-up", className: "bg-risk-moderate-bg text-risk-moderate" },
  NEEDS_URGENT_REVIEW: { label: "Needs prompt review", className: "bg-risk-high-bg text-risk-high" },
};

interface ResultReportProps {
  scan: { id: string; declaredType: ScanType };
  clinical: ClinicalDetails | null;
  analysis: AnalysisView;
}

/** Reads like a pathology report: header block, then sections in a fixed order. */
export function ResultReport({ scan, clinical: c, analysis }: ResultReportProps) {
  const rule = analysis.classification;
  return (
    <article className="flex flex-col gap-6" aria-labelledby="result-title">
      <header className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-[13px] font-medium uppercase tracking-wide text-text-muted">Subtype classification</p>
          <h1 id="result-title" className="text-2xl font-bold">
            {c?.patientRef ? <span className="font-mono">{c.patientRef}</span> : "Unnamed case"}
          </h1>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3 lg:grid-cols-6">
          <Item label="Age" value={c?.patientAge ?? "—"} />
          <Item label="Year of diagnosis" value={c?.diagnosisYear ?? "—"} />
          <Item label="Location" value={c?.location ?? "—"} />
          <Item label="File" value={SCAN_TYPE_LABELS[scan.declaredType]} />
          <Item label="Report no." value={<span className="font-mono text-sm">{reportNumber(scan.id)}</span>} />
          <Item label="Analysed" value={formatDate(analysis.createdAt)} />
        </dl>
      </header>

      <section aria-labelledby="class-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="class-title" className="text-xl font-semibold">
            Classification
          </h2>
          <AgreementBadge agreement={analysis.agreement} conflict={analysis.aiConflict} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <Scale className="size-4" aria-hidden /> From receptor results (St Gallen rules)
            </p>
            <div className="mt-2">
              <SubtypeBadge subtype={rule.subtype} size="lg" />
            </div>
            <p className="mt-2 text-[15px]">{rule.reason}</p>
            {(rule.missing.length > 0 || rule.notes.length > 0) && (
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
                {rule.missing.map((m) => (
                  <li key={m}>Missing: {m}</li>
                ))}
                {rule.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <Bot className="size-4" aria-hidden /> AI suggestion from the uploaded file
            </p>
            <div className="mt-2">
              <SubtypeBadge subtype={analysis.aiSubtype} size="lg" />
            </div>
            <p className="mt-2 text-[15px]">{analysis.aiReasoning}</p>
          </div>
        </div>
        {analysis.agreement === false && (
          <p className="mt-4 rounded-lg bg-risk-moderate-bg p-3 text-[15px] text-text">
            {analysis.aiConflict
              ? "The AI found that the uploaded file contradicts the receptor results entered (see its reasoning above). Re-check them against the pathology report."
              : "The AI and the rules disagree. Re-check the entered ER, PR, HER2 and Ki-67 values against the pathology report."}
          </p>
        )}
      </section>

      {c && (
        <Section title="Clinical details entered">
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Grade" value={gradeText(c)} />
            <Item label="ER" value={describeReceptor(c.erStatus, c.erPercent)} />
            <Item label="PR" value={describeReceptor(c.prStatus, c.prPercent)} />
            <Item label="HER2" value={HER2_LABELS[c.her2Status]} />
            <Item label="Ki-67" value={c.ki67Percent === null ? "Not given" : `${c.ki67Percent}%`} />
            <Item label="Diagnosis" value={c.diagnosis ?? "Not given"} />
            {c.imageStain && <Item label="Stain in image" value={IMAGE_STAIN_LABELS[c.imageStain]} />}
          </dl>
        </Section>
      )}

      {analysis.morphology && <Morphology m={analysis.morphology} enteredGrade={c?.grade ?? null} />}

      <Section title="AI summary">
        <p className="text-[17px] leading-relaxed">{analysis.summary}</p>
      </Section>

      <Section title="Key findings from the file">
        {analysis.keyFindings.length === 0 ? (
          <p className="text-text-muted">No specific findings were listed.</p>
        ) : (
          <ul className="divide-y divide-border">
            {analysis.keyFindings.map((f, i) => {
              const sig = SIGNIFICANCE[f.significance] ?? SIGNIFICANCE.ROUTINE!;
              return (
                <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p>{f.finding}</p>
                    {f.location && <p className="text-sm text-text-muted">{f.location}</p>}
                  </div>
                  <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[13px] font-semibold ${sig.className}`}>
                    {sig.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Recommendations">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {analysis.recommendations.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Section>

      <Section title="Detailed analysis">
        <dl className="mb-3 grid grid-cols-2 gap-3 text-[15px]">
          <Item label="Detected file type" value={SCAN_TYPE_LABELS[analysis.detectedType]} />
          <Item label="Image quality" value={analysis.imageQuality.replace(/_/g, " ").toLowerCase()} />
        </dl>
        <p className="whitespace-pre-line">{analysis.detailedAnalysis}</p>
      </Section>

      <Section title="Limitations">
        <p>{analysis.limitations}</p>
      </Section>

      <aside className="flex gap-3 rounded-card border border-border bg-bg p-4 text-[15px] text-text-muted">
        <Stethoscope className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
        <p>{analysis.disclaimer}</p>
      </aside>
      <p className="font-mono text-[13px] text-text-muted">
        Model {analysis.model} · prompt {analysis.promptVersion}
      </p>
    </article>
  );
}

function Morphology({ m, enteredGrade }: { m: MorphologyView; enteredGrade: 1 | 2 | 3 | null }) {
  const score = (v: number | null) => (v === null ? "Not assessable" : `${v} / 3`);
  return (
    <section aria-labelledby="morph-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 id="morph-title" className="flex items-center gap-2 text-xl font-semibold">
        <Microscope className="size-5 text-teal-700" aria-hidden /> Morphology from the image
      </h2>
      <p className="mt-1 text-sm text-text-muted">AI estimate from the uploaded slide. It does not establish receptor status.</p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Invasive tumour seen" value={m.tumourPresent === "YES" ? "Yes" : m.tumourPresent === "NO" ? "No" : "Uncertain"} />
        <Item label="Tumour in view" value={m.tumourPercent === null ? "Not estimated" : `About ${m.tumourPercent}%`} />
        <Item label="Histological type" value={m.histologicalType ?? "Not assessable"} />
        <Item label="Tubule formation" value={score(m.tubuleScore)} />
        <Item label="Nuclear pleomorphism" value={score(m.pleomorphismScore)} />
        <Item label="Mitotic count" value={score(m.mitoticScore)} />
      </dl>
      <div className="mt-4 rounded-lg bg-bg p-3">
        <p className="text-[13px] text-text-muted">Estimated Nottingham grade</p>
        <p className="font-semibold">
          {m.estimatedGrade !== null
            ? `${GRADE_LABELS[m.estimatedGrade]}, score ${m.estimatedScore}/9`
            : m.gradeRange
              ? m.gradeRange.low === m.gradeRange.high
                ? `${GRADE_LABELS[m.gradeRange.low]} (whatever the mitotic count)`
                : `${GRADE_LABELS[m.gradeRange.low]} to ${GRADE_LABELS[m.gradeRange.high].replace("Grade ", "")}, depending on the mitotic count`
              : "Not assessable from this image"}
        </p>
        {m.estimatedGrade === null && m.gradeRange && (
          <p className="text-sm text-text-muted">Mitoses need counting across ten high-power fields, which one image cannot show.</p>
        )}
        {m.gradeDiffers === true && enteredGrade && (
          <p className="mt-2 flex items-start gap-2 text-[15px] text-risk-moderate">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Differs from the {GRADE_LABELS[enteredGrade]} entered. Grading from a single image is approximate; check against the full slide.
          </p>
        )}
        {m.gradeDiffers === false && <p className="mt-2 text-[15px] text-risk-low">Matches the grade entered.</p>}
        {m.gradeDiffers === null && m.gradeRange && enteredGrade && (
          <p className="mt-2 text-[15px] text-risk-low">The {GRADE_LABELS[enteredGrade]} entered is within this range.</p>
        )}
      </div>
      <p className="mt-3 text-[15px] text-text-muted">{m.comment}</p>
    </section>
  );
}

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
