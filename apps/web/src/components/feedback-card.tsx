"use client";

import type { AnalysisView, FeedbackView } from "@breastscan/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Alert, Card } from "./ui/card";
import { Field, Textarea } from "./ui/form";

/** "Was this helpful?" and, later, "Did final pathology confirm it?" — a real-world accuracy signal. */
export function FeedbackCard({ analysis }: { analysis: AnalysisView }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<FeedbackView>(analysis.feedback ?? { helpful: true, doctorAgreed: null, comment: null });
  const [saved, setSaved] = useState(!!analysis.feedback);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: FeedbackView) => {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await api(`/analyses/${analysis.id}/feedback`, { method: "POST", body: { ...next, comment: next.comment || undefined } });
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["analysis", analysis.scanId] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Your feedback</h2>
      <Choice
        label="Was this analysis helpful?"
        value={saved ? value.helpful : null}
        onChange={(helpful) => save({ ...value, helpful })}
        disabled={busy}
      />
      <Choice
        label="Did the final pathology confirm the AI suggestion?"
        value={value.doctorAgreed}
        onChange={(doctorAgreed) => save({ ...value, doctorAgreed })}
        disabled={busy}
        hint="Answer once the subtype is confirmed. It is how the AI's real-world accuracy is measured."
      />
      <Field label="Anything else? (optional)">
        {(p) => (
          <Textarea
            maxLength={1000}
            value={value.comment ?? ""}
            onChange={(e) => setValue({ ...value, comment: e.target.value })}
            onBlur={() => value.comment !== (analysis.feedback?.comment ?? null) && saved && save(value)}
            {...p}
          />
        )}
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && !error && <p className="text-sm text-risk-low" aria-live="polite">Thank you — saved.</p>}
    </Card>
  );
}

function Choice({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="font-medium">{label}</legend>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
      <div className="mt-2 flex gap-2">
        {[true, false].map((v) => (
          <Button
            key={String(v)}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={value === v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(value === v && "border-primary-600 bg-primary-50 text-primary-900")}
          >
            {v ? "Yes" : "No"}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
