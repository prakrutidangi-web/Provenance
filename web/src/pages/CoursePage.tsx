import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCatalog, formatPrice, formatDuration } from "../catalog";
import { cart, useCart } from "../cart";
import type { Product } from "../api";
import CourseCover from "../components/CourseCover";
import CourseCard from "../components/CourseCard";
import SponsoredCard from "../components/SponsoredCard";
import { pickPromos, promoProduct } from "../ads";
import Avatar from "../components/Avatar";
import Price from "../components/Price";
import { trackOnce } from "../trackOnce";

export const productParams = (p: Product) => ({
  value: p.priceCents / 100,
  currency: "USD",
  products: [{ id: p.id, name: p.name, category: p.track, quantity: 1, price: p.priceCents / 100 }],
});

function CourseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading course">
      <div className="skel skel-line" style={{ width: "40%", height: 36, marginTop: 24 }} />
      <div className="skel skel-line short" style={{ marginTop: 16 }} />
      <div className="skel skel-poster" style={{ marginTop: 32, maxWidth: 520 }} />
    </div>
  );
}

export default function CoursePage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { catalog, error } = useCatalog();
  const items = useCart();
  const [added, setAdded] = useState(false);
  const product = catalog?.products.find((p) => p.id === id);
  const inCart = items.some((i) => i.product_id === id);

  useEffect(() => {
    setAdded(false);
    if (product) trackOnce(location.key, "ViewContent", productParams(product)); // funnel step
  }, [product, location.key]);

  if (error) return <p className="error">Couldn't load the course ({error}).</p>;
  if (!catalog) return <CourseSkeleton />;
  if (id === "all-access") return <Navigate to={`/pricing${location.search}`} replace />;
  if (!product) return (
    <div className="empty-state">
      <h1>Course not found</h1>
      <p className="muted">No course has the address “{id}”. It may have been renamed.</p>
      <Link to="/courses" className="btn">Browse courses</Link>
    </div>
  );

  const track = catalog.tracks.find((t) => t.id === product.track)!;
  const plan = catalog.products.find((p) => p.kind === "plan")!;
  const related = catalog.products.filter((p) => p.kind === "course" && p.track === product.track && p.id !== product.id).slice(0, 3);
  // One sponsored slot next to related courses; never the course you're on or one already shown.
  const [promo] = pickPromos({ track: product.track, exclude: [product.id, ...related.map((p) => p.id)] }, 1, product.id.length);
  const promoted = promo ? promoProduct(promo, catalog.products) : undefined;
  const moreFromInstructor = catalog.products.filter((p) => p.instructor.name === product.instructor.name && p.id !== product.id);

  function addToCart(goToCheckout: boolean) {
    if (!product) return;
    if (!inCart) {
      cart.add(product.id);
      window.kad("track", "AddToCart", { ...productParams(product), itemCount: 1 }); // funnel step
    }
    if (goToCheckout) navigate("/checkout");
    else setAdded(true);
  }

  return (
    <>
      <section className="course-hero">
        <div className="course-hero-inner">
          <div className="course-hero-copy">
            <nav className="crumbs">
              <Link to="/courses">Courses</Link> / <Link to={`/courses?track=${track.id}`}>{track.name}</Link>
            </nav>
            <h1>{product.name}</h1>
            <p className="lede">{product.subtitle}</p>
            <p className="course-meta">{product.level}, {product.lessons} lessons, updated {product.updated}</p>
            <div className="course-instructor">
              <Avatar name={product.instructor.name} />
              <div>
                <strong>{product.instructor.name}</strong>
                <span>{product.instructor.title}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="course-layout">
        <div className="course-main">
          <div className="facts">
            <div><span>Level</span><strong>{product.level}</strong></div>
            <div><span>Length</span><strong>{formatDuration(product.durationMin)}</strong></div>
            <div><span>Lessons</span><strong>{product.lessons}</strong></div>
            <div><span>Includes</span><strong>Source code, captions, certificate</strong></div>
          </div>

          <h2>What you'll learn</h2>
          <ul className="outcomes">
            {product.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>

          <h2>A taste of the code</h2>
          <pre className="code-sample"><code>{product.snippet.join("\n")}</code></pre>

          <h2>Syllabus</h2>
          <ol className="syllabus">
            {product.syllabus.map((m, i) => (
              <li key={m.title}>
                <span className="mod-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="mod-title">{m.title}</span>
                <span className="muted small">{m.lessons} lessons</span>
              </li>
            ))}
          </ol>

          <h2>Your instructor</h2>
          <div className="instructor-card">
            <Avatar name={product.instructor.name} size={56} />
            <div>
              <strong>{product.instructor.name}</strong>
              <span className="muted">{product.instructor.title}</span>
              {moreFromInstructor.length > 0 && (
                <span className="small">
                  Also teaches{" "}
                  {moreFromInstructor.map((p, i) => (
                    <span key={p.id}>{i > 0 && ", "}<Link to={`/courses/${p.id}`}>{p.name}</Link></span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>

        <aside className="buybox">
          <CourseCover product={product} size="lg" priority />
          <div className="buybox-body">
            <Price product={product} large />
            <button className="btn btn-sun btn-block" onClick={() => addToCart(true)} data-testid="buy-now">Buy now</button>
            <button className="btn btn-quiet btn-block" onClick={() => addToCart(false)} data-testid="add-to-cart" disabled={inCart && !added}>
              {inCart && !added ? "In your cart" : "Add to cart"}
            </button>
            {added && (
              <p className="added" role="status" data-testid="added-to-cart">
                Added to your cart. <Link to="/checkout">Go to checkout</Link>
              </p>
            )}
            <p className="muted small center">Practice store. Nothing is charged.</p>
            <div className="upsell">
              Or get this and {catalog.products.filter((p) => p.kind === "course").length - 1} more courses with{" "}
              <Link to="/pricing">All-Access, {formatPrice(plan.priceCents)} a year</Link>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>More in {track.name}</h2></div>
          <div className="cgrid cgrid-4">
            {related.map((p) => <CourseCard key={p.id} product={p} />)}
            {promo && promoted && <SponsoredCard key={`${product.id}:${promo.id}`} promo={promo} product={promoted} placement="course_related" />}
          </div>
        </section>
      )}
    </>
  );
}
