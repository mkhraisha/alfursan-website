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
  sort: string;
  page: number;
};

const EMPTY_FILTERS: Filters = {
  make: "",
  model: "",
  maxPrice: "",
  maxMileage: "",
  sort: "newest",
  page: 1,
};

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
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
    sort: isSortAllowed ? sort : "newest",
    page: parsePage(params.get("page")),
  };
};

const writeFiltersToUrl = (filters: Filters): void => {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);

  if (filters.make) params.set("make", filters.make);
  else params.delete("make");

  if (filters.model) params.set("model", filters.model);
  else params.delete("model");

  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  else params.delete("maxPrice");

  if (filters.maxMileage) params.set("maxMileage", filters.maxMileage);
  else params.delete("maxMileage");

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

  const filteredCars = useMemo(() => {
    return cars.filter((car) => matchesFilters(car, filters));
  }, [cars, filters]);

  const sortedCars = useMemo(() => {
    const sorted = [...filteredCars];

    const toYearNumber = (value: string | undefined): number => {
      const year = Number(value);
      return Number.isFinite(year) ? year : -1;
    };

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
          const byYear = toYearNumber(b.year) - toYearNumber(a.year);
          if (byYear !== 0) {
            return byYear;
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

      <p className="muted">
        Showing {firstShown}-{lastShown} of {sortedCars.length} matching
        vehicles ({cars.length} total).
      </p>

      <section className="grid" ref={resultsRef}>
        {paginatedCars.map((car) => (
          <article className="card" key={car.id}>
            <a href={`/listing/${car.slug}/`} className="card-img-link">
              {car.image ? (
                <img src={car.image} alt={car.title} loading="lazy" />
              ) : (
                <div className="placeholder">No image</div>
              )}
            </a>

            <div className="card-content">
              <a href={`/listing/${car.slug}/`} className="card-title-link">
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
