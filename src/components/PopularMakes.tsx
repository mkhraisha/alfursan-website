import { useState, useRef } from "react";
import type { CarSummary } from "../lib/wordpress";
import { formatPrice } from "../lib/wordpress";

type MakeGroup = {
  make: string;
  count: number;
  cars: CarSummary[];
};

type Props = {
  makes: MakeGroup[];
};

export default function PopularMakes({ makes }: Props) {
  const [activeMake, setActiveMake] = useState(makes[0]?.make ?? "");
  const carouselRef = useRef<HTMLDivElement>(null);

  const activeGroup = makes.find((m) => m.make === activeMake);
  const cars = activeGroup?.cars ?? [];

  function scroll(dir: "prev" | "next") {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = (el.querySelector(".pm-card") as HTMLElement)?.offsetWidth ?? 300;
    el.scrollBy({ left: dir === "next" ? cardWidth + 22 : -(cardWidth + 22), behavior: "smooth" });
  }

  return (
    <section className="pm-section">
      <div className="pm-section-head">
        <h3 className="pm-heading">Popular Makes</h3>
        <div className="pm-tabs-wrapper">
          <div className="pm-tabs" role="tablist">
            {makes.map((group) => (
              <div
                key={group.make}
                role="tab"
                aria-selected={group.make === activeMake}
                className={`pm-tab${group.make === activeMake ? " pm-tab--active" : ""}`}
                onClick={() => setActiveMake(group.make)}
              >
                <div className="pm-tab-make">{group.make}</div>
                <div className="pm-tab-count">
                  {group.count} Listing{group.count !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pm-carousel" role="tabpanel" ref={carouselRef}>
        <div className="pm-carousel-track">
          {cars.map((car) => (
            <article className="pm-card" key={car.id}>
              <div className="pm-card-img-bg">
                <a href={`/listing/${car.slug}/`} className="pm-card-img-link">
                  {car.image ? (
                    <img src={car.image} alt={car.title} loading="lazy" />
                  ) : (
                    <div className="pm-placeholder">No image</div>
                  )}
                  {car.offerType?.toLowerCase() === "sold" && (
                    <span className="pm-sold-badge">Sold</span>
                  )}
                  {car.images.length > 0 && (
                    <span className="pm-img-count">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>{car.images.length}</span>
                    </span>
                  )}
                </a>
              </div>
              <div className="pm-card-body">
                <a
                  href={`/listing/${car.slug}/`}
                  className="pm-card-title-link"
                >
                  <h4>{car.title}</h4>
                </a>
                <div className="pm-price">{formatPrice(car.price)}</div>
                <div className="pm-card-separator" />
                <div className="pm-card-specs">
                  {car.year && <span>{car.year}</span>}
                  {car.mileageKm && <span>{Number(car.mileageKm).toLocaleString("en-CA")}KM</span>}
                  {car.transmission && <span>{car.transmission}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="pm-bottom-bar">
        <div className="pm-arrows">
          <button className="pm-arrow pm-arrow--prev" aria-label="Previous" onClick={() => scroll("prev")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="pm-arrow pm-arrow--next" aria-label="Next" onClick={() => scroll("next")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        {activeGroup && (
          <a
            href={`/search/?make=${encodeURIComponent(activeMake.toLowerCase())}`}
            className="pm-view-all"
          >
            View {activeGroup.count} {activeMake}
          </a>
        )}
      </div>
    </section>
  );
}
