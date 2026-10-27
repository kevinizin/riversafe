import "server-only";
import { cache } from "react";
import { publicImageUrl } from "@/lib/images";
import { readCatalog } from "@/lib/store";
import { isDemoMode } from "@/lib/env";
import { demoCategories, demoProducts, demoSettings } from "@/lib/demo-data";
import type { CatalogProduct, CatalogSettings, Category } from "@/lib/types";

export type CatalogData = {
  settings: CatalogSettings;
  categories: Pick<Category, "id" | "name">[];
  products: CatalogProduct[];
  demo: boolean;
};

const bySort = <T extends { sort_order: number; name: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR");

/** Só o que é público: categorias ativas e produtos visíveis. */
export const getCatalog = cache(async (): Promise<CatalogData> => {
  const doc = isDemoMode
    ? { settings: demoSettings, categories: demoCategories, products: demoProducts }
    : (await readCatalog()).doc;

  const { cover_image_path, logo_image_path, ...settings } = doc.settings;
  return {
    settings: {
      ...settings,
      cover_url: publicImageUrl(cover_image_path),
      logo_url: publicImageUrl(logo_image_path),
    },
    categories: doc.categories
      .filter((c) => c.is_active)
      .sort(bySort)
      .map(({ id, name }) => ({ id, name })),
    products: doc.products
      .filter((p) => p.is_visible)
      .sort(bySort)
      .map(({ image_path, is_visible: _v, sort_order: _s, ...p }) => ({
        ...p,
        image_url: publicImageUrl(image_path),
      })),
    demo: isDemoMode,
  };
});

export { bySort };
