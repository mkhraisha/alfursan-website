export interface CarSummary {
  id: number;
  slug: string;
  title: string;
  htmlDescription: string;
  excerpt: string;
  date?: string;
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
  date?: string;
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

interface WpPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  featured_media: number;
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          medium_large?: { source_url?: string };
          full?: { source_url?: string };
        };
      };
    }>;
  };
}

interface WpPage {
  id: number;
  slug: string;
  date?: string;
  modified?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  htmlContent: string;
  excerpt: string;
  date: string;
  modified: string;
  featuredImage?: string;
}

export interface CmsPageContent {
  id: number;
  slug: string;
  title: string;
  htmlContent: string;
  excerpt: string;
  date?: string;
  modified?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqPageContent {
  page: CmsPageContent | null;
  items: FaqItem[];
}

export interface TeamPageContent {
  page: CmsPageContent | null;
  sourceSlug: string | null;
}

export interface ContactModel {
  page: CmsPageContent | null;
  address?: string;
  phone?: string;
  email?: string;
  mapUrl?: string;
  socialLinks: string[];
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
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with automatic retry on transient failures (network errors, 5xx).
 * Returns null instead of throwing for non-retryable errors (4xx).
 */
const fetchWithRetry = async (
  url: string,
  label: string,
): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;

      // 4xx = client error, don't retry
      if (response.status >= 400 && response.status < 500) {
        console.error(
          `[wordpress] ${label}: HTTP ${response.status} (not retrying)`,
        );
        return response;
      }

      // 5xx = server error, retry
      lastError = new Error(`HTTP ${response.status}`);
      console.warn(
        `[wordpress] ${label}: HTTP ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      );
    } catch (err) {
      // Network / DNS error — retry
      lastError = err;
      console.warn(
        `[wordpress] ${label}: network error (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      );
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  throw new Error(
    `[wordpress] ${label}: all ${MAX_RETRIES + 1} attempts failed — ${lastError}`,
  );
};

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
    date: car.date,
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
  const response = await fetchWithRetry(endpoint, `terms:${taxonomy}`);

  if (!response.ok) return new Map();

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
  "date",
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
    fetchWithRetry(endpoint, "getCars"),
  ]);

  if (!response.ok) {
    console.error(
      `[wordpress] getCars: returning empty list (HTTP ${response.status})`,
    );
    return [];
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
    fetchWithRetry(endpoint, `getCarBySlug:${slug}`),
  ]);

  if (!response.ok) return null;

  const payload = (await response.json()) as WpCar[];
  if (!payload[0]) {
    return null;
  }

  return mapCar(payload[0], termMaps);
};

const mapPost = (post: WpPost): BlogPost => {
  const htmlContent = post.content?.rendered ?? "";
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const featuredImage =
    media?.source_url ?? media?.media_details?.sizes?.full?.source_url;

  return {
    id: post.id,
    slug: post.slug,
    title: decodeEntities(post.title?.rendered ?? "Untitled post"),
    htmlContent,
    excerpt: stripHtml(post.excerpt?.rendered ?? htmlContent).slice(0, 220),
    date: post.date,
    modified: post.modified,
    featuredImage,
  };
};

const mapPage = (page: WpPage): CmsPageContent => {
  const htmlContent = page.content?.rendered ?? "";
  return {
    id: page.id,
    slug: page.slug,
    title: decodeEntities(page.title?.rendered ?? "Untitled page"),
    htmlContent,
    excerpt: stripHtml(page.excerpt?.rendered ?? htmlContent).slice(0, 280),
    date: page.date,
    modified: page.modified,
  };
};

const PAGE_FIELDS = [
  "id",
  "slug",
  "date",
  "modified",
  "title",
  "content",
  "excerpt",
].join(",");

const getPageBySlug = async (slug: string): Promise<CmsPageContent | null> => {
  const endpoint = `${getApiBase()}/wp/v2/pages?slug=${encodeURIComponent(slug)}&per_page=1&_fields=${PAGE_FIELDS}`;
  const response = await fetchWithRetry(endpoint, `getPageBySlug:${slug}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as WpPage[];
  const page = payload[0];
  return page ? mapPage(page) : null;
};

const cleanText = (value: string): string =>
  decodeEntities(stripHtml(value)).replace(/\s+/g, " ").trim();

const extractFaqItems = (html: string): FaqItem[] => {
  const detailMatches = [
    ...html.matchAll(
      /<summary[^>]*>([\s\S]*?)<\/summary>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ];
  if (detailMatches.length > 0) {
    return detailMatches
      .map((match) => ({
        question: cleanText(match[1] ?? ""),
        answer: cleanText(match[2] ?? ""),
      }))
      .filter((item) => item.question && item.answer);
  }

  const headingMatches = [
    ...html.matchAll(
      /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ];
  return headingMatches
    .map((match) => ({
      question: cleanText(match[1] ?? ""),
      answer: cleanText(match[2] ?? ""),
    }))
    .filter((item) => item.question && item.answer);
};

const extractFirstMatch = (
  input: string,
  pattern: RegExp,
): string | undefined => {
  const match = input.match(pattern);
  return match?.[1]?.trim();
};

const extractContactModel = (page: CmsPageContent | null): ContactModel => {
  if (!page) {
    return {
      page: null,
      socialLinks: [],
    };
  }

  const html = page.htmlContent;
  const phoneHref = extractFirstMatch(html, /href=["']tel:([^"']+)["']/i);
  const emailHref = extractFirstMatch(html, /href=["']mailto:([^"']+)["']/i);
  const mapHref = extractFirstMatch(
    html,
    /href=["'](https?:\/\/maps\.google\.[^"']+)["']/i,
  );
  const addressLabel = extractFirstMatch(
    html,
    /Address<\/strong>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
  );

  const socialLinks = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((link) => /facebook|instagram|x\.com|twitter/i.test(link));

  return {
    page,
    address: addressLabel ? cleanText(addressLabel) : undefined,
    phone: phoneHref ? decodeURIComponent(phoneHref) : undefined,
    email: emailHref ? decodeURIComponent(emailHref) : undefined,
    mapUrl: mapHref,
    socialLinks,
  };
};

export const getAboutPageContent = async (): Promise<CmsPageContent | null> => {
  return getPageBySlug("about-us");
};

export const getFaqPageContent = async (): Promise<FaqPageContent> => {
  const page = await getPageBySlug("faq");
  return {
    page,
    items: page ? extractFaqItems(page.htmlContent) : [],
  };
};

export const getTeamPageContent = async (): Promise<TeamPageContent> => {
  const primary = await getPageBySlug("our-team");
  if (primary) {
    return { page: primary, sourceSlug: "our-team" };
  }

  const fallback = await getPageBySlug("meet-the-team");
  if (fallback) {
    return { page: fallback, sourceSlug: "meet-the-team" };
  }

  return { page: null, sourceSlug: null };
};

export const getContactPageContent = async (): Promise<ContactModel> => {
  const page = await getPageBySlug("contact-us");
  return extractContactModel(page);
};

export const getPosts = async (limit = 20): Promise<BlogPost[]> => {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const endpoint = `${getApiBase()}/wp/v2/posts?per_page=${safeLimit}&_fields=id,slug,date,modified,title,content,excerpt,featured_media,_links&_embed=wp:featuredmedia`;
  const response = await fetchWithRetry(endpoint, "getPosts");

  if (!response.ok) {
    console.error(
      `[wordpress] getPosts: returning empty list (HTTP ${response.status})`,
    );
    return [];
  }

  const payload = (await response.json()) as WpPost[];
  return payload.map(mapPost);
};

export const getPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const endpoint = `${getApiBase()}/wp/v2/posts?slug=${encodeURIComponent(slug)}&per_page=1&_fields=id,slug,date,modified,title,content,excerpt,featured_media,_links&_embed=wp:featuredmedia`;
  const response = await fetchWithRetry(endpoint, `getPostBySlug:${slug}`);

  if (!response.ok) return null;

  const payload = (await response.json()) as WpPost[];
  const post = payload[0];
  return post ? mapPost(post) : null;
};
