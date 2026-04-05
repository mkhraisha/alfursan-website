import { useEffect, useMemo, useRef, useState } from "react";
import type { CarSummary } from "../lib/wordpress";
import { formatPrice } from "../lib/wordpress";

type Props = {
  cars: CarSummary[];
};

type Filters = {
  make: string;
  model: string;
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
  "vehicleType",
  "driveType",
  "fuelType",
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
  const resultsRef = useRef<HTMLElement | null>(null);
  const didMountRef = useRef(false);

  const matchesFilters = (
    car: CarSummary,
    activeFilters: Filters,
    options?: { ignoreMake?: boolean; ignoreModel?: boolean },
  ): boolean => {
    const maxPrice = parsePositiveInt(activeFilters.maxPrice);
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

  const [showMore, setShowMore] = useState(false);

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
      <section className="filters">
        <label>
          Make
          <select
            value={filters.make}
            onChange={(event) => onMakeChange(event.target.value)}
          >
            <option value="">All makes</option>
            {makeOptions.map((makeOption) => (
              <option key={makeOption.value} value={makeOption.value}>
                {makeOption.value} ({makeOption.count})
              </option>
            ))}
          </select>
        </label>

        <label>
          Model
          <select
            value={filters.model}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                model: event.target.value,
              }))
            }
          >
            <option value="">All models</option>
            {modelOptions.map((modelOption) => (
              <option key={modelOption.value} value={modelOption.value}>
                {modelOption.value} ({modelOption.count})
              </option>
            ))}
          </select>
        </label>

        <label>
          Max Price (CAD)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="e.g. 20000"
            value={filters.maxPrice}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                maxPrice: event.target.value,
              }))
            }
          />
        </label>

        <label>
          Max Mileage (KM)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="e.g. 120000"
            value={filters.maxMileage}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                maxMileage: event.target.value,
              }))
            }
          />
        </label>

        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                sort: event.target.value,
              }))
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="reset" onClick={onReset}>
          Reset
        </button>
      </section>

      <button
        type="button"
        className="more-filters-toggle"
        onClick={() => setShowMore((prev) => !prev)}
      >
        {showMore ? "Hide" : "More"} Filters
        {activeExtraCount > 0 ? ` (${activeExtraCount})` : ""}
      </button>

      {showMore && (
        <section className="extra-filters">
          <label>
            Condition
            <select
              value={filters.condition}
              onChange={(e) =>
                updateFilters((c) => ({ ...c, condition: e.target.value }))
              }
            >
              <option value="">All</option>
              {extraFilterOptions.condition.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value} ({o.count})
                </option>
              ))}
            </select>
          </label>

          <label>
            Body Type
            <select
              value={filters.vehicleType}
              onChange={(e) =>
                updateFilters((c) => ({ ...c, vehicleType: e.target.value }))
              }
            >
              <option value="">All</option>
              {extraFilterOptions.vehicleType.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value} ({o.count})
                </option>
              ))}
            </select>
          </label>

          <label>
            Drivetrain
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

          <label>
            Fuel Type
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

          <label>
            Transmission
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

          <label>
            Color
            <select
              value={filters.color}
              onChange={(e) =>
                updateFilters((c) => ({ ...c, color: e.target.value }))
              }
            >
              <option value="">All</option>
              {extraFilterOptions.color.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value} ({o.count})
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <p className="muted">
        Showing {firstShown}-{lastShown} of {sortedCars.length} matching
        vehicles ({cars.length} total).
      </p>

      <section className="grid" ref={resultsRef}>
        {paginatedCars.map((car) => (
          <article className="card" key={car.id}>
            <a href={`${import.meta.env.BASE_URL}listing/${car.slug}/`} className="card-img-link">
              {car.image ? (
                <img src={car.image} alt={car.title} loading="lazy" />
              ) : (
                <div className="placeholder">No image</div>
              )}
              {car.offerType?.toLowerCase() === "sold" && (
                <span className="sold-badge">Sold</span>
              )}
              {car.images.length > 0 && (
                <span className="img-count">{car.images.length}</span>
              )}
            </a>

            <div className="card-content">
              <a href={`${import.meta.env.BASE_URL}listing/${car.slug}/`} className="card-title-link">
                <h2>{car.title}</h2>
              </a>
              <p className="price">{formatPrice(car.price)}</p>
              <div className="card-specs">
                {car.year && <span>{car.year}</span>}
                {car.fuelType && <span>{car.fuelType}</span>}
                {car.driveType && <span>{car.driveType}</span>}
              </div>
            </div>
          </article>
        ))}
      </section>

      {totalPages > 1 ? (
        <nav className="pagination" aria-label="Inventory pagination">
          <button
            type="button"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.max(1, current.page - 1),
              }))
            }
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="pages">
            {paginationPages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={pageNumber === currentPage ? "active" : undefined}
                onClick={() =>
                  setFilters((current) => ({ ...current, page: pageNumber }))
                }
                aria-current={pageNumber === currentPage ? "page" : undefined}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.min(totalPages, current.page + 1),
              }))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </nav>
      ) : null}
    </>
  );
}
