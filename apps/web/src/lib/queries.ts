"use client";

import type { AnalysisView, Paginated, ScanDetail, ScanSummary } from "@breastscan/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const WORKING_STATUSES = ["UPLOADED", "QUEUED", "PROCESSING"];

export function useScans(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: ["scans", search],
    queryFn: () => api<Paginated<ScanSummary>>(`/scans${search ? `?${search}` : ""}`),
    // Keep lists fresh while anything is still being analysed.
    refetchInterval: (q) => (q.state.data?.items.some((s) => WORKING_STATUSES.includes(s.status)) ? 5000 : false),
  });
}

/** Polls every 3 s while the analysis is queued or running. */
export function useScan(id: string) {
  return useQuery({
    queryKey: ["scan", id],
    queryFn: () => api<ScanDetail>(`/scans/${id}`),
    refetchInterval: (q) => (q.state.data && WORKING_STATUSES.includes(q.state.data.status) ? 3000 : false),
  });
}

export function useAnalysis(id: string, enabled: boolean) {
  return useQuery({ queryKey: ["analysis", id], queryFn: () => api<AnalysisView>(`/scans/${id}/analysis`), enabled });
}
