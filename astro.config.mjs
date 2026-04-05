// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://mkhraisha.github.io",
  base: "/alfursan-website",
  trailingSlash: "always",
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
  integrations: [react(), sitemap()],
});
