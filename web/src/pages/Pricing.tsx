import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check } from "@phosphor-icons/react";
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

  if (!catalog || !plan) return <p className="muted">Loading…</p>;
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
            <li><Check size={16} weight="bold" aria-hidden /> Lifetime access to that course</li>
            <li><Check size={16} weight="bold" aria-hidden /> All future updates to it</li>
            <li><Check size={16} weight="bold" aria-hidden /> Source code and certificate</li>
          </ul>
          <Link to="/courses" className="btn btn-quiet btn-block">Browse courses</Link>
        </div>
        <div className="plan plan-featured">
          <span className="plan-flag">Best value</span>
          <h3>All-Access</h3>
          <p className="plan-price">{formatPrice(plan.priceCents)}<span>/year</span></p>
          <p className="muted">Bought separately: <s>{formatPrice(plan.compareAtCents!)}</s></p>
          <ul>
            <li><Check size={16} weight="bold" aria-hidden /> All {courses.length} courses, plus every new release</li>
            <li><Check size={16} weight="bold" aria-hidden /> Downloadable source code and slides</li>
            <li><Check size={16} weight="bold" aria-hidden /> Certificates of completion</li>
            <li><Check size={16} weight="bold" aria-hidden /> Cancel anytime</li>
          </ul>
          <button className="btn btn-block" onClick={getPlan} data-testid="get-all-access">Get All-Access</button>
        </div>
      </div>
      <p className="muted small center">Prices in USD. Every purchase can be refunded within 30 days.</p>
    </div>
  );
}
