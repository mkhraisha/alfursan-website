import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN,

  // Capture all server-side traces — SSR functions are infrequent so overhead is low
  tracesSampleRate: 1.0,
});
