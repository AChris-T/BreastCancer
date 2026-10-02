import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600 disabled:opacity-60 aria-[invalid=true]:border-risk-high";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-text", className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("mt-0.5 size-5 shrink-0 rounded border-border accent-primary-600", className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label, control, hint and error wired together for screen readers. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-risk-high">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({
  label,
  error,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
        <Checkbox id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 pl-8 text-[13px] font-medium text-risk-high">
          {error}
        </p>
      )}
    </div>
  );
}
