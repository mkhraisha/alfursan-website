import type { AstroIntegration } from "astro";
import { loadEnv } from "vite";

// Required at both build time and runtime.
const REQUIRED_ENV: Array<{ key: string; description: string }> = [
  { key: "SUPABASE_URL", description: "Supabase project URL" },
  { key: "SUPABASE_PUBLISHABLE_KEY", description: "Supabase publishable (anon) key" },
  { key: "SUPABASE_SECRET_KEY", description: "Supabase service role key" },
  { key: "RESEND_API_KEY", description: "Resend email API key" },
  { key: "RESEND_FROM_ADDRESS", description: "From address for outbound emails" },
  { key: "RESEND_DEALER_EMAIL", description: "Dealer email for application notifications" },
];

// Optional — the app degrades gracefully without these.
const OPTIONAL_ENV: Array<{ key: string; description: string }> = [
  { key: "UPSTASH_REDIS_REST_URL", description: "Upstash Redis REST URL (rate limiting — optional)" },
  { key: "UPSTASH_REDIS_REST_TOKEN", description: "Upstash Redis REST token (rate limiting — optional)" },
];

function validate(fatal: boolean) {
  // loadEnv reads .env, .env.local, .env.{mode}, .env.{mode}.local
  // Using prefix "" captures all vars (not just PUBLIC_ ones).
  // Shell env vars (process.env) take precedence over .env file values.
  const mode = fatal ? "production" : "development";
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env = { ...fileEnv, ...process.env };

  const missing = REQUIRED_ENV.filter(({ key }) => !env[key]);
  const missingOptional = OPTIONAL_ENV.filter(({ key }) => !env[key]);

  if (missingOptional.length > 0) {
    const lines = missingOptional
      .map(({ key, description }) => `  ⚠  ${key.padEnd(30)} ${description}`)
      .join("\n");
    console.warn(`\n\x1b[33m[check-env] Optional env vars not set (app will run without them):\x1b[0m\n${lines}\n`);
  }

  if (missing.length === 0) return;

  const lines = missing
    .map(({ key, description }) => `  ✗ ${key.padEnd(30)} ${description}`)
    .join("\n");

  if (fatal) {
    throw new Error(`[check-env] Aborting — missing required env vars:\n${lines}\n\n  Set these in Vercel dashboard or your .env file.`);
  } else {
    console.warn(
      `\n\x1b[33m[check-env] Warning: missing environment variables:\x1b[0m\n${lines}\n\n  Copy .env.example → .env and fill in the values.\n`
    );
  }
}

export function checkEnvIntegration(): AstroIntegration {
  return {
    name: "check-env",
    hooks: {
      // Runs after Vite loads .env — safe to read process.env here
      "astro:server:start": () => validate(false),
      "astro:build:start": () => validate(true),
    },
  };
}


