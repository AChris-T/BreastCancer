"use client";

import { forgotPasswordSchema } from "@breastscan/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: values });
      setDone(res.message);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Card>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 text-text-muted">We will email you a link that works once, for 30 minutes.</p>
      {done ? (
        <Alert tone="success" className="mt-6">
          {done}
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Field label="Email" error={errors.email?.message}>
            {(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}
          </Field>
          <Button type="submit" loading={isSubmitting} size="lg">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-[15px]">
        <Link href="/login" className="font-medium text-primary-600">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
