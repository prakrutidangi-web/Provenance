import { Link, useSearchParams } from "react-router-dom";
import { Check } from "@phosphor-icons/react";

export default function ThankYou() {
  const [params] = useSearchParams();
  const total = Number(params.get("total"));
  return (
    <div className="empty-state">
      <div className="check-mark" aria-hidden><Check size={26} weight="bold" /></div>
      <h1>You're enrolled</h1>
      <p className="muted">
        Order <code>{params.get("order")}</code>
        {total > 0 && <>, {total.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: total % 1 ? 2 : 0 })}</>}
      </p>
      <p>Your courses are in your library. This is a demo, so the library is imaginary.</p>
      <Link to="/courses" className="btn">Keep browsing</Link>
    </div>
  );
}
