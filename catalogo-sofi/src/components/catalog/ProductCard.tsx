"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon, PlusIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "@/lib/types";

export function discountPercent(p: Pick<CatalogProduct, "price_cents" | "compare_at_cents">) {
  if (!p.compare_at_cents || p.compare_at_cents <= p.price_cents) return 0;
  return Math.round((1 - p.price_cents / p.compare_at_cents) * 100);
}

export function ProductImage({
  product,
  sizes,
  priority,
  className = "",
}: {
  product: CatalogProduct;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!product.image_url) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-cream-deep to-accent-soft text-muted">
        <ImageIcon width={36} height={36} />
      </div>
    );
  }
  return (
    <Image
      src={product.image_url}
      alt={product.name}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}

export function ProductCard({
  product,
  onOpen,
  onQuickAdd,
  canAdd,
  priority,
}: {
  product: CatalogProduct;
  onOpen: () => void;
  onQuickAdd: () => void;
  canAdd: boolean;
  priority?: boolean;
}) {
  const [popped, setPopped] = useState(false);
  const off = discountPercent(product);

  return (
    <article className="group relative">
      <div className="relative">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={onOpen}
          className="relative block aspect-[4/5] w-full overflow-hidden rounded-[1.4rem] bg-cream-deep shadow-card"
        >
          <ProductImage
            product={product}
            priority={priority}
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
            className="transition duration-700 ease-out group-hover:scale-[1.04]"
          />
          {(product.tags.length > 0 || off > 0) && (
            <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
              {off > 0 && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">
                  -{off}%
                </span>
              )}
              {product.tags.slice(0, 1).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </span>
          )}
          {!product.is_available && (
            <span className="absolute inset-0 grid place-items-center bg-ink/35 backdrop-grayscale">
              <span className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ink">
                Esgotado
              </span>
            </span>
          )}
        </button>
        {product.is_available && canAdd && (
          <button
            type="button"
            onClick={() => {
              onQuickAdd();
              setPopped(true);
            }}
            onAnimationEnd={() => setPopped(false)}
            aria-label={`Adicionar ${product.name} à sacola`}
            className={`absolute bottom-2.5 right-2.5 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-lift transition hover:bg-accent hover:text-white active:scale-95 ${popped ? "animate-pop" : ""}`}
          >
            <PlusIcon />
          </button>
        )}
      </div>

      <button type="button" onClick={onOpen} className="mt-3 block w-full text-left">
        <h3 className="text-[15px] font-semibold leading-snug text-ink md:text-base">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
            {product.description}
          </p>
        )}
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold text-ink">{formatPrice(product.price_cents)}</span>
          {off > 0 && product.compare_at_cents && (
            <span className="text-[13px] text-muted line-through">
              {formatPrice(product.compare_at_cents)}
            </span>
          )}
          {product.serving && (
            <span className="text-[12px] text-muted">· {product.serving}</span>
          )}
        </p>
      </button>
    </article>
  );
}
