import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/auth";
import { bySort } from "@/lib/catalog";
import { readCatalog } from "@/lib/store";

export const metadata: Metadata = { title: "Novo produto · Painel" };

export default async function NewProductPage() {
  await requireAdmin();
  const categories = [...(await readCatalog()).doc.categories].sort(bySort);

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
        ← Produtos
      </Link>
      <h1 className="mb-8 mt-2 font-display text-3xl font-semibold tracking-tight">Novo produto</h1>
      <ProductForm product={null} imageUrl={null} categories={categories} />
    </>
  );
}
