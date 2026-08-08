import { useEffect, useMemo, useRef, useState } from "react";
import type { DisplayVehicle } from "../lib/public-vehicle-view";
import { formatVehiclePrice, PUBLIC_BODY_TYPES } from "../lib/public-vehicle-view";
import PublicSearchBar from "./PublicSearchBar";

type Props = {
  cars: DisplayVehicle[];
};

type Filters = {
  /** Unified free-text query — matched against VIN, make, and model. */
  query: string;
  minPrice: string;
  maxPrice: string;
  maxMileage: string;
  bodyType: string;
  driveType: string;
  fuelType: string;
  transmission: string;
  colour: string;
  sort: string;
  page: number;
};

const EMPTY_FILTERS: Filters = {
  query: "",
  minPrice: "",
  maxPrice: "",
  maxMileage: "",
  bodyType: "",
  driveType: "",
  fuelType: "",
  transmission: "",
  colour: "",
  sort: "newest",
  page: 1,
};

/** Advanced filter keys tucked behind the "Filters" popover — used to compute the active-count badge. */
const ADVANCED_FILTER_KEYS: Array<keyof Filters> = [
  "minPrice",
  "maxPrice",
  "maxMileage",
  "bodyType",
  "driveType",
  "fuelType",
  "transmission",
  "colour",
];

const PAGE_SIZE = 12;

export function sortCars(cars: DisplayVehicle[], sortKey: string): DisplayVehicle[] {
  const sorted = [...cars];

  switch (sortKey) {
    case "price-asc":
      sorted.sort(
        (a, b) =>
          (a.price ?? Number.POSITIVE_INFINITY) -
          (b.price ?? Number.POSITIVE_INFINITY),
      );
      break;
    case "price-desc":
      sorted.sort(
        (a, b) =>
          (b.price ?? Number.NEGATIVE_INFINITY) -
          (a.price ?? Number.NEGATIVE_INFINITY),
      );
      break;
    case "mileage-asc":
      sorted.sort(
        (a, b) =>
          (a.odometer ?? Number.POSITIVE_INFINITY) -
          (b.odometer ?? Number.POSITIVE_INFINITY),
      );
      break;
    case "mileage-desc":
      sorted.sort(
        (a, b) =>
          (b.odometer ?? Number.NEGATIVE_INFINITY) -
          (a.odometer ?? Number.NEGATIVE_INFINITY),
      );
      break;
    case "newest":
    default:
      // Array.prototype.sort is a stable sort (ECMA-262 since ES2019), so
      // equal timestamps keep their original (already newest-first, per the
      // DB query's own ORDER BY) relative order without an explicit tiebreak.
      sorted.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      break;
  }

  return sorted;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Date Listed: Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "mileage-asc", label: "Mileage: Low to High" },
  { value: "mileage-desc", label: "Mileage: High to Low" },
];

export function matchesFilters(
  car: DisplayVehicle,
  activeFilters: Filters,
): boolean {
  const maxPrice = parsePositiveInt(activeFilters.maxPrice);
  const minPrice = parsePositiveInt(activeFilters.minPrice);
  const maxMileage = parsePositiveInt(activeFilters.maxMileage);

  if (activeFilters.query) {
    const q = activeFilters.query.trim().toLowerCase();
    const haystack = `${car.vin} ${car.make ?? ""} ${car.model ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (
    typeof maxPrice === "number" &&
    typeof car.price === "number" &&
    car.price > maxPrice
  ) {
    return false;
  }

  if (
    typeof minPrice === "number" &&
    typeof car.price === "number" &&
    car.price < minPrice
  ) {
    return false;
  }

  if (
    typeof maxMileage === "number" &&
    typeof car.odometer === "number" &&
    car.odometer > maxMileage
  ) {
    return false;
  }

  if (
    activeFilters.bodyType &&
    car.bodyType?.toLowerCase() !== activeFilters.bodyType.toLowerCase()
  ) {
    return false;
  }

  if (
    activeFilters.driveType &&
    car.driveType?.toLowerCase() !== activeFilters.driveType.toLowerCase()
  ) {
    return false;
  }

  if (
    activeFilters.fuelType &&
    car.fuelType?.toLowerCase() !== activeFilters.fuelType.toLowerCase()
  ) {
    return false;
  }

  if (
    activeFilters.transmission &&
    car.transmission?.toLowerCase() !== activeFilters.transmission.toLowerCase()
  ) {
    return false;
  }

  if (
    activeFilters.colour &&
    car.colour?.toLowerCase() !== activeFilters.colour.toLowerCase()
  ) {
    return false;
  }

  return true;
}

type OptionWithCount = {
  value: string;
  count: number;
};

const parsePositiveInt = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
};

const parsePage = (value: string | null): number => {
  if (!value) {
    return 1;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
};

const readFiltersFromUrl = (): Filters => {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort") ?? "newest";
  const isSortAllowed = SORT_OPTIONS.some((option) => option.value === sort);

  // Legacy links (bookmarked/shared before the unified search box existed)
  // used separate make/model/vin params — fold them into one query string.
  const legacyQuery = [params.get("make"), params.get("model"), params.get("vin")]
    .filter(Boolean)
    .join(" ");

  return {
    query: params.get("query") ?? legacyQuery,
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    maxMileage: params.get("maxMileage") ?? "",
    bodyType: params.get("bodyType") ?? params.get("type") ?? "",
    driveType: params.get("driveType") ?? params.get("drive-type") ?? "",
    fuelType: params.get("fuelType") ?? params.get("fuel-type") ?? "",
    transmission: params.get("transmission") ?? "",
    colour: params.get("colour") ?? "",
    sort: isSortAllowed ? sort : "newest",
    page: parsePage(params.get("page")),
  };
};

const writeFiltersToUrl = (filters: Filters): void => {
  const url = new URL(window.location.href);
  // Rebuild from scratch to enforce canonical key naming and drop stale/legacy params.
  const params = new URLSearchParams();

  if (filters.query) params.set("query", filters.query);
  else params.delete("query");

  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  else params.delete("minPrice");

  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  else params.delete("maxPrice");

  if (filters.maxMileage) params.set("maxMileage", filters.maxMileage);
  else params.delete("maxMileage");

  if (filters.bodyType) params.set("bodyType", filters.bodyType);
  else params.delete("bodyType");

  if (filters.driveType) params.set("driveType", filters.driveType);
  else params.delete("driveType");

  if (filters.fuelType) params.set("fuelType", filters.fuelType);
  else params.delete("fuelType");

  if (filters.transmission) params.set("transmission", filters.transmission);
  else params.delete("transmission");

  if (filters.colour) params.set("colour", filters.colour);
  else params.delete("colour");

  if (filters.sort && filters.sort !== "newest")
    params.set("sort", filters.sort);
  else params.delete("sort");

  if (filters.page > 1) params.set("page", String(filters.page));
  else params.delete("page");

  const nextSearch = params.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
};

export default function InventoryFilters({ cars }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const resultsRef = useRef<HTMLElement | null>(null);
  const didMountRef = useRef(false);

  const buildCountOptions = (
    sourceCars: DisplayVehicle[],
    getValue: (car: DisplayVehicle) => string | undefined,
    selectedValue: string,
  ): OptionWithCount[] => {
    const counts = new Map<string, number>();

    sourceCars.forEach((car) => {
      const value = getValue(car);
      if (!value) {
        return;
      }

      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

    if (selectedValue && !counts.has(selectedValue)) {
      counts.set(selectedValue, 0);
    }

    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  useEffect(() => {
    setFilters(readFiltersFromUrl());
  }, []);

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const extraFilterOptions = useMemo(() => {
    const source = cars.filter((car) => matchesFilters(car, filters));
    return {
      bodyType: buildCountOptions(source, (c) => c.bodyType, filters.bodyType),
      driveType: buildCountOptions(
        source,
        (c) => c.driveType,
        filters.driveType,
      ),
      fuelType: buildCountOptions(source, (c) => c.fuelType, filters.fuelType),
      transmission: buildCountOptions(
        source,
        (c) => c.transmission,
        filters.transmission,
      ),
      colour: buildCountOptions(source, (c) => c.colour ?? undefined, filters.colour),
    };
  }, [cars, filters]);

  const activeFilterCount = ADVANCED_FILTER_KEYS.filter(
    (key) => filters[key] !== "",
  ).length;

  const filteredCars = useMemo(() => {
    return cars.filter((car) => matchesFilters(car, filters));
  }, [cars, filters]);

  const sortedCars = useMemo(
    () => sortCars(filteredCars, filters.sort),
    [filteredCars, filters.sort],
  );

  const totalPages = Math.max(1, Math.ceil(sortedCars.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);

  useEffect(() => {
    if (filters.page !== currentPage) {
      setFilters((current) => ({ ...current, page: currentPage }));
    }
  }, [currentPage, filters.page]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    resultsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentPage]);

  const paginatedCars = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedCars.slice(start, end);
  }, [currentPage, sortedCars]);

  const paginationPages = useMemo(() => {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }, [totalPages]);

  const updateFilters = (updater: (current: Filters) => Filters) => {
    setFilters((current) => {
      const next = updater(current);
      const didCriteriaChange =
        next.query !== current.query ||
        next.minPrice !== current.minPrice ||
        next.maxPrice !== current.maxPrice ||
        next.maxMileage !== current.maxMileage ||
        next.bodyType !== current.bodyType ||
        next.driveType !== current.driveType ||
        next.fuelType !== current.fuelType ||
        next.transmission !== current.transmission ||
        next.colour !== current.colour ||
        next.sort !== current.sort;

      if (didCriteriaChange) {
        return { ...next, page: 1 };
      }

      return next;
    });
  };

  const onReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <>
      <PublicSearchBar
        value={filters.query}
        onChange={(query) => updateFilters((c) => ({ ...c, query }))}
        placeholder="Search by make, model, or VIN"
        filters={{
          activeCount: activeFilterCount,
          onClear: onReset,
          panel: (
            <div className="pf-panel">
              <div className="pf-row">
                <label className="pf-field">
                  <span>Min Price</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="No min"
                    value={filters.minPrice}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, minPrice: e.target.value }))
                    }
                  />
                </label>
                <label className="pf-field">
                  <span>Max Price</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="No max"
                    value={filters.maxPrice}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, maxPrice: e.target.value }))
                    }
                  />
                </label>
                <label className="pf-field">
                  <span>Max Mileage</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="No max"
                    value={filters.maxMileage}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, maxMileage: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="pf-row">
                <label className="pf-field">
                  <span>Body Type</span>
                  <select
                    value={filters.bodyType}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, bodyType: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {PUBLIC_BODY_TYPES.map((bt) => {
                      const count = extraFilterOptions.bodyType.find(
                        (o) => o.value.toLowerCase() === bt.toLowerCase(),
                      )?.count ?? 0;
                      return (
                        <option key={bt} value={bt}>
                          {bt.charAt(0).toUpperCase() + bt.slice(1)}
                          {count > 0 ? ` (${count})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="pf-field">
                  <span>Drive Type</span>
                  <select
                    value={filters.driveType}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, driveType: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {extraFilterOptions.driveType.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pf-field">
                  <span>Fuel Type</span>
                  <select
                    value={filters.fuelType}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, fuelType: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {extraFilterOptions.fuelType.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pf-row">
                <label className="pf-field">
                  <span>Transmission</span>
                  <select
                    value={filters.transmission}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, transmission: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {extraFilterOptions.transmission.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pf-field">
                  <span>Colour</span>
                  <select
                    value={filters.colour}
                    onChange={(e) =>
                      updateFilters((c) => ({ ...c, colour: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    {extraFilterOptions.colour.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ),
        }}
        resultsLabel={`${sortedCars.length} Results`}
        actions={
          <label className="pf-sort">
            <span>Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) =>
                updateFilters((c) => ({ ...c, sort: e.target.value }))
              }
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {/* ── Inventory list ── */}
      <section className="inventory-list" ref={resultsRef}>
        {paginatedCars.map((car) => (
          <article className="car-row" key={car.vin}>
            <a
              href={`/listing/${car.vin}/`}
              className="car-thumb-link"
            >
              {car.images[0] ? (
                <img
                  src={car.images[0]}
                  alt={car.title}
                  className="car-thumb"
                  loading="lazy"
                />
              ) : (
                <div className="car-thumb car-thumb-placeholder">No image</div>
              )}
              {car.images.length > 0 && (
                <span className="img-count">{car.images.length}</span>
              )}
              {car.isSold && <span className="sold-badge">Sold</span>}
            </a>

            <div className="car-details">
              <a
                href={`/listing/${car.vin}/`}
                className="car-title-link"
              >
                <h2 className="car-title">{car.title}</h2>
              </a>
              <p className="car-subtitle">
                {[car.model, car.make, car.odometer ? `${car.odometer.toLocaleString("en-CA")} KM` : undefined]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
              <div className="car-tags">
                {car.year && <span className="year-pill">{car.year}</span>}
                {car.transmission && (
                  <span className="spec-pill">{car.transmission}</span>
                )}
                {car.driveType && (
                  <span className="spec-pill">{car.driveType}</span>
                )}
              </div>
            </div>

            <div className="car-price-col">
              <p className="car-price">{formatVehiclePrice(car.price)}</p>
              <a
                href={`/finance/?vin=${car.vin}${car.year ? `&year=${car.year}` : ""}${car.make ? `&make=${encodeURIComponent(car.make)}` : ""}${car.model ? `&model=${encodeURIComponent(car.model)}` : ""}${car.price ? `&price=${car.price}` : ""}`}
                className="financing-link"
              >
                Calculate financing
              </a>
            </div>
          </article>
        ))}
      </section>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Inventory pagination">
          <button
            type="button"
            onClick={() =>
              setFilters((c) => ({ ...c, page: Math.max(1, c.page - 1) }))
            }
            disabled={currentPage === 1}
          >
            ‹
          </button>

          <div className="pages">
            {paginationPages.map((n) => (
              <button
                key={n}
                type="button"
                className={n === currentPage ? "active" : undefined}
                onClick={() => setFilters((c) => ({ ...c, page: n }))}
                aria-current={n === currentPage ? "page" : undefined}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters((c) => ({
                ...c,
                page: Math.min(totalPages, c.page + 1),
              }))
            }
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </nav>
      )}

      <style>{`
        .pf-panel { display: flex; flex-direction: column; gap: 0.9rem; }
        .pf-row { display: flex; flex-wrap: wrap; gap: 0.9rem; }
        .pf-field {
          display: flex; flex-direction: column; gap: 0.3rem; flex: 1 1 130px; min-width: 130px;
          font-size: 0.76rem; font-weight: 700; color: var(--filter-label); text-transform: uppercase; letter-spacing: 0.02em;
        }
        .pf-field input, .pf-field select {
          height: 36px; padding: 0 0.6rem; border: 1px solid var(--line); border-radius: 6px;
          background: var(--bg-subtle); color: var(--ink); font-size: 0.85rem; font-weight: 600; font-family: inherit;
        }
        .pf-field input:focus, .pf-field select:focus { outline: none; border-color: var(--brand-red); }

        .pf-sort {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-size: 0.82rem; font-weight: 600; color: var(--muted); white-space: nowrap;
        }
        .pf-sort select {
          height: 44px; padding: 0 0.7rem; border: 1px solid var(--line); border-radius: 8px;
          background: var(--surface); color: var(--ink); font-size: 0.88rem; font-weight: 600; font-family: inherit;
          cursor: pointer;
        }
        .pf-sort select:hover, .pf-sort select:focus { outline: none; border-color: var(--brand-red); }

        @media (max-width: 480px) {
          .pf-row { gap: 0.6rem; }
          .pf-field { flex-basis: 100%; }
        }
      `}</style>
    </>
  );
}
