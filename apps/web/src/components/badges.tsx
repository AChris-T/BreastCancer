import { SCAN_STATUS_LABELS, SUBTYPE_LABELS, type ScanStatus, type Subtype } from "@breastscan/shared";
import { CircleAlert, CircleCheck, CircleQuestionMark, Dna, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBTYPE_STYLE: Record<Subtype, string> = {
  LUMINAL_A: "bg-primary-50 text-primary-900",
  LUMINAL_B_HER2_NEGATIVE: "bg-primary-50 text-primary-900",
  LUMINAL_B_HER2_POSITIVE: "bg-teal-50 text-teal-700",
  HER2_ENRICHED: "bg-teal-50 text-teal-700",
  TRIPLE_NEGATIVE: "bg-[#FBEAF1] text-[#9E2D57]",
  LUMINAL_A_OR_B: "bg-risk-unknown-bg text-text",
  UNDETERMINED: "bg-risk-unknown-bg text-risk-unknown",
};

/** Always icon + word, never colour alone. */
export function SubtypeBadge({ subtype, size = "md" }: { subtype: Subtype; size?: "md" | "lg" }) {
  const Icon = subtype === "UNDETERMINED" ? CircleQuestionMark : Dna;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "lg" ? "px-4 py-2 text-base" : "px-2.5 py-1 text-[13px]",
        SUBTYPE_STYLE[subtype],
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
      {SUBTYPE_LABELS[subtype]}
    </span>
  );
}

export function AgreementBadge({ agreement, conflict = false }: { agreement: boolean | null; conflict?: boolean }) {
  if (agreement === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-unknown-bg px-2.5 py-1 text-[13px] font-semibold text-risk-unknown">
        <CircleQuestionMark className="size-4" aria-hidden /> Agreement not assessable
      </span>
    );
  }
  return agreement ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-low-bg px-2.5 py-1 text-[13px] font-semibold text-risk-low">
      <CircleCheck className="size-4" aria-hidden /> AI agrees with rules
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-moderate-bg px-2.5 py-1 text-[13px] font-semibold text-risk-moderate">
      <TriangleAlert className="size-4" aria-hidden /> {conflict ? "File contradicts entered values" : "AI disagrees with rules"}
    </span>
  );
}

export function StatusBadge({ status }: { status: ScanStatus }) {
  const working = status === "QUEUED" || status === "PROCESSING" || status === "UPLOADED";
  const failed = status === "FAILED" || status === "REJECTED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold",
        failed ? "bg-risk-high-bg text-risk-high" : "bg-primary-50 text-primary-900",
      )}
    >
      {working && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      {failed && <CircleAlert className="size-3.5" aria-hidden />}
      {SCAN_STATUS_LABELS[status]}
    </span>
  );
}
