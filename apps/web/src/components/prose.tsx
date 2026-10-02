import type { ReactNode } from "react";
import { formatDate } from "@/lib/utils";

/** Layout for legal and information pages. */
export function ProsePage({
  title,
  updated,
  draft,
  children,
}: {
  title: string;
  updated?: string;
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-[32px] font-bold leading-tight">{title}</h1>
      {updated && <p className="mt-2 text-sm text-text-muted">Last updated {formatDate(updated)}</p>}
      {draft && (
        <p className="mt-4 rounded-lg border border-risk-moderate/30 bg-risk-moderate-bg p-4 text-[15px] text-text">
          <strong>Draft for legal review.</strong> This text is a starting point written to match how the product works. It must be
          reviewed by a lawyer familiar with the Nigeria Data Protection Act 2023 before launch.
        </p>
      )}
      <div className="prose-body mt-8 flex flex-col gap-4 text-[16px] leading-relaxed [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_a]:text-primary-600 [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
