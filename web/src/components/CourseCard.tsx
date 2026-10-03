import { Link } from "react-router-dom";
import type { Product } from "../api";
import { formatDuration, useCatalog } from "../catalog";
import CourseCover from "./CourseCover";
import Price from "./Price";

/** Udemy/Coursera-style card: art, title, instructor, details, price + badge. */
export default function CourseCard({ product, layout = "card" }: { product: Product; layout?: "card" | "row" | "grid" }) {
  const { catalog } = useCatalog();
  if (layout === "grid") {
    const track = catalog?.tracks.find((t) => t.id === product.track)?.name;
    return (
      <Link to={`/courses/${product.id}`} className="gcard" data-testid={`course-${product.id}`}>
        <div className="gcard-art">
          <CourseCover product={product} />
          {track && <span className="gcard-chip">{track}</span>}
        </div>
        <span className="gcard-meta">{product.level} · {formatDuration(product.durationMin)} · {product.lessons} lessons</span>
        <span className="gcard-title">{product.name}</span>
        <span className="gcard-foot">
          <span className="gcard-by">{product.instructor.name}</span>
          <Price product={product} />
        </span>
      </Link>
    );
  }
  return (
    <Link to={`/courses/${product.id}`} className={layout === "row" ? "ccard ccard-row-layout" : "ccard"} data-testid={`course-${product.id}`}>
      <CourseCover product={product} />
      <div className="ccard-body">
        <span className="ccard-title">{product.name}</span>
        {layout === "row" && <span className="ccard-sub">{product.subtitle}</span>}
        <span className="ccard-meta">{product.instructor.name}</span>
        <span className="ccard-meta">{product.level}, {formatDuration(product.durationMin)}, {product.lessons} lessons</span>
        <div className="ccard-foot">
          <Price product={product} />
          {product.badge && <span className={`tag tag-${product.badge.toLowerCase()}`}>{product.badge}</span>}
        </div>
      </div>
    </Link>
  );
}
