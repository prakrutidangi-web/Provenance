import { Link } from "react-router-dom";
import type { Product } from "../api";
import { formatDuration } from "../catalog";
import CourseCover from "./CourseCover";
import Price from "./Price";

/** Udemy/Coursera-style card: art, title, instructor, details, price + badge. */
export default function CourseCard({ product, layout = "card" }: { product: Product; layout?: "card" | "row" }) {
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
