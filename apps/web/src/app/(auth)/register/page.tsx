"use client";

import { registerSchema, type AuthResponse, type RegisterInput } from "@breastscan/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const session = await api<AuthResponse>("/auth/register", { method: "POST", body: values });
      signIn(session);
      router.replace("/upload");
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Card>
      <h1 className="text-2xl font-bold">Create your clinician account</h1>
      <p className="mt-1 text-text-muted">Then classify your first case.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            {(p) => <Input autoComplete="given-name" {...p} {...register("firstName")} />}
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            {(p) => <Input autoComplete="family-name" {...p} {...register("lastName")} />}
          </Field>
        </div>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          hint="At least 10 characters with an uppercase letter, a lowercase letter and a number."
        >
          {(p) => <Input type="password" autoComplete="new-password" {...p} {...register("password")} />}
        </Field>
        <Button type="submit" loading={isSubmitting} size="lg">
          Create account
        </Button>
        <p className="text-center text-[13px] text-text-muted">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline">terms</Link> and{" "}
          <Link href="/privacy" className="underline">privacy notice</Link>.
        </p>
        <p className="text-center text-[15px] text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary-600">
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}
