import { useEffect, useState } from "react";
import type { Catalog } from "./api";
import { api } from "./api";

// The catalog is small and static, so fetch it once per page load and share it.
let cached: Catalog | null = null;
let inflight: Promise<Catalog> | null = null;

export function useCatalog(): { catalog: Catalog | null; error: string | null } {
  const [catalog, setCatalog] = useState<Catalog | null>(cached);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (cached) return;
    inflight ??= api.catalog();
    inflight
      .then((c) => {
        cached = c;
        setCatalog(c);
      })
      .catch((e) => {
        inflight = null;
        setError(String(e));
      });
  }, []);
  return { catalog, error };
}

/** "$129" for whole dollars, "$12.50" otherwise, the way course sites show prices. */
export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });

export const formatDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

