import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────
const generateContentMock = vi.fn();
vi.mock("@google/genai", () => ({
  // Arrow-function mock implementations aren't valid `new` targets — use a
  // plain function expression so `new GoogleGenAI(...)` works under vitest.
  GoogleGenAI: vi.fn().mockImplementation(function (this: { models: unknown }) {
    this.models = { generateContent: generateContentMock };
  }),
}));

import { GoogleGenAI } from "@google/genai";
import {
  buildVehicleFactSheet,
  generateVehicleDescription,
  normalizeDescriptionForDedup,
  findDuplicateDescriptionGroups,
  containsMandatoryDisclosure,
  stripDealerBoilerplate,
  DESCRIPTION_SYSTEM_PROMPT,
  DEFAULT_GEMINI_MODEL,
  type VehicleDescriptionInput,
} from "../lib/vehicle-description";

const BASE_VEHICLE: VehicleDescriptionInput = {
  make: "Honda",
  model: "Civic",
  year: 2020,
};

// ── buildVehicleFactSheet ───────────────────────────────────────────────────────

describe("buildVehicleFactSheet", () => {
  it("omits null/undefined/empty fields", () => {
    const sheet = buildVehicleFactSheet(BASE_VEHICLE);
    expect(sheet).toBe("- Year: 2020\n- Make: Honda\n- Model: Civic");
  });

  it("includes populated fields, formatting odometer with a thousands separator and unit", () => {
    const sheet = buildVehicleFactSheet({
      ...BASE_VEHICLE,
      trim: "Touring",
      colour: "Blue",
      odometer: 45000,
      drive_type: "awd",
      transmission: "automatic",
      fuel_type: "gasoline",
      cylinders: 4,
      doors: 4,
      engine_type: "2.0L 4-Cylinder",
      features: ["Backup Camera", "Heated Seats"],
    });
    expect(sheet).toContain("- Trim: Touring");
    expect(sheet).toContain("- Colour: Blue");
    expect(sheet).toContain("45,000 km");
    expect(sheet).toContain("- Drive type: awd");
    expect(sheet).toContain("- Features: Backup Camera, Heated Seats");
  });

  it("produces different output for two different vehicles", () => {
    const a = buildVehicleFactSheet(BASE_VEHICLE);
    const b = buildVehicleFactSheet({ make: "Toyota", model: "Corolla", year: 2019 });
    expect(a).not.toBe(b);
  });

  it("omits an empty features array", () => {
    const sheet = buildVehicleFactSheet({ ...BASE_VEHICLE, features: [] });
    expect(sheet).not.toContain("Features");
  });
});

// ── generateVehicleDescription ──────────────────────────────────────────────────

describe("generateVehicleDescription", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    vi.mocked(GoogleGenAI).mockClear();
  });

  it("calls the Gemini SDK with the system prompt and fact sheet, returning trimmed text", async () => {
    generateContentMock.mockResolvedValue({ text: "  A tidy 2020 Honda Civic.  " });

    const result = await generateVehicleDescription(BASE_VEHICLE, { apiKey: "key-123" });

    expect(result).toBe("A tidy 2020 Honda Civic.");
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "key-123" });
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_GEMINI_MODEL,
        contents: buildVehicleFactSheet(BASE_VEHICLE),
        config: expect.objectContaining({ systemInstruction: DESCRIPTION_SYSTEM_PROMPT }),
      })
    );
  });

  it("uses an overridden model when provided", async () => {
    generateContentMock.mockResolvedValue({ text: "Text" });
    await generateVehicleDescription(BASE_VEHICLE, { apiKey: "key-123", model: "gemini-3.0-pro" });
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.0-pro" })
    );
  });

  it("throws a clear error when the response has no text (e.g. safety-filtered)", async () => {
    generateContentMock.mockResolvedValue({ text: undefined });
    await expect(generateVehicleDescription(BASE_VEHICLE, { apiKey: "key-123" })).rejects.toThrow(
      /empty description/i
    );
  });

  it("throws a clear error on a blank/whitespace-only response", async () => {
    generateContentMock.mockResolvedValue({ text: "   " });
    await expect(generateVehicleDescription(BASE_VEHICLE, { apiKey: "key-123" })).rejects.toThrow(
      /empty description/i
    );
  });
});

// ── Duplicate detection ─────────────────────────────────────────────────────────

describe("normalizeDescriptionForDedup", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeDescriptionForDedup("  Great  Car.\n\nMust see!  ")).toBe("great car. must see!");
  });
});

describe("findDuplicateDescriptionGroups", () => {
  it("groups vehicles whose description matches case/whitespace-insensitively", () => {
    const groups = findDuplicateDescriptionGroups([
      { vin: "A", description: "Great car. Must see!" },
      { vin: "B", description: "  GREAT   car.  must see!  " },
      { vin: "C", description: "A totally different description." },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].vins.sort()).toEqual(["A", "B"]);
  });

  it("ignores null/empty descriptions", () => {
    const groups = findDuplicateDescriptionGroups([
      { vin: "A", description: null },
      { vin: "B", description: "" },
      { vin: "C", description: "   " },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignores singleton (non-duplicated) descriptions", () => {
    const groups = findDuplicateDescriptionGroups([
      { vin: "A", description: "Unique text one." },
      { vin: "B", description: "Unique text two." },
    ]);
    expect(groups).toHaveLength(0);
  });
});

// ── containsMandatoryDisclosure ──────────────────────────────────────────────────

describe("containsMandatoryDisclosure", () => {
  it("detects an OMVIC mention", () => {
    expect(containsMandatoryDisclosure("Mandatory OMVIC statement: ...")).toBe(true);
  });

  it("detects a 'sold as unfit' mention without the word OMVIC", () => {
    expect(containsMandatoryDisclosure("This vehicle is being sold as unfit.")).toBe(true);
  });

  it("returns false for ordinary car-specific text", () => {
    expect(containsMandatoryDisclosure("A clean, well-maintained sedan.")).toBe(false);
  });
});

// ── stripDealerBoilerplate — against real migrated data ──────────────────────────
// These fixtures are verbatim descriptions pulled from the local Supabase `vehicles`
// table (WordPress migration output) — real variant phrasings, not hypothetical ones.

describe("stripDealerBoilerplate", () => {
  it("strips the heading-style trailing section (Visit Us / Certification / The Alfursan Promise)", () => {
    const input =
      "This 2020 Ford Escape Titanium Hybrid maximizes fuel efficiency. A clean Carfax report confirms zero reported accidents and only one previous owner. It shows 157,223 KM on the odometer. The 2.5L 4-cylinder hybrid powertrain reduces your daily fuel costs. The automatic transmission and All-Wheel Drive system maintain secure traction across diverse Ontario weather conditions. We inspected the engine, transmission, and major systems. The vehicle remains mechanically sound.\n\nCarfax:\n\nThe Titanium Advantage The Titanium package represents the top tier of Ford design. This specific model features a clean black leather interior built for daily comfort. The striking blue exterior finish sets it apart from standard crossover SUVs. You gain premium seating materials and advanced cabin technology in an exceptionally efficient platform.\n\nVisit Us at Alfursan Auto\n\nLocation: 5866 Mayfield Rd, Caledon, ON L7C 0Z6 Phone: (416) 838-4007 Appointments: Test drives available by appointment.\n\nCertification and Pricing Safety Certification is available for $800, ensuring your vehicle meets all Ontario safety standards.\n\nThe Alfursan Promise At Alfursan Auto, we are honest and transparent. We mechanically inspect all vehicles: engine, transmission, and major systems. You drive with confidence. These are pre-owned vehicles. Light wear consistent with age and mileage is normal. We clearly communicate any identified issues upfront.";

    const result = stripDealerBoilerplate(input);

    expect(result).toContain("The Titanium Advantage");
    expect(result).toContain("efficient platform.");
    expect(result).not.toContain("Visit Us at Alfursan Auto");
    expect(result).not.toContain("5866 Mayfield Rd");
    expect(result).not.toContain("The Alfursan Promise");
    expect(result).not.toContain("838-4007");
  });

  it("strips the address-led variant with a mid-text dangling Carfax label kept intact", () => {
    const input =
      "2016 Honda Civic Sedan LX\n\nClean. Reliable. Fully maintained. This Civic comes in a sleek gunmetal finish with only 137,420 km. It has a spotless service history and was clearly looked after. The mileage is low for its age, and it drives tight and smooth with no noises or surprises. The refreshed body design gives it a modern look and great road presence. Perfect daily driver.\n\nCarfax:\n\nFinancing available with flexible options.\n\nLocated at 5866 Mayfield Rd, Caledon, ON L7C 0Z6.\n\nCall or text (416) 838-4007 to book a test drive.\n\nSafety certification is available for $800.\n\nOur Promise\n\nAt Alfursan Auto, we are honest and transparent. All vehicles are mechanically inspected: engine, transmission, and major systems so you can drive with confidence. These are pre-owned vehicles, so light wear consistent with age and mileage is normal, but any issues we identify are clearly communicated upfront.";

    const result = stripDealerBoilerplate(input);

    expect(result).toBe(
      "2016 Honda Civic Sedan LX\n\nClean. Reliable. Fully maintained. This Civic comes in a sleek gunmetal finish with only 137,420 km. It has a spotless service history and was clearly looked after. The mileage is low for its age, and it drives tight and smooth with no noises or surprises. The refreshed body design gives it a modern look and great road presence. Perfect daily driver."
    );
  });

  it("strips only the promise-style body paragraph when it lacks the standard heading (emoji-prefixed heading variant)", () => {
    const input =
      "2019 Honda Civic LX – Clean Title, No Accidents & Great Service History!\n\nCarfax:\n\nLooking for reliability you can count on? This 2019 Honda Civic LX is the perfect daily driver for Canadian roads. Known for its exceptional fuel economy and durability, this sedan has been well-maintained and is ready for its next owner.\n\nThis specific unit stands out with a Clean Title and No Accidents reported . It boasts a fantastic Carfax service record , showing it has been cared for properly throughout its life. With 118,506 KM , it has plenty of life left and truly drives like new , smooth, responsive, and efficient.\n\nKey Highlights:\n\nEngine: Reliable 2.0L 4-Cylinder (Excellent on gas!)\n\nCondition: Clean Title, Accident-Free, Clean Carfax.\n\nDrive: Automatic Transmission, Front Wheel Drive.\n\nMaintenance: Meticulously serviced and mechanically sound.\n\n📍 Visit Us at Alfursan Auto\n\nLocation: 5866 Mayfield Rd, Caledon, ON L7C 0Z6 Phone: (416) 838-4007 Appointments: Test drives available by appointment.\n\nThe Alfursan Promise\n\nWe believe in honesty and transparency above all else. Every vehicle at Alfursan Auto undergoes a mechanical inspection covering the engine, transmission, and major systems so you can buy with confidence. While light wear consistent with age and mileage is normal for pre-owned vehicles, we promise to communicate any known issues upfront, no surprises, just great cars.";

    const result = stripDealerBoilerplate(input);

    expect(result).toContain("Key Highlights:");
    expect(result).toContain("Maintenance: Meticulously serviced and mechanically sound.");
    expect(result).not.toContain("Visit Us at Alfursan Auto");
    expect(result).not.toContain("The Alfursan Promise");
    expect(result).not.toContain("honesty and transparency above all else");
  });

  it("preserves a mandatory OMVIC disclosure while still stripping the generic promise paragraph next to it", () => {
    const input =
      "2014 Honda Odyssey EX – 8 Passenger Family Van\n\nA practical and spacious family van offering excellent value for its price point. With 279,000 KM, this Odyssey benefits from thorough reconditioning, and both the engine and transmission are in great shape. The higher mileage allows for a very competitive price without compromising on reliability.\n\nThe interior is very well kept and comfortable, ideal for families or anyone needing generous passenger and cargo space. Fully functional automatic sliding doors make access smooth and convenient for daily use.\n\nCarfax:\n\nThere is a minor dent on the side door, as shown in the photos. It does not affect performance or functionality.\n\nA solid option for buyers looking for an affordable, dependable 8-passenger vehicle with strong mechanical condition.\n\nOur Promise At Alfursan Auto, we are honest and transparent. All vehicles are mechanically inspected: engine, transmission, and major systems so you can drive with confidence. These are pre-owned vehicles, so light wear consistent with age and mileage is normal, but any issues we identify are clearly communicated upfront.\n\nMandatory OMVIC statement: As per OMVIC regulations, this vehicle is being sold as unfit. Safety certification is available for $800, or you’re welcome to have it completed by a mechanic of your choice.";

    const result = stripDealerBoilerplate(input);

    expect(result).toContain("Mandatory OMVIC statement");
    expect(result).toContain("sold as unfit");
    expect(result).toContain("There is a minor dent on the side door");
    expect(result).not.toContain("Our Promise At Alfursan Auto");
  });

  it("preserves an OMVIC disclosure phrased without a heading, dropping only the reworded promise paragraph beside it", () => {
    const input =
      "Toyota’s flagship SUV, equipped with leather, panoramic sunroof, premium sound, and advanced safety. This vehicle has been well maintained over its 239,749 KM and still drives with the smooth confidence Highlanders are known for. A reliable luxury SUV with room for seven.\n\nA serious SUV for someone who values comfort, space, and Toyota dependability.\n\nCarfax:\n\nAt Alfursan Auto, we believe in honesty and transparency. Every vehicle is inspected for mechanical integrity, including engine and transmission to ensure it drives smoothly and safely. Like any pre-owned vehicle, some minor cosmetic wear or small imperfections may be present. These do not affect safety or performance and reflect the balance we keep between quality and fair pricing. If we identify any issues, we clearly communicate them so you can make your decision with confidence. Our goal is to provide reliable vehicles you can trust for the long run.\n\nMandatory OMVIC statement:\n\nAs per OMVIC regulations, this vehicle is being sold as unfit. Certification is available for a fee, or you’re welcome to have it completed by a mechanic of your choice.";

    const result = stripDealerBoilerplate(input);

    expect(result).toContain("Mandatory OMVIC statement");
    expect(result).toContain("Certification is available for a fee");
    expect(result).toContain("A serious SUV for someone who values comfort");
    expect(result).not.toContain("we believe in honesty and transparency");
  });

  it("leaves a description with a non-standard certification price untouched", () => {
    const input =
      "$150 Admin fees\n\nSafety Certification available for $1300 (Includes a set of new tires)\n\nClean Carfax | Excellent Service";
    expect(stripDealerBoilerplate(input)).toBe(input);
  });

  it("leaves vehicle-specific financing/pricing disclosures untouched", () => {
    const input =
      "Clean title almost new 2026 Toyota Corolla LE\n\nNO COLLISION CLAIMS | ACCIDENT FREE CAR | ONLY HAIL DAMAGE\n\n***Light hail dents on some panels***\n\nPrice + HST and licensing\n\nFinance available\n\n** Advertised price is finance price. Cash transactions are subject to a $800 fee";
    expect(stripDealerBoilerplate(input)).toBe(input);
  });

  it("returns unchanged text with no boilerplate at all", () => {
    expect(stripDealerBoilerplate("A short, unique description with no trailer.")).toBe(
      "A short, unique description with no trailer."
    );
  });
});
