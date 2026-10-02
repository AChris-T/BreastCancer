"use client";

import { SCAN_TYPE_LABELS } from "@breastscan/shared";
import { ChevronRight, CloudUpload, FileClock } from "lucide-react";
import Link from "next/link";
import { StatusBadge, SubtypeBadge } from "@/components/badges";
import { TrustStrip } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useScans } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useScans({ pageSize: 8 });

  return (
    <>
      <PageHeader
        title={`Hello${user?.lastName ? `, Dr ${user.lastName}` : ""}`}
        description="Your recent cases."
        actions={
          <ButtonLink href="/upload">
            <CloudUpload aria-hidden /> New case
          </ButtonLink>
        }
      />
      <TrustStrip className="mb-6" />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent cases</h2>
          <Link href="/history" className="text-[15px] font-medium text-primary-600">
            View all
          </Link>
        </div>
        {isLoading ? (
          <Spinner />
        ) : !data?.items.length ? (
          <EmptyState icon={<FileClock />} title="No cases yet">
            <p>Enter a patient&apos;s receptor results and upload a slide image or report to classify the first case.</p>
            <ButtonLink href="/upload" className="mt-3">
              New case
            </ButtonLink>
          </EmptyState>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.items.map((s) => (
              <li key={s.id}>
                <Link href={`/scans/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary-600">
                  <div>
                    <p className="font-mono font-medium">{s.patientRef ?? "Unnamed case"}</p>
                    <p className="text-sm text-text-muted">
                      {SCAN_TYPE_LABELS[s.declaredType]} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === "COMPLETED" ? <SubtypeBadge subtype={s.classification} /> : <StatusBadge status={s.status} />}
                    <ChevronRight className="size-5 text-text-muted" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
