import type { Metadata } from "next";
import { Logo, TrustStrip } from "@/components/brand";

export const metadata: Metadata = { title: "Maintenance", robots: { index: false } };

export default function MaintenancePage() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="mt-6 text-[32px] font-bold">We’ll be back shortly</h1>
      <p className="max-w-md text-text-muted">
        BreastScan AI is down for planned maintenance. Your records are safe. If you have urgent symptoms, please see a doctor or go
        to your nearest hospital — don’t wait for us.
      </p>
      <TrustStrip className="mt-4" />
    </main>
  );
}
