"use client";

import { SCAN_TYPE_LABELS, SCAN_TYPES, SUBTYPE_LABELS, SUBTYPES } from "@breastscan/shared";
import { ChevronRight, FileClock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge, SubtypeBadge } from "@/components/badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Spinner } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { useScans } from "@/lib/queries";
import { formatDate, reportNumber } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function CasesPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [classification, setClassification] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useScans({ search: search.trim(), type, classification, from, to, page, pageSize: PAGE_SIZE });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filtered = !!(search || type || classification || from || to);

  const update = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Cases" description="Every case you have classified, newest first." />
      <Card className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Patient ID" hint="Exact match">
          {(p) => <Input type="search" className="font-mono" value={search} onChange={(e) => update(() => setSearch(e.target.value))} {...p} />}
        </Field>
        <Field label="Classification">
          {(p) => (
            <Select value={classification} onChange={(e) => update(() => setClassification(e.target.value))} {...p}>
              <option value="">All</option>
              {SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {SUBTYPE_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="File type">
          {(p) => (
            <Select value={type} onChange={(e) => update(() => setType(e.target.value))} {...p}>
              <option value="">All types</option>
              {SCAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SCAN_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Added from">
          {(p) => <Input type="date" value={from} onChange={(e) => update(() => setFrom(e.target.value))} {...p} />}
        </Field>
        <Field label="Added to">
          {(p) => <Input type="date" value={to} onChange={(e) => update(() => setTo(e.target.value))} {...p} />}
        </Field>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-risk-high">We could not load your cases. Please refresh.</p>
      ) : !data?.items.length ? (
        <Card>
          <EmptyState icon={<FileClock />} title={filtered ? "No cases match these filters" : "No cases yet"}>
            {!filtered && (
              <ButtonLink href="/upload" className="mt-2">
                New case
              </ButtonLink>
            )}
          </EmptyState>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {data.items.map((s) => (
              <li key={s.id}>
                <Link href={`/scans/${s.id}`} className="flex flex-col gap-3 p-4 hover:bg-bg sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-lg font-semibold">{s.patientRef ?? "Unnamed case"}</p>
                    <p className="text-sm text-text-muted">
                      {SCAN_TYPE_LABELS[s.declaredType]} · added {formatDate(s.createdAt, true)} ·{" "}
                      <span className="font-mono">{reportNumber(s.id)}</span>
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
        </Card>
      )}

      {data && pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-text-muted">
            Page {page} of {pages}
          </span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </nav>
      )}
    </>
  );
}
