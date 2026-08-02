// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";
import { checkEnvIntegration } from "./src/lib/check-env.ts";

// Routes excluded from Vercel's ISR edge cache (see comment below). Exported
// so it can be tested directly instead of via the adapter's internal config.
export const ISR_EXCLUDE = [
  // API routes manage their own Cache-Control per endpoint (mutating routes
  // must never be cached). Routing them through the ISR function ignores
  // HTTP method and caches by path alone, which can serve a stale/cached
  // response to POST/PATCH/DELETE requests — exclude them entirely so they
  // run as plain serverless functions.
  /^\/api\//,
  // Admin routes set Cache-Control: no-store themselves (see
  // addSecurityHeaders in src/middleware.ts), but that header only governs
  // downstream/browser caching — it does not stop Vercel's ISR function from
  // caching the response at the edge per `expiration` below. Without this
  // exclusion, a cached admin response (including rotated Set-Cookie session
  // tokens written after a token refresh) gets replayed to later requests,
  // which then fails re-validation and causes a sign-out-and-reload loop.
  // Exclude admin routes entirely.
  /^\/admin(\/|$)/,
];
// Vercel sets VERCEL_ENV to "production" | "preview" | "development" at build time.
// Only create Sentry releases/deploys on production builds — creating one on every
// PR preview build is just noise in Sentry.
const isProductionBuild = process.env.VERCEL_ENV === "production";

// https://astro.build/config
export default defineConfig({
  output: "static",
  adapter: vercel({
    isr: {
      expiration: 60 * 60 * 3, // 3-hour stale-while-revalidate edge cache
      exclude: ISR_EXCLUDE,
    },
  }),
  site: "https://alfursan-website.vercel.app",
  trailingSlash: "ignore",
  redirects: {
    // Legacy utility/page aliases
    "/meet-the-team/": "/our-team/",
    "/compare/": "/search/",
    "/map-search/": "/search/",

    // Legacy blog post slugs (root-level on WP) -> canonical Astro blog route
    "/14-surprisingly-affordable-luxury-cars/":
      "/blog/14-surprisingly-affordable-luxury-cars/",
    "/how-close-are-we-to-autonomous-cars/":
      "/blog/how-close-are-we-to-autonomous-cars/",

    // Legacy taxonomy aliases -> canonical blog listing
    "/category/auto-detailing/": "/blog/",
    "/category/car-news/": "/blog/",
    "/category/car-reviews/": "/blog/",
    "/tag/premium/": "/blog/",
    "/tag/sedan/": "/blog/",
    "/tag/sport/": "/blog/",
    "/tag/speed/": "/blog/",
    "/tag/suv/": "/blog/",
    "/tag/supercars/": "/blog/",

    // Legacy search path URLs -> canonical query URLs
    "/search/audi/": "/search/?make=audi",
    "/search/honda/": "/search/?make=honda",
    "/search/hyundai/": "/search/?make=hyundai",
    "/search/mazda/": "/search/?make=mazda",
    "/search/tesla/": "/search/?make=tesla",
    "/search/toyota/": "/search/?make=toyota",
    "/search/audi/q5-premium-plus/": "/search/?make=audi&model=q5-premium-plus",
    "/search/honda/civic-ex/": "/search/?make=honda&model=civic-ex",
    "/search/honda/civic-lx/": "/search/?make=honda&model=civic-lx",
    "/search/honda/civic-touring/": "/search/?make=honda&model=civic-touring",
    "/search/honda/cr-v-exl/": "/search/?make=honda&model=cr-v-exl",
    "/search/honda/hr-v-ex/": "/search/?make=honda&model=hr-v-ex",
    "/search/honda/odyssey-ex/": "/search/?make=honda&model=odyssey-ex",
    "/search/honda/odyssey-exl/": "/search/?make=honda&model=odyssey-exl",
    "/search/hyundai/accent-se/": "/search/?make=hyundai&model=accent-se",
    "/search/hyundai/elantra-hybrid-ultimate/":
      "/search/?make=hyundai&model=elantra-hybrid-ultimate",
    "/search/hyundai/elantra-limited/":
      "/search/?make=hyundai&model=elantra-limited",
    "/search/hyundai/tucson-limited/":
      "/search/?make=hyundai&model=tucson-limited",
    "/search/mazda/cx-5-gx/": "/search/?make=mazda&model=cx-5-gx",
    "/search/mazda/cx-9-touring/": "/search/?make=mazda&model=cx-9-touring",
    "/search/tesla/model-3/": "/search/?make=tesla&model=model-3",
    "/search/toyota/corolla-l/": "/search/?make=toyota&model=corolla-l",
    "/search/toyota/highlander-limited/":
      "/search/?make=toyota&model=highlander-limited",
    "/search/toyota/rav-4-le/": "/search/?make=toyota&model=rav-4-le",
    "/search/toyota/rav-4-xle/": "/search/?make=toyota&model=rav-4-xle",
  },
  integrations: [
    react(),
    sitemap(),
    checkEnvIntegration(),
    sentry({
      dsn: process.env.SENTRY_DSN,
      sourceMapsUploadOptions: {
        project: "alfursan-website",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        unstable_sentryVitePluginOptions: {
          release: {
            create: isProductionBuild,
            finalize: isProductionBuild,
            deploy: isProductionBuild ? { env: "production" } : false,
          },
        },
      },
      // Don't crash the build if Sentry env vars are missing locally
      enabled: !!process.env.SENTRY_DSN,
    }),
  ],
  vite: {
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
  },
});
