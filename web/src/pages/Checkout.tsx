import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Product } from "../api";
import { cart, useCart } from "../cart";
import { formatPrice, useCatalog } from "../catalog";
import CourseCover from "../components/CourseCover";

export default function Checkout() {
  const items = useCart();
  const navigate = useNavigate();
  const { catalog } = useCatalog();
  const [email, setEmail] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(
    () => items.map((i) => catalog?.products.find((p) => p.id === i.product_id)).filter((p): p is Product => !!p),
    [items, catalog],
  );
  const total = lines.reduce((sum, p) => sum + p.priceCents, 0);

  async function placeOrder(e: FormEvent) {
    e.preventDefault();
    if (placing || lines.length === 0) return;
    setPlacing(true); // also blocks double-submits
    setError(null);
    const products = lines.map((p) => ({ id: p.id, name: p.name, quantity: 1, price: p.priceCents / 100 }));
    window.kad("track", "InitiateCheckout", { value: total / 100, currency: "USD", products, itemCount: lines.length });
    try {
      // 1. The server creates and prices the order, and sends a server-side Purchase event.
      const order = await api.createOrder(items);
      // 2. The pixel sends its own Purchase with the SAME event id, so the two copies merge into one.
      window.kad("track", "Purchase", {
        eventId: order.event_id,
        value: order.value,
        currency: order.currency,
        products: order.products,
        itemCount: lines.length,
        order_id: order.order_id,
      });
      cart.clear();
      navigate(`/thank-you?order=${order.order_id}&total=${order.value}`);
    } catch (err) {
      setError(`Something went wrong placing your order: ${String(err)}`);
      setPlacing(false);
    }
  }

  if (items.length === 0)
    return (
      <div className="empty-state">
        <h1>Your cart is empty</h1>
        <p className="muted">Find a course for what you're building next.</p>
        <Link to="/courses" className="btn">Browse courses</Link>
      </div>
    );

  return (
    <form className="checkout" onSubmit={placeOrder}>
      <div className="checkout-main">
        <h1>Checkout</h1>
        <div className="testmode">
          <strong>Practice checkout.</strong> Nothing is charged and no card details are collected.
        </div>
        <label className="field" htmlFor="email">
          <span>Email (optional)</span>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com…"
          />
        </label>
        <p className="muted small">The email stays in your browser. It isn't sent to the server or the tracker.</p>
      </div>

      <aside className="order-summary">
        <h3>Order summary</h3>
        {lines.map((p) => (
          <div className="sum-line" key={p.id}>
            <CourseCover product={p} size="sm" />
            <div>
              <Link to={`/courses/${p.id}`} className="sum-name">{p.name}</Link>
              <button type="button" className="link-btn" onClick={() => cart.remove(p.id)} aria-label={`Remove ${p.name}`}>Remove</button>
            </div>
            <strong>{formatPrice(p.priceCents)}</strong>
          </div>
        ))}
        <div className="sum-total"><span>Total</span><span>{formatPrice(total)}</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-sun btn-block" type="submit" disabled={placing} data-testid="checkout">
          {placing ? "Placing order…" : `Place order, ${formatPrice(total)}`}
        </button>
      </aside>
    </form>
  );
}
