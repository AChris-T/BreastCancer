import { CONSENT_VERSIONS } from "@breastscan/shared";
import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy notice" updated={CONSENT_VERSIONS.PRIVACY} draft>
      <p>
        BreastScan AI is used by clinicians to classify breast cancer cases. This notice covers two kinds of data: the clinician&apos;s
        own account, and the patient data clinicians enter. Patient health data is <strong>sensitive personal data</strong> under the
        Nigeria Data Protection Act 2023 (NDPA).
      </p>

      <h2>Roles</h2>
      <p>
        For patient data, the clinician&apos;s hospital or practice is the data controller and decides the lawful basis for processing (usually
        the provision of health care). BreastScan AI processes that data on its behalf. A data processing agreement should be in place before
        real patient data is entered.
      </p>

      <h2>What we hold</h2>
      <ul>
        <li>Clinician accounts: name, email address and password (stored only as a one-way hash), sign-in records.</li>
        <li>Cases: patient ID, age, year of diagnosis, tumour location, grade, ER, PR, HER2, Ki-67 and diagnosis, plus the uploaded file.</li>
        <li>Results: the rule-based classification, the AI suggestion and any feedback.</li>
        <li>An audit log of sign-ins, uploads, result views, shares, exports and deletions.</li>
      </ul>
      <p>We ask for no patient names. Use your hospital or lab reference as the patient ID.</p>

      <h2>Security</h2>
      <p>
        Clinical details and notes are encrypted inside the database, files are kept in private encrypted storage and only served through
        links that expire after five minutes, and location and camera metadata is removed from photos. Each case is visible only to the
        clinician who created it, and to anyone they share a time-limited link with.
      </p>

      <h2>The AI service</h2>
      <p>
        Files are analysed by Google&apos;s Gemini service on a paid plan, under terms where submitted content is not used to improve Google&apos;s
        products. We send the file and the receptor results; we never send the patient ID or the clinician&apos;s name or email.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Cases are kept until the clinician deletes them or closes their account. A closed account and its cases are permanently deleted after
        30 days. Encrypted backups expire on a rolling schedule.
      </p>

      <h2>Breaches</h2>
      <p>
        If a breach is likely to put people&apos;s rights at risk we will tell the affected controllers without delay, so that the NDPC can be
        notified within 72 hours.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>One strictly necessary cookie keeps you signed in. It cannot be read by scripts and is not used for tracking.</p>

      <h2 id="contact">Contact</h2>
      <p>
        Data protection questions: <a href="mailto:privacy@breastscan.example">privacy@breastscan.example</a>
      </p>
    </ProsePage>
  );
}
