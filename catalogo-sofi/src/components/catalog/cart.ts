"use client";

import { useCallback, useEffect, useState } from "react";

export type CartLine = {
  key: string;
  productId: string;
  qty: number;
  note: string;
};

const CART_KEY = "azven-cart:v1";
export const MAX_QTY = 99;

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          !!l &&
          typeof l.key === "string" &&
          typeof l.productId === "string" &&
          Number.isInteger(l.qty) &&
          typeof l.note === "string",
      )
      .map((l) => ({ ...l, qty: Math.min(Math.max(l.qty, 1), MAX_QTY), note: l.note.slice(0, 200) }));
  } catch {
    return [];
  }
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLines(readCart());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      // Navegação anônima ou armazenamento bloqueado: a sacola só não persiste.
    }
  }, [lines, loaded]);

  const add = useCallback((productId: string, qty = 1, note = "") => {
    const cleanNote = note.trim().slice(0, 200);
    const key = `${productId}::${cleanNote.toLowerCase()}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) } : l,
        );
      }
      return [...prev, { key, productId, qty: Math.min(qty, MAX_QTY), note: cleanNote }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, MAX_QTY) } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  return { lines, add, setQty, remove, clear };
}
