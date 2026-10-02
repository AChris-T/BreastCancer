"use client";

import {
  classify,
  clinicalDetailsSchema,
  HER2_LABELS,
  HER2_STATUSES,
  IMAGE_STAIN_LABELS,
  IMAGE_STAINS,
  LOCATION_SUGGESTIONS,
  RECEPTOR_LABELS,
  RECEPTOR_STATUSES,
  SCAN_TYPE_LABELS,
  SCAN_TYPES,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  type ClinicalDetails,
  type ScanDetail,
  type ScanType,
} from "@breastscan/shared";
import { useQueryClient } from "@tanstack/react-query";
import { CloudUpload, FileText, Image as ImageIcon, Scale, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { SubtypeBadge } from "@/components/badges";
import { TrustStrip } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/card";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/form";
import { errorMessage, uploadWithProgress } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";

const TYPE_HINTS: Record<ScanType, string> = {
  PATHOLOGY: "IHC (ER, PR, HER2, Ki-67) or H&E slide image",
  LAB_REPORT: "Histopathology or radiology report, photo or PDF",
  MAMMOGRAM: "Mammogram image",
  ULTRASOUND: "Breast ultrasound image",
  UNKNOWN: "The AI will work out what it is",
};
const TYPE_ORDER: ScanType[] = ["PATHOLOGY", "LAB_REPORT", "MAMMOGRAM", "ULTRASOUND", "UNKNOWN"];
const EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

type FormValues = Record<
  | "patientRef"
  | "diagnosisYear"
  | "patientAge"
  | "location"
  | "grade"
  | "gradeScore"
  | "erStatus"
  | "erPercent"
  | "prStatus"
  | "prPercent"
  | "her2Status"
  | "ki67Percent"
  | "diagnosis"
  | "imageStain"
  | "notes",
  string
>;

const EMPTY: FormValues = {
  patientRef: "",
  diagnosisYear: String(new Date().getFullYear()),
  patientAge: "",
  location: "",
  grade: "",
  gradeScore: "",
  erStatus: "UNKNOWN",
  erPercent: "",
  prStatus: "UNKNOWN",
  prPercent: "",
  her2Status: "UNKNOWN",
  ki67Percent: "",
  diagnosis: "",
  imageStain: "",
  notes: "",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const text = (v: string) => v.trim() || null;

function toDetails(v: FormValues): ClinicalDetails {
  return {
    patientRef: text(v.patientRef),
    diagnosisYear: num(v.diagnosisYear),
    patientAge: num(v.patientAge),
    location: text(v.location),
    grade: v.grade ? (Number(v.grade) as 1 | 2 | 3) : null,
    gradeScore: num(v.gradeScore),
    erStatus: v.erStatus as ClinicalDetails["erStatus"],
    erPercent: num(v.erPercent),
    prStatus: v.prStatus as ClinicalDetails["prStatus"],
    prPercent: num(v.prPercent),
    her2Status: v.her2Status as ClinicalDetails["her2Status"],
    ki67Percent: num(v.ki67Percent),
    diagnosis: text(v.diagnosis),
    imageStain: (v.imageStain || null) as ClinicalDetails["imageStain"],
  };
}

export default function NewCasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [type, setType] = useState<ScanType>("PATHOLOGY");
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => classify(toDetails(values)), [values]);

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    // A status change can resolve an error reported on its percentage field.
    const related = key === "erStatus" ? "erPercent" : key === "prStatus" ? "prPercent" : key;
    setErrors((errs) => ({ ...errs, [key]: undefined, [related]: undefined }));
  };
  const field = (key: keyof FormValues) => ({ value: values[key], onChange: set(key) });

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!EXTENSIONS.test(f.name)) return setError("Choose a JPG, PNG, WEBP, HEIC or PDF file.");
    if (f.size > UPLOAD_MAX_BYTES) return setError(`This file is ${formatBytes(f.size)}. The limit is 25 MB.`);
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = clinicalDetailsSchema.safeParse(toDetails(values));
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof FormValues] ??= issue.message;
      setErrors(next);
      return setError("Some details need correcting.");
    }
    if (!file) return setError("Choose the file to analyse.");
    if (!acknowledged) return setError("Please tick the box to confirm this is decision support.");

    const form = new FormData();
    form.append("declaredType", type);
    form.append("acknowledged", "true");
    for (const [key, value] of Object.entries(values)) {
      if (key === "imageStain" && type !== "PATHOLOGY") continue;
      if (value.trim()) form.append(key, value.trim());
    }
    form.append("file", file);

    setProgress(0);
    try {
      const scan = await uploadWithProgress<ScanDetail>("/scans", form, setProgress);
      void queryClient.invalidateQueries({ queryKey: ["scans"] });
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setProgress(null);
      setError(errorMessage(err));
    }
  };

  const uploading = progress !== null;
  const isPdf = file?.name.toLowerCase().endsWith(".pdf");

  return (
    <>
      <PageHeader title="New case" description="Enter the patient's details and receptor results, then upload the slide image or report." />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">Patient</h2>
            <Field label="Patient ID" hint="Your hospital or lab reference, e.g. HT094/25." error={errors.patientRef}>
              {(p) => <Input autoComplete="off" className="font-mono" {...p} {...field("patientRef")} />}
            </Field>
            <Field label="Age" error={errors.patientAge}>
              {(p) => <Input type="number" inputMode="numeric" min={0} max={120} {...p} {...field("patientAge")} />}
            </Field>
            <Field label="Year of diagnosis" error={errors.diagnosisYear}>
              {(p) => <Input type="number" inputMode="numeric" min={1950} max={2100} {...p} {...field("diagnosisYear")} />}
            </Field>
            <Field label="Location" error={errors.location}>
              {(p) => (
                <>
                  <Input list="locations" placeholder="e.g. Left breast" {...p} {...field("location")} />
                  <datalist id="locations">
                    {LOCATION_SUGGESTIONS.map((l) => (
                      <option key={l} value={l} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold sm:col-span-2">Pathology</h2>
            <Field label="Diagnosis" className="sm:col-span-2" error={errors.diagnosis} hint="e.g. Invasive ductal carcinoma, invasive carcinoma NST">
              {(p) => <Input {...p} {...field("diagnosis")} />}
            </Field>
            <Field label="Grade" error={errors.grade}>
              {(p) => (
                <Select {...p} {...field("grade")}>
                  <option value="">Not given</option>
                  <option value="1">Grade I</option>
                  <option value="2">Grade II</option>
                  <option value="3">Grade III</option>
                </Select>
              )}
            </Field>
            <Field label="Nottingham score (3–9)" error={errors.gradeScore}>
              {(p) => <Input type="number" inputMode="numeric" min={3} max={9} {...p} {...field("gradeScore")} />}
            </Field>

            <ReceptorFields name="ER" status={field("erStatus")} percent={field("erPercent")} error={errors.erPercent} />
            <ReceptorFields name="PR" status={field("prStatus")} percent={field("prPercent")} error={errors.prPercent} />

            <Field label="HER2">
              {(p) => (
                <Select {...p} {...field("her2Status")}>
                  {HER2_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {HER2_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ki-67 (%)" error={errors.ki67Percent} hint="Separates Luminal A from Luminal B (cut-off 20%).">
              {(p) => <Input type="number" inputMode="numeric" min={0} max={100} {...p} {...field("ki67Percent")} />}
            </Field>
          </Card>

          <Card>
            <fieldset>
              <legend className="text-lg font-semibold">File to analyse</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TYPE_ORDER.filter((t) => SCAN_TYPES.includes(t)).map((t) => (
                  <label
                    key={t}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                      type === t ? "border-primary-600 bg-primary-50" : "border-border hover:bg-bg",
                    )}
                  >
                    <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="mt-1 size-4 accent-primary-600" />
                    <span>
                      <span className="block font-medium">{SCAN_TYPE_LABELS[t]}</span>
                      <span className="block text-sm text-text-muted">{TYPE_HINTS[t]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {type === "PATHOLOGY" && (
              <Field
                label="Stain shown in this image"
                className="mt-4"
                hint="ER, PR and Ki-67 all stain nuclei brown, so the AI needs to know which one it is looking at."
              >
                {(p) => (
                  <Select {...p} {...field("imageStain")}>
                    <option value="">Not specified</option>
                    {IMAGE_STAINS.map((s) => (
                      <option key={s} value={s}>
                        {IMAGE_STAIN_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "mt-4 flex flex-col items-center gap-3 rounded-card border-2 border-dashed p-8 text-center transition-colors",
                dragging ? "border-teal-700 bg-teal-50" : "border-teal-700/40 bg-teal-50/60",
              )}
            >
              {file ? (
                <div className="flex w-full items-center gap-3 rounded-lg bg-surface p-3 text-left">
                  {isPdf ? <FileText className="size-8 text-teal-700" aria-hidden /> : <ImageIcon className="size-8 text-teal-700" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-sm text-text-muted">{formatBytes(file.size)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} disabled={uploading} aria-label="Remove file">
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <>
                  <CloudUpload className="size-10 text-teal-700" aria-hidden />
                  <p className="font-medium">Drag and drop the file here</p>
                  <p className="text-sm text-text-muted">JPG, PNG, WEBP, HEIC or PDF, up to 25 MB</p>
                  <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
                    Choose a file
                  </Button>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={UPLOAD_ACCEPT}
                className="sr-only"
                aria-label="Choose a file"
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </div>
            <Field label="Notes (optional)" className="mt-4" hint="For your own record. Not sent to the AI.">
              {(p) => <Textarea maxLength={1000} {...p} {...field("notes")} />}
            </Field>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-3" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-medium text-text-muted">
              <Scale className="size-4" aria-hidden /> Classification from the values entered
            </p>
            <div>
              <SubtypeBadge subtype={preview.subtype} size="lg" />
            </div>
            <p className="text-[15px]">{preview.reason}</p>
            {(preview.missing.length > 0 || preview.notes.length > 0) && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
                {preview.missing.map((m) => (
                  <li key={m}>Missing: {m}</li>
                ))}
                {preview.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-[13px] text-text-muted">The AI will also read the uploaded file and give its own suggestion.</p>
          </Card>
          <Card className="flex flex-col gap-4">
            <CheckboxField
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              label="I understand this is decision support and will confirm the subtype against the pathology report."
            />
            {error && <Alert tone="error">{error}</Alert>}
            {uploading && (
              <div aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-primary-600 transition-all" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  {progress !== null && progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Checking the file…"}
                </p>
              </div>
            )}
            <Button type="submit" size="lg" loading={uploading}>
              Save and analyse
            </Button>
          </Card>
          <TrustStrip />
        </div>
      </form>
    </>
  );
}

function ReceptorFields({
  name,
  status,
  percent,
  error,
}: {
  name: string;
  status: { value: string; onChange: (e: { target: { value: string } }) => void };
  percent: { value: string; onChange: (e: { target: { value: string } }) => void };
  error?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_6.5rem] gap-2">
      <Field label={name}>
        {(p) => (
          <Select {...p} {...status}>
            {RECEPTOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RECEPTOR_LABELS[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={`${name} %`} error={error}>
        {(p) => <Input type="number" inputMode="numeric" min={0} max={100} disabled={status.value === "UNKNOWN"} {...p} {...percent} />}
      </Field>
    </div>
  );
}
