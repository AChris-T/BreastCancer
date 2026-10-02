import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ProsePage title="About BreastScan AI">
      <p>
        Molecular subtype guides breast cancer treatment, but classifying cases consistently takes time and receptor results are easy to
        misread. BreastScan AI gives clinicians a fast, transparent classification from the St Gallen surrogate rules, a second reading of the
        slide image or report by AI, and a clear flag when the two disagree.
      </p>
      <h2>Principles</h2>
      <ul>
        <li><strong>Transparent rules first.</strong> Every classification shows which rule applied and what is missing.</li>
        <li><strong>AI as a second reader.</strong> The AI suggestion is shown beside the rules, never instead of them.</li>
        <li><strong>Private by default.</strong> Cases are encrypted and visible only to the clinician who created them.</li>
      </ul>
      <h2 id="contact">Contact</h2>
      <p>
        General questions: <a href="mailto:hello@breastscan.example">hello@breastscan.example</a>
        <br />
        Data protection: <a href="mailto:privacy@breastscan.example">privacy@breastscan.example</a>
      </p>
    </ProsePage>
  );
}
