"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageIcon, SearchIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { toggleProduct } from "../actions";

type Row = Product & { image_url: string | null };

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ProductList({ products, categories }: { products: Row[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = products.filter((p) => {
    if (category === "none" ? p.category_id !== null : category !== "all" && p.category_id !== category) {
      return false;
    }
    return !query || normalize(p.name).includes(normalize(query));
  });

  if (products.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-line bg-white px-6 py-16 text-center">
        <p className="font-display text-2xl font-semibold">Seu catálogo está vazio</p>
        <p className="mt-2 text-ink-soft">Crie as categorias e cadastre o primeiro produto.</p>
        <Link
          href="/admin/produtos/novo"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink px-5 font-semibold text-cream hover:bg-accent"
        >
          Cadastrar produto
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar produto</span>
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto…"
            className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 focus:border-accent focus:outline-none"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 rounded-xl border border-line bg-white px-3 font-medium focus:border-accent focus:outline-none sm:w-60"
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Sem categoria</option>
        </select>
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {filtered.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            <Link href={`/admin/produtos/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-deep">
                {p.image_url ? (
                  <Image src={p.image_url} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  <ImageIcon className="absolute inset-0 m-auto text-muted" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block truncate text-sm text-muted">
                  {p.category_id ? (names.get(p.category_id) ?? "Sem categoria") : "Sem categoria"}
                </span>
                <span className="text-sm font-semibold">
                  {formatPrice(p.price_cents)}
                  {p.compare_at_cents && (
                    <span className="ml-2 font-normal text-muted line-through">
                      {formatPrice(p.compare_at_cents)}
                    </span>
                  )}
                </span>
              </span>
            </Link>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
              <Toggle id={p.id} field="is_available" value={p.is_available} on="Disponível" off="Esgotado" />
              <Toggle id={p.id} field="is_visible" value={p.is_visible} on="Visível" off="Oculto" />
              <Toggle id={p.id} field="is_featured" value={p.is_featured} on="★ Destaque" off="☆ Destaque" />
              <Link
                href={`/admin/produtos/${p.id}`}
                className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-cream-deep sm:ml-1"
              >
                Editar
              </Link>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-muted">Nenhum produto encontrado.</li>
        )}
      </ul>
    </>
  );
}

function Toggle({
  id,
  field,
  value,
  on,
  off,
}: {
  id: string;
  field: "is_available" | "is_visible" | "is_featured";
  value: boolean;
  on: string;
  off: string;
}) {
  return (
    <form action={toggleProduct}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(!value)} />
      <ToggleButton value={value} on={on} off={off} />
    </form>
  );
}

function ToggleButton({ value, on, off }: { value: boolean; on: string; off: string }) {
  const { pending } = useFormStatus();
  const shown = pending ? !value : value;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={value}
      title="Clique para alternar"
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
        shown ? "bg-leaf-soft text-leaf hover:bg-leaf/20" : "bg-cream-deep text-muted hover:bg-line"
      }`}
    >
      {shown ? on : off}
    </button>
  );
}
