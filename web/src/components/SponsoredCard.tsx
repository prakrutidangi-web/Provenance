import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Product } from "../api";
import type { Promo } from "../ads";
import { formatDuration } from "../catalog";
import { trackOnce } from "../trackOnce";
import CourseCover from "./CourseCover";
import Price from "./Price";

/**
 * A "Sponsored" course slot. Looks like a regular result, is clearly labeled,
 * and links to the promoted course without UTMs (see ads.ts for why).
 */
export default function SponsoredCard({ promo, product, placement, layout = "card" }: {
  promo: Promo;
  product: Product;
  placement: string; // where on the site the slot is, e.g. "search_top"
  layout?: "card" | "row" | "banner";
}) {
  const location = useLocation();
  const params = { promo_id: promo.id, placement, content_ids: [product.id], content_name: product.name };

  useEffect(() => {
    trackOnce(location.key, "PromoView", params, `${placement}:${promo.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, placement, promo.id]);

  if (layout === "banner") {
    // Featured ad: wide, high on the page, with its own call to action.
    return (
      <Link
        to={`/courses/${product.id}`}
        className="sponsored-banner"
        data-testid={`sponsored-${placement}`}
        data-course={product.id}
        onClick={() => window.kad("track", "PromoClick", params)}
      >
        <div className="sponsored-banner-art"><CourseCover product={product} size="lg" priority /></div>
        <div className="sponsored-banner-copy">
          <span className="sponsored-tag">Sponsored</span>
          <span className="sponsored-banner-title">{product.name}</span>
          <span className="sponsored-banner-sub">{product.subtitle}</span>
          <span className="ccard-meta">{product.instructor.name} · {product.level} · {formatDuration(product.durationMin)} · {product.lessons} lessons</span>
          <span className="sponsored-banner-cta">
            <span className="btn btn-sun">View course</span>
            <Price product={product} />
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/courses/${product.id}`}
      className={layout === "row" ? "ccard ccard-row-layout sponsored-slot" : "ccard sponsored-slot"}
      data-testid={`sponsored-${placement}`}
      data-course={product.id}
      onClick={() => window.kad("track", "PromoClick", params)}
    >
      <CourseCover product={product} />
      <div className="ccard-body">
        <span className="sponsored-tag">Sponsored</span>
        <span className="ccard-title">{product.name}</span>
        {layout === "row" && <span className="ccard-sub">{product.subtitle}</span>}
        <span className="ccard-meta">{product.instructor.name}</span>
        <span className="ccard-meta">{product.level}, {formatDuration(product.durationMin)}, {product.lessons} lessons</span>
        <div className="ccard-foot"><Price product={product} />{product.badge && <span className={`tag tag-${product.badge.toLowerCase()}`}>{product.badge}</span>}</div>
      </div>
    </Link>
  );
}
