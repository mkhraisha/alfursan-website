import { useEffect, useMemo, useRef, useState } from "react";
import type { DisplayVehicle } from "../lib/public-vehicle-view";
import { formatVehiclePrice, PUBLIC_BODY_TYPES } from "../lib/public-vehicle-view";

type Props = {
  cars: DisplayVehicle[];
};

type Filters = {
  make: string;
  model: string;
  vin: string;
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
  make: "",
  model: "",
  vin: "",
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

const EXTRA_FILTER_KEYS: Array<keyof Filters> = [
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
  options?: { ignoreMake?: boolean; ignoreModel?: boolean },
): boolean {
  const maxPrice = parsePositiveInt(activeFilters.maxPrice);
  const minPrice = parsePositiveInt(activeFilters.minPrice);
  const maxMileage = parsePositiveInt(activeFilters.maxMileage);

  if (
    !options?.ignoreMake &&
    activeFilters.make &&
    car.make?.toLowerCase() !== activeFilters.make.toLowerCase()
  ) {
    return false;
  }

  if (
    !options?.ignoreModel &&
    activeFilters.model &&
    car.model?.toLowerCase() !== activeFilters.model.toLowerCase()
  ) {
    return false;
  }

  if (
    activeFilters.vin &&
    !car.vin?.toLowerCase().includes(activeFilters.vin.trim().toLowerCase())
  ) {
    return false;
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

  return {
    make: params.get("make") ?? "",
    model: params.get("model") ?? "",
    vin: params.get("vin") ?? "",
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

  if (filters.make) params.set("make", filters.make);
  else params.delete("make");

  if (filters.model) params.set("model", filters.model);
  else params.delete("model");

  if (filters.vin) params.set("vin", filters.vin);
  else params.delete("vin");

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

  for (const key of EXTRA_FILTER_KEYS) {
    const val = filters[key];
    if (typeof val === "string" && val) params.set(key, val);
    else params.delete(key);
  }

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
  const [showMore, setShowMore] = useState(false);
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
    if (activeExtraCount > 0) {
      setShowMore(true);
    }
  }, []);

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const makeOptions = useMemo(() => {
    const source = cars.filter((car) =>
      matchesFilters(car, filters, { ignoreMake: true }),
    );

    return buildCountOptions(source, (car) => car.make ?? undefined, filters.make);
  }, [cars, filters]);

  const modelOptions = useMemo(() => {
    const source = cars.filter((car) =>
      matchesFilters(car, filters, { ignoreModel: true }),
    );

    return buildCountOptions(source, (car) => car.model ?? undefined, filters.model);
  }, [cars, filters]);

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

  const activeExtraCount = EXTRA_FILTER_KEYS.filter(
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

  const firstShown = sortedCars.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(currentPage * PAGE_SIZE, sortedCars.length);

  const updateFilters = (updater: (current: Filters) => Filters) => {
    setFilters((current) => {
      const next = updater(current);
      const didCriteriaChange =
        next.make !== current.make ||
        next.model !== current.model ||
        next.vin !== current.vin ||
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

  const onMakeChange = (nextMake: string) => {
    updateFilters((current) => ({
      ...current,
      make: nextMake,
      model: "",
    }));
  };

  const onReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <>
      {/* ── Filter bar ── */}
      <section className="filters">
        <div className="filter-row">
          <select
            value={filters.make}
            onChange={(e) => onMakeChange(e.target.value)}
          >
            <option value="">All Makes</option>
            {makeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

          <select
            value={filters.model}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, model: e.target.value }))
            }
          >
            <option value="">All Models</option>
            {modelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by VIN"
            value={filters.vin}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, vin: e.target.value }))
            }
          />

          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min Price"
            value={filters.minPrice}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, minPrice: e.target.value }))
            }
          />

          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max Price"
            value={filters.maxPrice}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, maxPrice: e.target.value }))
            }
          />

          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Mileage"
            value={filters.maxMileage}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, maxMileage: e.target.value }))
            }
          />

          <select
            value={filters.bodyType}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, bodyType: e.target.value }))
            }
          >
            <option value="">Body Type</option>
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

          <select
            value={filters.driveType}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, driveType: e.target.value }))
            }
          >
            <option value="">Drive Type</option>
            {extraFilterOptions.driveType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

          <select
            value={filters.fuelType}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, fuelType: e.target.value }))
            }
          >
            <option value="">Fuel Type</option>
            {extraFilterOptions.fuelType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

          <div className="filter-actions">
            <button type="button" className="reset" onClick={onReset}>
              Clear all
            </button>
            <button
              type="button"
              className="more-filters-toggle"
              onClick={() => setShowMore((prev) => !prev)}
            >
              {showMore ? "Hide" : "+"} More Filters
              {activeExtraCount > 0 ? ` (${activeExtraCount})` : ""}
            </button>
          </div>
        </div>
      </section>

      {/* ── Extra filters (Transmission / Colour) ── */}
      {showMore && (
        <section className="extra-filters">
          <select
            value={filters.transmission}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, transmission: e.target.value }))
            }
          >
            <option value="">Transmission</option>
            {extraFilterOptions.transmission.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

          <select
            value={filters.colour}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, colour: e.target.value }))
            }
          >
            <option value="">Colour</option>
            {extraFilterOptions.colour.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>
        </section>
      )}

      {/* ── Results header ── */}
      <div className="results-header">
        <strong className="results-count">{sortedCars.length} Results</strong>
        <div className="sort-group">
          <span className="sort-label">Sort by:</span>
          <select
            className="sort-select"
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
        </div>
      </div>

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
    </>
  );
}
