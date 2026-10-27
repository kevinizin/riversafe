import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { CategoryManager } from "./CategoryManager";

export const metadata: Metadata = { title: "Categorias · Painel" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("products").select("category_id"),
  ]);

  const counts: Record<string, number> = {};
  for (const p of products ?? []) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Categorias</h1>
      <p className="mt-1 text-sm text-muted">
        Organizam o cardápio e viram os atalhos no topo do catálogo.
      </p>
      <CategoryManager categories={(categories ?? []) as Category[]} counts={counts} />
    </>
  );
}
