import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/admin/ConfirmDelete";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/images";
import type { Category, Product } from "@/lib/types";
import { uuid } from "@/lib/validation";
import { deleteProduct } from "../../../actions";

export const metadata: Metadata = { title: "Editar produto · Painel" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const { supabase } = await requireAdmin();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order").order("name"),
  ]);
  if (!product) notFound();
  const p = product as Product;

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
        ← Produtos
      </Link>
      <div className="mb-8 mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Editar produto</h1>
        <ConfirmDelete
          action={deleteProduct}
          id={p.id}
          message={`Excluir “${p.name}”? Esta ação não pode ser desfeita.`}
          label="Excluir produto"
        />
      </div>
      <ProductForm
        product={p}
        imageUrl={publicImageUrl(p.image_path)}
        categories={(categories ?? []) as Category[]}
      />
    </>
  );
}
