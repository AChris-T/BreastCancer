import { AI_LIMITATIONS, KI67_CUTOFF, MEDICAL_DISCLAIMER, PR_CUTOFF } from "@breastscan/shared";
import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Clinical disclaimer" };

export default function DisclaimerPage() {
  return (
    <ProsePage title="Clinical disclaimer">
      <p className="text-lg">{MEDICAL_DISCLAIMER}</p>
      <h2>Rules used</h2>
      <ul>
        <li>ER and PR are positive at 1% or more of nuclei staining.</li>
        <li>Luminal A: ER positive, PR {PR_CUTOFF}% or more, HER2 negative, Ki-67 below {KI67_CUTOFF}%.</li>
        <li>Luminal B (HER2-negative): ER positive, HER2 negative, and PR below {PR_CUTOFF}% or Ki-67 {KI67_CUTOFF}% or more.</li>
        <li>Luminal B (HER2-positive): ER and/or PR positive, HER2 positive.</li>
        <li>HER2-enriched: ER and PR negative, HER2 positive.</li>
        <li>Triple-negative: ER, PR and HER2 negative (HER2-low counts as negative).</li>
        <li>HER2 2+ (equivocal) cannot be classified until the ISH result is entered.</li>
      </ul>
      <h2>Limitations</h2>
      <ul>
        {AI_LIMITATIONS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </ProsePage>
  );
}
