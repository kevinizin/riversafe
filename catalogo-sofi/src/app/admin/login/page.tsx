import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Painel", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await connection();
  const { erro } = await searchParams;

  if (!isDemoMode && erro !== "acesso") {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/admin");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-cream-deep/60 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink font-display text-lg font-semibold text-cream">
            A
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">Painel da loja</h1>
          <p className="mt-1 text-sm text-muted">Entre para gerenciar seu catálogo</p>
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-card">
          {isDemoMode && (
            <p className="mb-5 rounded-xl bg-cream-deep px-4 py-3 text-sm text-ink-soft">
              Modo demonstração: conecte o Supabase (veja o README) para ativar o painel.
            </p>
          )}
          {erro === "acesso" && (
            <p className="mb-5 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-deep">
              Esta conta não tem acesso ao painel.
            </p>
          )}
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Sistema por Azven · conexão protegida</p>
      </div>
    </main>
  );
}
