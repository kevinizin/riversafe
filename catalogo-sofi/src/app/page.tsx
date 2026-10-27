import type { Metadata } from "next";
import { connection } from "next/server";
import { Catalog } from "@/components/catalog/Catalog";
import { getCatalog } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { settings } = await getCatalog();
  return {
    title: settings.name,
    description: settings.tagline ?? `Faça seu pedido na ${settings.name}.`,
    openGraph: {
      title: settings.name,
      description: settings.tagline ?? undefined,
      images: settings.cover_url ? [settings.cover_url] : undefined,
      locale: "pt_BR",
      type: "website",
    },
  };
}

export default async function HomePage() {
  // Renderização dinâmica: necessária para o nonce da CSP e para o catálogo
  // refletir na hora o que foi alterado no painel.
  await connection();
  const data = await getCatalog();
  return <Catalog {...data} />;
}
