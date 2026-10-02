"use client";

import { SHARE_DURATION_OPTIONS, type CreatedShareLink } from "@breastscan/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Alert } from "./ui/card";
import { Field, Input, Select } from "./ui/form";

/** Creates a time-limited, optionally PIN-protected link for a doctor. */
export function ShareDialog({ scanId, open, onClose }: { scanId: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(168);
  const [pin, setPin] = useState("");
  const [created, setCreated] = useState<CreatedShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setCreated(null);
    setPin("");
    setError(null);
    setCopied(false);
    onClose();
  };

  const create = async () => {
    setError(null);
    if (pin && !/^[0-9]{4,6}$/.test(pin)) return setError("The PIN must be 4 to 6 digits.");
    setBusy(true);
    try {
      const link = await api<CreatedShareLink>(`/scans/${scanId}/share`, {
        method: "POST",
        body: { expiresInHours: hours, pin: pin || undefined },
      });
      setCreated(link);
      void queryClient.invalidateQueries({ queryKey: ["shares"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
  };

  return (
    <dialog
      ref={ref}
      onClose={reset}
      aria-labelledby="share-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-text shadow-card backdrop:bg-primary-900/40"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id="share-title" className="text-xl font-semibold">Share this case</h2>
        <Button variant="ghost" size="icon" onClick={() => ref.current?.close()} aria-label="Close">
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {created ? (
          <>
            <Alert tone="success" title="Link created">
              It works until {formatDate(created.expiresAt, true)}. You can turn it off any time from Shared links.
            </Alert>
            <Field label="Share link">
              {(p) => <Input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} {...p} />}
            </Field>
            {pin && (
              <p className="text-[15px]">
                Give the PIN <strong className="font-mono">{pin}</strong> to your colleague separately, for example by phone. It will not
                be shown again.
              </p>
            )}
            <Button onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy link"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-text-muted">
              Anyone with the link can see this case: the patient ID, clinical details and result. Add a PIN for extra protection.
            </p>
            <Field label="Link works for">
              {(p) => (
                <Select value={hours} onChange={(e) => setHours(Number(e.target.value))} {...p}>
                  {SHARE_DURATION_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="PIN (recommended)" hint="4 to 6 digits. The link turns off after 10 wrong PINs.">
              {(p) => (
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="font-mono tracking-widest"
                  {...p}
                />
              )}
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button onClick={create} loading={busy}>
              Create link
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
