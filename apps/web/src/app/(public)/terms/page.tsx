import { CONSENT_VERSIONS } from "@breastscan/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ProsePage title="Terms of use" updated={CONSENT_VERSIONS.TERMS} draft>
      <p>
        By creating an account you agree to these terms, the <Link href="/privacy">privacy notice</Link> and the{" "}
        <Link href="/disclaimer">clinical disclaimer</Link>.
      </p>

      <h2>Who may use it</h2>
      <p>BreastScan AI is for qualified clinicians and laboratory staff. Keep your password private and do not share your account.</p>

      <h2>What it is</h2>
      <p>
        Clinical decision support that classifies breast cancer into surrogate molecular subtypes from the receptor results you enter, with an
        AI reading of an uploaded file. It is not a medical device and does not replace pathology review or multidisciplinary team decisions.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only enter patient data you are authorised to process, under your institution&apos;s policies and a data processing agreement.</li>
        <li>Do not enter patient names; use a hospital or lab reference.</li>
        <li>Check the entered receptor results against the pathology report, and confirm every subtype before acting on it.</li>
        <li>Share links only with colleagues involved in the patient&apos;s care, and turn them off when no longer needed.</li>
      </ul>

      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for clinical decisions made using the output.</p>
    </ProsePage>
  );
}
