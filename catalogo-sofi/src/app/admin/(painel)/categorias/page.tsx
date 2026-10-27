import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { bySort } from "@/lib/catalog";
import { readCatalog } from "@/lib/store";
import { CategoryManager } from "./CategoryManager";

export const metadata: Metadata = { title: "Categorias · Painel" };

export default async function CategoriesPage() {
  await requireAdmin();
  const { doc } = await readCatalog();

  const counts: Record<string, number> = {};
  for (const p of doc.products) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Categorias</h1>
      <p className="mt-1 text-sm text-muted">
        Organizam o cardápio e viram os atalhos no topo do catálogo.
      </p>
      <CategoryManager categories={[...doc.categories].sort(bySort)} counts={counts} />
    </>
  );
}
