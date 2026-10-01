import type { Product } from "../api";
import { formatPrice } from "../catalog";

export default function Price({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <span className={large ? "price price-lg" : "price"}>
      {formatPrice(product.priceCents)}
      {product.compareAtCents && <s className="price-was">{formatPrice(product.compareAtCents)}</s>}
    </span>
  );
}
