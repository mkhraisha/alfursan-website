import { test, expect } from "playwright/test";

/**
 * Financing application submission — the actual conversion action behind
 * every "Apply for Financing" CTA on the site. Unit tests already cover
 * /api/finance with a mocked Supabase/Resend, but nothing has exercised the
 * real running server: real DB insert, real (if misconfigured) email send
 * path, real CSRF/rate-limit middleware.
 *
 * Origin header matches BASE_URL — see the same note in
 * e2e/vehicles-api.spec.ts: this endpoint's isAllowedOrigin() check requires
 * either a matching Origin or a localhost Referer/Origin, which Playwright's
 * request fixture doesn't send automatically.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

function validApplication(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "E2E Test Applicant",
    dob: "1990-05-15",
    address: "123 Main St",
    postalCode: "M1A 1A1",
    addressSinceYear: "2020",
    addressSinceMonth: "3",
    phone: "4165551234",
    email: "e2e-finance-test@example.test",
    maritalStatus: "single",
    employmentStatus: "full-time",
    employer: "Acme Corp",
    employerAddress: "200 Bay St",
    employerPhone: "4165550001",
    jobTitle: "Engineer",
    annualIncome: "75000",
    employerSinceYear: "2020",
    employerSinceMonth: "3",
    vin: "1HGCM82633A004352",
    licenseFrontPath: "placeholder/front.jpg",
    licenseBackPath: "placeholder/back.jpg",
    consentAccurate: true,
    consentPrivacy: true,
    licenseConsent: true,
    ...overrides,
  };
}

test.describe("POST /api/finance", () => {
  test("accepts a valid application and returns an application ID", async ({ request }) => {
    const res = await request.post("/api/finance", {
      headers: { Origin: BASE_URL },
      data: validApplication(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.applicationId).toBe("string");
  });

  test("rejects an invalid application with field-level errors", async ({ request }) => {
    const res = await request.post("/api/finance", {
      headers: { Origin: BASE_URL },
      data: validApplication({ email: "not-an-email", fullName: "" }),
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors).toHaveProperty("email");
    expect(body.errors).toHaveProperty("fullName");
  });

  test("rejects a cross-site submission (no matching Origin)", async ({ request }) => {
    const res = await request.post("/api/finance", {
      headers: { Origin: "https://not-alfursanauto.example.com" },
      data: validApplication(),
    });
    expect(res.status()).toBe(403);
  });
});
