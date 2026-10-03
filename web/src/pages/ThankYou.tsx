import { Link, useSearchParams } from "react-router-dom";
import { Check } from "@phosphor-icons/react";

export default function ThankYou() {
  const [params] = useSearchParams();
  const total = Number(params.get("total"));
  return (
    <div className="empty-state">
      <div className="check-mark" aria-hidden><Check size={26} weight="bold" /></div>
      <h1>Order confirmed</h1>
      <p className="muted">
        Order <code>{params.get("order")}</code>
        {total > 0 && <>, {total.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: total % 1 ? 2 : 0 })}</>}
      </p>
      <p>Thank you. Nothing was charged, because Kernelcraft is a practice store with no real courses to deliver.</p>
      <Link to="/courses" className="btn">Keep browsing</Link>
    </div>
  );
}
