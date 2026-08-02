export interface SocialLink {
  href: string;
  label: string;
}

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
