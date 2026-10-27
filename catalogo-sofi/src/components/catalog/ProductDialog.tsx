"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "@/lib/types";
import { discountPercent, ProductImage } from "./ProductCard";
import { Quantity } from "./Quantity";

export function ProductDialogBody({
  product,
  categoryName,
  canOrder,
  onAdd,
  onClose,
}: {
  product: CatalogProduct;
  categoryName: string | null;
  canOrder: boolean;
  onAdd: (qty: number, note: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const off = discountPercent(product);

  return (
    <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-lift animate-sheet-up md:max-w-4xl md:flex-row md:rounded-[2rem]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur transition hover:bg-white"
      >
        <CloseIcon />
      </button>

      <div className="relative aspect-[4/3] w-full shrink-0 bg-cream-deep md:aspect-auto md:w-1/2">
        <ProductImage product={product} sizes="(min-width: 768px) 450px, 100vw" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6 md:px-8 md:pt-10">
          {categoryName && (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {categoryName}
            </p>
          )}
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {product.name}
          </h2>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold">{formatPrice(product.price_cents)}</span>
            {off > 0 && product.compare_at_cents && (
              <>
                <span className="text-muted line-through">
                  {formatPrice(product.compare_at_cents)}
                </span>
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-deep">
                  {off}% off
                </span>
              </>
            )}
          </p>
          {product.serving && <p className="mt-1 text-sm text-muted">{product.serving}</p>}
          {product.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
          {product.description && (
            <p className="mt-5 whitespace-pre-line leading-relaxed text-ink-soft">
              {product.description}
            </p>
          )}

          {product.is_available && canOrder && (
            <label className="mt-6 block">
              <span className="text-sm font-semibold">Alguma observação?</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Ex.: escrever “Parabéns, Ana”, sem castanhas…"
                className="mt-2 w-full resize-none rounded-2xl border border-line bg-cream/60 px-4 py-3 text-sm placeholder:text-muted/70 focus:border-accent focus:bg-white focus:outline-none"
              />
            </label>
          )}
        </div>

        <div className="border-t border-line px-6 py-4 md:px-8">
          {!product.is_available ? (
            <p className="rounded-2xl bg-cream-deep px-4 py-3 text-center font-semibold text-ink-soft">
              Esgotado no momento
            </p>
          ) : !canOrder ? (
            <p className="rounded-2xl bg-cream-deep px-4 py-3 text-center font-semibold text-ink-soft">
              Pedidos pausados no momento
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Quantity value={qty} onChange={setQty} label="Quantidade" />
              <button
                type="button"
                onClick={() => onAdd(qty, note)}
                className="flex h-[52px] flex-1 items-center justify-between gap-3 rounded-full bg-ink px-5 font-semibold sm:px-6 text-cream transition hover:bg-accent active:scale-[0.99]"
              >
                <span>Adicionar</span>
                <span className="tabular-nums">{formatPrice(product.price_cents * qty)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
