import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCatalog, formatPrice } from "../catalog";
import { cart } from "../cart";
import { trackOnce } from "../trackOnce";
import { productParams } from "./CoursePage";

export default function Pricing() {
  const { catalog } = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const plan = catalog?.products.find((p) => p.kind === "plan");

  useEffect(() => {
    if (plan) trackOnce(location.key, "ViewContent", productParams(plan));
  }, [plan, location.key]);

  if (!catalog || !plan) return <div aria-busy="true" aria-label="Loading pricing" className="plans" style={{ marginTop: 48 }}><div className="skel skel-card" style={{ height: 320 }} /><div className="skel skel-card" style={{ height: 320 }} /></div>;
  const courses = catalog.products.filter((p) => p.kind === "course");
  const cheapest = Math.min(...courses.map((c) => c.priceCents));

  function getPlan() {
    if (!plan) return;
    cart.add(plan.id);
    window.kad("track", "AddToCart", { ...productParams(plan), itemCount: 1 });
    navigate("/checkout");
  }

  return (
    <div className="pricing">
      <div className="pricing-head">
        <h1>Pricing</h1>
        <p className="lede">Buy the courses you need, or get everything with All-Access.</p>
      </div>
      <div className="plans">
        <div className="plan">
          <h3>Single course</h3>
          <p className="plan-price">from {formatPrice(cheapest)}</p>
          <p className="muted">One-time purchase</p>
          <ul>
            <li>Lifetime access to that course</li>
            <li>All future updates to it</li>
            <li>Source code and certificate</li>
          </ul>
          <Link to="/courses" className="btn btn-quiet btn-block">Browse courses</Link>
        </div>
        <div className="plan plan-featured">
          <span className="plan-flag">Best value</span>
          <h3>All-Access</h3>
          <p className="plan-price">{formatPrice(plan.priceCents)}<span>/year</span></p>
          <p className="muted">Bought separately: <s>{formatPrice(plan.compareAtCents!)}</s></p>
          <ul>
            <li>All {courses.length} courses, plus every new release</li>
            <li>Downloadable source code and slides</li>
            <li>Certificates of completion</li>
          </ul>
          <button className="btn btn-sun btn-block" onClick={getPlan} data-testid="get-all-access">Get All-Access</button>
        </div>
      </div>
      <p className="muted small center">Prices in USD. This is a practice store, so nothing is charged.</p>
    </div>
  );
}
