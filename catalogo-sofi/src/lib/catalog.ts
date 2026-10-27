import "server-only";
import { cache } from "react";
import { isDemoMode } from "@/lib/env";
import { publicImageUrl } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/server";
import { demoCategories, demoProducts, demoSettings } from "@/lib/demo-data";
import type {
  CatalogProduct,
  CatalogSettings,
  Category,
  Product,
  StoreSettings,
} from "@/lib/types";

export type CatalogData = {
  settings: CatalogSettings;
  categories: Pick<Category, "id" | "name">[];
  products: CatalogProduct[];
  demo: boolean;
};

const SETTINGS_COLUMNS =
  "name, tagline, whatsapp, instagram, address, hours_text, accepting_orders, delivery_enabled, pickup_enabled, delivery_fee_cents, min_order_cents, cover_image_path, logo_image_path";
const PRODUCT_COLUMNS =
  "id, category_id, name, description, price_cents, compare_at_cents, serving, tags, image_path, is_visible, is_available, is_featured, sort_order";

function toCatalog(
  settings: StoreSettings,
  categories: Category[],
  products: Product[],
  demo: boolean,
): CatalogData {
  const { cover_image_path, logo_image_path, ...rest } = settings;
  return {
    settings: {
      ...rest,
      cover_url: publicImageUrl(cover_image_path),
      logo_url: publicImageUrl(logo_image_path),
    },
    categories: categories.map(({ id, name }) => ({ id, name })),
    products: products.map(
      ({ image_path, is_visible: _v, sort_order: _s, ...product }) => ({
        ...product,
        image_url: publicImageUrl(image_path),
      }),
    ),
    demo,
  };
}

export const getCatalog = cache(async (): Promise<CatalogData> => {
  if (isDemoMode) {
    return toCatalog(
      demoSettings,
      demoCategories,
      demoProducts.filter((p) => p.is_visible),
      true,
    );
  }

  // Cliente anônimo: as policies RLS só devolvem o que é público.
  const supabase = createPublicClient();
  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase.from("store_settings").select(SETTINGS_COLUMNS).eq("id", 1).single(),
    supabase
      .from("categories")
      .select("id, name, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("is_visible", true)
      .order("sort_order")
      .order("name"),
  ]);

  const error = settingsRes.error ?? categoriesRes.error ?? productsRes.error;
  if (error) throw new Error(`Falha ao carregar o catálogo: ${error.message}`);

  return toCatalog(
    settingsRes.data as StoreSettings,
    categoriesRes.data as Category[],
    productsRes.data as Product[],
    false,
  );
});
