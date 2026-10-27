export type StoreSettings = {
  name: string;
  tagline: string | null;
  whatsapp: string;
  instagram: string | null;
  address: string | null;
  hours_text: string | null;
  accepting_orders: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee_cents: number;
  min_order_cents: number;
  cover_image_path: string | null;
  logo_image_path: string | null;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  serving: string | null;
  tags: string[];
  image_path: string | null;
  is_visible: boolean;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
};

/** Produto já pronto para o catálogo público (URL da foto resolvida). */
export type CatalogProduct = Omit<Product, "image_path" | "is_visible" | "sort_order"> & {
  image_url: string | null;
};

export type CatalogSettings = Omit<StoreSettings, "cover_image_path" | "logo_image_path"> & {
  cover_url: string | null;
  logo_url: string | null;
};
