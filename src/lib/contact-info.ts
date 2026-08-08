export interface SocialLink {
  href: string;
  label: string;
}

/** CAD price shown on every listing page for Ontario safety certification. Single source of truth — previously baked as boilerplate text into every vehicle's `description` (see `stripDealerBoilerplate` in `src/lib/vehicle-description.ts`). */
export const SAFETY_CERTIFICATION_PRICE_CAD = 800;

/** Dealership-wide transparency statement shown once on every listing page, not per-vehicle. */
export const ALFURSAN_PROMISE =
  "At Alfursan Auto, we are honest and transparent. Every vehicle undergoes a mechanical inspection covering the engine, transmission, and major systems, so you can buy with confidence. These are pre-owned vehicles — light wear consistent with age and mileage is normal — but any issues we identify are always communicated upfront.";

export const CONTACT_INFO = {
  intro:
    "Alfursan Auto is a trusted used car dealership based in the Greater Toronto Area, specializing in retail sales, wholesale deals, and international vehicle exports.",
  address: "5866 Mayfield Rd, Caledon, ON L7C 0Z6",
  mapUrl: "https://maps.google.com/?q=5866+Mayfield+Rd%2C+Caledon%2C+ON+L7C+0Z6",
  phone: "+1 (416) 838-4007",
  phoneHref: "+14168384007",
  email: "sales@alfursanauto.ca",
  socialLinks: [
    {
      href: "https://www.facebook.com/people/Alfursan-Auto-Exports/61576687765706/",
      label: "Facebook",
    },
    {
      href: "https://www.instagram.com/alfursanauto/",
      label: "Instagram",
    },
  ] satisfies SocialLink[],
} as const;
