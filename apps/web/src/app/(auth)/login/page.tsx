"use client";

import { loginSchema, type AuthResponse, type LoginInput } from "@breastscan/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Alert, Card, Spinner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { signIn, status } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (status === "authenticated") router.replace(homeFor(next));
  }, [status, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const session = await api<AuthResponse>("/auth/login", { method: "POST", body: values });
      signIn(session);
      router.replace(homeFor(next));
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Card>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-text-muted">Welcome back.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(p) => <Input type="password" autoComplete="current-password" {...p} {...register("password")} />}
        </Field>
        <Button type="submit" loading={isSubmitting} size="lg">
          Sign in
        </Button>
        <div className="flex justify-between text-[15px]">
          <Link href="/forgot-password" className="font-medium text-primary-600">
            Forgot password?
          </Link>
          <Link href="/register" className="font-medium text-primary-600">
            Create an account
          </Link>
        </div>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginForm />
    </Suspense>
  );
}
