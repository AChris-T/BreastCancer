import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    // Dates without a time (exam dates, birthdays) are stored at UTC midnight.
    ...(typeof value === "string" && value.length === 10 ? { timeZone: "UTC" } : {}),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function reportNumber(scanId: string): string {
  return `BS-${scanId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(value);
}

export function gradeText(c: { grade: 1 | 2 | 3 | null; gradeScore: number | null }): string {
  if (!c.grade) return "Not given";
  return `Grade ${["I", "II", "III"][c.grade - 1]}${c.gradeScore ? `, score ${c.gradeScore}` : ""}`;
}
