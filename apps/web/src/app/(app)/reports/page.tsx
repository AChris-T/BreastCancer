"use client";

import { SCAN_TYPE_LABELS } from "@breastscan/shared";
import { Download, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SubtypeBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { downloadFile, errorMessage } from "@/lib/api";
import { useScans } from "@/lib/queries";
import { formatDate, reportNumber } from "@/lib/utils";

export default function ReportsPage() {
  const { data, isLoading } = useScans({ pageSize: 100 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reports = data?.items.filter((s) => s.status === "COMPLETED") ?? [];

  const download = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await downloadFile(`/scans/${id}/report.pdf`, `${reportNumber(id)}.pdf`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" description="Classification reports as PDF, ready to print or file." />
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <Card className="p-0">
        {isLoading ? (
          <Spinner />
        ) : reports.length === 0 ? (
          <EmptyState icon={<FileText />} title="No reports yet">
            A report is created for every analysed case.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/scans/${s.id}`} className="font-mono font-semibold hover:text-primary-600">
                    {s.patientRef ?? "Unnamed case"}
                  </Link>
                  <p className="text-sm text-text-muted">
                    {SCAN_TYPE_LABELS[s.declaredType]} · <span className="font-mono">{reportNumber(s.id)}</span> · analysed {formatDate(s.analysedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <SubtypeBadge subtype={s.classification} />
                  <Button variant="outline" size="sm" onClick={() => download(s.id)} loading={busy === s.id}>
                    <Download aria-hidden /> PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
