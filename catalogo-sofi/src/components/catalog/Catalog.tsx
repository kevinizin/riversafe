"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BagIcon,
  ClockIcon,
  CloseIcon,
  InstagramIcon,
  PinIcon,
  SearchIcon,
  WhatsappIcon,
} from "@/components/icons";
import { formatPrice, formatWhatsapp } from "@/lib/format";
import type { CatalogProduct, CatalogSettings, Category } from "@/lib/types";
import { useCart } from "./cart";
import { CartPanel } from "./CartPanel";
import type { ResolvedLine } from "./order";
import { ProductCard } from "./ProductCard";
import { ProductDialogBody } from "./ProductDialog";
import { Sheet } from "./Sheet";

type Props = {
  settings: CatalogSettings;
  categories: Pick<Category, "id" | "name">[];
  products: CatalogProduct[];
  demo: boolean;
};

const OTHERS_ID = "outros";

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Catalog({ settings, categories, products }: Props) {
  const cart = useCart();
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const chipsRef = useRef<HTMLDivElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const sections = useMemo(() => {
    const q = normalize(query.trim());
    const matches = (p: CatalogProduct) =>
      !q ||
      normalize(`${p.name} ${p.description ?? ""} ${p.tags.join(" ")}`).includes(q);

    const list = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: products.filter((p) => p.category_id === c.id && matches(p)),
      }))
      .filter((s) => s.items.length > 0);

    const others = products.filter(
      (p) => (!p.category_id || !categoryName.has(p.category_id)) && matches(p),
    );
    if (others.length > 0) list.push({ id: OTHERS_ID, name: "Outros", items: others });
    return list;
  }, [categories, products, query, categoryName]);

  const featured = useMemo(
    () => products.filter((p) => p.is_featured && p.is_available),
    [products],
  );

  const { lines, unavailable } = useMemo(() => {
    const ok: ResolvedLine[] = [];
    const out: ResolvedLine[] = [];
    for (const l of cart.lines) {
      const product = productById.get(l.productId);
      if (!product) continue; // produto removido do catálogo
      (product.is_available ? ok : out).push({ ...l, product });
    }
    return { lines: ok, unavailable: out };
  }, [cart.lines, productById]);

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.product.price_cents, 0);
  const openProduct = openProductId ? productById.get(openProductId) : undefined;

  // Destaca a categoria visível na barra de categorias.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(`sec-${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id.slice(4));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!activeSection) return;
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-chip="${activeSection}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeSection]);

  function addToCart(productId: string, qty = 1, note = "") {
    cart.add(productId, qty, note);
    setBump((b) => b + 1);
  }

  const canOrder = settings.accepting_orders;
  const whatsappHref = settings.whatsapp ? `https://wa.me/${settings.whatsapp}` : null;
  const initials = settings.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <a href="#topo" className="flex min-w-0 items-center gap-2.5">
            {settings.logo_url ? (
              <Image
                src={settings.logo_url}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full shadow-card"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-cream">
                {initials}
              </span>
            )}
            <span className="truncate font-display text-lg font-semibold tracking-tight">
              {settings.name}
            </span>
          </a>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-11 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-semibold text-cream transition hover:bg-accent"
            aria-label={`Abrir sacola, ${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
          >
            <BagIcon width={18} height={18} />
            <span className="hidden tabular-nums sm:inline">
              {itemCount > 0 ? formatPrice(subtotal) : "Sacola"}
            </span>
            {itemCount > 0 && (
              <span
                key={bump}
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-ink animate-pop"
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section id="topo" className="mx-auto max-w-6xl px-4 pb-8 pt-6 md:px-6 md:pb-14 md:pt-12">
        <div className="grid items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-12">
          <div className="order-2 mt-4 md:order-1 md:mt-0">
            {settings.logo_url && (
              <Image
                src={settings.logo_url}
                alt={settings.name}
                width={144}
                height={144}
                priority
                className="mb-6 hidden h-36 w-36 rounded-full shadow-lift md:block"
              />
            )}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                canOrder ? "bg-leaf-soft text-leaf" : "bg-cream-deep text-ink-soft"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${canOrder ? "bg-leaf animate-pulse" : "bg-muted"}`}
              />
              {canOrder ? "Aceitando pedidos" : "Pedidos pausados"}
            </span>
            <h1 className="mt-5 text-balance font-display text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              {settings.name}
            </h1>
            {settings.tagline && (
              <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-ink-soft">
                {settings.tagline}
              </p>
            )}
            <ul className="mt-6 space-y-2 text-[15px] text-ink-soft">
              {settings.hours_text && (
                <li className="flex items-start gap-2.5">
                  <ClockIcon className="mt-0.5 shrink-0 text-accent" width={18} height={18} />
                  {settings.hours_text}
                </li>
              )}
              {settings.address && (
                <li className="flex items-start gap-2.5">
                  <PinIcon className="mt-0.5 shrink-0 text-accent" width={18} height={18} />
                  {settings.address}
                </li>
              )}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#cardapio"
                className="inline-flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-white shadow-card transition hover:bg-accent-deep"
              >
                Ver cardápio
              </a>
              {settings.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white/60 px-5 font-semibold transition hover:border-ink"
                >
                  <InstagramIcon width={18} height={18} />@{settings.instagram}
                </a>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white/60 px-5 font-semibold transition hover:border-ink"
                >
                  <WhatsappIcon width={18} height={18} className="text-[#1f8f4e]" />
                  {formatWhatsapp(settings.whatsapp)}
                </a>
              )}
            </div>
          </div>

          <div className="relative order-1 md:order-2">
            <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] bg-cream-deep shadow-lift md:aspect-[4/5]">
              {settings.cover_url && (
                <Image
                  src={settings.cover_url}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 768px) 520px, 100vw"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent" />
            </div>
            {(settings.delivery_enabled || settings.min_order_cents > 0) && (
              <div className="absolute -bottom-5 left-4 right-4 flex justify-center md:-left-8 md:right-auto">
                <div className="flex divide-x divide-line rounded-2xl bg-white px-1 py-3 text-sm shadow-lift">
                  {settings.delivery_enabled && (
                    <div className="px-4">
                      <p className="text-xs text-muted">Entrega</p>
                      <p className="font-bold">
                        {settings.delivery_fee_cents > 0
                          ? formatPrice(settings.delivery_fee_cents)
                          : "Grátis"}
                      </p>
                    </div>
                  )}
                  {settings.pickup_enabled && (
                    <div className="px-4">
                      <p className="text-xs text-muted">Retirada</p>
                      <p className="font-bold">Na loja</p>
                    </div>
                  )}
                  {settings.min_order_cents > 0 && (
                    <div className="px-4">
                      <p className="text-xs text-muted">Pedido mín.</p>
                      <p className="font-bold">{formatPrice(settings.min_order_cents)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Busca + categorias */}
      <div
        id="cardapio"
        className="sticky top-16 z-20 mt-6 border-b border-line/70 bg-cream/90 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <label className="relative w-40 shrink-0 sm:w-64">
            <span className="sr-only">Buscar no cardápio</span>
            <SearchIcon
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              width={18}
              height={18}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              maxLength={60}
              className="h-11 w-full rounded-full border border-line bg-white pl-10 pr-9 text-[15px] placeholder:text-muted/80 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-cream-deep"
              >
                <CloseIcon width={16} height={16} />
              </button>
            )}
          </label>
          <div ref={chipsRef} className="no-scrollbar -mr-4 flex gap-2 overflow-x-auto pr-4 md:mr-0">
            {sections.map((s) => (
              <a
                key={s.id}
                data-chip={s.id}
                href={`#sec-${s.id}`}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  activeSection === s.id
                    ? "bg-ink text-cream"
                    : "bg-white text-ink-soft ring-1 ring-line hover:text-ink"
                }`}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-32 md:px-6">
        {/* Destaques */}
        {!query && featured.length > 0 && (
          <section className="pt-10" aria-labelledby="destaques">
            <div className="flex items-end justify-between">
              <h2 id="destaques" className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Destaques <span className="italic text-accent">da casa</span>
              </h2>
            </div>
            <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
              {featured.map((p, i) => (
                <div key={p.id} className="w-[64%] shrink-0 snap-start sm:w-[38%] md:w-[27%] lg:w-[23%]">
                  <ProductCard
                    product={p}
                    priority={i < 2}
                    onOpen={() => setOpenProductId(p.id)}
                    onQuickAdd={() => addToCart(p.id)}
                    canAdd={canOrder}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-2xl font-semibold">Nada encontrado</p>
            <p className="mt-2 text-ink-soft">
              {query ? `Nenhum produto com “${query}”.` : "O cardápio está sendo preparado."}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-6 rounded-full border border-line px-5 py-2.5 font-semibold hover:bg-white"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}

        {sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="pt-12" aria-labelledby={`h-${s.id}`}>
            <div className="flex items-baseline gap-3 border-b border-line pb-3">
              <h2 id={`h-${s.id}`} className="font-display text-3xl font-semibold tracking-tight">
                {s.name}
              </h2>
              <span className="text-sm text-muted">{s.items.length}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
              {s.items.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={() => setOpenProductId(p.id)}
                  onQuickAdd={() => addToCart(p.id)}
                    canAdd={canOrder}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-line bg-cream-deep/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
          <div className="flex items-center gap-4">
            {settings.logo_url && (
              <Image
                src={settings.logo_url}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded-full shadow-card"
              />
            )}
            <div>
              <p className="font-display text-2xl font-semibold">{settings.name}</p>
              {settings.tagline && (
                <p className="mt-1 text-sm text-ink-soft">{settings.tagline}</p>
              )}
            </div>
          </div>
          <div className="space-y-2 text-sm text-ink-soft md:self-center">
            {settings.hours_text && <p>{settings.hours_text}</p>}
            {settings.address && <p>{settings.address}</p>}
          </div>
          <ul className="space-y-3 text-[15px] font-semibold md:self-center md:justify-self-end">
            {whatsappHref && (
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 hover:text-accent"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#1f8f4e] shadow-card">
                    <WhatsappIcon />
                  </span>
                  {formatWhatsapp(settings.whatsapp)}
                </a>
              </li>
            )}
            {settings.instagram && (
              <li>
                <a
                  href={`https://instagram.com/${settings.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 hover:text-accent"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-accent shadow-card">
                    <InstagramIcon />
                  </span>
                  @{settings.instagram}
                </a>
              </li>
            )}
          </ul>
        </div>
        <p className="border-t border-line py-5 text-center text-xs text-muted">
          Catálogo digital por <span className="font-semibold text-ink-soft">Azven</span>
        </p>
      </footer>

      {/* Barra flutuante da sacola (celular) */}
      {itemCount > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex h-14 w-full items-center justify-between rounded-full bg-ink pl-5 pr-6 font-semibold text-cream shadow-lift animate-sheet-up"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-8 min-w-8 place-items-center rounded-full bg-gold px-1.5 text-sm font-bold text-ink">
                {itemCount}
              </span>
              Ver sacola
            </span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      <Sheet
        open={!!openProduct}
        onClose={() => setOpenProductId(null)}
        label={openProduct?.name ?? "Produto"}
        variant="center"
      >
        {openProduct && (
          <ProductDialogBody
            key={openProduct.id}
            product={openProduct}
            categoryName={
              openProduct.category_id ? (categoryName.get(openProduct.category_id) ?? null) : null
            }
            canOrder={canOrder}
            onClose={() => setOpenProductId(null)}
            onAdd={(qty, note) => {
              addToCart(openProduct.id, qty, note);
              setOpenProductId(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} label="Sacola" variant="side">
        <CartPanel
          settings={settings}
          lines={lines}
          unavailable={unavailable}
          onQty={cart.setQty}
          onRemove={cart.remove}
          onClear={cart.clear}
          onClose={() => setCartOpen(false)}
        />
      </Sheet>
    </>
  );
}
