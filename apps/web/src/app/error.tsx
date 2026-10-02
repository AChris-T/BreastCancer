"use client";

import { Logo } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="mt-6 text-[32px] font-bold">Something went wrong</h1>
      <p className="max-w-md text-text-muted">
        Sorry — this page didn’t load properly. Your data is safe. Please try again, and if it keeps happening, come back a little later.
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Home
        </ButtonLink>
      </div>
    </main>
  );
}
