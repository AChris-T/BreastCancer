// Loaded before anything else so Sentry can instrument the modules that follow.
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    // Health data must never reach Sentry: collect no bodies, headers, cookies,
    // query strings, model inputs/outputs, SQL values or local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        if (event.request.url) event.request.url = redactUrl(event.request.url);
      }
      return event;
    },
  });
}

/** Strips share tokens and signed-file tokens from URLs before they are logged or reported. */
export function redactUrl(url: string): string {
  return url.replace(/\/(public\/share|files)\/[^/?#]+/g, '/$1/[redacted]').replace(/([?&]token=)[^&#]+/g, '$1[redacted]');
}
