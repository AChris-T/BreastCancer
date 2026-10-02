"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Logo } from "./brand";
import { ButtonLink } from "./ui/button";

export function SiteHeader() {
  const { status } = useAuth();
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link href="/about" className="hidden rounded px-3 py-2 text-[15px] font-medium text-text hover:text-primary-600 sm:block">
            About
          </Link>
          {status === "authenticated" ? (
            <ButtonLink href="/dashboard" size="sm">
              Open my account
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" size="sm">
                Create account
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
        <p>BreastScan AI is clinical decision support for breast cancer subtyping. Confirm every result against formal pathology.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/privacy" className="hover:text-primary-600">Privacy</Link>
          <Link href="/terms" className="hover:text-primary-600">Terms</Link>
          <Link href="/disclaimer" className="hover:text-primary-600">Medical disclaimer</Link>
          <Link href="/privacy#cookies" className="hover:text-primary-600">Cookies</Link>
          <Link href="/about#contact" className="hover:text-primary-600">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
