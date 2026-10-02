"use client";

import { SCAN_TYPE_LABELS, type ShareLinkView } from "@breastscan/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, Share2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

export default function SharesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["shares"], queryFn: () => api<ShareLinkView[]>("/share") });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/share/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shares"] }),
  });

  return (
    <>
      <PageHeader
        title="Shared links"
        description="Links you have shared with colleagues. Turn one off at any time; it stops working immediately."
      />
      {revoke.isError && <Alert tone="error" className="mb-4">{errorMessage(revoke.error)}</Alert>}
      <Card className="p-0">
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <EmptyState icon={<Share2 />} title="No shared links">
            Open an analysed case and choose “Share”.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <Link href={`/scans/${l.scanId}`} className="font-semibold hover:text-primary-600">
                    <span className="font-mono">{l.patientRef ?? "Unnamed case"}</span> · {SCAN_TYPE_LABELS[l.scanType]}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                    <span>Created {formatDate(l.createdAt)}</span>
                    <span>{l.revokedAt ? `Turned off ${formatDate(l.revokedAt)}` : `${l.active ? "Expires" : "Expired"} ${formatDate(l.expiresAt, true)}`}</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-4" aria-hidden /> {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                    </span>
                    {l.hasPin && (
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="size-4" aria-hidden /> PIN
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[13px] font-semibold",
                      l.active ? "bg-risk-low-bg text-risk-low" : "bg-risk-unknown-bg text-risk-unknown",
                    )}
                  >
                    {l.active ? "Active" : "Off"}
                  </span>
                  {l.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={revoke.isPending && revoke.variables === l.id}
                      onClick={() => revoke.mutate(l.id)}
                    >
                      Turn off
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
