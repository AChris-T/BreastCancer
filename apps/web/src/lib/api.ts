import type { ApiErrorBody, AuthResponse } from "@breastscan/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

// The access token lives only in memory; the refresh token is an httpOnly
// cookie the browser sends to /auth/* and that scripts can never read.
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionChange: ((session: AuthResponse | null) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function subscribeSession(listener: (session: AuthResponse | null) => void) {
  onSessionChange = listener;
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON error
  }
  const messages = Array.isArray(body.message) ? body.message : body.message ? [body.message] : [];
  const fallback =
    res.status === 429
      ? "Too many attempts. Please wait a minute and try again."
      : res.status >= 500
        ? "Something went wrong on our side. Please try again."
        : "The request could not be completed.";
  // The rate limiter's own message is not meant for people.
  const message = res.status === 429 && /Throttler/i.test(messages[0] ?? "") ? fallback : messages[0];
  return new ApiError(res.status, message ?? fallback, body.code, messages);
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers
 * share one request, and a Web Lock serialises refreshes across tabs so two
 * tabs never present the same rotating token at once.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    const run = async () => {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as AuthResponse;
    };
    try {
      const session =
        typeof navigator !== "undefined" && navigator.locks
          ? await navigator.locks.request("bs-refresh", run)
          : await run();
      accessToken = session?.accessToken ?? null;
      onSessionChange?.(session);
      return session;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Send without the access token (public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions, retry = true): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (!options.anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
    signal: options.signal,
  });

  if (res.status === 401 && retry && !options.anonymous && !path.startsWith("/auth/")) {
    const session = await refreshSession();
    if (session) return send(path, options, false);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? await res.json() : await res.text()) as T;
}

/** Fetches a file (PDF, zip) with auth and hands it to the browser as a download. */
export async function downloadFile(path: string, fallbackName: string, options: RequestOptions = {}) {
  const res = await send(path, options);
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Uploads with progress events, which fetch cannot report. */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (fraction: number) => void): Promise<T> {
  const attempt = (allowRetry: boolean): Promise<T> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}${path}`);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError(0, "Upload failed. Check your connection and try again."));
      xhr.onload = async () => {
        if (xhr.status === 401 && allowRetry && (await refreshSession())) {
          attempt(false).then(resolve, reject);
          return;
        }
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // ignore
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T);
        } else {
          const b = (body ?? {}) as Partial<ApiErrorBody>;
          const messages = Array.isArray(b.message) ? b.message : b.message ? [b.message] : [];
          reject(new ApiError(xhr.status, messages[0] ?? "Upload failed. Please try again.", b.code, messages));
        }
      };
      xhr.send(form);
    });
  return attempt(true);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "We could not reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
