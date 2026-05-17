import { vi, describe, it, expect, afterEach } from "vitest";
import { getCars, getCarBySlug, formatPrice } from "../lib/wordpress";

// ── Mock helpers ──────────────────────────────────────────────────────────────

function mockOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function mockError(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response;
}

/**
 * Stubs global fetch.
 * - URLs containing /wp/v2/cars → return `cars` (or an error response if `carStatus` != 200)
 * - Taxonomy URLs (/wp/v2/vehica_*) → return entries from `termData` if present, else []
 */
function stubFetch(
  cars: unknown[],
  {
    carStatus = 200,
    termData = {} as Record<string, Array<{ id: number; name: string }>>,
  } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/wp/v2/cars")) {
        return Promise.resolve(
          carStatus === 200 ? mockOk(cars) : mockError(carStatus),
        );
      }
      for (const [taxonomy, terms] of Object.entries(termData)) {
        if (url.includes(`/wp/v2/${taxonomy}`)) {
          return Promise.resolve(mockOk(terms));
        }
      }
      return Promise.resolve(mockOk([])); // unknown taxonomy → empty map
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RAW_CAR = {
  id: 42,
  slug: "2022-toyota-rav4",
  date: "2024-01-15T10:00:00",
  title: { rendered: "2022 Toyota RAV4 &#8211; AWD" },
  content: { rendered: "<p>A great SUV for families.</p>" },
  vehica_6656: { price: 35000 },
  vehica_14696: "2022",
  vehica_6664: "45,000",
  vehica_6673: [
    "https://alfursanauto.ca/wp-content/uploads/img1.jpg",
    "https://media.alfursanauto.ca/wp-content/uploads/img2.jpg",
  ],
  vehica_6654: [1],   // condition
  vehica_6655: [2],   // vehicleType
  vehica_6657: [3],   // offerType
  vehica_6659: [4],   // make
  vehica_6660: [5],   // model
  vehica_6661: [6],   // driveType
  vehica_6662: [7],   // transmission
  vehica_6663: [8],   // fuelType
  vehica_12974: [9],  // cylinders
  vehica_6666: [10],  // color
  vehica_12770: [11], // doors
  vehica_6670: [12, 13], // features — two IDs
};

const TERM_DATA: Record<string, Array<{ id: number; name: string }>> = {
  vehica_6654: [{ id: 1, name: "Used" }],
  vehica_6655: [{ id: 2, name: "SUV" }],
  vehica_6657: [{ id: 3, name: "Available" }],
  vehica_6659: [{ id: 4, name: "Toyota" }],
  vehica_6660: [{ id: 5, name: "RAV4" }],
  vehica_6661: [{ id: 6, name: "AWD" }],
  vehica_6662: [{ id: 7, name: "Automatic" }],
  vehica_6663: [{ id: 8, name: "Gasoline" }],
  vehica_12974: [{ id: 9, name: "4" }],
  vehica_6666: [{ id: 10, name: "White" }],
  vehica_12770: [{ id: 11, name: "4" }],
  vehica_6670: [{ id: 12, name: "Bluetooth" }, { id: 13, name: "Backup Camera" }],
};

// ── formatPrice ───────────────────────────────────────────────────────────────

describe("formatPrice", () => {
  it('returns "Call for price" when price is undefined', () => {
    expect(formatPrice(undefined)).toBe("Call for price");
  });

  it("formats a whole-dollar price in CAD", () => {
    expect(formatPrice(35000)).toBe("$35,000");
  });

  it("formats zero as $0", () => {
    expect(formatPrice(0)).toBe("$0");
  });

  it("omits cents (maximumFractionDigits = 0)", () => {
    expect(formatPrice(19999.99)).toBe("$20,000");
  });
});

// ── getCars ───────────────────────────────────────────────────────────────────

describe("getCars", () => {
  it("returns a mapped CarSummary for each item in the response", async () => {
    stubFetch([RAW_CAR]);
    const cars = await getCars();
    expect(cars).toHaveLength(1);
    expect(cars[0].id).toBe(42);
    expect(cars[0].slug).toBe("2022-toyota-rav4");
  });

  it("decodes HTML entities in the title", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    // &#8211; is an en-dash
    expect(car.title).toBe("2022 Toyota RAV4 – AWD");
  });

  it("extracts price from vehica_6656 price object", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.price).toBe(35000);
  });

  it("extracts year from vehica_14696", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.year).toBe("2022");
  });

  it("sets mileageKm and parses mileageValue from vehica_6664", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.mileageKm).toBe("45,000");
    expect(car.mileageValue).toBe(45000);
  });

  it("rewrites alfursanauto.ca image URLs to media subdomain", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.image).toBe("https://media.alfursanauto.ca/wp-content/uploads/img1.jpg");
    expect(car.images[0]).toBe("https://media.alfursanauto.ca/wp-content/uploads/img1.jpg");
  });

  it("leaves already-correct media subdomain URLs unchanged", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.images[1]).toBe("https://media.alfursanauto.ca/wp-content/uploads/img2.jpg");
  });

  it("resolves term IDs to names via taxonomy maps", async () => {
    stubFetch([RAW_CAR], { termData: TERM_DATA });
    const [car] = await getCars();
    expect(car.make).toBe("Toyota");
    expect(car.model).toBe("RAV4");
    expect(car.condition).toBe("Used");
    expect(car.vehicleType).toBe("SUV");
    expect(car.offerType).toBe("Available");
    expect(car.transmission).toBe("Automatic");
    expect(car.driveType).toBe("AWD");
    expect(car.fuelType).toBe("Gasoline");
    expect(car.color).toBe("White");
  });

  it("resolves multiple feature IDs to an array of names", async () => {
    stubFetch([RAW_CAR], { termData: TERM_DATA });
    const [car] = await getCars();
    expect(car.features).toEqual(["Bluetooth", "Backup Camera"]);
  });

  it("returns undefined for taxonomy fields when term maps are empty", async () => {
    stubFetch([RAW_CAR]); // no termData → all maps empty
    const [car] = await getCars();
    expect(car.make).toBeUndefined();
    expect(car.offerType).toBeUndefined();
    expect(car.features).toEqual([]);
  });

  it("strips HTML tags from content to build the excerpt", async () => {
    stubFetch([RAW_CAR]);
    const [car] = await getCars();
    expect(car.excerpt).toBe("A great SUV for families.");
    expect(car.excerpt).not.toContain("<p>");
  });

  it("truncates excerpt at 220 characters", async () => {
    const longContent = "A".repeat(300);
    stubFetch([{ ...RAW_CAR, content: { rendered: longContent } }]);
    const [car] = await getCars();
    expect(car.excerpt.length).toBeLessThanOrEqual(220);
  });

  it("returns empty array when the API returns a 4xx error", async () => {
    // fetchWithRetry returns the response for 4xx (no retry) — getCars checks !response.ok
    stubFetch([], { carStatus: 404 });
    const cars = await getCars();
    expect(cars).toEqual([]);
  });

  it("returns empty array when the API returns an empty list", async () => {
    stubFetch([]);
    const cars = await getCars();
    expect(cars).toEqual([]);
  });

  it("clamps limit to a maximum of 100", async () => {
    stubFetch([]);
    await getCars(999);
    const fetchMock = vi.mocked(globalThis.fetch);
    const carCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes("/wp/v2/cars"),
    );
    expect(carCall?.[0] as string).toContain("per_page=100");
  });

  it("clamps limit to a minimum of 1", async () => {
    stubFetch([]);
    await getCars(-5);
    const fetchMock = vi.mocked(globalThis.fetch);
    const carCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes("/wp/v2/cars"),
    );
    expect(carCall?.[0] as string).toContain("per_page=1");
  });

  it("returns undefined image and empty images array when vehica_6673 is absent", async () => {
    const { vehica_6673: _, ...noImages } = RAW_CAR;
    stubFetch([noImages]);
    const [car] = await getCars();
    expect(car.image).toBeUndefined();
    expect(car.images).toEqual([]);
  });

  it("uses 'Untitled car' when title is missing", async () => {
    const { title: _, ...noTitle } = RAW_CAR;
    stubFetch([noTitle]);
    const [car] = await getCars();
    expect(car.title).toBe("Untitled car");
  });
});

// ── getCarBySlug ──────────────────────────────────────────────────────────────

describe("getCarBySlug", () => {
  it("returns a mapped CarSummary when the slug is found", async () => {
    stubFetch([RAW_CAR]);
    const car = await getCarBySlug("2022-toyota-rav4");
    expect(car).not.toBeNull();
    expect(car!.id).toBe(42);
    expect(car!.slug).toBe("2022-toyota-rav4");
  });

  it("returns null when the API returns an empty array (slug not found)", async () => {
    stubFetch([]);
    const car = await getCarBySlug("nonexistent-slug");
    expect(car).toBeNull();
  });

  it("returns null when the API returns a non-OK response", async () => {
    stubFetch([], { carStatus: 404 });
    const car = await getCarBySlug("anything");
    expect(car).toBeNull();
  });

  it("encodes the slug in the request URL", async () => {
    stubFetch([RAW_CAR]);
    await getCarBySlug("slug with spaces");
    const fetchMock = vi.mocked(globalThis.fetch);
    const carCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes("/wp/v2/cars"),
    );
    expect(carCall?.[0] as string).toContain("slug%20with%20spaces");
  });

  it("resolves term IDs to names via taxonomy maps", async () => {
    stubFetch([RAW_CAR], { termData: TERM_DATA });
    const car = await getCarBySlug("2022-toyota-rav4");
    expect(car!.make).toBe("Toyota");
    expect(car!.offerType).toBe("Available");
    expect(car!.features).toEqual(["Bluetooth", "Backup Camera"]);
  });

  it("rewrites image URLs to media subdomain", async () => {
    stubFetch([RAW_CAR]);
    const car = await getCarBySlug("2022-toyota-rav4");
    expect(car!.image).toBe("https://media.alfursanauto.ca/wp-content/uploads/img1.jpg");
  });
});
