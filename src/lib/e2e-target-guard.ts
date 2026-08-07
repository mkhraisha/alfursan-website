/**
 * Guards the Playwright e2e suite (see playwright.config.ts) against ever
 * running against a non-local target — most importantly, production.
 *
 * The suite performs real writes via admin actions — vehicles, expenses,
 * finance applications, cache purges, etc. — against whatever E2E_BASE_URL
 * points at. Unlike scripts/migrate-wordpress-inventory.mjs's equivalent
 * check (which guards a single script's DB writes), this has to stop the
 * *entire suite* before any spec file runs, since any one of them could
 * mutate real data the moment it's pointed at a live environment.
 *
 * - CI: no override, ever. A non-local E2E_BASE_URL under CI always throws,
 *   regardless of allowNonLocal — mirrors purgeVercelCache()'s own
 *   process.env.CI guard (src/lib/vercel-cache.ts).
 * - Local: refuses by default too, but a human can explicitly opt in with
 *   E2E_ALLOW_NON_LOCAL=1 (playwright.config.ts wires this up) if they
 *   really mean to point the suite at a deployed environment (e.g. a
 *   preview deployment) — never silently.
 */

export interface E2ETargetGuardOptions {
  isCI: boolean;
  allowNonLocal: boolean;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function assertLocalE2ETarget(baseURL: string, opts: E2ETargetGuardOptions): void {
  let hostname: string;
  try {
    hostname = new URL(baseURL).hostname;
  } catch {
    throw new Error(`[e2e-target-guard] Invalid E2E_BASE_URL: "${baseURL}"`);
  }

  if (LOCAL_HOSTNAMES.has(hostname)) return; // local dev server — always fine

  if (opts.isCI) {
    throw new Error(
      `[e2e-target-guard] Refusing to run the e2e suite against a non-local target (${baseURL}) under CI.\n` +
        "There is no override in CI — this suite performs real writes and must always run against the local dev server.\n" +
        "If E2E_BASE_URL is set in this CI environment, that's the bug to fix, not this guard."
    );
  }

  if (!opts.allowNonLocal) {
    throw new Error(
      `[e2e-target-guard] Refusing to run the e2e suite against a non-local target (${baseURL}).\n` +
        "This suite performs real writes (vehicles, expenses, applications, cache purges, etc.) and must not run " +
        "against production — or any other non-local environment — by default.\n" +
        "Set E2E_ALLOW_NON_LOCAL=1 if you really mean to point this at a deployed environment."
    );
  }

  console.warn(
    `\n⚠️  [e2e-target-guard] E2E_ALLOW_NON_LOCAL is set — running the e2e suite against a NON-LOCAL target:\n` +
      `    ${baseURL}\n` +
      `    This suite performs real writes. Double-check this is really the environment you mean to touch.\n`
  );
}
