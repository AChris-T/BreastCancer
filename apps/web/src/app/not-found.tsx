import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Logo />
      <h1 className="mt-6 text-[32px] font-bold">We can’t find that page</h1>
      <p className="max-w-md text-text-muted">The link may be old or mistyped. If you were opening a shared result, ask the patient for a new link.</p>
      <ButtonLink href="/" className="mt-2">
        Go to the home page
      </ButtonLink>
    </main>
  );
}
