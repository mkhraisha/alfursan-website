export interface CarSummary {
  id: number;
  slug: string;
  title: string;
  htmlDescription: string;
  excerpt: string;
  year?: string;
  mileageKm?: string;
  mileageValue?: number;
  price?: number;
  image?: string;
  images: string[];
  condition?: string;
  vehicleType?: string;
  offerType?: string;
  make?: string;
  model?: string;
  driveType?: string;
  transmission?: string;
  fuelType?: string;
  cylinders?: string;
  color?: string;
  doors?: string;
  features: string[];
}

interface WpCar {
  id: number;
  slug: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  vehica_6656?: Record<string, number>;
  vehica_14696?: string;
  vehica_6664?: string;
  vehica_6673?: string[];
  vehica_6654?: number[];
  vehica_6655?: number[];
  vehica_6657?: number[];
  vehica_6659?: number[];
  vehica_6660?: number[];
  vehica_6661?: number[];
  vehica_6662?: number[];
  vehica_6663?: number[];
  vehica_12974?: number[];
  vehica_6666?: number[];
  vehica_12770?: number[];
  vehica_6670?: number[];
}

interface TaxonomyTerm {
  id: number;
  name: string;
}

interface WpPage {
  id: number;
  slug: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
}

export interface PageContent {
  id: number;
  slug: string;
  title: string;
  htmlContent: string;
  excerpt: string;
}

type VehicaTermKey =
  | "condition"
  | "vehicleType"
  | "offerType"
  | "make"
  | "model"
  | "driveType"
  | "transmission"
  | "fuelType"
  | "cylinders"
  | "color"
  | "doors"
  | "features";

type VehicaTermMaps = Record<VehicaTermKey, Map<number, string>>;

const VEHICA_TAXONOMIES: Record<VehicaTermKey, string> = {
  condition: "vehica_6654",
  vehicleType: "vehica_6655",
  offerType: "vehica_6657",
  make: "vehica_6659",
  model: "vehica_6660",
  driveType: "vehica_6661",
  transmission: "vehica_6662",
  fuelType: "vehica_6663",
  cylinders: "vehica_12974",
  color: "vehica_6666",
  doors: "vehica_12770",
  features: "vehica_6670",
};

const DEFAULT_WP_API_BASE = "https://alfursanauto.ca/wp-json";

const decodeEntities = (input: string): string => {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};

const stripHtml = (input: string): string =>
  input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toPrice = (
  priceObject: Record<string, number> | undefined,
): number | undefined => {
  if (!priceObject) {
    return undefined;
  }

  const firstPrice = Object.values(priceObject)[0];
  return typeof firstPrice === "number" ? firstPrice : undefined;
};

const toNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
};

const getTermName = (
  termMap: Map<number, string>,
  termIds: number[] | undefined,
): string | undefined => {
  if (!termIds?.length) {
    return undefined;
  }

  return termMap.get(termIds[0]);
};

const getTermNames = (
  termMap: Map<number, string>,
  termIds: number[] | undefined,
): string[] => {
  if (!termIds?.length) {
    return [];
  }

  return termIds
    .map((termId) => termMap.get(termId))
    .filter((name): name is string => Boolean(name));
};

const mapCar = (car: WpCar, termMaps: VehicaTermMaps): CarSummary => {
  const htmlDescription = car.content?.rendered ?? "";
  const plain = stripHtml(htmlDescription);

  return {
    id: car.id,
    slug: car.slug,
    title: decodeEntities(car.title?.rendered ?? "Untitled car"),
    htmlDescription,
    excerpt: plain.slice(0, 220),
    year: car.vehica_14696,
    mileageKm: car.vehica_6664,
    mileageValue: toNumber(car.vehica_6664),
    price: toPrice(car.vehica_6656),
    image: car.vehica_6673?.[0],
    images: car.vehica_6673 ?? [],
    condition: getTermName(termMaps.condition, car.vehica_6654),
    vehicleType: getTermName(termMaps.vehicleType, car.vehica_6655),
    offerType: getTermName(termMaps.offerType, car.vehica_6657),
    make: getTermName(termMaps.make, car.vehica_6659),
    model: getTermName(termMaps.model, car.vehica_6660),
    driveType: getTermName(termMaps.driveType, car.vehica_6661),
    transmission: getTermName(termMaps.transmission, car.vehica_6662),
    fuelType: getTermName(termMaps.fuelType, car.vehica_6663),
    cylinders: getTermName(termMaps.cylinders, car.vehica_12974),
    color: getTermName(termMaps.color, car.vehica_6666),
    doors: getTermName(termMaps.doors, car.vehica_12770),
    features: getTermNames(termMaps.features, car.vehica_6670),
  };
};

const getApiBase = (): string => {
  return (import.meta.env.PUBLIC_WP_API_BASE ?? DEFAULT_WP_API_BASE).replace(
    /\/$/,
    "",
  );
};

export const formatPrice = (price: number | undefined): string => {
  if (typeof price !== "number") {
    return "Call for price";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);
};

const getTermMap = async (taxonomy: string): Promise<Map<number, string>> => {
  const endpoint = `${getApiBase()}/wp/v2/${taxonomy}?per_page=100&_fields=id,name`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${taxonomy} terms: ${response.status}`);
  }

  const terms = (await response.json()) as TaxonomyTerm[];
  return new Map(terms.map((term) => [term.id, decodeEntities(term.name)]));
};

const getVehicaTermMaps = async (): Promise<VehicaTermMaps> => {
  const entries = Object.entries(VEHICA_TAXONOMIES) as Array<
    [VehicaTermKey, string]
  >;

  const maps = await Promise.all(
    entries.map(
      async ([key, taxonomy]) => [key, await getTermMap(taxonomy)] as const,
    ),
  );

  return Object.fromEntries(maps) as VehicaTermMaps;
};

const CAR_FIELDS = [
  "id",
  "slug",
  "title",
  "content",
  "vehica_6656",
  "vehica_14696",
  "vehica_6664",
  "vehica_6673",
  "vehica_6654",
  "vehica_6655",
  "vehica_6657",
  "vehica_6659",
  "vehica_6660",
  "vehica_6661",
  "vehica_6662",
  "vehica_6663",
  "vehica_12974",
  "vehica_6666",
  "vehica_12770",
  "vehica_6670",
].join(",");

export const getCars = async (limit = 24): Promise<CarSummary[]> => {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const endpoint = `${getApiBase()}/wp/v2/cars?per_page=${safeLimit}&_fields=${CAR_FIELDS}`;

  const [termMaps, response] = await Promise.all([
    getVehicaTermMaps(),
    fetch(endpoint),
  ]);

  if (!response.ok) {
    throw new Error(`Failed to fetch cars: ${response.status}`);
  }

  const payload = (await response.json()) as WpCar[];
  return payload.map((car) => mapCar(car, termMaps));
};

export const getCarBySlug = async (
  slug: string,
): Promise<CarSummary | null> => {
  const endpoint = `${getApiBase()}/wp/v2/cars?slug=${encodeURIComponent(slug)}&per_page=1&_fields=${CAR_FIELDS}`;

  const [termMaps, response] = await Promise.all([
    getVehicaTermMaps(),
    fetch(endpoint),
  ]);

  if (!response.ok) {
    throw new Error(`Failed to fetch car by slug: ${response.status}`);
  }

  const payload = (await response.json()) as WpCar[];
  if (!payload[0]) {
    return null;
  }

  return mapCar(payload[0], termMaps);
};

export const getPageBySlug = async (
  slug: string,
): Promise<PageContent | null> => {
  const endpoint = `${getApiBase()}/wp/v2/pages?slug=${encodeURIComponent(slug)}&per_page=1&_fields=id,slug,title,content,excerpt`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to fetch page by slug: ${response.status}`);
  }

  const payload = (await response.json()) as WpPage[];
  const page = payload[0];

  if (!page) {
    return null;
  }

  const htmlContent = page.content?.rendered ?? "";

  return {
    id: page.id,
    slug: page.slug,
    title: decodeEntities(page.title?.rendered ?? "Untitled page"),
    htmlContent,
    excerpt: stripHtml(page.excerpt?.rendered ?? htmlContent).slice(0, 220),
  };
};
