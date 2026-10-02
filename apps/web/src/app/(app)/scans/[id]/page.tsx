"use client";

import { SCAN_TYPE_LABELS, type AnalysisView, type ScanDetail } from "@breastscan/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Eye, Printer, RefreshCw, Share2, Trash } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { FeedbackCard } from "@/components/feedback-card";
import { ResultReport } from "@/components/result-report";
import { StatusBadge } from "@/components/badges";
import { ShareDialog } from "@/components/share-dialog";
import { Button } from "@/components/ui/button";
import { Alert, Card, Spinner } from "@/components/ui/card";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useAnalysis, useScan, WORKING_STATUSES } from "@/lib/queries";
import { formatBytes, formatDate, reportNumber } from "@/lib/utils";

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const scan = useScan(id);
  const done = scan.data?.status === "COMPLETED";
  const analysis = useAnalysis(id, done);

  if (scan.isLoading) return <Spinner label="Loading scan" />;
  if (scan.isError || !scan.data) {
    return (
      <Alert tone="error" title="We could not find this scan">
        It may have been deleted. <Link href="/history" className="underline">Go to your cases</Link>.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/history" className="inline-flex w-fit items-center gap-1 text-[15px] font-medium text-primary-600 print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> Cases
      </Link>
      {done && analysis.data ? (
        <Completed scan={scan.data} analysis={analysis.data} />
      ) : done && analysis.isLoading ? (
        <Spinner label="Loading result" />
      ) : (
        <InProgress scan={scan.data} />
      )}
    </div>
  );
}

function InProgress({ scan }: { scan: ScanDetail }) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api(`/scans/${scan.id}/analysis/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scan", scan.id] }),
  });
  const working = WORKING_STATUSES.includes(scan.status);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{scan.patientRef ?? "Unnamed case"}</h1>
          <p className="text-sm text-text-muted">
            {SCAN_TYPE_LABELS[scan.declaredType]} · <span className="font-mono">{reportNumber(scan.id)}</span>
          </p>
        </div>
        <StatusBadge status={scan.status} />
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {working && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-primary-50">
              <div className="h-full w-1/3 animate-[progress_1.6s_ease-in-out_infinite] rounded-full bg-primary-600" />
            </div>
            <p className="text-[17px]">
              {scan.status === "PROCESSING" ? "The AI is reading the file." : "The file is uploaded and waiting to be analysed."} This
              usually takes a minute or two. You can leave this page; you will get a notification when it is ready.
            </p>
          </>
        )}
        {scan.status === "FAILED" && (
          <Alert tone="error" title="We could not analyse this file">
            <p>{scan.failureReason ?? "Something went wrong."}</p>
            <Button className="mt-3" onClick={() => retry.mutate()} loading={retry.isPending}>
              <RefreshCw aria-hidden /> Try again
            </Button>
            {retry.isError && <p className="mt-2">{errorMessage(retry.error)}</p>}
          </Alert>
        )}
        {scan.status === "REJECTED" && (
          <Alert tone="error" title="This file was rejected">
            {scan.failureReason}
          </Alert>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[15px] sm:grid-cols-4">
        <div>
          <dt className="text-text-muted">Uploaded</dt>
          <dd>{formatDate(scan.createdAt, true)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Exam date</dt>
          <dd>{formatDate(scan.examDate)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">File</dt>
          <dd>
            {scan.mimeType.split("/")[1]?.toUpperCase()} · {formatBytes(scan.sizeBytes)}
          </dd>
        </div>
      </dl>
      <DeleteScan scanId={scan.id} />
    </Card>
  );
}

function Completed({ scan, analysis }: { scan: ScanDetail; analysis: AnalysisView }) {
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "pdf" | "file") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "pdf") {
        await downloadFile(`/scans/${scan.id}/report.pdf`, `${reportNumber(scan.id)}.pdf`);
      } else {
        const { url } = await api<{ url: string }>(`/scans/${scan.id}/file`);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => run("pdf")} loading={busy === "pdf"}>
          <Download aria-hidden /> Download PDF
        </Button>
        <Button variant="secondary" onClick={() => setSharing(true)}>
          <Share2 aria-hidden /> Share
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden /> Print
        </Button>
        <Button variant="outline" onClick={() => run("file")} loading={busy === "file"}>
          <Eye aria-hidden /> View original
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <ResultReport scan={scan} clinical={scan.clinical} analysis={analysis} />
      <div className="flex flex-col gap-6 print:hidden">
        <FeedbackCard analysis={analysis} />
        <DeleteScan scanId={scan.id} />
      </div>
      <ShareDialog scanId={scan.id} open={sharing} onClose={() => setSharing(false)} />
    </>
  );
}

function DeleteScan({ scanId }: { scanId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api(`/scans/${scanId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scans"] });
      router.replace("/history");
    },
  });
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="ghost"
        className="text-risk-high"
        loading={remove.isPending}
        onClick={() => {
          if (window.confirm("Delete this case, its result and any share links? This cannot be undone.")) remove.mutate();
        }}
      >
        <Trash aria-hidden /> Delete this case
      </Button>
      {remove.isError && <Alert tone="error">{errorMessage(remove.error)}</Alert>}
    </div>
  );
}
