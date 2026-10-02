import { Lock, Ribbon, Stethoscope } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-md">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          inverted ? "bg-white/10 text-white" : "bg-primary-600 text-white",
        )}
      >
        <Ribbon className="size-5" aria-hidden />
      </span>
      <span className={cn("font-heading text-lg font-bold", inverted ? "text-white" : "text-primary-900")}>
        BreastScan <span className="text-pink-500">AI</span>
      </span>
    </Link>
  );
}

/** The reassurance strip shown on key pages. */
export function TrustStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-primary-50 px-4 py-3 text-sm font-medium text-primary-900",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <Lock className="size-4" aria-hidden /> Encrypted and private
      </span>
      <span className="inline-flex items-center gap-2">
        <Stethoscope className="size-4" aria-hidden /> Decision support, not a diagnosis
      </span>
    </div>
  );
}
