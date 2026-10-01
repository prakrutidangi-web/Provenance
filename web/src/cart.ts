import { useSyncExternalStore } from "react";

/**
 * The cart, kept in localStorage. Courses are digital, so it's a set of product
 * ids (no quantities). Prices always come from the server.
 */
export interface CartItem {
  product_id: string;
}

const KEY = "kernelcraft_cart";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;

function read(): CartItem[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(items: CartItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* in-memory only */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  add(productId: string) {
    if (!read().some((i) => i.product_id === productId)) write([...read(), { product_id: productId }]);
  },
  remove(productId: string) {
    write(read().filter((i) => i.product_id !== productId));
  },
  clear: () => write([]),
};

export function useCart(): CartItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
  );
}
