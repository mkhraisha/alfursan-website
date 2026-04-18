import { useEffect, useMemo, useRef, useState } from "react";
import type { CarSummary } from "../lib/wordpress";
import { formatPrice } from "../lib/wordpress";

type Props = {
  cars: CarSummary[];
};

type Filters = {
  make: string;
  model: string;
  minPrice: string;
  maxPrice: string;
  maxMileage: string;
  condition: string;
  vehicleType: string;
  driveType: string;
  fuelType: string;
  transmission: string;
  color: string;
  sort: string;
  page: number;
};

const EMPTY_FILTERS: Filters = {
  make: "",
  model: "",
  minPrice: "",
  maxPrice: "",
  maxMileage: "",
  condition: "",
  vehicleType: "",
  driveType: "",
  fuelType: "",
  transmission: "",
  color: "",
  sort: "newest",
  page: 1,
};

const EXTRA_FILTER_KEYS: Array<keyof Filters> = [
  "condition",
  "transmission",
  "color",
];

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Date Listed: Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "mileage-asc", label: "Mileage: Low to High" },
  { value: "mileage-desc", label: "Mileage: High to Low" },
];

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
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    maxMileage: params.get("maxMileage") ?? "",
    condition: params.get("condition") ?? "",
    vehicleType: params.get("vehicleType") ?? params.get("type") ?? "",
    driveType: params.get("driveType") ?? params.get("drive-type") ?? "",
    fuelType: params.get("fuelType") ?? params.get("fuel-type") ?? "",
    transmission: params.get("transmission") ?? "",
    color: params.get("color") ?? "",
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

  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  else params.delete("minPrice");

  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  else params.delete("maxPrice");

  if (filters.maxMileage) params.set("maxMileage", filters.maxMileage);
  else params.delete("maxMileage");

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

  const matchesFilters = (
    car: CarSummary,
    activeFilters: Filters,
    options?: { ignoreMake?: boolean; ignoreModel?: boolean },
  ): boolean => {
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
      typeof car.mileageValue === "number" &&
      car.mileageValue > maxMileage
    ) {
      return false;
    }

    if (
      activeFilters.condition &&
      car.condition?.toLowerCase() !== activeFilters.condition.toLowerCase()
    ) {
      return false;
    }

    if (
      activeFilters.vehicleType &&
      car.vehicleType?.toLowerCase() !== activeFilters.vehicleType.toLowerCase()
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
      car.transmission?.toLowerCase() !==
        activeFilters.transmission.toLowerCase()
    ) {
      return false;
    }

    if (
      activeFilters.color &&
      car.color?.toLowerCase() !== activeFilters.color.toLowerCase()
    ) {
      return false;
    }

    return true;
  };

  const buildCountOptions = (
    sourceCars: CarSummary[],
    getValue: (car: CarSummary) => string | undefined,
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

    return buildCountOptions(source, (car) => car.make, filters.make);
  }, [cars, filters]);

  const modelOptions = useMemo(() => {
    const source = cars.filter((car) =>
      matchesFilters(car, filters, { ignoreModel: true }),
    );

    return buildCountOptions(source, (car) => car.model, filters.model);
  }, [cars, filters]);

  const extraFilterOptions = useMemo(() => {
    const source = cars.filter((car) => matchesFilters(car, filters));
    return {
      condition: buildCountOptions(
        source,
        (c) => c.condition,
        filters.condition,
      ),
      vehicleType: buildCountOptions(
        source,
        (c) => c.vehicleType,
        filters.vehicleType,
      ),
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
      color: buildCountOptions(source, (c) => c.color, filters.color),
    };
  }, [cars, filters]);

  const activeExtraCount = EXTRA_FILTER_KEYS.filter(
    (key) => filters[key] !== "",
  ).length;

  const filteredCars = useMemo(() => {
    return cars.filter((car) => matchesFilters(car, filters));
  }, [cars, filters]);

  const sortedCars = useMemo(() => {
    const sorted = [...filteredCars];

    switch (filters.sort) {
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
            (a.mileageValue ?? Number.POSITIVE_INFINITY) -
            (b.mileageValue ?? Number.POSITIVE_INFINITY),
        );
        break;
      case "mileage-desc":
        sorted.sort(
          (a, b) =>
            (b.mileageValue ?? Number.NEGATIVE_INFINITY) -
            (a.mileageValue ?? Number.NEGATIVE_INFINITY),
        );
        break;
      case "newest":
      default:
        sorted.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          if (dateA !== dateB) {
            return dateB - dateA;
          }

          return b.id - a.id;
        });
        break;
    }

    return sorted;
  }, [filteredCars, filters.sort]);

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
        next.minPrice !== current.minPrice ||
        next.maxPrice !== current.maxPrice ||
        next.maxMileage !== current.maxMileage ||
        next.condition !== current.condition ||
        next.vehicleType !== current.vehicleType ||
        next.driveType !== current.driveType ||
        next.fuelType !== current.fuelType ||
        next.transmission !== current.transmission ||
        next.color !== current.color ||
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
            value={filters.vehicleType}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, vehicleType: e.target.value }))
            }
          >
            <option value="">Body Type</option>
            {extraFilterOptions.vehicleType.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
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

      {/* ── Extra filters (Condition / Transmission / Color) ── */}
      {showMore && (
        <section className="extra-filters">
          <select
            value={filters.condition}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, condition: e.target.value }))
            }
          >
            <option value="">All Conditions</option>
            {extraFilterOptions.condition.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>

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
            value={filters.color}
            onChange={(e) =>
              updateFilters((c) => ({ ...c, color: e.target.value }))
            }
          >
            <option value="">Color</option>
            {extraFilterOptions.color.map((o) => (
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
          <article className="car-row" key={car.id}>
            <a
              href={`/listing/${car.slug}/`}
              className="car-thumb-link"
            >
              {car.image ? (
                <img
                  src={car.image}
                  alt={car.title}
                  className="car-thumb"
                  loading="lazy"
                />
              ) : (
                <div className="car-thumb car-thumb-placeholder">No image</div>
              )}
              {car.offerType?.toLowerCase() === "sold" && (
                <span className="sold-badge">Sold</span>
              )}
              {car.images.length > 0 && (
                <span className="img-count">{car.images.length}</span>
              )}
            </a>

            <div className="car-details">
              <a
                href={`/listing/${car.slug}/`}
                className="car-title-link"
              >
                <h2 className="car-title">{car.title}</h2>
              </a>
              <p className="car-subtitle">
                {[car.model, car.make, car.mileageKm]
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
              <p className="car-price">{formatPrice(car.price)}</p>
              <a
                href={`/financing/?slug=${car.slug}${car.year ? `&year=${car.year}` : ""}${car.make ? `&make=${encodeURIComponent(car.make)}` : ""}${car.model ? `&model=${encodeURIComponent(car.model)}` : ""}${car.price ? `&price=${car.price}` : ""}`}
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

