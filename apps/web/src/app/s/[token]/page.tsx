"use client";

import { ErrorCode, type SharedResultView } from "@breastscan/shared";
import { Download, ExternalLink, KeyRound, Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/brand";
import { ResultReport } from "@/components/result-report";
import { Button } from "@/components/ui/button";
import { Alert, Card, Spinner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api, ApiError, downloadFile, errorMessage } from "@/lib/api";
import { formatDate, reportNumber } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "pin"; error?: string }
  | { kind: "gone"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: SharedResultView; pin?: string };

/** Read-only view for a colleague the case was shared with. No account needed. */
export default function SharedResultPage() {
  const { token } = useParams<{ token: string }>();
  const [pin, setPin] = useState("");
  const [submittedPin, setSubmittedPin] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ["shared-result", token, submittedPin],
    queryFn: () =>
      api<SharedResultView>(`/public/share/${encodeURIComponent(token)}`, {
        anonymous: true,
        headers: submittedPin ? { "X-Share-Pin": submittedPin } : undefined,
      }),
    retry: false,
    staleTime: Infinity,
  });

  const state = toState(query.data, query.error, query.isPending, submittedPin);
  const busy = query.isFetching && !!submittedPin;

  const submitPin = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedPin(pin);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo />
          <span className="inline-flex items-center gap-2 text-sm font-medium text-text-muted">
            <Lock className="size-4" aria-hidden /> Shared case · read only
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {state.kind === "loading" && <Spinner label="Opening shared result" />}
        {state.kind === "pin" && (
          <Card className="mx-auto max-w-sm">
            <form onSubmit={submitPin} className="flex flex-col gap-4">
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <KeyRound className="size-5 text-primary-600" aria-hidden /> Enter the PIN
              </h1>
              <p className="text-text-muted">This case is protected with a PIN. Ask the colleague who shared it.</p>
              <Field label="PIN" error={state.error}>
                {(p) => (
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="font-mono text-xl tracking-[0.4em]"
                    {...p}
                  />
                )}
              </Field>
              <Button type="submit" loading={busy} disabled={pin.length < 4}>
                View result
              </Button>
            </form>
          </Card>
        )}
        {state.kind === "gone" && <Alert tone="info" title="This link is no longer available">{state.message}</Alert>}
        {state.kind === "error" && <Alert tone="error">{state.message}</Alert>}
        {state.kind === "ready" && <SharedResult token={token} data={state.data} pin={state.pin} />}
      </main>
    </div>
  );
}

function toState(data: SharedResultView | undefined, error: unknown, pending: boolean, pin: string | undefined): State {
  if (data) return { kind: "ready", data, pin };
  if (pending) return { kind: "loading" };
  if (error instanceof ApiError && error.code === ErrorCode.PIN_REQUIRED) return { kind: "pin" };
  if (error instanceof ApiError && error.status === 401) return { kind: "pin", error: error.message };
  if (error instanceof ApiError && error.status === 404) return { kind: "gone", message: error.message };
  return { kind: "error", message: errorMessage(error) };
}

function SharedResult({ token, data, pin }: { token: string; data: SharedResultView; pin?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = data.scan.mimeType.startsWith("image/");

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">
        This link expires {formatDate(data.expiresAt, true)}. Decision support only; confirm against the pathology report.
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await downloadFile(`/public/share/${encodeURIComponent(token)}/report.pdf`, `${reportNumber(data.scan.id)}.pdf`, {
                anonymous: true,
                headers: pin ? { "X-Share-Pin": pin } : undefined,
              });
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download aria-hidden /> Download PDF report
        </Button>
        {data.fileUrl && (
          <a
            href={data.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium hover:bg-primary-50"
          >
            <ExternalLink className="size-4" aria-hidden /> Open original file
          </a>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-[15px] text-text-muted">Shared by {data.sharedBy}</p>
      <ResultReport scan={data.scan} clinical={data.clinical} analysis={data.analysis} />
      {data.fileUrl && isImage && (
        <Card>
          <h2 className="mb-3 text-xl font-semibold">Original image</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={data.fileUrl} alt="The file uploaded for this case" className="max-h-[70vh] w-auto rounded-lg border border-border" />
          <p className="mt-2 text-sm text-text-muted">For security this image link expires after 5 minutes. Reload the page to see it again.</p>
        </Card>
      )}
    </div>
  );
}
