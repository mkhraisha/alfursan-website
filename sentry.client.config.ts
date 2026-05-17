import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN,

  // Capture 10% of sessions for performance — adjust once you have traffic data
  tracesSampleRate: 0.1,

  // Capture replays only on errors to stay within free-tier limits
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});
