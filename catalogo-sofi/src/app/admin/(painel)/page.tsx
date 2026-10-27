import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { bySort } from "@/lib/catalog";
import { readCatalog } from "@/lib/store";
import { publicImageUrl } from "@/lib/images";
import { ProductList } from "./ProductList";

export const metadata: Metadata = { title: "Produtos · Painel" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string; removido?: string }>;
}) {
  await requireAdmin();
  const { salvo, removido } = await searchParams;
  const { doc } = await readCatalog();

  const rows = [...doc.products].sort(bySort).map((p) => ({
    ...p,
    image_url: publicImageUrl(p.image_path),
  }));

  const flash = salvo
    ? `“${salvo.slice(0, 100)}” salvo com sucesso.`
    : removido
      ? "Produto excluído."
      : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "produto" : "produtos"} no catálogo
          </p>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex h-11 items-center rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-deep"
        >
          + Novo produto
        </Link>
      </div>

      {flash && (
        <p role="status" className="mt-6 rounded-xl bg-leaf-soft px-4 py-3 text-sm font-medium text-leaf">
          {flash}
        </p>
      )}

      <ProductList products={rows} categories={[...doc.categories].sort(bySort)} />
    </>
  );
}
