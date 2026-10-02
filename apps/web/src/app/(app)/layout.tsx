import { AppShell } from "@/components/app-shell";

export default function PatientLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
