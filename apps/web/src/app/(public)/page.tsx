import { SUBTYPE_LABELS } from "@breastscan/shared";
import { Bot, ClipboardList, CloudUpload, Dna, FileText, Lock, Scale, ShieldCheck } from "lucide-react";
import { TrustStrip } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

const STEPS = [
  { icon: ClipboardList, title: "Enter the case", body: "Patient ID, age, grade and the ER, PR, HER2 and Ki-67 results." },
  { icon: CloudUpload, title: "Upload the evidence", body: "An IHC or H&E slide image, or the pathology report." },
  { icon: Scale, title: "Rules and AI classify", body: "St Gallen surrogate rules plus an AI reading of the file, side by side." },
  { icon: FileText, title: "Print, save or share", body: "A PDF report, a printable page, or a PIN-protected link for a colleague." },
];

const SUBTYPES = ["LUMINAL_A", "LUMINAL_B_HER2_NEGATIVE", "LUMINAL_B_HER2_POSITIVE", "HER2_ENRICHED", "TRIPLE_NEGATIVE"] as const;

const FAQ = [
  {
    q: "How is the classification made?",
    a: "Two ways, shown side by side. The rules apply the St Gallen 2013 surrogate definitions to the receptor results you enter (ER/PR positive at 1%, PR cut-off 20%, Ki-67 cut-off 20%). The AI reads the uploaded file and gives its own suggestion. If they disagree, the case is flagged.",
  },
  {
    q: "Why does Luminal A vs B need Ki-67?",
    a: "ER-positive, HER2-negative tumours with high PR are split by proliferation. Without Ki-67 the case is shown as “Luminal (A or B)” until it is entered.",
  },
  {
    q: "Is patient data sent to the AI?",
    a: "The file and the receptor results are. The Patient ID, your name and email are never sent. We use Google’s paid Gemini service, where submitted content is not used to train their models.",
  },
  {
    q: "Can it replace the pathologist?",
    a: "No. It is decision support. Confirm every subtype against the formal pathology report and your MDT.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
              <ShieldCheck className="size-4" aria-hidden /> For clinicians
            </p>
            <h1 className="text-[34px] font-bold leading-tight md:text-[44px]">Breast cancer subtype classification in minutes</h1>
            <p className="text-lg text-text-muted">
              Enter a patient&apos;s receptor results, upload the slide image or pathology report, and get the surrogate molecular subtype from
              the St Gallen rules alongside an AI second reading. Print it, save it as a PDF, or share it with a colleague.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg">
                Create an account
              </ButtonLink>
              <ButtonLink href="/login" size="lg" variant="outline">
                Sign in
              </ButtonLink>
            </div>
            <TrustStrip className="w-fit" />
          </div>
          <div className="rounded-card border border-border bg-bg p-6 shadow-card" aria-hidden>
            <p className="text-[13px] font-medium uppercase tracking-wide text-text-muted">Example case</p>
            <p className="mt-1 font-mono text-xl font-bold text-primary-900">HT094/25</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-text-muted">ER</dt>
                <dd className="font-medium">Positive 30%</dd>
              </div>
              <div>
                <dt className="text-text-muted">PR</dt>
                <dd className="font-medium">Negative</dd>
              </div>
              <div>
                <dt className="text-text-muted">HER2</dt>
                <dd className="font-medium">Negative</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-900">
                <Scale className="size-4" /> Rules: Luminal B (HER2-negative)
              </span>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-900">
                <Bot className="size-4" /> AI: Luminal B (HER2-negative)
              </span>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-text-muted">
              <Lock className="size-4" /> Encrypted, and only visible to you unless you share it
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-600">{i + 1}</span>
                <s.icon className="size-5 text-teal-700" aria-hidden />
              </div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface" aria-labelledby="types">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="types" className="text-2xl font-bold">Subtypes it reports</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {SUBTYPES.map((t) => (
              <li key={t} className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 font-medium text-teal-700">
                <Dna className="size-4" aria-hidden /> {SUBTYPE_LABELS[t]}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold">Questions</h2>
        <div className="mt-6 flex flex-col gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-card border border-border bg-surface p-5 shadow-card">
              <summary className="cursor-pointer list-none text-lg font-semibold marker:hidden">{f.q}</summary>
              <p className="mt-2 text-text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
