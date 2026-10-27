import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/images";
import { readCatalog } from "@/lib/store";
import { PasswordForm, SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Loja · Painel" };

export default async function SettingsPage() {
  await requireAdmin();
  const { settings } = (await readCatalog()).doc;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Dados da loja</h1>
      <p className="mt-1 text-sm text-muted">Aparecem no topo do catálogo e no pedido do WhatsApp.</p>
      <SettingsForm
        settings={settings}
        coverUrl={publicImageUrl(settings.cover_image_path)}
        logoUrl={publicImageUrl(settings.logo_image_path)}
      />

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-tight">Minha conta</h2>
      <PasswordForm />
    </>
  );
}
