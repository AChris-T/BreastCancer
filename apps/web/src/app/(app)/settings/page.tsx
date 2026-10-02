"use client";

import { changePasswordSchema, type SessionView } from "@breastscan/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Monitor, Smartphone, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <Section id="password" title="Password">
          <ChangePassword />
        </Section>
        <Section id="sessions" title="Signed-in devices">
          <Sessions />
        </Section>
        <Section id="export" title="Download your data">
          <ExportData />
        </Section>
        <Section id="delete" title="Delete account">
          <DeleteAccount />
        </Section>
      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function ChangePassword() {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      const res = await api<{ message: string }>("/auth/change-password", { method: "POST", body: values });
      setMessage({ tone: "success", text: res.message });
      reset();
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:max-w-md">
      <Field label="Current password" error={errors.currentPassword?.message}>
        {(p) => <Input type="password" autoComplete="current-password" {...p} {...register("currentPassword")} />}
      </Field>
      <Field label="New password" error={errors.newPassword?.message} hint="At least 10 characters with upper and lower case letters and a number.">
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...register("newPassword")} />}
      </Field>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" loading={isSubmitting} className="w-fit">
        Change password
      </Button>
    </form>
  );
}

function Sessions() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: () => api<SessionView[]>("/auth/sessions") });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
  if (isLoading) return <Spinner />;
  return (
    <ul className="divide-y divide-border">
      {data?.map((s) => {
        const mobile = /mobile|android|iphone/i.test(s.userAgent ?? "");
        const Icon = mobile ? Smartphone : Monitor;
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 text-text-muted" aria-hidden />
              <div>
                <p className="font-medium">
                  {describeAgent(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-risk-low-bg px-2 py-0.5 text-[12px] font-semibold text-risk-low">This device</span>}
                </p>
                <p className="text-sm text-text-muted">
                  Signed in {formatDate(s.createdAt, true)}
                  {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                </p>
              </div>
            </div>
            {!s.current && (
              <Button variant="outline" size="sm" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                Sign out
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function ExportData() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted">A zip file with your profile, uploads, results, consents and sign-in history (JSON) plus your original files.</p>
      <Button
        variant="outline"
        className="w-fit"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadFile("/account/export", "breastscan-export.zip");
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download aria-hidden /> Download my data
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

function DeleteAccount() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-4 sm:max-w-md">
      <p className="text-text-muted">
        You will be signed out everywhere and your share links will stop working. Your account, scans and results are
        permanently deleted after 30 days. Download your data first if you want a copy.
      </p>
      <label className="flex items-start gap-3">
        <Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        <span>I understand this cannot be undone after 30 days.</span>
      </label>
      <Field label="Password">
        {(p) => <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...p} />}
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        variant="danger"
        className="w-fit"
        disabled={!confirm || !password}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/account", { method: "DELETE", body: { password } });
            await signOut().catch(() => undefined);
            router.replace("/?deleted=1");
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      >
        <Trash aria-hidden /> Delete my account
      </Button>
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <KeyRound className="size-4" aria-hidden /> Need help instead? Contact privacy@breastscan.example.
      </p>
    </div>
  );
}
