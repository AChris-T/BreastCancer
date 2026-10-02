"use client";

import { passwordSchema } from "@breastscan/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Card, Spinner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords do not match", path: ["confirm"] });

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <Card>
        <Alert tone="error" title="This link is incomplete">
          Open the link from your email again, or <Link href="/forgot-password" className="underline">request a new one</Link>.
        </Alert>
      </Card>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Card>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {done ? (
        <div className="mt-6 flex flex-col gap-4">
          <Alert tone="success">Your password has been changed and other devices have been signed out.</Alert>
          <ButtonLink href="/login" size="lg">
            Sign in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Field label="New password" error={errors.password?.message} hint="At least 10 characters with upper and lower case letters and a number.">
            {(p) => <Input type="password" autoComplete="new-password" {...p} {...register("password")} />}
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message}>
            {(p) => <Input type="password" autoComplete="new-password" {...p} {...register("confirm")} />}
          </Field>
          <Button type="submit" loading={isSubmitting} size="lg">
            Save new password
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetForm />
    </Suspense>
  );
}
