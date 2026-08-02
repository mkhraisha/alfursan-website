import { describe, it, expect } from "vitest";
import { CONTACT_INFO } from "../lib/contact-info";

describe("CONTACT_INFO", () => {
  it("has the published dealership address", () => {
    expect(CONTACT_INFO.address).toBe("5866 Mayfield Rd, Caledon, ON L7C 0Z6");
  });

  it("has a map URL matching the address", () => {
    expect(CONTACT_INFO.mapUrl).toBe(
      "https://maps.google.com/?q=5866+Mayfield+Rd%2C+Caledon%2C+ON+L7C+0Z6",
    );
  });

  it("has a human-readable phone and a digits-only tel: href", () => {
    expect(CONTACT_INFO.phone).toBe("+1 (416) 838-4007");
    expect(CONTACT_INFO.phoneHref).toBe("+14168384007");
  });

  it("has the published sales email", () => {
    expect(CONTACT_INFO.email).toBe("sales@alfursanauto.ca");
  });

  it("has Facebook and Instagram social links", () => {
    const labels = CONTACT_INFO.socialLinks.map((link) => link.label);
    expect(labels).toEqual(["Facebook", "Instagram"]);
    for (const link of CONTACT_INFO.socialLinks) {
      expect(link.href.startsWith("https://")).toBe(true);
    }
  });
});
