import type { AstroIntegration } from "astro";

const REQUIRED_ENV: Array<{ key: string; description: string }> = [
  { key: "SUPABASE_URL", description: "Supabase project URL" },
  { key: "SUPABASE_PUBLISHABLE_KEY", description: "Supabase publishable (anon) key" },
  { key: "SUPABASE_SECRET_KEY", description: "Supabase service role key" },
  { key: "RESEND_API_KEY", description: "Resend email API key" },
  { key: "RESEND_FROM_ADDRESS", description: "From address for outbound emails" },
  { key: "RESEND_DEALER_EMAIL", description: "Dealer email for application notifications" },
  { key: "UPSTASH_REDIS_REST_URL", description: "Upstash Redis REST URL (rate limiting)" },
  { key: "UPSTASH_REDIS_REST_TOKEN", description: "Upstash Redis REST token (rate limiting)" },
];

function validate(fatal: boolean) {
  const missing = REQUIRED_ENV.filter(({ key }) => !process.env[key]);
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
